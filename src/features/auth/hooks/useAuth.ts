import { useContext } from "react";
import {
  AuthContext,
  type AuthContextValue,
} from "../context/auth-context";

export function useAuth(): AuthContextValue {
  const context = useContext(AuthContext);

  if (context === null) {
    throw new Error("useAuth debe utilizarse dentro de AuthProvider");
  }

  return context;
}
