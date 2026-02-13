import { randomUUID } from "node:crypto";
import {
  CardVisibility,
  type GameType as GameTypeType,
  HandStatus,
  SeatStatus,
  Street,
  TableEventName,
  TableStatus,
  ThirdStreetCardPosition,
} from "@mix-online/shared";
import { createStandardDeck } from "../testing/fixed-deck-harness";
import { resolveGameRule } from "./game-rule";
import { resolveNextToAct } from "./table-service-turn";
import type {
  CardValue,
  HandPlayerState,
  HandState,
  PendingEvent,
  TableState,
} from "./table-service-types";

const determineBringInSeat = (
  gameType: GameTypeType,
  players: HandPlayerState[],
): number => {
  const gameRule = resolveGameRule(gameType);
  return gameRule.determineBringIn(
    players.map((player) => ({
      seatNo: player.seatNo,
      upCards: player.cardsUp,
      hasPairOnBoard: false,
    })),
  );
};

export const startThirdStreet = (table: TableState): PendingEvent[] => {
  const participants = table.seats
    .filter(
      (seat) => seat.status === SeatStatus.ACTIVE && seat.stack >= table.ante,
    )
    .map<HandPlayerState>((seat) => ({
      seatNo: seat.seatNo,
      userId: seat.userId ?? "",
      displayName: seat.displayName ?? "",
      startStack: seat.stack,
      totalContribution: 0,
      streetContribution: 0,
      cardsUp: [],
      cardsDown: [],
      inHand: true,
      allIn: false,
      actedThisRound: false,
    }));

  if (participants.length < 2) {
    return [];
  }

  table.status = TableStatus.DEALING;
  const handId = randomUUID();
  const handNo = table.nextHandNo;
  table.nextHandNo += 1;

  const hand: HandState = {
    handId,
    handNo,
    status: HandStatus.IN_PROGRESS,
    street: Street.THIRD,
    potTotal: 0,
    toActSeatNo: null,
    bringInSeatNo: null,
    players: participants,
    streetBetTo: 0,
    raiseCount: 0,
  };

  const dealInitEvent: PendingEvent = {
    handId,
    eventName: TableEventName.DealInitEvent,
    payload: {
      handNo,
      gameType: table.gameType,
      dealerSeatNo: table.dealerSeatNo,
      mixIndex: table.mixIndex,
      handsSinceRotation: table.handsSinceRotation,
      stakes: {
        smallBet: table.smallBet,
        bigBet: table.bigBet,
        ante: table.ante,
        bringIn: table.bringIn,
      },
      participants: participants.map((player) => ({
        seatNo: player.seatNo,
        userId: player.userId,
        displayName: player.displayName,
        startStack: player.startStack,
      })),
    },
  };

  const postAnteContributions: Array<{
    seatNo: number;
    amount: number;
    stackAfter: number;
    isAllIn: boolean;
  }> = [];

  for (const player of hand.players) {
    const seat = table.seats.find((entry) => entry.seatNo === player.seatNo);
    if (!seat) {
      continue;
    }

    const ante = Math.min(table.ante, seat.stack);
    seat.stack -= ante;
    player.totalContribution += ante;
    if (seat.stack === 0) {
      player.allIn = true;
    }

    hand.potTotal += ante;
    postAnteContributions.push({
      seatNo: seat.seatNo,
      amount: ante,
      stackAfter: seat.stack,
      isAllIn: seat.stack === 0,
    });
  }

  const postAnteEvent: PendingEvent = {
    handId,
    eventName: TableEventName.PostAnteEvent,
    payload: {
      street: Street.THIRD,
      contributions: postAnteContributions,
      potAfter: hand.potTotal,
    },
  };

  const deck = createStandardDeck();
  const thirdStreetCards: Array<{
    seatNo: number;
    cards: Array<{
      position:
        | typeof ThirdStreetCardPosition.HOLE_1
        | typeof ThirdStreetCardPosition.HOLE_2
        | typeof ThirdStreetCardPosition.UP_3;
      visibility: typeof CardVisibility.DOWN_HIDDEN | typeof CardVisibility.UP;
      card: CardValue | null;
    }>;
  }> = [];

  for (const player of hand.players) {
    const hole1 = deck.shift();
    const hole2 = deck.shift();
    const up3 = deck.shift();
    if (!hole1 || !hole2 || !up3) {
      continue;
    }

    player.cardsDown.push(hole1, hole2);
    player.cardsUp.push(up3);

    thirdStreetCards.push({
      seatNo: player.seatNo,
      cards: [
        {
          position: ThirdStreetCardPosition.HOLE_1,
          visibility: CardVisibility.DOWN_HIDDEN,
          card: null,
        },
        {
          position: ThirdStreetCardPosition.HOLE_2,
          visibility: CardVisibility.DOWN_HIDDEN,
          card: null,
        },
        {
          position: ThirdStreetCardPosition.UP_3,
          visibility: CardVisibility.UP,
          card: up3,
        },
      ],
    });
  }

  const bringInSeatNo = determineBringInSeat(table.gameType, hand.players);
  hand.bringInSeatNo = bringInSeatNo;

  const dealCards3rdEvent: PendingEvent = {
    handId,
    eventName: TableEventName.DealCards3rdEvent,
    payload: {
      street: Street.THIRD,
      bringInSeatNo,
      cards: thirdStreetCards,
    },
  };

  const bringInPlayer = hand.players.find(
    (player) => player.seatNo === bringInSeatNo,
  );
  const bringInSeat = table.seats.find((seat) => seat.seatNo === bringInSeatNo);
  if (!bringInPlayer || !bringInSeat) {
    table.currentHand = hand;
    return [dealInitEvent, postAnteEvent, dealCards3rdEvent];
  }

  const bringInAmount = Math.min(table.bringIn, bringInSeat.stack);
  bringInSeat.stack -= bringInAmount;
  bringInPlayer.totalContribution += bringInAmount;
  bringInPlayer.streetContribution += bringInAmount;
  bringInPlayer.actedThisRound = true;
  if (bringInSeat.stack === 0) {
    bringInPlayer.allIn = true;
  }

  hand.potTotal += bringInAmount;
  hand.streetBetTo = bringInAmount;

  const nextToActSeatNo = resolveNextToAct(hand, bringInSeatNo);
  hand.toActSeatNo = nextToActSeatNo;
  table.currentHand = hand;
  table.status = TableStatus.BETTING;

  const bringInEvent: PendingEvent = {
    handId,
    eventName: TableEventName.BringInEvent,
    payload: {
      street: Street.THIRD,
      seatNo: bringInSeatNo,
      amount: bringInAmount,
      stackAfter: bringInSeat.stack,
      potAfter: hand.potTotal,
      nextToActSeatNo,
      isAllIn: bringInSeat.stack === 0,
    },
  };

  return [dealInitEvent, postAnteEvent, dealCards3rdEvent, bringInEvent];
};
