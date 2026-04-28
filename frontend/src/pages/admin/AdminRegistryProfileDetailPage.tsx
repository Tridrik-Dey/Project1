import { useCallback, useEffect, useRef, useState } from "react";
import {
  AlertTriangle,
  ArrowLeft,
  Award,
  Building2,
  Clock,
  FileText,
  FilePlus,
  History,
  Mail,
  MessageSquare,
  RefreshCw,
  Save,
  ShieldCheck,
  Star,
  User,
  Wrench,
} from "lucide-react";
import { Link, useLocation, useParams } from "react-router-dom";
import type { DashboardActivityEvent } from "../../api/adminDashboardEventsApi";
import type { AdminRegistryProfileRow, RegistryProfileStatus } from "../../api/adminProfilesApi";
import {
  getAdminProfile,
  getAdminProfileNotifications,
  getAdminProfileTimeline,
  reactivateAdminProfile,
  suspendAdminProfile,
  type AdminNotificationEvent,
  type AdminProfileTimelineEvent,
} from "../../api/adminProfileDetailApi";
import { getAdminEvaluationSummary, type AdminEvaluationAggregate } from "../../api/adminEvaluationApi";
import { API_BASE_URL, HttpError } from "../../api/http";
import { getRevampApplicationSections, type RevampSectionSnapshot } from "../../api/revampApplicationApi";
import { useAuth } from "../../auth/AuthContext";
import { AppToast } from "../../components/ui/toast";
import { useAdminGovernanceRole } from "../../hooks/useAdminGovernanceRole";
import { useAdminRealtimeRefresh } from "../../hooks/useAdminRealtimeRefresh";
import { AdminCandidatureShell } from "./AdminCandidatureShell";
import { ComposeEmailModal } from "./components/ComposeEmailModal";
import { SupplierProfileView } from "./components/SupplierProfileView";

type DetailTab = "profilo" | "documenti" | "valutazioni" | "storico" | "note" | "comunicazioni";

type SectionPayload = Record<string, unknown>;

type DocumentRow = { id: string; label: string; sectionLabel: string; url: string | null };

function parsePayload(payloadJson?: string | null): SectionPayload | null {
  if (!payloadJson) return null;
  try {
    const parsed = JSON.parse(payloadJson) as unknown;
    if (parsed && typeof parsed === "object") return parsed as SectionPayload;
  } catch { return null; }
  return null;
}

function scalar(v: unknown): string {
  if (typeof v === "string") return v.trim();
  if (typeof v === "number" || typeof v === "boolean") return String(v);
  return "";
}

function formatDate(v: string | null | undefined): string {
  if (!v) return "—";
  const p = Date.parse(v);
  if (!Number.isFinite(p)) return "—";
  return new Date(p).toLocaleDateString("it-IT");
}

function formatDateTime(v: string | null | undefined): string {
  if (!v) return "—";
  const p = Date.parse(v);
  if (!Number.isFinite(p)) return "—";
  return new Date(p).toLocaleString("it-IT");
}

function statusLabel(s: RegistryProfileStatus): string {
  if (s === "APPROVED") return "Attiva";
  if (s === "SUSPENDED") return "Sospesa";
  if (s === "RENEWAL_DUE") return "In rinnovo";
  return "Archiviata";
}

function statusClass(s: RegistryProfileStatus): string {
  if (s === "APPROVED") return "tone-ok";
  if (s === "RENEWAL_DUE") return "tone-warn";
  if (s === "SUSPENDED") return "tone-danger";
  return "tone-neutral";
}

function timelineEventCopy(event: AdminProfileTimelineEvent): { title: string; detail: string; tone: "ok" | "warn" | "neutral" } {
  const key = event.eventKey.toLowerCase();
  const reason = event.reason?.trim();
  if (key.includes("reactivated")) {
    return {
      title: "Profilo riattivato",
      detail: reason || "Il fornitore e tornato disponibile nell'albo.",
      tone: "ok",
    };
  }
  if (key.includes("suspended")) {
    return {
      title: "Profilo sospeso",
      detail: reason || "Il fornitore e stato fermato temporaneamente.",
      tone: "warn",
    };
  }
  return {
    title: "Aggiornamento profilo",
    detail: reason || "E stata registrata una modifica su questo profilo.",
    tone: "neutral",
  };
}

