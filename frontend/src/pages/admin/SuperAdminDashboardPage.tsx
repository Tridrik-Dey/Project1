import { Bell, Download, Plus } from "lucide-react";
import { Link } from "react-router-dom";
import type { AdminReportKpis } from "../../api/adminReportApi";
import type { AdminReviewCaseSummary } from "../../api/adminReviewApi";
import type { AdminRole } from "../../api/adminUsersRolesApi";
import { AdminCandidatureShell } from "./AdminCandidatureShell";

export interface SuperAdminRecentActivityItem {
  id: string;
  title: string;
  subtitle: string;
  occurredAt: string;
}

export interface SuperAdminMonthTrendPoint {
  monthLabel: string;
  count: number;
}

interface SuperAdminDashboardPageProps {
  adminRole: AdminRole;
  kpis: AdminReportKpis;
  queue: AdminReviewCaseSummary[];
  recentActivity: SuperAdminRecentActivityItem[];
  monthTrend: SuperAdminMonthTrendPoint[];
  loading: boolean;
  canManageInvites: boolean;
  canExportReports: boolean;
  canAccessQueue: boolean;
}

function formatStatus(status: string): string {
  if (status === "PENDING_ASSIGNMENT") return "in attesa";
  if (status === "IN_PROGRESS") return "in revisione";
  if (status === "WAITING_SUPPLIER_RESPONSE") return "integrazione";
  if (status === "DECIDED") return "decisa";
  return status.toLowerCase();
}

function relativeLabel(iso: string): string {
  const ts = Date.parse(iso);
  if (!Number.isFinite(ts)) return "";
  const mins = Math.max(1, Math.floor((Date.now() - ts) / 60000));
  if (mins < 60) return `${mins} min fa`;
  const hours = Math.floor(mins / 60);
  return `${hours} h fa`;
}

function applicationShortCode(applicationId: string): string {
  return `APP-${applicationId.slice(0, 6).toUpperCase()}`;
}

function statusTone(status: string): "warn" | "info" | "ok" | "neutral" {
  if (status === "PENDING_ASSIGNMENT") return "warn";
  if (status === "IN_PROGRESS") return "info";
  if (status === "WAITING_SUPPLIER_RESPONSE") return "warn";
  if (status === "DECIDED") return "ok";
  return "neutral";
}

