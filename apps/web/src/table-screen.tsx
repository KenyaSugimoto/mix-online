import {
  RealtimeTableCommandType,
  SeatStatus,
  TableBuyIn,
  TableStatus,
} from "@mix-online/shared";
import { useEffect, useMemo, useRef, useState } from "react";
import { formatChipsToUsd } from "./auth-api";
import { TableApiError, type TableDetail, getTableDetail } from "./table-api";
import {
  SEAT_COMMAND_TYPES,
  type SeatCommandType,
  type TableActActionOption,
  formatSeatCommandLabel,
  formatSeatStatusLabel,
  resolveTableActActionOptions,
  resolveTableControlState,
} from "./table-control";
import {
  type TableStore,
  TableStoreConnectionStatus,
  type TableStoreSnapshot,
  TableStoreSyncStatus,
  createTableStore,
} from "./table-store";
import { LobbyStateStatus, LocaleCode } from "./web-constants";

type TableScreenState =
  | {
      status: typeof LobbyStateStatus.LOADING;
      requestVersion: number;
    }
  | { status: typeof LobbyStateStatus.LOADED; table: TableDetail }
  | { status: typeof LobbyStateStatus.ERROR; message: string };

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

const formatConnectionStatusLabel = (
  status: (typeof TableStoreConnectionStatus)[keyof typeof TableStoreConnectionStatus],
) => {
  if (status === TableStoreConnectionStatus.CONNECTING) {
    return "接続中";
  }
  if (status === TableStoreConnectionStatus.OPEN) {
    return "接続済み";
  }
  if (status === TableStoreConnectionStatus.RECONNECTING) {
    return "再接続中";
  }
  if (status === TableStoreConnectionStatus.CLOSED) {
    return "切断";
  }
  return "未開始";
};

const formatSyncStatusLabel = (
  status: (typeof TableStoreSyncStatus)[keyof typeof TableStoreSyncStatus],
) => {
  if (status === TableStoreSyncStatus.RESYNCING) {
    return "再同期中";
  }
  if (status === TableStoreSyncStatus.IN_SYNC) {
    return "同期済み";
  }
  return "未同期";
};

