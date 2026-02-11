import type { IncomingMessage } from "node:http";
import {
  type RealtimeErrorCode,
  RealtimeErrorCode as RealtimeErrorCodeMap,
} from "@mix-online/shared";
import type { WebSocket } from "ws";
import { type SessionStore, getSessionIdFromCookie } from "../auth-session";
import { toTableErrorMessage } from "../error-response";
import { isUuid, validateWsBaseCommand } from "../validation";

type WsGatewayOptions = {
  sessionStore: SessionStore;
  now?: () => Date;
};

type GatewayConnection = {
  socket: WebSocket;
  request: IncomingMessage;
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

  constructor(options: WsGatewayOptions) {
    this.sessionStore = options.sessionStore;
    this.now = options.now ?? (() => new Date());
  }

  handleConnection(connection: GatewayConnection): void {
    connection.socket.on("message", (raw) => {
      const text = typeof raw === "string" ? raw : raw.toString("utf-8");
      const occurredAt = this.now();

      const commandContext: ClientCommandContext = {
        requestId: null,
        tableId: null,
      };

      const sessionId = getSessionIdFromCookie(
        connection.request.headers.cookie,
      );
      const session =
        sessionId === null
          ? null
          : this.sessionStore.findById(sessionId, occurredAt);

      if (session === null) {
        connection.socket.send(
          JSON.stringify(
            buildErrorPayload({
              code: RealtimeErrorCodeMap.AUTH_EXPIRED,
              message: "認証の有効期限が切れています。",
              occurredAt,
              context: commandContext,
            }),
          ),
        );
        return;
      }

      let parsed: unknown;

      try {
        parsed = JSON.parse(text);
      } catch {
        connection.socket.send(
          JSON.stringify(
            buildErrorPayload({
              code: RealtimeErrorCodeMap.INVALID_ACTION,
              message: "JSON形式が不正です。",
              occurredAt,
              context: commandContext,
            }),
          ),
        );
        return;
      }

      try {
        const baseCommand = validateWsBaseCommand(parsed);
        commandContext.requestId = baseCommand.requestId;
        commandContext.tableId = resolveTableIdFromPayload(baseCommand.payload);

        if (baseCommand.type === "ping") {
          connection.socket.send(
            JSON.stringify({
              type: "pong",
              requestId: baseCommand.requestId,
              occurredAt: occurredAt.toISOString(),
            }),
          );
          return;
        }

        connection.socket.send(
          JSON.stringify(
            buildErrorPayload({
              code: RealtimeErrorCodeMap.INVALID_ACTION,
              message: `${baseCommand.type} は未実装です。`,
              occurredAt,
              context: commandContext,
            }),
          ),
        );
      } catch {
        connection.socket.send(
          JSON.stringify(
            buildErrorPayload({
              code: RealtimeErrorCodeMap.INVALID_ACTION,
              message: "WebSocketコマンド形式が不正です。",
              occurredAt,
              context: commandContext,
            }),
          ),
        );
      }
    });
  }
}

export const createWsGateway = (options: WsGatewayOptions): WsGateway =>
  new WsGateway(options);
