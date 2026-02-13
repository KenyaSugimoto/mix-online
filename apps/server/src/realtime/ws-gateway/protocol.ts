import type { RealtimeErrorCode } from "@mix-online/shared";
import { toTableErrorMessage } from "../../error-response";
import { isUuid, validateWsBaseCommand } from "../../validation";
import type { ClientCommandContext, JsonCommandParseResult } from "./types";

export const DEFAULT_ACTION_TIMEOUT_MS = 30_000;

export const resolveTableIdFromPayload = (
  payload: Record<string, unknown>,
): string | null => {
  const rawTableId = payload.tableId;
  if (typeof rawTableId !== "string") {
    return null;
  }

  return isUuid(rawTableId) ? rawTableId : null;
};

export const buildErrorPayload = (params: {
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

export const parseJsonCommand = (text: string): JsonCommandParseResult => {
  try {
    return {
      ok: true,
      value: JSON.parse(text),
    };
  } catch {
    return { ok: false };
  }
};

export const validateBaseCommand = (input: unknown) =>
  validateWsBaseCommand(input);
