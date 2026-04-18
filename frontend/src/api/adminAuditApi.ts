import { resolveApiPath } from "./pathResolver";
import { apiRequest } from "./http";

export interface AdminAuditEventRow {
  id: string;
  eventKey: string;
  entityType: string;
  entityId: string;
  actorUserId?: string | null;
  actorRoles?: string | null;
  requestId?: string | null;
  reason?: string | null;
  beforeStateJson?: string | null;
  afterStateJson?: string | null;
  metadataJson?: string | null;
  occurredAt: string;
}

export function getAdminAuditEvents(
  token: string,
  params?: { entityType?: string; entityId?: string; requestId?: string }
): Promise<AdminAuditEventRow[]> {
  const basePath = resolveApiPath({
    feature: "adminV2",
    legacyPath: "/api/audit",
    revampPath: "/api/v2/audit"
  });

  const searchParams = new URLSearchParams();
  if (params?.entityType) searchParams.set("entityType", params.entityType);
  if (params?.entityId) searchParams.set("entityId", params.entityId);
  if (params?.requestId) searchParams.set("requestId", params.requestId);
  const query = searchParams.toString();
  const path = query ? `${basePath}/events?${query}` : `${basePath}/events`;

  return apiRequest<AdminAuditEventRow[]>(path, {}, token);
}

