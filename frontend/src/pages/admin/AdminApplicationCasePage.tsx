import { useEffect, useMemo, useState } from "react";
import { AlertTriangle, CheckCircle2, ClipboardList, Clock3, FileText, History, MessageSquare, XCircle } from "lucide-react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { type AdminRole } from "../../api/adminUsersRolesApi";
import { HttpError } from "../../api/http";
import { getRevampApplicationSections, getRevampApplicationSummary, type RevampApplicationSummary, type RevampSectionSnapshot } from "../../api/revampApplicationApi";
import {
  getAdminReviewHistory,
  getLatestAdminIntegrationRequest,
  saveAdminReviewDecision,
  type AdminIntegrationRequestSummary,
  type AdminReviewCaseSummary
} from "../../api/adminReviewApi";
import { useAuth } from "../../auth/AuthContext";
import { AppToast } from "../../components/ui/toast";
import { useAdminGovernanceRole } from "../../hooks/useAdminGovernanceRole";
import { AdminCandidatureShell } from "./AdminCandidatureShell";

type CaseTab = "profile" | "history" | "notes";
type DecisionAction = "APPROVED" | "INTEGRATION_REQUIRED" | "REJECTED";
type SectionPayload = Record<string, unknown>;
type DocumentRow = { id: string; label: string; sectionLabel: string; url: string | null; hasLink: boolean };

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function daysSince(iso: string | null): number | null {
  if (!iso) return null;
  const parsed = Date.parse(iso);
  if (!Number.isFinite(parsed)) return null;
  return Math.max(0, Math.floor((Date.now() - parsed) / (1000 * 60 * 60 * 24)));
}

function sectionLabel(sectionKey: string): string {
  const normalized = sectionKey.trim().toUpperCase();
  if (normalized === "S1") return "Anagrafica";
  if (normalized === "S2") return "Tipologia";
  if (normalized === "S3" || normalized === "S3A" || normalized === "S3B") return "Competenze";
  if (normalized === "S4") return "Documenti";
  if (normalized === "S5") return "Dichiarazioni";
  if (normalized === "STEP_1_ANAGRAFICA") return "Anagrafica";
  if (normalized === "STEP_2_TIPOLOGIA") return "Tipologia";
  if (normalized === "STEP_3_COMPETENZE") return "Competenze";
  if (normalized === "STEP_4_DOCUMENTI") return "Documenti";
  if (normalized === "STEP_5_DICHIARAZIONI") return "Dichiarazioni";
  return sectionKey;
}

function appShortCode(applicationId: string): string {
  return `A-${applicationId.slice(0, 8).toUpperCase()}`;
}

function parsePayload(payloadJson?: string): SectionPayload | null {
  if (!payloadJson) return null;
  try {
    const parsed = JSON.parse(payloadJson) as unknown;
    if (parsed && typeof parsed === "object") return parsed as SectionPayload;
  } catch {
    return null;
  }
  return null;
}

function getSectionPayload(sections: RevampSectionSnapshot[], ...keys: string[]): SectionPayload | null {
  for (const key of keys) {
    const section = sections.find((item) => item.sectionKey === key);
    const payload = parsePayload(section?.payloadJson);
    if (payload) return payload;
  }
  return null;
}

function toScalar(value: unknown): string {
  if (typeof value === "string") return value.trim();
  if (typeof value === "number" || typeof value === "boolean") return String(value);
  return "";
}

function findUrl(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  if (trimmed.startsWith("http://") || trimmed.startsWith("https://") || trimmed.startsWith("data:")) return trimmed;
  return null;
}

function canFinalizeDecision(role: AdminRole | null): boolean {
  return role === "SUPER_ADMIN" || role === "RESPONSABILE_ALBO";
}

function canRequestIntegrationDecision(role: AdminRole | null): boolean {
  return role === "SUPER_ADMIN" || role === "RESPONSABILE_ALBO" || role === "REVISORE";
}

