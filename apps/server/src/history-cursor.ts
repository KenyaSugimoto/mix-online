import { createHmac, timingSafeEqual } from "node:crypto";
import { ErrorCode } from "@mix-online/shared";
import { HttpAppError } from "./error-response";
import type { HandHistoryCursorKey } from "./history-hand";

type HistoryCursorPayload = {
  endedAt: string;
  handId: string;
  exp: number;
};

const encodeBase64Url = (input: string): string =>
  Buffer.from(input, "utf-8").toString("base64url");

const decodeBase64Url = (input: string): string =>
  Buffer.from(input, "base64url").toString("utf-8");

const sign = (payloadBase64: string, secret: string): string => {
  return createHmac("sha256", secret).update(payloadBase64).digest("base64url");
};

const invalidCursor = () =>
  new HttpAppError(
    ErrorCode.INVALID_CURSOR,
    "cursor が不正です。最新一覧から取得し直してください。",
  );

export const encodeHistoryCursor = (params: {
  cursorKey: HandHistoryCursorKey;
  now: Date;
  secret: string;
  ttlMs?: number;
}): string => {
  const ttlMs = params.ttlMs ?? 1000 * 60 * 60 * 24;
  const payload: HistoryCursorPayload = {
    endedAt: params.cursorKey.endedAt,
    handId: params.cursorKey.handId,
    exp: params.now.getTime() + ttlMs,
  };
  const payloadBase64 = encodeBase64Url(JSON.stringify(payload));
  const signature = sign(payloadBase64, params.secret);
  return `${payloadBase64}.${signature}`;
};

export const decodeHistoryCursor = (params: {
  cursor: string;
  now: Date;
  secret: string;
}): HandHistoryCursorKey => {
  const [payloadBase64, receivedSignature, ...rest] = params.cursor.split(".");
  if (!payloadBase64 || !receivedSignature || rest.length > 0) {
    throw invalidCursor();
  }

  const expectedSignature = sign(payloadBase64, params.secret);
  const receivedBuffer = Buffer.from(receivedSignature);
  const expectedBuffer = Buffer.from(expectedSignature);

  if (
    receivedBuffer.length !== expectedBuffer.length ||
    !timingSafeEqual(receivedBuffer, expectedBuffer)
  ) {
    throw invalidCursor();
  }

  let payloadRaw = "";
  try {
    payloadRaw = decodeBase64Url(payloadBase64);
  } catch {
    throw invalidCursor();
  }

  let payload: HistoryCursorPayload;
  try {
    payload = JSON.parse(payloadRaw) as HistoryCursorPayload;
  } catch {
    throw invalidCursor();
  }

  if (
    typeof payload.endedAt !== "string" ||
    typeof payload.handId !== "string" ||
    typeof payload.exp !== "number"
  ) {
    throw invalidCursor();
  }

  if (
    Number.isNaN(Date.parse(payload.endedAt)) ||
    payload.exp <= params.now.getTime()
  ) {
    throw invalidCursor();
  }

  return {
    endedAt: payload.endedAt,
    handId: payload.handId,
  };
};
