export type GoogleOAuthExchangeConfig = {
  clientId: string;
  clientSecret: string;
  redirectUri: string;
  tokenEndpoint: string;
  userInfoEndpoint: string;
};

export type GoogleOAuthUserProfile = {
  googleSub: string;
  displayName: string;
};

export interface GoogleOAuthClient {
  exchangeCodeForUser(params: {
    code: string;
    config: GoogleOAuthExchangeConfig;
  }): Promise<GoogleOAuthUserProfile>;
}

const FALLBACK_DISPLAY_NAME_PREFIX = "GoogleUser-";
const AUTHORIZATION_CODE_GRANT_TYPE = "authorization_code";

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null;

const getStringField = (
  payload: Record<string, unknown>,
  fieldName: string,
): string | null => {
  const value = payload[fieldName];
  if (typeof value !== "string") {
    return null;
  }

  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
};

const createOAuthError = (params: {
  step: string;
  status: number;
  body: string;
}) =>
  new Error(
    `Google OAuth ${params.step} failed: status=${params.status}, body=${params.body}`,
  );

export const createGoogleOAuthClient = (
  fetchImpl: typeof fetch = fetch,
): GoogleOAuthClient => {
  return {
    async exchangeCodeForUser({ code, config }) {
      const tokenRequestBody = new URLSearchParams({
        grant_type: AUTHORIZATION_CODE_GRANT_TYPE,
        code,
        client_id: config.clientId,
        client_secret: config.clientSecret,
        redirect_uri: config.redirectUri,
      });

      const tokenResponse = await fetchImpl(config.tokenEndpoint, {
        method: "POST",
        headers: {
          "Content-Type": "application/x-www-form-urlencoded",
        },
        body: tokenRequestBody,
      });

      if (!tokenResponse.ok) {
        const body = await tokenResponse.text();
        throw createOAuthError({
          step: "token exchange",
          status: tokenResponse.status,
          body,
        });
      }

      const tokenPayload = (await tokenResponse.json()) as unknown;
      if (!isRecord(tokenPayload)) {
        throw new Error("Google OAuth token response is invalid JSON object.");
      }

      const accessToken = getStringField(tokenPayload, "access_token");
      if (!accessToken) {
        throw new Error(
          "Google OAuth token response does not include access_token.",
        );
      }

      const userInfoResponse = await fetchImpl(config.userInfoEndpoint, {
        method: "GET",
        headers: {
          Authorization: `Bearer ${accessToken}`,
        },
      });

      if (!userInfoResponse.ok) {
        const body = await userInfoResponse.text();
        throw createOAuthError({
          step: "userinfo fetch",
          status: userInfoResponse.status,
          body,
        });
      }

      const userInfoPayload = (await userInfoResponse.json()) as unknown;
      if (!isRecord(userInfoPayload)) {
        throw new Error(
          "Google OAuth userinfo response is invalid JSON object.",
        );
      }

      const googleSub = getStringField(userInfoPayload, "sub");
      if (!googleSub) {
        throw new Error("Google OAuth userinfo response does not include sub.");
      }

      const displayName =
        getStringField(userInfoPayload, "name") ??
        `${FALLBACK_DISPLAY_NAME_PREFIX}${googleSub.slice(0, 8)}`;

      return {
        googleSub,
        displayName,
      };
    },
  };
};