export function AdminApplicationCasePage() {
  const { applicationId = "" } = useParams();
  const navigate = useNavigate();
  const { auth } = useAuth();
  const { adminRole } = useAdminGovernanceRole();
  const token = auth?.token ?? "";
  const [summary, setSummary] = useState<RevampApplicationSummary | null>(null);
  const [sections, setSections] = useState<RevampSectionSnapshot[]>([]);
  const [reviewHistory, setReviewHistory] = useState<AdminReviewCaseSummary[]>([]);
  const [loading, setLoading] = useState(false);
  const [busyAction, setBusyAction] = useState<DecisionAction | null>(null);
  const [latestIntegrationRequest, setLatestIntegrationRequest] = useState<AdminIntegrationRequestSummary | null>(null);
  const [tab, setTab] = useState<CaseTab>("profile");
  const [approveReason, setApproveReason] = useState("");
  const [integrationReason, setIntegrationReason] = useState("");
  const [rejectReason, setRejectReason] = useState("");
  const [internalNotes, setInternalNotes] = useState("");
  const [toast, setToast] = useState<{ message: string; type: "error" | "success" } | null>(null);

  const appId = applicationId.trim();
  const validAppId = UUID_PATTERN.test(appId);
  const notesStorageKey = `admin_case_notes_${appId}`;

  useEffect(() => {
    if (!validAppId) return;
    try {
      const saved = window.localStorage.getItem(notesStorageKey);
      setInternalNotes(saved ?? "");
    } catch {
      setInternalNotes("");
    }
  }, [notesStorageKey, validAppId]);

  async function loadCase() {
    if (!token || !validAppId) return;
    setLoading(true);
    try {
      const summaryData = await getRevampApplicationSummary(appId, token);
      setSummary(summaryData);

      const [sectionsResult, historyResult] = await Promise.allSettled([
        getRevampApplicationSections(appId, token),
        getAdminReviewHistory(appId, token)
      ]);

      if (sectionsResult.status === "fulfilled") {
        setSections(sectionsResult.value);
      } else {
        setSections([]);
      }

      if (historyResult.status === "fulfilled") {
        const sortedHistory = [...historyResult.value].sort((a, b) => Date.parse(b.updatedAt) - Date.parse(a.updatedAt));
        setReviewHistory(sortedHistory);
        const latestCaseId = sortedHistory[0]?.id;
        if (latestCaseId) {
          try {
            const latestIntegration = await getLatestAdminIntegrationRequest(latestCaseId, token);
            setLatestIntegrationRequest(latestIntegration);
          } catch {
            setLatestIntegrationRequest(null);
          }
        } else {
          setLatestIntegrationRequest(null);
        }
      } else {
        setReviewHistory([]);
        setLatestIntegrationRequest(null);
      }
    } catch (error) {
      const message = error instanceof HttpError ? error.message : "Caricamento pratica non riuscito.";
      setToast({ message, type: "error" });
      setSummary(null);
      setSections([]);
      setReviewHistory([]);
      setLatestIntegrationRequest(null);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void loadCase();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token, appId]);

  const latestCase = useMemo(() => reviewHistory[0] ?? null, [reviewHistory]);
  const submittedDays = useMemo(() => daysSince(summary?.submittedAt ?? null), [summary?.submittedAt]);
  const isUrgent = (submittedDays ?? 0) >= 5 && summary?.status !== "APPROVED";
  const completedSections = useMemo(() => sections.filter((section) => section.completed), [sections]);
  const s1Payload = useMemo(() => getSectionPayload(sections, "S1"), [sections]);
  const s2Payload = useMemo(() => getSectionPayload(sections, "S2"), [sections]);
  const s3Payload = useMemo(() => getSectionPayload(sections, "S3A", "S3B", "S3"), [sections]);
  const s4Payload = useMemo(() => getSectionPayload(sections, "S4"), [sections]);
  const canFinalize = canFinalizeDecision(adminRole);
  const canRequestIntegration = canRequestIntegrationDecision(adminRole);
  const reviewReadOnly = auth?.role === "ADMIN" && adminRole === "VIEWER";
  const isFinalized = latestCase?.status === "DECIDED" || summary?.status === "APPROVED" || summary?.status === "REJECTED";
  const assignedToOther = Boolean(latestCase?.assignedToUserId && auth?.userId && latestCase.assignedToUserId !== auth.userId);

  const candidateHeaderTitle = useMemo(() => {
    if (!summary) return "Candidatura";
    if (summary.registryType === "ALBO_B") {
      const companyName = toScalar(s1Payload?.companyName);
      if (companyName) return companyName;
    }
    const repName = toScalar(s1Payload?.legalRepresentativeName);
    if (repName) return repName;
    return appShortCode(summary.id);
  }, [s1Payload, summary]);

  const candidateMetaRows = useMemo(() => {
    const rows: Array<{ label: string; value: string }> = [];
    if (summary?.registryType === "ALBO_A") {
      rows.push({ label: "Codice fiscale", value: toScalar(s1Payload?.taxCode) || "n/d" });
      rows.push({ label: "Telefono", value: toScalar(s1Payload?.phone) || "n/d" });
      rows.push({
        label: "Localita",
        value: [toScalar(s1Payload?.city), toScalar(s1Payload?.province)].filter(Boolean).join(" - ") || "n/d"
      });
      rows.push({ label: "CAP", value: toScalar(s1Payload?.postalCode) || "n/d" });
      rows.push({ label: "Tipologia professionale", value: toScalar(s2Payload?.professionalType) || "n/d" });
    } else {
      rows.push({ label: "Partita IVA", value: toScalar(s1Payload?.vatNumber) || "n/d" });
      rows.push({ label: "REA", value: toScalar(s1Payload?.reaNumber) || "n/d" });
      rows.push({ label: "Rappresentante legale", value: toScalar(s1Payload?.legalRepresentativeName) || "n/d" });
      rows.push({ label: "Email operativo", value: toScalar(s1Payload?.operationalContactEmail) || "n/d" });
      rows.push({ label: "Fascia dipendenti", value: toScalar(s2Payload?.employeeRange) || "n/d" });
    }
    return rows;
  }, [s1Payload, s2Payload, summary?.registryType]);

  const profileSectionRows = useMemo(() => {
    return sections.map((section) => {
      const payload = parsePayload(section.payloadJson) ?? {};
      let summaryText = "Nessun dettaglio disponibile";
      if (section.sectionKey === "S1") {
        summaryText = summary?.registryType === "ALBO_A"
          ? [toScalar(payload.taxCode), toScalar(payload.phone), toScalar(payload.city)].filter(Boolean).join(" - ")
          : [toScalar(payload.companyName), toScalar(payload.vatNumber), toScalar(payload.operationalContactEmail)].filter(Boolean).join(" - ");
      } else if (section.sectionKey === "S2") {
        summaryText = [toScalar(payload.professionalType), toScalar(payload.atecoCode), toScalar(payload.employeeRange), toScalar(payload.atecoPrimary)]
          .filter(Boolean)
          .join(" - ");
      } else if (section.sectionKey === "S3A" || section.sectionKey === "S3B" || section.sectionKey === "S3") {
        summaryText = [toScalar(payload.thematicAreasCsv), toScalar(payload.specialization), toScalar(payload.serviceCategoriesCsv)]
          .filter(Boolean)
          .join(" - ");
      } else if (section.sectionKey === "S4") {
        summaryText = [toScalar(payload.operationalCapacity), toScalar(payload.referencesSummary), toScalar(payload.accreditationSummary)]
          .filter(Boolean)
          .join(" - ");
      } else if (section.sectionKey === "S5") {
        summaryText = [toScalar(payload.acceptance1), toScalar(payload.acceptance2), toScalar(payload.acceptance3)]
          .filter(Boolean)
          .join(" - ");
      }
      return {
        id: section.id,
        label: sectionLabel(section.sectionKey),
        completed: section.completed,
        updatedAt: section.updatedAt,
        summaryText: summaryText || "Nessun dettaglio disponibile"
      };
    });
  }, [sections, summary?.registryType]);

  const documentRows = useMemo<DocumentRow[]>(() => {
    const rows: DocumentRow[] = [];
    const s1Photo = (s1Payload?.profilePhotoAttachment as Record<string, unknown> | undefined) ?? null;
    const s1PhotoUrl = findUrl(s1Photo?.storageKey ?? s1Payload?.profilePhotoDataUrl);
    if (s1Payload && (s1Photo || "profilePhotoDataUrl" in s1Payload || "profilePhotoName" in s1Payload)) {
      rows.push({
        id: "profile-photo",
        label: toScalar(s1Photo?.fileName ?? s1Payload.profilePhotoName) || "Foto profilo",
        sectionLabel: "Anagrafica",
        url: s1PhotoUrl,
        hasLink: Boolean(s1PhotoUrl)
      });
    }

    const s4Attachments = Array.isArray(s4Payload?.attachments)
      ? (s4Payload.attachments as Array<Record<string, unknown>>)
      : [];
    s4Attachments.forEach((attachment, index) => {
      const labelParts = [toScalar(attachment.documentType), toScalar(attachment.fileName)].filter(Boolean);
      const expired = Boolean(attachment.expired);
      const expiringSoon = Boolean(attachment.expiringSoon);
      const stateLabel = expired ? "Scaduto" : (expiringSoon ? "In scadenza" : "");
      const url = findUrl(attachment.storageKey);
      rows.push({
        id: `S4-attachment-${index}`,
        label: `${labelParts.join(" - ")}${stateLabel ? ` (${stateLabel})` : ""}` || "Allegato",
        sectionLabel: "Documenti",
        url,
        hasLink: Boolean(url)
      });
    });

    const payloadCandidates = [
      { key: "S3", payload: s3Payload },
      { key: "S4", payload: s4Payload }
    ];
    payloadCandidates.forEach((entry) => {
      if (!entry.payload) return;
      Object.entries(entry.payload).forEach(([field, raw]) => {
        const url = findUrl(raw);
        if (!url) return;
        rows.push({
          id: `${entry.key}-${field}`,
          label: field,
          sectionLabel: sectionLabel(entry.key),
          url,
          hasLink: true
        });
      });
    });
    return rows;
  }, [s1Payload, s3Payload, s4Payload]);

  const checklistRows = useMemo(
    () => [
      { label: "Protocollo assegnato", done: Boolean(summary?.protocolCode) },
      { label: "Questionario inviato", done: Boolean(summary?.submittedAt) },
      { label: "Sezioni completate", done: completedSections.length === sections.length && sections.length > 0 },
      { label: "Review case attivo", done: Boolean(latestCase) },
      { label: "Documenti con link apribile", done: documentRows.some((row) => row.hasLink) }
    ],
    [completedSections.length, documentRows, latestCase, sections.length, summary?.protocolCode, summary?.submittedAt]
  );

  async function submitDecision(decision: DecisionAction, reason: string) {
    const actionAllowed = decision === "INTEGRATION_REQUIRED" ? canRequestIntegration : canFinalize;
    if (!actionAllowed || assignedToOther || isFinalized) {
      setToast({ message: "Ruolo non autorizzato ad approvare/rigettare candidature.", type: "error" });
      return;
    }
    if (!token || !latestCase || !reason.trim()) {
      setToast({ message: "Inserisci una motivazione prima di inviare l'azione.", type: "error" });
      return;
    }

    setBusyAction(decision);
    try {
      await saveAdminReviewDecision(latestCase.id, token, { decision, reason: reason.trim() });
      setToast({ message: "Decisione salvata correttamente.", type: "success" });
      await loadCase();
      if (decision === "INTEGRATION_REQUIRED") {
        navigate(`/admin/candidature/${appId}/integration`);
      }
    } catch (error) {
      const message = error instanceof HttpError ? error.message : "Salvataggio decisione non riuscito.";
      setToast({ message, type: "error" });
    } finally {
      setBusyAction(null);
    }
  }

  function openDocument(url: string | null) {
    if (!url) return;
    window.open(url, "_blank", "noopener,noreferrer");
  }

  function saveInternalNotes() {
    try {
      window.localStorage.setItem(notesStorageKey, internalNotes);
      setToast({ message: "Note interne salvate in locale.", type: "success" });
    } catch {
      setToast({ message: "Salvataggio note non riuscito.", type: "error" });
    }
  }

  return (
    <AdminCandidatureShell active="candidature">
      <section className="stack admin-review-case-shell">
        {toast ? <AppToast toast={toast} onClose={() => setToast(null)} className="admin-toast" /> : null}

      <div className="panel">
        <h2><FileText className="h-5 w-5" /> Revisione candidatura</h2>
        <p className="subtle">Application ID: {appId || "n/d"}</p>
        {!validAppId ? <p className="error">Application ID non valido (UUID richiesto).</p> : null}
      </div>

      {summary && isUrgent ? (
        <div className="panel admin-review-urgency-banner">
          <p>
            <AlertTriangle className="h-4 w-4" />
            Candidatura in attesa da {submittedDays} giorni lavorativi: oltre la soglia di alert (&gt;5gg).
          </p>
        </div>
      ) : null}

      <div className="admin-review-top-grid">
        <div className="panel admin-review-candidate-card">
          <div className="admin-review-candidate-head">
            <span className="candidate-avatar">{summary ? appShortCode(summary.id).slice(2, 4) : "NA"}</span>
            <div>
              <h3>{candidateHeaderTitle}</h3>
              <p className="subtle">
                Registro: {summary?.registryType ?? "n/d"} - Canale: {summary?.sourceChannel ?? "n/d"} - Revisione: {summary?.currentRevision ?? 0}
              </p>
            </div>
          </div>
          <div className="admin-review-candidate-meta">
            <p><strong>Protocollo:</strong> {summary?.protocolCode ?? "n/d"}</p>
            <p><strong>Stato:</strong> {summary?.status ?? "n/d"}</p>
            <p><strong>Ultimo aggiornamento:</strong> {summary ? new Date(summary.updatedAt).toLocaleString("it-IT") : "n/d"}</p>
            <p><strong>Assegnata a:</strong> {latestCase?.assignedToDisplayName ?? "Non assegnata"}</p>
            <p><strong>SLA:</strong> {latestCase?.slaDueAt ? new Date(latestCase.slaDueAt).toLocaleString("it-IT") : "n/d"}</p>
            {candidateMetaRows.map((row) => (
              <p key={row.label}><strong>{row.label}:</strong> {row.value}</p>
            ))}
          </div>
          <div className="admin-review-inline-actions">
            <button type="button" className="home-btn home-btn-secondary" onClick={() => void loadCase()} disabled={loading}>
              {loading ? "Aggiornamento..." : "Aggiorna pratica"}
            </button>
            <Link className="home-btn home-btn-secondary" to={`/admin/candidature/${appId}/integration`}>Apri integrazione</Link>
            <Link className="home-btn home-btn-secondary" to="/admin/candidature">Torna alla coda</Link>
          </div>
        </div>

        <div className="panel">
          <h4>Checklist documentale</h4>
          <div className="admin-review-checklist">
            {checklistRows.map((row) => (
              <p key={row.label} className={row.done ? "check-ok" : "check-missing"}>
                {row.done ? <CheckCircle2 className="h-4 w-4" /> : <XCircle className="h-4 w-4" />}
                {row.label}
              </p>
            ))}
            {sections.length > 0 ? (
              <div className="admin-review-section-tags">
                {sections.map((section) => (
                  <span key={section.id} className={section.completed ? "section-tag done" : "section-tag pending"}>
                    {sectionLabel(section.sectionKey)}
                  </span>
                ))}
              </div>
            ) : null}
            <div className="admin-review-history-list">
              {documentRows.length === 0 ? (
                <p className="subtle">Nessun documento con URL disponibile nei payload sezione.</p>
              ) : (
                documentRows.map((row) => (
                  <article key={row.id} className="admin-review-history-card">
                    <p><strong>{row.label}</strong> <span className="subtle">({row.sectionLabel})</span></p>
                    <button
                      type="button"
                      className={row.hasLink ? "home-btn home-btn-secondary" : "home-btn home-btn-secondary"}
                      disabled={!row.hasLink}
                      onClick={() => openDocument(row.url)}
                    >
                      Apri
                    </button>
                  </article>
                ))
              )}
            </div>
          </div>
        </div>
      </div>

      <div className="panel">
        <div className="admin-review-tabs">
          <button type="button" className={tab === "profile" ? "active" : ""} onClick={() => setTab("profile")}><ClipboardList className="h-4 w-4" /> Profilo</button>
          <button type="button" className={tab === "history" ? "active" : ""} onClick={() => setTab("history")}><History className="h-4 w-4" /> Storico pratica</button>
          <button type="button" className={tab === "notes" ? "active" : ""} onClick={() => setTab("notes")}><MessageSquare className="h-4 w-4" /> Note interne</button>
        </div>
      </div>

      {tab === "profile" ? (
        <div className="panel">
          <h4>Profilo candidatura</h4>
          <div className="admin-review-profile-grid">
            {sections.length === 0 ? <p className="subtle">Nessuna sezione disponibile.</p> : null}
            {profileSectionRows.map((section) => (
              <article key={section.id} className="admin-review-profile-card">
                <h5>{section.label}</h5>
                <p className="subtle">Completata: {section.completed ? "SI" : "NO"}</p>
                <p className="subtle">{section.summaryText}</p>
                <p className="subtle">Aggiornata: {new Date(section.updatedAt).toLocaleString("it-IT")}</p>
              </article>
            ))}
          </div>
        </div>
      ) : null}

      {tab === "history" ? (
        <div className="panel">
          <h4>Storico workflow review</h4>
          {reviewHistory.length === 0 ? <p className="subtle">Nessun evento review disponibile.</p> : null}
          {reviewHistory.length > 0 ? (
            <div className="admin-review-history-list">
              {reviewHistory.map((item) => (
                <article key={item.id} className="admin-review-history-card">
                  <p><strong>Case:</strong> {item.id}</p>
                  <p className="subtle">Status: {item.status}</p>
                  <p className="subtle">Decisione: {item.decision ?? "n/d"}</p>
                  <p className="subtle">SLA: {item.slaDueAt ? new Date(item.slaDueAt).toLocaleString("it-IT") : "n/d"}</p>
                  <p className="subtle">Aggiornato: {new Date(item.updatedAt).toLocaleString("it-IT")}</p>
                </article>
              ))}
            </div>
          ) : null}
        </div>
      ) : null}

      {tab === "notes" ? (
        <div className="panel">
          <h4>Note del revisore</h4>
          <label className={`floating-field ${internalNotes ? "has-value" : ""}`}>
            <textarea
              className="floating-input"
              rows={6}
              value={internalNotes}
              onChange={(event) => setInternalNotes(event.target.value)}
              placeholder=" "
            />
            <span className="floating-field-label">Annotazioni interne pratica</span>
          </label>
          <div className="revamp-step-actions">
            <button type="button" className="home-btn home-btn-primary" onClick={saveInternalNotes}>Salva nota</button>
          </div>
        </div>
      ) : null}

      <div className="panel">
        <h4><Clock3 className="h-4 w-4" /> Decisione sulla candidatura</h4>
        {isFinalized ? (
          <p className="subtle">Pratica con decisione finale registrata: azioni decisionali in sola lettura.</p>
        ) : null}
        {reviewReadOnly ? (
          <p className="subtle">Ruolo VIEWER: consultazione abilitata, azioni decisionali disabilitate.</p>
        ) : null}
        {assignedToOther ? (
          <p className="subtle">Pratica assegnata a un altro revisore: azioni decisionali bloccate.</p>
        ) : null}
        <div className="admin-review-decisions-grid">
          <article className="decision-card approve">
            <h5>Approva iscrizione</h5>
            <p className="subtle">Attiva immediatamente il profilo del fornitore.</p>
            <label className={`floating-field ${approveReason ? "has-value" : ""}`}>
              <textarea className="floating-input" rows={3} value={approveReason} onChange={(event) => setApproveReason(event.target.value)} placeholder=" " />
              <span className="floating-field-label">Motivazione approvazione</span>
            </label>
            <button
              type="button"
              className="home-btn decision-btn-approve"
              onClick={() => void submitDecision("APPROVED", approveReason)}
              disabled={!latestCase || busyAction !== null || !canFinalize || assignedToOther || isFinalized}
            >
              {busyAction === "APPROVED" ? "Approvazione..." : "Approva"}
            </button>
          </article>

          <article className="decision-card integration">
            <h5>Richiedi integrazione</h5>
            <p className="subtle">Richiedi documenti mancanti o chiarimenti specifici.</p>
            <label className={`floating-field ${integrationReason ? "has-value" : ""}`}>
              <textarea className="floating-input" rows={3} value={integrationReason} onChange={(event) => setIntegrationReason(event.target.value)} placeholder=" " />
              <span className="floating-field-label">Motivazione integrazione</span>
            </label>
            <button
              type="button"
              className="home-btn decision-btn-integration"
              onClick={() => void submitDecision("INTEGRATION_REQUIRED", integrationReason)}
              disabled={!latestCase || busyAction !== null || !canRequestIntegration || assignedToOther || isFinalized}
            >
              {busyAction === "INTEGRATION_REQUIRED" ? "Invio..." : "Invia richiesta"}
            </button>
          </article>

          <article className="decision-card reject">
            <h5>Rigetta candidatura</h5>
            <p className="subtle">Chiudi la revisione con esito negativo motivato.</p>
            <label className={`floating-field ${rejectReason ? "has-value" : ""}`}>
              <textarea className="floating-input" rows={3} value={rejectReason} onChange={(event) => setRejectReason(event.target.value)} placeholder=" " />
              <span className="floating-field-label">Motivazione rigetto</span>
            </label>
            <button
              type="button"
              className="home-btn decision-btn-reject"
              onClick={() => void submitDecision("REJECTED", rejectReason)}
              disabled={!latestCase || busyAction !== null || !canFinalize || assignedToOther || isFinalized}
            >
              {busyAction === "REJECTED" ? "Rigetto..." : "Rigetta"}
            </button>
          </article>
        </div>
      </div>

      {latestIntegrationRequest ? (
        <div className="panel">
          <h4>Ultima richiesta integrazione</h4>
          <p className="subtle"><strong>Stato:</strong> {latestIntegrationRequest.status}</p>
          <p className="subtle"><strong>Scadenza:</strong> {new Date(latestIntegrationRequest.dueAt).toLocaleString("it-IT")}</p>
          <p className="subtle"><strong>Messaggio:</strong> {latestIntegrationRequest.requestMessage}</p>
          <p className="subtle">
            <strong>Elementi richiesti:</strong>{" "}
            {typeof latestIntegrationRequest.requestedItemsJson === "string"
              ? latestIntegrationRequest.requestedItemsJson
              : JSON.stringify(latestIntegrationRequest.requestedItemsJson)}
          </p>
        </div>
      ) : null}
      </section>
    </AdminCandidatureShell>
  );
}
