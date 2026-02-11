import type { IncomingMessage } from "node:http";
import {
  type RealtimeErrorCode,
  RealtimeErrorCode as RealtimeErrorCodeMap,
} from "@mix-online/shared";
import type { WebSocket } from "ws";
import {
  type SessionStore,
  type SessionUser,
  getSessionIdFromCookie,
} from "../auth-session";
import { toTableErrorMessage } from "../error-response";
import { isUuid, validateWsBaseCommand } from "../validation";
import {
  type RealtimeTableService,
  createRealtimeTableService,
} from "./table-service";

type TimerHandle = ReturnType<typeof globalThis.setTimeout>;

type WsGatewayOptions = {
  sessionStore: SessionStore;
  now?: () => Date;
  tableService?: RealtimeTableService;
  actionTimeoutMs?: number;
  setTimeoutFn?: (callback: () => void, timeoutMs: number) => TimerHandle;
  clearTimeoutFn?: (timeoutId: TimerHandle) => void;
};

type GatewayConnection = {
  socket: WebSocket;
  request: IncomingMessage;
};

type TrackedConnection = GatewayConnection & {
  currentTableId: string | null;
  currentUser: SessionUser | null;
};

type ClientCommandContext = {
  requestId: string | null;
  tableId: string | null;
};

const resolveTableIdFromPayload = (
  payload: Record<string, unknown>,
): string | null => {
  const rawTableId = payload.tableId;
  if (typeof rawTableId !== "string") {
    return null;
  }

  return isUuid(rawTableId) ? rawTableId : null;
};

const buildErrorPayload = (params: {
  code: RealtimeErrorCode;
  message: string;
  occurredAt: Date;
  context: ClientCommandContext;
}) =>
  toTableErrorMessage({
    code: params.code,
    message: params.message,
    occurredAt: params.occurredAt.toISOString(),
    requestId: params.context.requestId,
    tableId: params.context.tableId,
  });

export class WsGateway {
  private readonly sessionStore: SessionStore;
  private readonly now: () => Date;
  private readonly tableService: RealtimeTableService;
  private readonly actionTimeoutMs: number;
  private readonly setTimeoutFn: (
    callback: () => void,
    timeoutMs: number,
  ) => TimerHandle;
  private readonly clearTimeoutFn: (timeoutId: TimerHandle) => void;
  private readonly connections = new Set<TrackedConnection>();
  private readonly actionTimersByTableId = new Map<string, TimerHandle>();

  constructor(options: WsGatewayOptions) {
    this.sessionStore = options.sessionStore;
    this.now = options.now ?? (() => new Date());
    this.tableService = options.tableService ?? createRealtimeTableService();
    this.actionTimeoutMs = options.actionTimeoutMs ?? 30_000;
    this.setTimeoutFn =
      options.setTimeoutFn ??
      ((callback, timeoutMs) => globalThis.setTimeout(callback, timeoutMs));
    this.clearTimeoutFn =
      options.clearTimeoutFn ??
      ((timeoutId) => globalThis.clearTimeout(timeoutId));
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

      const parsed = this.parseJsonCommand(
        text,
        trackedConnection,
        commandContext,
        occurredAt,
      );
      if (!parsed.ok) {
        return;
      }

      const baseCommand = this.validateCommand(
        parsed.value,
        trackedConnection,
        commandContext,
        occurredAt,
      );
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
          this.scheduleAutoAction(reconnectResult.tableId);
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

      const result = await this.tableService.executeCommand({
        command: {
          type: baseCommand.type,
          requestId: baseCommand.requestId,
          sentAt: baseCommand.sentAt,
          payload: baseCommand.payload,
        },
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
      this.scheduleAutoAction(result.tableId);
    });
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
      this.scheduleAutoAction(result.tableId);
    }
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
      this.scheduleAutoAction(result.tableId);
    }
  }

  private parseJsonCommand(
    text: string,
    connection: TrackedConnection,
    commandContext: ClientCommandContext,
    occurredAt: Date,
  ): { ok: true; value: unknown } | { ok: false } {
    try {
      return {
        ok: true,
        value: JSON.parse(text),
      };
    } catch {
      this.sendTableError({
        connection,
        code: RealtimeErrorCodeMap.INVALID_ACTION,
        message: "JSON形式が不正です。",
        occurredAt,
        context: commandContext,
      });

      return { ok: false };
    }
  }

  private validateCommand(
    input: unknown,
    connection: TrackedConnection,
    commandContext: ClientCommandContext,
    occurredAt: Date,
  ) {
    try {
      const baseCommand = validateWsBaseCommand(input);
      commandContext.requestId = baseCommand.requestId;
      commandContext.tableId = resolveTableIdFromPayload(baseCommand.payload);
      return baseCommand;
    } catch {
      this.sendTableError({
        connection,
        code: RealtimeErrorCodeMap.INVALID_ACTION,
        message: "WebSocketコマンド形式が不正です。",
        occurredAt,
        context: commandContext,
      });
      return null;
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
    event: unknown,
    commandUser?: SessionUser,
  ): void {
    const body = JSON.stringify(event);

    for (const connection of this.connections) {
      if (connection.currentTableId === tableId) {
        connection.socket.send(body);
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
      // 発行者だけでも受信できるよう、未購読時は no-op を避ける。
      for (const connection of this.connections) {
        const sessionId = getSessionIdFromCookie(
          connection.request.headers.cookie,
        );
        if (!sessionId) {
          continue;
        }

        const session = this.sessionStore.findById(sessionId, this.now());
        if (session && session.user.userId === commandUser.userId) {
          connection.currentTableId = tableId;
          connection.socket.send(body);
        }
      }
    }
  }
}

export const createWsGateway = (options: WsGatewayOptions): WsGateway =>
  new WsGateway(options);
