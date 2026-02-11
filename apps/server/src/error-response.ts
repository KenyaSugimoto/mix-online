import { ErrorCode, type RealtimeErrorCode } from "@mix-online/shared";

export type HttpErrorStatus = 400 | 401 | 404 | 409 | 500;

const ERROR_STATUS_MAP: Record<ErrorCode, HttpErrorStatus> = {
  [ErrorCode.INVALID_ACTION]: 409,
  [ErrorCode.INVALID_CURSOR]: 400,
  [ErrorCode.NOT_YOUR_TURN]: 409,
  [ErrorCode.INSUFFICIENT_CHIPS]: 409,
  [ErrorCode.TABLE_FULL]: 409,
  [ErrorCode.BUYIN_OUT_OF_RANGE]: 400,
  [ErrorCode.ALREADY_SEATED]: 409,
  [ErrorCode.AUTH_EXPIRED]: 401,
  [ErrorCode.BAD_REQUEST]: 400,
  [ErrorCode.NOT_FOUND]: 404,
  [ErrorCode.INTERNAL_SERVER_ERROR]: 500,
};

const ERROR_MESSAGE_MAP: Record<ErrorCode, string> = {
  [ErrorCode.INVALID_ACTION]: "実行できないアクションです。",
  [ErrorCode.INVALID_CURSOR]: "cursor が不正です。",
  [ErrorCode.NOT_YOUR_TURN]: "現在あなたの手番ではありません。",
  [ErrorCode.INSUFFICIENT_CHIPS]: "チップが不足しています。",
  [ErrorCode.TABLE_FULL]: "卓に空席がありません。",
  [ErrorCode.BUYIN_OUT_OF_RANGE]: "buyIn が許容範囲外です。",
  [ErrorCode.ALREADY_SEATED]: "すでに同卓に着席済みです。",
  [ErrorCode.AUTH_EXPIRED]: "認証の有効期限が切れています。",
  [ErrorCode.BAD_REQUEST]: "リクエスト形式が不正です。",
  [ErrorCode.NOT_FOUND]: "対象リソースが見つかりません。",
  [ErrorCode.INTERNAL_SERVER_ERROR]: "サーバー内部でエラーが発生しました。",
};

export class HttpAppError extends Error {
  readonly code: ErrorCode;
  readonly status: HttpErrorStatus;

  constructor(code: ErrorCode, message?: string) {
    super(message ?? ERROR_MESSAGE_MAP[code]);
    this.name = "HttpAppError";
    this.code = code;
    this.status = ERROR_STATUS_MAP[code];
  }
}

export const toHttpErrorResponse = (
  code: ErrorCode,
  requestId: string,
  message?: string,
) => ({
  error: {
    code,
    message: message ?? ERROR_MESSAGE_MAP[code],
    requestId,
  },
});

export const toTableErrorMessage = (params: {
  code: RealtimeErrorCode;
  message: string;
  occurredAt: string;
  requestId: string | null;
  tableId: string | null;
}) => ({
  type: "table.error" as const,
  requestId: params.requestId,
  tableId: params.tableId,
  code: params.code,
  message: params.message,
  occurredAt: params.occurredAt,
});
