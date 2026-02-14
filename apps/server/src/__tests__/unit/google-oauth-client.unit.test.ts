import { describe, expect, it, vi } from "vitest";
import { createGoogleOAuthClient } from "../../google-oauth-client";

const TEST_CONFIG = {
  clientId: "client-id",
  clientSecret: "client-secret",
  redirectUri: "http://localhost:3000/api/auth/google/callback",
  tokenEndpoint: "https://oauth2.googleapis.com/token",
  userInfoEndpoint: "https://openidconnect.googleapis.com/v1/userinfo",
} as const;

describe("google-oauth-client", () => {
  it("code を token/userinfo に交換して Google ユーザー情報を返す", async () => {
    const fetchMock = vi
      .fn<typeof fetch>()
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ access_token: "access-token-1" }), {
          status: 200,
          headers: { "Content-Type": "application/json" },
        }),
      )
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({ sub: "google-sub-1", name: "OAuth User 1" }),
          {
            status: 200,
            headers: { "Content-Type": "application/json" },
          },
        ),
      );
    const client = createGoogleOAuthClient(fetchMock);

    const profile = await client.exchangeCodeForUser({
      code: "code-1",
      config: TEST_CONFIG,
    });

    expect(profile).toEqual({
      googleSub: "google-sub-1",
      displayName: "OAuth User 1",
    });
    expect(fetchMock).toHaveBeenCalledTimes(2);

    const firstCall = fetchMock.mock.calls[0];
    expect(firstCall?.[0].toString()).toBe(TEST_CONFIG.tokenEndpoint);
    const firstInit = firstCall?.[1] as RequestInit;
    const body = firstInit.body as URLSearchParams;
    expect(firstInit.method).toBe("POST");
    expect(body.get("grant_type")).toBe("authorization_code");
    expect(body.get("client_id")).toBe(TEST_CONFIG.clientId);
    expect(body.get("client_secret")).toBe(TEST_CONFIG.clientSecret);
    expect(body.get("redirect_uri")).toBe(TEST_CONFIG.redirectUri);
    expect(body.get("code")).toBe("code-1");
  });

  it("userinfo に name がない場合は sub 由来の displayName を生成する", async () => {
    const fetchMock = vi
      .fn<typeof fetch>()
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ access_token: "access-token-2" }), {
          status: 200,
          headers: { "Content-Type": "application/json" },
        }),
      )
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ sub: "google-sub-2" }), {
          status: 200,
          headers: { "Content-Type": "application/json" },
        }),
      );
    const client = createGoogleOAuthClient(fetchMock);

    const profile = await client.exchangeCodeForUser({
      code: "code-2",
      config: TEST_CONFIG,
    });

    expect(profile.googleSub).toBe("google-sub-2");
    expect(profile.displayName).toBe("GoogleUser-google-s");
  });
});
