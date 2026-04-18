import { useEffect, useMemo, useState } from "react";
import { AlertTriangle, BarChart3, Clock3, RefreshCw } from "lucide-react";
import { Link } from "react-router-dom";
import { HttpError } from "../../api/http";
import { getAdminReportKpis, type AdminReportKpis } from "../../api/adminReportApi";
import { getAdminReviewQueue, type AdminReviewCaseSummary } from "../../api/adminReviewApi";
import { getAdminAuditEvents, type AdminAuditEventRow } from "../../api/adminAuditApi";
import type { AdminRole } from "../../api/adminUsersRolesApi";
import { useAuth } from "../../auth/AuthContext";
import { AppToast } from "../../components/ui/toast";
import { useAdminGovernanceRole } from "../../hooks/useAdminGovernanceRole";
import {
  SuperAdminDashboardPage,
  type SuperAdminRecentActivityItem,
  type SuperAdminMonthTrendPoint
} from "./SuperAdminDashboardPage";

const EMPTY_KPIS: AdminReportKpis = {
  totalSuppliers: 0,
  activeSuppliers: 0,
  pendingSuppliers: 0,
  submittedApplications: 0,
  pendingInvites: 0
};

type AdminDashboardCapabilities = {
  canReadKpis: boolean;
  canReadQueue: boolean;
  canReadAudit: boolean;
  canManageInvites: boolean;
  canManageUsersRoles: boolean;
  canExportReports: boolean;
  canAccessEvaluations: boolean;
};

function resolveCapabilities(adminRole: AdminRole | null): AdminDashboardCapabilities {
  return {
    canReadKpis: adminRole === "SUPER_ADMIN" || adminRole === "RESPONSABILE_ALBO" || adminRole === "REVISORE" || adminRole === "VIEWER",
    canReadQueue: adminRole === "SUPER_ADMIN" || adminRole === "RESPONSABILE_ALBO" || adminRole === "REVISORE",
    canReadAudit: adminRole === "SUPER_ADMIN" || adminRole === "RESPONSABILE_ALBO" || adminRole === "REVISORE" || adminRole === "VIEWER",
    canManageInvites: adminRole === "SUPER_ADMIN" || adminRole === "RESPONSABILE_ALBO",
    canManageUsersRoles: adminRole === "SUPER_ADMIN",
    canExportReports: adminRole === "SUPER_ADMIN" || adminRole === "RESPONSABILE_ALBO",
    canAccessEvaluations: adminRole === "SUPER_ADMIN" || adminRole === "RESPONSABILE_ALBO" || adminRole === "REVISORE"
  };
}

function daysSince(iso: string): number {
  const value = Date.parse(iso);
  if (!Number.isFinite(value)) return 0;
  return Math.floor((Date.now() - value) / (1000 * 60 * 60 * 24));
}

