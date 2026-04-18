const AUTH_KEY = "supplier_platform_auth";

export interface AuthState {
  token: string;
  userId: string;
  email: string;
  fullName: string;
  role: "SUPPLIER" | "ADMIN";
}

export function loadAuthState(): AuthState | null {
  const raw = localStorage.getItem(AUTH_KEY);
  if (!raw) return null;

  try {
    return JSON.parse(raw) as AuthState;
  } catch {
    localStorage.removeItem(AUTH_KEY);
    return null;
  }
}

export function saveAuthState(state: AuthState): void {
  localStorage.setItem(AUTH_KEY, JSON.stringify(state));
}

export function clearAuthState(): void {
  localStorage.removeItem(AUTH_KEY);
}
