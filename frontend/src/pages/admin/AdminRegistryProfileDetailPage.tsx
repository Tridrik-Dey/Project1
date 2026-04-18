import { useEffect, useMemo, useState } from "react";
import { AlertTriangle, FileText, Mail, MessageSquare, RefreshCw, ShieldCheck, Star } from "lucide-react";
import { Link, useLocation, useParams } from "react-router-dom";
import type { AdminRegistryProfileRow, RegistryProfileStatus } from "../../api/adminProfilesApi";
import {
  getAdminProfile,
  getAdminProfileNotifications,
  getAdminProfileTimeline,
  reactivateAdminProfile,
  suspendAdminProfile,
  type AdminNotificationEvent,
  type AdminProfileTimelineEvent
} from "../../api/adminProfileDetailApi";
import { getAdminEvaluationSummary, type AdminEvaluationAggregate } from "../../api/adminEvaluationApi";
import { HttpError } from "../../api/http";
import { getRevampApplicationSections, type RevampSectionSnapshot } from "../../api/revampApplicationApi";
import { useAuth } from "../../auth/AuthContext";
import { AppToast } from "../../components/ui/toast";
import { useAdminGovernanceRole } from "../../hooks/useAdminGovernanceRole";
import { AdminCandidatureShell } from "./AdminCandidatureShell";

type DetailTab = "profilo" | "documenti" | "servizi" | "valutazioni" | "storico" | "note" | "comunicazioni";

type SectionPayload = Record<string, unknown>;

type CertificationRow = {
  id: string;
  label: string;
  expiryText?: string;
};

type DocumentRow = {
  id: string;
  label: string;
  sectionLabel: string;
  url: string | null;
};

const SERVICE_CATEGORY_LABELS: Record<string, string> = {
  CAT_A: "Cat. A - Formazione e Didattica",
  CAT_B: "Cat. B - HR e Organizzazione",
  CAT_C: "Cat. C - Tecnologia e Digitale",
  CAT_D: "Cat. D - Consulenza e Compliance",
  CAT_E: "Cat. E - Servizi Generali"
};

const SERVICE_LABELS: Record<string, string> = {
  TRAINING_DESIGN: "Progettazione percorsi formativi",
  LMS_CONTENT: "Contenuti e-learning / LMS",
  ASSESSMENT: "Assessment competenze",
  SIMULATION: "Simulatori / VR / AR",
  RECRUITING: "Ricerca e selezione",
  STAFFING: "Somministrazione lavoro",
  PAYROLL: "Payroll",
  HR_CONSULTING: "Consulenza HR",
  CUSTOM_SOFTWARE: "Sviluppo software custom",
  CYBERSECURITY: "Cybersecurity",
  BI_DASHBOARD: "Data analysis / BI",
  AI_AUTOMATION: "AI e automazione",
  LEGAL: "Consulenza legale",
  TAX_ACCOUNTING: "Consulenza fiscale/contabile",
  FUNDING: "Finanza agevolata e bandi",
  GDPR_231_ESG: "Compliance GDPR / 231 / ESG",
  EVENTS: "Organizzazione eventi",
  COMMUNICATION: "Comunicazione / grafica / video",
  LOGISTICS: "Logistica",
  FACILITY: "Facility management"
};

function parsePayload(payloadJson?: string | null): SectionPayload | null {
  if (!payloadJson) return null;
  try {
    const parsed = JSON.parse(payloadJson) as unknown;
    if (parsed && typeof parsed === "object") return parsed as SectionPayload;
  } catch {
    return null;
  }
  return null;
}

function scalar(value: unknown): string {
  if (typeof value === "string") return value.trim();
  if (typeof value === "number" || typeof value === "boolean") return String(value);
  return "";
}

function formatDate(value: string | null | undefined): string {
  if (!value) return "-";
  const parsed = Date.parse(value);
  if (!Number.isFinite(parsed)) return "-";
  return new Date(parsed).toLocaleDateString("it-IT");
}

