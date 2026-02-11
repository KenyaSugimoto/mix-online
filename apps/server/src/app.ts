import { randomUUID } from "node:crypto";
import { Hono } from "hono";
import { cors } from "hono/cors";
import { HttpAppError, toHttpErrorResponse } from "./error-response";
import { toLobbyTablesResponse } from "./lobby-table";
import {
  type LobbyTableRepository,
  createMvpLobbyTableRepository,
} from "./repository/lobby-table-repository";
import {
  type TableDetailRepository,
  createMvpTableDetailRepository,
} from "./repository/table-detail-repository";
import { toTableDetailResponse } from "./table-detail";
import { resolveRequestId, validateUuid } from "./validation";

export type AppVariables = {
  requestId: string;
};

type CreateAppOptions = {
  lobbyTableRepository?: LobbyTableRepository;
  tableDetailRepository?: TableDetailRepository;
  now?: () => Date;
};

export const createApp = (options: CreateAppOptions = {}) => {
  const app = new Hono<{ Variables: AppVariables }>();
  const lobbyTableRepository =
    options.lobbyTableRepository ?? createMvpLobbyTableRepository();
  const tableDetailRepository =
    options.tableDetailRepository ?? createMvpTableDetailRepository();
  const now = options.now ?? (() => new Date());

  app.use("/*", cors());

  // requestId を各リクエストに付与（クライアント指定が不正な場合は再採番）
  app.use("/*", async (c, next) => {
    const headerRequestId = c.req.header("x-request-id");
    const requestId = resolveRequestId(headerRequestId, () => randomUUID());
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

  app.get("/api/lobby/tables", async (c) => {
    const tables = await lobbyTableRepository.listTables();

    return c.json(toLobbyTablesResponse(tables, now()));
  });

  app.get("/api/tables/:tableId", async (c) => {
    const tableId = validateUuid(c.req.param("tableId"), "tableId");
    const table = await tableDetailRepository.getById(tableId);

    if (table === null) {
      throw new HttpAppError(
        "NOT_FOUND",
        `tableId=${tableId} の卓は存在しません。`,
      );
    }

    return c.json(toTableDetailResponse(table));
  });

  return app;
};
