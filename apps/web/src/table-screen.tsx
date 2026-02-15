import {
  CardRank,
  CardSlot,
  CardSuit,
  CardVisibility,
  RealtimeTableCommandType,
  SeatStatus,
  ShowdownAction,
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

const RAISED_UP_CARD_SLOTS: ReadonlySet<CardSlot> = new Set<CardSlot>([
  CardSlot.UP_3,
  CardSlot.UP_4,
  CardSlot.UP_5,
  CardSlot.UP_6,
]);

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

const formatActionLabel = (action: string) => action.replaceAll("_", " ");

const formatSignedChips = (amount: number) => {
  if (amount === 0) {
    return formatChipsToUsd(0);
  }
  const sign = amount > 0 ? "+" : "-";
  return `${sign}${formatChipsToUsd(Math.abs(amount))}`;
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

  if (entry.kind === "street_advance") {
    return `Street: ${formatStreetLabel(entry.fromStreet)} -> ${formatStreetLabel(entry.toStreet)} (reason=${entry.reason})`;
  }

  return "";
};

type PlayerActionEntry = Extract<
  TableStoreSnapshot["eventLogs"][number],
  { kind: "player_action" }
>;

type ActionsByStreet = Map<string, PlayerActionEntry[]>;

const STREET_ORDER = [
  Street.THIRD,
  Street.FOURTH,
  Street.FIFTH,
  Street.SIXTH,
  Street.SEVENTH,
] as const;

const groupActionsByStreet = (
  eventLogs: TableStoreSnapshot["eventLogs"],
): ActionsByStreet => {
  // DealInitEvent でリセットされるため、すべてのプレイヤーアクションは現在のハンドに属する
  const playerActions = eventLogs.filter(
    (entry): entry is PlayerActionEntry => entry.kind === "player_action",
  );

  const grouped = new Map<string, PlayerActionEntry[]>();

  for (const action of playerActions) {
    const street = action.street;

    if (!grouped.has(street)) {
      grouped.set(street, []);
    }

    grouped.get(street)?.push(action);
  }

  return grouped;
};

export const TableScreen = (props: {
  tableId: string;
  currentUserId: string;
  onGoLobby: () => void;
}) => {
  const { tableId, currentUserId, onGoLobby } = props;
  const tableStoreRef = useRef<TableStore | null>(null);
  const tableStoreUnsubscribeRef = useRef<(() => void) | null>(null);
  const actionHistoryRef = useRef<HTMLDivElement>(null);
  const [requestVersion, setRequestVersion] = useState(0);
  const [state, setState] = useState<TableScreenState>({
    status: LobbyStateStatus.LOADING,
    requestVersion: 0,
  });
  const [joinBuyInText, setJoinBuyInText] = useState(`${DEFAULT_JOIN_BUY_IN}`);
  const [joinErrorMessage, setJoinErrorMessage] = useState<string | null>(null);
  const [timerNow, setTimerNow] = useState(() => Date.now());
  const [turnDurationSeconds, setTurnDurationSeconds] = useState<number | null>(
    null,
  );
  const [realtimeState, setRealtimeState] = useState<{
    lastErrorMessage: string | null;
    cardsBySeatNo: TableStoreSnapshot["cardsBySeatNo"];
    eventLogs: TableStoreSnapshot["eventLogs"];
    lastActionBySeatNo: TableStoreSnapshot["lastActionBySeatNo"];
    showdownBySeatNo: TableStoreSnapshot["showdownBySeatNo"];
    latestDealEndSummary: TableStoreSnapshot["latestDealEndSummary"];
  }>({
    lastErrorMessage: null,
    cardsBySeatNo: {},
    eventLogs: [],
    lastActionBySeatNo: {},
    showdownBySeatNo: {},
    latestDealEndSummary: null,
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
        lastActionBySeatNo: {},
        showdownBySeatNo: {},
        latestDealEndSummary: null,
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
        lastActionBySeatNo: snapshot.lastActionBySeatNo,
        showdownBySeatNo: snapshot.showdownBySeatNo,
        latestDealEndSummary: snapshot.latestDealEndSummary,
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

  const actionsByStreet = useMemo(
    () => groupActionsByStreet(realtimeState.eventLogs),
    [realtimeState.eventLogs],
  );

  // biome-ignore lint/correctness/useExhaustiveDependencies: intentionally track eventLogs for auto-scroll
  useEffect(() => {
    if (actionHistoryRef.current) {
      actionHistoryRef.current.scrollTop =
        actionHistoryRef.current.scrollHeight;
    }
  }, [realtimeState.eventLogs]);

  const latestDeltaBySeatNo = useMemo(
    () =>
      Object.fromEntries(
        (realtimeState.latestDealEndSummary?.results ?? []).map((result) => [
          result.seatNo,
          result.delta,
        ]),
      ) as Record<number, number>,
    [realtimeState.latestDealEndSummary],
  );

  useEffect(() => {
    if (mySeat !== null) {
      setJoinErrorMessage(null);
    }
  }, [mySeat]);

  const handleJoinFromModal = () => {
    const buyIn = Number.parseInt(joinBuyInText, 10);
    if (
      !Number.isInteger(buyIn) ||
      buyIn < TableBuyIn.MIN ||
      buyIn > TableBuyIn.MAX
    ) {
      setJoinErrorMessage(
        `buy-in は ${TableBuyIn.MIN}〜${TableBuyIn.MAX} の整数で入力してください。`,
      );
      return;
    }

    const store = tableStoreRef.current;
    if (!store) {
      setJoinErrorMessage("接続準備中のため、まだ着席できません。");
      return;
    }

    const sent = store.sendSeatCommand(RealtimeTableCommandType.JOIN, {
      buyIn,
    });

    if (!sent) {
      setJoinErrorMessage(
        store.getSnapshot().lastErrorMessage ??
          "着席コマンドを送信できませんでした。",
      );
      return;
    }

    setJoinErrorMessage(null);
  };

  const handleActionCommand = (action: TableActActionOption) => {
    if (!controlState.actionInputEnabled) {
      return;
    }
    if (!tableActActionOptions.includes(action)) {
      return;
    }

    const store = tableStoreRef.current;
    if (!store) {
      return;
    }

    store.sendActionCommand(action);
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
    const shouldShowJoinModal = mySeat === null;

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
              </article>

              {seats.map((seat) => {
                const isEmptySeat = seat.status === SeatStatus.EMPTY;
                const isToAct = toActSeatNo === seat.seatNo;
                const seatWinDelta = latestDeltaBySeatNo[seat.seatNo] ?? 0;
                const isWinner = seatWinDelta > 0;
                const seatCards = resolveSeatCards(
                  realtimeState.cardsBySeatNo,
                  seat.seatNo,
                );
                const seatLastAction =
                  realtimeState.lastActionBySeatNo[seat.seatNo] ?? null;
                const seatShowdown =
                  realtimeState.showdownBySeatNo[seat.seatNo] ?? null;
                const seatPositionClass = resolveSeatPositionClass(
                  seat.seatNo,
                  anchorSeatNo,
                  state.table.maxPlayers,
                );

                return (
                  <article
                    key={seat.seatNo}
                    className={`seat-pod seat-pos-${seatPositionClass} ${
                      isToAct ? "is-to-act" : ""
                    } ${isWinner ? "is-winner" : ""} ${isEmptySeat ? "is-empty" : ""}`}
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

                    {isEmptySeat ? null : (
                      <>
                        <p className="seat-player-name">
                          {seat.displayName ?? "Unknown"}
                          {seat.isYou ? " (You)" : ""}
                        </p>
                        <p className="seat-stack">
                          {formatChipsToUsd(seat.stack)}
                        </p>
                        {seatLastAction ? (
                          <p className="seat-last-action">
                            {formatActionLabel(seatLastAction.action)}
                          </p>
                        ) : null}
                        {isWinner ? (
                          <p className="seat-win-badge">
                            WON {formatSignedChips(seatWinDelta)}
                          </p>
                        ) : null}
                        {seatShowdown?.action === ShowdownAction.SHOW &&
                        seatShowdown.handLabel ? (
                          <p className="seat-showdown-label">
                            {seatShowdown.handLabel}
                          </p>
                        ) : null}
                        {seatShowdown?.action === ShowdownAction.MUCK ? (
                          <p className="seat-showdown-muck">MUCK</p>
                        ) : null}
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
                                const isRaisedUpCard =
                                  !isHidden &&
                                  RAISED_UP_CARD_SLOTS.has(card.slot);
                                const suitClass = card.card
                                  ? `is-suit-${card.card.suit.toLowerCase()}`
                                  : "";

                                return (
                                  <div
                                    key={`${card.slot}-${index}`}
                                    className={`playing-card ${
                                      isHidden ? "is-hidden" : ""
                                    } ${isRaisedUpCard ? "is-up-card" : ""} ${suitClass}`}
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

          <section className="surface inline-panel table-side-card action-bottom-dock">
            <div className="action-dock-left">
              <h3>アクション</h3>

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
                  相手のアクションを待っています...
                </p>
              )}
            </div>

            <div className="action-dock-right" ref={actionHistoryRef}>
              <h3>アクション履歴</h3>
              {actionsByStreet.size !== 0 && (
                <div
                  className="action-history-list"
                  aria-label="アクション履歴"
                >
                  {STREET_ORDER.filter((street) =>
                    actionsByStreet.has(street),
                  ).map((street) => {
                    const actions = actionsByStreet.get(street) ?? [];
                    return (
                      <section
                        key={street}
                        className="action-history-street-group"
                      >
                        <h4 className="action-history-street-header">
                          --- {formatStreetLabel(street)} Street ---
                        </h4>
                        <div className="action-history-actions">
                          {actions.map(
                            (action: PlayerActionEntry, index: number) => (
                              <div
                                key={`${action.seatNo}-${action.occurredAt}-${index}`}
                                className="action-history-action-item"
                              >
                                <span className="action-history-seat">
                                  Seat{action.seatNo}
                                </span>
                                <span className="action-history-action-label">
                                  {formatActionLabel(action.action)}
                                </span>
                                {action.amount !== null ? (
                                  <span className="action-history-amount">
                                    {formatChipsToUsd(action.amount)}
                                  </span>
                                ) : null}
                              </div>
                            ),
                          )}
                        </div>
                      </section>
                    );
                  })}
                </div>
              )}
            </div>
          </section>
        </div>

        {shouldShowJoinModal ? (
          <div className="join-modal-backdrop" role="presentation">
            <dialog
              className="join-modal"
              open
              aria-labelledby="join-modal-title"
            >
              <h3 id="join-modal-title">着席してゲームに参加</h3>
              <p>
                席は自動で割り当てられます。buy-in を入力して着席してください。
              </p>
              <label className="join-modal-label" htmlFor="join-buyin-input">
                buy-in ({TableBuyIn.MIN}〜{TableBuyIn.MAX})
              </label>
              <input
                id="join-buyin-input"
                className="join-modal-input"
                inputMode="numeric"
                min={TableBuyIn.MIN}
                max={TableBuyIn.MAX}
                step={1}
                value={joinBuyInText}
                onChange={(event) => {
                  setJoinBuyInText(event.target.value);
                  setJoinErrorMessage(null);
                }}
              />
              {joinErrorMessage ? (
                <p className="join-modal-error">{joinErrorMessage}</p>
              ) : null}
              <div className="row-actions join-modal-actions">
                <button
                  className="primary-button"
                  type="button"
                  onClick={handleJoinFromModal}
                >
                  着席
                </button>
                <button
                  className="ghost-button"
                  type="button"
                  onClick={onGoLobby}
                >
                  ロビーへ戻る
                </button>
              </div>
            </dialog>
          </div>
        ) : null}
      </section>
    );
  }

  return null;
};
