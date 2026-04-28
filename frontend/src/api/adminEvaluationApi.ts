import { apiRequest } from "./http";

export interface AdminEvaluationSummary {
  id: string;
  supplierRegistryProfileId: string;
  evaluatorUserId: string;
  overallScore: number;
  annulled: boolean;
  createdAt: string;
}

export interface AdminEvaluationAggregate {
  supplierRegistryProfileId: string;
  totalEvaluations: number;
  activeEvaluations: number;
  averageOverallScore: number;
}

export interface AdminEvaluationOverviewRow {
  evaluationId: string | null;
  supplierRegistryProfileId: string;
  supplierName: string | null;
  supplierType: string | null;
  createdAt: string;
  collaborationType: string | null;
  collaborationPeriod: string | null;
  referenceCode: string | null;
  comment: string | null;
  evaluatorDisplay: string | null;
  averageScore: number;
  dimensionScores: Record<string, number>;
}

export interface AdminEvaluationOverview {
  totalEvaluations: number;
  averageOverallScore: number;
  currentMonthEvaluations: number;
  evaluatedSuppliers: number;
  rows: AdminEvaluationOverviewRow[];
}

export interface AdminEvaluationHistoryItem {
  evaluationId: string;
  createdAt: string;
  collaborationType: string | null;
  collaborationPeriod: string | null;
  referenceCode: string | null;
  comment: string | null;
  averageScore: number;
  dimensionScores: Record<string, number>;
  evaluatorAlias: string;
}

export interface AdminEvaluationAnalytics {
  supplierRegistryProfileId: string;
  supplierName: string | null;
  supplierType: string | null;
  totalEvaluations: number;
  averageOverallScore: number;
  dimensionAverages: Record<string, number>;
  scoreDistribution: Record<string, number>;
  history: AdminEvaluationHistoryItem[];
}

export type EvaluationAdminRole = "SUPER_ADMIN" | "RESPONSABILE_ALBO" | "REVISORE" | "VIEWER";
export type EvaluationAssignmentStatus =
  | "DA_ASSEGNARE"
  | "ASSEGNATA"
  | "IN_COMPILAZIONE"
  | "COMPLETATA"
  | "SCADUTA"
  | "RIASSEGNATA"
  | "ANNULLATA";

export interface AdminEvaluationAssignment {
  assignmentId: string | null;
  supplierRegistryProfileId: string;
  assignedEvaluatorUserId: string | null;
  assignedEvaluatorName: string | null;
  assignedEvaluatorEmail: string | null;
  assignedEvaluatorRole: EvaluationAdminRole | null;
  assignedByUserId: string | null;
  assignedByName: string | null;
  assignedAt: string | null;
  dueAt: string | null;
  status: EvaluationAssignmentStatus;
  completedEvaluationId: string | null;
  active: boolean;
}

export interface AdminEvaluationAssignmentRow extends AdminEvaluationAssignment {
  supplierName: string | null;
  supplierType: string | null;
  assignedEvaluatorUserId: string | null;
  status: EvaluationAssignmentStatus;
  reason: string | null;
  reassignmentReason: string | null;
  draftOverallScore: number | null;
  draftDimensions: Record<string, number>;
  draftCollaborationType: string | null;
  draftCollaborationPeriod: string | null;
  draftReferenceCode: string | null;
  draftComment: string | null;
}

export interface AdminEligibleEvaluator {
  userId: string;
  fullName: string;
  email: string;
  adminRole: EvaluationAdminRole;
}

export interface AdminEvaluationOverviewFilters {
  q?: string;
  type?: string;
  period?: string;
  minScore?: number;
  evaluator?: string;
  limit?: number;
}

export interface CreateAdminEvaluationPayload {
  supplierRegistryProfileId: string;
  collaborationType: string;
  collaborationPeriod: string;
  referenceCode?: string;
  overallScore: number;
  comment?: string;
  dimensions?: Record<string, number>;
}

const BASE = "/api/v2/evaluations";

export function getAdminEvaluationOverview(
  token: string,
  filters: AdminEvaluationOverviewFilters = {}
): Promise<AdminEvaluationOverview> {
  const query = new URLSearchParams();
  if (filters.q) query.set("q", filters.q);
  if (filters.type) query.set("type", filters.type);
  if (filters.period) query.set("period", filters.period);
  if (typeof filters.minScore === "number" && Number.isFinite(filters.minScore)) query.set("minScore", String(filters.minScore));
  if (filters.evaluator) query.set("evaluator", filters.evaluator);
  query.set("limit", String(filters.limit ?? 200));
  return apiRequest<AdminEvaluationOverview>(`${BASE}/overview?${query.toString()}`, {}, token);
}

