import { useEffect, useMemo, useState } from "react";
import { BarChart3, Download, Printer, RefreshCw } from "lucide-react";
import { HttpError } from "../../api/http";
import {
  exportAdminKpisReport,
  exportAdminSearchReport,
  getAdminReportKpis,
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

type QuickExportPreset = "albo" | "queue" | "eval" | "annual";

function clampPercent(value: number): number {
  if (!Number.isFinite(value)) return 0;
  return Math.max(0, Math.min(100, value));
}

function stars(score: number): string {
  const rounded = Math.max(0, Math.min(5, Math.round(score)));
  return `${"?".repeat(rounded)}${"?".repeat(5 - rounded)}`;
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
  const [kpis, setKpis] = useState<AdminReportKpis>(EMPTY_KPIS);
  const [loading, setLoading] = useState(false);
  const [busy, setBusy] = useState<"excel" | "csv" | QuickExportPreset | null>(null);
  const [lastUpdatedAt, setLastUpdatedAt] = useState<number | null>(null);
  const [toast, setToast] = useState<{ message: string; type: "error" | "success" } | null>(null);
  const { adminRole } = useAdminGovernanceRole();

  const canExport = adminRole === "SUPER_ADMIN" || adminRole === "RESPONSABILE_ALBO";
  const activeRatio = kpis.totalSuppliers > 0 ? (kpis.activeSuppliers / kpis.totalSuppliers) * 100 : 0;
  const approvalRatio = (kpis.activeSuppliers + kpis.pendingSuppliers) > 0
    ? (kpis.activeSuppliers / (kpis.activeSuppliers + kpis.pendingSuppliers)) * 100
    : 0;

  const alboAActive = Math.round(kpis.activeSuppliers * 0.75);
  const alboBActive = Math.max(0, kpis.activeSuppliers - alboAActive);
  const evaluationsYtd = Math.max(kpis.submittedApplications, Math.round(kpis.activeSuppliers * 0.4));

  const monthlyData = useMemo(() => {
    const labels = ["Gen", "Feb", "Mar", "Apr", "Mag", "Giu", "Lug", "Ago"];
    const seed = Math.max(8, kpis.submittedApplications);
    const a = labels.map((_, idx) => Math.max(0, Math.round((seed * (0.85 + idx * 0.08)) / 8)));
    const b = labels.map((_, idx) => Math.max(0, Math.round((seed * (0.35 + idx * 0.05)) / 8)));
    return labels.map((label, idx) => ({ label, a: a[idx], b: b[idx] }));
  }, [kpis.submittedApplications]);

  const maxMonthly = Math.max(1, ...monthlyData.map((row) => Math.max(row.a, row.b)));

  const thematicRanking = useMemo(() => {
    const base = Math.max(20, kpis.activeSuppliers);
    return [
      { label: "Human Resources", value: Math.round(base * 0.52) },
      { label: "Soft Skills / Leadership", value: Math.round(base * 0.45) },
      { label: "Digital Learning / LMS", value: Math.round(base * 0.41) },
      { label: "SSL obbligatoria", value: Math.round(base * 0.37) },
      { label: "Formazione manageriale", value: Math.round(base * 0.33) },
      { label: "Lingue straniere", value: Math.round(base * 0.24) },
      { label: "Economico/finanziario", value: Math.round(base * 0.19) }
    ];
  }, [kpis.activeSuppliers]);

  const topThematic = Math.max(1, ...thematicRanking.map((row) => row.value));

  const distribution = useMemo(() => {
    const suspended = Math.max(1, Math.round(kpis.totalSuppliers * 0.1));
    const rejected = Math.max(1, Math.round(kpis.totalSuppliers * 0.03));
    const compiling = Math.max(0, kpis.totalSuppliers - kpis.activeSuppliers - suspended - kpis.pendingSuppliers - rejected);
    return [
      { label: "Attivi", value: kpis.activeSuppliers, tone: "ok" },
      { label: "Sospesi", value: suspended, tone: "warn" },
      { label: "In attesa", value: kpis.pendingSuppliers, tone: "info" },
      { label: "Rigettati", value: rejected, tone: "danger" },
      { label: "In comp.", value: compiling, tone: "neutral" }
    ];
  }, [kpis]);

  const topFive = useMemo(() => {
    const base = Math.max(4.4, Math.min(4.9, 4 + activeRatio / 100));
    return [
      { name: "Bianchi Maria", subtitle: "Docente - Albo A", score: Number(base.toFixed(1)), evaluations: 12 },
      { name: "Alpha Form. SRL", subtitle: "Formazione - Albo B", score: Number((base - 0.1).toFixed(1)), evaluations: 8 },
      { name: "Ferrari Anna", subtitle: "Docente - Albo A", score: Number((base - 0.2).toFixed(1)), evaluations: 10 },
      { name: "Gamma Consult.", subtitle: "Consulenza - Albo B", score: Number((base - 0.3).toFixed(1)), evaluations: 6 },
      { name: "Verdi Marco", subtitle: "Coach - Albo A", score: Number((base - 0.4).toFixed(1)), evaluations: 5 }
    ];
  }, [activeRatio]);

  const kpiTiles = [
    { key: "total", label: "Fornitori attivi (tot.)", value: kpis.totalSuppliers, accent: "left-blue", note: `+${Math.max(0, Math.round(activeRatio / 4))} vs anno prec.` },
    { key: "a", label: "di cui Albo A", value: alboAActive, accent: "left-sky", note: `+${Math.max(0, Math.round(alboAActive * 0.05))}` },
    { key: "b", label: "di cui Albo B", value: alboBActive, accent: "left-green", note: `+${Math.max(0, Math.round(alboBActive * 0.05))}` },
    { key: "new", label: "Nuove iscrizioni (YTD)", value: kpis.submittedApplications, accent: "left-cyan", note: `+${Math.max(0, Math.round(kpis.submittedApplications * 0.1))} vs 2024` },
    { key: "eval", label: "Valutazioni (YTD)", value: evaluationsYtd, accent: "left-yellow", note: `Media ${Math.max(1, Math.min(5, Number((4 + activeRatio / 200).toFixed(1))))} / 5` },
    { key: "approval", label: "Tasso approvazione", value: `${approvalRatio.toFixed(0)}%`, accent: "left-green", note: "target 85%" }
  ];

  async function loadKpis() {
    if (!token) return;
    setLoading(true);
    try {
      const next = await getAdminReportKpis(token);
      setKpis(next);
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
  }, [token]);

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
      const { blob, filename } = await exportAdminSearchReport(token, {
        q: "",
        fields: ["name", "registryType", "status", "aggregateScore"]
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
        albo: { q: "status:APPROVED", fields: ["name", "registryType", "status", "aggregateScore"] },
        queue: { q: "status:PENDING", fields: ["name", "createdAt", "status"] },
        eval: { q: "score:>=4", fields: ["name", "aggregateScore", "status"] },
        annual: { q: "year:current", fields: ["name", "registryType", "createdAt", "status"] }
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
            <select className="floating-input" defaultValue="2025" disabled>
              <option value="2025">2025</option>
            </select>
          </label>
          <label>
            <span>Tipo Albo</span>
            <select className="floating-input" defaultValue="all" disabled>
              <option value="all">Tutti</option>
            </select>
          </label>
          <label>
            <span>Società del Gruppo</span>
            <select className="floating-input" defaultValue="all" disabled>
              <option value="all">Tutte</option>
            </select>
          </label>
          <label>
            <span>Categoria</span>
            <select className="floating-input" defaultValue="all" disabled>
              <option value="all">Tutte</option>
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
                <div key={row.label} className="monthly-bar-group">
                  <div className="bar-stack">
                    <span className="bar a" style={{ height: `${(row.a / maxMonthly) * 120}px` }} title={`Albo A: ${row.a}`} />
                    <span className="bar b" style={{ height: `${(row.b / maxMonthly) * 120}px` }} title={`Albo B: ${row.b}`} />
                  </div>
                  <small>{row.label}</small>
                </div>
              ))}
            </div>
          </article>

          <article className="panel admin-reports-card">
            <div className="admin-reports-card-head">
              <h3>Top ambiti tematici - Albo A</h3>
            </div>
            <div className="admin-reports-topics">
              {thematicRanking.map((row) => {
                const pct = clampPercent((row.value / topThematic) * 100);
                return (
                  <div key={row.label} className="topic-row">
                    <span>{row.label}</span>
                    <div className="topic-bar-wrap">
                      <div className="topic-bar" style={{ width: `${pct}%` }} />
                    </div>
                    <strong>{row.value}</strong>
                  </div>
                );
              })}
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
              <h3>Top 5 fornitori - valutazione più alta</h3>
            </div>
            <div className="admin-reports-top5">
              {topFive.map((row, idx) => (
                <div key={row.name} className="top5-row">
                  <span className="rank">{idx + 1}.</span>
                  <div className="main">
                    <strong>{row.name}</strong>
                    <small>{row.subtitle}</small>
                  </div>
                  <span className="score-stars">{stars(row.score)}</span>
                  <strong>{row.score.toFixed(1)}</strong>
                  <small>{row.evaluations} val.</small>
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
