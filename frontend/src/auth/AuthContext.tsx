import { createContext, useContext, useMemo, useState } from "react";
import type { ReactNode } from "react";
import type { AuthResponse } from "../types/api";
import { clearAuthState, loadAuthState, saveAuthState, type AuthState } from "../utils/storage";
import { clearRevampEmailVerified } from "../utils/revampEmailVerification";

interface AuthContextValue {
  auth: AuthState | null;
  isAuthenticated: boolean;
  loginFromResponse: (response: AuthResponse) => void;
  logout: () => void;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [auth, setAuth] = useState<AuthState | null>(() => loadAuthState());

  const value = useMemo<AuthContextValue>(() => ({
    auth,
    isAuthenticated: Boolean(auth?.token),
    loginFromResponse: (response) => {
      const next: AuthState = {
        token: response.token,
        userId: response.userId,
        email: response.email,
        fullName: response.fullName,
        role: response.role
      };
      setAuth(next);
      saveAuthState(next);
    },
    logout: () => {
      setAuth(null);
      clearAuthState();
      clearRevampEmailVerified();
    }
  }), [auth]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) {
    throw new Error("useAuth must be used within AuthProvider");
  }
  return ctx;
}
