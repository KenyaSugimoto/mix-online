import type { SessionUser } from "../../auth-session";

export type FindOrCreateByGoogleSubParams = {
  googleSub: string;
  now: Date;
};

export type UpdateDisplayNameParams = {
  userId: string;
  displayName: string;
};

export interface AuthUserRepository {
  findOrCreateByGoogleSub(
    params: FindOrCreateByGoogleSubParams,
  ): Promise<SessionUser>;
  updateDisplayName(params: UpdateDisplayNameParams): Promise<SessionUser>;
}
