import { apiBinaryRequest, apiRequest } from "./http";
import { resolveApiPath } from "./pathResolver";

export interface AdminReportKpis {
  totalSuppliers: number;
  activeSuppliers: number;
  pendingSuppliers: number;
  submittedApplications: number;
  pendingInvites: number;
}

export function getAdminReportKpis(token: string): Promise<AdminReportKpis> {
  const path = resolveApiPath({
    feature: "adminV2",
    legacyPath: "/api/reports/kpis",
    revampPath: "/api/v2/reports/kpis"
  });
  return apiRequest<AdminReportKpis>(path, {}, token);
}

export function exportAdminKpisReport(token: string): Promise<{ blob: Blob; filename: string }> {
  const path = resolveApiPath({
    feature: "adminV2",
    legacyPath: "/api/reports/export?type=kpis",
    revampPath: "/api/v2/reports/export?type=kpis"
  });
  return apiBinaryRequest(path, { method: "GET" }, token);
}

export interface AdminSearchExportParams {
  q?: string;
  fields?: string[];
}

export function exportAdminSearchReport(
  token: string,
  params: AdminSearchExportParams = {}
): Promise<{ blob: Blob; filename: string }> {
  const query = new URLSearchParams();
  query.set("type", "search");
  if (params.q) {
    query.set("q", params.q);
  }
  if (params.fields?.length) {
    params.fields.forEach((field) => query.append("fields", field));
  }
  const path = resolveApiPath({
    feature: "adminV2",
    legacyPath: `/api/reports/export?${query.toString()}`,
    revampPath: `/api/v2/reports/export?${query.toString()}`
  });
  return apiBinaryRequest(path, { method: "GET" }, token);
}
