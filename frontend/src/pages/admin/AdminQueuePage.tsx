import { useEffect, useMemo, useState } from "react";
import { Clock3, ListChecks, RefreshCw } from "lucide-react";
import { Link } from "react-router-dom";
import { HttpError } from "../../api/http";
import { assignAdminReviewCase, getAdminReviewQueue, type AdminReviewCaseSummary } from "../../api/adminReviewApi";
import { useAdminGovernanceRole } from "../../hooks/useAdminGovernanceRole";
import { useAuth } from "../../auth/AuthContext";
import { AppToast } from "../../components/ui/toast";
import { AdminCandidatureShell } from "./AdminCandidatureShell";

type QueueTab = "ALL" | "PENDING_ASSIGNMENT" | "WAITING_SUPPLIER_RESPONSE" | "IN_PROGRESS" | "DECIDED";

function toDaysInQueue(updatedAt: string): number {
  const timestamp = Date.parse(updatedAt);
  if (!Number.isFinite(timestamp)) return 0;
  return Math.max(0, Math.floor((Date.now() - timestamp) / (1000 * 60 * 60 * 24)));
}

function urgencyLevel(daysInQueue: number): "URGENT" | "HIGH" | "MEDIUM" | "LOW" {
  if (daysInQueue > 5) return "URGENT";
  if (daysInQueue >= 4) return "HIGH";
  if (daysInQueue >= 2) return "MEDIUM";
  return "LOW";
}

function integrationDueTone(slaDueAt?: string | null): "OVERDUE" | "DUE_SOON" | "ON_TRACK" | "NO_DUE" {
  if (!slaDueAt) return "NO_DUE";
  const dueTs = Date.parse(slaDueAt);
  if (!Number.isFinite(dueTs)) return "NO_DUE";
  const deltaDays = Math.ceil((dueTs - Date.now()) / (1000 * 60 * 60 * 24));
  if (deltaDays < 0) return "OVERDUE";
  if (deltaDays <= 2) return "DUE_SOON";
  return "ON_TRACK";
}

function statusLabel(status: string): string {
  if (status === "PENDING_ASSIGNMENT") return "In attesa";
  if (status === "WAITING_SUPPLIER_RESPONSE") return "Integrazione";
  if (status === "IN_PROGRESS") return "Presa in carico";
  if (status === "DECIDED") return "Decisa";
  return status;
}

function decisionLabel(decision?: string | null): string {
  if (decision === "APPROVED") return "Approvata";
  if (decision === "REJECTED") return "Rigettata";
  if (decision === "INTEGRATION_REQUIRED") return "Integrazione richiesta";
  return "N/A";
}

function appCode(applicationId: string): string {
  return `APP-${applicationId.slice(0, 8).toUpperCase()}`;
}

