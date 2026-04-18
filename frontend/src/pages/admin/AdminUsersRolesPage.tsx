import { FormEvent, useEffect, useMemo, useState } from "react";
import { Activity, History, RefreshCw, Search, ShieldMinus, ShieldPlus, UserCog } from "lucide-react";
import { HttpError } from "../../api/http";
import { getAdminAuditEvents, type AdminAuditEventRow } from "../../api/adminAuditApi";
import {
  assignAdminUserRole,
  createAdminUserInvite,
  getAdminUsersRoles,
  revokeAdminUserRole,
  type AdminRole,
  type AdminUserRoleRow,
  type CreateAdminUserInvitePayload
} from "../../api/adminUsersRolesApi";
import { useAuth } from "../../auth/AuthContext";
import { AppToast } from "../../components/ui/toast";
import { useAdminGovernanceRole } from "../../hooks/useAdminGovernanceRole";
import { AdminCandidatureShell } from "./AdminCandidatureShell";

const ADMIN_ROLES: readonly AdminRole[] = ["SUPER_ADMIN", "RESPONSABILE_ALBO", "REVISORE", "VIEWER"] as const;
const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function roleLabel(role: AdminRole): string {
  if (role === "SUPER_ADMIN") return "Super Admin";
  if (role === "RESPONSABILE_ALBO") return "Responsabile Albo";
  if (role === "REVISORE") return "Revisore";
  return "Viewer";
}

function formatStateJson(raw: string | null | undefined): string {
  if (!raw) return "{}";
  try {
    const parsed = JSON.parse(raw);
    return JSON.stringify(parsed, null, 2);
  } catch {
    return raw;
  }
}

