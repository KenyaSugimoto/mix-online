import { ErrorCode } from "@mix-online/shared";
import { describe, expect, it, vi } from "vitest";
import { type AuthApiError, createAuthApi, formatChipsToUsd } from "./auth-api";

describe("auth-api", () => {
  it("getMe が認証ユーザー情報を返す", async () => {
    const fetchMock = vi.fn(async () => {
      return new Response(
        JSON.stringify({
          user: {
            userId: "f1b2c3d4-9999-4999-8999-999999999999",
            displayName: "MVP User",
            walletBalance: 4000,
          },
        }),
        {
          status: 200,
          headers: {
            "Content-Type": "application/json",
          },
        },
      );
    });

    const api = createAuthApi(fetchMock);
    await expect(api.getMe()).resolves.toEqual({
      userId: "f1b2c3d4-9999-4999-8999-999999999999",
      displayName: "MVP User",
      walletBalance: 4000,
    });
  });

  it("getMe が AUTH_EXPIRED を受けた場合 AuthApiError を投げる", async () => {
    const fetchMock = vi.fn(async () => {
      return new Response(
        JSON.stringify({
          error: {
            code: ErrorCode.AUTH_EXPIRED,
            message: "認証期限切れ",
          },
        }),
        {
          status: 401,
          headers: {
            "Content-Type": "application/json",
          },
        },
      );
    });

    const api = createAuthApi(fetchMock);
    await expect(api.getMe()).rejects.toMatchObject({
      name: "AuthApiError",
      status: 401,
      code: ErrorCode.AUTH_EXPIRED,
    } satisfies Partial<AuthApiError>);
  });

  it("formatChipsToUsd が表示フォーマットを返す", () => {
    expect(formatChipsToUsd(4000)).toBe("$4,000");
  });
});
