import { describe, expect, it } from "vitest";
import {
  clearOauthStateCookie,
  clearSessionCookie,
  createInMemorySessionStore,
  createOauthStateCookie,
  createSessionCookie,
  getOauthStateFromCookie,
  getSessionIdFromCookie,
} from "../../auth-session";

describe("auth-session", () => {
  it("session cookie を生成・解析できる", () => {
    const cookie = createSessionCookie("session-1");
    const parsed = getSessionIdFromCookie(cookie);

    expect(cookie).toContain("session=session-1");
    expect(cookie).toContain("HttpOnly");
    expect(parsed).toBe("session-1");
  });

  it("oauth_state cookie を生成・解析できる", () => {
    const cookie = createOauthStateCookie("state-1");
    const parsed = getOauthStateFromCookie(cookie);

    expect(cookie).toContain("oauth_state=state-1");
    expect(parsed).toBe("state-1");
  });

  it("clear cookie は Max-Age=0 を持つ", () => {
    expect(clearSessionCookie()).toContain("Max-Age=0");
    expect(clearOauthStateCookie()).toContain("Max-Age=0");
  });

  it("期限切れセッションは取得時に無効化される", () => {
    const sessionStore = createInMemorySessionStore();
    const created = sessionStore.create(
      {
        userId: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
        displayName: "Tester",
        walletBalance: 1000,
      },
      new Date("2026-02-11T00:00:00.000Z"),
    );

    const activeSession = sessionStore.findById(
      created.sessionId,
      new Date("2026-02-12T00:00:00.000Z"),
    );
    expect(activeSession).not.toBeNull();

    const expiredSession = sessionStore.findById(
      created.sessionId,
      new Date("2026-02-20T00:00:00.000Z"),
    );
    expect(expiredSession).toBeNull();
  });
});
