import {
  CardVisibility,
  type RealtimeErrorCode,
  RealtimeErrorCode as RealtimeErrorCodeMap,
  type RealtimeTableCommand,
  RealtimeTableCommandType,
  type RealtimeTableEventMessage,
  TableEventName,
} from "@mix-online/shared";
import { type SessionUser, getSessionIdFromCookie } from "../auth-session";
import {
  type RealtimeTableService,
  TABLE_RESUME_RESULT_KIND,
  type TableSnapshotMessage,
  createRealtimeTableService,
} from "./table-service";
import {
  DEFAULT_ACTION_TIMEOUT_MS,
  buildErrorPayload,
  parseJsonCommand,
  resolveTableIdFromPayload,
  validateBaseCommand,
} from "./ws-gateway/protocol";
import type {
  ClientCommandContext,
  GatewayConnection,
  TimerHandle,
  TrackedConnection,
  WsGatewayOptions,
} from "./ws-gateway/types";

export class WsGateway {
  private static readonly DEFAULT_REVEAL_WAIT_MS = 3_000;
  private readonly sessionStore: WsGatewayOptions["sessionStore"];
  private readonly now: () => Date;
  private readonly tableService: RealtimeTableService;
  private readonly actionTimeoutMs: number;
  private readonly revealWaitMs: number;
  private readonly setTimeoutFn: (
    callback: () => void,
    timeoutMs: number,
  ) => TimerHandle;
  private readonly clearTimeoutFn: (timeoutId: TimerHandle) => void;
  private readonly connections = new Set<TrackedConnection>();
  private readonly actionTimersByTableId = new Map<string, TimerHandle>();
  private readonly revealWaitTimersByTableId = new Map<string, TimerHandle>();

  constructor(options: WsGatewayOptions) {
    this.sessionStore = options.sessionStore;
    this.now = options.now ?? (() => new Date());
    this.tableService = options.tableService ?? createRealtimeTableService();
    this.actionTimeoutMs = options.actionTimeoutMs ?? DEFAULT_ACTION_TIMEOUT_MS;
    this.revealWaitMs =
      options.revealWaitMs ?? WsGateway.DEFAULT_REVEAL_WAIT_MS;
    this.setTimeoutFn =
      options.setTimeoutFn ??
      ((callback, timeoutMs) => globalThis.setTimeout(callback, timeoutMs));
    this.clearTimeoutFn =
      options.clearTimeoutFn ??
      ((timeoutId) => globalThis.clearTimeout(timeoutId));
  }

  private resolveViewerSeatNos(
    tableId: string,
    connection: TrackedConnection,
    fallbackUser?: SessionUser,
  ): Set<number> {
    const viewerUserId = fallbackUser?.userId ?? connection.currentUser?.userId;
    if (!viewerUserId) {
      return new Set<number>();
    }
    return new Set(this.tableService.getSeatNosForUser(tableId, viewerUserId));
  }

  private maskEventForViewer(params: {
    event: RealtimeTableEventMessage;
    viewerSeatNos: Set<number>;
  }): RealtimeTableEventMessage {
    const { event, viewerSeatNos } = params;

    if (event.eventName === TableEventName.DealCards3rdEvent) {
      return {
        ...event,
        payload: {
          ...event.payload,
          cards: event.payload.cards.map((seatCards) => {
            const isSelfSeat = viewerSeatNos.has(seatCards.seatNo);
            return {
              ...seatCards,
              cards: seatCards.cards.map((cardView) => {
                if (cardView.visibility === CardVisibility.UP) {
                  return cardView;
                }
                return isSelfSeat
                  ? {
                      ...cardView,
                      visibility: CardVisibility.DOWN_SELF,
                    }
                  : {
                      ...cardView,
                      visibility: CardVisibility.DOWN_HIDDEN,
                      card: null,
                    };
              }),
            };
          }),
        },
      };
    }

    if (event.eventName === TableEventName.DealCardEvent) {
      return {
        ...event,
        payload: {
          ...event.payload,
          cards: event.payload.cards.map((cardView) => {
            if (cardView.visibility === CardVisibility.UP) {
              return cardView;
            }
            const isSelfSeat = viewerSeatNos.has(cardView.seatNo);
            return isSelfSeat
              ? {
                  ...cardView,
                  visibility: CardVisibility.DOWN_SELF,
                }
              : {
                  ...cardView,
                  visibility: CardVisibility.DOWN_HIDDEN,
                  card: null,
                };
          }),
        },
      };
    }

    return event;
  }

