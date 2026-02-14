import { RealtimeTableCommandType } from "@mix-online/shared";
import { describe, expect, it } from "vitest";
import { createApp } from "../../app";
import type { SessionUser } from "../../auth-session";
import { createRealtimeTableService } from "../../realtime/table-service";

const NOW = new Date("2026-02-11T12:00:00.000Z");
const TABLE_ID = "a1b2c3d4-0001-4000-8000-000000000001";
const DEFAULT_REQUEST_ID = "11111111-1111-4111-8111-111111111111";

const createUser = (index: number, walletBalance = 4000): SessionUser => ({
  userId: `00000000-0000-4000-8000-${index.toString().padStart(12, "0")}`,
  displayName: `U${index}`,
  walletBalance,
});

describe("E2E ハッピーパス", () => {
  it("HP-01 最小導線としてロビー一覧取得が成功する", async () => {
    const app = createApp();
    const response = await app.request("/api/lobby/tables");
    const body = (await response.json()) as {
      tables: unknown[];
      serverTime: string;
    };

    expect(response.status).toBe(200);
    expect(body.tables).toHaveLength(2);
    expect(body.serverTime).toMatch(
      /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{1,3})?Z$/,
    );
  });

  it("HP-09 table.resume で差分イベントを連番再送する", async () => {
    const service = createRealtimeTableService();

    await service.executeCommand({
      command: {
        type: RealtimeTableCommandType.JOIN,
        requestId: DEFAULT_REQUEST_ID,
        sentAt: NOW.toISOString(),
        payload: { tableId: TABLE_ID, buyIn: 1000 },
      },
      user: createUser(1),
      occurredAt: NOW,
    });
    await service.executeCommand({
      command: {
        type: RealtimeTableCommandType.JOIN,
        requestId: "11111111-1111-4111-8111-111111111112",
        sentAt: NOW.toISOString(),
        payload: { tableId: TABLE_ID, buyIn: 1000 },
      },
      user: createUser(2),
      occurredAt: NOW,
    });

    const resumed = await service.resumeFrom({
      tableId: TABLE_ID,
      lastTableSeq: 2,
      occurredAt: NOW,
    });

    expect(resumed.kind).toBe("events");
    if (resumed.kind !== "events") {
      return;
    }
    expect(resumed.events.map((event) => event.tableSeq)).toEqual([3, 4, 5, 6]);
  });
});