export const TableScreen = (props: {
  tableId: string;
  currentUserId: string;
  onGoLobby: () => void;
  onLogout: () => void;
}) => {
  const { tableId, currentUserId, onGoLobby, onLogout } = props;
  const tableStoreRef = useRef<TableStore | null>(null);
  const tableStoreUnsubscribeRef = useRef<(() => void) | null>(null);
  const [requestVersion, setRequestVersion] = useState(0);
  const [state, setState] = useState<TableScreenState>({
    status: LobbyStateStatus.LOADING,
    requestVersion: 0,
  });
  const [joinBuyInText, setJoinBuyInText] = useState("1000");
  const [commandPreview, setCommandPreview] = useState<string | null>(null);
  const [timerNow, setTimerNow] = useState(() => Date.now());
  const [realtimeState, setRealtimeState] = useState<{
    connectionStatus: TableStoreSnapshot["connectionStatus"];
    syncStatus: TableStoreSnapshot["syncStatus"];
    tableSeq: number;
    lastErrorMessage: string | null;
  }>({
    connectionStatus: TableStoreConnectionStatus.IDLE,
    syncStatus: TableStoreSyncStatus.IDLE,
    tableSeq: 0,
    lastErrorMessage: null,
  });

  useEffect(() => {
    void tableId;
    tableStoreUnsubscribeRef.current?.();
    tableStoreUnsubscribeRef.current = null;
    tableStoreRef.current?.stop();
    tableStoreRef.current = null;
  }, [tableId]);

  useEffect(() => {
    return () => {
      tableStoreUnsubscribeRef.current?.();
      tableStoreUnsubscribeRef.current = null;
      tableStoreRef.current?.stop();
      tableStoreRef.current = null;
    };
  }, []);

  useEffect(() => {
    let isCancelled = false;
    setState({ status: LobbyStateStatus.LOADING, requestVersion });
    if (tableStoreRef.current === null) {
      setRealtimeState({
        connectionStatus: TableStoreConnectionStatus.IDLE,
        syncStatus: TableStoreSyncStatus.IDLE,
        tableSeq: 0,
        lastErrorMessage: null,
      });
    }

    getTableDetail(tableId)
      .then((response) => {
        if (isCancelled) {
          return;
        }

        const existingStore = tableStoreRef.current;
        if (existingStore) {
          existingStore.replaceTable(response.table);
        }

        setState({
          status: LobbyStateStatus.LOADED,
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
        setState({ status: LobbyStateStatus.ERROR, message });
      });

    return () => {
      isCancelled = true;
    };
  }, [requestVersion, tableId]);

  useEffect(() => {
    if (state.status !== LobbyStateStatus.LOADED) {
      return;
    }
    if (tableStoreRef.current) {
      return;
    }

    const store = createTableStore({
      tableId,
      initialTable: state.table,
      currentUserId,
    });

    const applyRealtimeSnapshot = (snapshot: TableStoreSnapshot) => {
      setRealtimeState({
        connectionStatus: snapshot.connectionStatus,
        syncStatus: snapshot.syncStatus,
        tableSeq: snapshot.tableSeq,
        lastErrorMessage: snapshot.lastErrorMessage,
      });
      setState((previousState) => {
        if (previousState.status !== LobbyStateStatus.LOADED) {
          return previousState;
        }
        return {
          status: LobbyStateStatus.LOADED,
          table: snapshot.table,
        };
      });
    };

    tableStoreRef.current = store;
    tableStoreUnsubscribeRef.current = store.subscribe(applyRealtimeSnapshot);
    store.start();
  }, [currentUserId, state, tableId]);

  const actionDeadlineAt =
    state.status === LobbyStateStatus.LOADED
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

  const table = state.status === LobbyStateStatus.LOADED ? state.table : null;
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
  const tableActActionOptions = useMemo(
    () =>
      resolveTableActActionOptions({
        street: table?.currentHand?.street ?? null,
        streetBetTo: table?.currentHand?.streetBetTo ?? null,
        smallBet: table?.stakes.smallBet ?? null,
        raiseCount: table?.currentHand?.raiseCount ?? null,
      }),
    [
      table?.currentHand?.street,
      table?.currentHand?.streetBetTo,
      table?.currentHand?.raiseCount,
      table?.stakes.smallBet,
    ],
  );

  const handleSeatCommand = (commandType: SeatCommandType) => {
    const store = tableStoreRef.current;
    if (!store) {
      setCommandPreview("WebSocket初期化前のためコマンド送信できません。");
      return;
    }

    if (commandType === RealtimeTableCommandType.JOIN) {
      const buyIn = Number.parseInt(joinBuyInText, 10);
      if (
        !Number.isInteger(buyIn) ||
        buyIn < TableBuyIn.MIN ||
        buyIn > TableBuyIn.MAX
      ) {
        setCommandPreview(
          `buyIn は ${TableBuyIn.MIN}〜${TableBuyIn.MAX} の整数で入力してください。`,
        );
        return;
      }

      const sent = store.sendSeatCommand(commandType, { buyIn });
      setCommandPreview(
        sent
          ? `送信: ${commandType} (buyIn=${buyIn})`
          : `送信失敗: ${
              store.getSnapshot().lastErrorMessage ??
              "JOIN コマンドを送信できませんでした。"
            }`,
      );
      return;
    }

    const sent = store.sendSeatCommand(commandType);
    setCommandPreview(
      sent
        ? `送信: ${commandType}`
        : `送信失敗: ${
            store.getSnapshot().lastErrorMessage ??
            `${commandType} コマンドを送信できませんでした。`
          }`,
    );
  };

  const handleActionCommand = (action: TableActActionOption) => {
    if (!controlState.actionInputEnabled) {
      return;
    }
    if (!tableActActionOptions.includes(action)) {
      setCommandPreview(
        "送信プレビュー: 選択したアクションは現在の局面では送信できません。",
      );
      return;
    }

    const store = tableStoreRef.current;
    if (!store) {
      setCommandPreview("WebSocket初期化前のためコマンド送信できません。");
      return;
    }

    const sent = store.sendActionCommand(action);
    if (sent) {
      setCommandPreview(
        `送信: ${RealtimeTableCommandType.ACT} { action: ${action} }`,
      );
      return;
    }

    setCommandPreview(
      `送信失敗: ${
        store.getSnapshot().lastErrorMessage ??
        `${RealtimeTableCommandType.ACT} を送信できませんでした。`
      }`,
    );
  };

  if (state.status === LobbyStateStatus.LOADING) {
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

  if (state.status === LobbyStateStatus.ERROR) {
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

  if (state.status === LobbyStateStatus.LOADED) {
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
            <p className="table-summary-line">
              Realtime接続:{" "}
              <span className="status-chip">
                {formatConnectionStatusLabel(realtimeState.connectionStatus)}
              </span>{" "}
              / 同期:{" "}
              <span className="status-chip">
                {formatSyncStatusLabel(realtimeState.syncStatus)}
              </span>{" "}
              / tableSeq: <strong>{realtimeState.tableSeq}</strong>
            </p>
            {realtimeState.lastErrorMessage ? (
              <output className="command-preview">
                Realtimeエラー: {realtimeState.lastErrorMessage}
              </output>
            ) : null}
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
              ? `手番中のため ${RealtimeTableCommandType.ACT} 入力を有効化しています。`
              : `手番外または非ACTIVE状態のため ${RealtimeTableCommandType.ACT} 入力は無効です。`}
          </p>
          <p className="status-chip">
            送信候補:{" "}
            {tableActActionOptions.length > 0
              ? tableActActionOptions.join(" / ")
              : "(算出中)"}
          </p>
          {controlState.actionInputEnabled &&
          tableActActionOptions.length > 0 ? (
            <div className="row-actions">
              {tableActActionOptions.map((action) => (
                <button
                  key={action}
                  className="primary-button table-action"
                  type="button"
                  onClick={() => handleActionCommand(action)}
                >
                  {action}
                </button>
              ))}
            </div>
          ) : (
            <p className="status-chip">
              表示可能なアクションボタンはありません。
            </p>
          )}
        </div>

        <div className="surface inline-panel action-panel">
          <h3>席操作</h3>
          {controlState.seatCommandAvailability[
            RealtimeTableCommandType.JOIN
          ] ? (
            <div className="action-form">
              <label className="field-label" htmlFor="table-seat-buyin">
                buyIn ({TableBuyIn.MIN}〜{TableBuyIn.MAX})
              </label>
              <input
                id="table-seat-buyin"
                inputMode="numeric"
                min={TableBuyIn.MIN}
                max={TableBuyIn.MAX}
                step={1}
                value={joinBuyInText}
                onChange={(event) => setJoinBuyInText(event.target.value)}
              />
            </div>
          ) : null}
          <div className="row-actions">
            {SEAT_COMMAND_TYPES.map((commandType) => (
              <button
                key={commandType}
                className="ghost-button"
                type="button"
                disabled={!controlState.seatCommandAvailability[commandType]}
                onClick={() => handleSeatCommand(commandType)}
              >
                {formatSeatCommandLabel(commandType)}
              </button>
            ))}
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