  private maskSnapshotForViewer(params: {
    snapshot: TableSnapshotMessage;
    viewerSeatNos: Set<number>;
  }): TableSnapshotMessage {
    const { snapshot, viewerSeatNos } = params;
    const currentHand = snapshot.payload.table.currentHand;
    if (!currentHand) {
      return snapshot;
    }

    return {
      ...snapshot,
      payload: {
        ...snapshot.payload,
        table: {
          ...snapshot.payload.table,
          currentHand: {
            ...currentHand,
            cards: currentHand.cards.map((seatCards) => {
              const isSelfSeat = viewerSeatNos.has(seatCards.seatNo);
              return {
                ...seatCards,
                cards: seatCards.cards.map((cardView) => {
                  if (cardView.visibility === CardVisibility.UP) {
                    return cardView;
                  }
                  return isSelfSeat
                    ? {
                        ...cardView,
                        visibility: CardVisibility.DOWN_SELF,
                      }
                    : {
                        ...cardView,
                        visibility: CardVisibility.DOWN_HIDDEN,
                        card: null,
                      };
                }),
              };
            }),
          },
        },
      },
    };
  }

  handleConnection(connection: GatewayConnection): void {
    const trackedConnection: TrackedConnection = {
      ...connection,
      currentTableId: null,
      currentUser: null,
    };
    this.connections.add(trackedConnection);

    trackedConnection.socket.on("close", () => {
      void this.handleDisconnect(trackedConnection);
    });

    trackedConnection.socket.on("message", async (raw) => {
      const text = typeof raw === "string" ? raw : raw.toString("utf-8");
      const occurredAt = this.now();
      const commandContext: ClientCommandContext = {
        requestId: null,
        tableId: null,
      };

      const sessionId = getSessionIdFromCookie(
        trackedConnection.request.headers.cookie,
      );
      const session =
        sessionId === null
          ? null
          : this.sessionStore.findById(sessionId, occurredAt);

      if (session === null) {
        this.sendTableError({
          connection: trackedConnection,
          code: RealtimeErrorCodeMap.AUTH_EXPIRED,
          message: "認証の有効期限が切れています。",
          occurredAt,
          context: commandContext,
        });
        return;
      }

      trackedConnection.currentUser = session.user;

      const parsed = parseJsonCommand(text);
      if (!parsed.ok) {
        this.sendTableError({
          connection: trackedConnection,
          code: RealtimeErrorCodeMap.INVALID_ACTION,
          message: "JSON形式が不正です。",
          occurredAt,
          context: commandContext,
        });
        return;
      }

      const baseCommand = (() => {
        try {
          const validated = validateBaseCommand(parsed.value);
          commandContext.requestId = validated.requestId;
          commandContext.tableId = resolveTableIdFromPayload(validated.payload);
          return validated;
        } catch {
          this.sendTableError({
            connection: trackedConnection,
            code: RealtimeErrorCodeMap.INVALID_ACTION,
            message: "WebSocketコマンド形式が不正です。",
            occurredAt,
            context: commandContext,
          });
          return null;
        }
      })();
      if (baseCommand === null) {
        return;
      }

      if (commandContext.tableId !== null) {
        trackedConnection.currentTableId = commandContext.tableId;
        const reconnectResult = await this.tableService.handleReconnect({
          tableId: commandContext.tableId,
          user: session.user,
          occurredAt,
        });
        if (reconnectResult.ok) {
          for (const event of reconnectResult.events) {
            this.broadcastToTable(reconnectResult.tableId, event, session.user);
          }
          this.scheduleTableTimers(reconnectResult.tableId);
        }
      }

      if (baseCommand.type === "ping") {
        trackedConnection.socket.send(
          JSON.stringify({
            type: "pong",
            requestId: baseCommand.requestId,
            occurredAt: occurredAt.toISOString(),
          }),
        );
        return;
      }

      if (baseCommand.type === RealtimeTableCommandType.RESUME) {
        const resumeTableId = commandContext.tableId;
        const lastTableSeq = baseCommand.payload.lastTableSeq;
        if (
          resumeTableId === null ||
          typeof lastTableSeq !== "number" ||
          !Number.isInteger(lastTableSeq) ||
          lastTableSeq < 0
        ) {
          this.sendTableError({
            connection: trackedConnection,
            code: RealtimeErrorCodeMap.INVALID_ACTION,
            message: "table.resume の payload が不正です。",
            occurredAt,
            context: commandContext,
          });
          return;
        }

        const resumeResult = await this.tableService.resumeFrom({
          tableId: resumeTableId,
          lastTableSeq,
          occurredAt,
        });
        trackedConnection.currentTableId = resumeTableId;
        if (resumeResult.kind === TABLE_RESUME_RESULT_KIND.EVENTS) {
          const viewerSeatNos = this.resolveViewerSeatNos(
            resumeTableId,
            trackedConnection,
            session.user,
          );
          for (const event of resumeResult.events) {
            trackedConnection.socket.send(
              JSON.stringify(
                this.maskEventForViewer({
                  event,
                  viewerSeatNos,
                }),
              ),
            );
          }
        } else {
          trackedConnection.socket.send(
            JSON.stringify(
              this.maskSnapshotForViewer({
                snapshot: resumeResult.snapshot,
                viewerSeatNos: this.resolveViewerSeatNos(
                  resumeTableId,
                  trackedConnection,
                  session.user,
                ),
              }),
            ),
          );
        }
        this.scheduleTableTimers(resumeTableId);
        return;
      }

      const command: RealtimeTableCommand = {
        type: baseCommand.type as RealtimeTableCommand["type"],
        requestId: baseCommand.requestId,
        sentAt: baseCommand.sentAt,
        payload: baseCommand.payload as RealtimeTableCommand["payload"],
      } as RealtimeTableCommand;

      const result = await this.tableService.executeCommand({
        command,
        user: session.user,
        occurredAt,
      });

      if (result.ok === false) {
        this.sendTableError({
          connection: trackedConnection,
          code: result.error.code,
          message: result.error.message,
          occurredAt,
          context: {
            requestId: result.error.requestId,
            tableId: result.error.tableId,
          },
        });
        return;
      }

      trackedConnection.currentTableId = result.tableId;
      for (const event of result.events) {
        this.broadcastToTable(result.tableId, event, session.user);
      }
      this.scheduleTableTimers(result.tableId);
    });
  }

