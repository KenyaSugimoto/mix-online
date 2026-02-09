import { serve } from "@hono/node-server";
import type { GameType } from "@mix-online/shared";
import { Hono } from "hono";
import { cors } from "hono/cors";

const app = new Hono();

// CORS設定
app.use("/*", cors());

// Health check
app.get("/", (c) => {
  return c.json({ message: "Hello Mix Stud Online!" });
});

// API routes
app.get("/api/health", (c) => {
  return c.json({ status: "ok" });
});

// ロビー API (仮実装)
app.get("/api/lobby/tables", (c) => {
  const tables = [
    {
      tableId: "table-1",
      tableName: "Table 1",
      stakes: "$20/$40 Fixed Limit",
      players: 0,
      maxPlayers: 6,
      gameType: "STUD_HI" as GameType,
      emptySeats: 6,
    },
    {
      tableId: "table-2",
      tableName: "Table 2",
      stakes: "$20/$40 Fixed Limit",
      players: 0,
      maxPlayers: 6,
      gameType: "STUD_HI" as GameType,
      emptySeats: 6,
    },
  ];
  return c.json({ tables });
});

const port = 3000;
console.log(`Server is running on http://localhost:${port}`);

serve({
  fetch: app.fetch,
  port,
});