function statusLabel(status: RegistryProfileStatus): string {
  if (status === "APPROVED") return "Attiva";
  if (status === "SUSPENDED") return "Sospesa";
  if (status === "RENEWAL_DUE") return "In rinnovo";
  return "Archiviata";
}

function statusClass(status: RegistryProfileStatus): string {
  if (status === "APPROVED") return "tone-ok";
  if (status === "RENEWAL_DUE") return "tone-warn";
  if (status === "SUSPENDED") return "tone-danger";
  return "tone-neutral";
}

function parseCertifications(section4: SectionPayload | null): CertificationRow[] {
  if (!section4) return [];
  const rows: CertificationRow[] = [];
  const iso9001 = scalar(section4.iso9001);
  if (iso9001) {
    rows.push({ id: "iso9001", label: `ISO 9001:2015 - ${iso9001 === "YES" ? "Disponibile" : "Non dichiarata"}` });
  }
  const accreditation = scalar(section4.accreditationSummary);
  if (accreditation) {
    accreditation
      .split(/[\n,;]+/)
      .map((item) => item.trim())
      .filter(Boolean)
      .forEach((item, idx) => rows.push({ id: `acc-${idx}`, label: item }));
  }
  const notes = scalar(section4.certificationsNotes);
  if (notes) {
    notes
      .split(/[\n,;]+/)
      .map((item) => item.trim())
      .filter(Boolean)
      .forEach((item, idx) => rows.push({ id: `note-${idx}`, label: item }));
  }
  return rows;
}

function parseServices(section3: SectionPayload | null): Array<{ category: string; services: string[]; description?: string }> {
  if (!section3) return [];
  const servicesByCategory = (section3.servicesByCategory as Record<string, string[]> | undefined) ?? {};
  const descriptionsByCategory = (section3.descriptionsByCategory as Record<string, string> | undefined) ?? {};
  const categories = Object.keys(servicesByCategory);
  return categories.map((key) => ({
    category: SERVICE_CATEGORY_LABELS[key] ?? key,
    services: (servicesByCategory[key] ?? []).map((serviceCode) => SERVICE_LABELS[serviceCode] ?? serviceCode),
    description: descriptionsByCategory[key]
  }));
}

