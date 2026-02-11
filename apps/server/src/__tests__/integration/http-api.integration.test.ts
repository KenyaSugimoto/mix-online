import { describe, expect, it } from "vitest";
import { createApp } from "../../app";

describe("HTTP統合テスト", () => {
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
});
