import { FormEvent, useCallback, useEffect, useMemo, useState } from "react";
import { ArrowDownUp, ArrowLeft, Check, ClipboardList, Save, Search, Star, UserCheck, X } from "lucide-react";
import { Link, useParams } from "react-router-dom";
import type { DashboardActivityEvent } from "../../api/adminDashboardEventsApi";
import {
  assignAdminEvaluationEvaluator,
  getAdminEligibleEvaluators,
  getAdminEvaluationAnalytics,
  getAdminEvaluationAssignments,
  getAdminEvaluationOverview,
  reassignAdminEvaluationEvaluator,
  saveAdminEvaluationDraft,
  submitAdminEvaluationAssignment,
  type AdminEligibleEvaluator,
  type AdminEvaluationAnalytics,
  type AdminEvaluationAssignmentRow,
  type AdminEvaluationOverview,
  type AdminEvaluationOverviewFilters,
  type AdminEvaluationOverviewRow,
  type EvaluationAssignmentStatus
} from "../../api/adminEvaluationApi";
import { HttpError } from "../../api/http";
import { useAuth } from "../../auth/AuthContext";
import { AppToast } from "../../components/ui/toast";
import { useAdminGovernanceRole } from "../../hooks/useAdminGovernanceRole";
import { useAdminRealtimeRefresh } from "../../hooks/useAdminRealtimeRefresh";
import { AdminCandidatureShell } from "./AdminCandidatureShell";

type AdminEvaluationsPageProps = {
  mode: "search" | "detail" | "new";
};

type EvaluationTab = "VALUED" | "TO_EVALUATE";
type AssignmentScope = "ALL" | "MINE" | "UNASSIGNED" | "DUE_SOON" | "OVERDUE" | "COMPLETED";
type ValuedPanelView = "CURRENT" | "HISTORY";
type ScoreFilter = "ALL" | "HIGH" | "MID" | "LOW";
type AssignmentSort = "URGENT_FIRST" | "LATER_FIRST";
type ValuedSort = "RECENT_FIRST" | "OLDER_FIRST";

type EvaluationDraft = {
  overallScore: number;
  dimensions: Record<string, number>;
  collaborationType: string;
  collaborationPeriod: string;
  referenceCode: string;
  comment: string;
};

const EMPTY_OVERVIEW: AdminEvaluationOverview = {
  totalEvaluations: 0,
  averageOverallScore: 0,
  currentMonthEvaluations: 0,
  evaluatedSuppliers: 0,
  rows: []
};

const EMPTY_ANALYTICS: AdminEvaluationAnalytics = {
  supplierRegistryProfileId: "",
  supplierName: null,
  supplierType: null,
  totalEvaluations: 0,
  averageOverallScore: 0,
  dimensionAverages: {},
  scoreDistribution: {},
  history: []
};

const DIMENSIONS: Array<{ key: string; label: string }> = [
  { key: "quality", label: "Qualita tecnica" },
  { key: "timeliness", label: "Rispetto tempi" },
  { key: "communication", label: "Comunicazione" },
  { key: "flexibility", label: "Flessibilita" },
  { key: "value", label: "Qualita/prezzo" }
];

function shouldRefreshEvaluations(event: DashboardActivityEvent): boolean {
  const key = event.eventKey ?? "";
  return key.includes("evaluation") || key === "revamp.supplier-evaluator.assigned" || (event.entityType ?? "").includes("EVALUATION");
}

function roleLabel(value: string | null | undefined): string {
  if (value === "SUPER_ADMIN") return "Super Admin";
  if (value === "RESPONSABILE_ALBO") return "Responsabile Albo";
  if (value === "REVISORE") return "Revisore";
  if (value === "VIEWER") return "Viewer";
  return "-";
}

function typeLabel(value: string | null | undefined): string {
  if (value === "ALBO_A") return "Albo A";
  if (value === "ALBO_B") return "Albo B";
  return "-";
}

function statusLabel(value: EvaluationAssignmentStatus): string {
  if (value === "DA_ASSEGNARE") return "Da assegnare";
  if (value === "ASSEGNATA") return "Assegnata";
  if (value === "IN_COMPILAZIONE") return "In compilazione";
  if (value === "COMPLETATA") return "Completata";
  if (value === "SCADUTA") return "Scaduta";
  if (value === "RIASSEGNATA") return "Riassegnata";
  return "Annullata";
}

function assignmentStatusLabel(row: AdminEvaluationAssignmentRow): string {
  if (!row.assignmentId && row.reason === "Nuovo ciclo di valutazione") return "Nuovo ciclo";
  return statusLabel(row.status);
}

function assignmentActionLabel(row: AdminEvaluationAssignmentRow, currentUserId: string | undefined): string {
  if (row.status === "COMPLETATA") return "Apri dettagli";
  if (!row.assignmentId && row.reason === "Nuovo ciclo di valutazione") return "Assegna valutatore";
  if (row.status === "DA_ASSEGNARE") return "Assegna valutatore";
  if (row.assignedEvaluatorUserId === currentUserId) return "Compila valutazione";
  return "Apri assegnazione";
}

function assignmentTone(value: EvaluationAssignmentStatus): string {
  if (value === "SCADUTA") return "risk";
  if (value === "DA_ASSEGNARE") return "warning";
  if (value === "IN_COMPILAZIONE") return "progress";
  if (value === "COMPLETATA") return "done";
  if (value === "RIASSEGNATA") return "muted";
  return "info";
}

function dueLabel(value: string | null | undefined): string {
  if (!value) return "Nessuna scadenza";
  const parsed = Date.parse(value);
  if (!Number.isFinite(parsed)) return "Nessuna scadenza";
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const due = new Date(parsed);
  due.setHours(0, 0, 0, 0);
  const diffDays = Math.round((due.getTime() - today.getTime()) / (24 * 60 * 60 * 1000));
  if (diffDays < 0) return `Scaduta da ${Math.abs(diffDays)} g`;
  if (diffDays === 0) return "Scade oggi";
  if (diffDays === 1) return "Scade domani";
  return `Tra ${diffDays} g`;
}

function formatDate(value: string | null | undefined): string {
  if (!value) return "-";
  const parsed = Date.parse(value);
  if (!Number.isFinite(parsed)) return "-";
  return new Date(parsed).toLocaleDateString("it-IT");
}

function stars(value: number): string {
  const rounded = Math.max(0, Math.min(5, Math.round(value)));
  return `${"★".repeat(rounded)}${"☆".repeat(5 - rounded)}`;
}

function scoreLevel(value: number): string {
  if (value >= 4.5) return "Eccellente";
  if (value >= 4) return "Molto buono";
  if (value >= 3) return "Adeguato";
  return "Da monitorare";
}

function scoreTone(value: number): string {
  if (value >= 4.5) return "excellent";
  if (value >= 4) return "good";
  if (value >= 3) return "watch";
  return "risk";
}

function dimensionLabel(key: string): string {
  return DIMENSIONS.find((dimension) => dimension.key === key)?.label ?? key;
}

