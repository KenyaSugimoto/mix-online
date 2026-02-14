import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { ErrorCode, GameType } from "@mix-online/shared";
import { describe, expect, it } from "vitest";
import { createApp } from "../../app";
import { createInMemorySessionStore } from "../../auth-session";

const createAuthenticatedApp = () => {
  const sessionStore = createInMemorySessionStore();
  const session = sessionStore.create(
    {
      userId: "f1b2c3d4-9999-4999-8999-999999999999",
      displayName: "MVP User",
      walletBalance: 4000,
    },
    new Date("2026-02-11T12:00:00.000Z"),
  );
  const app = createApp({
    sessionStore,
    now: () => new Date("2026-02-11T12:30:00.000Z"),
    historyCursorSecret: "test-history-cursor-secret",
  });

  return {
    app,
    cookie: `session=${session.sessionId}`,
  };
};

describe("HTTP契約テスト（M2-06）", () => {
  it("OpenAPIにMVP対象エンドポイントが定義されている", () => {
    const openapiPath = resolve(process.cwd(), "docs/mvp/openapi.yaml");
    const openapi = readFileSync(openapiPath, "utf-8");

    expect(openapi).toContain("/api/auth/me:");
    expect(openapi).toContain("/api/auth/me/display-name:");
    expect(openapi).toContain("/api/auth/logout:");
    expect(openapi).toContain("/api/lobby/tables:");
    expect(openapi).toContain("/api/tables/{tableId}:");
    expect(openapi).toContain("/api/history/hands:");
    expect(openapi).toContain("/api/history/hands/{handId}:");
    expect(openapi).toContain(ErrorCode.INVALID_CURSOR);
  });

  it("認証系エンドポイントの正常系/異常系が契約どおり", async () => {
    const app = createApp();

    const unauthorizedMe = await app.request("/api/auth/me");
    const unauthorizedMeBody = (await unauthorizedMe.json()) as {
      error: { code: string };
    };
    expect(unauthorizedMe.status).toBe(401);
    expect(unauthorizedMeBody.error.code).toBe(ErrorCode.AUTH_EXPIRED);

    const unauthorizedLogout = await app.request("/api/auth/logout", {
      method: "POST",
    });
    const unauthorizedLogoutBody = (await unauthorizedLogout.json()) as {
      error: { code: string };
    };
    expect(unauthorizedLogout.status).toBe(401);
    expect(unauthorizedLogoutBody.error.code).toBe(ErrorCode.AUTH_EXPIRED);

    const unauthorizedDisplayNamePatch = await app.request(
      "/api/auth/me/display-name",
      {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          displayName: "Renamed Player",
        }),
      },
    );
    const unauthorizedDisplayNamePatchBody =
      (await unauthorizedDisplayNamePatch.json()) as {
        error: { code: string };
      };
    expect(unauthorizedDisplayNamePatch.status).toBe(401);
    expect(unauthorizedDisplayNamePatchBody.error.code).toBe(
      ErrorCode.AUTH_EXPIRED,
    );

    const { app: authenticatedApp, cookie } = createAuthenticatedApp();
    const authorizedMe = await authenticatedApp.request("/api/auth/me", {
      headers: {
        cookie,
      },
    });
    const authorizedMeBody = (await authorizedMe.json()) as {
      user: {
        userId: string;
        displayName: string;
        walletBalance: number;
      };
    };

    expect(authorizedMe.status).toBe(200);
    expect(authorizedMeBody.user.userId).toBe(
      "f1b2c3d4-9999-4999-8999-999999999999",
    );
    expect(authorizedMeBody.user.walletBalance).toBe(4000);
  });

  it("ロビー/卓詳細エンドポイントの正常系/異常系が契約どおり", async () => {
    const app = createApp();

    const lobbyResponse = await app.request("/api/lobby/tables");
    const lobbyBody = (await lobbyResponse.json()) as {
      tables: unknown[];
      serverTime: string;
    };
    expect(lobbyResponse.status).toBe(200);
    expect(Array.isArray(lobbyBody.tables)).toBe(true);
    expect(lobbyBody.serverTime).toMatch(
      /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{1,3})?Z$/,
    );

    const badTableIdResponse = await app.request("/api/tables/not-uuid");
    const badTableIdBody = (await badTableIdResponse.json()) as {
      error: { code: string };
    };
    expect(badTableIdResponse.status).toBe(400);
    expect(badTableIdBody.error.code).toBe(ErrorCode.BAD_REQUEST);

    const tableNotFoundResponse = await app.request(
      "/api/tables/aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
    );
    const tableNotFoundBody = (await tableNotFoundResponse.json()) as {
      error: { code: string };
    };
    expect(tableNotFoundResponse.status).toBe(404);
    expect(tableNotFoundBody.error.code).toBe(ErrorCode.NOT_FOUND);
  });

  it("履歴APIの正常系/異常系が契約どおり", async () => {
    const { app, cookie } = createAuthenticatedApp();

    const listResponse = await app.request("/api/history/hands?limit=2", {
      headers: {
        cookie,
      },
    });
    const listBody = (await listResponse.json()) as {
      items: Array<{ handId: string; gameType: string }>;
      nextCursor: string | null;
    };
    expect(listResponse.status).toBe(200);
    expect(listBody.items.length).toBe(2);
    expect(listBody.items[0]?.gameType).toBe(GameType.STUD_HI);
    expect(listBody.nextCursor).toBeTypeOf("string");

    const invalidCursorResponse = await app.request(
      "/api/history/hands?cursor=invalid",
      {
        headers: {
          cookie,
        },
      },
    );
    const invalidCursorBody = (await invalidCursorResponse.json()) as {
      error: { code: string };
    };
    expect(invalidCursorResponse.status).toBe(400);
    expect(invalidCursorBody.error.code).toBe(ErrorCode.INVALID_CURSOR);

    const detailResponse = await app.request(
      "/api/history/hands/d1b2c3d4-0002-4000-8000-000000000002",
      {
        headers: {
          cookie,
        },
      },
    );
    const detailBody = (await detailResponse.json()) as {
      handId: string;
      streetActions: unknown[];
      showdown: { hasShowdown: boolean };
      profitLoss: number;
    };
    expect(detailResponse.status).toBe(200);
    expect(detailBody.handId).toBe("d1b2c3d4-0002-4000-8000-000000000002");
    expect(Array.isArray(detailBody.streetActions)).toBe(true);
    expect(detailBody.showdown.hasShowdown).toBe(true);
    expect(typeof detailBody.profitLoss).toBe("number");

    const detailNotFoundResponse = await app.request(
      "/api/history/hands/aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
      {
        headers: {
          cookie,
        },
      },
    );
    const detailNotFoundBody = (await detailNotFoundResponse.json()) as {
      error: { code: string };
    };
    expect(detailNotFoundResponse.status).toBe(404);
    expect(detailNotFoundBody.error.code).toBe(ErrorCode.NOT_FOUND);
  });
});
