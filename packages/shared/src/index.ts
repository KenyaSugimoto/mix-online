// Mix Stud Online - Shared Types
// このファイルに共通の型定義を追加していきます

export type GameType = "STUD_HI" | "RAZZ" | "STUD_8";

export type SeatStatus =
  | "EMPTY"
  | "SEATED_WAIT_NEXT_HAND"
  | "ACTIVE"
  | "SIT_OUT"
  | "DISCONNECTED";

export type TableStatus =
  | "WAITING"
  | "DEALING"
  | "BETTING"
  | "SHOWDOWN"
  | "HAND_END";

export type HandPlayerState = "IN_HAND" | "FOLDED" | "ALL_IN" | "AUTO_FOLDED";
