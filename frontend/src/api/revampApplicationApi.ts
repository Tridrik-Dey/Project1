import { resolveApiPath } from "./pathResolver";
import { apiRequest } from "./http";

export type RevampRegistryType = "ALBO_A" | "ALBO_B";
export type RevampSourceChannel = "PUBLIC" | "INVITE";

export interface CreateRevampApplicationDraftRequest {
  registryType: RevampRegistryType;
  sourceChannel: RevampSourceChannel;
  inviteId?: string;
}

export interface RevampApplicationSummary {
  id: string;
  applicantUserId: string;
  registryType: RevampRegistryType;
  sourceChannel: RevampSourceChannel;
  status: string;
  protocolCode: string | null;
  currentRevision: number;
  submittedAt: string | null;
  updatedAt: string;
}

export interface RevampSectionSnapshot {
  id: string;
  applicationId: string;
  sectionKey: string;
  sectionVersion: number;
  completed: boolean;
  payloadJson: string;
  updatedAt: string;
}

export interface OtpChallengeDispatchResponse {
  challengeId: string;
  expiresAt: string;
  status: string;
  deliveryMode: "SENT" | "SIMULATED";
  targetEmailMasked: string;
  debugCode?: string | null;
}

export interface OtpChallengeVerifyResponse {
  challengeId: string;
  verified: boolean;
  status: string;
  attempts: number;
  maxAttempts: number;
  verifiedAt: string | null;
}

export function createRevampApplicationDraft(
  payload: CreateRevampApplicationDraftRequest,
  token: string
): Promise<RevampApplicationSummary> {
  const path = resolveApiPath({
    legacyPath: "/api/applications",
    revampPath: "/api/v2/applications",
    feature: "newWizardAb"
  });

  return apiRequest<RevampApplicationSummary>(
    path,
    {
      method: "POST",
      body: JSON.stringify(payload)
    },
    token
  );
}

export function getRevampApplicationSummary(
  applicationId: string,
  token: string
): Promise<RevampApplicationSummary> {
  const basePath = resolveApiPath({
    legacyPath: "/api/applications",
    revampPath: "/api/v2/applications",
    feature: "newWizardAb"
  });

  return apiRequest<RevampApplicationSummary>(`${basePath}/${applicationId}`, {}, token);
}

export function getMyLatestRevampApplication(
  token: string
): Promise<RevampApplicationSummary | null> {
  const basePath = resolveApiPath({
    legacyPath: "/api/applications",
    revampPath: "/api/v2/applications",
    feature: "newWizardAb"
  });

  return apiRequest<RevampApplicationSummary | null>(`${basePath}/me/latest`, {}, token);
}

export function getRevampApplicationSections(
  applicationId: string,
  token: string
): Promise<RevampSectionSnapshot[]> {
  const basePath = resolveApiPath({
    legacyPath: "/api/applications",
    revampPath: "/api/v2/applications",
    feature: "newWizardAb"
  });

  return apiRequest<RevampSectionSnapshot[]>(`${basePath}/${applicationId}/sections`, {}, token);
}

export function saveRevampApplicationSection(
  applicationId: string,
  sectionKey: string,
  payloadJson: string,
  completed: boolean,
  token: string
): Promise<RevampSectionSnapshot> {
  const basePath = resolveApiPath({
    legacyPath: "/api/applications",
    revampPath: "/api/v2/applications",
    feature: "newWizardAb"
  });

  return apiRequest<RevampSectionSnapshot>(
    `${basePath}/${applicationId}/sections/${encodeURIComponent(sectionKey)}`,
    {
      method: "PUT",
      body: JSON.stringify({
        payloadJson,
        completed
      })
    },
    token
  );
}

export function submitRevampApplication(
  applicationId: string,
  token: string
): Promise<RevampApplicationSummary> {
  const basePath = resolveApiPath({
    legacyPath: "/api/applications",
    revampPath: "/api/v2/applications",
    feature: "newWizardAb"
  });

  return apiRequest<RevampApplicationSummary>(
    `${basePath}/${applicationId}/submit`,
    { method: "POST" },
    token
  );
}

export function sendDeclarationOtpChallenge(
  applicationId: string,
  token: string
): Promise<OtpChallengeDispatchResponse> {
  const path = resolveApiPath({
    legacyPath: "/api/otp-challenges/declaration/send",
    revampPath: "/api/v2/otp-challenges/declaration/send",
    feature: "newWizardAb"
  });
  return apiRequest<OtpChallengeDispatchResponse>(
    path,
    {
      method: "POST",
      body: JSON.stringify({ applicationId })
    },
    token
  );
}

export function verifyDeclarationOtpChallenge(
  challengeId: string,
  otpCode: string,
  token: string
): Promise<OtpChallengeVerifyResponse> {
  const path = resolveApiPath({
    legacyPath: "/api/otp-challenges/declaration/verify",
    revampPath: "/api/v2/otp-challenges/declaration/verify",
    feature: "newWizardAb"
  });
  return apiRequest<OtpChallengeVerifyResponse>(
    path,
    {
      method: "POST",
      body: JSON.stringify({ challengeId, otpCode })
    },
    token
  );
}
