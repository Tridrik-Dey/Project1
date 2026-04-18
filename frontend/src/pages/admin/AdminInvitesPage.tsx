import { FormEvent, useEffect, useMemo, useState } from "react";
import {
  AlertTriangle,
  CheckCircle2,
  Clock3,
  Copy,
  MailPlus,
  RefreshCw,
  Send,
  UserRound,
  XCircle
} from "lucide-react";
import { Link } from "react-router-dom";
import {
  createAdminInvite,
  getAdminInviteMonitor,
  renewAdminInvite,
  type CreateAdminInvitePayload
} from "../../api/adminInviteApi";
import { HttpError } from "../../api/http";
import { useAuth } from "../../auth/AuthContext";
import { AppToast } from "../../components/ui/toast";
import { useAdminGovernanceRole } from "../../hooks/useAdminGovernanceRole";
import type {
  AdminInviteMonitorResponse,
  AdminInviteMonitorRow,
  AdminInviteResponse,
  AdminInviteUiStatus
} from "../../types/api";
import { AdminCandidatureShell } from "./AdminCandidatureShell";

interface AdminInvitesPageProps {
  mode: "manage" | "new";
}

type InviteDraft = {
  registryType: "ALBO_A" | "ALBO_B";
  firstName: string;
  lastName: string;
  invitedEmail: string;
  roleExpectation: string;
  expiresInDays: string;
  priority: "BASSA" | "MEDIA" | "ALTA";
  note: string;
};

const EMPTY_DRAFT: InviteDraft = {
  registryType: "ALBO_A",
  firstName: "",
  lastName: "",
  invitedEmail: "",
  roleExpectation: "",
  expiresInDays: "30",
  priority: "MEDIA",
  note: ""
};

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const EMPTY_MONITOR: AdminInviteMonitorResponse = {
  totalInvites: 0,
  completedInvites: 0,
  pendingInvites: 0,
  expiredInvites: 0,
  rows: []
};

const UI_STATUS_LABEL: Record<AdminInviteUiStatus, string> = {
  COMPLETATO: "Completato",
  IN_ATTESA: "In attesa",
  IN_COMPILAZIONE: "In compilazione",
  SCADUTO: "Scaduto",
  RIFIUTATO: "Rifiutato"
};

function registryLabel(value: "ALBO_A" | "ALBO_B"): string {
  return value === "ALBO_A" ? "Albo A" : "Albo B";
}

function toDisplayDate(iso: string | null | undefined): string {
  if (!iso) return "-";
  const parsed = Date.parse(iso);
  if (!Number.isFinite(parsed)) return "-";
  return new Date(parsed).toLocaleDateString("it-IT");
}

function inviteStatusTone(row: AdminInviteMonitorRow): "ok" | "warn" | "info" | "danger" | "neutral" {
  if (row.uiStatus === "COMPLETATO") return "ok";
  if (row.uiStatus === "IN_ATTESA") return "info";
  if (row.uiStatus === "IN_COMPILAZIONE") return "info";
  if (row.uiStatus === "SCADUTO") return "warn";
  if (row.uiStatus === "RIFIUTATO") return "danger";
  return "neutral";
}

