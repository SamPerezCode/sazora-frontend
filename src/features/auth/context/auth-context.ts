import { createContext } from "react";
import type { AuthState, LoginRequest } from "../types/auth.types";

export interface AuthContextValue {
  state: AuthState;
  login: (input: LoginRequest, signal?: AbortSignal) => Promise<void>;
  logout: () => void;
  retrySession: () => void;
}

export const AuthContext = createContext<AuthContextValue | null>(
  null
);
