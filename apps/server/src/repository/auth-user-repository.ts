import { createHash, randomUUID } from "node:crypto";
import type { SessionUser } from "../auth-session";

const DEFAULT_INITIAL_WALLET_BALANCE = 4000;
const REST_USERS_PATH = "/rest/v1/users";
const REST_WALLETS_PATH = "/rest/v1/wallets";
const PREFER_RETURN_REPRESENTATION = "return=representation";
const PREFER_IGNORE_DUPLICATES =
  "resolution=ignore-duplicates,return=representation";
const DEFAULT_DISPLAY_NAME_PREFIX = "Player-";
const DEFAULT_DISPLAY_NAME_SUFFIX_LENGTH = 6;

type FindOrCreateByGoogleSubParams = {
  googleSub: string;
  now: Date;
};

export interface AuthUserRepository {
  findOrCreateByGoogleSub(
    params: FindOrCreateByGoogleSubParams,
  ): Promise<SessionUser>;
}

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null;

const parseErrorCode = (payload: unknown): string | null => {
  if (!isRecord(payload)) {
    return null;
  }

  const code = payload.code;
  return typeof code === "string" ? code : null;
};

const isUniqueViolationError = (payload: unknown) =>
  parseErrorCode(payload) === "23505";

const toError = async (params: {
  response: Response;
  step: string;
}): Promise<Error> => {
  const responseBody = await params.response.text();
  return new Error(
    `${params.step} failed: status=${params.response.status}, body=${responseBody}`,
  );
};

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

const parseSupabaseSingleRow = (
  payload: unknown,
  stepName: string,
): Record<string, unknown> => {
  if (!Array.isArray(payload) || payload.length === 0) {
    throw new Error(`${stepName} response is empty.`);
  }

  const row = payload[0];
  if (!isRecord(row)) {
    throw new Error(`${stepName} response row is invalid.`);
  }

  return row;
};

const parseSupabaseUserRow = (payload: unknown): SupabaseUserRow => {
  const row = parseSupabaseSingleRow(payload, "Supabase users");

  const id = row.id;
  const displayName = row.display_name;
  if (typeof id !== "string" || id.length === 0) {
    throw new Error("Supabase users response does not include id.");
  }
  if (typeof displayName !== "string" || displayName.length === 0) {
    throw new Error("Supabase users response does not include display_name.");
  }

  return {
    id,
    display_name: displayName,
  };
};

const parseSupabaseWalletRow = (payload: unknown): SupabaseWalletRow => {
  const row = parseSupabaseSingleRow(payload, "Supabase wallets");

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
      const usersFindUrl = new URL(REST_USERS_PATH, options.supabaseUrl);
      usersFindUrl.searchParams.set("google_sub", `eq.${params.googleSub}`);
      usersFindUrl.searchParams.set("select", "id,display_name");
      usersFindUrl.searchParams.set("limit", "1");

      const findUserResponse = await fetchImpl(usersFindUrl, {
        method: "GET",
        headers: {
          apikey: options.serviceRoleKey,
          Authorization: authorizationHeaderValue,
        },
      });

      if (!findUserResponse.ok) {
        throw await toError({
          response: findUserResponse,
          step: "Supabase users select by google_sub",
        });
      }

      const findUserPayload = (await findUserResponse.json()) as unknown;
      let user: SupabaseUserRow;

      if (Array.isArray(findUserPayload) && findUserPayload.length > 0) {
        user = parseSupabaseUserRow(findUserPayload);
      } else {
        const createUserUrl = new URL(REST_USERS_PATH, options.supabaseUrl);
        createUserUrl.searchParams.set("select", "id,display_name");

        const createUserResponse = await fetchImpl(createUserUrl, {
          method: "POST",
          headers: {
            apikey: options.serviceRoleKey,
            Authorization: authorizationHeaderValue,
            "Content-Type": "application/json",
            Prefer: PREFER_RETURN_REPRESENTATION,
          },
          body: JSON.stringify([
            {
              google_sub: params.googleSub,
              display_name: buildDefaultDisplayName(params.googleSub),
            },
          ]),
        });

        if (!createUserResponse.ok) {
          const createUserErrorBody = await createUserResponse.json();
          if (
            createUserResponse.status === 409 ||
            isUniqueViolationError(createUserErrorBody)
          ) {
            const retryFindUserResponse = await fetchImpl(usersFindUrl, {
              method: "GET",
              headers: {
                apikey: options.serviceRoleKey,
                Authorization: authorizationHeaderValue,
              },
            });

            if (!retryFindUserResponse.ok) {
              throw await toError({
                response: retryFindUserResponse,
                step: "Supabase users retry select by google_sub",
              });
            }

            user = parseSupabaseUserRow(await retryFindUserResponse.json());
          } else {
            throw new Error(
              `Supabase users insert failed: status=${createUserResponse.status}, body=${JSON.stringify(createUserErrorBody)}`,
            );
          }
        } else {
          user = parseSupabaseUserRow(await createUserResponse.json());
        }
      }

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
