import {
  RealtimeTableCommandType,
  SeatStatus,
  TABLE_COMMAND_ACTIONS,
  TableCommandAction,
  type TableCommandAction as TableCommandActionType,
  TableStatus,
} from "@mix-online/shared";
import { type FormEvent, useEffect, useMemo, useState } from "react";
import { formatChipsToUsd } from "./auth-api";
import { TableApiError, type TableDetail, getTableDetail } from "./table-api";
import {
  actionRequiresAmount,
  formatSeatStatusLabel,
  resolveTableControlState,
} from "./table-control";
import { LocaleCode } from "./web-constants";

type TableScreenState =
  | { status: "loading"; requestVersion: number }
  | { status: "loaded"; table: TableDetail }
  | { status: "error"; message: string };

const resolveRemainingSeconds = (deadlineAt: string | null, now: number) => {
  if (!deadlineAt) {
    return null;
  }

  const deadline = new Date(deadlineAt).getTime();
  if (Number.isNaN(deadline)) {
    return null;
  }

  return Math.max(0, Math.ceil((deadline - now) / 1000));
};

const toSeatCommandType = (command: "join" | "sitOut" | "return" | "leave") => {
  if (command === "join") {
    return RealtimeTableCommandType.JOIN;
  }
  if (command === "sitOut") {
    return RealtimeTableCommandType.SIT_OUT;
  }
  if (command === "return") {
    return RealtimeTableCommandType.RETURN;
  }
  return RealtimeTableCommandType.LEAVE;
};

const formatTableStatusLabel = (status: TableStatus) => {
  if (status === TableStatus.WAITING) {
    return "待機中";
  }
  if (status === TableStatus.DEALING) {
    return "配札中";
  }
  if (status === TableStatus.BETTING) {
    return "ベッティング中";
  }
  if (status === TableStatus.SHOWDOWN) {
    return "ショーダウン";
  }
  return "ハンド終了";
};