export function getAdminEvaluationAnalytics(
  supplierId: string,
  token: string
): Promise<AdminEvaluationAnalytics> {
  return apiRequest<AdminEvaluationAnalytics>(`${BASE}/${encodeURIComponent(supplierId)}/analytics`, {}, token);
}

export function createAdminEvaluation(
  payload: CreateAdminEvaluationPayload,
  token: string
): Promise<AdminEvaluationSummary> {
  return apiRequest<AdminEvaluationSummary>(BASE, {
    method: "POST",
    body: JSON.stringify(payload)
  }, token);
}

export interface SaveAdminEvaluationDraftPayload {
  overallScore?: number;
  dimensions?: Record<string, number>;
  collaborationType?: string;
  collaborationPeriod?: string;
  referenceCode?: string;
  comment?: string;
}

export function getAdminEvaluationAssignment(
  supplierId: string,
  token: string
): Promise<AdminEvaluationAssignment | null> {
  return apiRequest<AdminEvaluationAssignment | null>(`${BASE}/assignments?supplierId=${encodeURIComponent(supplierId)}`, {}, token);
}

export function getAdminEvaluationAssignments(
  token: string,
  scope = "ALL"
): Promise<AdminEvaluationAssignmentRow[]> {
  return apiRequest<AdminEvaluationAssignmentRow[]>(`${BASE}/assignments?scope=${encodeURIComponent(scope)}`, {}, token);
}

export function getAdminEligibleEvaluators(
  token: string
): Promise<AdminEligibleEvaluator[]> {
  return apiRequest<AdminEligibleEvaluator[]>(`${BASE}/eligible-evaluators`, {}, token);
}

export function assignAdminEvaluationEvaluator(
  supplierId: string,
  evaluatorUserId: string,
  token: string,
  reason?: string,
  dueAt?: string
): Promise<AdminEvaluationAssignment> {
  return apiRequest<AdminEvaluationAssignment>(`${BASE}/assignments/${encodeURIComponent(supplierId)}`, {
    method: "POST",
    body: JSON.stringify({ evaluatorUserId, reason, dueAt })
  }, token);
}

export function reassignAdminEvaluationEvaluator(
  assignmentId: string,
  evaluatorUserId: string,
  token: string,
  reason: string,
  dueAt?: string
): Promise<AdminEvaluationAssignment> {
  return apiRequest<AdminEvaluationAssignment>(`${BASE}/assignments/${encodeURIComponent(assignmentId)}/reassign`, {
    method: "PUT",
    body: JSON.stringify({ evaluatorUserId, reason, dueAt })
  }, token);
}

export function saveAdminEvaluationDraft(
  assignmentId: string,
  token: string,
  payload: SaveAdminEvaluationDraftPayload
): Promise<AdminEvaluationAssignment> {
  return apiRequest<AdminEvaluationAssignment>(`${BASE}/assignments/${encodeURIComponent(assignmentId)}/draft`, {
    method: "PUT",
    body: JSON.stringify(payload)
  }, token);
}

export function submitAdminEvaluationAssignment(
  assignmentId: string,
  token: string
): Promise<AdminEvaluationSummary> {
  return apiRequest<AdminEvaluationSummary>(`${BASE}/assignments/${encodeURIComponent(assignmentId)}/submit`, {
    method: "POST"
  }, token);
}

export function getAdminEvaluationList(
  supplierId: string,
  token: string
): Promise<AdminEvaluationSummary[]> {
  return apiRequest<AdminEvaluationSummary[]>(`${BASE}?supplierId=${encodeURIComponent(supplierId)}`, {}, token);
}

export function getAdminEvaluationSummary(
  supplierId: string,
  token: string
): Promise<AdminEvaluationAggregate> {
  return apiRequest<AdminEvaluationAggregate>(`${BASE}/summary?supplierId=${encodeURIComponent(supplierId)}`, {}, token);
}

export function annulAdminEvaluation(
  evaluationId: string,
  token: string
): Promise<AdminEvaluationSummary> {
  return apiRequest<AdminEvaluationSummary>(`${BASE}/${encodeURIComponent(evaluationId)}/annul`, { method: "POST" }, token);
}
