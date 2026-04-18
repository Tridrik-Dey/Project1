import { apiRequest } from "./http";
import { resolveApiPath } from "./pathResolver";

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
  evaluationId: string;
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

function evaluationPath(path: string): string {
  return resolveApiPath({
    feature: "evaluationV2",
    legacyPath: `/api/evaluations${path}`,
    revampPath: `/api/v2/evaluations${path}`
  });
}

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
  return apiRequest<AdminEvaluationOverview>(evaluationPath(`/overview?${query.toString()}`), {}, token);
}

export function getAdminEvaluationAnalytics(
  supplierId: string,
  token: string
): Promise<AdminEvaluationAnalytics> {
  return apiRequest<AdminEvaluationAnalytics>(evaluationPath(`/${encodeURIComponent(supplierId)}/analytics`), {}, token);
}

export function createAdminEvaluation(
  payload: CreateAdminEvaluationPayload,
  token: string
): Promise<AdminEvaluationSummary> {
  return apiRequest<AdminEvaluationSummary>(evaluationPath(""), {
    method: "POST",
    body: JSON.stringify(payload)
  }, token);
}

export function getAdminEvaluationList(
  supplierId: string,
  token: string
): Promise<AdminEvaluationSummary[]> {
  return apiRequest<AdminEvaluationSummary[]>(evaluationPath(`?supplierId=${encodeURIComponent(supplierId)}`), {}, token);
}

export function getAdminEvaluationSummary(
  supplierId: string,
  token: string
): Promise<AdminEvaluationAggregate> {
  return apiRequest<AdminEvaluationAggregate>(evaluationPath(`/summary?supplierId=${encodeURIComponent(supplierId)}`), {}, token);
}

export function annulAdminEvaluation(
  evaluationId: string,
  token: string
): Promise<AdminEvaluationSummary> {
  return apiRequest<AdminEvaluationSummary>(evaluationPath(`/${encodeURIComponent(evaluationId)}/annul`), { method: "POST" }, token);
}
