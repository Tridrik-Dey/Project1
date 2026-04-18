export type RevampApplicationSession = {
  applicationId: string;
  status?: string;
  protocolCode?: string | null;
  updatedAt?: string;
  resumePath?: string;
};

const STORAGE_KEY = "revamp_application_session";

export function saveRevampApplicationSession(session: RevampApplicationSession): void {
  if (typeof window === "undefined") return;
  window.sessionStorage.setItem(STORAGE_KEY, JSON.stringify(session));
}

export function loadRevampApplicationSession(): RevampApplicationSession | null {
  if (typeof window === "undefined") return null;
  const raw = window.sessionStorage.getItem(STORAGE_KEY);
  if (!raw) return null;
  try {
    return JSON.parse(raw) as RevampApplicationSession;
  } catch {
    return null;
  }
}

export function clearRevampApplicationSession(): void {
  if (typeof window === "undefined") return;
  window.sessionStorage.removeItem(STORAGE_KEY);
}

