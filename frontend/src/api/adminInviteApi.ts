import type { AdminInviteMonitorResponse, AdminInviteResponse } from "../types/api";
import { resolveApiPath } from "./pathResolver";
import { apiRequest } from "./http";

export interface CreateAdminInvitePayload {
  registryType: "ALBO_A" | "ALBO_B";
  invitedEmail: string;
  invitedName?: string;
  expiresInDays?: number;
  note?: string;
}

export interface RenewAdminInvitePayload {
  expiresInDays?: number;
}

function invitesBasePath(): string {
  return resolveApiPath({
    feature: "adminV2",
    legacyPath: "/api/invites",
    revampPath: "/api/v2/invites"
  });
}

export function createAdminInvite(
  payload: CreateAdminInvitePayload,
  token: string
): Promise<AdminInviteResponse> {
  const path = invitesBasePath();
  return apiRequest<AdminInviteResponse>(
    path,
    {
      method: "POST",
      body: JSON.stringify(payload)
    },
    token
  );
}

export function getAdminInviteMonitor(token: string): Promise<AdminInviteMonitorResponse> {
  return apiRequest<AdminInviteMonitorResponse>(invitesBasePath(), {}, token);
}

export function renewAdminInvite(
  inviteId: string,
  token: string,
  payload: RenewAdminInvitePayload = {}
): Promise<AdminInviteResponse> {
  return apiRequest<AdminInviteResponse>(
    `${invitesBasePath()}/${inviteId}/renew`,
    {
      method: "POST",
      body: JSON.stringify(payload)
    },
    token
  );
}
