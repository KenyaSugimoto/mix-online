import { createHash, randomUUID } from "node:crypto";
import type { SessionUser } from "../../auth-session";
import type { AuthUserRepository } from "./contract";

export const DEFAULT_INITIAL_WALLET_BALANCE = 4000;

const DEFAULT_DISPLAY_NAME_PREFIX = "Player-";
const DEFAULT_DISPLAY_NAME_SUFFIX_LENGTH = 6;

const buildDefaultDisplayName = (googleSub: string) => {
  const digest = createHash("sha256").update(googleSub).digest("hex");
  const suffix = digest
    .slice(0, DEFAULT_DISPLAY_NAME_SUFFIX_LENGTH)
    .toUpperCase();
  return `${DEFAULT_DISPLAY_NAME_PREFIX}${suffix}`;
};

export const toDefaultDisplayName = (googleSub: string) =>
  buildDefaultDisplayName(googleSub);

export const createInMemoryAuthUserRepository = (options?: {
  defaultInitialWalletBalance?: number;
}): AuthUserRepository => {
  const defaultInitialWalletBalance =
    options?.defaultInitialWalletBalance ?? DEFAULT_INITIAL_WALLET_BALANCE;
  const usersByGoogleSub = new Map<string, SessionUser>();

  return {
    async findOrCreateByGoogleSub(params) {
      const existing = usersByGoogleSub.get(params.googleSub);
      if (existing) {
        return existing;
      }

      const created: SessionUser = {
        userId: randomUUID(),
        displayName: buildDefaultDisplayName(params.googleSub),
        walletBalance: defaultInitialWalletBalance,
      };
      usersByGoogleSub.set(params.googleSub, created);
      return created;
    },
  };
};
