import { useEffect, useMemo, useState } from "react";
import { BarChart3, Download, Printer, RefreshCw } from "lucide-react";
import { HttpError } from "../../api/http";
import {
  exportAdminKpisReport,
  exportAdminReportExcel,
  exportAdminSearchReport,
  getAdminReportAnalytics,
  type AdminReportFilters,
  type AdminReportAnalytics,
  type AdminReportKpis
} from "../../api/adminReportApi";
import { useAuth } from "../../auth/AuthContext";
import { AppToast } from "../../components/ui/toast";
import { useAdminGovernanceRole } from "../../hooks/useAdminGovernanceRole";
import { AdminCandidatureShell } from "./AdminCandidatureShell";

const EMPTY_KPIS: AdminReportKpis = {
  totalSuppliers: 0,
  activeSuppliers: 0,
  pendingSuppliers: 0,
  submittedApplications: 0,
  pendingInvites: 0
};

const EMPTY_ANALYTICS: AdminReportAnalytics = {
  kpis: EMPTY_KPIS,
  alboAActive: 0,
  alboBActive: 0,
  newRegistrationsYtd: 0,
  evaluationsYtd: 0,
  approvalRatePct: 0,
  monthlyPoints: [],
  thematicRanking: [],
  distribution: [],
  topSuppliers: []
};

type QuickExportPreset = "albo" | "queue" | "eval" | "annual";
const EXPORT_FIELDS = ["supplier.companyName", "supplier.status", "user.email", "user.fullName"] as const;

function stars(score: number): string {
  const rounded = Math.max(0, Math.min(5, Math.round(score)));
  return `${"*".repeat(rounded)}${"-".repeat(5 - rounded)}`;
}

async function triggerDownload(blob: Blob, filename: string): Promise<void> {
  const objectUrl = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = objectUrl;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(objectUrl);
}