function parseDocuments(sections: RevampSectionSnapshot[], applicationId: string | null | undefined): DocumentRow[] {
  const docs: DocumentRow[] = [];
  sections.forEach((section) => {
    const payload = parsePayload(section.payloadJson);
    if (!payload) return;
    Object.entries(payload).forEach(([field, value]) => {
      if (typeof value !== "string") return;
      const trimmed = value.trim();
      if (!trimmed) return;
      let url: string | null = null;
      if (trimmed.startsWith("http://") || trimmed.startsWith("https://") || trimmed.startsWith("data:")) {
        url = trimmed;
      } else if (applicationId && trimmed.length > 8 && !/\s/.test(trimmed)) {
        url = `/api/v2/applications/${encodeURIComponent(applicationId)}/attachments/download?storageKey=${encodeURIComponent(trimmed)}`;
      }
      if (url) docs.push({ id: `${section.id}-${field}`, label: field, sectionLabel: section.sectionKey, url });
    });
  });
  return docs;
}

function shouldRefreshProfileDetail(event: DashboardActivityEvent, profileId: string, applicationId: string | null | undefined): boolean {
  const key = event.eventKey ?? "";
  if (event.entityType === "REVAMP_SUPPLIER_REGISTRY_PROFILE" && event.entityId === profileId) return true;
  if (event.entityType === "REVAMP_APPLICATION" && applicationId && event.entityId === applicationId) return true;
  return key.includes("evaluation") && event.entityId === profileId;
}

function initials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "NA";
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return `${parts[0][0] ?? ""}${parts[1][0] ?? ""}`.toUpperCase();
}

