import { resolveApiPath } from "./pathResolver";
import { apiRequest } from "./http";
import type { AdminRegistryProfileRow } from "./adminProfilesApi";

export interface AdminProfileTimelineEvent {
  id: string;
  eventKey: string;
  actorUserId: string | null;
  actorRoles: string | null;
  reason: string | null;
  beforeStateJson: string | null;
  afterStateJson: string | null;
  metadataJson: string | null;
  occurredAt: string;
}

export interface AdminNotificationEvent {
  id: string;
  eventKey: string;
  entityType: string;
  entityId: string | null;
  recipient: string | null;
  templateKey: string | null;
  templateVersion: number | null;
  deliveryStatus: string;
  retryCount: number;
  createdAt: string;
  sentAt: string | null;
}

function profilesBasePath(): string {
  return resolveApiPath({
    feature: "adminV2",
    legacyPath: "/api/profiles",
    revampPath: "/api/v2/profiles"
  });
}

function notificationsBasePath(): string {
  return resolveApiPath({
    feature: "adminV2",
    legacyPath: "/api/notifications",
    revampPath: "/api/v2/notifications"
  });
}

export function getAdminProfile(profileId: string, token: string): Promise<AdminRegistryProfileRow> {
  return apiRequest<AdminRegistryProfileRow>(`${profilesBasePath()}/${encodeURIComponent(profileId)}`, {}, token);
}

export function getAdminProfileTimeline(profileId: string, token: string): Promise<AdminProfileTimelineEvent[]> {
  return apiRequest<AdminProfileTimelineEvent[]>(`${profilesBasePath()}/${encodeURIComponent(profileId)}/timeline`, {}, token);
}

export function suspendAdminProfile(profileId: string, token: string): Promise<AdminRegistryProfileRow> {
  return apiRequest<AdminRegistryProfileRow>(
    `${profilesBasePath()}/${encodeURIComponent(profileId)}/suspend`,
    { method: "POST" },
    token
  );
}

export function reactivateAdminProfile(profileId: string, token: string): Promise<AdminRegistryProfileRow> {
  return apiRequest<AdminRegistryProfileRow>(
    `${profilesBasePath()}/${encodeURIComponent(profileId)}/reactivate`,
    { method: "POST" },
    token
  );
}

export function getAdminProfileNotifications(profileId: string, token: string): Promise<AdminNotificationEvent[]> {
  const query = new URLSearchParams({
    entityType: "REVAMP_SUPPLIER_PROFILE",
    entityId: profileId
  }).toString();
  return apiRequest<AdminNotificationEvent[]>(
    `${notificationsBasePath()}/events?${query}`,
    {},
    token
  );
}
