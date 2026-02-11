import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createApp } from "../../app";

describe("HTTP統合テスト", () => {
  beforeEach(() => {
    vi.spyOn(console, "error").mockImplementation(() => {});
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("不正な state クエリで BAD_REQUEST を返す", async () => {
    const app = createApp();
    const response = await app.request("/api/lobby/tables?state=INVALID");
    const body = (await response.json()) as {
      error: { code: string; requestId: string };
    };

    expect(response.status).toBe(400);
    expect(body.error.code).toBe("BAD_REQUEST");
    expect(body.error.requestId).toBeTypeOf("string");
  });

  it("x-request-id を受け取った場合はレスポンスに同値を返す", async () => {
    const app = createApp();
    const requestId = "33333333-3333-4333-8333-333333333333";
    const response = await app.request("/api/health", {
      headers: {
        "x-request-id": requestId,
      },
    });
    const body = (await response.json()) as {
      requestId: string;
    };

    expect(response.status).toBe(200);
    expect(body.requestId).toBe(requestId);
  });

  it("不正な tableId で BAD_REQUEST を返す", async () => {
    const app = createApp();
    const response = await app.request("/api/tables/not-uuid");
    const body = (await response.json()) as {
      error: { code: string };
    };

    expect(response.status).toBe(400);
    expect(body.error.code).toBe("BAD_REQUEST");
  });

  it("未知のエンドポイントで NOT_FOUND を返す", async () => {
    const app = createApp();
    const response = await app.request("/api/unknown");
    const body = (await response.json()) as {
      error: { code: string; requestId: string };
    };

    expect(response.status).toBe(404);
    expect(body.error.code).toBe("NOT_FOUND");
    expect(body.error.requestId).toBeTypeOf("string");
  });

  it("不正な x-request-id は再採番される", async () => {
    const app = createApp();
    const response = await app.request("/api/health", {
      headers: {
        "x-request-id": "not-uuid",
      },
    });
    const body = (await response.json()) as {
      requestId: string;
    };

    expect(response.status).toBe(200);
    expect(body.requestId).not.toBe("not-uuid");
    expect(body.requestId).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i,
    );
  });

  it("未捕捉例外を INTERNAL_SERVER_ERROR へ正規化する", async () => {
    const app = createApp();
    app.get("/api/_test/internal-error", () => {
      throw new Error("unexpected");
    });

    const response = await app.request("/api/_test/internal-error");
    const body = (await response.json()) as {
      error: { code: string; requestId: string };
    };

    expect(response.status).toBe(500);
    expect(body.error.code).toBe("INTERNAL_SERVER_ERROR");
    expect(body.error.requestId).toBeTypeOf("string");
  });
});
