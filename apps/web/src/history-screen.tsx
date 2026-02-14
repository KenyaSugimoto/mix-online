import { useEffect, useState } from "react";
import { formatChipsToUsd } from "./auth-api";
import {
  type HandHistoryDetailResponse,
  type HandHistoryListItem,
  HistoryApiError,
  getHandHistories,
  getHandHistoryDetail,
} from "./history-api";
import { LobbyStateStatus, LocaleCode } from "./web-constants";

const PAGE_SIZE = 10;

type HistoryListState =
  | { status: typeof LobbyStateStatus.LOADING; requestVersion: number }
  | {
      status: typeof LobbyStateStatus.LOADED;
      items: HandHistoryListItem[];
      nextCursor: string | null;
    }
  | { status: typeof LobbyStateStatus.ERROR; message: string };

type DetailState =
  | { status: "idle" }
  | { status: "loading"; handId: string }
  | { status: "loaded"; detail: HandHistoryDetailResponse }
  | { status: "error"; handId: string; message: string };

const formatDateTime = (dateTime: string) =>
  new Date(dateTime).toLocaleString(LocaleCode.JA_JP);

const formatProfitLossLabel = (profitLoss: number) => {
  if (profitLoss > 0) {
    return `+${formatChipsToUsd(profitLoss)}`;
  }
  return formatChipsToUsd(profitLoss);
};

const resolveProfitLossClassName = (profitLoss: number) => {
  if (profitLoss > 0) {
    return "is-positive";
  }

  if (profitLoss < 0) {
    return "is-negative";
  }

  return "is-even";
};

