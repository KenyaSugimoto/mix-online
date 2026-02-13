import {
  SeatStatus,
  type SeatStatus as SeatStatusType,
  TableCommandAction,
  type TableCommandAction as TableCommandActionType,
} from "@mix-online/shared";

type SeatCommandAvailability = {
  join: boolean;
  sitOut: boolean;
  returnToTable: boolean;
  leave: boolean;
};

export type TableControlState = {
  modeLabel: string;
  note: string;
  actionInputEnabled: boolean;
  seatCommandAvailability: SeatCommandAvailability;
};

const noSeatCommands: SeatCommandAvailability = {
  join: false,
  sitOut: false,
  returnToTable: false,
  leave: false,
};

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
        join: true,
      },
    };
  }

  if (seatStatus === SeatStatus.SEATED_WAIT_NEXT_HAND) {
    return {
      modeLabel: "次ハンド待機中",
      note: "観戦UIのみ表示します。SIT OUT / LEAVE のみ操作できます。",
      actionInputEnabled: false,
      seatCommandAvailability: {
        ...noSeatCommands,
        sitOut: true,
        leave: true,
      },
    };
  }

  if (seatStatus === SeatStatus.ACTIVE) {
    return {
      modeLabel: isYourTurn ? "手番中" : "参加中（手番待ち）",
      note: isYourTurn
        ? "table.act 入力を有効化しています。"
        : "手番までアクション入力は無効です。",
      actionInputEnabled: isYourTurn,
      seatCommandAvailability: {
        ...noSeatCommands,
        sitOut: true,
        leave: true,
      },
    };
  }

  if (seatStatus === SeatStatus.SIT_OUT) {
    return {
      modeLabel: "SIT OUT",
      note: "次ハンド不参加です。RETURN / LEAVE を選択できます。",
      actionInputEnabled: false,
      seatCommandAvailability: {
        ...noSeatCommands,
        returnToTable: true,
        leave: true,
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
