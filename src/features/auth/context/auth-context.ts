import { createContext } from "react";
import type {
  AuthState,
  LoginRequest,
  RoleChoice,
} from "../types/auth.types";

export interface AuthContextValue {
  state: AuthState;
  login: (input: LoginRequest, signal?: AbortSignal) => Promise<void>;
  selectRole: (choice: RoleChoice) => Promise<void>;
  cancelRoleSelection: () => void;
  logout: () => void;
  retrySession: () => void;
  refreshSession: () => Promise<void>;
  refreshingSession: boolean;
  sessionRefreshMessage: string;
}

export const AuthContext = createContext<AuthContextValue | null>(
  null
);
