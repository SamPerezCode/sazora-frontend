import type { z } from "zod";
import type { ApiSuccess } from "../../../types/api";
import type {
  currentSessionSchema,
  loginDataSchema,
  loginSchema,
  roleSchema,
} from "../schemas/auth.schema";

export type RoleCode = z.infer<typeof roleSchema>;
export type LoginRequest = z.infer<typeof loginSchema>;
export type LoginData = z.infer<typeof loginDataSchema>;
export type CurrentSession = z.infer<typeof currentSessionSchema>;

export type LoginResponse = ApiSuccess<LoginData>;

export type SessionResponse = ApiSuccess<{
  session: CurrentSession;
}>;

export type AuthSession = LoginData & {
  authorization: CurrentSession;
};

export type LoginFieldErrors = Partial<
  Record<keyof LoginRequest, string>
>;

export type AuthState =
  | { status: "checking" }
  | { status: "guest" }
  | { status: "authenticated"; session: AuthSession }
  | { status: "unavailable"; message: string };
