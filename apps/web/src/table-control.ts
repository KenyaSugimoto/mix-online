import {
  MVP_TABLE_ACT_ACTIONS,
  RealtimeTableCommandType,
  SeatStatus,
  type SeatStatus as SeatStatusType,
  Street,
  type Street as StreetType,
  TableCommandAction,
  type TableCommandAction as TableCommandActionType,
} from "@mix-online/shared";

export const SEAT_COMMAND_TYPES = [
  RealtimeTableCommandType.JOIN,
  RealtimeTableCommandType.SIT_OUT,
  RealtimeTableCommandType.RETURN,
  RealtimeTableCommandType.LEAVE,
] as const;
export type SeatCommandType = (typeof SEAT_COMMAND_TYPES)[number];

type SeatCommandAvailability = Record<SeatCommandType, boolean>;

export type TableControlState = {
  modeLabel: string;
  note: string;
  actionInputEnabled: boolean;
  seatCommandAvailability: SeatCommandAvailability;
};

const noSeatCommands: SeatCommandAvailability = {
  [RealtimeTableCommandType.JOIN]: false,
  [RealtimeTableCommandType.SIT_OUT]: false,
  [RealtimeTableCommandType.RETURN]: false,
  [RealtimeTableCommandType.LEAVE]: false,
};

export const formatSeatCommandLabel = (commandType: SeatCommandType) => {
  if (commandType === RealtimeTableCommandType.JOIN) {
    return "着席";
  }
  if (commandType === RealtimeTableCommandType.SIT_OUT) {
    return "SIT OUT";
  }
  if (commandType === RealtimeTableCommandType.RETURN) {
    return "復帰";
  }
  return "退席";
};

const joinCommandLabels = (commandTypes: SeatCommandType[]) =>
  commandTypes
    .map((commandType) => formatSeatCommandLabel(commandType))
    .join(" / ");

export const resolveTableControlState = (params: {
  seatStatus: SeatStatusType | null;
  isYourTurn: boolean;
}): TableControlState => {
  const { seatStatus, isYourTurn } = params;

  if (seatStatus === null || seatStatus === SeatStatus.EMPTY) {
    return {
      modeLabel: "未着席",
      note: "着席するとハンド進行情報と操作ボタンが有効になります。",
      actionInputEnabled: false,
      seatCommandAvailability: {
        ...noSeatCommands,
        [RealtimeTableCommandType.JOIN]: true,
      },
    };
  }

  if (seatStatus === SeatStatus.SEATED_WAIT_NEXT_HAND) {
    return {
      modeLabel: "次ハンド待機中",
      note: `観戦UIのみ表示します。${joinCommandLabels([
        RealtimeTableCommandType.SIT_OUT,
        RealtimeTableCommandType.LEAVE,
      ])} のみ操作できます。`,
      actionInputEnabled: false,
      seatCommandAvailability: {
        ...noSeatCommands,
        [RealtimeTableCommandType.SIT_OUT]: true,
        [RealtimeTableCommandType.LEAVE]: true,
      },
    };
  }

  if (seatStatus === SeatStatus.ACTIVE) {
    return {
      modeLabel: isYourTurn ? "手番中" : "参加中（手番待ち）",
      note: isYourTurn
        ? `${RealtimeTableCommandType.ACT} 入力を有効化しています。`
        : "手番までアクション入力は無効です。",
      actionInputEnabled: isYourTurn,
      seatCommandAvailability: {
        ...noSeatCommands,
        [RealtimeTableCommandType.SIT_OUT]: true,
        [RealtimeTableCommandType.LEAVE]: true,
      },
    };
  }

  if (seatStatus === SeatStatus.SIT_OUT) {
    return {
      modeLabel: formatSeatCommandLabel(RealtimeTableCommandType.SIT_OUT),
      note: `次ハンド不参加です。${joinCommandLabels([
        RealtimeTableCommandType.RETURN,
        RealtimeTableCommandType.LEAVE,
      ])} を選択できます。`,
      actionInputEnabled: false,
      seatCommandAvailability: {
        ...noSeatCommands,
        [RealtimeTableCommandType.RETURN]: true,
        [RealtimeTableCommandType.LEAVE]: true,
      },
    };
  }

  if (seatStatus === SeatStatus.LEAVE_PENDING) {
    return {
      modeLabel: "退席予約中",
      note: "現在ハンド終了後に退席します。再着席操作は受け付けません。",
      actionInputEnabled: false,
      seatCommandAvailability: noSeatCommands,
    };
  }

  return {
    modeLabel: "再接続中",
    note: "復帰後に restoredSeatStatus を反映してUIを再構成します。",
    actionInputEnabled: false,
    seatCommandAvailability: noSeatCommands,
  };
};

export const TABLE_ACT_ACTION_OPTIONS = MVP_TABLE_ACT_ACTIONS;
export type TableActActionOption = (typeof TABLE_ACT_ACTION_OPTIONS)[number];

export const isTableActActionOption = (
  action: TableCommandActionType,
): action is TableActActionOption =>
  TABLE_ACT_ACTION_OPTIONS.includes(action as TableActActionOption);

export const resolveTableActActionOptions = (params: {
  street: StreetType | null;
  streetBetTo: number | null;
  smallBet: number | null;
  raiseCount: number | null;
}): TableActActionOption[] => {
  const { street, streetBetTo, smallBet, raiseCount } = params;
  if (
    street === null ||
    streetBetTo === null ||
    smallBet === null ||
    raiseCount === null
  ) {
    return [];
  }

  const canRaise = raiseCount < 4;
  if (street === Street.THIRD) {
    if (streetBetTo === 0) {
      return [TableCommandAction.BRING_IN, TableCommandAction.COMPLETE];
    }

    if (streetBetTo < smallBet) {
      return [
        TableCommandAction.CALL,
        TableCommandAction.FOLD,
        TableCommandAction.COMPLETE,
      ];
    }
    return canRaise
      ? [
          TableCommandAction.CALL,
          TableCommandAction.FOLD,
          TableCommandAction.RAISE,
        ]
      : [TableCommandAction.CALL, TableCommandAction.FOLD];
  }

  if (streetBetTo === 0) {
    return [TableCommandAction.CHECK, TableCommandAction.BET];
  }

  return canRaise
    ? [
        TableCommandAction.CALL,
        TableCommandAction.FOLD,
        TableCommandAction.RAISE,
      ]
    : [TableCommandAction.CALL, TableCommandAction.FOLD];
};

export const actionRequiresAmount = (action: TableCommandActionType) =>
  action === TableCommandAction.BET ||
  action === TableCommandAction.RAISE ||
  action === TableCommandAction.COMPLETE ||
  action === TableCommandAction.BRING_IN;

export const formatSeatStatusLabel = (status: SeatStatusType) => {
  if (status === SeatStatus.EMPTY) {
    return "空席";
  }
  if (status === SeatStatus.SEATED_WAIT_NEXT_HAND) {
    return "次ハンド待機";
  }
  if (status === SeatStatus.ACTIVE) {
    return "参加中";
  }
  if (status === SeatStatus.SIT_OUT) {
    return "離席中";
  }
  if (status === SeatStatus.LEAVE_PENDING) {
    return "退席予約中";
  }
  return "切断中";
};
