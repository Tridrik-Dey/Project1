import { FormEvent, useEffect, useMemo, useState } from "react";
import { Activity, Plus, RefreshCw, Search, Star } from "lucide-react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { HttpError } from "../../api/http";
import {
  createAdminEvaluation,
  getAdminEvaluationAnalytics,
  getAdminEvaluationOverview,
  type AdminEvaluationAnalytics,
  type AdminEvaluationOverview,
  type AdminEvaluationOverviewFilters
} from "../../api/adminEvaluationApi";
import { useAuth } from "../../auth/AuthContext";
import { AppToast } from "../../components/ui/toast";
import { AdminCandidatureShell } from "./AdminCandidatureShell";

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

type AdminEvaluationsPageProps = {
  mode: "search" | "detail" | "new";
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

const DIMENSIONS: Array<{ key: string; label: string; short: string }> = [
  { key: "quality", label: "Qualita tecnica / contenutistica", short: "Q" },
  { key: "timeliness", label: "Rispetto dei tempi e delle consegne", short: "T" },
  { key: "communication", label: "Comunicazione e disponibilita", short: "C" },
  { key: "flexibility", label: "Flessibilita e problem solving", short: "F" },
  { key: "value", label: "Rapporto qualita / prezzo", short: "P" }
];

function stars(value: number): string {
  const rounded = Math.max(0, Math.min(5, Math.round(value)));
  return `${"★".repeat(rounded)}${"☆".repeat(5 - rounded)}`;
}

function normalizeTypeLabel(value: string | null | undefined): string {
  if (!value) return "-";
  if (value === "ALBO_A") return "Docente";
  if (value === "ALBO_B") return "Azienda";
  return value;
}

function scorePct(score: number): number {
  return Math.max(0, Math.min(100, (score / 5) * 100));
}

function formatDate(value: string | null | undefined): string {
  if (!value) return "-";
  const ts = Date.parse(value);
  if (!Number.isFinite(ts)) return "-";
  return new Date(ts).toLocaleDateString("it-IT");
}

function toMinScore(value: string): number | undefined {
  if (!value.trim()) return undefined;
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return undefined;
  return Math.max(0, Math.min(5, parsed));
}

function StarInput({ value, onChange, required = false }: { value: number; onChange: (value: number) => void; required?: boolean }) {
  return (
    <div className="eval-star-input" role="group" aria-label="Valutazione a stelle">
      {[1, 2, 3, 4, 5].map((star) => (
        <button
          key={star}
          type="button"
          className={star <= value ? "on" : ""}
          onClick={() => onChange(star)}
          aria-label={`${star} stelle`}
        >
          ★
        </button>
      ))}
      <strong>{required ? `${value || 0}/5` : value > 0 ? `${value}/5` : "Opzionale"}</strong>
    </div>
  );
}

export function AdminEvaluationsPage({ mode }: AdminEvaluationsPageProps) {
  const { supplierId: routeSupplierId } = useParams();
  const navigate = useNavigate();
  const { auth } = useAuth();
  const token = auth?.token ?? "";

  const [overviewFilters, setOverviewFilters] = useState({ q: "", type: "ALL", period: "", minScore: "", evaluator: "" });
  const [appliedFilters, setAppliedFilters] = useState<AdminEvaluationOverviewFilters>({ limit: 200 });
  const [overview, setOverview] = useState<AdminEvaluationOverview>(EMPTY_OVERVIEW);
  const [analytics, setAnalytics] = useState<AdminEvaluationAnalytics>(EMPTY_ANALYTICS);
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [toast, setToast] = useState<{ message: string; type: "error" | "success" } | null>(null);

  const [formSupplierId, setFormSupplierId] = useState(routeSupplierId ?? "");
  const [overallScore, setOverallScore] = useState(0);
  const [dimensions, setDimensions] = useState<Record<string, number>>({ quality: 0, timeliness: 0, communication: 0, flexibility: 0, value: 0 });
  const [collaborationType, setCollaborationType] = useState("Docenza in aula");
  const [collaborationPeriod, setCollaborationPeriod] = useState("");
  const [referenceCode, setReferenceCode] = useState("");
  const [comment, setComment] = useState("");

  const resolvedSupplierId = useMemo(() => {
    if (mode === "new") return formSupplierId.trim();
    if (mode === "detail") return (routeSupplierId ?? "").trim();
    return "";
  }, [formSupplierId, mode, routeSupplierId]);

  const detailValid = UUID_PATTERN.test(resolvedSupplierId);

  async function loadOverview(filters: AdminEvaluationOverviewFilters) {
    if (!token) return;
    setLoading(true);
    try {
      const data = await getAdminEvaluationOverview(token, filters);
      setOverview(data);
    } catch (error) {
      const message = error instanceof HttpError ? error.message : "Caricamento valutazioni non riuscito.";
      setToast({ message, type: "error" });
      setOverview(EMPTY_OVERVIEW);
    } finally {
      setLoading(false);
    }
  }

  async function loadAnalytics(supplierId: string) {
    if (!token || !UUID_PATTERN.test(supplierId)) return;
    setLoading(true);
    try {
      const data = await getAdminEvaluationAnalytics(supplierId, token);
      setAnalytics(data);
    } catch (error) {
      const message = error instanceof HttpError ? error.message : "Caricamento dettaglio valutazioni non riuscito.";
      setToast({ message, type: "error" });
      setAnalytics(EMPTY_ANALYTICS);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    if (mode !== "search") return;
    void loadOverview(appliedFilters);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mode, token, appliedFilters.q, appliedFilters.type, appliedFilters.period, appliedFilters.minScore, appliedFilters.evaluator]);

  useEffect(() => {
    if ((mode === "detail" || mode === "new") && detailValid) {
      void loadAnalytics(resolvedSupplierId);
    } else if (mode === "detail") {
      setAnalytics(EMPTY_ANALYTICS);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mode, resolvedSupplierId, detailValid, token]);

  function applyFilters(event: FormEvent) {
    event.preventDefault();
    setAppliedFilters({
      q: overviewFilters.q.trim() || undefined,
      type: overviewFilters.type === "ALL" ? undefined : overviewFilters.type,
      period: overviewFilters.period.trim() || undefined,
      minScore: toMinScore(overviewFilters.minScore),
      evaluator: overviewFilters.evaluator.trim() || undefined,
      limit: 200
    });
  }

  function resetFilters() {
    setOverviewFilters({ q: "", type: "ALL", period: "", minScore: "", evaluator: "" });
    setAppliedFilters({ limit: 200 });
  }

  async function onSubmitEvaluation(event: FormEvent) {
    event.preventDefault();
    if (!token) return;
    const supplierId = formSupplierId.trim();
    if (!UUID_PATTERN.test(supplierId)) {
      setToast({ message: "Inserisci supplier ID valido (UUID).", type: "error" });
      return;
    }
    if (overallScore < 1 || overallScore > 5) {
      setToast({ message: "Imposta il punteggio complessivo (1-5).", type: "error" });
      return;
    }
    if (!collaborationType.trim() || !collaborationPeriod.trim()) {
      setToast({ message: "Tipo collaborazione e periodo sono obbligatori.", type: "error" });
      return;
    }

    const selectedDimensions = Object.entries(dimensions)
      .filter(([, value]) => value > 0)
      .reduce<Record<string, number>>((acc, [key, value]) => {
        acc[key] = value;
        return acc;
      }, {});

    setSubmitting(true);
    try {
      await createAdminEvaluation({
        supplierRegistryProfileId: supplierId,
        overallScore,
        collaborationType: collaborationType.trim(),
        collaborationPeriod: collaborationPeriod.trim(),
        referenceCode: referenceCode.trim() || undefined,
        comment: comment.trim() || undefined,
        dimensions: selectedDimensions
      }, token);
      setToast({ message: "Valutazione inserita con successo.", type: "success" });
      navigate(`/admin/evaluations/${supplierId}`);
    } catch (error) {
      const message = error instanceof HttpError ? error.message : "Inserimento valutazione non riuscito.";
      setToast({ message, type: "error" });
    } finally {
      setSubmitting(false);
    }
  }

  const overviewRows = overview.rows;
  const topRows = analytics.history.slice(0, 12);
  const scoreDistribution = [5, 4, 3, 2, 1].map((bucket) => {
    const count = analytics.scoreDistribution[String(bucket)] ?? analytics.scoreDistribution[bucket] ?? 0;
    const pct = analytics.totalEvaluations > 0 ? Math.round((count / analytics.totalEvaluations) * 100) : 0;
    return { bucket, count, pct };
  });

  return (
    <AdminCandidatureShell active="valutazioni">
      <section className="stack admin-evaluations-shell">
        {toast ? <AppToast toast={toast} onClose={() => setToast(null)} className="admin-toast" /> : null}

        {mode === "search" ? (
          <>
            <div className="panel admin-evaluations-head">
              <div>
                <h2>Valutazioni</h2>
                <p className="subtle">Gestisci e monitora le valutazioni dei fornitori</p>
              </div>
              <Link className="home-btn home-btn-primary" to="/admin/evaluations/new">
                <Plus className="h-4 w-4" />
                Nuova valutazione
              </Link>
            </div>

            <div className="admin-evaluations-kpis">
              <article className="panel admin-eval-kpi"><p className="kpi-title">Valutazioni totali</p><strong>{overview.totalEvaluations}</strong><p className="kpi-note">storico completo</p></article>
              <article className="panel admin-eval-kpi"><p className="kpi-title">Media complessiva</p><strong>{overview.averageOverallScore.toFixed(1)}</strong><p className="kpi-note">su tutti i fornitori</p></article>
              <article className="panel admin-eval-kpi"><p className="kpi-title">Questo mese</p><strong>{overview.currentMonthEvaluations}</strong><p className="kpi-note">valutazioni inserite</p></article>
              <article className="panel admin-eval-kpi"><p className="kpi-title">Fornitori valutati</p><strong>{overview.evaluatedSuppliers}</strong><p className="kpi-note">con almeno 1 valutazione</p></article>
            </div>

            <form className="panel admin-evaluations-filters" onSubmit={applyFilters}>
              <input className="floating-input" placeholder="Cerca fornitore..." value={overviewFilters.q} onChange={(e) => setOverviewFilters((prev) => ({ ...prev, q: e.target.value }))} />
              <select className="floating-input" value={overviewFilters.type} onChange={(e) => setOverviewFilters((prev) => ({ ...prev, type: e.target.value }))}>
                <option value="ALL">Tipologia: Tutti</option>
                <option value="ALBO_A">Docente</option>
                <option value="ALBO_B">Azienda</option>
              </select>
              <input className="floating-input" placeholder="Periodo (es. Marzo 2025)" value={overviewFilters.period} onChange={(e) => setOverviewFilters((prev) => ({ ...prev, period: e.target.value }))} />
              <input className="floating-input" placeholder="Punteggio minimo (1-5)" value={overviewFilters.minScore} onChange={(e) => setOverviewFilters((prev) => ({ ...prev, minScore: e.target.value }))} />
              <input className="floating-input" placeholder="Valutatore" value={overviewFilters.evaluator} onChange={(e) => setOverviewFilters((prev) => ({ ...prev, evaluator: e.target.value }))} />
              <button type="submit" className="home-btn home-btn-secondary"><Search className="h-4 w-4" /> Filtra</button>
              <button type="button" className="home-btn home-btn-secondary" onClick={resetFilters}>Reset</button>
              <button type="button" className="home-btn home-btn-secondary" onClick={() => void loadOverview(appliedFilters)} disabled={loading}><RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} /> Aggiorna</button>
            </form>

            <div className="panel admin-evaluations-table-wrap">
              <div className="admin-evaluations-row admin-evaluations-row-head">
                <span>Fornitore</span><span>Tipo</span><span>Data</span><span>Periodo</span><span>Commento</span><span>Dimensioni</span><span>Media</span><span>Azioni</span>
              </div>
              {loading ? <p className="subtle">Caricamento...</p> : null}
              {!loading && overviewRows.length === 0 ? <p className="subtle">Nessuna valutazione trovata.</p> : null}
              {!loading && overviewRows.map((row) => (
                <div key={row.evaluationId} className="admin-evaluations-row">
                  <div>
                    <strong>{row.supplierName || "Fornitore"}</strong>
                    <p className="subtle">Val: {row.evaluatorDisplay || "n/d"}</p>
                  </div>
                  <span>{normalizeTypeLabel(row.supplierType)}</span>
                  <span>{formatDate(row.createdAt)}</span>
                  <span>{row.collaborationPeriod || "-"}</span>
                  <span className="truncate-cell">{row.comment || "-"}</span>
                  <div className="eval-mini-bars">
                    {DIMENSIONS.slice(0, 4).map((dim) => {
                      const val = row.dimensionScores[dim.label] ?? row.dimensionScores[dim.key] ?? 0;
                      return (
                        <div key={`${row.evaluationId}-${dim.key}`} className="mini-bar-item">
                          <small>{dim.short}</small>
                          <div><span style={{ width: `${scorePct(val)}%` }} /></div>
                          <small>{val ? val.toFixed(1) : "-"}</small>
                        </div>
                      );
                    })}
                  </div>
                  <div>
                    <span className="eval-stars">{stars(row.averageScore)}</span>
                    <p className="subtle">{row.averageScore.toFixed(1)}</p>
                  </div>
                  <div className="eval-actions-cell">
                    <Link className="home-btn home-btn-secondary" to={`/admin/evaluations/${row.supplierRegistryProfileId}`}>Dettaglio</Link>
                    <Link className="home-btn home-btn-secondary" to={`/admin/evaluations/new/${row.supplierRegistryProfileId}`}>Inserisci</Link>
                  </div>
                </div>
              ))}
            </div>
          </>
        ) : null}

        {mode === "detail" ? (
          <>
            <div className="panel admin-evaluations-head">
              <div>
                <p className="subtle">Valutazioni / {analytics.supplierName || "Fornitore"}</p>
                <h2>Valutazioni - {analytics.supplierName || "Fornitore"}</h2>
                <p className="subtle">{normalizeTypeLabel(analytics.supplierType)} - {analytics.totalEvaluations} valutazioni - Media complessiva: {analytics.averageOverallScore.toFixed(1)}</p>
              </div>
              <Link className="home-btn home-btn-primary" to={`/admin/evaluations/new/${resolvedSupplierId}`}><Plus className="h-4 w-4" /> Inserisci valutazione</Link>
            </div>

            {!detailValid ? <div className="panel"><p className="subtle">Supplier ID non valido.</p></div> : null}
            {detailValid ? (
              <>
                <div className="admin-evaluation-detail-grid">
                  <article className="panel">
                    <h3>Riepilogo valutazioni</h3>
                    <div className="eval-aggregate-score">{analytics.averageOverallScore.toFixed(1)}</div>
                    <p className="subtle">({analytics.totalEvaluations} valutazioni)</p>
                    <div className="eval-dimension-list">
                      {Object.entries(analytics.dimensionAverages).map(([key, value]) => (
                        <div key={key} className="eval-dimension-row">
                          <span>{key}</span>
                          <div><span style={{ width: `${scorePct(value)}%` }} /></div>
                          <strong>{value.toFixed(1)}</strong>
                        </div>
                      ))}
                    </div>
                  </article>
                  <article className="panel">
                    <h3>Distribuzione punteggi</h3>
                    <div className="eval-distribution-list">
                      {scoreDistribution.map((row) => (
                        <div key={`bucket-${row.bucket}`} className="eval-distribution-row">
                          <span>{"★".repeat(row.bucket)}{"☆".repeat(5 - row.bucket)}</span>
                          <div><span style={{ width: `${row.pct}%` }} /></div>
                          <small>{row.count} ({row.pct}%)</small>
                        </div>
                      ))}
                    </div>
                  </article>
                </div>

                <div className="panel">
                  <h3>Storico valutazioni</h3>
                  <div className="eval-history-list">
                    {topRows.map((item) => (
                      <article key={item.evaluationId} className="eval-history-item">
                        <div className="left">
                          <p className="eval-stars">{stars(item.averageScore)}</p>
                          <strong>{item.averageScore.toFixed(1)} / 5.0</strong>
                        </div>
                        <div className="mid">
                          <p><strong>{item.collaborationType || "Collaborazione"}</strong> - {item.collaborationPeriod || "-"}</p>
                          <p className="subtle">Rif: {item.referenceCode || "-"}</p>
                          <p>{item.comment || "Nessun commento"}</p>
                          <p className="subtle">{item.evaluatorAlias} - {formatDate(item.createdAt)}</p>
                        </div>
                        <div className="right">
                          {DIMENSIONS.slice(0, 4).map((dim) => {
                            const val = item.dimensionScores[dim.label] ?? item.dimensionScores[dim.key] ?? 0;
                            return (
                              <div key={`${item.evaluationId}-${dim.key}`} className="mini-bar-item">
                                <small>{dim.short}</small>
                                <div><span style={{ width: `${scorePct(val)}%` }} /></div>
                                <small>{val ? val.toFixed(1) : "-"}</small>
                              </div>
                            );
                          })}
                        </div>
                      </article>
                    ))}
                  </div>
                </div>
              </>
            ) : null}
          </>
        ) : null}

        {mode === "new" ? (
          <>
            <div className="panel admin-evaluations-head">
              <div>
                <p className="subtle">Valutazioni</p>
                <h2>Nuova valutazione - {analytics.supplierName || "Fornitore"}</h2>
                <p className="subtle">{analytics.supplierName ? `${normalizeTypeLabel(analytics.supplierType)} - media attuale ${analytics.averageOverallScore.toFixed(1)}` : "Inserisci una nuova valutazione fornitore"}</p>
              </div>
            </div>

            <div className="admin-evaluation-new-grid">
              <form className="panel admin-evaluation-new-form" onSubmit={onSubmitEvaluation}>
                <h3>Inserisci valutazione</h3>
                <label className={`floating-field ${formSupplierId ? "has-value" : ""}`}>
                  <input className="floating-input" value={formSupplierId} onChange={(e) => setFormSupplierId(e.target.value)} placeholder=" " />
                  <span className="floating-field-label">Supplier profile ID (UUID) *</span>
                </label>

                <div className="eval-overall-block">
                  <p><strong>Punteggio complessivo *</strong></p>
                  <StarInput value={overallScore} onChange={setOverallScore} required />
                </div>

                <div className="eval-dimension-inputs">
                  <p><strong>Valutazioni per dimensione (opzionali)</strong></p>
                  {DIMENSIONS.map((dim) => (
                    <div key={dim.key} className="eval-dimension-input-row">
                      <span>{dim.label}</span>
                      <StarInput value={dimensions[dim.key] ?? 0} onChange={(value) => setDimensions((prev) => ({ ...prev, [dim.key]: value }))} />
                    </div>
                  ))}
                </div>

                <div className="admin-eval-form-row3">
                  <label className={`floating-field ${collaborationType ? "has-value" : ""}`}>
                    <input className="floating-input" value={collaborationType} onChange={(e) => setCollaborationType(e.target.value)} placeholder=" " />
                    <span className="floating-field-label">Tipo collaborazione *</span>
                  </label>
                  <label className={`floating-field ${collaborationPeriod ? "has-value" : ""}`}>
                    <input className="floating-input" value={collaborationPeriod} onChange={(e) => setCollaborationPeriod(e.target.value)} placeholder=" " />
                    <span className="floating-field-label">Periodo di riferimento *</span>
                  </label>
                  <label className={`floating-field ${referenceCode ? "has-value" : ""}`}>
                    <input className="floating-input" value={referenceCode} onChange={(e) => setReferenceCode(e.target.value)} placeholder=" " />
                    <span className="floating-field-label">Riferimento interno</span>
                  </label>
                </div>

                <label className={`floating-field ${comment ? "has-value" : ""}`}>
                  <textarea className="floating-input" value={comment} onChange={(e) => setComment(e.target.value.slice(0, 600))} placeholder=" " rows={5} />
                  <span className="floating-field-label">Commento libero (max 600 caratteri)</span>
                </label>
                <p className="subtle text-right">{comment.length}/600</p>

                <p className="subtle">Il nome del valutatore non sara visibile al fornitore. Saranno mostrati solo punteggio aggregato e commenti anonimizzati.</p>

                <div className="revamp-step-actions">
                  <Link className="home-btn home-btn-secondary" to="/admin/evaluations">Annulla</Link>
                  <button type="submit" className="home-btn home-btn-primary" disabled={submitting || !token}>
                    {submitting ? <><Activity className="h-4 w-4" /> Salvataggio...</> : <><Star className="h-4 w-4" /> Salva valutazione</>}
                  </button>
                </div>
              </form>

              <aside className="panel admin-evaluation-history-side">
                <h3>Storico valutazioni</h3>
                {loading ? <p className="subtle">Caricamento...</p> : null}
                {!loading && analytics.history.length === 0 ? <p className="subtle">Nessuna valutazione precedente.</p> : null}
                <div className="eval-side-history-list">
                  {analytics.history.slice(0, 6).map((item) => (
                    <article key={item.evaluationId} className="eval-side-history-item">
                      <p className="eval-stars">{stars(item.averageScore)} <strong>{item.averageScore.toFixed(1)}</strong></p>
                      <p><strong>{item.collaborationType || "Collaborazione"}</strong></p>
                      <p className="subtle">{item.collaborationPeriod || "-"}</p>
                      <p className="subtle">{item.evaluatorAlias}</p>
                      <div className="side-score-bar"><span style={{ width: `${scorePct(item.averageScore)}%` }} /></div>
                    </article>
                  ))}
                </div>
              </aside>
            </div>
          </>
        ) : null}
      </section>
    </AdminCandidatureShell>
  );
}


