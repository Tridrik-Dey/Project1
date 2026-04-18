import { useEffect, useMemo, useState } from "react";
import { RefreshCw } from "lucide-react";
import { Link } from "react-router-dom";
import { type AdminRegistryProfileRow, listAdminProfiles, type RegistryProfileStatus } from "../../api/adminProfilesApi";
import { HttpError } from "../../api/http";
import { useAuth } from "../../auth/AuthContext";
import { AppToast } from "../../components/ui/toast";
import { AdminCandidatureShell } from "./AdminCandidatureShell";

function statusLabel(status: RegistryProfileStatus): string {
  if (status === "APPROVED") return "Attivo";
  if (status === "SUSPENDED") return "Sospeso";
  if (status === "RENEWAL_DUE") return "In rinnovo";
  return "Archiviato";
}

function statusTone(status: RegistryProfileStatus): "ok" | "warn" | "danger" | "neutral" {
  if (status === "APPROVED") return "ok";
  if (status === "RENEWAL_DUE") return "warn";
  if (status === "SUSPENDED") return "danger";
  return "neutral";
}

function formatDate(value: string | null | undefined): string {
  if (!value) return "-";
  const parsed = Date.parse(value);
  if (!Number.isFinite(parsed)) return "-";
  return new Date(parsed).toLocaleDateString("it-IT");
}

function scoreValue(profile: AdminRegistryProfileRow): number {
  const raw = profile.aggregateScore;
  if (typeof raw !== "number" || Number.isNaN(raw)) return 0;
  return Math.max(0, Math.min(5, raw));
}

function scoreStars(score: number): string {
  const rounded = Math.round(score);
  return `${"★".repeat(rounded)}${"☆".repeat(Math.max(0, 5 - rounded))}`;
}

function initials(value: string | null | undefined): string {
  const normalized = (value ?? "").trim();
  if (!normalized) return "NA";
  const parts = normalized.split(/\s+/).filter(Boolean);
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return `${parts[0][0] ?? ""}${parts[1][0] ?? ""}`.toUpperCase();
}

function inferredType(summary: string | null | undefined): string {
  const value = (summary ?? "").toLowerCase();
  if (value.includes("coach")) return "Psicologo/Coach";
  if (value.includes("consulent")) return "Consulente";
  if (value.includes("docente") || value.includes("formatore")) return "Docente / Formatore";
  return "Professionista";
}

function cardValue(row: AdminRegistryProfileRow, key: string): string {
  const source = row.adminCardView ?? row.publicCardView;
  const value = source && typeof source === "object" ? source[key] : undefined;
  return typeof value === "string" ? value : "";
}

