import { randomUUID } from "node:crypto";
import type { SessionUser } from "../auth-session";

const DEFAULT_INITIAL_WALLET_BALANCE = 4000;
const REST_USERS_PATH = "/rest/v1/users";
const REST_WALLETS_PATH = "/rest/v1/wallets";
const PREFER_MERGE_DUPLICATES =
  "resolution=merge-duplicates,return=representation";
const PREFER_IGNORE_DUPLICATES =
  "resolution=ignore-duplicates,return=representation";

type FindOrCreateByGoogleSubParams = {
  googleSub: string;
  displayName: string;
  now: Date;
};

export interface AuthUserRepository {
  findOrCreateByGoogleSub(
    params: FindOrCreateByGoogleSubParams,
  ): Promise<SessionUser>;
}

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null;

const toError = async (params: {
  response: Response;
  step: string;
}): Promise<Error> => {
  const responseBody = await params.response.text();
  return new Error(
    `${params.step} failed: status=${params.response.status}, body=${responseBody}`,
  );
};

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
        const updated: SessionUser = {
          ...existing,
          displayName: params.displayName,
        };
        usersByGoogleSub.set(params.googleSub, updated);
        return updated;
      }

      const created: SessionUser = {
        userId: randomUUID(),
        displayName: params.displayName,
        walletBalance: defaultInitialWalletBalance,
      };
      usersByGoogleSub.set(params.googleSub, created);
      return created;
    },
  };
};

type SupabaseAuthUserRepositoryOptions = {
  supabaseUrl: string;
  serviceRoleKey: string;
  defaultInitialWalletBalance?: number;
  fetchImpl?: typeof fetch;
};

type SupabaseUserRow = {
  id: string;
  display_name: string;
};

type SupabaseWalletRow = {
  balance: number;
};

const parseSupabaseUserRow = (payload: unknown): SupabaseUserRow => {
  if (!Array.isArray(payload) || payload.length === 0) {
    throw new Error("Supabase users upsert response is empty.");
  }

  const row = payload[0];
  if (!isRecord(row)) {
    throw new Error("Supabase users upsert response row is invalid.");
  }

  const id = row.id;
  const displayName = row.display_name;
  if (typeof id !== "string" || id.length === 0) {
    throw new Error("Supabase users upsert response does not include id.");
  }
  if (typeof displayName !== "string" || displayName.length === 0) {
    throw new Error(
      "Supabase users upsert response does not include display_name.",
    );
  }

  return {
    id,
    display_name: displayName,
  };
};

const parseSupabaseWalletRow = (payload: unknown): SupabaseWalletRow => {
  if (!Array.isArray(payload) || payload.length === 0) {
    throw new Error("Supabase wallets select response is empty.");
  }

  const row = payload[0];
  if (!isRecord(row)) {
    throw new Error("Supabase wallets select response row is invalid.");
  }

  const balance = row.balance;
  if (typeof balance !== "number") {
    throw new Error(
      "Supabase wallets select response does not include balance.",
    );
  }

  return {
    balance,
  };
};

export const createSupabaseAuthUserRepository = (
  options: SupabaseAuthUserRepositoryOptions,
): AuthUserRepository => {
  const fetchImpl = options.fetchImpl ?? fetch;
  const defaultInitialWalletBalance =
    options.defaultInitialWalletBalance ?? DEFAULT_INITIAL_WALLET_BALANCE;
  const authorizationHeaderValue = `Bearer ${options.serviceRoleKey}`;

  return {
    async findOrCreateByGoogleSub(params) {
      const usersUrl = new URL(REST_USERS_PATH, options.supabaseUrl);
      usersUrl.searchParams.set("on_conflict", "google_sub");
      usersUrl.searchParams.set("select", "id,display_name");

      const upsertUserResponse = await fetchImpl(usersUrl, {
        method: "POST",
        headers: {
          apikey: options.serviceRoleKey,
          Authorization: authorizationHeaderValue,
          "Content-Type": "application/json",
          Prefer: PREFER_MERGE_DUPLICATES,
        },
        body: JSON.stringify([
          {
            google_sub: params.googleSub,
            display_name: params.displayName,
          },
        ]),
      });

      if (!upsertUserResponse.ok) {
        throw await toError({
          response: upsertUserResponse,
          step: "Supabase users upsert",
        });
      }

      const user = parseSupabaseUserRow(await upsertUserResponse.json());

      const walletsUpsertUrl = new URL(REST_WALLETS_PATH, options.supabaseUrl);
      walletsUpsertUrl.searchParams.set("on_conflict", "user_id");
      walletsUpsertUrl.searchParams.set("select", "user_id,balance");

      const upsertWalletResponse = await fetchImpl(walletsUpsertUrl, {
        method: "POST",
        headers: {
          apikey: options.serviceRoleKey,
          Authorization: authorizationHeaderValue,
          "Content-Type": "application/json",
          Prefer: PREFER_IGNORE_DUPLICATES,
        },
        body: JSON.stringify([
          {
            user_id: user.id,
            balance: defaultInitialWalletBalance,
          },
        ]),
      });

      if (!upsertWalletResponse.ok) {
        throw await toError({
          response: upsertWalletResponse,
          step: "Supabase wallets upsert",
        });
      }

      const walletsSelectUrl = new URL(REST_WALLETS_PATH, options.supabaseUrl);
      walletsSelectUrl.searchParams.set("user_id", `eq.${user.id}`);
      walletsSelectUrl.searchParams.set("select", "balance");
      walletsSelectUrl.searchParams.set("limit", "1");

      const selectWalletResponse = await fetchImpl(walletsSelectUrl, {
        method: "GET",
        headers: {
          apikey: options.serviceRoleKey,
          Authorization: authorizationHeaderValue,
        },
      });

      if (!selectWalletResponse.ok) {
        throw await toError({
          response: selectWalletResponse,
          step: "Supabase wallets select",
        });
      }

      const wallet = parseSupabaseWalletRow(await selectWalletResponse.json());

      return {
        userId: user.id,
        displayName: user.display_name,
        walletBalance: wallet.balance,
      };
    },
  };
};
