import { FormEvent, useEffect, useMemo, useState } from "react";
import { AlertTriangle, CheckCircle2, Mail, Send } from "lucide-react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { HttpError } from "../../api/http";
import {
  assignAdminReviewCase,
  getAdminReviewHistory,
  getLatestAdminIntegrationRequest,
  requestAdminIntegration,
  type AdminIntegrationRequestSummary,
  type AdminReviewCaseSummary
} from "../../api/adminReviewApi";
import { getRevampApplicationSummary, type RevampApplicationSummary } from "../../api/revampApplicationApi";
import { useAuth } from "../../auth/AuthContext";
import { AppToast } from "../../components/ui/toast";
import { useAdminGovernanceRole } from "../../hooks/useAdminGovernanceRole";
import { AdminCandidatureShell } from "./AdminCandidatureShell";

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

type IntegrationItemCode =
  | "ID_DOCUMENT"
  | "PROFESSIONAL_REGISTER"
  | "THEMATIC_SPECIFICATION"
  | "EXPERIENCE_CONSISTENCY"
  | "CV_UPDATE";

interface IntegrationItemTemplate {
  code: IntegrationItemCode;
  label: string;
  hint: string;
}

interface SelectedIntegrationItem {
  code: IntegrationItemCode;
  label: string;
  instruction: string;
}

const ITEM_TEMPLATES: IntegrationItemTemplate[] = [
  {
    code: "ID_DOCUMENT",
    label: "Documento di identita",
    hint: "Allegare un documento di identita valido e leggibile."
  },
  {
    code: "PROFESSIONAL_REGISTER",
    label: "Visura/iscrizione ordine professionale",
    hint: "Fornire iscrizione all'albo o ordine di appartenenza (se applicabile)."
  },
  {
    code: "THEMATIC_SPECIFICATION",
    label: "Specifica delle tematiche",
    hint: "Dettagliare meglio competenze e ambiti dichiarati nella candidatura."
  },
  {
    code: "EXPERIENCE_CONSISTENCY",
    label: "Anni di esperienza coerenti",
    hint: "Verificare e correggere eventuali incoerenze nel numero di anni dichiarati."
  },
  {
    code: "CV_UPDATE",
    label: "Curriculum aggiornato",
    hint: "Caricare CV aggiornato con evidenza delle esperienze recenti."
  }
];

function appCode(applicationId: string): string {
  return `A-${applicationId.slice(0, 8).toUpperCase()}`;
}

