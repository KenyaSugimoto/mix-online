import { randomUUID } from "node:crypto";

export type SessionUser = {
  userId: string;
  displayName: string;
  walletBalance: number;
};

export type SessionRecord = {
  sessionId: string;
  user: SessionUser;
  expiresAt: Date;
};

export interface SessionStore {
  create(user: SessionUser, now: Date): SessionRecord;
  findById(sessionId: string, now: Date): SessionRecord | null;
  delete(sessionId: string): void;
}

const SESSION_COOKIE_NAME = "session";
const OAUTH_STATE_COOKIE_NAME = "oauth_state";
const SESSION_TTL_MS = 1000 * 60 * 60 * 24 * 7;
const OAUTH_STATE_TTL_SECONDS = 60 * 10;

const parseCookieHeader = (
  cookieHeader: string | undefined,
): Record<string, string> => {
  if (!cookieHeader) {
    return {};
  }

  return cookieHeader
    .split(";")
    .map((part) => part.trim())
    .filter((part) => part.length > 0)
    .reduce<Record<string, string>>((acc, part) => {
      const separatorIndex = part.indexOf("=");

      if (separatorIndex <= 0) {
        return acc;
      }

      const key = part.slice(0, separatorIndex).trim();
      const value = part.slice(separatorIndex + 1).trim();
      acc[key] = decodeURIComponent(value);
      return acc;
    }, {});
};

const serializeCookie = (params: {
  name: string;
  value: string;
  maxAgeSeconds?: number;
}) => {
  const attributes = [
    `${params.name}=${encodeURIComponent(params.value)}`,
    "Path=/",
    "HttpOnly",
    "SameSite=Lax",
  ];

  if (typeof params.maxAgeSeconds === "number") {
    attributes.push(`Max-Age=${params.maxAgeSeconds}`);
  }

  return attributes.join("; ");
};

export const createSessionCookie = (sessionId: string) =>
  serializeCookie({
    name: SESSION_COOKIE_NAME,
    value: sessionId,
    maxAgeSeconds: SESSION_TTL_MS / 1000,
  });

export const clearSessionCookie = () =>
  serializeCookie({
    name: SESSION_COOKIE_NAME,
    value: "",
    maxAgeSeconds: 0,
  });

export const createOauthStateCookie = (state: string) =>
  serializeCookie({
    name: OAUTH_STATE_COOKIE_NAME,
    value: state,
    maxAgeSeconds: OAUTH_STATE_TTL_SECONDS,
  });

export const clearOauthStateCookie = () =>
  serializeCookie({
    name: OAUTH_STATE_COOKIE_NAME,
    value: "",
    maxAgeSeconds: 0,
  });

export const getCookieValue = (
  cookieHeader: string | undefined,
  cookieName: string,
): string | null => {
  const parsed = parseCookieHeader(cookieHeader);
  return parsed[cookieName] ?? null;
};

export const getSessionIdFromCookie = (
  cookieHeader: string | undefined,
): string | null => getCookieValue(cookieHeader, SESSION_COOKIE_NAME);

export const getOauthStateFromCookie = (
  cookieHeader: string | undefined,
): string | null => getCookieValue(cookieHeader, OAUTH_STATE_COOKIE_NAME);

export const createInMemorySessionStore = (): SessionStore => {
  const sessions = new Map<string, SessionRecord>();

  return {
    create(user, now) {
      const session: SessionRecord = {
        sessionId: randomUUID(),
        user,
        expiresAt: new Date(now.getTime() + SESSION_TTL_MS),
      };
      sessions.set(session.sessionId, session);
      return session;
    },
    findById(sessionId, now) {
      const session = sessions.get(sessionId);

      if (!session) {
        return null;
      }

      if (session.expiresAt.getTime() <= now.getTime()) {
        sessions.delete(sessionId);
        return null;
      }

      return session;
    },
    delete(sessionId) {
      sessions.delete(sessionId);
    },
  };
};
