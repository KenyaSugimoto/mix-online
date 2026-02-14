import type { SessionUser } from "../../auth-session";

export type FindOrCreateByGoogleSubParams = {
  googleSub: string;
  now: Date;
};

export interface AuthUserRepository {
  findOrCreateByGoogleSub(
    params: FindOrCreateByGoogleSubParams,
  ): Promise<SessionUser>;
}