export function AdminQueuePage() {
  const { auth } = useAuth();
  const token = auth?.token ?? "";
  const { adminRole } = useAdminGovernanceRole();
  const [rows, setRows] = useState<AdminReviewCaseSummary[]>([]);
  const [activeTab, setActiveTab] = useState<QueueTab>("ALL");
  const [loading, setLoading] = useState(false);
  const [busyAssignFor, setBusyAssignFor] = useState<string | null>(null);
  const [toast, setToast] = useState<{ message: string; type: "error" | "success" } | null>(null);
  const canAssign = adminRole === "SUPER_ADMIN" || adminRole === "RESPONSABILE_ALBO" || adminRole === "REVISORE";

  async function loadQueue() {
    if (!token) return;
    setLoading(true);
    try {
      const data = await getAdminReviewQueue(token);
      setRows([...data].sort((a, b) => Date.parse(b.updatedAt) - Date.parse(a.updatedAt)));
    } catch (error) {
      const message = error instanceof HttpError ? error.message : "Caricamento coda review non riuscito.";
      setToast({ message, type: "error" });
      setRows([]);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void loadQueue();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token]);

  const counters = useMemo(() => {
    const now = new Date();
    const month = now.getMonth();
    const year = now.getFullYear();

    return {
      pendingReview: rows.filter((r) => r.status === "PENDING_ASSIGNMENT").length,
      integrationRequested: rows.filter((r) => r.status === "WAITING_SUPPLIER_RESPONSE").length,
      inProgress: rows.filter((r) => r.status === "IN_PROGRESS").length,
      approvedThisMonth: rows.filter((r) => {
        if (r.decision !== "APPROVED") return false;
        const ts = Date.parse(r.updatedAt);
        if (!Number.isFinite(ts)) return false;
        const date = new Date(ts);
        return date.getMonth() === month && date.getFullYear() === year;
      }).length,
      rejectedThisMonth: rows.filter((r) => {
        if (r.decision !== "REJECTED") return false;
        const ts = Date.parse(r.updatedAt);
        if (!Number.isFinite(ts)) return false;
        const date = new Date(ts);
        return date.getMonth() === month && date.getFullYear() === year;
      }).length
    };
  }, [rows]);

  const tabCounts = useMemo(() => ({
    ALL: rows.length,
    PENDING_ASSIGNMENT: rows.filter((r) => r.status === "PENDING_ASSIGNMENT").length,
    WAITING_SUPPLIER_RESPONSE: rows.filter((r) => r.status === "WAITING_SUPPLIER_RESPONSE").length,
    IN_PROGRESS: rows.filter((r) => r.status === "IN_PROGRESS").length,
    DECIDED: rows.filter((r) => r.status === "DECIDED").length
  }), [rows]);

  const filteredRows = useMemo(() => {
    if (activeTab === "ALL") return rows;
    return rows.filter((r) => r.status === activeTab);
  }, [activeTab, rows]);

  async function takeInCharge(row: AdminReviewCaseSummary) {
    if (!token || !canAssign || busyAssignFor) return;
    setBusyAssignFor(row.applicationId);
    try {
      await assignAdminReviewCase(row.applicationId, token, auth?.userId ? { assignedToUserId: auth.userId } : undefined);
      setToast({ message: "Candidatura presa in carico.", type: "success" });
      await loadQueue();
    } catch (error) {
      const message = error instanceof HttpError ? error.message : "Presa in carico non riuscita.";
      setToast({ message, type: "error" });
    } finally {
      setBusyAssignFor(null);
    }
  }

  return (
    <AdminCandidatureShell active="candidature">
      <section className="stack admin-queue-shell">
        {toast ? <AppToast toast={toast} onClose={() => setToast(null)} className="admin-toast" /> : null}

      <div className="panel">
        <div className="admin-queue-head">
          <div>
            <h2><ListChecks className="h-5 w-5" /> Coda Revisione Candidature</h2>
            <p className="subtle">Gestisci le pratiche in revisione con priorita operative.</p>
          </div>
          <button type="button" className="home-btn home-btn-secondary" onClick={() => void loadQueue()} disabled={loading}>
            <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} />
            {loading ? "Aggiornamento..." : "Aggiorna coda"}
          </button>
        </div>
      </div>

      <div className="admin-queue-kpis">
        <article className="panel admin-queue-kpi kpi-pending">
          <p className="kpi-title">In attesa revisione</p>
          <strong>{counters.pendingReview}</strong>
        </article>
        <article className="panel admin-queue-kpi kpi-integration">
          <p className="kpi-title">Integrazione richiesta</p>
          <strong>{counters.integrationRequested}</strong>
        </article>
        <article className="panel admin-queue-kpi kpi-progress">
          <p className="kpi-title">Prese in carico</p>
          <strong>{counters.inProgress}</strong>
        </article>
        <article className="panel admin-queue-kpi kpi-approved">
          <p className="kpi-title">Approvate (mese)</p>
          <strong>{counters.approvedThisMonth}</strong>
        </article>
        <article className="panel admin-queue-kpi kpi-rejected">
          <p className="kpi-title">Rigettate (mese)</p>
          <strong>{counters.rejectedThisMonth}</strong>
        </article>
      </div>

      <div className="panel admin-queue-tabs">
        <button type="button" className={activeTab === "ALL" ? "queue-tab active" : "queue-tab"} onClick={() => setActiveTab("ALL")}>
          Tutte <span>{tabCounts.ALL}</span>
        </button>
        <button type="button" className={activeTab === "PENDING_ASSIGNMENT" ? "queue-tab active" : "queue-tab"} onClick={() => setActiveTab("PENDING_ASSIGNMENT")}>
          In attesa <span>{tabCounts.PENDING_ASSIGNMENT}</span>
        </button>
        <button type="button" className={activeTab === "WAITING_SUPPLIER_RESPONSE" ? "queue-tab active" : "queue-tab"} onClick={() => setActiveTab("WAITING_SUPPLIER_RESPONSE")}>
          Integrazione <span>{tabCounts.WAITING_SUPPLIER_RESPONSE}</span>
        </button>
        <button type="button" className={activeTab === "IN_PROGRESS" ? "queue-tab active" : "queue-tab"} onClick={() => setActiveTab("IN_PROGRESS")}>
          Prese in carico <span>{tabCounts.IN_PROGRESS}</span>
        </button>
        <button type="button" className={activeTab === "DECIDED" ? "queue-tab active" : "queue-tab"} onClick={() => setActiveTab("DECIDED")}>
          Decise <span>{tabCounts.DECIDED}</span>
        </button>
      </div>

        <div className="panel">
          <h4>Elenco candidature</h4>
          {loading ? <p className="subtle">Caricamento...</p> : null}
          {!loading && filteredRows.length === 0 ? <p className="subtle">Nessuna pratica per il filtro selezionato.</p> : null}
          {!loading && filteredRows.length > 0 ? (
            <div className="admin-queue-table">
              <div className="admin-queue-row admin-queue-row-head">
                <span>Candidatura</span>
                <span>Ricevuta il</span>
                <span>In coda da</span>
                <span>Assegnata a</span>
                <span>Stato</span>
                <span>Esito</span>
                <span>Urgenza</span>
                <span>Azioni</span>
              </div>
              {filteredRows.map((row) => {
                const days = toDaysInQueue(row.updatedAt);
                const urgency = urgencyLevel(days);
                const urgencyTone = urgency === "URGENT" ? "urgent" : urgency === "HIGH" ? "high" : urgency === "MEDIUM" ? "medium" : "low";
                const actionClass = urgency === "URGENT" ? "home-btn home-btn-primary queue-action-primary" : "home-btn home-btn-secondary queue-action-outline";
                const assignedLabel = row.assignedToDisplayName?.trim() || "Non assegnata";
                const dueTone = row.status === "WAITING_SUPPLIER_RESPONSE" ? integrationDueTone(row.slaDueAt) : null;
                const dueLabel = row.slaDueAt ? new Date(row.slaDueAt).toLocaleDateString("it-IT") : "n/d";

                return (
                  <div key={row.id} className="admin-queue-row">
                    <div className="queue-main-cell">
                      <strong>{appCode(row.applicationId)}</strong>
                      <p className="subtle">{row.applicationId}</p>
                    </div>
                    <span>{new Date(row.updatedAt).toLocaleDateString("it-IT")}</span>
                    <span className="queue-days-cell"><Clock3 className="h-4 w-4" /> {days} giorni</span>
                    <span>{assignedLabel}</span>
                    <span className="queue-pill status">{statusLabel(row.status)}</span>
                    <span className="queue-pill decision">{decisionLabel(row.decision)}</span>
                    <span className={`queue-pill urgency ${urgencyTone}`}>
                      {row.status === "WAITING_SUPPLIER_RESPONSE" && dueTone
                        ? `${dueTone} (${dueLabel})`
                        : urgency}
                    </span>
                    <div className="queue-actions">
                      {row.status === "PENDING_ASSIGNMENT" ? (
                        <button
                          type="button"
                          className="home-btn home-btn-primary queue-action-primary"
                          disabled={!canAssign || busyAssignFor === row.applicationId}
                          onClick={() => void takeInCharge(row)}
                        >
                          {busyAssignFor === row.applicationId ? "Presa in carico..." : "Prendi in carico"}
                        </button>
                      ) : null}
                      <Link className={actionClass} to={`/admin/candidature/${row.applicationId}/review`}>
                        Esamina
                      </Link>
                      <Link className="home-inline-link home-inline-link-admin" to={`/admin/candidature/${row.applicationId}/integration`}>
                        Integrazione
                      </Link>
                    </div>
                  </div>
                );
              })}
            </div>
          ) : null}
        </div>
      </section>
    </AdminCandidatureShell>
  );
}
