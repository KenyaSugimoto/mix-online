import {
  ActionType,
  type RealtimeTableEventMessage,
  ShowdownAction,
  type ShowdownEventPayload,
  Street,
  TableEventName,
} from "@mix-online/shared";
import {
  type HandActionRecord,
  type HandHistoryDetailRecord,
  type HandHistoryListItemRecord,
  type HandParticipantRecord,
  type PotResultRecord,
  type ShowdownSummaryRecord,
  type StreetActionGroupRecord,
  compareHistoryOrder,
} from "../../history-hand";
import type { HistoryRepository } from "./contract";

const STREET_ORDER: Street[] = [
  Street.THIRD,
  Street.FOURTH,
  Street.FIFTH,
  Street.SIXTH,
  Street.SEVENTH,
];

type RuntimeHandParticipant = HandParticipantRecord;

type RuntimeHandRecord = {
  handId: string;
  tableId: string;
  handNo: number | undefined;
  gameType: HandHistoryDetailRecord["gameType"];
  startedAt: string;
  endedAt: string | null;
  participantsBySeatNo: Map<number, RuntimeHandParticipant>;
  actionSeq: number;
  streetActionsByStreet: Map<Street, HandActionRecord[]>;
  showdown: ShowdownSummaryRecord;
};

export type RuntimeHistoryRepository = HistoryRepository & {
  recordEvents(events: RealtimeTableEventMessage[]): void;
};

const createRuntimeHandFromDealInit = (
  event: Extract<
    RealtimeTableEventMessage,
    { eventName: typeof TableEventName.DealInitEvent }
  >,
): RuntimeHandRecord => {
  const participantsBySeatNo = new Map<number, RuntimeHandParticipant>(
    event.payload.participants.map((participant) => [
      participant.seatNo,
      {
        seatNo: participant.seatNo,
        userId: participant.userId,
        displayName: participant.displayName,
        resultDelta: null,
        shownCardsUp: null,
        shownCardsDown: null,
      },
    ]),
  );

  return {
    handId: event.handId ?? "",
    tableId: event.tableId,
    handNo: event.payload.handNo,
    gameType: event.payload.gameType,
    startedAt: event.occurredAt,
    endedAt: null,
    participantsBySeatNo,
    actionSeq: 0,
    streetActionsByStreet: new Map(),
    showdown: {
      hasShowdown: false,
      potResults: [],
    },
  };
};

const formatCard = (card: { rank: string; suit: string }) =>
  `${card.rank}${card.suit}`;

const getOrCreateStreetActions = (
  hand: RuntimeHandRecord,
  street: Street,
): HandActionRecord[] => {
  const existing = hand.streetActionsByStreet.get(street);
  if (existing) {
    return existing;
  }

  const created: HandActionRecord[] = [];
  hand.streetActionsByStreet.set(street, created);
  return created;
};

const appendAction = (params: {
  hand: RuntimeHandRecord;
  street: Street;
  actionType: HandActionRecord["actionType"];
  seatNo: number;
  isAuto: boolean;
  amount: number | null;
  potAfter: number | null;
  occurredAt: string;
}) => {
  const participant = params.hand.participantsBySeatNo.get(params.seatNo);
  const actions = getOrCreateStreetActions(params.hand, params.street);
  params.hand.actionSeq += 1;

  actions.push({
    seq: params.hand.actionSeq,
    actionType: params.actionType,
    seatNo: params.seatNo,
    isAuto: params.isAuto,
    userId: participant?.userId ?? null,
    displayName: participant?.displayName ?? null,
    amount: params.amount,
    potAfter: params.potAfter,
    occurredAt: params.occurredAt,
  });
};

const ensureParticipant = (params: {
  hand: RuntimeHandRecord;
  seatNo: number;
  userId: string;
  displayName: string;
}) => {
  const existing = params.hand.participantsBySeatNo.get(params.seatNo);
  if (existing) {
    return existing;
  }

  const created: RuntimeHandParticipant = {
    seatNo: params.seatNo,
    userId: params.userId,
    displayName: params.displayName,
    resultDelta: null,
    shownCardsUp: null,
    shownCardsDown: null,
  };
  params.hand.participantsBySeatNo.set(params.seatNo, created);
  return created;
};