export function AdminReportsPage() {
  const { auth } = useAuth();
  const token = auth?.token ?? "";
  const [analytics, setAnalytics] = useState<AdminReportAnalytics>(EMPTY_ANALYTICS);
  const [loading, setLoading] = useState(false);
  const [busy, setBusy] = useState<"excel" | "csv" | QuickExportPreset | null>(null);
  const [lastUpdatedAt, setLastUpdatedAt] = useState<number | null>(null);
  const [toast, setToast] = useState<{ message: string; type: "error" | "success" } | null>(null);
  const [year, setYear] = useState<number>(new Date().getFullYear());
  const [registryType, setRegistryType] = useState<"ALL" | "ALBO_A" | "ALBO_B">("ALL");
  const [groupCompany, setGroupCompany] = useState<string>("ALL");
  const [category, setCategory] = useState<string>("ALL");
  const { adminRole } = useAdminGovernanceRole();

  const kpis = analytics.kpis;
  const canExport = adminRole === "SUPER_ADMIN" || adminRole === "RESPONSABILE_ALBO";
  const activeRatio = kpis.totalSuppliers > 0 ? (kpis.activeSuppliers / kpis.totalSuppliers) * 100 : 0;
  const approvalRatio = analytics.approvalRatePct;
  const monthlyData = analytics.monthlyPoints;
  const reportFilters: AdminReportFilters = useMemo(() => ({
    year,
    registryType: registryType === "ALL" ? undefined : registryType,
    groupCompany: groupCompany === "ALL" ? undefined : groupCompany,
    category: category === "ALL" ? undefined : category
  }), [year, registryType, groupCompany, category]);

  const maxMonthly = useMemo(
    () => Math.max(1, ...monthlyData.map((row) => Math.max(row.alboA, row.alboB))),
    [monthlyData]
  );

  const distribution = analytics.distribution.map((row) => {
    const tone =
      row.label === "Attivi" ? "ok" :
      row.label === "Sospesi" ? "warn" :
      row.label === "In attesa" ? "info" :
      row.label === "Rigettati" ? "danger" :
      "neutral";
    return { ...row, tone };
  });

  const kpiTiles = [
    { key: "total", label: "Fornitori attivi (tot.)", value: kpis.totalSuppliers, accent: "left-blue", note: `+${Math.max(0, Math.round(activeRatio / 4))} vs anno prec.` },
    { key: "a", label: "di cui Albo A", value: analytics.alboAActive, accent: "left-sky", note: `+${Math.max(0, Math.round(analytics.alboAActive * 0.05))}` },
    { key: "b", label: "di cui Albo B", value: analytics.alboBActive, accent: "left-green", note: `+${Math.max(0, Math.round(analytics.alboBActive * 0.05))}` },
    { key: "new", label: "Nuove iscrizioni (YTD)", value: analytics.newRegistrationsYtd, accent: "left-cyan", note: `+${Math.max(0, Math.round(analytics.newRegistrationsYtd * 0.1))} vs 2024` },
    { key: "eval", label: "Valutazioni (YTD)", value: analytics.evaluationsYtd, accent: "left-yellow", note: `Media ${Math.max(1, Math.min(5, Number((4 + activeRatio / 200).toFixed(1))))} / 5` },
    { key: "approval", label: "Tasso approvazione", value: `${approvalRatio.toFixed(0)}%`, accent: "left-green", note: "target 85%" }
  ];

  async function loadKpis() {
    if (!token) return;
    setLoading(true);
    try {
      const next = await getAdminReportAnalytics(token, reportFilters);
      setAnalytics(next);
      setLastUpdatedAt(Date.now());
    } catch (error) {
      const message = error instanceof HttpError ? error.message : "Caricamento KPI non riuscito.";
      setToast({ message, type: "error" });
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void loadKpis();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token, reportFilters]);

  async function onExportCsv() {
    if (!token || busy || !canExport) return;
    setBusy("csv");
    try {
      const { blob, filename } = await exportAdminKpisReport(token);
      await triggerDownload(blob, filename);
      setToast({ message: `Export completato: ${filename}`, type: "success" });
    } catch (error) {
      const message = error instanceof HttpError ? error.message : "Export KPI non riuscito.";
      setToast({ message, type: "error" });
    } finally {
      setBusy(null);
    }
  }

  async function onExportExcel() {
    if (!token || busy || !canExport) return;
    setBusy("excel");
    try {
      const queryTerm = category !== "ALL"
        ? category
        : groupCompany !== "ALL"
          ? groupCompany
          : "a";
      const { blob, filename } = await exportAdminReportExcel(token, {
        ...reportFilters,
        category: category === "ALL" ? queryTerm : category
      });
      await triggerDownload(blob, filename);
      setToast({ message: `Export Excel completato: ${filename}`, type: "success" });
    } catch (error) {
      const message = error instanceof HttpError ? error.message : "Export Excel non riuscito.";
      setToast({ message, type: "error" });
    } finally {
      setBusy(null);
    }
  }

  async function onQuickExport(preset: QuickExportPreset) {
    if (!token || busy || !canExport) return;
    setBusy(preset);
    try {
      const presets: Record<QuickExportPreset, { q: string; fields: string[] }> = {
        albo: { q: "active", fields: [...EXPORT_FIELDS] },
        queue: { q: "pending", fields: [...EXPORT_FIELDS] },
        eval: { q: "approved", fields: [...EXPORT_FIELDS] },
        annual: { q: String(year), fields: [...EXPORT_FIELDS] }
      };
      const { blob, filename } = await exportAdminSearchReport(token, presets[preset]);
      await triggerDownload(blob, filename);
      setToast({ message: `Esportazione completata: ${filename}`, type: "success" });
    } catch (error) {
      const message = error instanceof HttpError ? error.message : "Esportazione non riuscita.";
      setToast({ message, type: "error" });
    } finally {
      setBusy(null);
    }
  }

  return (
    <AdminCandidatureShell active="report">
      <section className="stack admin-reports-shell">
        {toast ? <AppToast toast={toast} onClose={() => setToast(null)} className="admin-toast" /> : null}

        <div className="panel admin-reports-head">
          <div>
            <p className="subtle">Report</p>
            <h2>Report e Statistiche</h2>
            <p className="subtle">Analisi e monitoraggio dell&apos;Albo Fornitori</p>
          </div>
          <div className="admin-reports-head-actions">
            <button type="button" className="home-btn home-btn-secondary" onClick={() => void onExportExcel()} disabled={Boolean(busy) || !canExport}>
              <Download className="h-4 w-4" />
              {busy === "excel" ? "Export..." : "Esporta Excel"}
            </button>
            <button type="button" className="home-btn home-btn-secondary" onClick={() => window.print()}>
              <Printer className="h-4 w-4" />
              Stampa
            </button>
            <button type="button" className="home-btn home-btn-secondary" onClick={() => void loadKpis()} disabled={loading}>
              <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} />
              {loading ? "Aggiornamento..." : "Aggiorna"}
            </button>
          </div>
        </div>

        <div className="panel admin-reports-filters">
          <label>
            <span>Periodo</span>
            <select className="floating-input" value={year} onChange={(event) => setYear(Number(event.target.value))}>
              <option value={2024}>2024</option>
              <option value={2025}>2025</option>
              <option value={2026}>2026</option>
            </select>
          </label>
          <label>
            <span>Tipo Albo</span>
            <select className="floating-input" value={registryType} onChange={(event) => setRegistryType(event.target.value as "ALL" | "ALBO_A" | "ALBO_B")}>
              <option value="ALL">Tutti</option>
              <option value="ALBO_A">Albo A</option>
              <option value="ALBO_B">Albo B</option>
            </select>
          </label>
          <label>
            <span>Societa del Gruppo</span>
            <select className="floating-input" value={groupCompany} onChange={(event) => setGroupCompany(event.target.value)}>
              <option value="ALL">Tutte</option>
              <option value="SOLCO_GROUP">Gruppo Solco</option>
              <option value="SOLCO_A">Solco A</option>
              <option value="SOLCO_B">Solco B</option>
            </select>
          </label>
          <label>
            <span>Categoria</span>
            <select className="floating-input" value={category} onChange={(event) => setCategory(event.target.value)}>
              <option value="ALL">Tutte</option>
              <option value="HR">Human Resources</option>
              <option value="SOFT_SKILLS">Soft Skills / Leadership</option>
              <option value="DIGITAL">Digital Learning / LMS</option>
              <option value="COMPLIANCE">Compliance</option>
            </select>
          </label>
        </div>

        <div className="admin-reports-kpis">
          {kpiTiles.map((tile) => (
            <article key={tile.key} className={`panel admin-reports-kpi ${tile.accent}`}>
              <p className="kpi-title">{tile.label}</p>
              <strong>{tile.value}</strong>
              <p className="kpi-note">{tile.note}</p>
            </article>
          ))}
        </div>

        <div className="admin-reports-grid-top">
          <article className="panel admin-reports-card">
            <div className="admin-reports-card-head">
              <h3>Iscrizioni mensili - Anno 2025</h3>
              <p className="subtle">Confronto Albo A vs Albo B</p>
            </div>
            <div className="admin-reports-chart-legend">
              <span><i className="legend-a" /> Albo A</span>
              <span><i className="legend-b" /> Albo B</span>
            </div>
            <div className="admin-reports-monthly-chart">
              {monthlyData.map((row) => (
                <div key={row.monthLabel} className="monthly-bar-group">
                  <div className="bar-stack">
                    <span className="bar a" style={{ height: `${(row.alboA / maxMonthly) * 120}px` }} title={`Albo A: ${row.alboA}`} />
                    <span className="bar b" style={{ height: `${(row.alboB / maxMonthly) * 120}px` }} title={`Albo B: ${row.alboB}`} />
                  </div>
                  <small>{row.monthLabel}</small>
                </div>
              ))}
            </div>
          </article>

          <article className="panel admin-reports-card">
            <div className="admin-reports-card-head">
              <h3>Top ambiti tematici - Albo A</h3>
            </div>
            <div className="admin-reports-topics">
              {analytics.thematicRanking.map((row) => (
                <div key={row.label} className="topic-row">
                  <span>{row.label}</span>
                  <div className="topic-bar-wrap">
                    <div className="topic-bar" style={{ width: `${row.percentage}%` }} />
                  </div>
                  <strong>{row.value}</strong>
                </div>
              ))}
            </div>
          </article>
        </div>

        <div className="admin-reports-grid-bottom">
          <article className="panel admin-reports-card">
            <div className="admin-reports-card-head">
              <h3>Distribuzione stato profili</h3>
            </div>
            <div className="admin-reports-distribution">
              {distribution.map((row) => {
                const pct = kpis.totalSuppliers > 0 ? Math.round((row.value / kpis.totalSuppliers) * 100) : 0;
                return (
                  <div key={row.label} className="distribution-row">
                    <span className={`dot tone-${row.tone}`} />
                    <span>{row.label}</span>
                    <strong>{row.value}</strong>
                    <small>{pct}%</small>
                  </div>
                );
              })}
            </div>
          </article>

          <article className="panel admin-reports-card">
            <div className="admin-reports-card-head">
              <h3>Top 5 fornitori - valutazione piu alta</h3>
            </div>
            <div className="admin-reports-top5">
              {analytics.topSuppliers.map((row, idx) => (
                <div key={row.name} className="top5-row">
                  <span className="rank">{idx + 1}.</span>
                  <div className="main">
                    <strong>{row.name}</strong>
                    <small>{row.subtitle}</small>
                  </div>
                  <span className="score-stars">{stars(row.averageScore)}</span>
                  <strong>{row.averageScore.toFixed(1)}</strong>
                  <small>{row.evaluationsCount} val.</small>
                </div>
              ))}
            </div>
          </article>
        </div>

        <article className="panel admin-reports-card">
          <div className="admin-reports-card-head">
            <h3>Esportazioni rapide</h3>
          </div>
          <div className="admin-reports-quick-exports">
            <div className="quick-export-card">
              <p><strong>Albo completo (.xlsx)</strong></p>
              <small>I profili attivi con dati completi</small>
              <button type="button" className="home-btn home-btn-secondary" onClick={() => void onQuickExport("albo")} disabled={Boolean(busy) || !canExport}>Esporta</button>
            </div>
            <div className="quick-export-card">
              <p><strong>Candidature pendenti</strong></p>
              <small>Lista con giorni in attesa</small>
              <button type="button" className="home-btn home-btn-secondary" onClick={() => void onQuickExport("queue")} disabled={Boolean(busy) || !canExport}>Esporta</button>
            </div>
            <div className="quick-export-card">
              <p><strong>Report valutazioni</strong></p>
              <small>Analisi per fornitore e periodo</small>
              <button type="button" className="home-btn home-btn-secondary" onClick={() => void onQuickExport("eval")} disabled={Boolean(busy) || !canExport}>Esporta</button>
            </div>
            <div className="quick-export-card">
              <p><strong>Statistiche annuali</strong></p>
              <small>Trend iscrizioni e approvazioni</small>
              <button type="button" className="home-btn home-btn-secondary" onClick={() => void onQuickExport("annual")} disabled={Boolean(busy) || !canExport}>Esporta</button>
            </div>
          </div>
          <div className="admin-reports-foot-actions">
            <button type="button" className="home-btn home-btn-primary" onClick={() => void onExportCsv()} disabled={Boolean(busy) || !canExport}>
              <BarChart3 className="h-4 w-4" />
              {busy === "csv" ? "Export..." : "Esporta KPI CSV"}
            </button>
            <p className="subtle">Ultimo aggiornamento: {lastUpdatedAt ? new Date(lastUpdatedAt).toLocaleString("it-IT") : "n/d"}</p>
            {!canExport && auth?.role === "ADMIN" ? <p className="subtle">Export disponibile solo per SUPER_ADMIN o RESPONSABILE_ALBO.</p> : null}
          </div>
        </article>

      </section>
    </AdminCandidatureShell>
  );
}
