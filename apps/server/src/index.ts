import { randomUUID } from "node:crypto";
import { serve } from "@hono/node-server";
import { GameType } from "@mix-online/shared";
import { Hono } from "hono";
import { cors } from "hono/cors";
import { HttpAppError, toHttpErrorResponse } from "./error-response";
import { validateOptionalTableStatus, validateUuid } from "./validation";

type AppVariables = {
  requestId: string;
};

const app = new Hono<{ Variables: AppVariables }>();

// CORS設定
app.use("/*", cors());

// requestId を各リクエストに付与（クライアント指定が不正な場合は再採番）
app.use("/*", async (c, next) => {
  const headerRequestId = c.req.header("x-request-id");
  const requestId =
    headerRequestId && /^[0-9a-f-]{36}$/i.test(headerRequestId)
      ? headerRequestId
      : randomUUID();
  c.set("requestId", requestId);
  await next();
});

app.onError((error, c) => {
  const requestId = c.get("requestId");

  if (error instanceof HttpAppError) {
    return c.json(
      toHttpErrorResponse(error.code, requestId, error.message),
      error.status,
    );
  }

  console.error(error);
  return c.json(
    toHttpErrorResponse(
      "INTERNAL_SERVER_ERROR",
      requestId,
      "サーバー内部でエラーが発生しました。",
    ),
    500,
  );
});

app.notFound((c) => {
  return c.json(
    toHttpErrorResponse(
      "NOT_FOUND",
      c.get("requestId"),
      "対象リソースが見つかりません。",
    ),
    404,
  );
});

// Health check
app.get("/", (c) => {
  return c.json({
    message: "Hello Mix Stud Online!",
    requestId: c.get("requestId"),
  });
});

// API routes
app.get("/api/health", (c) => {
  return c.json({ status: "ok", requestId: c.get("requestId") });
});

// ロビー API (仮実装)
app.get("/api/lobby/tables", (c) => {
  const state = validateOptionalTableStatus(c.req.query("state"));

  const tables = [
    {
      tableId: "11111111-1111-4111-8111-111111111111",
      tableName: "Table 1",
      stakes: "$20/$40 Fixed Limit",
      players: 0,
      maxPlayers: 6,
      gameType: GameType.STUD_HI,
      emptySeats: 6,
      status: "WAITING",
    },
    {
      tableId: "22222222-2222-4222-8222-222222222222",
      tableName: "Table 2",
      stakes: "$20/$40 Fixed Limit",
      players: 0,
      maxPlayers: 6,
      gameType: GameType.STUD_HI,
      emptySeats: 6,
      status: "WAITING",
    },
  ];

  const filteredTables = state
    ? tables.filter((table) => table.status === state)
    : tables;

  return c.json({
    tables: filteredTables.map(({ status: _status, ...table }) => table),
    requestId: c.get("requestId"),
  });
});

app.get("/api/tables/:tableId", (c) => {
  const tableId = validateUuid(c.req.param("tableId"), "tableId");
  throw new HttpAppError(
    "NOT_FOUND",
    `tableId=${tableId} の卓は存在しません。`,
  );
});

const port = 3000;
console.log(`Server is running on http://localhost:${port}`);

serve({
  fetch: app.fetch,
  port,
});