const mapPotResults = (potResults: ShowdownEventPayload["potResults"]) =>
  potResults.map<PotResultRecord>((potResult) => ({
    potNo: potResult.potNo,
    side: potResult.side,
    amount: potResult.amount,
    winners: potResult.winners.map((winner) => ({
      userId: winner.userId,
      displayName: winner.displayName,
      amount: winner.amount,
    })),
  }));

const toParticipants = (
  participantsBySeatNo: Map<number, RuntimeHandParticipant>,
) => {
  return [...participantsBySeatNo.values()].sort(
    (left, right) => left.seatNo - right.seatNo,
  );
};

const toStreetActions = (
  streetActionsByStreet: Map<Street, HandActionRecord[]>,
) => {
  return STREET_ORDER.map<StreetActionGroupRecord>((street) => ({
    street,
    actions: [...(streetActionsByStreet.get(street) ?? [])].sort(
      (left, right) => left.seq - right.seq,
    ),
  })).filter((group) => group.actions.length > 0);
};

const toHistoryListItem = (
  hand: RuntimeHandRecord,
  userId: string,
): HandHistoryListItemRecord | null => {
  if (!hand.endedAt) {
    return null;
  }

  const participants = toParticipants(hand.participantsBySeatNo);
  const currentUser = participants.find(
    (participant) => participant.userId === userId,
  );
  if (!currentUser) {
    return null;
  }

  return {
    handId: hand.handId,
    tableId: hand.tableId,
    handNo: hand.handNo,
    gameType: hand.gameType,
    participants,
    startedAt: hand.startedAt,
    endedAt: hand.endedAt,
    profitLoss: currentUser.resultDelta ?? 0,
  };
};

const toHistoryDetail = (
  hand: RuntimeHandRecord,
  userId: string,
): HandHistoryDetailRecord | null => {
  if (!hand.endedAt) {
    return null;
  }

  const participants = toParticipants(hand.participantsBySeatNo);
  const currentUser = participants.find(
    (participant) => participant.userId === userId,
  );
  if (!currentUser) {
    return null;
  }

  return {
    handId: hand.handId,
    tableId: hand.tableId,
    handNo: hand.handNo,
    gameType: hand.gameType,
    participants,
    streetActions: toStreetActions(hand.streetActionsByStreet),
    showdown: hand.showdown,
    profitLoss: currentUser.resultDelta ?? 0,
    startedAt: hand.startedAt,
    endedAt: hand.endedAt,
  };
};

