import type { InviteTokenLookupResponse } from "../types/api";
import { resolveApiPath } from "./pathResolver";
import { apiRequest } from "./http";

export function getInviteByToken(token: string): Promise<InviteTokenLookupResponse> {
  const basePath = resolveApiPath({
    legacyPath: "/api/invites",
    revampPath: "/api/v2/invites",
    feature: "newWizardAb"
  });
  return apiRequest<InviteTokenLookupResponse>(`${basePath}/token/${encodeURIComponent(token)}`);
}