  schedulePendingActions(tableIds: string[]): void {
    for (const tableId of tableIds) {
      this.scheduleAutoAction(tableId);
    }
  }

  schedulePendingRevealWaits(tableIds: string[]): void {
    for (const tableId of tableIds) {
      this.scheduleRevealWait(tableId);
    }
  }

  private async handleDisconnect(connection: TrackedConnection): Promise<void> {
    this.connections.delete(connection);

    if (!connection.currentTableId || !connection.currentUser) {
      return;
    }

    const result = await this.tableService.handleDisconnect({
      tableId: connection.currentTableId,
      user: connection.currentUser,
      occurredAt: this.now(),
    });

    if (result.ok) {
      for (const event of result.events) {
        this.broadcastToTable(result.tableId, event, connection.currentUser);
      }
      this.scheduleTableTimers(result.tableId);
    }
  }

  private scheduleTableTimers(tableId: string): void {
    this.scheduleAutoAction(tableId);
    this.scheduleRevealWait(tableId);
  }

  private scheduleAutoAction(tableId: string): void {
    this.clearAutoActionTimer(tableId);

    const seatNo = this.tableService.getNextToActSeatNo(tableId);
    if (seatNo === null) {
      return;
    }

    const timeoutId = this.setTimeoutFn(() => {
      void this.runAutoAction(tableId, seatNo);
    }, this.actionTimeoutMs);
    this.actionTimersByTableId.set(tableId, timeoutId);
  }