function parseDocuments(sections: RevampSectionSnapshot[]): DocumentRow[] {
  const docs: DocumentRow[] = [];
  sections.forEach((section) => {
    const payload = parsePayload(section.payloadJson);
    if (!payload) return;
    Object.entries(payload).forEach(([field, value]) => {
      if (typeof value !== "string") return;
      const trimmed = value.trim();
      if (!trimmed.startsWith("http://") && !trimmed.startsWith("https://") && !trimmed.startsWith("data:")) return;
      docs.push({
        id: `${section.id}-${field}`,
        label: field,
        sectionLabel: section.sectionKey,
        url: trimmed
      });
    });
  });
  return docs;
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

  const canManageStatus = adminRole === "SUPER_ADMIN" || adminRole === "RESPONSABILE_ALBO";
  const section1 = useMemo(() => parsePayload(sections.find((s) => s.sectionKey === "S1")?.payloadJson), [sections]);
  const section2 = useMemo(() => parsePayload(sections.find((s) => s.sectionKey === "S2")?.payloadJson), [sections]);
  const section3 = useMemo(() => parsePayload(sections.find((s) => s.sectionKey === "S3")?.payloadJson), [sections]);
  const section4 = useMemo(() => parsePayload(sections.find((s) => s.sectionKey === "S4")?.payloadJson), [sections]);
  const certifications = useMemo(() => parseCertifications(section4), [section4]);
  const services = useMemo(() => parseServices(section3), [section3]);
  const documents = useMemo(() => parseDocuments(sections), [sections]);

  useEffect(() => {
    try {
      setNotes(window.localStorage.getItem(`admin_profile_notes_${profileId}`) ?? "");
    } catch {
      setNotes("");
    }
  }, [profileId]);

  async function loadDetail() {
    if (!token || !profileId) return;
    setLoading(true);
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
      setProfile(null);
      setSections([]);
      setTimeline([]);
      setNotifications([]);
      setEvaluationAggregate(null);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void loadDetail();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token, profileId]);

  async function onSuspend() {
    if (!token || !profile || actionBusy || !canManageStatus) return;
    setActionBusy("suspend");
    try {
      const updated = await suspendAdminProfile(profile.id, token);
      setProfile(updated);
      setToast({ message: "Profilo sospeso.", type: "success" });
      await loadDetail();
    } catch (error) {
      const message = error instanceof HttpError ? error.message : "Sospensione non riuscita.";
      setToast({ message, type: "error" });
    } finally {
      setActionBusy(null);
    }
  }

  async function onReactivate() {
    if (!token || !profile || actionBusy || !canManageStatus) return;
    setActionBusy("reactivate");
    try {
      const updated = await reactivateAdminProfile(profile.id, token);
      setProfile(updated);
      setToast({ message: "Profilo riattivato.", type: "success" });
      await loadDetail();
    } catch (error) {
      const message = error instanceof HttpError ? error.message : "Riattivazione non riuscita.";
      setToast({ message, type: "error" });
    } finally {
      setActionBusy(null);
    }
  }

  function saveNotes() {
    try {
      window.localStorage.setItem(`admin_profile_notes_${profileId}`, notes);
      setToast({ message: "Note admin salvate.", type: "success" });
    } catch {
      setToast({ message: "Salvataggio note non riuscito.", type: "error" });
    }
  }

  const headerTitle = isAlboB ? "Scheda Azienda Albo B - Vista Amministratore" : "Scheda Profilo Fornitore - Vista Amministratore";
  const statusBandClass = isAlboB ? "admin-profile-status-band green" : "admin-profile-status-band";
  const canSuspend = profile?.status === "APPROVED" || profile?.status === "RENEWAL_DUE";
  const canReactivate = profile?.status === "SUSPENDED";
  const profileName = profile?.displayName || (isAlboB ? "Azienda" : "Fornitore");
  const score = typeof profile?.aggregateScore === "number" ? profile.aggregateScore : 0;
  const fatturato = scalar(section4?.accreditationSummary) || "n/d";
  const dipendenti = scalar(section2?.employeeRange) || "n/d";
  const accreditamentiCount = certifications.length;
  const territori = scalar(section2?.operatingRegions) || "n/d";

  return (
    <AdminCandidatureShell active={shellActive}>
      <section className="stack admin-profile-shell">
        {toast ? <AppToast toast={toast} onClose={() => setToast(null)} className="admin-toast" /> : null}

        <div className="panel admin-profile-head">
          <div>
            <p className="subtle">{isAlboB ? "Albo B - Aziende" : "Albo A - Professionisti"} / {profileName}</p>
            <h2>{headerTitle}</h2>
          </div>
          <div className="admin-profile-head-actions">
            <button type="button" className="home-btn home-btn-secondary" onClick={() => setTab("comunicazioni")}>
              <Mail className="h-4 w-4" />
              Scrivi
            </button>
            <button type="button" className="home-btn home-btn-secondary" onClick={() => void loadDetail()} disabled={loading}>
              <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} />
              {loading ? "Aggiornamento..." : "Aggiorna"}
            </button>
            <Link className="home-btn home-btn-secondary" to={backPath}>Torna</Link>
          </div>
        </div>

        {profile ? (
          <>
            <div className={statusBandClass}>
              <span className={`admin-albo-status ${statusClass(profile.status)}`}>{statusLabel(profile.status)}</span>
              <strong>{profileName}</strong>
              <span>ID: {profile.id}</span>
            </div>

            <div className="admin-profile-top-grid">
              <div className="panel admin-profile-main-card">
                <h3>{profileName}</h3>
                <p className="subtle">{scalar(section1?.companyName) || profile.publicSummary || "-"}</p>
                <div className="admin-profile-meta-grid">
                  <p><strong>P.IVA:</strong> {scalar(section1?.vatNumber) || "-"}</p>
                  <p><strong>REA:</strong> {scalar(section1?.reaNumber) || "-"}</p>
                  <p><strong>Sede:</strong> {territori}</p>
                  <p><strong>Email:</strong> {scalar(section1?.operationalContactEmail) || "-"}</p>
                </div>
              </div>
              <div className="admin-profile-mini-cards">
                <article className="panel"><p className="subtle">Fatturato</p><strong>{fatturato}</strong></article>
                <article className="panel"><p className="subtle">Dipendenti</p><strong>{dipendenti}</strong></article>
                <article className="panel"><p className="subtle">Accreditamenti</p><strong>{accreditamentiCount}</strong></article>
                <article className="panel"><p className="subtle">Valutazione</p><strong>{score.toFixed(1)} <Star className="h-4 w-4" /></strong></article>
              </div>
            </div>

            <div className="panel admin-profile-tabs">
              <button type="button" className={tab === "profilo" ? "active" : ""} onClick={() => setTab("profilo")}>Profilo</button>
              <button type="button" className={tab === "documenti" ? "active" : ""} onClick={() => setTab("documenti")}>Documenti</button>
              <button type="button" className={tab === "servizi" ? "active" : ""} onClick={() => setTab("servizi")}>Servizi</button>
              <button type="button" className={tab === "valutazioni" ? "active" : ""} onClick={() => setTab("valutazioni")}>Valutazioni</button>
              <button type="button" className={tab === "storico" ? "active" : ""} onClick={() => setTab("storico")}>Storico</button>
              <button type="button" className={tab === "note" ? "active" : ""} onClick={() => setTab("note")}>Note</button>
              <button type="button" className={tab === "comunicazioni" ? "active" : ""} onClick={() => setTab("comunicazioni")}>Comunicazioni</button>
            </div>

            {tab === "profilo" ? (
              <div className="admin-profile-content-grid">
                <div className="panel">
                  <h4>Dati societari e organizzativi</h4>
                  <p><strong>Ragione sociale:</strong> {scalar(section1?.companyName) || "-"}</p>
                  <p><strong>Forma giuridica:</strong> {scalar(section2?.atecoPrimary) || "-"}</p>
                  <p><strong>Codici ATECO:</strong> {scalar(section2?.atecoPrimary) || "-"}</p>
                  <p><strong>Dipendenti:</strong> {dipendenti}</p>
                  <p><strong>Regioni operative:</strong> {territori}</p>
                  <p><strong>Legale rappresentante:</strong> {scalar(section1?.legalRepresentativeName) || "-"}</p>
                </div>
                <div className="panel">
                  <h4>Certificazioni e accreditamenti</h4>
                  {certifications.length === 0 ? <p className="subtle">Nessuna certificazione disponibile.</p> : null}
                  {certifications.map((item) => (
                    <p key={item.id}><ShieldCheck className="h-4 w-4" /> {item.label} {item.expiryText ? `- ${item.expiryText}` : ""}</p>
                  ))}
                </div>
              </div>
            ) : null}

            {tab === "documenti" ? (
              <div className="panel">
                <h4>Documenti allegati</h4>
                {documents.length === 0 ? <p className="subtle">Nessun documento con URL disponibile.</p> : null}
                {documents.map((doc) => (
                  <div key={doc.id} className="admin-profile-doc-row">
                    <span>{doc.label} <small>({doc.sectionLabel})</small></span>
                    {doc.url ? (
                      <a className="home-btn home-btn-secondary" href={doc.url} target="_blank" rel="noreferrer">Apri</a>
                    ) : (
                      <span className="subtle">-</span>
                    )}
                  </div>
                ))}
              </div>
            ) : null}

            {tab === "servizi" ? (
              <div className="panel">
                <h4>Servizi per categoria</h4>
                {services.length === 0 ? <p className="subtle">Nessun servizio categorizzato disponibile.</p> : null}
                {services.map((group) => (
                  <article key={group.category} className="admin-profile-service-card">
                    <strong>{group.category}</strong>
                    <p>{group.services.join(", ") || "-"}</p>
                    {group.description ? <p className="subtle">{group.description}</p> : null}
                  </article>
                ))}
              </div>
            ) : null}

            {tab === "valutazioni" ? (
              <div className="panel">
                <h4>Valutazioni</h4>
                {evaluationAggregate ? (
                  <div className="admin-profile-eval-grid">
                    <article className="panel"><p className="subtle">Totale</p><strong>{evaluationAggregate.totalEvaluations}</strong></article>
                    <article className="panel"><p className="subtle">Attive</p><strong>{evaluationAggregate.activeEvaluations}</strong></article>
                    <article className="panel"><p className="subtle">Media score</p><strong>{evaluationAggregate.averageOverallScore.toFixed(2)}</strong></article>
                  </div>
                ) : (
                  <p className="subtle">Nessuna valutazione disponibile.</p>
                )}
              </div>
            ) : null}

            {tab === "storico" ? (
              <div className="panel">
                <h4>Storico</h4>
                {timeline.length === 0 ? <p className="subtle">Nessun evento storico disponibile.</p> : null}
                {timeline.map((event) => (
                  <article key={event.id} className="admin-profile-history-item">
                    <p><strong>{event.eventKey}</strong></p>
                    <p className="subtle">{event.reason || "Nessuna motivazione"}</p>
                    <p className="subtle">{new Date(event.occurredAt).toLocaleString("it-IT")}</p>
                  </article>
                ))}
              </div>
            ) : null}

            {tab === "note" ? (
              <div className="panel admin-profile-notes-panel">
                <h4><MessageSquare className="h-4 w-4" /> Note interne (solo admin)</h4>
                <label className={`floating-field ${notes ? "has-value" : ""}`}>
                  <textarea className="floating-input" rows={6} value={notes} onChange={(e) => setNotes(e.target.value)} placeholder=" " />
                  <span className="floating-field-label">Annotazioni interne</span>
                </label>
                <button type="button" className="home-btn home-btn-primary" onClick={saveNotes}>Salva note</button>
              </div>
            ) : null}

            {tab === "comunicazioni" ? (
              <div className="panel">
                <h4>Comunicazioni</h4>
                {notifications.length === 0 ? <p className="subtle">Nessuna comunicazione registrata.</p> : null}
                {notifications.map((item) => (
                  <article key={item.id} className="admin-profile-history-item">
                    <p><strong>{item.eventKey}</strong> - {item.deliveryStatus}</p>
                    <p className="subtle">Destinatario: {item.recipient || "n/d"}</p>
                    <p className="subtle">Template: {item.templateKey || "n/d"} v{item.templateVersion ?? "-"}</p>
                    <p className="subtle">Inviata: {formatDate(item.sentAt)} | Creata: {formatDate(item.createdAt)}</p>
                  </article>
                ))}
              </div>
            ) : null}

            <div className="admin-profile-action-bar">
              <button
                type="button"
                className="home-btn home-btn-secondary"
                onClick={() => void onSuspend()}
                disabled={!canSuspend || !canManageStatus || actionBusy !== null}
              >
                {actionBusy === "suspend" ? "Sospensione..." : "Sospendi"}
              </button>
              <button
                type="button"
                className="home-btn home-btn-secondary"
                onClick={() => void onReactivate()}
                disabled={!canReactivate || !canManageStatus || actionBusy !== null}
              >
                {actionBusy === "reactivate" ? "Riattivazione..." : "Riattiva"}
              </button>
              <button type="button" className="home-btn home-btn-secondary" onClick={() => setTab("note")}>
                Modifica note
              </button>
              <Link className="home-btn home-btn-secondary" to={profile.applicationId ? `/admin/candidature/${profile.applicationId}/integration` : "#"}>
                Richiedi integrazione
              </Link>
              <button type="button" className="home-btn home-btn-secondary" onClick={() => setToast({ message: "Export PDF in preparazione.", type: "success" })}>
                <FileText className="h-4 w-4" />
                Esporta PDF scheda
              </button>
            </div>
          </>
        ) : (
          <div className="panel">
            <p className="subtle">Nessun profilo disponibile.</p>
          </div>
        )}

        {loading ? (
          <div className="panel">
            <p className="subtle"><AlertTriangle className="h-4 w-4" /> Caricamento dati scheda...</p>
          </div>
        ) : null}
      </section>
    </AdminCandidatureShell>
  );
}