export function AdminRegistryProfileDetailPage() {
  const { profileId = "" } = useParams();
  const location = useLocation();
  const { auth } = useAuth();
  const token = auth?.token ?? "";
  const { adminRole } = useAdminGovernanceRole();
  const isAlboB = location.pathname.startsWith("/admin/albo-b/");
  const shellActive = isAlboB ? "alboB" : "alboA";
  const backPath = isAlboB ? "/admin/albo-b" : "/admin/albo-a";
  const backLabel = isAlboB ? "Albo B — Aziende" : "Albo A — Professionisti";

  const [tab, setTab] = useState<DetailTab>("profilo");
  const [profile, setProfile] = useState<AdminRegistryProfileRow | null>(null);
  const [sections, setSections] = useState<RevampSectionSnapshot[]>([]);
  const [timeline, setTimeline] = useState<AdminProfileTimelineEvent[]>([]);
  const [notifications, setNotifications] = useState<AdminNotificationEvent[]>([]);
  const [evaluationAggregate, setEvaluationAggregate] = useState<AdminEvaluationAggregate | null>(null);
  const [loading, setLoading] = useState(false);
  const [actionBusy, setActionBusy] = useState<"suspend" | "reactivate" | null>(null);
  const [toast, setToast] = useState<{ message: string; type: "error" | "success" } | null>(null);
  const [notes, setNotes] = useState("");
  const [showCompose, setShowCompose] = useState(false);
  const refreshInFlightRef = useRef(false);
  const refreshQueuedRef = useRef(false);

  const canManageStatus = adminRole === "SUPER_ADMIN" || adminRole === "RESPONSABILE_ALBO";
  const canWrite = adminRole === "SUPER_ADMIN" || adminRole === "RESPONSABILE_ALBO" || adminRole === "REVISORE";
  const canExportPdf = adminRole === "SUPER_ADMIN" || adminRole === "RESPONSABILE_ALBO";

  async function openDocument(url: string | null) {
    if (!url) return;
    let resolvedUrl = url;
    if (resolvedUrl.startsWith(API_BASE_URL)) resolvedUrl = resolvedUrl.slice(API_BASE_URL.length);
    if (!resolvedUrl.startsWith("/api/")) {
      window.open(resolvedUrl, "_blank", "noopener,noreferrer");
      return;
    }
    const win = window.open("about:blank", "_blank", "noopener,noreferrer");
    if (win) win.document.body.innerHTML = "<p style=\"font-family:sans-serif;padding:24px\">Apertura documento in corso…</p>";
    try {
      const res = await fetch(`${API_BASE_URL}${resolvedUrl}`, {
        headers: token ? { Authorization: `Bearer ${token}` } : undefined
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const blob = await res.blob();
      const objectUrl = window.URL.createObjectURL(blob);
      if (win) { win.location.href = objectUrl; } else { window.open(objectUrl, "_blank", "noopener,noreferrer"); }
      window.setTimeout(() => window.URL.revokeObjectURL(objectUrl), 60_000);
    } catch {
      win?.close();
      setToast({ message: "Documento non apribile. File non trovato o accesso non autorizzato.", type: "error" });
    }
  }

  useEffect(() => {
    try { setNotes(window.localStorage.getItem(`admin_profile_notes_${profileId}`) ?? ""); }
    catch { setNotes(""); }
  }, [profileId]);

  const loadDetail = useCallback(async (showLoading = true) => {
    if (!token || !profileId) return;
    if (refreshInFlightRef.current) { refreshQueuedRef.current = true; return; }
    refreshInFlightRef.current = true;
    if (showLoading) setLoading(true);
    try {
      const profileData = await getAdminProfile(profileId, token);
      const [timelineData, notificationData] = await Promise.all([
        getAdminProfileTimeline(profileId, token).catch(() => []),
        getAdminProfileNotifications(profileId, token).catch(() => [])
      ]);
      setProfile(profileData);
      setTimeline(timelineData);
      setNotifications(notificationData);
      if (profileData.applicationId) {
        const sectionsData = await getRevampApplicationSections(profileData.applicationId, token).catch(() => []);
        setSections(sectionsData);
      } else {
        setSections([]);
      }
      const aggregate = await getAdminEvaluationSummary(profileId, token).catch(() => null);
      setEvaluationAggregate(aggregate);
    } catch (error) {
      const message = error instanceof HttpError ? error.message : "Caricamento scheda profilo non riuscito.";
      setToast({ message, type: "error" });
      setProfile(null); setSections([]); setTimeline([]); setNotifications([]); setEvaluationAggregate(null);
    } finally {
      refreshInFlightRef.current = false;
      if (showLoading) setLoading(false);
      if (refreshQueuedRef.current) { refreshQueuedRef.current = false; void loadDetail(false); }
    }
  }, [profileId, token]);

  useEffect(() => { void loadDetail(true); }, [loadDetail]);

  useAdminRealtimeRefresh({
    token,
    enabled: Boolean(profileId),
    shouldRefresh: (event) => shouldRefreshProfileDetail(event, profileId, profile?.applicationId),
    onRefresh: () => loadDetail(false)
  });

  async function onSuspend() {
    if (!token || !profile || actionBusy || !canManageStatus) return;
    setActionBusy("suspend");
    try {
      const updated = await suspendAdminProfile(profile.id, token);
      setProfile(updated);
      setToast({ message: "Profilo sospeso con successo.", type: "success" });
      await loadDetail();
    } catch (error) {
      setToast({ message: error instanceof HttpError ? error.message : "Sospensione non riuscita.", type: "error" });
    } finally { setActionBusy(null); }
  }

  async function onReactivate() {
    if (!token || !profile || actionBusy || !canManageStatus) return;
    setActionBusy("reactivate");
    try {
      const updated = await reactivateAdminProfile(profile.id, token);
      setProfile(updated);
      setToast({ message: "Profilo riattivato con successo.", type: "success" });
      await loadDetail();
    } catch (error) {
      setToast({ message: error instanceof HttpError ? error.message : "Riattivazione non riuscita.", type: "error" });
    } finally { setActionBusy(null); }
  }

  function saveNotes() {
    try {
      window.localStorage.setItem(`admin_profile_notes_${profileId}`, notes);
      setToast({ message: "Note salvate.", type: "success" });
    } catch {
      setToast({ message: "Salvataggio note non riuscito.", type: "error" });
    }
  }

  const canSuspend = profile?.status === "APPROVED" || profile?.status === "RENEWAL_DUE";
  const canReactivate = profile?.status === "SUSPENDED";
  const profileName = profile?.displayName || (isAlboB ? "Azienda" : "Professionista");
  const score = typeof profile?.aggregateScore === "number" ? profile.aggregateScore : 0;
  const documents = parseDocuments(sections, profile?.applicationId);

  const s1 = parsePayload(sections.find((s) => s.sectionKey === "S1")?.payloadJson);
  const s2 = parsePayload(sections.find((s) => s.sectionKey === "S2")?.payloadJson);

  const heroSubtitle = isAlboB
    ? [scalar(s1?.vatNumber) ? `P.IVA ${scalar(s1?.vatNumber)}` : null, scalar(s1?.cciaaProvince) ? `CCIAA ${scalar(s1?.cciaaProvince)}` : null].filter(Boolean).join("  ·  ")
    : [scalar(s1?.taxCode) ? `CF ${scalar(s1?.taxCode)}` : null, scalar(s2?.professionalType) ? scalar(s2?.professionalType) : null].filter(Boolean).join("  ·  ");

  const tabs: Array<{ key: DetailTab; label: string; icon: React.ReactNode }> = [
    { key: "profilo", label: "Profilo completo", icon: <User className="h-4 w-4" /> },
    { key: "documenti", label: `Documenti${documents.length > 0 ? ` (${documents.length})` : ""}`, icon: <FileText className="h-4 w-4" /> },
    { key: "valutazioni", label: "Valutazioni", icon: <Star className="h-4 w-4" /> },
    { key: "storico", label: "Storico", icon: <History className="h-4 w-4" /> },
    { key: "note", label: "Note interne", icon: <MessageSquare className="h-4 w-4" /> },
    { key: "comunicazioni", label: "Comunicazioni", icon: <Mail className="h-4 w-4" /> },
  ];

  return (
    <AdminCandidatureShell active={shellActive}>
      <section className="stack admin-profile-shell">
        {toast ? <AppToast toast={toast} onClose={() => setToast(null)} className="admin-toast" /> : null}

        {/* Page header */}
        <div className="panel admin-profile-head">
          <div>
            <p className="subtle admin-profile-breadcrumb">
              <Link to={backPath} className="breadcrumb-link">{backLabel}</Link>
              {" / "}
              <span>{profileName}</span>
            </p>
            <h2 className="admin-profile-page-title">
              {isAlboB ? <Building2 className="h-5 w-5" /> : <User className="h-5 w-5" />}
              Scheda {isAlboB ? "Azienda" : "Professionista"}
            </h2>
          </div>
          <div className="admin-profile-head-actions">
            {adminRole !== "VIEWER" ? (
              <div className="head-icon-btn-wrap">
                <button
                  type="button"
                  className="head-icon-btn head-icon-btn--compose"
                  onClick={() => setShowCompose(true)}
                  aria-label="Scrivi email al fornitore"
                >
                  <Mail className="h-5 w-5" />
                </button>
                <span className="head-icon-tooltip">Scrivi email</span>
              </div>
            ) : null}
            <div className="head-icon-btn-wrap">
              <Link
                className="head-icon-btn head-icon-btn--back"
                to={backPath}
                aria-label={`Torna a ${backLabel}`}
              >
                <ArrowLeft className="h-5 w-5" />
              </Link>
              <span className="head-icon-tooltip">Torna all'elenco</span>
            </div>
          </div>
        </div>

        {profile ? (
          <>
            {/* Hero card */}
            <div className={`profile-hero-card ${isAlboB ? "hero-albo-b" : "hero-albo-a"}`}>
              <div className="hero-avatar">{initials(profileName)}</div>
              <div className="hero-identity">
                <div className="hero-name-row">
                  <h3 className="hero-name">{profileName}</h3>
                  <span className={`admin-albo-status ${statusClass(profile.status)} hero-status-badge`}>
                    {statusLabel(profile.status)}
                  </span>
                  <span className={`hero-registry-badge ${isAlboB ? "badge-albo-b" : "badge-albo-a"}`}>
                    {isAlboB ? "Albo B — Azienda" : "Albo A — Professionista"}
                  </span>
                </div>
                {heroSubtitle ? <p className="hero-subtitle">{heroSubtitle}</p> : null}
                {profile.publicSummary ? <p className="hero-summary">{profile.publicSummary}</p> : null}
              </div>
              <div className="hero-kpis">
                <article className="panel superadmin-kpi-card tone-info hero-kpi-card">
                  <div className="superadmin-kpi-head">
                    <h4>Valutazione</h4>
                    <span className="superadmin-kpi-icon"><Star className="h-4 w-4" /></span>
                  </div>
                  <strong>{score.toFixed(1)}</strong>
                </article>
                <article className="panel superadmin-kpi-card tone-ok hero-kpi-card">
                  <div className="superadmin-kpi-head">
                    <h4>Approvato il</h4>
                    <span className="superadmin-kpi-icon"><Clock className="h-4 w-4" /></span>
                  </div>
                  <strong>{formatDate(profile.approvedAt)}</strong>
                </article>
                <article className="panel superadmin-kpi-card tone-attention hero-kpi-card">
                  <div className="superadmin-kpi-head">
                    <h4>Scadenza iscrizione</h4>
                    <span className="superadmin-kpi-icon"><Award className="h-4 w-4" /></span>
                  </div>
                  <strong>{formatDate(profile.expiresAt)}</strong>
                </article>
              </div>
            </div>

            {/* Tab bar */}
            <div className="panel admin-profile-tabs">
              {tabs.map((t) => (
                <button
                  key={t.key}
                  type="button"
                  className={tab === t.key ? "active" : ""}
                  onClick={() => setTab(t.key)}
                >
                  {t.icon} {t.label}
                </button>
              ))}
            </div>

            {/* Profilo completo tab */}
            {tab === "profilo" ? (
              <SupplierProfileView isAlboB={isAlboB} sections={sections} />
            ) : null}

            {/* Documenti tab */}
            {tab === "documenti" ? (
              <div className="panel">
                <h4><FileText className="h-4 w-4" /> Documenti allegati</h4>
                {documents.length === 0 ? (
                  <p className="subtle">Nessun documento con URL disponibile nelle sezioni.</p>
                ) : (
                  <div className="profile-doc-list">
                    {documents.map((doc) => (
                      <div key={doc.id} className="admin-profile-doc-row">
                        <div>
                          <span className="doc-label">{doc.label}</span>
                          <span className="doc-section-tag">{doc.sectionLabel}</span>
                        </div>
                        {doc.url ? (
                          <button type="button" className="home-btn home-btn-secondary admin-action-btn btn-with-icon btn-icon-open" onClick={() => { void openDocument(doc.url); }}>
                            Apri
                          </button>
                        ) : (
                          <span className="subtle">—</span>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            ) : null}

            {/* Valutazioni tab */}
            {tab === "valutazioni" ? (
              <div className="panel admin-profile-eval-panel">
                <div className="admin-profile-eval-head">
                  <div>
                    <span className="admin-profile-eval-icon"><Star className="h-4 w-4" /></span>
                    <div>
                      <h4>Valutazioni</h4>
                      <p className="subtle">Sintesi dei valori registrati per questo profilo.</p>
                    </div>
                  </div>
                </div>
                {evaluationAggregate ? (
                  <>
                    <div className="admin-profile-eval-grid">
                      <article className="admin-profile-eval-card tone-blue">
                        <span><FileText className="h-4 w-4" /> Valutazioni totali</span>
                        <strong>{evaluationAggregate.totalEvaluations}</strong>
                        <small>storico registrato</small>
                      </article>
                      <article className="admin-profile-eval-card tone-green">
                        <span><ShieldCheck className="h-4 w-4" /> Valutazioni attive</span>
                        <strong>{evaluationAggregate.activeEvaluations}</strong>
                        <small>valide oggi</small>
                      </article>
                      <article className="admin-profile-eval-card tone-amber">
                        <span><Award className="h-4 w-4" /> Punteggio medio</span>
                        <strong>{evaluationAggregate.averageOverallScore.toFixed(2)} <small>/ 5</small></strong>
                        <small>media complessiva</small>
                      </article>
                    </div>
                    <Link
                      className="home-btn home-btn-secondary admin-action-btn admin-profile-eval-link"
                      to={`/admin/evaluations?supplierId=${profileId}`}
                    >
                      Vedi tutte le valutazioni
                    </Link>
                  </>
                ) : (
                  <p className="subtle">Nessuna valutazione disponibile per questo profilo.</p>
                )}
              </div>
            ) : null}

            {/* Storico tab */}
            {tab === "storico" ? (
              <div className="panel admin-profile-history-panel">
                <div className="admin-profile-history-head">
                  <span className="admin-profile-history-icon"><History className="h-4 w-4" /></span>
                  <div>
                    <h4>Storico eventi</h4>
                    <p className="subtle">Cosa e successo al profilo, in ordine cronologico.</p>
                  </div>
                </div>
                {timeline.length === 0 ? (
                  <p className="subtle">Nessun evento storico disponibile.</p>
                ) : (
                  <div className="profile-history-list">
                    {timeline.map((event) => {
                      const copy = timelineEventCopy(event);
                      return (
                        <article key={event.id} className={`admin-profile-history-item tone-${copy.tone}`}>
                          <span className="admin-profile-history-marker" aria-hidden="true" />
                          <div className="admin-profile-history-content">
                            <div className="history-event-header">
                              <strong className="history-event-title">{copy.title}</strong>
                              <span className="history-event-date">{formatDateTime(event.occurredAt)}</span>
                            </div>
                            <p className="history-event-reason">{copy.detail}</p>
                          </div>
                        </article>
                      );
                    })}
                  </div>
                )}
              </div>
            ) : null}

            {/* Note interne tab */}
            {tab === "note" ? (
              <div className="panel admin-profile-notes-panel">
                <div className="admin-profile-notes-head">
                  <span className="admin-profile-notes-icon"><MessageSquare className="h-4 w-4" /></span>
                  <div>
                    <h4>Note interne</h4>
                    <p className="subtle">Promemoria privati per il team amministrativo.</p>
                  </div>
                </div>
                <label className="admin-profile-note-editor">
                  <span>Annotazione</span>
                  <textarea
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                    placeholder="Scrivi una nota utile per chi gestisce questo profilo..."
                    rows={4}
                  />
                </label>
                <div className="admin-profile-notes-footer">
                  <span>Visibile solo agli amministratori</span>
                  <button type="button" className="home-btn home-btn-primary admin-action-btn" onClick={saveNotes}>
                    <Save className="h-4 w-4" />
                    Salva note
                  </button>
                </div>
              </div>
            ) : null}

            {/* Comunicazioni tab */}
            {tab === "comunicazioni" ? (
              <div className="panel">
                <h4><Mail className="h-4 w-4" /> Comunicazioni inviate</h4>
                {notifications.length === 0 ? (
                  <p className="subtle">Nessuna comunicazione registrata per questo profilo.</p>
                ) : (
                  <div className="profile-history-list">
                    {notifications.map((item) => (
                      <article key={item.id} className="admin-profile-history-item">
                        <div className="history-event-header">
                          <strong className="history-event-key">{item.eventKey}</strong>
                          <span className={`comm-status-badge ${item.deliveryStatus === "DELIVERED" ? "badge-ok" : "badge-neutral"}`}>
                            {item.deliveryStatus}
                          </span>
                        </div>
                        <p className="subtle">Destinatario: {item.recipient || "—"}</p>
                        <p className="subtle">Template: {item.templateKey || "—"} v{item.templateVersion ?? "—"}</p>
                        <p className="subtle">Inviata: {formatDate(item.sentAt)}</p>
                      </article>
                    ))}
                  </div>
                )}
              </div>
            ) : null}

            {/* Sticky action bar */}
            <div className="admin-profile-action-bar">
              {canManageStatus && canSuspend ? (
                <button type="button" className="home-btn home-btn-danger admin-action-btn" onClick={() => void onSuspend()} disabled={actionBusy !== null}>
                  <Wrench className="h-4 w-4" />
                  {actionBusy === "suspend" ? "Sospensione..." : "Sospendi profilo"}
                </button>
              ) : null}
              {canManageStatus && canReactivate ? (
                <button type="button" className="home-btn home-btn-primary admin-action-btn" onClick={() => void onReactivate()} disabled={actionBusy !== null}>
                  <ShieldCheck className="h-4 w-4" />
                  {actionBusy === "reactivate" ? "Riattivazione..." : "Riattiva profilo"}
                </button>
              ) : null}
              {canWrite ? (
                <button type="button" className="home-btn home-btn-secondary admin-action-btn" onClick={() => setTab("note")}>
                  <MessageSquare className="h-4 w-4" /> Note interne
                </button>
              ) : null}
              {canWrite ? (
                <Link
                  className="home-btn home-btn-secondary admin-action-btn"
                  to={profile.applicationId ? `/admin/candidature/${profile.applicationId}/integration` : "#"}
                >
                  <FilePlus className="h-4 w-4" /> Richiedi integrazione
                </Link>
              ) : null}
              {canExportPdf ? (
                <button
                  type="button"
                  className="home-btn home-btn-secondary admin-action-btn"
                  onClick={() => setToast({ message: "Export PDF in preparazione.", type: "success" })}
                >
                  <FileText className="h-4 w-4" /> Esporta PDF
                </button>
              ) : null}
            </div>
          </>
        ) : !loading ? (
          <div className="panel">
            <p className="subtle"><AlertTriangle className="h-4 w-4" /> Profilo non trovato o non ancora disponibile.</p>
          </div>
        ) : null}

        {loading ? (
          <div className="panel profile-loading-banner">
            <RefreshCw className="h-4 w-4 animate-spin" />
            <span>Caricamento scheda in corso...</span>
          </div>
        ) : null}
      </section>

      {showCompose && profile ? (
        <ComposeEmailModal
          profileId={profileId}
          supplierEmail={profile.supplierEmail ?? ""}
          supplierName={profileName}
          token={token}
          onClose={() => setShowCompose(false)}
          onSent={() => {
            setShowCompose(false);
            setToast({ message: "Email inviata con successo.", type: "success" });
            void loadDetail(false);
            setTab("comunicazioni");
          }}
        />
      ) : null}
    </AdminCandidatureShell>
  );
}