export const HistoryScreen = (props: {
  onGoLobby: () => void;
  onLogout: () => void;
}) => {
  const { onGoLobby, onLogout } = props;
  const [requestVersion, setRequestVersion] = useState(0);
  const [detailRequestVersion, setDetailRequestVersion] = useState(0);
  const [listState, setListState] = useState<HistoryListState>({
    status: LobbyStateStatus.LOADING,
    requestVersion: 0,
  });
  const [selectedHandId, setSelectedHandId] = useState<string | null>(null);
  const [detailState, setDetailState] = useState<DetailState>({
    status: "idle",
  });
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [loadMoreErrorMessage, setLoadMoreErrorMessage] = useState<
    string | null
  >(null);

  useEffect(() => {
    let isCancelled = false;

    setListState({ status: LobbyStateStatus.LOADING, requestVersion });
    setLoadMoreErrorMessage(null);

    getHandHistories({ limit: PAGE_SIZE })
      .then((response) => {
        if (isCancelled) {
          return;
        }

        setListState({
          status: LobbyStateStatus.LOADED,
          items: response.items,
          nextCursor: response.nextCursor,
        });

        setSelectedHandId((currentSelectedHandId) => {
          if (
            currentSelectedHandId &&
            response.items.some((item) => item.handId === currentSelectedHandId)
          ) {
            return currentSelectedHandId;
          }
          return response.items.at(0)?.handId ?? null;
        });
      })
      .catch((error: unknown) => {
        if (isCancelled) {
          return;
        }

        const message =
          error instanceof HistoryApiError
            ? error.message
            : "履歴一覧の取得に失敗しました。";
        setListState({ status: LobbyStateStatus.ERROR, message });
      });

    return () => {
      isCancelled = true;
    };
  }, [requestVersion]);

  useEffect(() => {
    void detailRequestVersion;

    if (selectedHandId === null) {
      setDetailState({ status: "idle" });
      return;
    }

    let isCancelled = false;
    setDetailState({ status: "loading", handId: selectedHandId });

    getHandHistoryDetail(selectedHandId)
      .then((response) => {
        if (isCancelled) {
          return;
        }

        setDetailState({ status: "loaded", detail: response });
      })
      .catch((error: unknown) => {
        if (isCancelled) {
          return;
        }

        const message =
          error instanceof HistoryApiError
            ? error.message
            : "履歴詳細の取得に失敗しました。";
        setDetailState({ status: "error", handId: selectedHandId, message });
      });

    return () => {
      isCancelled = true;
    };
  }, [detailRequestVersion, selectedHandId]);

  const loadMore = async () => {
    if (
      listState.status !== LobbyStateStatus.LOADED ||
      listState.nextCursor === null
    ) {
      return;
    }

    setIsLoadingMore(true);
    setLoadMoreErrorMessage(null);

    try {
      const response = await getHandHistories({
        cursor: listState.nextCursor,
        limit: PAGE_SIZE,
      });

      setListState((currentState) => {
        if (currentState.status !== LobbyStateStatus.LOADED) {
          return currentState;
        }

        const seenIds = new Set(currentState.items.map((item) => item.handId));
        const mergedItems = [...currentState.items];

        for (const item of response.items) {
          if (seenIds.has(item.handId)) {
            continue;
          }
          mergedItems.push(item);
          seenIds.add(item.handId);
        }

        return {
          status: LobbyStateStatus.LOADED,
          items: mergedItems,
          nextCursor: response.nextCursor,
        };
      });
    } catch (error: unknown) {
      const message =
        error instanceof HistoryApiError
          ? error.message
          : "次ページの読み込みに失敗しました。";
      setLoadMoreErrorMessage(message);
    } finally {
      setIsLoadingMore(false);
    }
  };

  return (
    <section className="surface state-panel">
      <header className="history-header">
        <div>
          <h2>履歴</h2>
          <p>過去ハンドの一覧・詳細を確認できます。</p>
        </div>
        <div className="row-actions">
          <button
            className="ghost-button"
            type="button"
            onClick={() => setRequestVersion((version) => version + 1)}
          >
            再取得
          </button>
          <button className="ghost-button" type="button" onClick={onGoLobby}>
            ロビーへ戻る
          </button>
          <button className="ghost-button" type="button" onClick={onLogout}>
            ログアウト
          </button>
        </div>
      </header>

      {listState.status === LobbyStateStatus.LOADING ? (
        <p className="status-chip">
          履歴一覧を読み込み中です（リクエスト {listState.requestVersion + 1}）
        </p>
      ) : null}

      {listState.status === LobbyStateStatus.ERROR ? (
        <div className="surface inline-panel">
          <h3>履歴一覧の取得に失敗しました</h3>
          <p>{listState.message}</p>
          <button
            className="primary-button"
            type="button"
            onClick={() => setRequestVersion((version) => version + 1)}
          >
            再取得
          </button>
        </div>
      ) : null}

      {listState.status === LobbyStateStatus.LOADED ? (
        <div className="history-layout">
          <section className="history-list" aria-label="ハンド履歴一覧">
            {listState.items.length === 0 ? (
              <p className="history-empty">履歴はまだありません。</p>
            ) : (
              <ul className="history-list-items">
                {listState.items.map((item) => (
                  <li key={item.handId}>
                    <button
                      className={`history-list-item ${
                        item.handId === selectedHandId ? "is-active" : ""
                      }`}
                      type="button"
                      onClick={() => setSelectedHandId(item.handId)}
                    >
                      <span className="history-list-main">
                        {item.tableName ?? "Table"} / hand #{item.handNo ?? "-"}
                      </span>
                      <span className="history-list-sub">{item.gameType}</span>
                      <span className="history-list-sub">
                        {formatDateTime(item.endedAt)}
                      </span>
                      <span
                        className={`profit-loss-chip ${resolveProfitLossClassName(item.profitLoss)}`}
                      >
                        {formatProfitLossLabel(item.profitLoss)}
                      </span>
                    </button>
                  </li>
                ))}
              </ul>
            )}

            {loadMoreErrorMessage ? (
              <p className="history-load-more-error">{loadMoreErrorMessage}</p>
            ) : null}

            <div className="row-actions">
              <button
                className="ghost-button"
                type="button"
                disabled={isLoadingMore || listState.nextCursor === null}
                onClick={loadMore}
              >
                {isLoadingMore
                  ? "読み込み中..."
                  : listState.nextCursor === null
                    ? "これ以上ありません"
                    : "次のページを読み込む"}
              </button>
            </div>
          </section>

          <section className="history-detail surface" aria-live="polite">
            {detailState.status === "idle" ? (
              <p>一覧からハンドを選択してください。</p>
            ) : null}

            {detailState.status === "loading" ? (
              <p>履歴詳細を読み込み中です。</p>
            ) : null}

            {detailState.status === "error" ? (
              <div>
                <h3>履歴詳細の取得に失敗しました</h3>
                <p>{detailState.message}</p>
                <button
                  className="primary-button"
                  type="button"
                  onClick={() =>
                    setDetailRequestVersion((version) => version + 1)
                  }
                >
                  再試行
                </button>
              </div>
            ) : null}

            {detailState.status === "loaded" ? (
              <>
                <header className="history-detail-header">
                  <div>
                    <h3>
                      {detailState.detail.tableName ?? "Table"} / hand #
                      {detailState.detail.handNo ?? "-"}
                    </h3>
                    <p>
                      {detailState.detail.gameType} /{" "}
                      {formatDateTime(detailState.detail.startedAt)}〜
                      {formatDateTime(detailState.detail.endedAt)}
                    </p>
                  </div>
                  <span
                    className={`profit-loss-chip ${resolveProfitLossClassName(
                      detailState.detail.profitLoss,
                    )}`}
                  >
                    {formatProfitLossLabel(detailState.detail.profitLoss)}
                  </span>
                </header>

                <section className="history-section">
                  <h4>参加プレイヤー</h4>
                  <ul className="history-detail-list">
                    {detailState.detail.participants.map((participant) => (
                      <li key={participant.userId}>
                        <strong>
                          Seat {participant.seatNo}: {participant.displayName}
                        </strong>
                        <span
                          className={`profit-loss-chip ${resolveProfitLossClassName(
                            participant.resultDelta ?? 0,
                          )}`}
                        >
                          {formatProfitLossLabel(participant.resultDelta ?? 0)}
                        </span>
                      </li>
                    ))}
                  </ul>
                </section>

                <section className="history-section">
                  <h4>ストリートアクション</h4>
                  <div className="history-street-list">
                    {detailState.detail.streetActions.map((streetAction) => (
                      <article
                        key={streetAction.street}
                        className="history-street-card"
                      >
                        <h5>{streetAction.street}</h5>
                        <ul className="history-detail-list">
                          {streetAction.actions.map((action) => (
                            <li key={action.seq}>
                              <strong>
                                #{action.seq} Seat {action.seatNo}{" "}
                                {action.actionType}
                              </strong>
                              <span>
                                {action.amount === null
                                  ? "-"
                                  : formatChipsToUsd(action.amount)}
                                {action.isAuto ? " / AUTO" : ""}
                              </span>
                            </li>
                          ))}
                        </ul>
                      </article>
                    ))}
                  </div>
                </section>

                <section className="history-section">
                  <h4>ショーダウン結果</h4>
                  <p>
                    {detailState.detail.showdown.hasShowdown
                      ? "ショーダウンあり"
                      : "ショーダウンなし"}
                  </p>
                  <ul className="history-detail-list">
                    {detailState.detail.showdown.potResults.map((result) => (
                      <li key={`${result.potNo}-${result.side}`}>
                        <strong>
                          Pot {result.potNo} / {result.side}
                        </strong>
                        <span>{formatChipsToUsd(result.amount)}</span>
                      </li>
                    ))}
                  </ul>
                </section>
              </>
            ) : null}
          </section>
        </div>
      ) : null}
    </section>
  );
};