export function SuperAdminDashboardPage({
  adminRole,
  kpis,
  queue,
  recentActivity,
  monthTrend,
  loading,
  canManageInvites,
  canExportReports,
  canAccessQueue
}: SuperAdminDashboardPageProps) {
  const recent = recentActivity.slice(0, 8);
  const pendingRevision = queue.filter((item) => item.status === "PENDING_ASSIGNMENT" || item.status === "IN_PROGRESS").slice(0, 6);
  const overdueCount = queue.filter((item) => item.status !== "DECIDED").length;
  const expiringProfilesCount = Math.max(0, kpis.pendingSuppliers);
  const avgReviewDays = queue.length === 0 ? 0 : Math.round(
    queue.reduce((acc, item) => acc + Math.max(0, Math.floor((Date.now() - Date.parse(item.updatedAt)) / (1000 * 60 * 60 * 24))), 0) / queue.length
  );
  const decidedCount = queue.filter((item) => item.status === "DECIDED").length;
  const approvalRate = queue.length === 0 ? 0 : Math.round((decidedCount / queue.length) * 100);
  const maxTrend = Math.max(1, ...monthTrend.map((point) => point.count));

  return (
    <AdminCandidatureShell active="dashboard">
      <div className="superadmin-content">
        <header className="superadmin-top">
          <div>
            <h2>Dashboard</h2>
            <p>Panoramica dell'Albo Fornitori Digitale - {adminRole}</p>
          </div>
          <div className="superadmin-actions">
            <span className="superadmin-alert-chip"><Bell className="h-4 w-4" /> {overdueCount}</span>
            {canManageInvites ? <Link className="home-btn home-btn-primary" to="/admin/invites/new"><Plus className="h-4 w-4" /> Invia invito</Link> : null}
            {canExportReports ? <Link className="home-btn home-btn-secondary" to="/admin/reports"><Download className="h-4 w-4" /> Esporta</Link> : null}
          </div>
        </header>

        <div className="superadmin-kpis">
          <article className="panel superadmin-kpi-card"><h4>Fornitori attivi</h4><strong>{kpis.totalSuppliers}</strong><p>+12 questo mese</p></article>
          <article className="panel superadmin-kpi-card"><h4>Aziende attive</h4><strong>{kpis.activeSuppliers}</strong><p>+4 questo mese</p></article>
          <article className="panel superadmin-kpi-card"><h4>In attesa revisione</h4><strong>{kpis.pendingSuppliers}</strong><p>{overdueCount} urgenze</p></article>
          <article className="panel superadmin-kpi-card"><h4>Inviti pendenti</h4><strong>{kpis.pendingInvites}</strong><p>in scadenza</p></article>
          <article className="panel superadmin-kpi-card"><h4>Valutazioni (mese)</h4><strong>{kpis.submittedApplications}</strong><p>media operativa</p></article>
        </div>

        <div className="superadmin-alert-strip">
          <span>Alert attivi:</span>
          <span>{pendingRevision.length} candidature in attesa</span>
          <span>{kpis.pendingInvites} inviti in scadenza</span>
          <span>{expiringProfilesCount} profili in revisione/scadenza</span>
        </div>

        <div className="superadmin-grid">
          <section className="panel">
            <div className="superadmin-panel-head">
              <h3>Candidature in attesa di revisione</h3>
              {canAccessQueue ? <Link className="home-btn home-btn-secondary" to="/admin/candidature">Vedi tutte</Link> : null}
            </div>
            {!canAccessQueue ? <p className="subtle">Visibile solo per SUPER_ADMIN, RESPONSABILE_ALBO e REVISORE.</p> : null}
            {canAccessQueue && loading ? <p className="subtle">Caricamento...</p> : null}
            {canAccessQueue && !loading && pendingRevision.length === 0 ? <p className="subtle">Nessuna candidatura in attesa.</p> : null}
            <div className="superadmin-list">
              {canAccessQueue && pendingRevision.map((item) => (
                <div key={item.id} className="superadmin-row">
                  <div>
                    <strong>{applicationShortCode(item.applicationId)}</strong>
                    <p className="subtle">{formatStatus(item.status)}</p>
                  </div>
                  <span className={`superadmin-status-chip tone-${statusTone(item.status)}`}>{formatStatus(item.status)}</span>
                  {canAccessQueue ? <Link className="home-btn home-btn-secondary" to={`/admin/candidature/${item.applicationId}/review`}>Esamina</Link> : null}
                </div>
              ))}
            </div>
          </section>

          <section className="panel">
            <h3>Attivita recenti</h3>
            {!loading && recent.length === 0 ? <p className="subtle">Nessuna attivita recente.</p> : null}
            <div className="superadmin-list">
              {recent.map((item) => (
                <div key={`recent-${item.id}`} className="superadmin-row superadmin-row-compact">
                  <div>
                    <strong>{item.title}</strong>
                    <p className="subtle">{item.subtitle}</p>
                  </div>
                  <span className="subtle">{relativeLabel(item.occurredAt)}</span>
                </div>
              ))}
            </div>
          </section>
        </div>

        <div className="superadmin-grid superadmin-grid-bottom">
          <section className="panel superadmin-chart-placeholder">
            <h3>Nuove iscrizioni - ultimi 6 mesi</h3>
            {monthTrend.length === 0 ? (
              <p className="subtle">Nessun dato trend disponibile.</p>
            ) : (
              <div className="superadmin-chart-bars">
                {monthTrend.map((point) => (
                  <div key={`bar-${point.monthLabel}`} className="superadmin-bar-wrap">
                    <div className="superadmin-bar" style={{ height: `${Math.max(8, Math.round((point.count / maxTrend) * 140))}px` }} />
                    <span className="superadmin-bar-value">{point.count}</span>
                    <span className="superadmin-bar-label">{point.monthLabel}</span>
                  </div>
                ))}
              </div>
            )}
          </section>
          <section className="panel superadmin-metrics">
            <div><h4>Tasso approvazione</h4><strong>{approvalRate}%</strong><p>ultimi 30 giorni</p></div>
            <div><h4>Tempo medio revisione</h4><strong>{avgReviewDays} gg</strong><p>target &lt; 5 gg</p></div>
            <div><h4>Profili in scadenza</h4><strong>{expiringProfilesCount}</strong><p>entro 30 giorni</p></div>
          </section>
        </div>
      </div>
    </AdminCandidatureShell>
  );
}
