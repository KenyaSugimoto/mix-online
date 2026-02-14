import { describe, expect, it, vi } from "vitest";
import {
  createInMemoryAuthUserRepository,
  createSupabaseAuthUserRepository,
} from "../../repository/auth-user-repository";

describe("auth-user-repository", () => {
  it("in-memory repository は google_sub ごとにユーザーを再利用する", async () => {
    const repository = createInMemoryAuthUserRepository();

    const first = await repository.findOrCreateByGoogleSub({
      googleSub: "google-sub-1",
      displayName: "OAuth User 1",
      now: new Date("2026-02-14T12:00:00.000Z"),
    });
    const second = await repository.findOrCreateByGoogleSub({
      googleSub: "google-sub-1",
      displayName: "OAuth User 1 Updated",
      now: new Date("2026-02-14T12:30:00.000Z"),
    });

    expect(second.userId).toBe(first.userId);
    expect(second.displayName).toBe("OAuth User 1 Updated");
    expect(second.walletBalance).toBe(4000);
  });

  it("Supabase repository は users/wallets を作成または参照して返す", async () => {
    const fetchMock = vi
      .fn<typeof fetch>()
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify([{ id: "user-1", display_name: "OAuth User 1" }]),
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
      displayName: "OAuth User 1",
      now: new Date("2026-02-14T12:00:00.000Z"),
    });

    expect(user).toEqual({
      userId: "user-1",
      displayName: "OAuth User 1",
      walletBalance: 4000,
    });
    expect(fetchMock).toHaveBeenCalledTimes(3);

    const usersCall = fetchMock.mock.calls[0];
    expect(usersCall?.[0].toString()).toContain("/rest/v1/users");
    const usersCallInit = usersCall?.[1] as RequestInit;
    const usersBody = JSON.parse(usersCallInit.body as string) as Array<{
      google_sub: string;
      display_name: string;
    }>;
    expect(usersBody[0]).toEqual({
      google_sub: "google-sub-1",
      display_name: "OAuth User 1",
    });
  });
});