export const TableScreen = (props: {
  tableId: string;
  onGoLobby: () => void;
  onLogout: () => void;
}) => {
  const { tableId, onGoLobby, onLogout } = props;
  const [requestVersion, setRequestVersion] = useState(0);
  const [state, setState] = useState<TableScreenState>({
    status: "loading",
    requestVersion: 0,
  });
  const [selectedAction, setSelectedAction] = useState<TableCommandActionType>(
    TableCommandAction.CHECK,
  );
  const [amountText, setAmountText] = useState("0");
  const [commandPreview, setCommandPreview] = useState<string | null>(null);
  const [timerNow, setTimerNow] = useState(() => Date.now());

  useEffect(() => {
    let isCancelled = false;
    setState({ status: "loading", requestVersion });

    getTableDetail(tableId)
      .then((response) => {
        if (isCancelled) {
          return;
        }

        setState({
          status: "loaded",
          table: response.table,
        });
      })
      .catch((error: unknown) => {
        if (isCancelled) {
          return;
        }

        const message =
          error instanceof TableApiError
            ? error.message
            : "卓詳細の取得に失敗しました。";
        setState({ status: "error", message });
      });

    return () => {
      isCancelled = true;
    };
  }, [requestVersion, tableId]);

  const actionDeadlineAt =
    state.status === "loaded"
      ? (state.table.currentHand?.actionDeadlineAt ?? null)
      : null;
  useEffect(() => {
    if (actionDeadlineAt === null) {
      return;
    }

    setTimerNow(Date.now());
    const timerId = window.setInterval(() => {
      setTimerNow(Date.now());
    }, 1_000);

    return () => {
      window.clearInterval(timerId);
    };
  }, [actionDeadlineAt]);

  const table = state.status === "loaded" ? state.table : null;
  const mySeat = table?.seats.find((seat) => seat.isYou) ?? null;
  const isYourTurn =
    !!table &&
    !!mySeat &&
    mySeat.status === SeatStatus.ACTIVE &&
    table.currentHand?.toActSeatNo === mySeat.seatNo;

  const controlState = resolveTableControlState({
    seatStatus: mySeat?.status ?? null,
    isYourTurn,
  });
  const remainingSeconds = useMemo(
    () => resolveRemainingSeconds(actionDeadlineAt, timerNow),
    [actionDeadlineAt, timerNow],
  );

  const handleSeatCommand = (
    command: "join" | "sitOut" | "return" | "leave",
  ) => {
    const commandType = toSeatCommandType(command);
    setCommandPreview(
      `送信プレビュー: ${commandType}（M4-04 で WebSocket 送信を接続予定）`,
    );
  };

  const onActionSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!controlState.actionInputEnabled) {
      return;
    }

    const requiresAmount = actionRequiresAmount(selectedAction);
    const amount = Number.parseInt(amountText, 10);
    if (requiresAmount && (!Number.isInteger(amount) || amount <= 0)) {
      setCommandPreview(
        "送信プレビュー: amount は 1 以上の整数で入力してください。",
      );
      return;
    }

    const payload = requiresAmount
      ? `{ action: ${selectedAction}, amount: ${amount} }`
      : `{ action: ${selectedAction} }`;
    setCommandPreview(
      `送信プレビュー: ${RealtimeTableCommandType.ACT} ${payload}（M4-04 で WebSocket 送信を接続予定）`,
    );
  };

  if (state.status === "loading") {
    return (
      <section className="surface state-panel" aria-live="polite">
        <h2>卓詳細を読み込み中です</h2>
        <p>
          <code>GET /api/tables/:tableId</code>{" "}
          で席状態とハンド概要を取得しています。
        </p>
        <p className="status-chip">
          リクエスト {state.requestVersion + 1} / tableId: {tableId}
        </p>
      </section>
    );
  }

  if (state.status === "error") {
    return (
      <section className="surface state-panel">
        <h2>卓詳細の取得に失敗しました</h2>
        <p>{state.message}</p>
        <div className="row-actions">
          <button
            className="primary-button"
            type="button"
            onClick={() => setRequestVersion((version) => version + 1)}
          >
            再取得
          </button>
          <button className="ghost-button" type="button" onClick={onGoLobby}>
            ロビーへ戻る
          </button>
        </div>
      </section>
    );
  }

  if (state.status === "loaded") {
    return (
      <section className="surface table-panel">
        <header className="table-panel-header">
          <div>
            <h2>{state.table.tableName}</h2>
            <p className="table-summary-line">
              卓ID: <code>{state.table.tableId}</code>
            </p>
            <p className="table-summary-line">
              ステータス:{" "}
              <span className="status-chip">
                {formatTableStatusLabel(state.table.status)}
              </span>
            </p>
            <p className="table-summary-line">
              ゲーム: <strong>{state.table.gameType}</strong> / ステークス:{" "}
              <strong>{state.table.stakes.display}</strong>
            </p>
          </div>
          <div className="row-actions">
            <button
              className="ghost-button"
              type="button"
              onClick={() => setRequestVersion((version) => version + 1)}
            >
              更新
            </button>
            <button className="ghost-button" type="button" onClick={onGoLobby}>
              ロビーへ戻る
            </button>
            <button className="ghost-button" type="button" onClick={onLogout}>
              ログアウト
            </button>
          </div>
        </header>

        {state.table.currentHand ? (
          <div className="surface inline-panel hand-panel">
            <h3>進行中ハンド</h3>
            <p>
              handNo: <strong>{state.table.currentHand.handNo}</strong> /
              street: <strong>{state.table.currentHand.street}</strong>
            </p>
            <p>
              pot:{" "}
              <strong>
                {formatChipsToUsd(state.table.currentHand.potTotal)}
              </strong>
              {" / "}
              toActSeatNo:{" "}
              <strong>
                {state.table.currentHand.toActSeatNo === null
                  ? "-"
                  : state.table.currentHand.toActSeatNo}
              </strong>
            </p>
            <p
              className={`timer-chip ${isYourTurn ? "is-active" : ""} ${
                remainingSeconds !== null && remainingSeconds <= 10
                  ? "is-warning"
                  : ""
              }`}
            >
              手番タイマー:{" "}
              {remainingSeconds === null ? "-" : `${remainingSeconds} 秒`}
            </p>
          </div>
        ) : (
          <p className="status-chip">現在ハンドは進行していません。</p>
        )}

        <div
          className={`surface inline-panel self-seat-panel ${
            mySeat?.status === SeatStatus.DISCONNECTED ? "is-disconnected" : ""
          }`}
        >
          <h3>自席ステータス</h3>
          {mySeat ? (
            <p>
              seatNo: <strong>{mySeat.seatNo}</strong> / status:{" "}
              <strong>{formatSeatStatusLabel(mySeat.status)}</strong> / stack:{" "}
              <strong>{formatChipsToUsd(mySeat.stack)}</strong>
            </p>
          ) : (
            <p>この卓にはまだ着席していません。</p>
          )}
          <p className="status-chip">{controlState.modeLabel}</p>
          <p>{controlState.note}</p>
          {mySeat?.status === SeatStatus.DISCONNECTED ? (
            <output className="disconnect-overlay">
              再接続中: 復帰後に restoredSeatStatus で表示を再構成します。
            </output>
          ) : null}
        </div>

        <div className="surface inline-panel action-panel">
          <h3>アクション入力</h3>
          <p>
            {controlState.actionInputEnabled
              ? "手番中のため table.act 入力を有効化しています。"
              : "手番外または非ACTIVE状態のため table.act 入力は無効です。"}
          </p>
          <form className="action-form" onSubmit={onActionSubmit}>
            <label className="field-label" htmlFor="table-action-type">
              action
            </label>
            <select
              id="table-action-type"
              value={selectedAction}
              disabled={!controlState.actionInputEnabled}
              onChange={(event) =>
                setSelectedAction(event.target.value as TableCommandActionType)
              }
            >
              {TABLE_COMMAND_ACTIONS.map((action) => (
                <option key={action} value={action}>
                  {action}
                </option>
              ))}
            </select>

            <label className="field-label" htmlFor="table-action-amount">
              amount
            </label>
            <input
              id="table-action-amount"
              inputMode="numeric"
              min={0}
              step={1}
              value={amountText}
              disabled={
                !controlState.actionInputEnabled ||
                !actionRequiresAmount(selectedAction)
              }
              onChange={(event) => setAmountText(event.target.value)}
            />

            <button
              className="primary-button"
              type="submit"
              disabled={!controlState.actionInputEnabled}
            >
              送信プレビュー
            </button>
          </form>
        </div>

        <div className="surface inline-panel action-panel">
          <h3>席操作</h3>
          <div className="row-actions">
            <button
              className="ghost-button"
              type="button"
              disabled={!controlState.seatCommandAvailability.join}
              onClick={() => handleSeatCommand("join")}
            >
              JOIN
            </button>
            <button
              className="ghost-button"
              type="button"
              disabled={!controlState.seatCommandAvailability.sitOut}
              onClick={() => handleSeatCommand("sitOut")}
            >
              SIT OUT
            </button>
            <button
              className="ghost-button"
              type="button"
              disabled={!controlState.seatCommandAvailability.returnToTable}
              onClick={() => handleSeatCommand("return")}
            >
              RETURN
            </button>
            <button
              className="ghost-button"
              type="button"
              disabled={!controlState.seatCommandAvailability.leave}
              onClick={() => handleSeatCommand("leave")}
            >
              LEAVE
            </button>
          </div>
          {commandPreview ? (
            <p className="command-preview">{commandPreview}</p>
          ) : null}
        </div>

        <h3>席一覧</h3>
        <ul className="seat-grid" aria-label="席一覧">
          {state.table.seats.map((seat) => (
            <li
              key={seat.seatNo}
              className={`seat-card ${
                seat.isYou ? "is-you" : ""
              } ${state.table.currentHand?.toActSeatNo === seat.seatNo ? "is-to-act" : ""}`}
            >
              <header className="seat-card-header">
                <strong>Seat {seat.seatNo}</strong>
                <span className="status-chip">
                  {formatSeatStatusLabel(seat.status)}
                </span>
              </header>
              {seat.userId ? (
                <>
                  <p>
                    {seat.displayName ?? "Unknown"} {seat.isYou ? "(You)" : ""}
                  </p>
                  <p>stack: {formatChipsToUsd(seat.stack)}</p>
                  <p>
                    joinedAt:{" "}
                    {seat.joinedAt
                      ? new Date(seat.joinedAt).toLocaleString(LocaleCode.JA_JP)
                      : "-"}
                  </p>
                  <p>disconnectStreak: {seat.disconnectStreak ?? "-"}</p>
                </>
              ) : (
                <p>空席</p>
              )}
            </li>
          ))}
        </ul>
      </section>
    );
  }

  return null;
};