export function AdminIntegrationPage() {
  const { applicationId = "" } = useParams();
  const navigate = useNavigate();
  const { auth } = useAuth();
  const token = auth?.token ?? "";
  const { adminRole } = useAdminGovernanceRole();

  const [summary, setSummary] = useState<RevampApplicationSummary | null>(null);
  const [history, setHistory] = useState<AdminReviewCaseSummary[]>([]);
  const [latestIntegrationRequest, setLatestIntegrationRequest] = useState<AdminIntegrationRequestSummary | null>(null);
  const [selectedCodes, setSelectedCodes] = useState<Set<IntegrationItemCode>>(new Set());
  const [instructions, setInstructions] = useState<Record<IntegrationItemCode, string>>({
    ID_DOCUMENT: "",
    PROFESSIONAL_REGISTER: "",
    THEMATIC_SPECIFICATION: "",
    EXPERIENCE_CONSISTENCY: "",
    CV_UPDATE: ""
  });
  const [integrationDueAt, setIntegrationDueAt] = useState("");
  const [integrationMessage, setIntegrationMessage] = useState("");
  const [loading, setLoading] = useState(false);
  const [busy, setBusy] = useState(false);
  const [busyAction, setBusyAction] = useState<"open" | "send" | null>(null);
  const [toast, setToast] = useState<{ message: string; type: "error" | "success" } | null>(null);

  const normalizedAppId = applicationId.trim();
  const validAppId = UUID_PATTERN.test(normalizedAppId);
  const latestCase = useMemo(() => history[0] ?? null, [history]);
  const canOpenCase = adminRole === "SUPER_ADMIN" || adminRole === "RESPONSABILE_ALBO";
  const canRequestIntegration = adminRole === "SUPER_ADMIN" || adminRole === "RESPONSABILE_ALBO" || adminRole === "REVISORE";
  const hasOpenIntegration = latestIntegrationRequest?.status === "OPEN";

  const selectedItems = useMemo<SelectedIntegrationItem[]>(
    () =>
      ITEM_TEMPLATES.filter((template) => selectedCodes.has(template.code)).map((template) => ({
        code: template.code,
        label: template.label,
        instruction: instructions[template.code].trim()
      })),
    [instructions, selectedCodes]
  );

  const emailPreview = useMemo(() => {
    const deadline = integrationDueAt ? new Date(integrationDueAt).toLocaleDateString("it-IT") : "[data scadenza]";
    const greeting = `Gentile fornitore (${summary ? appCode(summary.id) : "candidatura"}),`;
    const baseMessage = integrationMessage.trim() || "abbiamo esaminato la candidatura e sono necessarie alcune integrazioni documentali.";
    const bulletItems = selectedItems.length === 0
      ? ["- [Nessun elemento selezionato]"]
      : selectedItems.map((item) =>
          `- ${item.label}${item.instruction ? `: ${item.instruction}` : ""}`
        );
    const body = [
      greeting,
      "",
      `${baseMessage}`,
      `Ti chiediamo di inviare i seguenti elementi entro il ${deadline}:`,
      ...bulletItems,
      "",
      "Cordiali saluti,",
      "Team Albo Fornitori"
    ].join("\n");

    return {
      subject: `Richiesta integrazione documentale - ${summary ? appCode(summary.id) : "candidatura"}`,
      body
    };
  }, [integrationDueAt, integrationMessage, selectedItems, summary]);

  async function loadPage() {
    if (!token || !validAppId) return;
    setLoading(true);
    try {
      const [summaryData, historyData] = await Promise.all([
        getRevampApplicationSummary(normalizedAppId, token),
        getAdminReviewHistory(normalizedAppId, token)
      ]);
      setSummary(summaryData);
      const sortedHistory = [...historyData].sort((a, b) => Date.parse(b.updatedAt) - Date.parse(a.updatedAt));
      setHistory(sortedHistory);
      const latestCaseId = sortedHistory[0]?.id;
      if (latestCaseId) {
        try {
          const latestReq = await getLatestAdminIntegrationRequest(latestCaseId, token);
          setLatestIntegrationRequest(latestReq);
          if (latestReq?.status === "OPEN") {
            setIntegrationDueAt(latestReq.dueAt.slice(0, 10));
            setIntegrationMessage(latestReq.requestMessage ?? "");
            const payload = latestReq.requestedItemsJson as { items?: Array<{ code?: string; instruction?: string }> } | null;
            const nextCodes = new Set<IntegrationItemCode>();
            const nextInstructions: Record<IntegrationItemCode, string> = {
              ID_DOCUMENT: "",
              PROFESSIONAL_REGISTER: "",
              THEMATIC_SPECIFICATION: "",
              EXPERIENCE_CONSISTENCY: "",
              CV_UPDATE: ""
            };
            (payload?.items ?? []).forEach((item) => {
              const code = item.code as IntegrationItemCode;
              if (code && ITEM_TEMPLATES.some((template) => template.code === code)) {
                nextCodes.add(code);
                nextInstructions[code] = (item.instruction ?? "").trim();
              }
            });
            setSelectedCodes(nextCodes);
            setInstructions(nextInstructions);
          }
        } catch {
          setLatestIntegrationRequest(null);
        }
      } else {
        setLatestIntegrationRequest(null);
      }
    } catch (error) {
      const message = error instanceof HttpError ? error.message : "Caricamento dati integrazione non riuscito.";
      setToast({ message, type: "error" });
      setSummary(null);
      setHistory([]);
      setLatestIntegrationRequest(null);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void loadPage();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token, normalizedAppId]);

  async function onOpenCase() {
    if (!token || !validAppId || !canOpenCase || busy) return;
    setBusy(true);
    setBusyAction("open");
    try {
      await assignAdminReviewCase(normalizedAppId, token);
      setToast({ message: "Review case aperto/assegnato.", type: "success" });
      await loadPage();
    } catch (error) {
      const message = error instanceof HttpError ? error.message : "Apertura review case non riuscita.";
      setToast({ message, type: "error" });
    } finally {
      setBusy(false);
      setBusyAction(null);
    }
  }

  function toggleItem(code: IntegrationItemCode) {
    setSelectedCodes((prev) => {
      const next = new Set(prev);
      if (next.has(code)) next.delete(code);
      else next.add(code);
      return next;
    });
  }

  async function onSubmitIntegration(event: FormEvent) {
    event.preventDefault();
    if (!token || !latestCase || busy || !canRequestIntegration || hasOpenIntegration) return;
    if (selectedItems.length === 0) {
      setToast({ message: "Seleziona almeno un elemento da integrare.", type: "error" });
      return;
    }
    if (!integrationDueAt || !integrationMessage.trim()) {
      setToast({ message: "Compila scadenza e messaggio introduttivo.", type: "error" });
      return;
    }

    setBusy(true);
    setBusyAction("send");
    try {
      const requestedItemsJson = JSON.stringify({
        items: selectedItems,
        generatedAt: new Date().toISOString()
      });
      await requestAdminIntegration(latestCase.id, token, {
        dueAt: integrationDueAt,
        message: integrationMessage.trim(),
        requestedItemsJson
      });
      setToast({ message: "Richiesta integrazione inviata al fornitore.", type: "success" });
      await loadPage();
      navigate(`/admin/candidature/${normalizedAppId}/review`);
    } catch (error) {
      const message = error instanceof HttpError ? error.message : "Invio integrazione non riuscito.";
      setToast({ message, type: "error" });
    } finally {
      setBusy(false);
      setBusyAction(null);
    }
  }

  return (
    <AdminCandidatureShell active="candidature">
      <section className="stack admin-integration-shell">
        {toast ? <AppToast toast={toast} onClose={() => setToast(null)} className="admin-toast" /> : null}

      <div className="panel">
        <h2><Mail className="h-5 w-5" /> Richiedi integrazione documentale</h2>
        <p className="subtle">Application ID: {normalizedAppId || "n/d"}</p>
        {!validAppId ? <p className="error">Application ID non valido (UUID richiesto).</p> : null}
        {summary ? (
          <p className="subtle">
            Candidatura: <strong>{appCode(summary.id)}</strong> - Registro: {summary.registryType} - Stato: {summary.status}
          </p>
        ) : null}
        {hasOpenIntegration ? (
          <p className="subtle">Esiste gia una richiesta integrazione OPEN: modifica/consultazione in sola lettura.</p>
        ) : null}
      </div>

      {!latestCase ? (
        <div className="panel">
          <p className="subtle">Nessun review case attivo per questa candidatura.</p>
          <button type="button" className="home-btn home-btn-primary" onClick={() => void onOpenCase()} disabled={!canOpenCase || busy || loading}>
            <Send className="h-4 w-4" />
            {busyAction === "open" ? "Apertura case..." : "Apri/Assegna review case"}
          </button>
          {!canOpenCase && auth?.role === "ADMIN" ? (
            <p className="subtle">Apertura case disponibile solo per SUPER_ADMIN o RESPONSABILE_ALBO.</p>
          ) : null}
        </div>
      ) : null}

      {latestCase ? (
        <form className="panel admin-integration-form" onSubmit={onSubmitIntegration}>
          <h4>Documenti e sezioni da integrare</h4>
          <p className="subtle">Seleziona gli elementi mancanti e aggiungi istruzioni specifiche.</p>

          <div className="admin-integration-items">
            {ITEM_TEMPLATES.map((item) => {
              const checked = selectedCodes.has(item.code);
              return (
                <article key={item.code} className={checked ? "integration-item selected" : "integration-item"}>
                  <label className="integration-item-head">
                    <input type="checkbox" checked={checked} onChange={() => toggleItem(item.code)} disabled={hasOpenIntegration} />
                    <span>{item.label}</span>
                  </label>
                  <p className="subtle">{item.hint}</p>
                  <input
                    className="floating-input integration-item-input"
                    value={instructions[item.code]}
                    onChange={(event) =>
                      setInstructions((prev) => ({
                        ...prev,
                        [item.code]: event.target.value
                      }))
                    }
                    placeholder="Aggiungi istruzione specifica"
                    disabled={!checked || hasOpenIntegration}
                  />
                </article>
              );
            })}
          </div>

          <div className="admin-integration-meta-grid">
            <label className={`floating-field ${integrationDueAt ? "has-value" : ""}`}>
              <input
                className="floating-input"
                type="date"
                value={integrationDueAt}
                onChange={(event) => setIntegrationDueAt(event.target.value)}
                placeholder=" "
                disabled={hasOpenIntegration}
              />
              <span className="floating-field-label">Scadenza risposta fornitore *</span>
            </label>
            <label className={`floating-field ${integrationMessage ? "has-value" : ""}`}>
              <textarea
                className="floating-input"
                rows={3}
                value={integrationMessage}
                onChange={(event) => setIntegrationMessage(event.target.value)}
                placeholder=" "
                disabled={hasOpenIntegration}
              />
              <span className="floating-field-label">Messaggio introduttivo *</span>
            </label>
          </div>

          <div className="admin-integration-preview">
            <h5><CheckCircle2 className="h-4 w-4" /> Anteprima e-mail</h5>
            <p><strong>Oggetto:</strong> {emailPreview.subject}</p>
            <pre>{emailPreview.body}</pre>
          </div>

          <div className="admin-integration-actions">
            <Link className="home-btn home-btn-secondary" to={`/admin/candidature/${normalizedAppId}/review`}>Annulla</Link>
            <button type="submit" className="home-btn home-btn-primary" disabled={busy || !canRequestIntegration || hasOpenIntegration}>
              {busyAction === "send" ? "Invio richiesta..." : "Invia richiesta al fornitore"}
            </button>
          </div>

          {!canRequestIntegration && auth?.role === "ADMIN" ? (
            <p className="subtle integration-access-note">
              Invio integrazione disponibile solo per SUPER_ADMIN, RESPONSABILE_ALBO o REVISORE.
            </p>
          ) : null}
        </form>
      ) : null}

      <div className="panel">
        <p className="subtle" style={{ display: "inline-flex", alignItems: "center", gap: "0.35rem" }}>
          <AlertTriangle className="h-4 w-4" />
          Dopo l'invio, la candidatura resta in stato integrazione fino alla risposta del fornitore.
        </p>
      </div>
      </section>
    </AdminCandidatureShell>
  );
}