  private clearAutoActionTimer(tableId: string): void {
    const existing = this.actionTimersByTableId.get(tableId);
    if (!existing) {
      return;
    }

    this.clearTimeoutFn(existing);
    this.actionTimersByTableId.delete(tableId);
  }

  private scheduleRevealWait(tableId: string): void {
    this.clearRevealWaitTimer(tableId);
    if (!this.tableService.hasPendingRevealWait(tableId)) {
      return;
    }

    const timeoutId = this.setTimeoutFn(() => {
      void this.runRevealWait(tableId);
    }, this.revealWaitMs);
    this.revealWaitTimersByTableId.set(tableId, timeoutId);
  }

  private clearRevealWaitTimer(tableId: string): void {
    const existing = this.revealWaitTimersByTableId.get(tableId);
    if (!existing) {
      return;
    }
    this.clearTimeoutFn(existing);
    this.revealWaitTimersByTableId.delete(tableId);
  }

  private async runAutoAction(tableId: string, seatNo: number): Promise<void> {
    this.actionTimersByTableId.delete(tableId);

    const result = await this.tableService.executeAutoAction({
      tableId,
      seatNo,
      occurredAt: this.now(),
    });

    if (result.ok) {
      for (const event of result.events) {
        this.broadcastToTable(result.tableId, event);
      }
      this.scheduleTableTimers(result.tableId);
    }
  }

  private async runRevealWait(tableId: string): Promise<void> {
    this.revealWaitTimersByTableId.delete(tableId);

    const result = await this.tableService.executeRevealWaitTimeout({
      tableId,
      occurredAt: this.now(),
    });

    if (result.ok) {
      for (const event of result.events) {
        this.broadcastToTable(result.tableId, event);
      }
      this.scheduleTableTimers(result.tableId);
    }
  }

  private sendTableError(params: {
    connection: TrackedConnection;
    code: RealtimeErrorCode;
    message: string;
    occurredAt: Date;
    context: ClientCommandContext;
  }): void {
    params.connection.socket.send(
      JSON.stringify(
        buildErrorPayload({
          code: params.code,
          message: params.message,
          occurredAt: params.occurredAt,
          context: params.context,
        }),
      ),
    );
  }

  private broadcastToTable(
    tableId: string,
    event: RealtimeTableEventMessage,
    commandUser?: SessionUser,
  ): void {
    for (const connection of this.connections) {
      if (connection.currentTableId === tableId) {
        connection.socket.send(
          JSON.stringify(
            this.maskEventForViewer({
              event,
              viewerSeatNos: this.resolveViewerSeatNos(tableId, connection),
            }),
          ),
        );
      }
    }

    if (!commandUser) {
      return;
    }

    const connectedInTable = [...this.connections].some(
      (connection) =>
        connection.currentTableId === tableId &&
        getSessionIdFromCookie(connection.request.headers.cookie) !== null,
    );

    if (!connectedInTable) {
      for (const connection of this.connections) {
        const sessionId = getSessionIdFromCookie(
          connection.request.headers.cookie,
        );
        if (!sessionId) {
          continue;
        }

        const session = this.sessionStore.findById(sessionId, this.now());
        if (session && session.user.userId === commandUser.userId) {
          connection.currentUser = session.user;
          connection.currentTableId = tableId;
          connection.socket.send(
            JSON.stringify(
              this.maskEventForViewer({
                event,
                viewerSeatNos: this.resolveViewerSeatNos(
                  tableId,
                  connection,
                  session.user,
                ),
              }),
            ),
          );
        }
      }
    }
  }
}

export const createWsGateway = (options: WsGatewayOptions): WsGateway =>
  new WsGateway(options);
