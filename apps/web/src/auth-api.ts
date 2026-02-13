import { ErrorCode, type ErrorCode as ErrorCodeType } from "@mix-online/shared";

export type UserProfile = {
  userId: string;
  displayName: string;
  walletBalance: number;
};

type AuthMeResponse = {
  user: UserProfile;
};

type ErrorResponse = {
  error?: {
    code?: string;
    message?: string;
  };
};

type FetchLike = (input: string, init?: RequestInit) => Promise<Response>;

export class AuthApiError extends Error {
  public readonly status: number;
  public readonly code: ErrorCodeType | null;

  public constructor(params: {
    status: number;
    code: ErrorCodeType | null;
    message: string;
  }) {
    super(params.message);
    this.name = "AuthApiError";
    this.status = params.status;
    this.code = params.code;
  }
}

const parseJsonSafely = async <T>(response: Response) => {
  try {
    return (await response.json()) as T;
  } catch {
    return null;
  }
};

const parseApiError = async (response: Response) => {
  const body = await parseJsonSafely<ErrorResponse>(response);
  const code =
    typeof body?.error?.code === "string"
      ? (body.error.code as ErrorCodeType)
      : null;
  const message =
    typeof body?.error?.message === "string"
      ? body.error.message
      : `認証API呼び出しに失敗しました (status=${response.status})`;

  return new AuthApiError({
    status: response.status,
    code,
    message,
  });
};

const validateAuthMeResponse = (value: AuthMeResponse | null): UserProfile => {
  if (
    !value ||
    typeof value.user?.userId !== "string" ||
    typeof value.user.displayName !== "string" ||
    typeof value.user.walletBalance !== "number"
  ) {
    throw new AuthApiError({
      status: 500,
      code: ErrorCode.INTERNAL_SERVER_ERROR,
      message: "認証ユーザー情報のレスポンス形式が不正です。",
    });
  }

  return value.user;
};

export const createAuthApi = (fetchImpl: FetchLike) => ({
  async getMe(): Promise<UserProfile> {
    const response = await fetchImpl("/api/auth/me", {
      credentials: "include",
      headers: {
        Accept: "application/json",
      },
    });

    if (!response.ok) {
      throw await parseApiError(response);
    }

    const body = await parseJsonSafely<AuthMeResponse>(response);
    return validateAuthMeResponse(body);
  },

  async logout(): Promise<void> {
    const response = await fetchImpl("/api/auth/logout", {
      method: "POST",
      credentials: "include",
      headers: {
        Accept: "application/json",
      },
    });

    if (response.status === 204) {
      return;
    }

    if (!response.ok) {
      throw await parseApiError(response);
    }
  },
});

const authApi = createAuthApi(fetch as FetchLike);

export const getAuthMe = () => authApi.getMe();
export const postAuthLogout = () => authApi.logout();

export const formatChipsToUsd = (chips: number) =>
  new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
  }).format(chips);
