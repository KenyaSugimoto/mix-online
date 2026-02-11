import { TableStatus } from "@mix-online/shared";
import { HttpAppError } from "./error-response";

const UUID_REGEX =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

const ISO_DATE_TIME_REGEX =
  /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{1,3})?Z$/;

const WS_COMMAND_TYPES = [
  "table.join",
  "table.sitOut",
  "table.return",
  "table.leave",
  "table.act",
  "table.resume",
  "ping",
] as const;

export type WsCommandType = (typeof WS_COMMAND_TYPES)[number];

export type WsBaseCommand = {
  type: WsCommandType;
  requestId: string;
  sentAt: string;
  payload: Record<string, unknown>;
};

export const isUuid = (value: string): boolean => UUID_REGEX.test(value);

export const resolveRequestId = (
  headerRequestId: string | undefined,
  createRequestId: () => string,
): string => {
  if (headerRequestId && isUuid(headerRequestId)) {
    return headerRequestId;
  }
  return createRequestId();
};

export const validateUuid = (value: string, fieldName: string): string => {
  if (!isUuid(value)) {
    throw new HttpAppError(
      "BAD_REQUEST",
      `${fieldName} は UUID 形式で指定してください。`,
    );
  }
  return value;
};

export const validateOptionalTableStatus = (value: string | undefined) => {
  if (!value) {
    return undefined;
  }

  if (
    !Object.values(TableStatus).includes(
      value as (typeof TableStatus)[keyof typeof TableStatus],
    )
  ) {
    throw new HttpAppError(
      "BAD_REQUEST",
      "state は定義済みの TableStatus を指定してください。",
    );
  }

  return value as (typeof TableStatus)[keyof typeof TableStatus];
};

export const validateWsBaseCommand = (input: unknown): WsBaseCommand => {
  if (typeof input !== "object" || input === null) {
    throw new HttpAppError(
      "BAD_REQUEST",
      "WebSocketコマンドはオブジェクト形式で指定してください。",
    );
  }

  const raw = input as Record<string, unknown>;

  if (!WS_COMMAND_TYPES.includes(raw.type as WsCommandType)) {
    throw new HttpAppError(
      "BAD_REQUEST",
      "type は定義済みのコマンド種別を指定してください。",
    );
  }

  if (typeof raw.requestId !== "string") {
    throw new HttpAppError("BAD_REQUEST", "requestId は必須です。");
  }
  validateUuid(raw.requestId, "requestId");

  if (typeof raw.sentAt !== "string" || !ISO_DATE_TIME_REGEX.test(raw.sentAt)) {
    throw new HttpAppError(
      "BAD_REQUEST",
      "sentAt は UTC の date-time 形式で指定してください。",
    );
  }

  if (typeof raw.payload !== "object" || raw.payload === null) {
    throw new HttpAppError(
      "BAD_REQUEST",
      "payload はオブジェクト形式で指定してください。",
    );
  }

  return {
    type: raw.type as WsCommandType,
    requestId: raw.requestId,
    sentAt: raw.sentAt,
    payload: raw.payload as Record<string, unknown>,
  };
};