export function AdminUsersRolesPage() {
  const { auth } = useAuth();
  const token = auth?.token ?? "";
  const { adminRole, loading: roleLoading } = useAdminGovernanceRole();
  const [queryInput, setQueryInput] = useState("");
  const [activeQuery, setActiveQuery] = useState("");
  const [rows, setRows] = useState<AdminUserRoleRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [busyKey, setBusyKey] = useState<string | null>(null);
  const [auditLoading, setAuditLoading] = useState(false);
  const [selectedAuditUserId, setSelectedAuditUserId] = useState<string | null>(null);
  const [auditRows, setAuditRows] = useState<AdminAuditEventRow[]>([]);
  const [toast, setToast] = useState<{ message: string; type: "error" | "success" } | null>(null);
  const [inviteBusy, setInviteBusy] = useState(false);
  const [inviteDraft, setInviteDraft] = useState<CreateAdminUserInvitePayload>({
    email: "",
    fullName: "",
    adminRole: "VIEWER",
    expiresInDays: 7
  });
  const [lastInvite, setLastInvite] = useState<{
    email: string;
    role: AdminRole;
    expiresAt: string;
    activationUrl: string;
  } | null>(null);

  async function loadUsers(search?: string) {
    if (!token) return;
    setLoading(true);
    try {
      const data = await getAdminUsersRoles(token, search);
      setRows(data);
    } catch (error) {
      const message = error instanceof HttpError ? error.message : "Caricamento utenti/ruoli non riuscito.";
      setToast({ message, type: "error" });
      setRows([]);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void loadUsers(activeQuery);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token, activeQuery]);

  const stats = useMemo(() => {
    const total = rows.length;
    const active = rows.filter((row) => row.active).length;
    const withRoles = rows.filter((row) => row.adminRoles.length > 0).length;
    return { total, active, withRoles };
  }, [rows]);

  const roleStats = useMemo(() => {
    return ADMIN_ROLES.map((role) => ({
      role,
      count: rows.filter((row) => row.adminRoles.includes(role)).length
    }));
  }, [rows]);

  const selectedAuditUser = useMemo(
    () => rows.find((row) => row.userId === selectedAuditUserId) ?? null,
    [rows, selectedAuditUserId]
  );

  async function onSubmit(event: FormEvent) {
    event.preventDefault();
    setActiveQuery(queryInput.trim());
  }

  async function onToggleRole(row: AdminUserRoleRow, role: AdminRole) {
    if (!token || busyKey) return;
    if (!UUID_PATTERN.test(row.userId)) {
      setToast({ message: "User ID non valido, impossibile aggiornare il ruolo.", type: "error" });
      return;
    }
    const hasRole = row.adminRoles.includes(role);
    const key = `${row.userId}:${role}`;
    setBusyKey(key);
    try {
      const payload = { targetUserId: row.userId, adminRole: role };
      const updated = hasRole
        ? await revokeAdminUserRole(token, payload)
        : await assignAdminUserRole(token, payload);
      setRows((prev) => prev.map((item) => (item.userId === updated.userId ? updated : item)));
      setToast({
        message: hasRole ? `Ruolo ${roleLabel(role)} revocato.` : `Ruolo ${roleLabel(role)} assegnato.`,
        type: "success"
      });
      if (selectedAuditUserId === updated.userId) {
        await loadAuditForUser(updated.userId);
      }
    } catch (error) {
      const message = error instanceof HttpError ? error.message : "Aggiornamento ruolo non riuscito.";
      setToast({ message, type: "error" });
    } finally {
      setBusyKey(null);
    }
  }

  async function loadAuditForUser(userId: string) {
    if (!token || !UUID_PATTERN.test(userId)) return;
    setSelectedAuditUserId(userId);
    setAuditLoading(true);
    try {
      const data = await getAdminAuditEvents(token, {
        entityType: "REVAMP_USER_ADMIN_ROLE",
        entityId: userId
      });
      setAuditRows([...data].sort((a, b) => Date.parse(b.occurredAt) - Date.parse(a.occurredAt)));
    } catch (error) {
      const message = error instanceof HttpError ? error.message : "Caricamento audit non riuscito.";
      setToast({ message, type: "error" });
      setAuditRows([]);
    } finally {
      setAuditLoading(false);
    }
  }

  async function onCreateInvite(event: FormEvent) {
    event.preventDefault();
    if (!token || inviteBusy) return;
    const normalizedEmail = inviteDraft.email.trim().toLowerCase();
    if (!normalizedEmail || !inviteDraft.fullName.trim()) {
      setToast({ message: "Compila email e nome completo.", type: "error" });
      return;
    }
    setInviteBusy(true);
    try {
      const response = await createAdminUserInvite(token, {
        ...inviteDraft,
        email: normalizedEmail,
        fullName: inviteDraft.fullName.trim()
      });
      const activationUrl = response.activationUrl?.trim()
        ? response.activationUrl
        : `${window.location.origin}/activate-account?token=<inviato-via-email>`;
      setLastInvite({
        email: response.email,
        role: response.adminRole,
        expiresAt: response.inviteExpiresAt,
        activationUrl
      });
      setToast({
        message: response.mailSent === false
          ? "Invito creato, ma invio e-mail non riuscito. Usa il link di attivazione sotto."
          : "Invito admin creato e inviato via e-mail.",
        type: response.mailSent === false ? "error" : "success"
      });
      await loadUsers(activeQuery);
      setInviteDraft((prev) => ({ ...prev, email: "", fullName: "" }));
    } catch (error) {
      const message = error instanceof HttpError ? error.message : "Creazione invito admin non riuscita.";
      setToast({ message, type: "error" });
    } finally {
      setInviteBusy(false);
    }
  }

  if (auth?.role === "ADMIN" && !roleLoading && adminRole !== "SUPER_ADMIN") {
    return (
      <AdminCandidatureShell active="impostazioni">
        <section className="stack">
          {toast ? <AppToast toast={toast} onClose={() => setToast(null)} className="admin-toast" /> : null}
          <div className="panel">
            <h2><UserCog className="h-5 w-5" /> Utenti e ruoli amministrativi</h2>
            <p className="subtle">Accesso riservato al profilo SUPER_ADMIN.</p>
          </div>
        </section>
      </AdminCandidatureShell>
    );
  }

  return (
    <AdminCandidatureShell active="impostazioni">
      <section className="stack">
        {toast ? <AppToast toast={toast} onClose={() => setToast(null)} className="admin-toast" /> : null}

      <div className="panel">
        <h2><UserCog className="h-5 w-5" /> Utenti e ruoli amministrativi</h2>
        <p className="subtle">
          Gestisci ruoli amministrativi revamp per utenti con ruolo base ADMIN.
        </p>
      </div>

      <form className="panel grid-form" onSubmit={onCreateInvite}>
        <h4 style={{ gridColumn: "1 / -1" }}>Crea utente admin (invito email)</h4>
        <label className={`floating-field ${inviteDraft.email ? "has-value" : ""}`}>
          <input
            className="floating-input"
            type="email"
            value={inviteDraft.email}
            onChange={(e) => setInviteDraft((prev) => ({ ...prev, email: e.target.value }))}
            required
            placeholder=" "
          />
          <span className="floating-field-label">Email *</span>
        </label>
        <label className={`floating-field ${inviteDraft.fullName ? "has-value" : ""}`}>
          <input
            className="floating-input"
            value={inviteDraft.fullName}
            onChange={(e) => setInviteDraft((prev) => ({ ...prev, fullName: e.target.value }))}
            required
            placeholder=" "
          />
          <span className="floating-field-label">Nome completo *</span>
        </label>
        <label className="floating-field has-value">
          <select
            className="floating-input"
            value={inviteDraft.adminRole}
            onChange={(e) => setInviteDraft((prev) => ({ ...prev, adminRole: e.target.value as AdminRole }))}
          >
            {ADMIN_ROLES.map((role) => (
              <option key={role} value={role}>{roleLabel(role)}</option>
            ))}
          </select>
          <span className="floating-field-label">Ruolo governance *</span>
        </label>
        <label className="floating-field has-value">
          <input
            className="floating-input"
            type="number"
            min={1}
            max={30}
            value={inviteDraft.expiresInDays ?? 7}
            onChange={(e) => setInviteDraft((prev) => ({ ...prev, expiresInDays: Number(e.target.value) }))}
            required
            placeholder=" "
          />
          <span className="floating-field-label">Scadenza (giorni)</span>
        </label>
        <button type="submit" className="home-btn home-btn-primary" disabled={inviteBusy}>
          {inviteBusy ? "Creazione invito..." : "Crea invito admin"}
        </button>
        {lastInvite ? (
          <p className="subtle" style={{ gridColumn: "1 / -1" }}>
            Ultimo invito: {lastInvite.email} ({roleLabel(lastInvite.role)}), scade {new Date(lastInvite.expiresAt).toLocaleString("it-IT")}.
            L&apos;utente riceve l&apos;e-mail di attivazione e completa da <code>{lastInvite.activationUrl}</code>.
          </p>
        ) : null}
      </form>

      <form className="panel grid-form" onSubmit={onSubmit}>
        <label className={`floating-field ${queryInput ? "has-value" : ""}`} style={{ gridColumn: "1 / -1" }}>
          <input
            className="floating-input"
            value={queryInput}
            onChange={(e) => setQueryInput(e.target.value)}
            placeholder=" "
          />
          <span className="floating-field-label">Cerca per nome o email</span>
        </label>
        <button type="submit" className="home-btn home-btn-primary">
          <Search className="h-4 w-4" />
          Cerca
        </button>
        <button type="button" className="home-btn home-btn-secondary" onClick={() => void loadUsers(activeQuery)} disabled={loading}>
          <RefreshCw className="h-4 w-4" />
          {loading ? "Aggiornamento..." : "Aggiorna"}
        </button>
        {(loading || busyKey || auditLoading) ? (
          <p className="subtle" style={{ gridColumn: "1 / -1", display: "inline-flex", alignItems: "center", gap: "0.35rem" }}>
            <Activity className="h-4 w-4" />
            Operazione in corso...
          </p>
        ) : null}
      </form>

      <div className="home-steps">
        <div className="panel home-step-card">
          <div className="home-step-head"><span className="home-step-index">U</span><h4>Utenti trovati</h4></div>
          <p style={{ fontSize: "1.3rem", fontWeight: 800 }}>{stats.total}</p>
        </div>
        <div className="panel home-step-card">
          <div className="home-step-head"><span className="home-step-index">A</span><h4>Utenti attivi</h4></div>
          <p style={{ fontSize: "1.3rem", fontWeight: 800 }}>{stats.active}</p>
        </div>
        <div className="panel home-step-card">
          <div className="home-step-head"><span className="home-step-index">R</span><h4>Con ruoli revamp</h4></div>
          <p style={{ fontSize: "1.3rem", fontWeight: 800 }}>{stats.withRoles}</p>
        </div>
      </div>

      <div className="home-steps">
        {roleStats.map((item) => (
          <div key={item.role} className="panel home-step-card">
            <div className="home-step-head"><span className="home-step-index">{roleLabel(item.role).charAt(0)}</span><h4>{roleLabel(item.role)}</h4></div>
            <p style={{ fontSize: "1.15rem", fontWeight: 800 }}>{item.count}</p>
          </div>
        ))}
      </div>

      <div className="panel">
        <h4>Matrice ruoli</h4>
        {loading ? <p className="subtle">Caricamento...</p> : null}
        {!loading && rows.length === 0 ? <p className="subtle">Nessun utente disponibile.</p> : null}
        {!loading && rows.length > 0 ? (
          <div className="stack">
            {rows.map((row) => (
              <div key={row.userId} className="home-step-card">
                <p>
                  <strong>{row.fullName}</strong> ({row.email})
                </p>
                <p className="subtle">
                  User Role: {row.userRole} - Stato: {row.active ? "ATTIVO" : "DISATTIVO"} - User ID: {row.userId}
                </p>
                <div className="revamp-step-actions" style={{ alignItems: "center" }}>
                  {ADMIN_ROLES.map((role) => {
                    const hasRole = row.adminRoles.includes(role);
                    const key = `${row.userId}:${role}`;
                    return (
                      <button
                        key={role}
                        type="button"
                        className={hasRole ? "home-btn home-btn-secondary" : "home-btn home-btn-primary"}
                        disabled={busyKey === key || !!busyKey}
                        onClick={() => void onToggleRole(row, role)}
                        title={hasRole ? "Revoca ruolo" : "Assegna ruolo"}
                      >
                        {hasRole ? <ShieldMinus className="h-4 w-4" /> : <ShieldPlus className="h-4 w-4" />}
                        {busyKey === key ? "..." : roleLabel(role)}
                      </button>
                    );
                  })}
                </div>
                <p className="subtle">
                  Ruoli correnti: {row.adminRoles.length === 0 ? "Nessuno" : row.adminRoles.map(roleLabel).join(", ")}
                </p>
                <div className="revamp-step-actions">
                  <button
                    type="button"
                    className="home-btn home-btn-secondary"
                    onClick={() => void loadAuditForUser(row.userId)}
                    disabled={auditLoading && selectedAuditUserId === row.userId}
                  >
                    <History className="h-4 w-4" />
                    {auditLoading && selectedAuditUserId === row.userId ? "Caricamento audit..." : "Mostra audit ruolo"}
                  </button>
                </div>
              </div>
            ))}
          </div>
        ) : null}
      </div>

      <div className="panel">
        <h4>Audit ruolo amministrativo</h4>
        {!selectedAuditUserId ? <p className="subtle">Seleziona un utente per vedere lo storico assegnazioni/revoche.</p> : null}
        {selectedAuditUserId ? <p className="subtle">User ID selezionato: {selectedAuditUserId}</p> : null}
        {selectedAuditUser ? <p className="subtle">Utente: {selectedAuditUser.fullName} ({selectedAuditUser.email})</p> : null}
        {selectedAuditUserId && auditLoading ? <p className="subtle">Caricamento audit...</p> : null}
        {selectedAuditUserId && !auditLoading && auditRows.length === 0 ? <p className="subtle">Nessun evento audit disponibile.</p> : null}
        {selectedAuditUserId && !auditLoading && auditRows.length > 0 ? (
          <div className="stack">
            {auditRows.map((event) => (
              <div key={event.id} className="home-step-card">
                <p><strong>{event.eventKey}</strong></p>
                <p className="subtle">
                  At: {new Date(event.occurredAt).toLocaleString("it-IT")} - ActorUserId: {event.actorUserId ?? "n/d"} - ActorRole: {event.actorRoles ?? "n/d"}
                </p>
                <p className="subtle">Reason: {event.reason ?? "n/d"} - Request ID: {event.requestId ?? "n/d"}</p>
                <p className="subtle"><strong>Before</strong></p>
                <pre style={{ margin: 0, whiteSpace: "pre-wrap", wordBreak: "break-word", fontSize: "0.78rem" }}>{formatStateJson(event.beforeStateJson)}</pre>
                <p className="subtle"><strong>After</strong></p>
                <pre style={{ margin: 0, whiteSpace: "pre-wrap", wordBreak: "break-word", fontSize: "0.78rem" }}>{formatStateJson(event.afterStateJson)}</pre>
              </div>
            ))}
          </div>
        ) : null}
      </div>
      </section>
    </AdminCandidatureShell>
  );
}

