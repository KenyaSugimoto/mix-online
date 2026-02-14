import { describe, expect, it, vi } from "vitest";
import {
  createInMemoryAuthUserRepository,
  createSupabaseAuthUserRepository,
  toDefaultDisplayName,
} from "../../repository/auth";

describe("auth-user-repository", () => {
  it("in-memory repository は google_sub ごとにユーザーを再利用し、表示名を上書きしない", async () => {
    const repository = createInMemoryAuthUserRepository();

    const first = await repository.findOrCreateByGoogleSub({
      googleSub: "google-sub-1",
      now: new Date("2026-02-14T12:00:00.000Z"),
    });
    const second = await repository.findOrCreateByGoogleSub({
      googleSub: "google-sub-1",
      now: new Date("2026-02-14T12:30:00.000Z"),
    });

    expect(second.userId).toBe(first.userId);
    expect(second.displayName).toBe(toDefaultDisplayName("google-sub-1"));
    expect(second.walletBalance).toBe(4000);
  });

  it("Supabase repository は未登録ユーザー時に匿名表示名で users/wallets を作成して返す", async () => {
    const fetchMock = vi
      .fn<typeof fetch>()
      .mockResolvedValueOnce(
        new Response(JSON.stringify([]), {
          status: 200,
          headers: { "Content-Type": "application/json" },
        }),
      )
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify([
            {
              id: "user-1",
              display_name: toDefaultDisplayName("google-sub-1"),
            },
          ]),
          {
            status: 201,
            headers: { "Content-Type": "application/json" },
          },
        ),
      )
      .mockResolvedValueOnce(
        new Response(JSON.stringify([]), {
          status: 201,
          headers: { "Content-Type": "application/json" },
        }),
      )
      .mockResolvedValueOnce(
        new Response(JSON.stringify([{ balance: 4000 }]), {
          status: 200,
          headers: { "Content-Type": "application/json" },
        }),
      );
    const repository = createSupabaseAuthUserRepository({
      supabaseUrl: "http://127.0.0.1:54321",
      serviceRoleKey: "service-role-key",
      fetchImpl: fetchMock,
    });

    const user = await repository.findOrCreateByGoogleSub({
      googleSub: "google-sub-1",
      now: new Date("2026-02-14T12:00:00.000Z"),
    });

    expect(user).toEqual({
      userId: "user-1",
      displayName: toDefaultDisplayName("google-sub-1"),
      walletBalance: 4000,
    });
    expect(fetchMock).toHaveBeenCalledTimes(4);

    const usersInsertCall = fetchMock.mock.calls[1];
    expect(usersInsertCall?.[0].toString()).toContain("/rest/v1/users");
    const usersInsertCallInit = usersInsertCall?.[1] as RequestInit;
    const usersBody = JSON.parse(usersInsertCallInit.body as string) as Array<{
      google_sub: string;
      display_name: string;
    }>;
    expect(usersBody[0]).toEqual({
      google_sub: "google-sub-1",
      display_name: toDefaultDisplayName("google-sub-1"),
    });
  });
});
