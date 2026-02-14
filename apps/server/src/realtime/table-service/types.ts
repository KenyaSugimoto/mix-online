import type {
  CardRank as CardRankType,
  CardSuit as CardSuitType,
  GameType as GameTypeType,
  HandStatus,
  RealtimeTableEventMessage,
  RealtimeTableServiceFailure,
  RealtimeTableState,
  Street,
} from "@mix-online/shared";

export type TableSeat = RealtimeTableState["seats"][number] & {
  statusBeforeDisconnect: RealtimeTableState["seats"][number]["status"] | null;
};

export type TableState = Omit<RealtimeTableState, "seats"> & {
  seats: TableSeat[];
  gameType: GameTypeType;
  mixIndex: number;
  handsSinceRotation: number;
  dealerSeatNo: number;
  smallBet: number;
  bigBet: number;
  ante: number;
  bringIn: number;
  currentHand: HandState | null;
  nextHandNo: number;
};

export type HandPlayerState = {
  seatNo: number;
  userId: string;
  displayName: string;
  startStack: number;
  totalContribution: number;
  streetContribution: number;
  cardsUp: CardValue[];
  cardsDown: CardValue[];
  inHand: boolean;
  allIn: boolean;
  actedThisRound: boolean;
};

export type CardValue = {
  rank: CardRankType;
  suit: CardSuitType;
};

export type HandState = {
  handId: string;
  handNo: number;
  status: HandStatus;
  street: Street;
  potTotal: number;
  toActSeatNo: number | null;
  bringInSeatNo: number | null;
  players: HandPlayerState[];
  streetBetTo: number;
  raiseCount: number;
  deck: CardValue[];
};

export type TableEventMessage = RealtimeTableEventMessage;

export type RealtimeTableServiceRuntimeState = {
  tables: Record<string, TableState>;
  walletByUserId: Record<string, number>;
  eventHistoryByTableId: Record<string, TableEventMessage[]>;
};

type DistributiveOmit<T, K extends PropertyKey> = T extends unknown
  ? Omit<T, K>
  : never;

export type PendingEvent = DistributiveOmit<
  RealtimeTableEventMessage,
  "type" | "tableId" | "tableSeq" | "handSeq" | "occurredAt"
>;

export type ApplyCommandSuccess = {
  ok: true;
  events: PendingEvent[];
  nextWalletBalance: number;
  startHand: boolean;
};

export type ApplyCommandFailure = RealtimeTableServiceFailure;

export type ApplyCommandResult = ApplyCommandSuccess | ApplyCommandFailure;
