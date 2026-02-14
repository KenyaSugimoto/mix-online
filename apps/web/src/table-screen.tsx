import {
  CardRank,
  CardSlot,
  CardSuit,
  CardVisibility,
  RealtimeTableCommandType,
  SeatStatus,
  Street,
  TableBuyIn,
} from "@mix-online/shared";
import { useEffect, useMemo, useRef, useState } from "react";
import { formatChipsToUsd } from "./auth-api";
import { TableApiError, type TableDetail, getTableDetail } from "./table-api";
import {
  type TableActActionOption,
  resolveTableActActionOptions,
  resolveTableControlState,
} from "./table-control";
import {
  type TableStore,
  type TableStoreSnapshot,
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

const CARD_SLOT_ORDER = [
  CardSlot.HOLE_1,
  CardSlot.HOLE_2,
  CardSlot.UP_3,
  CardSlot.UP_4,
  CardSlot.UP_5,
  CardSlot.UP_6,
  CardSlot.DOWN_7,
] as const;

const SEAT_POSITION_BY_OFFSET = [
  "self",
  "right-near",
  "right-far",
  "top",
  "left-far",
  "left-near",
] as const;

const CARD_SLOT_ORDER_INDEX = CARD_SLOT_ORDER.reduce(
  (acc, slot, index) => {
    acc[slot] = index;
    return acc;
  },
  {
    [CardSlot.HOLE_1]: 0,
    [CardSlot.HOLE_2]: 0,
    [CardSlot.UP_3]: 0,
    [CardSlot.UP_4]: 0,
    [CardSlot.UP_5]: 0,
    [CardSlot.UP_6]: 0,
    [CardSlot.DOWN_7]: 0,
  } as Record<CardSlot, number>,
);

const DEFAULT_JOIN_BUY_IN = Math.min(
  TableBuyIn.MAX,
  Math.max(TableBuyIn.MIN, 1000),
);

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

const resolveTimerFillPercent = (
  remainingSeconds: number | null,
  totalSeconds: number | null,
) => {
  if (remainingSeconds === null || totalSeconds === null || totalSeconds <= 0) {
    return 0;
  }

  return Math.max(
    0,
    Math.min(100, Math.round((remainingSeconds / totalSeconds) * 100)),
  );
};

const formatStreetLabel = (street: string | null) => {
  if (street === null) {
    return "-";
  }
  if (street === Street.THIRD) {
    return "3rd";
  }
  if (street === Street.FOURTH) {
    return "4th";
  }
  if (street === Street.FIFTH) {
    return "5th";
  }
  if (street === Street.SIXTH) {
    return "6th";
  }
  if (street === Street.SEVENTH) {
    return "7th";
  }
  return street;
};

const formatCardRank = (rank: string) => {
  if (rank === CardRank.T) {
    return "10";
  }
  return rank;
};

const formatSuitSymbol = (suit: CardSuit) => {
  if (suit === CardSuit.S) {
    return "♠";
  }
  if (suit === CardSuit.H) {
    return "♥";
  }
  if (suit === CardSuit.D) {
    return "♦";
  }
  return "♣";
};

const resolveSeatCards = (
  cardsBySeatNo: TableStoreSnapshot["cardsBySeatNo"],
  seatNo: number,
) => {
  const seatCards = cardsBySeatNo[seatNo] ?? [];
  return [...seatCards].sort(
    (left, right) =>
      CARD_SLOT_ORDER_INDEX[left.slot] - CARD_SLOT_ORDER_INDEX[right.slot],
  );
};

const resolveSeatPositionClass = (
  seatNo: number,
  anchorSeatNo: number,
  maxSeats: number,
) => {
  const offset = (seatNo - anchorSeatNo + maxSeats) % maxSeats;
  return SEAT_POSITION_BY_OFFSET[offset] ?? "top";
};

const formatEventLogLabel = (
  entry: TableStoreSnapshot["eventLogs"][number],
) => {
  if (entry.kind === "seat_state_changed") {
    return `Seat ${entry.seatNo}: ${entry.previousStatus} -> ${entry.currentStatus} (reason=${entry.reason}, appliesFrom=${entry.appliesFrom})`;
  }

  return `Street: ${formatStreetLabel(entry.fromStreet)} -> ${formatStreetLabel(entry.toStreet)} (reason=${entry.reason})`;
};

export const TableScreen = (props: {
  tableId: string;
  currentUserId: string;
  onGoLobby: () => void;
}) => {
  const { tableId, currentUserId, onGoLobby } = props;
  const tableStoreRef = useRef<TableStore | null>(null);
  const tableStoreUnsubscribeRef = useRef<(() => void) | null>(null);
  const [requestVersion, setRequestVersion] = useState(0);
  const [state, setState] = useState<TableScreenState>({
    status: LobbyStateStatus.LOADING,
    requestVersion: 0,
  });
  const [commandPreview, setCommandPreview] = useState<string | null>(null);
  const [timerNow, setTimerNow] = useState(() => Date.now());
  const [turnDurationSeconds, setTurnDurationSeconds] = useState<number | null>(
    null,
  );
  const [realtimeState, setRealtimeState] = useState<{
    lastErrorMessage: string | null;
    cardsBySeatNo: TableStoreSnapshot["cardsBySeatNo"];
    eventLogs: TableStoreSnapshot["eventLogs"];
  }>({
    lastErrorMessage: null,
    cardsBySeatNo: {},
    eventLogs: [],
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
        lastErrorMessage: null,
        cardsBySeatNo: {},
        eventLogs: [],
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
        lastErrorMessage: snapshot.lastErrorMessage,
        cardsBySeatNo: snapshot.cardsBySeatNo,
        eventLogs: snapshot.eventLogs,
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
  const toActSeatNo = table?.currentHand?.toActSeatNo ?? null;
  const toActSeat =
    table?.seats.find((seat) => seat.seatNo === toActSeatNo) ?? null;

  useEffect(() => {
    if (toActSeatNo === null || actionDeadlineAt === null) {
      setTurnDurationSeconds(null);
      return;
    }

    const nextTurnDuration = resolveRemainingSeconds(
      actionDeadlineAt,
      Date.now(),
    );
    setTurnDurationSeconds(nextTurnDuration);
  }, [toActSeatNo, actionDeadlineAt]);

  const isYourTurn =
    !!table &&
    !!mySeat &&
    mySeat.status === SeatStatus.ACTIVE &&
    toActSeatNo === mySeat.seatNo;

  const controlState = resolveTableControlState({
    seatStatus: mySeat?.status ?? null,
    isYourTurn,
  });

  const remainingSeconds = useMemo(
    () => resolveRemainingSeconds(actionDeadlineAt, timerNow),
    [actionDeadlineAt, timerNow],
  );

  const remainingPercent = useMemo(
    () => resolveTimerFillPercent(remainingSeconds, turnDurationSeconds),
    [remainingSeconds, turnDurationSeconds],
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

  const recentEventLogs = useMemo(
    () => [...realtimeState.eventLogs].reverse().slice(0, 14),
    [realtimeState.eventLogs],
  );

  const handleJoinFromEmptySeat = () => {
    const store = tableStoreRef.current;
    if (!store) {
      setCommandPreview("WebSocket初期化前のためコマンド送信できません。");
      return;
    }

    const sent = store.sendSeatCommand(RealtimeTableCommandType.JOIN, {
      buyIn: DEFAULT_JOIN_BUY_IN,
    });

    setCommandPreview(
      sent
        ? `送信: ${RealtimeTableCommandType.JOIN} (buyIn=${DEFAULT_JOIN_BUY_IN})`
        : `送信失敗: ${
            store.getSnapshot().lastErrorMessage ??
            "JOIN コマンドを送信できませんでした。"
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
    const seats = [...state.table.seats].sort(
      (left, right) => left.seatNo - right.seatNo,
    );
    const anchorSeatNo = mySeat?.seatNo ?? 1;
    const canJoinSeat = mySeat === null;

    return (
      <section className="surface table-panel poker-table-shell">
        <header className="table-panel-header table-header-bar">
          <div>
            <p className="eyebrow table-eyebrow">Mix Stud Online</p>
            <h2 className="table-title">{state.table.tableName}</h2>
            <p className="table-summary-line">
              {state.table.gameType} / {state.table.stakes.display}
            </p>
            <p className="table-summary-line">
              プレイヤー{" "}
              {state.table.seats.filter((seat) => seat.userId !== null).length}/{" "}
              {state.table.maxPlayers}
              {" / "}あなたのスタック:{" "}
              {mySeat ? formatChipsToUsd(mySeat.stack) : "未着席"}
            </p>
            {realtimeState.lastErrorMessage ? (
              <output className="command-preview">
                Realtimeエラー: {realtimeState.lastErrorMessage}
              </output>
            ) : null}
          </div>
          <div className="row-actions table-nav-actions">
            <button className="ghost-button" type="button" onClick={onGoLobby}>
              ロビーへ戻る
            </button>
          </div>
        </header>

        <div className="table-play-layout">
          <section
            className="surface inline-panel poker-stage-panel"
            aria-label="ゲームテーブル"
          >
            <div className="poker-stage-grid">
              <article className="table-center-core">
                <p className="table-center-label">Main Pot</p>
                <p className="table-center-pot">
                  {state.table.currentHand
                    ? formatChipsToUsd(state.table.currentHand.potTotal)
                    : "-"}
                </p>
                <p className="table-center-street">
                  Street:{" "}
                  {formatStreetLabel(state.table.currentHand?.street ?? null)}
                </p>
                <p className="table-center-to-act">
                  現在手番:{" "}
                  {toActSeat
                    ? `${toActSeat.displayName ?? "Unknown"} (Seat ${toActSeat.seatNo})`
                    : "-"}
                </p>
                <div className="turn-timer-track" aria-label="持ち時間バー">
                  <div
                    className={`turn-timer-fill ${remainingPercent <= 25 ? "is-warning" : ""}`}
                    style={{ width: `${remainingPercent}%` }}
                  />
                </div>
                <p className="turn-timer-text">
                  持ち時間:{" "}
                  {remainingSeconds === null ? "-" : `${remainingSeconds} 秒`}
                </p>
              </article>

              {seats.map((seat) => {
                const isEmptySeat = seat.status === SeatStatus.EMPTY;
                const isToAct = toActSeatNo === seat.seatNo;
                const seatCards = resolveSeatCards(
                  realtimeState.cardsBySeatNo,
                  seat.seatNo,
                );
                const seatPositionClass = resolveSeatPositionClass(
                  seat.seatNo,
                  anchorSeatNo,
                  state.table.maxPlayers,
                );

                return (
                  <article
                    key={seat.seatNo}
                    className={`seat-pod seat-pos-${seatPositionClass} ${
                      seat.isYou ? "is-you" : ""
                    } ${isToAct ? "is-to-act" : ""} ${
                      isEmptySeat ? "is-empty" : ""
                    }`}
                    data-seat-no={seat.seatNo}
                  >
                    <header className="seat-pod-header">
                      <span className="seat-badge">Seat {seat.seatNo}</span>
                      {state.table.dealerSeatNo === seat.seatNo ? (
                        <span
                          className="dealer-marker"
                          aria-label="ディーラーボタン"
                        >
                          D
                        </span>
                      ) : null}
                    </header>

                    {isEmptySeat ? (
                      <div className="empty-seat-actions">
                        {canJoinSeat ? (
                          <button
                            className="ghost-button empty-seat-join"
                            type="button"
                            onClick={handleJoinFromEmptySeat}
                          >
                            着席
                          </button>
                        ) : null}
                      </div>
                    ) : (
                      <>
                        <p className="seat-player-name">
                          {seat.displayName ?? "Unknown"}
                          {seat.isYou ? " (You)" : ""}
                        </p>
                        <p className="seat-stack">
                          {formatChipsToUsd(seat.stack)}
                        </p>
                        <div
                          className="seat-time-wrapper"
                          aria-label="席の持ち時間"
                        >
                          <div className="seat-time-track">
                            <div
                              className={`seat-time-fill ${
                                isToAct && remainingPercent <= 25
                                  ? "is-warning"
                                  : ""
                              }`}
                              style={{
                                width: `${isToAct ? remainingPercent : 0}%`,
                              }}
                            />
                          </div>
                          <p className="seat-time-text">
                            {isToAct && remainingSeconds !== null
                              ? `${remainingSeconds} 秒`
                              : "-"}
                          </p>
                        </div>
                        <div
                          className="seat-cards"
                          aria-label={`Seat ${seat.seatNo} cards`}
                        >
                          {seatCards.length > 0
                            ? seatCards.map((card, index) => {
                                const isHidden =
                                  card.visibility ===
                                    CardVisibility.DOWN_HIDDEN ||
                                  card.card === null;
                                const suitClass = card.card
                                  ? `is-suit-${card.card.suit.toLowerCase()}`
                                  : "";

                                return (
                                  <div
                                    key={`${card.slot}-${index}`}
                                    className={`playing-card ${
                                      isHidden ? "is-hidden" : ""
                                    } ${suitClass}`}
                                    aria-label={
                                      isHidden
                                        ? "裏向きカード"
                                        : `${formatCardRank(card.card?.rank ?? "")}${formatSuitSymbol(card.card?.suit ?? CardSuit.S)}`
                                    }
                                  >
                                    {isHidden ? (
                                      <span className="playing-card-back">
                                        ◆
                                      </span>
                                    ) : (
                                      <>
                                        <span className="playing-card-rank">
                                          {formatCardRank(
                                            card.card?.rank ?? "",
                                          )}
                                        </span>
                                        <span className="playing-card-suit">
                                          {formatSuitSymbol(
                                            card.card?.suit ?? CardSuit.S,
                                          )}
                                        </span>
                                      </>
                                    )}
                                  </div>
                                );
                              })
                            : null}
                        </div>
                      </>
                    )}
                  </article>
                );
              })}
            </div>
          </section>

          <aside className="table-side-rail">
            <div className="surface inline-panel table-side-card action-dock-panel">
              <h3>アクション</h3>
              <p>
                {controlState.actionInputEnabled
                  ? "手番中です。許可アクションのみ選択できます。"
                  : "手番外のためアクションは無効です。"}
              </p>
              {controlState.actionInputEnabled &&
              tableActActionOptions.length > 0 ? (
                <div className="action-dock-buttons">
                  {tableActActionOptions.map((action) => (
                    <button
                      key={action}
                      className="primary-button action-dock-button"
                      type="button"
                      onClick={() => handleActionCommand(action)}
                    >
                      {action}
                    </button>
                  ))}
                </div>
              ) : (
                <p className="status-chip">
                  操作可能なアクションはありません。
                </p>
              )}
              {commandPreview ? (
                <p className="command-preview">{commandPreview}</p>
              ) : null}
            </div>

            <div className="surface inline-panel table-side-card event-log-panel">
              <h3>進行ログ</h3>
              {recentEventLogs.length === 0 ? (
                <p className="status-chip">ログ待機中です。</p>
              ) : (
                <ol className="event-log-list" aria-label="イベントログ">
                  {recentEventLogs.map((entry, index) => (
                    <li
                      key={`${entry.kind}-${entry.occurredAt}-${index}`}
                      className="event-log-item"
                    >
                      <p className="event-log-main">
                        {formatEventLogLabel(entry)}
                      </p>
                      <time
                        className="event-log-time"
                        dateTime={entry.occurredAt}
                      >
                        {new Date(entry.occurredAt).toLocaleTimeString(
                          LocaleCode.JA_JP,
                        )}
                      </time>
                    </li>
                  ))}
                </ol>
              )}
            </div>
          </aside>
        </div>
      </section>
    );
  }

  return null;
};