export function AdminInvitesPage({ mode }: AdminInvitesPageProps) {
  const { auth } = useAuth();
  const token = auth?.token ?? "";
  const { adminRole } = useAdminGovernanceRole();
  const [monitor, setMonitor] = useState<AdminInviteMonitorResponse>(EMPTY_MONITOR);
  const [loadingMonitor, setLoadingMonitor] = useState(false);
  const [renewingId, setRenewingId] = useState<string | null>(null);
  const [draft, setDraft] = useState<InviteDraft>(EMPTY_DRAFT);
  const [createBusy, setCreateBusy] = useState(false);
  const [createdInvite, setCreatedInvite] = useState<AdminInviteResponse | null>(null);
  const [toast, setToast] = useState<{ message: string; type: "error" | "success" } | null>(null);
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState<"ALL" | AdminInviteUiStatus>("ALL");
  const [registryFilter, setRegistryFilter] = useState<"ALL" | "ALBO_A" | "ALBO_B">("ALL");

  const canCreateInvite = adminRole === "SUPER_ADMIN" || adminRole === "RESPONSABILE_ALBO";
  const normalizedEmail = draft.invitedEmail.trim().toLowerCase();
  const expires = Number.parseInt(draft.expiresInDays, 10);
  const emailValid = EMAIL_PATTERN.test(normalizedEmail);
  const expiresValid = Number.isFinite(expires) && expires >= 1 && expires <= 365;
  const canSubmitInvite = emailValid && expiresValid && draft.firstName.trim().length > 0 && draft.lastName.trim().length > 0;

  function inviteLink(tokenValue: string): string {
    const base = typeof window === "undefined" ? "" : window.location.origin;
    return `${base}/invite/${tokenValue}`;
  }

  async function copyInviteLink(tokenValue: string) {
    const value = inviteLink(tokenValue);
    try {
      if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(value);
        setToast({ message: "Link invito copiato.", type: "success" });
      } else {
        setToast({ message: value, type: "success" });
      }
    } catch {
      setToast({ message: value, type: "success" });
    }
  }

  async function loadMonitor() {
    if (!token || !canCreateInvite) return;
    setLoadingMonitor(true);
    try {
      const data = await getAdminInviteMonitor(token);
      setMonitor(data);
    } catch (error) {
      const message = error instanceof HttpError ? error.message : "Caricamento monitor inviti non riuscito.";
      setToast({ message, type: "error" });
      setMonitor(EMPTY_MONITOR);
    } finally {
      setLoadingMonitor(false);
    }
  }

  useEffect(() => {
    if (mode !== "manage") return;
    void loadMonitor();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mode, token, adminRole]);

  const filteredRows = useMemo(() => {
    const term = searchTerm.trim().toLowerCase();
    return monitor.rows.filter((row) => {
      if (statusFilter !== "ALL" && row.uiStatus !== statusFilter) return false;
      if (registryFilter !== "ALL" && row.registryType !== registryFilter) return false;
      if (!term) return true;
      const corpus = [row.invitedName ?? "", row.invitedEmail, row.invitedByName ?? ""].join(" ").toLowerCase();
      return corpus.includes(term);
    });
  }, [monitor.rows, registryFilter, searchTerm, statusFilter]);

  async function onRenewInvite(row: AdminInviteMonitorRow) {
    if (!token || renewingId || !row.canRenew || !canCreateInvite) return;
    setRenewingId(row.id);
    try {
      await renewAdminInvite(row.id, token, { expiresInDays: 30 });
      setToast({ message: "Invito rinnovato con successo.", type: "success" });
      await loadMonitor();
    } catch (error) {
      const message = error instanceof HttpError ? error.message : "Rinnovo invito non riuscito.";
      setToast({ message, type: "error" });
    } finally {
      setRenewingId(null);
    }
  }

  async function onCreateInvite(event: FormEvent) {
    event.preventDefault();
    if (!token || !canCreateInvite || createBusy || !canSubmitInvite) return;

    const fullName = `${draft.firstName.trim()} ${draft.lastName.trim()}`.trim();
    const noteParts = [
      draft.roleExpectation.trim() ? `Tipologia attesa: ${draft.roleExpectation.trim()}` : "",
      draft.note.trim() ? `Messaggio: ${draft.note.trim()}` : "",
      `Priorita: ${draft.priority}`
    ].filter(Boolean);

    const payload: CreateAdminInvitePayload = {
      registryType: draft.registryType,
      invitedEmail: normalizedEmail,
      invitedName: fullName || undefined,
      expiresInDays: expires,
      note: noteParts.join(" | ")
    };

    setCreateBusy(true);
    try {
      const response = await createAdminInvite(payload, token);
      setCreatedInvite(response);
      setToast({ message: "Invito inviato con successo.", type: "success" });
      setDraft((prev) => ({ ...EMPTY_DRAFT, registryType: prev.registryType }));
    } catch (error) {
      const message = error instanceof HttpError ? error.message : "Invio invito non riuscito.";
      setToast({ message, type: "error" });
    } finally {
      setCreateBusy(false);
    }
  }

  const previewName = `${draft.firstName.trim()} ${draft.lastName.trim()}`.trim() || "Fornitore";
  const previewRegistry = draft.registryType === "ALBO_A" ? "Albo A - Professionisti" : "Albo B - Aziende";
  const previewExpiry = Number.isFinite(expires)
    ? new Date(Date.now() + expires * 24 * 60 * 60 * 1000).toLocaleDateString("it-IT")
    : "-";

  const manageBody = (
    <section className="stack admin-invites-shell">
      {toast ? <AppToast toast={toast} onClose={() => setToast(null)} className="admin-toast" /> : null}

      <div className="panel admin-invites-head">
        <div>
          <h2><MailPlus className="h-5 w-5" /> Gestione Inviti</h2>
          <p className="subtle">Monitora invii, stato compilazione e azioni rapide.</p>
        </div>
        <div className="admin-invites-head-actions">
          <button type="button" className="home-btn home-btn-secondary" onClick={() => void loadMonitor()} disabled={loadingMonitor}>
            <RefreshCw className={`h-4 w-4 ${loadingMonitor ? "animate-spin" : ""}`} />
            {loadingMonitor ? "Aggiornamento..." : "Aggiorna"}
          </button>
          <Link to="/admin/invites/new" className="home-btn home-btn-primary">+ Nuovo invito</Link>
        </div>
      </div>

      <div className="admin-invites-kpis">
        <article className="panel admin-invites-kpi kpi-total">
          <p className="kpi-title">Inviti inviati (totale)</p>
          <strong>{monitor.totalInvites}</strong>
        </article>
        <article className="panel admin-invites-kpi kpi-completed">
          <p className="kpi-title">Completati</p>
          <strong>{monitor.completedInvites}</strong>
        </article>
        <article className="panel admin-invites-kpi kpi-pending">
          <p className="kpi-title">In attesa</p>
          <strong>{monitor.pendingInvites}</strong>
        </article>
        <article className="panel admin-invites-kpi kpi-expired">
          <p className="kpi-title">Scaduti senza utilizzo</p>
          <strong>{monitor.expiredInvites}</strong>
        </article>
      </div>

      <div className="panel admin-invites-filters">
        <input
          className="floating-input"
          placeholder="Cerca per nome o e-mail..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
        />
        <select className="floating-input" value={statusFilter} onChange={(e) => setStatusFilter(e.target.value as "ALL" | AdminInviteUiStatus)}>
          <option value="ALL">Tutti gli stati</option>
          <option value="IN_ATTESA">In attesa</option>
          <option value="IN_COMPILAZIONE">In compilazione</option>
          <option value="COMPLETATO">Completato</option>
          <option value="SCADUTO">Scaduto</option>
          <option value="RIFIUTATO">Rifiutato</option>
        </select>
        <select className="floating-input" value={registryFilter} onChange={(e) => setRegistryFilter(e.target.value as "ALL" | "ALBO_A" | "ALBO_B")}>
          <option value="ALL">Tutti gli albi</option>
          <option value="ALBO_A">Albo A</option>
          <option value="ALBO_B">Albo B</option>
        </select>
      </div>

      <div className="panel">
        <div className="admin-invites-table">
          <div className="admin-invites-row admin-invites-row-head">
            <span>Nome / E-mail</span>
            <span>Tipo Albo</span>
            <span>Inviato il</span>
            <span>Scadenza</span>
            <span>Stato</span>
            <span>Avanzamento</span>
            <span>Inviato da</span>
            <span>Azioni</span>
          </div>
          {loadingMonitor ? <p className="subtle">Caricamento inviti...</p> : null}
          {!loadingMonitor && filteredRows.length === 0 ? <p className="subtle">Nessun invito trovato per i filtri selezionati.</p> : null}
          {!loadingMonitor && filteredRows.map((row) => {
            const tone = inviteStatusTone(row);
            const showProgress = row.uiStatus === "IN_COMPILAZIONE" || row.uiStatus === "COMPLETATO";
            return (
              <div key={row.id} className="admin-invites-row">
                <div className="invite-user-cell">
                  <strong>{row.invitedName?.trim() || row.invitedEmail.split("@")[0]}</strong>
                  <p className="subtle">{row.invitedEmail}</p>
                </div>
                <span className={`invite-registry-pill ${row.registryType === "ALBO_A" ? "albo-a" : "albo-b"}`}>{registryLabel(row.registryType)}</span>
                <span>{toDisplayDate(row.createdAt)}</span>
                <span>{toDisplayDate(row.expiresAt)}</span>
                <span className={`invite-status-pill tone-${tone}`}>
                  {row.uiStatus === "COMPLETATO" ? <CheckCircle2 className="h-4 w-4" /> : null}
                  {row.uiStatus === "IN_ATTESA" ? <Clock3 className="h-4 w-4" /> : null}
                  {row.uiStatus === "IN_COMPILAZIONE" ? <UserRound className="h-4 w-4" /> : null}
                  {row.uiStatus === "SCADUTO" ? <AlertTriangle className="h-4 w-4" /> : null}
                  {row.uiStatus === "RIFIUTATO" ? <XCircle className="h-4 w-4" /> : null}
                  {UI_STATUS_LABEL[row.uiStatus]}
                </span>
                <div className="invite-progress-cell">
                  {showProgress ? (
                    <div className="invite-progress">
                      <div className="invite-progress-fill" style={{ width: `${row.progressPercent}%` }} />
                    </div>
                  ) : (
                    <span className="subtle">-</span>
                  )}
                </div>
                <span>{row.invitedByName || "n/d"}</span>
                <div className="invite-actions-cell">
                  {row.canOpenProfile && row.profilePath ? (
                    <Link className="home-btn home-btn-secondary invite-action-btn" to={row.profilePath}>
                      Profilo
                    </Link>
                  ) : null}
                  {row.canRenew ? (
                    <button
                      type="button"
                      className="home-btn home-btn-secondary invite-action-btn"
                      onClick={() => void onRenewInvite(row)}
                      disabled={renewingId === row.id || !canCreateInvite}
                    >
                      {renewingId === row.id ? "Rinnovo..." : "Rinnova"}
                    </button>
                  ) : null}
                  {!row.canOpenProfile && !row.canRenew ? <span className="subtle">-</span> : null}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );

  const newBody = (
    <section className="stack admin-invites-shell">
      {toast ? <AppToast toast={toast} onClose={() => setToast(null)} className="admin-toast" /> : null}

      <div className="panel admin-invites-head">
        <div>
          <h2><MailPlus className="h-5 w-5" /> Invia nuovo invito</h2>
          <p className="subtle">Invita un fornitore a iscriversi all&apos;Albo.</p>
        </div>
        <Link to="/admin/invites" className="home-btn home-btn-secondary">Vai a gestione inviti</Link>
      </div>

      <div className="admin-invites-new-grid">
        <form className="panel admin-invites-create-form" onSubmit={onCreateInvite}>
          <h4>Dati del destinatario</h4>
          <div className="admin-invites-grid-2">
            <label className="floating-field has-value">
              <select
                className="floating-input"
                value={draft.registryType}
                onChange={(e) => setDraft((prev) => ({ ...prev, registryType: e.target.value as "ALBO_A" | "ALBO_B" }))}
              >
                <option value="ALBO_A">Albo A - Professionisti</option>
                <option value="ALBO_B">Albo B - Aziende</option>
              </select>
              <span className="floating-field-label">Tipo Albo *</span>
            </label>
          </div>

          <div className="admin-invites-grid-2">
            <label className={`floating-field ${draft.firstName ? "has-value" : ""}`}>
              <input
                className="floating-input"
                value={draft.firstName}
                onChange={(e) => setDraft((prev) => ({ ...prev, firstName: e.target.value }))}
                placeholder=" "
              />
              <span className="floating-field-label">Nome *</span>
            </label>
            <label className={`floating-field ${draft.lastName ? "has-value" : ""}`}>
              <input
                className="floating-input"
                value={draft.lastName}
                onChange={(e) => setDraft((prev) => ({ ...prev, lastName: e.target.value }))}
                placeholder=" "
              />
              <span className="floating-field-label">Cognome *</span>
            </label>
          </div>

          <label className={`floating-field ${draft.invitedEmail ? "has-value" : ""}`}>
            <input
              className="floating-input"
              type="email"
              value={draft.invitedEmail}
              onChange={(e) => setDraft((prev) => ({ ...prev, invitedEmail: e.target.value }))}
              placeholder=" "
            />
            <span className="floating-field-label">E-mail destinatario *</span>
          </label>

          <label className={`floating-field ${draft.roleExpectation ? "has-value" : ""}`}>
            <input
              className="floating-input"
              value={draft.roleExpectation}
              onChange={(e) => setDraft((prev) => ({ ...prev, roleExpectation: e.target.value }))}
              placeholder=" "
            />
            <span className="floating-field-label">Ruolo / Tipologia attesa</span>
          </label>

          <h4>Configurazione invito</h4>
          <div className="admin-invites-grid-2">
            <label className="floating-field has-value">
              <select
                className="floating-input"
                value={draft.expiresInDays}
                onChange={(e) => setDraft((prev) => ({ ...prev, expiresInDays: e.target.value }))}
              >
                <option value="7">7 giorni</option>
                <option value="15">15 giorni</option>
                <option value="30">30 giorni</option>
                <option value="60">60 giorni</option>
              </select>
              <span className="floating-field-label">Scadenza link *</span>
            </label>

            <label className="floating-field has-value">
              <select
                className="floating-input"
                value={draft.priority}
                onChange={(e) => setDraft((prev) => ({ ...prev, priority: e.target.value as "BASSA" | "MEDIA" | "ALTA" }))}
              >
                <option value="BASSA">Bassa</option>
                <option value="MEDIA">Media</option>
                <option value="ALTA">Alta</option>
              </select>
              <span className="floating-field-label">Priorita</span>
            </label>
          </div>

          <label className={`floating-field ${draft.note ? "has-value" : ""}`}>
            <textarea
              className="floating-input"
              rows={4}
              value={draft.note}
              onChange={(e) => setDraft((prev) => ({ ...prev, note: e.target.value }))}
              placeholder=" "
            />
            <span className="floating-field-label">Messaggio personalizzato</span>
          </label>

          {!canCreateInvite && auth?.role === "ADMIN" ? (
            <p className="subtle">Invio inviti disponibile solo per SUPER_ADMIN o RESPONSABILE_ALBO.</p>
          ) : null}

          <div className="admin-invites-form-actions">
            <button type="button" className="home-btn home-btn-secondary" onClick={() => setDraft(EMPTY_DRAFT)}>Annulla</button>
            <button type="submit" className="home-btn home-btn-primary" disabled={!canCreateInvite || !canSubmitInvite || createBusy}>
              <Send className="h-4 w-4" />
              {createBusy ? "Invio..." : "Invia invito"}
            </button>
          </div>
        </form>

        <aside className="panel admin-invites-preview">
          <h4>Anteprima e-mail</h4>
          <article className="invite-email-card">
            <header className="invite-email-header">
              <strong>Solco</strong>
              <span>ALBO FORNITORI</span>
            </header>
            <div className="invite-email-body">
              <h5>Invito a iscriversi all&apos;Albo Fornitori Digitale</h5>
              <p>Gentile {previewName},</p>
              <p>la invitiamo a iscriversi a <strong>{previewRegistry}</strong>.</p>
              <button type="button" className="home-btn home-btn-primary invite-email-action" disabled>
                Accedi al questionario
              </button>
              <p className="subtle">Link attivo per {expiresValid ? expires : "-"} giorni.</p>
              <p className="subtle">Scadenza: {previewExpiry}</p>
            </div>
            <footer className="invite-email-footer">
              <p className="subtle">Invitato da: {auth?.fullName || "Admin"}</p>
              <p className="subtle">Link dinamico: <code>{inviteLink("<token>")}</code></p>
            </footer>
          </article>

          {createdInvite ? (
            <div className="admin-invites-created-box">
              <p><strong>Invito inviato a:</strong> {createdInvite.invitedEmail}</p>
              <div className="admin-invites-created-actions">
                <a className="home-inline-link home-inline-link-admin" href={inviteLink(createdInvite.token)} target="_blank" rel="noreferrer">
                  <span>Apri link invito</span>
                </a>
                <button type="button" className="home-btn home-btn-secondary" onClick={() => void copyInviteLink(createdInvite.token)}>
                  <Copy className="h-4 w-4" /> Copia link
                </button>
              </div>
            </div>
          ) : null}
        </aside>
      </div>
    </section>
  );

  return (
    <AdminCandidatureShell active="inviti">
      {mode === "manage" ? manageBody : newBody}
    </AdminCandidatureShell>
  );
}
