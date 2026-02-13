import { ErrorCode } from "@mix-online/shared";
import { describe, expect, it, vi } from "vitest";
import { type AuthApiError, createAuthApi, formatChipsToUsd } from "./auth-api";
import { HttpHeaderName, HttpStatusCode, MediaType } from "./web-constants";

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
          status: HttpStatusCode.OK,
          headers: {
            [HttpHeaderName.CONTENT_TYPE]: MediaType.APPLICATION_JSON,
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
          status: HttpStatusCode.UNAUTHORIZED,
          headers: {
            [HttpHeaderName.CONTENT_TYPE]: MediaType.APPLICATION_JSON,
          },
        },
      );
    });

    const api = createAuthApi(fetchMock);
    await expect(api.getMe()).rejects.toMatchObject({
      name: "AuthApiError",
      status: HttpStatusCode.UNAUTHORIZED,
      code: ErrorCode.AUTH_EXPIRED,
    } satisfies Partial<AuthApiError>);
  });

  it("formatChipsToUsd が表示フォーマットを返す", () => {
    expect(formatChipsToUsd(4000)).toBe("$4,000");
  });
});
