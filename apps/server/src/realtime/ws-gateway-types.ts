import type { IncomingMessage } from "node:http";
import type { WebSocket } from "ws";
import type { SessionStore, SessionUser } from "../auth-session";
import type { RealtimeTableService } from "./table-service";

export type TimerHandle = ReturnType<typeof globalThis.setTimeout>;

export type WsGatewayOptions = {
  sessionStore: SessionStore;
  now?: () => Date;
  tableService?: RealtimeTableService;
  actionTimeoutMs?: number;
  setTimeoutFn?: (callback: () => void, timeoutMs: number) => TimerHandle;
  clearTimeoutFn?: (timeoutId: TimerHandle) => void;
};

export type GatewayConnection = {
  socket: WebSocket;
  request: IncomingMessage;
};

export type TrackedConnection = GatewayConnection & {
  currentTableId: string | null;
  currentUser: SessionUser | null;
};

export type ClientCommandContext = {
  requestId: string | null;
  tableId: string | null;
};

export type JsonCommandParseSuccess = {
  ok: true;
  value: unknown;
};

export type JsonCommandParseFailure = {
  ok: false;
};

export type JsonCommandParseResult =
  | JsonCommandParseSuccess
  | JsonCommandParseFailure;
