import { apiRequest } from "./http";
import { resolveApiPath } from "./pathResolver";

export interface AdminReviewCaseSummary {
  id: string;
  applicationId: string;
  status: string;
  decision?: string | null;
  assignedToUserId?: string | null;
  assignedToDisplayName?: string | null;
  assignedAt?: string | null;
  slaDueAt?: string | null;
  updatedAt: string;
}

export interface AdminIntegrationRequestSummary {
  id: string;
  reviewCaseId: string;
  status: string;
  dueAt: string;
  requestMessage: string;
  requestedItemsJson: unknown;
  updatedAt: string;
}

export function getAdminReviewQueue(token: string): Promise<AdminReviewCaseSummary[]> {
  const basePath = resolveApiPath({
    feature: "adminV2",
    legacyPath: "/api/reviews",
    revampPath: "/api/v2/reviews"
  });
  return apiRequest<AdminReviewCaseSummary[]>(`${basePath}/queue`, {}, token);
}

export function getAdminReviewHistory(
  applicationId: string,
  token: string
): Promise<AdminReviewCaseSummary[]> {
  const basePath = resolveApiPath({
    feature: "adminV2",
    legacyPath: "/api/reviews",
    revampPath: "/api/v2/reviews"
  });
  return apiRequest<AdminReviewCaseSummary[]>(
    `${basePath}/${encodeURIComponent(applicationId)}/history`,
    {},
    token
  );
}

export function assignAdminReviewCase(
  applicationId: string,
  token: string,
  payload?: { assignedToUserId?: string; slaDueAt?: string }
): Promise<AdminReviewCaseSummary> {
  const basePath = resolveApiPath({
    feature: "adminV2",
    legacyPath: "/api/reviews",
    revampPath: "/api/v2/reviews"
  });
  return apiRequest<AdminReviewCaseSummary>(
    `${basePath}/${encodeURIComponent(applicationId)}/assign`,
    {
      method: "POST",
      body: payload ? JSON.stringify(payload) : undefined
    },
    token
  );
}

export function requestAdminIntegration(
  reviewCaseId: string,
  token: string,
  payload: { dueAt: string; message: string; requestedItemsJson?: string }
): Promise<AdminReviewCaseSummary> {
  const basePath = resolveApiPath({
    feature: "adminV2",
    legacyPath: "/api/reviews",
    revampPath: "/api/v2/reviews"
  });
  return apiRequest<AdminReviewCaseSummary>(
    `${basePath}/${encodeURIComponent(reviewCaseId)}/integration-request`,
    {
      method: "POST",
      body: JSON.stringify(payload)
    },
    token
  );
}

export function saveAdminReviewDecision(
  reviewCaseId: string,
  token: string,
  payload: { decision: "APPROVED" | "REJECTED" | "INTEGRATION_REQUIRED"; reason?: string }
): Promise<AdminReviewCaseSummary> {
  const basePath = resolveApiPath({
    feature: "adminV2",
    legacyPath: "/api/reviews",
    revampPath: "/api/v2/reviews"
  });
  return apiRequest<AdminReviewCaseSummary>(
    `${basePath}/${encodeURIComponent(reviewCaseId)}/decision`,
    {
      method: "POST",
      body: JSON.stringify(payload)
    },
    token
  );
}

export function getLatestAdminIntegrationRequest(
  reviewCaseId: string,
  token: string
): Promise<AdminIntegrationRequestSummary | null> {
  const basePath = resolveApiPath({
    feature: "adminV2",
    legacyPath: "/api/reviews",
    revampPath: "/api/v2/reviews"
  });
  return apiRequest<AdminIntegrationRequestSummary | null>(
    `${basePath}/${encodeURIComponent(reviewCaseId)}/integration-latest`,
    {},
    token
  );
}
