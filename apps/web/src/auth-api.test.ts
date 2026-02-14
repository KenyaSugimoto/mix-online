import { ErrorCode } from "@mix-online/shared";
import { describe, expect, it, vi } from "vitest";
import { type AuthApiError, createAuthApi, formatChipsToUsd } from "./auth-api";
import {
  ApiPath,
  HttpHeaderName,
  HttpMethod,
  HttpStatusCode,
  MediaType,
} from "./web-constants";

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

  it("updateDisplayName が更新後ユーザー情報を返す", async () => {
    const fetchMock = vi.fn(async () => {
      return new Response(
        JSON.stringify({
          user: {
            userId: "f1b2c3d4-9999-4999-8999-999999999999",
            displayName: "Renamed Player",
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

    await expect(api.updateDisplayName("Renamed Player")).resolves.toEqual({
      userId: "f1b2c3d4-9999-4999-8999-999999999999",
      displayName: "Renamed Player",
      walletBalance: 4000,
    });
    expect(fetchMock).toHaveBeenCalledWith(
      ApiPath.AUTH_ME_DISPLAY_NAME,
      expect.objectContaining({
        method: HttpMethod.PATCH,
      }),
    );
  });

  it("updateDisplayName が BAD_REQUEST を受けた場合 AuthApiError を投げる", async () => {
    const fetchMock = vi.fn(async () => {
      return new Response(
        JSON.stringify({
          error: {
            code: ErrorCode.BAD_REQUEST,
            message:
              "displayName は 1 文字以上 64 文字以下で指定してください。",
          },
        }),
        {
          status: HttpStatusCode.BAD_REQUEST,
          headers: {
            [HttpHeaderName.CONTENT_TYPE]: MediaType.APPLICATION_JSON,
          },
        },
      );
    });
    const api = createAuthApi(fetchMock);

    await expect(api.updateDisplayName("   ")).rejects.toMatchObject({
      name: "AuthApiError",
      status: HttpStatusCode.BAD_REQUEST,
      code: ErrorCode.BAD_REQUEST,
    } satisfies Partial<AuthApiError>);
  });

  it("formatChipsToUsd が表示フォーマットを返す", () => {
    expect(formatChipsToUsd(4000)).toBe("$4,000");
  });
});
