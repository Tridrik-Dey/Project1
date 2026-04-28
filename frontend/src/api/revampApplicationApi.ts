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

const BASE = "/api/v2/applications";

export function createRevampApplicationDraft(
  payload: CreateRevampApplicationDraftRequest,
  token: string
): Promise<RevampApplicationSummary> {
  return apiRequest<RevampApplicationSummary>(
    BASE,
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
  return apiRequest<RevampApplicationSummary>(`${BASE}/${applicationId}`, {}, token);
}

export function getMyLatestRevampApplication(
  token: string
): Promise<RevampApplicationSummary | null> {
  return apiRequest<RevampApplicationSummary | null>(`${BASE}/me/latest`, {}, token);
}

export function getRevampApplicationSections(
  applicationId: string,
  token: string
): Promise<RevampSectionSnapshot[]> {
  return apiRequest<RevampSectionSnapshot[]>(`${BASE}/${applicationId}/sections`, {}, token);
}

export function saveRevampApplicationSection(
  applicationId: string,
  sectionKey: string,
  payloadJson: string,
  completed: boolean,
  token: string
): Promise<RevampSectionSnapshot> {
  return apiRequest<RevampSectionSnapshot>(
    `${BASE}/${applicationId}/sections/${encodeURIComponent(sectionKey)}`,
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
  return apiRequest<RevampApplicationSummary>(
    `${BASE}/${applicationId}/submit`,
    { method: "POST" },
    token
  );
}

export function sendDeclarationOtpChallenge(
  applicationId: string,
  token: string
): Promise<OtpChallengeDispatchResponse> {
  return apiRequest<OtpChallengeDispatchResponse>(
    "/api/v2/otp-challenges/declaration/send",
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
  return apiRequest<OtpChallengeVerifyResponse>(
    "/api/v2/otp-challenges/declaration/verify",
    {
      method: "POST",
      body: JSON.stringify({ challengeId, otpCode })
    },
    token
  );
}