export function AdminAlboAListPage() {
  const { auth } = useAuth();
  const token = auth?.token ?? "";
  const [rows, setRows] = useState<AdminRegistryProfileRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [status, setStatus] = useState<"ALL" | RegistryProfileStatus>("ALL");
  const [query, setQuery] = useState("");
  const [region, setRegion] = useState("");
  const [serviceCategory, setServiceCategory] = useState("");
  const [ateco, setAteco] = useState("");
  const [certification, setCertification] = useState("");
  const [toast, setToast] = useState<{ message: string; type: "error" | "success" } | null>(null);

  async function load() {
    if (!token) return;
    setLoading(true);
    try {
      const data = await listAdminProfiles(token, {
        registryType: "ALBO_A",
        status: status === "ALL" ? undefined : status,
        q: query,
        ateco,
        region,
        serviceCategory,
        certification,
        size: 50,
        page: 0
      });
      setRows(data.content);
    } catch (error) {
      const message = error instanceof HttpError ? error.message : "Caricamento fornitori Albo A non riuscito.";
      setToast({ message, type: "error" });
      setRows([]);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token, status]);

  const activeCount = useMemo(() => rows.filter((r) => r.status === "APPROVED").length, [rows]);

  return (
    <AdminCandidatureShell active="alboA">
      <section className="stack admin-albo-shell">
        {toast ? <AppToast toast={toast} onClose={() => setToast(null)} className="admin-toast" /> : null}
        <div className="panel admin-albo-head">
          <div>
            <h2>Albo A - Professionisti</h2>
            <p className="subtle">{activeCount} professionisti attivi</p>
          </div>
          <div className="admin-albo-head-actions">
            <Link className="home-btn home-btn-primary" to="/admin/invites/new">+ Invia invito</Link>
            <Link className="home-btn home-btn-secondary" to="/admin/reports">Esporta</Link>
          </div>
        </div>

        <div className="panel admin-albo-filters">
          <input
            className="floating-input"
            placeholder="Cerca per nome, e-mail..."
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
          <input
            className="floating-input"
            placeholder="Regione"
            value={region}
            onChange={(e) => setRegion(e.target.value)}
          />
          <input
            className="floating-input"
            placeholder="Categoria servizio (es. CAT_A)"
            value={serviceCategory}
            onChange={(e) => setServiceCategory(e.target.value)}
          />
          <input
            className="floating-input"
            placeholder="ATECO"
            value={ateco}
            onChange={(e) => setAteco(e.target.value)}
          />
          <input
            className="floating-input"
            placeholder="Certificazione"
            value={certification}
            onChange={(e) => setCertification(e.target.value)}
          />
          <select className="floating-input" value={status} onChange={(e) => setStatus(e.target.value as "ALL" | RegistryProfileStatus)}>
            <option value="ALL">Tutti gli stati</option>
            <option value="APPROVED">Attivo</option>
            <option value="SUSPENDED">Sospeso</option>
            <option value="RENEWAL_DUE">In rinnovo</option>
            <option value="ARCHIVED">Archiviato</option>
          </select>
          <button type="button" className="home-btn home-btn-secondary" onClick={() => void load()} disabled={loading}>
            <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} />
            {loading ? "Aggiornamento..." : "Aggiorna"}
          </button>
        </div>

        <div className="panel admin-albo-meta-strip">
          <p className="subtle">Risultati filtrati: {rows.length} professionisti</p>
          <p className="subtle">Ordina: <strong>Punteggio</strong></p>
        </div>

        <div className="panel">
          <div className="admin-albo-table">
            <div className="admin-albo-row admin-albo-row-head albo-a">
              <span>Nome / E-mail</span>
              <span>Tipologia</span>
              <span>Ambito principale</span>
              <span>Territorio</span>
              <span>Punteggio</span>
              <span>Stato</span>
              <span>Scadenza</span>
              <span>Azioni</span>
            </div>
            {loading ? <p className="subtle">Caricamento...</p> : null}
            {!loading && rows.length === 0 ? <p className="subtle">Nessun professionista trovato.</p> : null}
            {!loading && rows.map((row) => {
              const score = scoreValue(row);
              const name = row.displayName || "Professionista";
              const type = cardValue(row, "type");
              const mainTheme = cardValue(row, "mainTheme");
              const territory = cardValue(row, "territory");
              return (
                <div key={row.id} className="admin-albo-row albo-a">
                  <div className="admin-albo-main">
                    <div className="admin-albo-avatar">{initials(name)}</div>
                    <div>
                      <strong>{name}</strong>
                      <p className="subtle">{row.publicSummary || "-"}</p>
                    </div>
                  </div>
                  <span>{type || inferredType(row.publicSummary)}</span>
                  <span>{mainTheme || row.publicSummary || "-"}</span>
                  <span>{territory || "-"}</span>
                  <span className="admin-albo-score">{scoreStars(score)} {score.toFixed(1)}</span>
                  <span className={`admin-albo-status tone-${statusTone(row.status)}`}>{statusLabel(row.status)}</span>
                  <span>{formatDate(row.expiresAt)}</span>
                  <Link className="home-btn home-btn-secondary" to={`/admin/albo-a/${row.id}`}>Apri</Link>
                </div>
              );
            })}
          </div>
        </div>
      </section>
    </AdminCandidatureShell>
  );
}
