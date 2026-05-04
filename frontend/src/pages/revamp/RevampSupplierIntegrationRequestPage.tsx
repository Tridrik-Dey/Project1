import { useEffect, useMemo, useState } from "react";
import { AlertTriangle, ArrowLeft, CheckCircle2, Clock3, FileUp, MessageSquare, Send, Wrench } from "lucide-react";
import { Link, Navigate, useNavigate, useParams } from "react-router-dom";
import {
  getOpenRevampIntegrationRequest,
  getRevampApplicationSummary,
  submitRevampApplication,
  type RevampApplicationSummary,
  type RevampIntegrationRequestSummary
} from "../../api/revampApplicationApi";
import { HttpError } from "../../api/http";
import { useAuth } from "../../auth/AuthContext";
import { AppToast } from "../../components/ui/toast";

type RequestedItem = {
  code: string;
  label: string;
  instruction: string;
};

function parseRequestedItems(payload: unknown): RequestedItem[] {
  if (!payload || typeof payload !== "object") return [];
  const rawItems = Array.isArray((payload as { items?: unknown }).items)
    ? (payload as { items: unknown[] }).items
    : [];

  return rawItems
    .map((item) => {
      if (!item || typeof item !== "object") return null;
      const value = item as Record<string, unknown>;
      return {
        code: typeof value.code === "string" ? value.code : "OTHER",
        label: typeof value.label === "string" ? value.label : "Elemento richiesto",
        instruction: typeof value.instruction === "string" ? value.instruction : ""
      };
    })
    .filter((item): item is RequestedItem => Boolean(item));
}

function targetStepForItem(item: RequestedItem): number {
  if (item.code === "THEMATIC_SPECIFICATION" || item.code === "EXPERIENCE_CONSISTENCY") return 3;
  if (item.code === "ID_DOCUMENT" || item.code === "PROFESSIONAL_REGISTER" || item.code === "CV_UPDATE") return 4;
  return 1;
}

function registryPath(registryType?: string | null): string {
  if (registryType === "ALBO_B") return "albo-b";
  return "albo-a";
}

function wizardStepPath(application: RevampApplicationSummary | null, step: number): string {
  const registry = registryPath(application?.registryType);
  if (step <= 1) return `/apply/${registry}`;
  return `/apply/${registry}/step/${step}`;
}

export function RevampSupplierIntegrationRequestPage() {
  const { applicationId = "" } = useParams();
  const navigate = useNavigate();
  const { auth } = useAuth();
  const token = auth?.token ?? "";

  const [application, setApplication] = useState<RevampApplicationSummary | null>(null);
  const [request, setRequest] = useState<RevampIntegrationRequestSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [toast, setToast] = useState<{ message: string; type: "error" | "success" } | null>(null);

  useEffect(() => {
    if (!token || !applicationId) {
      setLoading(false);
      return;
    }
    let cancelled = false;
    async function load() {
      try {
        const [summary, openRequest] = await Promise.all([
          getRevampApplicationSummary(applicationId, token),
          getOpenRevampIntegrationRequest(applicationId, token)
        ]);
        if (cancelled) return;
        setApplication(summary);
        setRequest(openRequest);
      } catch (error) {
        if (!cancelled) {
          const message = error instanceof HttpError ? error.message : "Caricamento richiesta integrazione non riuscito.";
          setToast({ message, type: "error" });
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    void load();
    return () => {
      cancelled = true;
    };
  }, [applicationId, token]);

  const requestedItems = useMemo(() => parseRequestedItems(request?.requestedItemsJson), [request]);
  const dueDateLabel = request?.dueAt ? new Date(request.dueAt).toLocaleDateString("it-IT") : "Non indicata";
  const profilePath = application ? `/apply/${registryPath(application.registryType)}/my-profile` : "/supplier/dashboard";

  async function sendIntegrationResponse() {
    if (!token || !application || busy) return;
    setBusy(true);
    try {
      await submitRevampApplication(application.id, token);
      setToast({ message: "Integrazione inviata correttamente.", type: "success" });
      window.setTimeout(() => navigate(profilePath), 600);
    } catch (error) {
      const message = error instanceof HttpError ? error.message : "Invio integrazione non riuscito. Controlla i dati e riprova.";
      setToast({ message, type: "error" });
    } finally {
      setBusy(false);
    }
  }

  if (!auth) return <Navigate to="/login" replace />;

  return (
    <section className="supplier-integration-page">
      {toast ? <AppToast toast={toast} onClose={() => setToast(null)} /> : null}

      <div className="supplier-integration-shell">
        <Link to={profilePath} className="supplier-integration-back">
          <ArrowLeft size={15} /> Torna al profilo
        </Link>

        <div className="supplier-integration-hero">
          <div className="supplier-integration-hero-icon">
            <FileUp size={24} />
          </div>
          <div>
            <h1>Richiesta integrazione</h1>
            <p>Completa le informazioni richieste dal Gruppo Solco e invia di nuovo la candidatura.</p>
          </div>
          <span className="supplier-integration-due">
            <Clock3 size={14} /> Scadenza: {dueDateLabel}
          </span>
        </div>

        {loading ? (
          <div className="supplier-integration-card">
            <p className="subtle">Caricamento richiesta...</p>
          </div>
        ) : !request ? (
          <div className="supplier-integration-empty">
            <CheckCircle2 size={24} />
            <div>
              <h2>Nessuna integrazione aperta</h2>
              <p>Non risultano richieste di documenti o informazioni mancanti per questa candidatura.</p>
            </div>
          </div>
        ) : (
          <>
            <div className="supplier-integration-card">
              <div className="supplier-integration-card-head">
                <MessageSquare size={18} />
                <h2>Messaggio ricevuto</h2>
              </div>
              <p className="supplier-integration-message">{request.requestMessage}</p>
            </div>

            <div className="supplier-integration-items">
              {requestedItems.length === 0 ? (
                <div className="supplier-integration-item">
                  <div className="supplier-integration-item-icon"><AlertTriangle size={18} /></div>
                  <div>
                    <h3>Richiesta generale</h3>
                    <p>Controlla la candidatura e aggiorna le informazioni indicate nel messaggio.</p>
                  </div>
                  <Link className="supplier-integration-edit" to={wizardStepPath(application, 1)}>
                    Modifica candidatura
                  </Link>
                </div>
              ) : requestedItems.map((item) => {
                const step = targetStepForItem(item);
                return (
                  <div key={`${item.code}-${item.label}`} className="supplier-integration-item">
                    <div className="supplier-integration-item-icon"><Wrench size={18} /></div>
                    <div>
                      <h3>{item.label}</h3>
                      <p>{item.instruction || "Aggiorna questa parte della candidatura."}</p>
                    </div>
                    <Link className="supplier-integration-edit" to={wizardStepPath(application, step)}>
                      Modifica sezione {step}
                    </Link>
                  </div>
                );
              })}
            </div>

            <div className="supplier-integration-submit-card">
              <div>
                <h2>Quando hai completato le modifiche</h2>
                <p>Invia l'integrazione: la pratica tornera al Gruppo Solco per una nuova verifica.</p>
              </div>
              <button type="button" className="supplier-integration-submit" onClick={sendIntegrationResponse} disabled={busy}>
                <Send size={16} /> {busy ? "Invio..." : "Invia integrazione"}
              </button>
            </div>
          </>
        )}
      </div>
    </section>
  );
}