function dimensionScore(scores: Record<string, number> | null | undefined, key: string, label: string): number | undefined {
  if (!scores) return undefined;
  const direct = scores[key];
  if (typeof direct === "number") return direct;
  const labelValue = scores[label];
  if (typeof labelValue === "number") return labelValue;
  const normalizedLabel = label.toLowerCase().replace(/\s+/g, "").replace(/\//g, "");
  const match = Object.entries(scores).find(([scoreKey]) => scoreKey.toLowerCase().replace(/\s+/g, "").replace(/\//g, "") === normalizedLabel);
  return typeof match?.[1] === "number" ? match[1] : undefined;
}

function initials(value: string | null | undefined): string {
  const parts = (value || "Fornitore").split(" ").filter(Boolean);
  return parts.slice(0, 2).map((part) => part[0]?.toUpperCase()).join("") || "F";
}

function ReadOnlyScoreStars({ value }: { value: number }) {
  const rounded = Math.max(0, Math.min(5, Math.round(value)));
  return (
    <span className="eval-readonly-stars" aria-label={`${value.toFixed(1)} su 5`}>
      {[1, 2, 3, 4, 5].map((item) => (
        <span key={item} className={item <= rounded ? "is-on" : ""}>{item <= rounded ? "★" : "☆"}</span>
      ))}
      <strong>{value.toFixed(1)}</strong>
    </span>
  );
}

function draftFromAssignment(row: AdminEvaluationAssignmentRow | null): EvaluationDraft {
  return {
    overallScore: row?.draftOverallScore ?? 0,
    dimensions: row?.draftDimensions ?? {},
    collaborationType: row?.draftCollaborationType ?? "",
    collaborationPeriod: row?.draftCollaborationPeriod ?? "",
    referenceCode: row?.draftReferenceCode ?? "",
    comment: row?.draftComment ?? ""
  };
}

function draftProgress(draft: EvaluationDraft): { done: number; total: number; percent: number } {
  const checks = [
    ...DIMENSIONS.map((dimension) => (draft.dimensions[dimension.key] ?? 0) > 0),
    Boolean(draft.collaborationType.trim()),
    Boolean(draft.collaborationPeriod.trim())
  ];
  const done = checks.filter(Boolean).length;
  return { done, total: checks.length, percent: Math.round((done / checks.length) * 100) };
}

function averageDimensionScore(dimensions: Record<string, number>): number {
  const values = DIMENSIONS
    .map((dimension) => dimensions[dimension.key] ?? 0)
    .filter((value) => value > 0);
  if (values.length === 0) return 0;
  return Math.round((values.reduce((sum, value) => sum + value, 0) / values.length) * 10) / 10;
}

function StarInput({ value, onChange, disabled = false }: { value: number; onChange: (value: number) => void; disabled?: boolean }) {
  return (
    <div className="eval-star-input" role="group" aria-label="Valutazione a stelle">
      {[1, 2, 3, 4, 5].map((star) => (
        <button key={star} type="button" className={star <= value ? "on" : ""} onClick={() => onChange(star)} disabled={disabled}>
          {star <= value ? "★" : "☆"}
        </button>
      ))}
      <strong>{value > 0 ? `${value}/5` : "Da compilare"}</strong>
    </div>
  );
}

export function AdminEvaluationsPage({ mode }: AdminEvaluationsPageProps) {
  const { supplierId: routeSupplierId } = useParams();
  const { auth } = useAuth();
  const { adminRole } = useAdminGovernanceRole();
  const token = auth?.token ?? "";

  const [tab, setTab] = useState<EvaluationTab>("VALUED");
  const [scope, setScope] = useState<AssignmentScope>("ALL");
  const [overview, setOverview] = useState<AdminEvaluationOverview>(EMPTY_OVERVIEW);
  const [assignments, setAssignments] = useState<AdminEvaluationAssignmentRow[]>([]);
  const [eligibleEvaluators, setEligibleEvaluators] = useState<AdminEligibleEvaluator[]>([]);
  const [selectedAssignment, setSelectedAssignment] = useState<AdminEvaluationAssignmentRow | null>(null);
  const [selectedValuedRow, setSelectedValuedRow] = useState<AdminEvaluationOverviewRow | null>(null);
  const [detailAnalytics, setDetailAnalytics] = useState<AdminEvaluationAnalytics>(EMPTY_ANALYTICS);
  const [valuedPanelView, setValuedPanelView] = useState<ValuedPanelView>("CURRENT");
  const [valuedPanelHistory, setValuedPanelHistory] = useState<AdminEvaluationAnalytics>(EMPTY_ANALYTICS);
  const [draft, setDraft] = useState<EvaluationDraft>(() => draftFromAssignment(null));
  const [assignmentEvaluatorId, setAssignmentEvaluatorId] = useState("");
  const [assignmentDueAt, setAssignmentDueAt] = useState("");
  const [assignmentReason, setAssignmentReason] = useState("");
  const [assignmentEditUnlocked, setAssignmentEditUnlocked] = useState(false);
  const [filters, setFilters] = useState({ q: "", type: "", period: "", evaluator: "" });
  const [scoreFilter, setScoreFilter] = useState<ScoreFilter>("ALL");
  const [appliedFilters, setAppliedFilters] = useState<AdminEvaluationOverviewFilters>({ limit: 200 });
  const [valuedSort, setValuedSort] = useState<ValuedSort>("RECENT_FIRST");
  const [assignmentQuery, setAssignmentQuery] = useState("");
  const [assignmentSort, setAssignmentSort] = useState<AssignmentSort>("URGENT_FIRST");
  const [loading, setLoading] = useState(false);
  const [busy, setBusy] = useState<string | null>(null);
  const [toast, setToast] = useState<{ message: string; type: "error" | "success" } | null>(null);

  const canAssign = adminRole === "SUPER_ADMIN" || adminRole === "RESPONSABILE_ALBO";
  const canSuperAdminEditCompleted = adminRole === "SUPER_ADMIN";
  const isAssignedToMe = selectedAssignment?.assignedEvaluatorUserId === auth?.userId;
  const hasExistingAssignment = Boolean(selectedAssignment?.assignmentId && selectedAssignment.assignedEvaluatorUserId);
  const assignmentFieldsEditable = Boolean(!hasExistingAssignment || assignmentEditUnlocked);
  const assignmentReasonRequired = Boolean(hasExistingAssignment && assignmentEditUnlocked);
  const assignmentSaveDisabled = Boolean(
    busy === "assign"
    || !assignmentEvaluatorId
    || (assignmentReasonRequired && !assignmentReason.trim())
  );
  const canEditSelectedDraft = Boolean(
    selectedAssignment
    && selectedAssignment.assignmentId
    && selectedAssignment.status !== "COMPLETATA"
    && selectedAssignment.status !== "SCADUTA"
    && (isAssignedToMe || adminRole === "SUPER_ADMIN")
  );
  const canSubmitSelectedDraft = Boolean(
    selectedAssignment?.assignmentId
    && (isAssignedToMe || adminRole === "SUPER_ADMIN")
    && selectedAssignment.status !== "COMPLETATA"
    && selectedAssignment.status !== "SCADUTA"
  );

  const evaluatedSupplierIds = useMemo(() => new Set(
    overview.rows
      .filter((row) => row.evaluationId)
      .map((row) => row.supplierRegistryProfileId)
      .filter(Boolean)
  ), [overview.rows]);

  const activeAssignmentSupplierIds = useMemo(() => new Set(
    assignments
      .filter((row) => row.status !== "COMPLETATA")
      .map((row) => row.supplierRegistryProfileId)
      .filter(Boolean)
  ), [assignments]);

  const revaluationCount = useMemo(() => (
    Array.from(activeAssignmentSupplierIds).filter((supplierId) => evaluatedSupplierIds.has(supplierId)).length
  ), [activeAssignmentSupplierIds, evaluatedSupplierIds]);

  const valuedRows = useMemo(
    () => [...Array.from(overview.rows
      .filter((row) => row.evaluationId)
      .filter((row) => !row.supplierRegistryProfileId || !activeAssignmentSupplierIds.has(row.supplierRegistryProfileId))
      .reduce((latest, row) => {
        const key = row.supplierRegistryProfileId || row.evaluationId || row.supplierName || "";
        const current = latest.get(key);
        const rowDate = row.createdAt ? Date.parse(row.createdAt) : 0;
        const currentDate = current?.createdAt ? Date.parse(current.createdAt) : 0;
        if (!current || rowDate > currentDate) latest.set(key, row);
        return latest;
      }, new Map<string, AdminEvaluationOverviewRow>())
      .values())
      .filter((row) => {
        if (scoreFilter === "HIGH") return row.averageScore >= 4;
        if (scoreFilter === "MID") return row.averageScore >= 3 && row.averageScore < 4;
        if (scoreFilter === "LOW") return row.averageScore < 3;
        return true;
      })].sort((a, b) => {
        const aDate = a.createdAt ? Date.parse(a.createdAt) : 0;
        const bDate = b.createdAt ? Date.parse(b.createdAt) : 0;
        if (aDate !== bDate) return valuedSort === "RECENT_FIRST" ? bDate - aDate : aDate - bDate;
        return (a.supplierName || "").localeCompare(b.supplierName || "");
      }),
    [activeAssignmentSupplierIds, overview.rows, scoreFilter, valuedSort]
  );

  const filterSummary = useMemo(() => {
    const parts = [
      filters.type ? typeLabel(filters.type) : null,
      scoreFilter === "HIGH" ? "4+" : scoreFilter === "MID" ? "3-4" : scoreFilter === "LOW" ? "Sotto 3" : null,
      filters.evaluator.trim() || null,
      filters.period.trim() || null
    ].filter(Boolean);
    return parts.length ? parts.join(" · ") : "Filtri";
  }, [filters.evaluator, filters.period, filters.type, scoreFilter]);

  const assignmentCounters = useMemo(() => ({
    all: assignments.length,
    mine: assignments.filter((row) => row.assignedEvaluatorUserId === auth?.userId).length,
    unassigned: assignments.filter((row) => row.status === "DA_ASSEGNARE").length,
    dueSoon: assignments.filter((row) => row.dueAt && row.status !== "COMPLETATA" && Date.parse(row.dueAt) >= Date.now() && Date.parse(row.dueAt) <= Date.now() + 3 * 24 * 60 * 60 * 1000).length,
    overdue: assignments.filter((row) => row.status === "SCADUTA").length
  }), [assignments, auth?.userId]);

  const currentDraftProgress = useMemo(() => draftProgress(draft), [draft]);
  const computedOverallScore = useMemo(() => averageDimensionScore(draft.dimensions), [draft.dimensions]);
  const dimensionScoresComplete = useMemo(
    () => DIMENSIONS.every((dimension) => (draft.dimensions[dimension.key] ?? 0) > 0),
    [draft.dimensions]
  );

  const visibleAssignments = useMemo(() => {
    const term = assignmentQuery.trim().toLowerCase();
    const scoped = assignments
    .filter((row) => !(row.status === "COMPLETATA" && activeAssignmentSupplierIds.has(row.supplierRegistryProfileId)))
    .filter((row) => {
      if (scope === "MINE") return row.assignedEvaluatorUserId === auth?.userId;
      if (scope === "UNASSIGNED") return row.status === "DA_ASSEGNARE";
      if (scope === "DUE_SOON") {
        if (!row.dueAt || row.status === "COMPLETATA") return false;
        const due = Date.parse(row.dueAt);
        return due >= Date.now() && due <= Date.now() + 3 * 24 * 60 * 60 * 1000;
      }
      if (scope === "OVERDUE") return row.status === "SCADUTA";
      if (scope === "COMPLETED") return row.status === "COMPLETATA";
      return true;
    });
    const filtered = term
      ? scoped.filter((row) => [
        row.supplierName,
        typeLabel(row.supplierType),
        assignmentStatusLabel(row),
        row.assignedEvaluatorName,
        row.assignedEvaluatorEmail,
        row.reason,
        row.reassignmentReason,
        row.draftReferenceCode
      ].filter(Boolean).join(" ").toLowerCase().includes(term))
      : scoped;

    return [...filtered].sort((a, b) => {
      const aDue = a.dueAt ? Date.parse(a.dueAt) : Number.POSITIVE_INFINITY;
      const bDue = b.dueAt ? Date.parse(b.dueAt) : Number.POSITIVE_INFINITY;
      if (aDue !== bDue) {
        return assignmentSort === "URGENT_FIRST" ? aDue - bDue : bDue - aDue;
      }
      return (a.supplierName || "").localeCompare(b.supplierName || "");
    });
  }, [activeAssignmentSupplierIds, assignmentQuery, assignmentSort, assignments, auth?.userId, scope]);

  const loadOverview = useCallback(async () => {
    if (!token) return;
    const data = await getAdminEvaluationOverview(token, appliedFilters);
    setOverview(data);
  }, [appliedFilters, token]);

  const loadAssignments = useCallback(async () => {
    if (!token) return;
    const rows = await getAdminEvaluationAssignments(token, "ALL");
    setAssignments(rows);
    setSelectedAssignment((current) => {
      if (!current?.supplierRegistryProfileId) return current;
      const updated = rows.find((row) => row.supplierRegistryProfileId === current.supplierRegistryProfileId) ?? null;
      if (updated) {
        setDraft(draftFromAssignment(updated));
        setAssignmentEvaluatorId(updated.assignedEvaluatorUserId ?? "");
        setAssignmentDueAt(updated.dueAt ? updated.dueAt.slice(0, 16) : "");
      }
      return updated;
    });
  }, [token]);

  const loadPage = useCallback(async (showLoading = true) => {
    if (!token) return;
    if (showLoading) setLoading(true);
    try {
      await Promise.all([loadOverview(), loadAssignments()]);
    } catch (error) {
      const message = error instanceof HttpError ? error.message : "Caricamento valutazioni non riuscito.";
      setToast({ message, type: "error" });
    } finally {
      if (showLoading) setLoading(false);
    }
  }, [loadAssignments, loadOverview, token]);

  useEffect(() => {
    void loadPage(true);
  }, [loadPage]);

  useEffect(() => {
    if (!token || !canAssign) return;
    void getAdminEligibleEvaluators(token)
      .then(setEligibleEvaluators)
      .catch((error) => {
        const message = error instanceof HttpError ? error.message : "Caricamento valutatori non riuscito.";
        setToast({ message, type: "error" });
      });
  }, [canAssign, token]);

  useEffect(() => {
    const handle = window.setTimeout(() => {
      setAppliedFilters({
        q: filters.q.trim() || undefined,
        type: filters.type || undefined,
        period: filters.period.trim() || undefined,
        minScore: undefined,
        evaluator: filters.evaluator.trim() || undefined,
        limit: 200
      });
    }, 300);
    return () => window.clearTimeout(handle);
  }, [filters, scoreFilter]);

  useAdminRealtimeRefresh({
    token,
    shouldRefresh: shouldRefreshEvaluations,
    onRefresh: () => loadPage(false)
  });

  useEffect(() => {
    if (mode !== "detail" || !routeSupplierId || !token) return;
    void getAdminEvaluationAnalytics(routeSupplierId, token)
      .then(setDetailAnalytics)
      .catch(() => setDetailAnalytics(EMPTY_ANALYTICS));
  }, [mode, routeSupplierId, token]);

  function openAssignment(row: AdminEvaluationAssignmentRow) {
    if (row.status === "COMPLETATA") {
      const completedRow = overview.rows.find((item) => item.evaluationId === row.completedEvaluationId)
        ?? overview.rows.find((item) => item.supplierRegistryProfileId === row.supplierRegistryProfileId && item.evaluationId);
      if (completedRow) {
        openValued(completedRow);
        return;
      }
    }
    setSelectedAssignment(row);
    setSelectedValuedRow(null);
    setDraft(draftFromAssignment(row));
    setAssignmentEvaluatorId(row.assignedEvaluatorUserId ?? "");
    setAssignmentDueAt(row.dueAt ? row.dueAt.slice(0, 16) : "");
    setAssignmentReason("");
    setAssignmentEditUnlocked(false);
  }

  function openValued(row: AdminEvaluationOverviewRow) {
    setSelectedValuedRow(row);
    setSelectedAssignment(null);
    setValuedPanelView("CURRENT");
    setValuedPanelHistory(EMPTY_ANALYTICS);
  }

  async function openValuedHistory() {
    if (!token || !selectedValuedRow?.supplierRegistryProfileId) return;
    setBusy("history");
    try {
      const analytics = await getAdminEvaluationAnalytics(selectedValuedRow.supplierRegistryProfileId, token);
      setValuedPanelHistory(analytics);
      setValuedPanelView("HISTORY");
    } catch (error) {
      const message = error instanceof HttpError ? error.message : "Storico non disponibile.";
      setToast({ message, type: "error" });
    } finally {
      setBusy(null);
    }
  }

  function closePanel() {
    setSelectedAssignment(null);
    setSelectedValuedRow(null);
    setAssignmentEditUnlocked(false);
    setValuedPanelView("CURRENT");
    setValuedPanelHistory(EMPTY_ANALYTICS);
  }

  function startNewCycle(row: AdminEvaluationOverviewRow) {
    const pendingAssignment: AdminEvaluationAssignmentRow = {
      assignmentId: null,
      supplierRegistryProfileId: row.supplierRegistryProfileId,
      supplierName: row.supplierName,
      supplierType: row.supplierType,
      assignedEvaluatorUserId: null,
      assignedEvaluatorName: null,
      assignedEvaluatorEmail: null,
      assignedEvaluatorRole: null,
      assignedByUserId: null,
      assignedByName: auth?.fullName ?? null,
      assignedAt: new Date().toISOString(),
      dueAt: null,
      status: "DA_ASSEGNARE",
      completedEvaluationId: null,
      active: true,
      reason: "Nuovo ciclo di valutazione",
      reassignmentReason: null,
      draftOverallScore: null,
      draftDimensions: {},
      draftCollaborationType: null,
      draftCollaborationPeriod: null,
      draftReferenceCode: row.referenceCode,
      draftComment: null
    };
    setTab("TO_EVALUATE");
    setScope("ALL");
    setSelectedValuedRow(null);
    setAssignments((current) => [
      pendingAssignment,
      ...current.filter((item) => item.supplierRegistryProfileId !== row.supplierRegistryProfileId || item.status !== "COMPLETATA")
    ]);
    setSelectedAssignment(pendingAssignment);
    setDraft(draftFromAssignment(null));
    setAssignmentEvaluatorId("");
    setAssignmentDueAt("");
    setAssignmentReason("Nuovo ciclo di valutazione");
    setAssignmentEditUnlocked(true);
    setToast({ message: `Nuovo ciclo pronto per "${row.supplierName || "fornitore"}". Scegli il valutatore e salva l'assegnazione.`, type: "success" });
  }

  async function saveAssignment() {
    if (!token || !selectedAssignment || !assignmentEvaluatorId || !canAssign) return;
    const dueAt = assignmentDueAt ? (assignmentDueAt.length === 16 ? `${assignmentDueAt}:00` : assignmentDueAt) : undefined;
    setBusy("assign");
    try {
      if (selectedAssignment.assignmentId && selectedAssignment.status !== "DA_ASSEGNARE") {
        await reassignAdminEvaluationEvaluator(
          selectedAssignment.assignmentId,
          assignmentEvaluatorId,
          token,
          assignmentReason.trim() || "Cambio valutatore",
          dueAt
        );
        setToast({ message: "Valutatore cambiato.", type: "success" });
      } else {
        await assignAdminEvaluationEvaluator(
          selectedAssignment.supplierRegistryProfileId,
          assignmentEvaluatorId,
          token,
          assignmentReason.trim() || "Assegnazione valutatore",
          dueAt
        );
        setToast({ message: "Valutatore assegnato.", type: "success" });
      }
      setAssignmentEditUnlocked(false);
      await loadPage(false);
    } catch (error) {
      const message = error instanceof HttpError ? error.message : "Assegnazione non riuscita.";
      setToast({ message, type: "error" });
    } finally {
      setBusy(null);
    }
  }

  async function persistDraft(showToast: boolean) {
    if (!token || !selectedAssignment?.assignmentId || !canEditSelectedDraft) {
      throw new Error("Bozza non modificabile.");
    }
    await saveAdminEvaluationDraft(selectedAssignment.assignmentId, token, {
      overallScore: computedOverallScore || undefined,
      dimensions: draft.dimensions,
      collaborationType: draft.collaborationType,
      collaborationPeriod: draft.collaborationPeriod,
      referenceCode: draft.referenceCode,
      comment: draft.comment
    });
    if (showToast) {
      setToast({ message: "Bozza valutazione salvata.", type: "success" });
    }
  }

  async function saveDraft() {
    setBusy("draft");
    try {
      await persistDraft(true);
      await loadAssignments();
    } catch (error) {
      const message = error instanceof HttpError ? error.message : "Salvataggio bozza non riuscito.";
      setToast({ message, type: "error" });
    } finally {
      setBusy(null);
    }
  }

  async function submitDraft(event: FormEvent) {
    event.preventDefault();
    if (!token || !selectedAssignment?.assignmentId || !canSubmitSelectedDraft) return;
    if (!dimensionScoresComplete || !draft.collaborationType.trim() || !draft.collaborationPeriod.trim()) {
      setToast({ message: "Compila tutti i parametri, tipo collaborazione e periodo.", type: "error" });
      return;
    }
    setBusy("submit");
    try {
      await persistDraft(false);
      await submitAdminEvaluationAssignment(selectedAssignment.assignmentId, token);
      setToast({ message: "Valutazione completata.", type: "success" });
      setSelectedAssignment(null);
      setTab("VALUED");
      await loadPage(false);
    } catch (error) {
      const message = error instanceof HttpError ? error.message : "Invio valutazione non riuscito.";
      setToast({ message, type: "error" });
    } finally {
      setBusy(null);
    }
  }

  if (mode === "detail") {
    return (
      <AdminCandidatureShell active="valutazioni">
        <section className="stack">
          <div className="panel admin-evaluations-head">
            <div>
              <p className="subtle">Valutazioni / {detailAnalytics.supplierName || "Fornitore"}</p>
              <h2>Storico valutazioni</h2>
              <p className="subtle">{typeLabel(detailAnalytics.supplierType)} - media {detailAnalytics.averageOverallScore.toFixed(1)} - {detailAnalytics.totalEvaluations} valutazioni</p>
            </div>
            <Link className="home-btn home-btn-secondary admin-action-btn" to="/admin/evaluations">Torna</Link>
          </div>
          <div className="panel">
            {detailAnalytics.history.length === 0 ? <p className="subtle">Nessuna valutazione disponibile.</p> : null}
            <div className="eval-history-list">
              {detailAnalytics.history.map((item) => (
                <article key={item.evaluationId} className="eval-history-item">
                  <div className="left">
                    <p className="eval-stars">{stars(item.averageScore)}</p>
                    <strong>{item.averageScore.toFixed(1)} / 5</strong>
                  </div>
                  <div className="mid">
                    <p><strong>{item.collaborationType || "Collaborazione"}</strong> - {item.collaborationPeriod || "-"}</p>
                    <p className="subtle">Rif: {item.referenceCode || "-"}</p>
                    <p>{item.comment || "Nessun commento"}</p>
                    <p className="subtle">{item.evaluatorAlias} - {formatDate(item.createdAt)}</p>
                  </div>
                </article>
              ))}
            </div>
          </div>
        </section>
      </AdminCandidatureShell>
    );
  }

  return (
    <AdminCandidatureShell active="valutazioni" evaluationAssignmentsVisible={tab === "TO_EVALUATE"}>
      <section className="stack admin-evaluations-shell">
        {toast ? <AppToast toast={toast} onClose={() => setToast(null)} className="admin-toast" /> : null}

        <div className="panel admin-evaluations-head">
          <div>
            <p className="subtle">Valutazioni fornitori</p>
            <h2>Valutazioni</h2>
            <p className="subtle">Valori ufficiali separati dalle assegnazioni da completare.</p>
          </div>
          <div className="admin-evaluation-tab-strip" role="tablist" aria-label="Sezioni valutazioni">
            <button type="button" className={tab === "VALUED" ? "active" : ""} onClick={() => setTab("VALUED")} role="tab" aria-selected={tab === "VALUED"}>
              <span className="admin-evaluation-tab-icon" aria-hidden="true"><Star size={14} /></span>
              <span className="admin-evaluation-tab-copy"><strong>Valutati</strong><span>valori registrati</span></span>
            </button>
            <button type="button" className={tab === "TO_EVALUATE" ? "active" : ""} onClick={() => setTab("TO_EVALUATE")} role="tab" aria-selected={tab === "TO_EVALUATE"}>
              <span className="admin-evaluation-tab-icon" aria-hidden="true"><ClipboardList size={14} /></span>
              <span className="admin-evaluation-tab-copy"><strong>Da valutare</strong><span>lavori aperti</span></span>
            </button>
          </div>
        </div>

        <div className="admin-evaluations-kpis">
          <article className="panel superadmin-kpi-card tone-ok">
            <div className="superadmin-kpi-head"><h4>Valutati</h4><span className="superadmin-kpi-icon"><Star className="h-4 w-4" /></span></div>
            <strong>{overview.evaluatedSuppliers}</strong>
            <div className="superadmin-kpi-foot"><span className="superadmin-kpi-trend">fornitori con valore</span><span className="superadmin-kpi-level level-ok">Media {overview.averageOverallScore.toFixed(1)}</span></div>
          </article>
          <article className="panel superadmin-kpi-card tone-attention">
            <div className="superadmin-kpi-head"><h4>Mie assegnazioni</h4><span className="superadmin-kpi-icon"><UserCheck className="h-4 w-4" /></span></div>
            <strong>{assignmentCounters.mine}</strong>
            <div className="superadmin-kpi-foot"><span className="superadmin-kpi-trend">da seguire</span><span className="superadmin-kpi-level level-attention">{assignmentCounters.overdue} scadute</span></div>
          </article>
          <article className="panel superadmin-kpi-card tone-info">
            <div className="superadmin-kpi-head"><h4>Da assegnare</h4><span className="superadmin-kpi-icon"><ClipboardList className="h-4 w-4" /></span></div>
            <strong>{assignmentCounters.unassigned}</strong>
            <div className="superadmin-kpi-foot"><span className="superadmin-kpi-trend">senza valutatore</span><span className="superadmin-kpi-level level-info">{assignmentCounters.dueSoon} in scadenza</span></div>
          </article>
          <article className="panel superadmin-kpi-card tone-progress">
            <div className="superadmin-kpi-head"><h4>In rivalutazione</h4><span className="superadmin-kpi-icon"><ArrowDownUp className="h-4 w-4" /></span></div>
            <strong>{revaluationCount}</strong>
            <div className="superadmin-kpi-foot"><span className="superadmin-kpi-trend">nuovi cicli aperti</span><span className="superadmin-kpi-level level-info">aggiornamento live</span></div>
          </article>
        </div>

        {tab === "VALUED" ? (
          <>
            <div className="admin-search-bar eval-valued-search-bar" data-filter-summary={filterSummary}>
              <div className="admin-search-bar-form">
                <div className="admin-search-input-wrap eval-valued-search-wrap">
                  <Search size={16} className="admin-search-icon" />
                  <input className="admin-search-input eval-valued-search-input" value={filters.q} onChange={(event) => setFilters((prev) => ({ ...prev, q: event.target.value }))} placeholder="Cerca fornitore valutato..." />
                  {filters.q ? (
                    <button type="button" className="admin-search-clear eval-search-clear-button" onClick={() => setFilters((prev) => ({ ...prev, q: "" }))} aria-label="Cancella ricerca">×</button>
                  ) : null}
                  <div className="eval-assignment-scope-chips eval-valued-filter-chips" aria-label="Filtri valutati">
                    <div className="eval-chip-set" aria-label="Filtro albo">
                      <span>Albo</span>
                      <button type="button" className={!filters.type ? "is-active" : ""} onClick={() => setFilters((prev) => ({ ...prev, type: "" }))}>Tutti {valuedRows.length}</button>
                      {["ALBO_A", "ALBO_B"].map((type) => (
                        <button key={type} type="button" className={filters.type === type ? "is-active" : ""} onClick={() => setFilters((prev) => ({ ...prev, type: prev.type === type ? "" : type }))}>{typeLabel(type)}</button>
                      ))}
                    </div>
                    <div className="eval-chip-set" aria-label="Filtro punteggio">
                      <span>Punteggio</span>
                      {[
                        ["HIGH", "4+"],
                        ["MID", "3-4"],
                        ["LOW", "Sotto 3"]
                      ].map(([id, label]) => (
                        <button key={id} type="button" className={scoreFilter === id ? "is-active" : ""} onClick={() => setScoreFilter((current) => current === id ? "ALL" : id as ScoreFilter)}>{label}</button>
                      ))}
                    </div>
                  </div>
                </div>
                <button
                  type="button"
                  className="admin-search-filter-button eval-assignment-sort-button"
                  onClick={() => setValuedSort((current) => current === "RECENT_FIRST" ? "OLDER_FIRST" : "RECENT_FIRST")}
                  aria-label="Cambia ordine valutazioni"
                  title={valuedSort === "RECENT_FIRST" ? "Prima le piu recenti" : "Prima le meno recenti"}
                >
                  <ArrowDownUp size={16} />
                  <span>{valuedSort === "RECENT_FIRST" ? "Recenti" : "Meno recenti"}</span>
                </button>
              </div>
            </div>
            <div className="panel">
              {loading ? <p className="subtle admin-unified-table-empty">Caricamento valutazioni...</p> : null}
              {!loading && valuedRows.length === 0 ? <p className="subtle admin-unified-table-empty">Nessun valore registrato.</p> : null}
              {!loading && valuedRows.length > 0 ? (
                <div className="eval-valued-list">
                  <div className="eval-valued-list-head">
                    <span>Fornitore</span>
                    <span>Esito</span>
                    <span>Valutatore</span>
                    <span>Data</span>
                    <span>Azioni</span>
                  </div>
                  {valuedRows.map((row) => (
                    <article key={row.evaluationId ?? row.supplierRegistryProfileId} className="eval-valued-card" role="button" tabIndex={0} onClick={() => openValued(row)} onKeyDown={(event) => { if (event.key === "Enter" || event.key === " ") { event.preventDefault(); openValued(row); } }}>
                      <div className="eval-supplier-cell">
                        <span className="eval-supplier-avatar">{initials(row.supplierName)}</span>
                        <div>
                          <strong>{row.supplierName || "Fornitore"}</strong>
                          <p>{row.referenceCode || "Nessun riferimento"}</p>
                          <span className="eval-badge-row">
                            <span className="eval-registry-badge">{typeLabel(row.supplierType)}</span>
                            {row.supplierRegistryProfileId && activeAssignmentSupplierIds.has(row.supplierRegistryProfileId) ? (
                              <span className="eval-revaluation-badge">In rivalutazione</span>
                            ) : null}
                          </span>
                        </div>
                      </div>
                      <div className="eval-score-cell">
                        <span className={`eval-score-ring tone-${scoreTone(row.averageScore)}`}>{row.averageScore.toFixed(1)}</span>
                        <div>
                          <strong>{scoreLevel(row.averageScore)}</strong>
                          <p>{stars(row.averageScore)}</p>
                        </div>
                      </div>
                      <div className="eval-reviewer-cell">
                        <span>{row.evaluatorDisplay || "n/d"}</span>
                        <small>Valutatore</small>
                      </div>
                      <div className="eval-date-cell">
                        <span>{formatDate(row.createdAt)}</span>
                        <small>Ultima valutazione</small>
                      </div>
                      <div className="eval-card-actions">
                        <span className="eval-row-open-hint">Apri dettagli</span>
                      </div>
                    </article>
                  ))}
                </div>
              ) : null}
            </div>
          </>
        ) : null}

        {tab === "TO_EVALUATE" ? (
          <>
            <div className="admin-search-bar eval-assignment-search-bar">
              <div className="admin-search-bar-form">
                <div className="admin-search-input-wrap eval-assignment-search-wrap">
                  <Search size={16} className="admin-search-icon" />
                  <input className="admin-search-input eval-assignment-search-input" value={assignmentQuery} onChange={(event) => setAssignmentQuery(event.target.value)} placeholder="Cerca assegnazione..." />
                  {assignmentQuery ? (
                    <button type="button" className="admin-search-clear eval-search-clear-button" onClick={() => setAssignmentQuery("")} aria-label="Cancella ricerca">×</button>
                  ) : null}
                  <div className="eval-assignment-scope-chips" aria-label="Filtri assegnazioni">
                    {[
                      ["ALL", `Tutte ${assignmentCounters.all}`],
                      ["MINE", `Mie ${assignmentCounters.mine}`],
                      ["UNASSIGNED", `Da assegnare ${assignmentCounters.unassigned}`],
                      ["DUE_SOON", `In scadenza ${assignmentCounters.dueSoon}`],
                      ["OVERDUE", `Scadute ${assignmentCounters.overdue}`]
                    ].map(([id, label]) => (
                      <button key={id} type="button" className={scope === id ? "is-active" : ""} onClick={() => setScope(id as AssignmentScope)}>
                        {label}
                      </button>
                    ))}
                  </div>
                </div>
                <button
                  type="button"
                  className="admin-search-filter-button eval-assignment-sort-button"
                  onClick={() => setAssignmentSort((current) => current === "URGENT_FIRST" ? "LATER_FIRST" : "URGENT_FIRST")}
                  aria-label="Cambia ordine assegnazioni"
                  title={assignmentSort === "URGENT_FIRST" ? "Prima le piu urgenti" : "Prima le meno urgenti"}
                >
                  <ArrowDownUp size={16} />
                  <span>{assignmentSort === "URGENT_FIRST" ? "Urgenti" : "Meno urgenti"}</span>
                </button>
              </div>
            </div>
            <div className="panel">
              {loading ? <p className="subtle admin-unified-table-empty">Caricamento assegnazioni...</p> : null}
              {!loading && visibleAssignments.length === 0 ? <p className="subtle admin-unified-table-empty">Nessuna valutazione da gestire.</p> : null}
              {!loading && visibleAssignments.length > 0 ? (
                <div className="eval-assignment-list">
                  {visibleAssignments.map((row) => (
                    <article key={row.assignmentId ?? row.supplierRegistryProfileId} className={`eval-assignment-card tone-${assignmentTone(row.status)}`} role="button" tabIndex={0} onClick={() => openAssignment(row)} onKeyDown={(event) => { if (event.key === "Enter" || event.key === " ") { event.preventDefault(); openAssignment(row); } }}>
                      <div className="eval-assignment-main">
                        <span className="eval-supplier-avatar">{initials(row.supplierName)}</span>
                        <div>
                          <strong>{row.supplierName || "Fornitore"}</strong>
                          <p>{typeLabel(row.supplierType)}</p>
                        </div>
                      </div>
                      <div className="eval-assignment-status">
                        <span className={`eval-assignment-pill tone-${assignmentTone(row.status)}`}>{assignmentStatusLabel(row)}</span>
                        <small>{row.reason || row.reassignmentReason || "Nessuna nota"}</small>
                      </div>
                      <div className="eval-assignment-meta">
                        <span>Valutatore</span>
                        <strong>{row.assignedEvaluatorName || "Da scegliere"}</strong>
                      </div>
                      <div className="eval-assignment-meta">
                        <span>Scadenza</span>
                        <strong>{dueLabel(row.dueAt)}</strong>
                        <small>{formatDate(row.dueAt)}</small>
                      </div>
                      <div className="eval-card-actions">
                        <span className="eval-row-open-hint">{assignmentActionLabel(row, auth?.userId)}</span>
                      </div>
                    </article>
                  ))}
                </div>
              ) : null}
            </div>
          </>
        ) : null}

        {(selectedAssignment || selectedValuedRow) ? (
          <div className="modal-overlay" onClick={closePanel}>
            <aside className="modal-panel admin-evaluation-side-panel" onClick={(event) => event.stopPropagation()}>
              <div className="admin-evaluation-side-head">
                <div>
                  <p className="subtle">{selectedAssignment ? "Da valutare" : valuedPanelView === "HISTORY" ? "Storico valutazioni" : "Valutazione registrata"}</p>
                  <h3>{selectedAssignment?.supplierName || selectedValuedRow?.supplierName || "Fornitore"}</h3>
                </div>
                <div className="admin-evaluation-side-actions">
                  {selectedValuedRow && valuedPanelView === "HISTORY" ? (
                    <button type="button" className="admin-search-clear eval-side-back-button" onClick={() => setValuedPanelView("CURRENT")} aria-label="Torna alla valutazione"><ArrowLeft size={16} /></button>
                  ) : null}
                  <button type="button" className="admin-search-clear eval-side-close-button" onClick={closePanel} aria-label="Chiudi"><X size={16} /></button>
                </div>
              </div>

              {selectedValuedRow && valuedPanelView === "CURRENT" ? (
                <div className="eval-registered-detail">
                  <div className={`eval-detail-score-hero tone-${scoreTone(selectedValuedRow.averageScore)}`}>
                    <div>
                      <span>Valutazione registrata</span>
                      <strong>{selectedValuedRow.averageScore.toFixed(1)}</strong>
                      <small>/ 5</small>
                    </div>
                    <p>{scoreLevel(selectedValuedRow.averageScore)}</p>
                  </div>
                  <div className="eval-detail-meta-grid">
                    <div>
                      <span>Albo</span>
                      <strong>{typeLabel(selectedValuedRow.supplierType)}</strong>
                    </div>
                    <div>
                      <span>Valutatore</span>
                      <strong>{selectedValuedRow.evaluatorDisplay || "n/d"}</strong>
                    </div>
                    <div>
                      <span>Periodo</span>
                      <strong>{selectedValuedRow.collaborationPeriod || "-"}</strong>
                    </div>
                    <div>
                      <span>Riferimento</span>
                      <strong>{selectedValuedRow.referenceCode || "-"}</strong>
                    </div>
                  </div>
                  <section className="eval-detail-comment">
                    <span>Commento</span>
                    <p>{selectedValuedRow.comment || "Nessun commento"}</p>
                  </section>
                  <section className="eval-detail-dimensions">
                    <div className="eval-detail-section-title">
                      <span>Parametri valutati</span>
                      <strong>{Object.keys(selectedValuedRow.dimensionScores || {}).length} voci</strong>
                    </div>
                    {DIMENSIONS.map((dimension) => {
                      const value = dimensionScore(selectedValuedRow.dimensionScores, dimension.key, dimension.label);
                      return (
                        <div key={dimension.key} className="eval-detail-dimension-row">
                          <span>{dimensionLabel(dimension.key)}</span>
                          {typeof value === "number" ? <ReadOnlyScoreStars value={value} /> : <small>Non valutato</small>}
                        </div>
                      );
                    })}
                  </section>
                  <div className="eval-detail-action-stack">
                    {canSuperAdminEditCompleted ? (
                      <button type="button" className="home-btn home-btn-primary admin-action-btn eval-detail-action-button" onClick={() => startNewCycle(selectedValuedRow)}>
                        <UserCheck className="h-4 w-4" /> Nuova valutazione
                      </button>
                    ) : null}
                    <button type="button" className="eval-detail-history-link" onClick={() => void openValuedHistory()} disabled={busy === "history"}>
                      {busy === "history" ? "Caricamento storico..." : "Apri storico"}
                    </button>
                  </div>
                </div>
              ) : null}

              {selectedValuedRow && valuedPanelView === "HISTORY" ? (
                <div className="eval-registered-detail">
                  <div className="eval-history-summary">
                    <div>
                      <span>Media fornitore</span>
                      <strong>{valuedPanelHistory.averageOverallScore.toFixed(1)} / 5</strong>
                    </div>
                    <div>
                      <span>Valutazioni</span>
                      <strong>{valuedPanelHistory.totalEvaluations}</strong>
                    </div>
                  </div>
                  <div className="eval-popup-history-list">
                    {valuedPanelHistory.history.length === 0 ? <p className="subtle">Nessuno storico disponibile.</p> : null}
                    {valuedPanelHistory.history.map((item) => (
                      <article key={item.evaluationId} className="eval-popup-history-item">
                        <div className={`eval-score-ring tone-${scoreTone(item.averageScore)}`}>{item.averageScore.toFixed(1)}</div>
                        <div>
                          <strong>{item.collaborationType || "Collaborazione"}</strong>
                          <span className="eval-popup-history-stars">{stars(item.averageScore)}</span>
                          <p>{item.collaborationPeriod || "-"} - {item.evaluatorAlias}</p>
                          <small>{formatDate(item.createdAt)} - {item.referenceCode || "Nessun riferimento"}</small>
                          {item.comment ? <p className="eval-popup-history-comment">{item.comment}</p> : null}
                        </div>
                      </article>
                    ))}
                  </div>
                </div>
              ) : null}

              {selectedAssignment ? (
                <form className="stack" onSubmit={submitDraft}>
                  <section className={`eval-assignment-summary-panel tone-${assignmentTone(selectedAssignment.status)}`}>
                    <div>
                      <span className={`eval-assignment-pill tone-${assignmentTone(selectedAssignment.status)}`}>{assignmentStatusLabel(selectedAssignment)}</span>
                      <h4>{assignmentActionLabel(selectedAssignment, auth?.userId)}</h4>
                      <p>{selectedAssignment.reason || selectedAssignment.reassignmentReason || "Gestisci chi deve completare la valutazione e cosa manca."}</p>
                    </div>
                    <div className="eval-assignment-summary-meta">
                      <div><span>Valutatore</span><strong>{selectedAssignment.assignedEvaluatorName || "Da scegliere"}</strong></div>
                      <div><span>Scadenza</span><strong>{dueLabel(selectedAssignment.dueAt)}</strong></div>
                    </div>
                  </section>

                  <section className="panel eval-assignment-form-panel eval-assignment-owner-panel">
                    <div className="eval-popup-section-title">
                      <div>
                        <span>Responsabile</span>
                        <h4>Chi deve completarla</h4>
                      </div>
                      <strong>{selectedAssignment.assignedEvaluatorName || "Da scegliere"}</strong>
                    </div>
                    {canAssign && selectedAssignment.status !== "COMPLETATA" ? (
                      <>
                        {hasExistingAssignment && !assignmentEditUnlocked ? (
                          <div className="eval-assignment-locked-card">
                            <div>
                              <span>Assegnato a</span>
                              <strong>{selectedAssignment.assignedEvaluatorName || "Valutatore"}</strong>
                              <p>{selectedAssignment.assignedEvaluatorRole ? roleLabel(selectedAssignment.assignedEvaluatorRole) : "Valutatore assegnato"} {selectedAssignment.dueAt ? `- scadenza ${dueLabel(selectedAssignment.dueAt)}` : ""}</p>
                            </div>
                            <button type="button" className="home-btn home-btn-secondary admin-action-btn" onClick={() => setAssignmentEditUnlocked(true)}>
                              <UserCheck className="h-4 w-4" /> Cambia assegnazione
                            </button>
                          </div>
                        ) : null}
                        {assignmentFieldsEditable ? (
                          <div className="eval-assignment-control-grid">
                            <label className="floating-field has-value eval-popup-field eval-popup-field-wide">
                              <select className="floating-input" value={assignmentEvaluatorId} onChange={(event) => setAssignmentEvaluatorId(event.target.value)}>
                                <option value="">Seleziona valutatore</option>
                                {eligibleEvaluators.map((evaluator) => (
                                  <option key={evaluator.userId} value={evaluator.userId}>{evaluator.fullName} - {roleLabel(evaluator.adminRole)}</option>
                                ))}
                              </select>
                              <span className="floating-field-label">Valutatore</span>
                            </label>
                            <label className={`floating-field eval-popup-field ${assignmentDueAt ? "has-value" : ""}`}>
                              <input className="floating-input" type="datetime-local" value={assignmentDueAt} onChange={(event) => setAssignmentDueAt(event.target.value)} placeholder=" " />
                              <span className="floating-field-label">Scadenza</span>
                            </label>
                            <label className={`floating-field eval-popup-field ${assignmentReason ? "has-value" : ""}`}>
                              <input className="floating-input" value={assignmentReason} onChange={(event) => setAssignmentReason(event.target.value)} placeholder=" " />
                              <span className="floating-field-label">{assignmentReasonRequired ? "Motivo obbligatorio" : "Motivo"}</span>
                            </label>
                            {hasExistingAssignment ? (
                              <button type="button" className="home-btn home-btn-secondary admin-action-btn" onClick={() => { setAssignmentEditUnlocked(false); setAssignmentEvaluatorId(selectedAssignment.assignedEvaluatorUserId ?? ""); setAssignmentDueAt(selectedAssignment.dueAt ? selectedAssignment.dueAt.slice(0, 16) : ""); setAssignmentReason(""); }}>
                                Annulla modifica
                              </button>
                            ) : null}
                            <button type="button" className="home-btn home-btn-secondary admin-action-btn eval-popup-wide-action" onClick={() => void saveAssignment()} disabled={assignmentSaveDisabled}>
                              <UserCheck className="h-4 w-4" /> {hasExistingAssignment ? "Salva nuova assegnazione" : "Assegna"}
                            </button>
                          </div>
                        ) : null}
                      </>
                    ) : (
                      <p>{selectedAssignment.assignedEvaluatorName || "Nessun valutatore assegnato"} {selectedAssignment.assignedEvaluatorRole ? `- ${roleLabel(selectedAssignment.assignedEvaluatorRole)}` : ""}</p>
                    )}
                  </section>

                  <section className="panel eval-assignment-form-panel eval-assignment-values-panel">
                    <div className="eval-popup-section-title">
                      <div>
                        <span>Valutazione</span>
                        <h4>Valori da compilare</h4>
                      </div>
                      <strong>{currentDraftProgress.done}/{currentDraftProgress.total}</strong>
                    </div>
                    {!selectedAssignment.assignmentId ? <p className="subtle">Assegna prima un valutatore per compilare i valori.</p> : null}
                    {selectedAssignment.status === "SCADUTA" ? (
                      <p className="subtle">Scaduta: i valori sono bloccati. Cambia valutatore o aggiorna la scadenza per riaprire il lavoro.</p>
                    ) : null}
                    {selectedAssignment.assignmentId ? (
                      <>
                        <div className="eval-draft-progress-card">
                          <div>
                            <span>Avanzamento bozza</span>
                            <strong>{currentDraftProgress.percent}% completata</strong>
                          </div>
                          <div className="eval-draft-progress-bar"><span style={{ width: `${currentDraftProgress.percent}%` }} /></div>
                        </div>
                        <div className="eval-overall-block">
                          <p><strong>Punteggio complessivo</strong> <span>Media automatica</span></p>
                          <ReadOnlyScoreStars value={computedOverallScore} />
                        </div>
                        <div className="eval-dimension-inputs eval-dimension-inputs-polished">
                          {DIMENSIONS.map((dim) => (
                            <div key={dim.key} className="eval-dimension-input-row">
                              <span>{dim.label}</span>
                              <StarInput value={draft.dimensions[dim.key] ?? 0} disabled={!canEditSelectedDraft} onChange={(value) => setDraft((prev) => ({ ...prev, dimensions: { ...prev.dimensions, [dim.key]: value } }))} />
                            </div>
                          ))}
                        </div>
                        <div className="eval-value-details-grid">
                          <label className={`floating-field eval-popup-field ${draft.collaborationType ? "has-value" : ""}`}>
                            <input className="floating-input" value={draft.collaborationType} disabled={!canEditSelectedDraft} onChange={(event) => setDraft((prev) => ({ ...prev, collaborationType: event.target.value }))} placeholder=" " />
                            <span className="floating-field-label">Tipo collaborazione *</span>
                          </label>
                          <label className={`floating-field eval-popup-field ${draft.collaborationPeriod ? "has-value" : ""}`}>
                            <input className="floating-input" value={draft.collaborationPeriod} disabled={!canEditSelectedDraft} onChange={(event) => setDraft((prev) => ({ ...prev, collaborationPeriod: event.target.value }))} placeholder=" " />
                            <span className="floating-field-label">Periodo *</span>
                          </label>
                          <label className={`floating-field eval-popup-field eval-popup-field-wide ${draft.referenceCode ? "has-value" : ""}`}>
                            <input className="floating-input" value={draft.referenceCode} disabled={!canEditSelectedDraft} onChange={(event) => setDraft((prev) => ({ ...prev, referenceCode: event.target.value }))} placeholder=" " />
                            <span className="floating-field-label">Riferimento</span>
                          </label>
                        </div>
                        <label className={`floating-field eval-popup-field eval-popup-textarea ${draft.comment ? "has-value" : ""}`}>
                          <textarea className="floating-input" rows={4} value={draft.comment} disabled={!canEditSelectedDraft} onChange={(event) => setDraft((prev) => ({ ...prev, comment: event.target.value.slice(0, 600) }))} placeholder=" " />
                          <span className="floating-field-label">Commento</span>
                        </label>
                        <div className="revamp-step-actions">
                          <button type="button" className="home-btn home-btn-secondary admin-action-btn" onClick={() => void saveDraft()} disabled={!canEditSelectedDraft || busy === "draft"}>
                            <Save className="h-4 w-4" /> Salva bozza
                          </button>
                          <button type="submit" className="home-btn home-btn-primary admin-action-btn" disabled={!canSubmitSelectedDraft || busy === "submit"}>
                            <Check className="h-4 w-4" /> Completa valutazione
                          </button>
                        </div>
                        {!isAssignedToMe && adminRole !== "SUPER_ADMIN" && selectedAssignment.status !== "COMPLETATA" ? (
                          <p className="subtle">Solo il valutatore assegnato puo completare la valutazione. Super Admin e Responsabile possono gestire l'assegnazione.</p>
                        ) : null}
                      </>
                    ) : null}
                  </section>
                </form>
              ) : null}
            </aside>
          </div>
        ) : null}
      </section>
    </AdminCandidatureShell>
  );
}