export function AdminDashboardPage() {
  const { auth } = useAuth();
  const token = auth?.token ?? "";
  const { adminRole, loading: adminRoleLoading } = useAdminGovernanceRole();
  const [kpis, setKpis] = useState<AdminReportKpis>(EMPTY_KPIS);
  const [queue, setQueue] = useState<AdminReviewCaseSummary[]>([]);
  const [recentActivity, setRecentActivity] = useState<SuperAdminRecentActivityItem[]>([]);
  const [monthTrend, setMonthTrend] = useState<SuperAdminMonthTrendPoint[]>([]);
  const [loading, setLoading] = useState(false);
  const [toast, setToast] = useState<{ message: string; type: "error" | "success" } | null>(null);
  const capabilities = resolveCapabilities(adminRole);

  function mapAuditToRecent(items: AdminAuditEventRow[]): SuperAdminRecentActivityItem[] {
    return items
      .slice(0, 24)
      .map((item) => {
        const normalized = (item.eventKey ?? "").toLowerCase();
        let title = item.eventKey ?? "Evento";
        if (normalized.includes("approved")) title = "Approvato";
        else if (normalized.includes("rejected")) title = "Rigettato";
        else if (normalized.includes("integration")) title = "Integrazione richiesta";
        else if (normalized.includes("invite")) title = "Invito inviato";
        else if (normalized.includes("evaluation")) title = "Valutazione inserita";
        const subtitle = [item.entityType, item.entityId].filter(Boolean).join(" - ");
        return {
          id: item.id,
          title,
          subtitle: subtitle || "Attivita amministrativa",
          occurredAt: item.occurredAt
        };
      })
      .sort((a, b) => Date.parse(b.occurredAt) - Date.parse(a.occurredAt));
  }

  function buildMonthTrend(
    queueItems: AdminReviewCaseSummary[],
    auditItems: AdminAuditEventRow[]
  ): SuperAdminMonthTrendPoint[] {
    const now = new Date();
    const monthKeys: string[] = [];
    for (let i = 5; i >= 0; i -= 1) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      monthKeys.push(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`);
    }

    const counts = new Map<string, number>(monthKeys.map((key) => [key, 0]));
    const dates = [
      ...queueItems.map((item) => item.updatedAt),
      ...auditItems.map((item) => item.occurredAt)
    ];

    dates.forEach((raw) => {
      const parsed = Date.parse(raw);
      if (!Number.isFinite(parsed)) return;
      const d = new Date(parsed);
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
      if (!counts.has(key)) return;
      counts.set(key, (counts.get(key) ?? 0) + 1);
    });

    return monthKeys.map((key) => {
      const [year, month] = key.split("-");
      const date = new Date(Number(year), Number(month) - 1, 1);
      const monthLabel = date.toLocaleDateString("it-IT", { month: "short" });
      return {
        monthLabel: monthLabel.charAt(0).toUpperCase() + monthLabel.slice(1),
        count: counts.get(key) ?? 0
      };
    });
  }

  async function loadDashboard() {
    if (!token) return;
    if (auth?.role === "ADMIN") {
      if (adminRoleLoading) return;
      if (!capabilities.canReadKpis && !capabilities.canReadAudit && !capabilities.canReadQueue) {
        setKpis(EMPTY_KPIS);
        setQueue([]);
        setRecentActivity([]);
        setMonthTrend([]);
        setToast(null);
        return;
      }
    }
    setLoading(true);
    try {
      const [kpisData, queueData, auditData] = await Promise.all([
        capabilities.canReadKpis ? getAdminReportKpis(token) : Promise.resolve(EMPTY_KPIS),
        capabilities.canReadQueue ? getAdminReviewQueue(token) : Promise.resolve([] as AdminReviewCaseSummary[]),
        capabilities.canReadAudit ? getAdminAuditEvents(token).catch(() => [] as AdminAuditEventRow[]) : Promise.resolve([] as AdminAuditEventRow[])
      ]);
      setKpis(kpisData);
      const sortedQueue = [...queueData].sort((a, b) => Date.parse(b.updatedAt) - Date.parse(a.updatedAt));
      setQueue(sortedQueue);
      setRecentActivity(mapAuditToRecent(auditData));
      setMonthTrend(buildMonthTrend(sortedQueue, auditData));
    } catch (error) {
      const message = error instanceof HttpError ? error.message : "Caricamento dashboard non riuscito.";
      if (message.toLowerCase().includes("access denied for governance role") || message.toLowerCase().includes("invalid governance profile")) {
        setKpis(EMPTY_KPIS);
        setQueue([]);
        setRecentActivity([]);
        setMonthTrend([]);
        setToast(null);
        return;
      }
      setToast({ message, type: "error" });
      setKpis(EMPTY_KPIS);
      setQueue([]);
      setRecentActivity([]);
      setMonthTrend([]);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void loadDashboard();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token, adminRole, adminRoleLoading, auth?.role]);

  const urgentCases = useMemo(() => queue.filter((item) => daysSince(item.updatedAt) >= 5), [queue]);
  const waitingCases = useMemo(() => queue.filter((item) => item.status === "WAITING_SUPPLIER_RESPONSE"), [queue]);
  const inProgressCases = useMemo(() => queue.filter((item) => item.status === "IN_PROGRESS"), [queue]);
  const canManageInvites = capabilities.canManageInvites;
  const canManageUsersRoles = capabilities.canManageUsersRoles;

  const trend = useMemo(() => {
    const months = ["Gen", "Feb", "Mar", "Apr", "Mag", "Giu", "Lug", "Ago", "Set", "Ott", "Nov", "Dic"];
    const counts = new Array<number>(12).fill(0);
    queue.forEach((item) => {
      const date = new Date(item.updatedAt);
      if (!Number.isNaN(date.getTime())) counts[date.getMonth()] += 1;
    });
    const max = Math.max(1, ...counts);
    return counts.map((value, index) => ({
      month: months[index],
      value,
      widthPct: Math.round((value / max) * 100)
    }));
  }, [queue]);

  if (adminRole === "SUPER_ADMIN" || adminRole === "RESPONSABILE_ALBO" || adminRole === "REVISORE" || adminRole === "VIEWER") {
    return (
      <SuperAdminDashboardPage
        adminRole={adminRole}
        kpis={kpis}
        queue={queue}
        recentActivity={recentActivity}
        monthTrend={monthTrend}
        loading={loading || adminRoleLoading}
        canManageInvites={canManageInvites}
        canExportReports={capabilities.canExportReports}
        canAccessQueue={capabilities.canReadQueue}
      />
    );
  }

  return (
    <section className="stack">
      {toast ? <AppToast toast={toast} onClose={() => setToast(null)} className="admin-toast" /> : null}

      <div className="panel">
        <h2><BarChart3 className="h-5 w-5" /> Dashboard amministrativa</h2>
        <p className="subtle">KPI operativi, urgenze e coda candidature in un'unica vista.</p>
      </div>

      <div className="panel">
        <div className="home-hero-actions">
          <button type="button" className="home-btn home-btn-secondary" onClick={() => void loadDashboard()} disabled={loading}>
            <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} />
            {loading ? "Aggiornamento..." : "Aggiorna dashboard"}
          </button>
          {canManageInvites ? <Link className="home-btn home-btn-primary" to="/admin/invites/new">Invia invito</Link> : null}
          <Link className="home-btn home-btn-secondary" to="/admin/candidature">Apri coda review</Link>
          <Link className="home-btn home-btn-secondary" to="/admin/reports">Apri report</Link>
          {canManageUsersRoles ? <Link className="home-btn home-btn-secondary" to="/admin/users-roles">Utenti e ruoli</Link> : null}
        </div>
      </div>

      <div className="home-steps">
        <div className="panel home-step-card"><div className="home-step-head"><span className="home-step-index">1</span><h4>Totale fornitori</h4></div><p style={{ fontSize: "1.3rem", fontWeight: 800 }}>{kpis.totalSuppliers}</p></div>
        <div className="panel home-step-card"><div className="home-step-head"><span className="home-step-index">2</span><h4>Attivi</h4></div><p style={{ fontSize: "1.3rem", fontWeight: 800 }}>{kpis.activeSuppliers}</p></div>
        <div className="panel home-step-card"><div className="home-step-head"><span className="home-step-index">3</span><h4>In attesa</h4></div><p style={{ fontSize: "1.3rem", fontWeight: 800 }}>{kpis.pendingSuppliers}</p></div>
        <div className="panel home-step-card"><div className="home-step-head"><span className="home-step-index">4</span><h4>Invii candidature</h4></div><p style={{ fontSize: "1.3rem", fontWeight: 800 }}>{kpis.submittedApplications}</p></div>
        <div className="panel home-step-card"><div className="home-step-head"><span className="home-step-index">5</span><h4>Inviti pendenti</h4></div><p style={{ fontSize: "1.3rem", fontWeight: 800 }}>{kpis.pendingInvites}</p></div>
      </div>

      <div className="panel">
        <h4><AlertTriangle className="h-4 w-4" /> Alert urgenze</h4>
        {urgentCases.length === 0 ? <p className="subtle">Nessuna urgenza oltre 5 giorni.</p> : null}
        {urgentCases.length > 0 ? (
          <div className="stack">
            {urgentCases.slice(0, 8).map((item) => (
              <div key={item.id} className="home-step-card">
                <p><strong>Case {item.id}</strong> | App {item.applicationId}</p>
                <p className="subtle"><Clock3 className="h-4 w-4" /> Stato: {item.status} | giorni in coda: {daysSince(item.updatedAt)}</p>
                <div className="revamp-step-actions">
                  <Link className="home-inline-link home-inline-link-admin" to={`/admin/candidature/${item.applicationId}/review`}>
                    <span>Apri pratica</span>
                  </Link>
                </div>
              </div>
            ))}
          </div>
        ) : null}
      </div>

      <div className="panel">
        <h4>Trend candidature (attivita per mese)</h4>
        <div className="stack">
          {trend.map((row) => (
            <div key={row.month} className="home-step-card" style={{ padding: "0.45rem 0.65rem" }}>
              <p style={{ margin: 0 }}><strong>{row.month}</strong> | {row.value}</p>
              <div style={{ height: "8px", background: "#e6eef6", borderRadius: "999px", overflow: "hidden" }}>
                <div style={{ width: `${row.widthPct}%`, height: "100%", background: "#2f6da5" }} />
              </div>
            </div>
          ))}
        </div>
      </div>

      <div className="home-steps">
        <div className="panel home-step-card"><div className="home-step-head"><span className="home-step-index">Q</span><h4>Casi in coda</h4></div><p style={{ fontSize: "1.3rem", fontWeight: 800 }}>{queue.length}</p></div>
        <div className="panel home-step-card"><div className="home-step-head"><span className="home-step-index">P</span><h4>In corso</h4></div><p style={{ fontSize: "1.3rem", fontWeight: 800 }}>{inProgressCases.length}</p></div>
        <div className="panel home-step-card"><div className="home-step-head"><span className="home-step-index">W</span><h4>Attesa fornitore</h4></div><p style={{ fontSize: "1.3rem", fontWeight: 800 }}>{waitingCases.length}</p></div>
      </div>
    </section>
  );
}