export const createRuntimeHistoryRepository = (): RuntimeHistoryRepository => {
  const handsByHandId = new Map<string, RuntimeHandRecord>();

  const recordEvents = (events: RealtimeTableEventMessage[]) => {
    for (const event of events) {
      if (!event.handId) {
        continue;
      }

      if (event.eventName === TableEventName.DealInitEvent) {
        handsByHandId.set(event.handId, createRuntimeHandFromDealInit(event));
        continue;
      }

      const hand = handsByHandId.get(event.handId);
      if (!hand) {
        continue;
      }

      switch (event.eventName) {
        case TableEventName.PostAnteEvent: {
          for (const contribution of event.payload.contributions) {
            appendAction({
              hand,
              street: Street.THIRD,
              actionType: ActionType.ANTE,
              seatNo: contribution.seatNo,
              isAuto: false,
              amount: contribution.amount,
              potAfter: event.payload.potAfter,
              occurredAt: event.occurredAt,
            });
          }
          break;
        }
        case TableEventName.BringInEvent: {
          appendAction({
            hand,
            street: event.payload.street,
            actionType: ActionType.BRING_IN,
            seatNo: event.payload.seatNo,
            isAuto: false,
            amount: event.payload.amount,
            potAfter: event.payload.potAfter,
            occurredAt: event.occurredAt,
          });
          break;
        }
        case TableEventName.CallEvent: {
          appendAction({
            hand,
            street: event.payload.street,
            actionType: ActionType.CALL,
            seatNo: event.payload.seatNo,
            isAuto: false,
            amount: event.payload.amount,
            potAfter: event.payload.potAfter,
            occurredAt: event.occurredAt,
          });
          break;
        }
        case TableEventName.BetEvent: {
          appendAction({
            hand,
            street: event.payload.street,
            actionType: ActionType.BET,
            seatNo: event.payload.seatNo,
            isAuto: false,
            amount: event.payload.amount,
            potAfter: event.payload.potAfter,
            occurredAt: event.occurredAt,
          });
          break;
        }
        case TableEventName.CompleteEvent: {
          appendAction({
            hand,
            street: event.payload.street,
            actionType: ActionType.COMPLETE,
            seatNo: event.payload.seatNo,
            isAuto: false,
            amount: event.payload.amount,
            potAfter: event.payload.potAfter,
            occurredAt: event.occurredAt,
          });
          break;
        }
        case TableEventName.RaiseEvent: {
          appendAction({
            hand,
            street: event.payload.street,
            actionType: ActionType.RAISE,
            seatNo: event.payload.seatNo,
            isAuto: false,
            amount: event.payload.amount,
            potAfter: event.payload.potAfter,
            occurredAt: event.occurredAt,
          });
          break;
        }
        case TableEventName.CheckEvent: {
          appendAction({
            hand,
            street: event.payload.street,
            actionType: event.payload.isAuto
              ? ActionType.AUTO_CHECK
              : ActionType.CHECK,
            seatNo: event.payload.seatNo,
            isAuto: event.payload.isAuto,
            amount: null,
            potAfter: event.payload.potAfter,
            occurredAt: event.occurredAt,
          });
          break;
        }
        case TableEventName.FoldEvent: {
          appendAction({
            hand,
            street: event.payload.street,
            actionType: event.payload.isAuto
              ? ActionType.AUTO_FOLD
              : ActionType.FOLD,
            seatNo: event.payload.seatNo,
            isAuto: event.payload.isAuto,
            amount: null,
            potAfter: event.payload.potAfter,
            occurredAt: event.occurredAt,
          });
          break;
        }
        case TableEventName.ShowdownEvent: {
          hand.showdown = {
            hasShowdown: event.payload.hasShowdown,
            potResults: mapPotResults(event.payload.potResults),
          };

          for (const player of event.payload.players) {
            const participant = hand.participantsBySeatNo.get(player.seatNo);
            if (!participant) {
              continue;
            }

            if (player.action === ShowdownAction.SHOW) {
              participant.shownCardsUp = player.cardsUp.map(formatCard);
              participant.shownCardsDown = player.cardsDown.map(formatCard);
            }
          }
          break;
        }
        case TableEventName.DealEndEvent: {
          hand.endedAt = event.occurredAt;
          for (const result of event.payload.results) {
            const participant = ensureParticipant({
              hand,
              seatNo: result.seatNo,
              userId: result.userId,
              displayName: result.displayName,
            });
            participant.resultDelta = result.delta;
          }
          break;
        }
        default:
          break;
      }
    }
  };

  return {
    recordEvents,
    async listHands(userId) {
      return [...handsByHandId.values()]
        .map((hand) => toHistoryListItem(hand, userId))
        .filter((item): item is HandHistoryListItemRecord => item !== null)
        .sort((left, right) =>
          compareHistoryOrder(
            {
              endedAt: left.endedAt,
              handId: left.handId,
            },
            {
              endedAt: right.endedAt,
              handId: right.handId,
            },
          ),
        );
    },
    async getHandDetail(userId, handId) {
      const hand = handsByHandId.get(handId);
      if (!hand) {
        return null;
      }
      return toHistoryDetail(hand, userId);
    },
  };
};
