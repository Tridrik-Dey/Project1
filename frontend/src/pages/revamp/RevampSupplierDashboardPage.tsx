import { useEffect, useState } from "react";
import { Navigate, useParams } from "react-router-dom";
import { ChevronDown, ChevronUp, Download, FileText, Globe, MapPin, MessageSquare, Star, User, X } from "lucide-react";
import { useAuth } from "../../auth/AuthContext";
import {
  getMyLatestRevampApplication,
  getRevampApplicationSections,
  type RevampApplicationSummary,
  type RevampSectionSnapshot,
} from "../../api/revampApplicationApi";

const NAVY  = "#0f2a52";
const GREEN = "#1a5c3a";
const MUTED = "#6b7280";

/* ─── lookup maps ───────────────────────────────────── */
const FORMA_MAP: Record<string, string> = {
  srl: "S.r.l.", srls: "S.r.l.s.", spa: "S.p.A.", sas: "S.a.s.", snc: "S.n.c.", ss: "S.S.",
  coop_sociale: "Cooperativa Sociale", coop_nonsociale: "Cooperativa non Sociale",
  consorzio: "Consorzio", fondazione: "Fondazione", associazione: "Associazione",
  aps: "APS", odv: "ODV", impresa_sociale: "Impresa Sociale",
  studio_associato: "Studio Associato", ditta_individuale: "Ditta Individuale", altro: "Altro",
};

const AREA_LABELS: Record<string, string> = {
  digitale_base: "Digitale Base", digitale_adv: "Digitale Avanzato",
  lingue: "Lingue", soft_skills: "Soft Skills", outdoor: "Outdoor",
  hr: "HR", manageriale: "Manageriale", sistemi: "Sistemi Gestione",
  comunicazione: "Comunicazione", grafica: "Grafica",
  ssl_ob: "SSL Obbligatoria", ssl_nob: "SSL Non obbl.",
  giuridico: "Giuridico", fondi_eu: "Fondi EU", economico: "Economico",
  commercio: "Commercio", pm: "Project Management", green: "Green Economy",
  sanita: "Sanità", logistica: "Logistica", agricoltura: "Agricoltura",
  turismo: "Turismo", tecnico_prof: "Tecnico-Prof.", audiovisivo: "Audiovisivo",
  cultura: "Cultura", scolastico: "Scolastico", altro_area: "Altro",
};

const TIPOLOGIA_LABELS: Record<string, string> = {
  docente: "Docente / Formatore", ricercatore: "Ricercatore / Valutatore",
  cdo_lavoro: "Consulente del Lavoro", commercialista: "Commercialista",
  avvocato: "Avvocato", psicologo: "Psicologo",
  finanza: "Esperto Finanza Agevolata", orientatore: "Orientatore Professionale",
  coach: "Coach", mediatore: "Mediatore del Lavoro", altro: "Altro professionista",
};

const CAT_NAMES: Record<string, string> = {
  A: "Formazione, didattica e contenuti", B: "HR, Lavoro e Organizzazione",
  C: "Tecnologia e digitale", D: "Consulenza, professioni e compliance",
  E: "Servizi generali e operativi",
};

const TAX_REGIME_LABELS: Record<string, string> = {
  ordinario: "Regime ordinario", forfettario: "Regime forfettario",
  occasionale: "Regime occasionale", ditta: "Ditta individuale", altro: "Altro",
};

const DISPONIBILITA_LABELS: Record<string, string> = {
  si: "Sì, senza limitazioni", si_aree: "Solo in aree specifiche",
  lunga_dur: "Solo per progetti di lunga durata", no: "No",
};

const DIPENDENTI_LABELS: Record<string, string> = {
  solo_titolare: "Solo titolare / 1", "2_5": "2–5", "6_15": "6–15",
  "16_50": "16–50", "51_250": "51–250", oltre_250: "Oltre 250",
};

const FATTURATO_LABELS: Record<string, string> = {
  sotto_100k: "Sotto 100.000 €", "100k_500k": "100.000–500.000 €",
  "500k_2m": "500.000–2.000.000 €", "2m_10m": "2–10 milioni €",
  oltre_10m: "Oltre 10 milioni €", non_indicato: "Non indicato",
};

const MODELLO231_LABELS: Record<string, string> = {
  adottato_aggiornato: "Adottato e aggiornato",
  adottato_non_aggiornato: "Adottato ma non aggiornato",
  non_adottato: "Non adottato",
};

const DOCENZA_PA_LABELS: Record<string, string> = {
  si_centrale: "Sì, PA centrale", si_locale: "Sì, PA locale",
  si_entrambe: "Sì, PA centrale e locale", no: "No",
};

const TIPO_INTERVENTO_LABELS: Record<string, string> = {
  aula: "Corso in aula", fad: "FAD / E-learning", blended: "Blended",
  coaching: "Coaching", workshop: "Workshop / Laboratorio", altro: "Altro",
};

const ISO_NAMES: Record<string, string> = {
  iso9001: "ISO 9001 (Qualità)", iso14001: "ISO 14001 (Ambiente)",
  iso45001: "ISO 45001 (Sicurezza)", sa8000: "SA8000 (Responsabilità sociale)",
  iso27001: "ISO 27001 (Sicurezza informazioni)",
};

const STATUS_CFG: Record<string, { label: string; icon: string; bg: string; border: string; color: string; sub: string }> = {
  DRAFT:        { label: "Bozza in compilazione", icon: "✏", bg: "#fffbeb", border: "#fde68a", color: "#92400e", sub: "Completa e invia la candidatura per entrare nell'Albo Fornitori." },
  SUBMITTED:    { label: "In revisione",          icon: "⏳", bg: "#eff6ff", border: "#bfdbfe", color: "#1d4ed8", sub: "La candidatura è in revisione da parte del Gruppo Solco." },
  UNDER_REVIEW: { label: "In revisione",          icon: "⏳", bg: "#eff6ff", border: "#bfdbfe", color: "#1d4ed8", sub: "La candidatura è in revisione da parte del Gruppo Solco." },
  APPROVED:     { label: "Profilo ATTIVO",        icon: "✓", bg: "#f0fdf4", border: "#bbf7d0", color: "#15803d", sub: "Il tuo profilo è visibile nell'Albo e ricercabile dai responsabili del Gruppo Solco." },
  REJECTED:     { label: "Non approvata",         icon: "✕", bg: "#fef2f2", border: "#fecaca", color: "#dc2626", sub: "La candidatura non è stata approvata. Contatta il team Solco per maggiori informazioni." },
};

type Tab = "profilo" | "documenti" | "valutazioni" | "comunicazioni";

/* ─── module-level helpers ──────────────────────────── */
function parseSection(sections: Record<string, RevampSectionSnapshot>, key: string): Record<string, unknown> {
  return sections[key] ? (JSON.parse(sections[key].payloadJson) as Record<string, unknown>) : {};
}

function s(val: unknown): string {
  if (val === null || val === undefined || val === "") return "";
  if (typeof val === "string") return val;
  if (typeof val === "boolean") return val ? "Sì" : "No";
  if (typeof val === "number") return String(val);
  return "";
}

function a(val: unknown): string[] {
  if (!Array.isArray(val)) return [];
  return (val as unknown[]).filter(v => typeof v === "string" && (v as string).trim()) as string[];
}

/* ─── UI helpers ────────────────────────────────────── */
function SolcoLogo() {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
      <span style={{ display: "inline-flex", alignItems: "center", justifyContent: "center", width: 24, height: 24, background: "#f5c800", borderRadius: 4 }}>
        <span style={{ width: 6, height: 6, borderRadius: "50%", background: "#fff", display: "inline-block" }} />
      </span>
      <span style={{ fontWeight: 800, fontSize: "1rem", color: "#1a1a2e" }}>Solco<sup style={{ color: "#f5c800", fontSize: "0.5rem", verticalAlign: "super" }}>+</sup></span>
    </div>
  );
}

function Stars({ rating }: { rating: number }) {
  return (
    <span style={{ display: "inline-flex", gap: 2 }}>
      {[1, 2, 3, 4, 5].map(n => (
        <Star key={n} size={13} fill={n <= Math.round(rating) ? "#f59e0b" : "none"} color="#f59e0b" strokeWidth={1.5} />
      ))}
    </span>
  );
}

function Badge({ text, color }: { text: string; color: "green" | "yellow" | "navy" | "blue" | "red" | "gray" }) {
  const map = {
    green:  { bg: "#f0fdf4", border: "#bbf7d0", text: "#15803d" },
    yellow: { bg: "#fffbeb", border: "#fde68a", text: "#92400e" },
    navy:   { bg: "#eff6ff", border: "#bfdbfe", text: "#1d4ed8" },
    blue:   { bg: "#eff6ff", border: "#bfdbfe", text: "#1d4ed8" },
    red:    { bg: "#fef2f2", border: "#fecaca", text: "#dc2626" },
    gray:   { bg: "#f9fafb", border: "#e5e7eb", text: "#374151" },
  };
  const c = map[color];
  return (
    <span style={{ display: "inline-block", padding: "2px 10px", background: c.bg, border: `1px solid ${c.border}`, borderRadius: 20, fontSize: "0.73rem", fontWeight: 600, color: c.text }}>
      {text}
    </span>
  );
}

function StatCard({ label, value, sub, accent }: { label: string; value: string; sub: string; accent: string }) {
  return (
    <div style={{ background: "#fff", border: "1px solid #e5e7eb", borderRadius: 10, padding: "16px 20px", flex: 1 }}>
      <div style={{ fontSize: "0.74rem", color: MUTED, marginBottom: 6 }}>{label}</div>
      <div style={{ fontSize: "1.6rem", fontWeight: 800, color: accent, lineHeight: 1.1, marginBottom: 4 }}>{value}</div>
      <div style={{ fontSize: "0.74rem", color: MUTED }}>{sub}</div>
    </div>
  );
}

function InfoRow({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) {
  if (!value) return null;
  return (
    <div style={{ display: "flex", alignItems: "flex-start", gap: 8, marginBottom: 8, fontSize: "0.82rem" }}>
      <span style={{ color: "#9ca3af", marginTop: 1, flexShrink: 0 }}>{icon}</span>
      <span style={{ color: MUTED, minWidth: 72, flexShrink: 0 }}>{label}:</span>
      <span style={{ color: "#1e293b", fontWeight: 500 }}>{value}</span>
    </div>
  );
}

function DataRow({ label, value }: { label: string; value?: string | null }) {
  if (!value || !value.trim()) return null;
  return (
    <div style={{ display: "grid", gridTemplateColumns: "160px 1fr", gap: 8, padding: "5px 0", borderBottom: "1px solid #f8fafc", fontSize: "0.82rem" }}>
      <span style={{ color: MUTED, fontWeight: 500, flexShrink: 0 }}>{label}</span>
      <span style={{ color: "#1e293b" }}>{value}</span>
    </div>
  );
}

function SubHead({ title }: { title: string }) {
  return (
    <div style={{ fontSize: "0.68rem", fontWeight: 700, color: "#9ca3af", textTransform: "uppercase" as const, letterSpacing: "0.07em", margin: "14px 0 4px", paddingBottom: 3, borderBottom: "1px solid #f1f5f9" }}>
      {title}
    </div>
  );
}

function TagPill({ text }: { text: string }) {
  return (
    <span style={{ display: "inline-block", padding: "2px 9px", background: "#f3f4f6", border: "1px solid #e5e7eb", borderRadius: 12, fontSize: "0.73rem", color: "#374151", marginRight: 4, marginBottom: 4 }}>
      {text}
    </span>
  );
}

function SectionCard({ n, title, done, children }: {
  n: number; title: string; done: boolean; children: React.ReactNode;
}) {
  const [open, setOpen] = useState(true);
  return (
    <div style={{ background: "#fff", border: "1px solid #e5e7eb", borderRadius: 10, overflow: "hidden" }}>
      <button
        type="button"
        onClick={() => setOpen(o => !o)}
        style={{ width: "100%", display: "flex", alignItems: "center", gap: 10, padding: "13px 18px", background: done ? "#fafafa" : "#fffbeb", border: "none", cursor: "pointer", textAlign: "left" as const }}
      >
        <span style={{ width: 22, height: 22, borderRadius: "50%", background: done ? "#16a34a" : "#f3f4f6", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "0.7rem", color: done ? "#fff" : "#9ca3af", fontWeight: 700, flexShrink: 0 }}>
          {done ? "✓" : n}
        </span>
        <span style={{ fontWeight: 700, fontSize: "0.88rem", color: "#1e293b", flex: 1 }}>
          Sezione {n} — {title}
        </span>
        {done && <span style={{ fontSize: "0.72rem", color: "#16a34a", fontWeight: 600 }}>Completata</span>}
        {open ? <ChevronUp size={14} color={MUTED} /> : <ChevronDown size={14} color={MUTED} />}
      </button>
      {open && (
        <div style={{ padding: "8px 18px 16px", borderTop: "1px solid #f3f4f6" }}>
          {children}
        </div>
      )}
    </div>
  );
}

/* ─── main component ─────────────────────────────────── */
export function RevampSupplierDashboardPage() {
  const { registryType: registryParam } = useParams();
  const { auth } = useAuth();

  const [loading, setLoading]         = useState(true);
  const [application, setApplication] = useState<RevampApplicationSummary | null>(null);
  const [sections, setSections]       = useState<Record<string, RevampSectionSnapshot>>({});
  const [activeTab, setActiveTab]     = useState<Tab>("profilo");
  const [showModal, setShowModal]     = useState(false);

  const isA    = registryParam === "albo-a";
  const isB    = registryParam === "albo-b";
  const accent = isA ? NAVY : GREEN;

  useEffect(() => {
    if (!auth?.token) { setLoading(false); return; }
    let cancelled = false;
    getMyLatestRevampApplication(auth.token)
      .then(async app => {
        if (cancelled || !app) { setLoading(false); return; }
        const expectedType = isA ? "ALBO_A" : "ALBO_B";
        if (app.registryType !== expectedType) { setLoading(false); return; }
        setApplication(app);
        const allSecs = await getRevampApplicationSections(app.id, auth.token!);
        if (cancelled) return;
        const byKey: Record<string, RevampSectionSnapshot> = {};
        allSecs.forEach(sec => {
          if (!byKey[sec.sectionKey] || sec.sectionVersion > byKey[sec.sectionKey].sectionVersion)
            byKey[sec.sectionKey] = sec;
        });
        setSections(byKey);
        setLoading(false);
      })
      .catch(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [auth?.token, isA]);

  if (!isA && !isB) return <Navigate to="/apply" replace />;

  /* ── parse all section payloads ── */
  const s1  = parseSection(sections, "S1");
  const s2  = parseSection(sections, "S2");
  const s3  = parseSection(sections, "S3");   // Albo B services
  const s3a = parseSection(sections, "S3A");  // Albo A docente
  const s3b = parseSection(sections, "S3B");  // Albo A non-docente
  const s4  = parseSection(sections, "S4");
  const s5  = parseSection(sections, "S5");

  /* ── sessionStorage fallbacks ── */
  const ss1A = JSON.parse(sessionStorage.getItem("revamp_s1")        ?? "{}") as Record<string, unknown>;
  const ss3A = JSON.parse(sessionStorage.getItem("revamp_s3")        ?? "{}") as Record<string, unknown>;
  const ss4A = JSON.parse(sessionStorage.getItem("revamp_s4")        ?? "{}") as Record<string, unknown>;
  const ss1B = JSON.parse(sessionStorage.getItem("revamp_b1")        ?? "{}") as Record<string, unknown>;
  const ss2B = JSON.parse(sessionStorage.getItem("revamp_b2")        ?? "{}") as Record<string, unknown>;
  const ss3B = JSON.parse(sessionStorage.getItem("revamp_b3")        ?? "{}") as Record<string, unknown>;
  const ss4B = JSON.parse(sessionStorage.getItem("revamp_b4")        ?? "{}") as Record<string, unknown>;
  const ss5B = JSON.parse(sessionStorage.getItem("revamp_b5")        ?? "{}") as Record<string, unknown>;
  const tipologiaSS = sessionStorage.getItem("revamp_tipologia") ?? "";

  /* ── per-section field getters ── */
  const g1  = (k: string) => s(s1[k]  ?? ss1A[k]);
  const g2  = (k: string) => s(s2[k]);
  const g4  = (k: string) => s(s4[k]  ?? ss4A[k]);
  const gb1 = (k: string) => s(s1[k]  ?? ss1B[k]);
  const gb2 = (k: string) => s(s2[k]  ?? ss2B[k]);
  const gb4 = (k: string) => s(s4[k]  ?? ss4B[k]);
  const gb5 = (k: string) => s(s5[k]  ?? ss5B[k]);
  const ga4 = (k: string) => a(s4[k]  ?? ss4A[k]);
  const gab2 = (k: string) => a(s2[k] ?? ss2B[k]);

  /* ── Albo A: pick correct S3 source based on tipologia ── */
  const tipologia = g2("tipologia") || tipologiaSS;
  const isDocente = isA && tipologia === "docente";
  const s3act  = isDocente ? s3a : s3b;
  const g3  = (k: string) => s(s3act[k] ?? ss3A[k]);
  const ga3 = (k: string) => a(s3act[k] ?? ss3A[k]);

  /* ── Albo A: experiences from S4 ── */
  const espCommittenti = ga4("committenti");
  const espTipi        = ga4("tipiIntervento");
  const espPeriodi     = ga4("periodi");
  const espCount       = espCommittenti.length;

  /* ── Albo B: S3 categories ── */
  type CatData = { voci: string[]; descrizione: string };
  const bCat = ((s3.categorie ?? ss3B.categorie) ?? {}) as Record<string, CatData>;

  /* ── Albo B: S4 ISO certs + allegati ── */
  type CertEntry = { presente: string; enteCertificatore: string; scadenza: string };
  const certData = ((s4.certificazioni ?? ss4B.certificazioni) ?? {}) as Record<string, CertEntry>;
  const allegati = ((s4.allegati ?? ss4B.allegati) ?? {}) as Record<string, string>;

  /* ── profile card derived values ── */
  const firstName    = g1("firstName");
  const lastName     = g1("lastName");
  const areeIds      = ga3("aree");
  const tagsA        = areeIds.slice(0, 6).map(id => AREA_LABELS[id] ?? id);
  const ragioneSociale  = gb1("ragioneSociale");
  const formaGiuridica  = FORMA_MAP[gb1("formaGiuridica")] ?? gb1("formaGiuridica");
  const bCatTags = Object.entries(bCat).filter(([, c]) => c.voci?.length > 0).map(([k]) => CAT_NAMES[k] ?? k);

  const displayName = isA
    ? [firstName, lastName].filter(Boolean).join(" ") || auth?.email || "Utente"
    : ragioneSociale || "Azienda";
  const initials = isA
    ? `${firstName.charAt(0)}${lastName.charAt(0)}`.toUpperCase() || "U"
    : ragioneSociale.substring(0, 2).toUpperCase() || "AZ";
  const roleOrType = isA
    ? (TIPOLOGIA_LABELS[tipologia] ?? tipologia) || "Professionista"
    : formaGiuridica || "Azienda";
  const locationA = [g1("city"), g1("province")].filter(Boolean).join(" (") + (g1("province") ? ")" : "");
  const locationB = [gb1("comuneLegale"), gb1("provinciaLegale")].filter(Boolean).join(" (") + (gb1("provinciaLegale") ? ")" : "");
  const location  = isA ? locationA : locationB;
  const tags      = isA ? tagsA : bCatTags;

  /* ── status ── */
  const status     = application?.status ?? "DRAFT";
  const statusCfg  = STATUS_CFG[status] ?? STATUS_CFG.DRAFT;
  const alboLabel  = isA ? "Albo A — Professionisti" : "Albo B — Aziende";
  const proto      = application?.protocolCode ?? sessionStorage.getItem(isA ? "revamp_proto" : "revamp_proto_b") ?? "—";
  const submittedAt = application?.submittedAt
    ? new Date(application.submittedAt).toLocaleDateString("it-IT") : null;
  const isApproved = status === "APPROVED";
  const isDraft    = status === "DRAFT";
  const expiryDate = new Date();
  expiryDate.setFullYear(expiryDate.getFullYear() + 1);

  const wizardStart   = `/apply/${registryParam}`;
  const modifySubject = encodeURIComponent(`Richiesta modifica profilo — ${alboLabel} — ${displayName}`);
  const modifyBody    = encodeURIComponent(`Gentile team Solco,\n\nRichiedo la modifica del mio profilo sull'Albo Fornitori.\n\nCodice candidatura: ${proto}\nNome/Ragione sociale: ${displayName}\n\nModifiche richieste:\n[descrivere qui le modifiche]`);

  const tabItems: { id: Tab; label: string }[] = [
    { id: "profilo",       label: "Il mio profilo" },
    { id: "documenti",     label: "Documenti" },
    { id: "valutazioni",   label: "Valutazioni" },
    { id: "comunicazioni", label: "Comunicazioni" },
  ];

  /* ── completed section count ── */
  const completedCount = isA
    ? [sections.S1, sections.S2, sections.S3A ?? sections.S3, sections.S4, sections.S5].filter(sec => sec?.completed).length
    : [sections.S1, sections.S2, sections.S3, sections.S4, sections.S5].filter(sec => sec?.completed).length;

  if (loading) {
    return (
      <div style={{ margin: "-1rem", background: "#f8fafc", minHeight: "100%", display: "flex", alignItems: "center", justifyContent: "center" }}>
        <div style={{ textAlign: "center" }}>
          <div style={{ fontSize: "2rem", marginBottom: 12 }}>⏳</div>
          <div style={{ fontSize: "0.88rem", color: MUTED }}>Caricamento profilo in corso...</div>
        </div>
      </div>
    );
  }

  return (
    <div style={{ margin: "-1rem", background: "#f8fafc", minHeight: "100%", fontFamily: "inherit" }}>

      {/* ── Modifica modal ── */}
      {showModal && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.45)", zIndex: 100, display: "flex", alignItems: "center", justifyContent: "center" }}>
          <div style={{ background: "#fff", borderRadius: 12, padding: "32px 36px", maxWidth: 440, width: "90%", boxShadow: "0 8px 40px #0002", position: "relative" }}>
            <button type="button" onClick={() => setShowModal(false)} style={{ position: "absolute", top: 14, right: 14, background: "none", border: "none", cursor: "pointer", color: MUTED }}>
              <X size={18} />
            </button>
            <div style={{ fontWeight: 700, fontSize: "1.05rem", color: "#1e293b", marginBottom: 8 }}>
              {isDraft ? "Continua la compilazione" : "Richiedi modifica profilo"}
            </div>
            {isDraft ? (
              <>
                <p style={{ fontSize: "0.85rem", color: MUTED, marginBottom: 20, lineHeight: 1.6 }}>
                  La tua candidatura è ancora in bozza. Puoi tornare al wizard per continuare la compilazione.
                </p>
                <a
                  href={wizardStart}
                  style={{ display: "inline-flex", alignItems: "center", gap: 6, padding: "10px 22px", background: accent, color: "#fff", borderRadius: 7, fontWeight: 700, fontSize: "0.88rem", textDecoration: "none" }}
                  onClick={() => setShowModal(false)}
                >
                  Continua la candidatura →
                </a>
              </>
            ) : (
              <>
                <p style={{ fontSize: "0.85rem", color: MUTED, marginBottom: 8, lineHeight: 1.6 }}>
                  Per richiedere una modifica contatta il team Solco via e-mail.
                </p>
                <div style={{ background: "#f9fafb", border: "1px solid #e5e7eb", borderRadius: 6, padding: "10px 14px", marginBottom: 20, fontSize: "0.8rem", color: "#374151" }}>
                  <div><strong>A:</strong> fornitori@grupposolco.it</div>
                  <div><strong>Oggetto:</strong> Richiesta modifica profilo — {alboLabel}</div>
                  <div><strong>Codice:</strong> {proto}</div>
                </div>
                <div style={{ display: "flex", gap: 10 }}>
                  <a
                    href={`mailto:fornitori@grupposolco.it?subject=${modifySubject}&body=${modifyBody}`}
                    style={{ flex: 1, display: "inline-flex", alignItems: "center", justifyContent: "center", gap: 6, padding: "10px 0", background: accent, color: "#fff", borderRadius: 7, fontWeight: 700, fontSize: "0.85rem", textDecoration: "none" }}
                  >
                    Apri e-mail
                  </a>
                  <button type="button" onClick={() => setShowModal(false)}
                    style={{ flex: 1, padding: "10px 0", background: "#fff", border: "1.5px solid #d1d5db", borderRadius: 7, fontWeight: 600, fontSize: "0.85rem", cursor: "pointer", color: "#374151" }}>
                    Annulla
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      )}

      {/* ── Top bar ── */}
      <div style={{ background: "#fff", borderBottom: "1px solid #e5e7eb", display: "flex", alignItems: "center", padding: "0 32px", height: 56 }}>
        <SolcoLogo />
        <div style={{ display: "flex", gap: 0, marginLeft: 48, height: "100%" }}>
          {tabItems.map(t => (
            <button key={t.id} type="button" onClick={() => setActiveTab(t.id)}
              style={{ padding: "0 20px", height: "100%", background: "none", border: "none", borderBottom: activeTab === t.id ? `2.5px solid ${accent}` : "2.5px solid transparent", fontWeight: activeTab === t.id ? 700 : 500, fontSize: "0.87rem", color: activeTab === t.id ? accent : MUTED, cursor: "pointer" }}>
              {t.label}
            </button>
          ))}
        </div>
        <div style={{ marginLeft: "auto", display: "flex", alignItems: "center", gap: 8 }}>
          <div style={{ width: 32, height: 32, borderRadius: "50%", background: accent, display: "flex", alignItems: "center", justifyContent: "center", fontWeight: 700, fontSize: "0.78rem", color: "#fff" }}>
            {initials}
          </div>
          <span style={{ fontSize: "0.83rem", fontWeight: 600, color: "#1e293b" }}>{displayName}</span>
        </div>
      </div>

      {/* ── Status banner ── */}
      <div style={{ background: statusCfg.bg, borderBottom: `1px solid ${statusCfg.border}`, padding: "12px 32px", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <div>
          <div style={{ fontWeight: 700, fontSize: "0.9rem", color: statusCfg.color }}>
            {statusCfg.icon} {statusCfg.label} — {alboLabel}
          </div>
          <div style={{ fontSize: "0.78rem", color: statusCfg.color, marginTop: 2, opacity: 0.85 }}>{statusCfg.sub}</div>
        </div>
        <div style={{ textAlign: "right", fontSize: "0.78rem" }}>
          {proto !== "—" && <div style={{ color: statusCfg.color, fontWeight: 600, marginBottom: 4 }}>Codice: {proto}</div>}
          {submittedAt && <div style={{ color: statusCfg.color, opacity: 0.8 }}>Inviata il: {submittedAt}</div>}
          {isApproved && (
            <>
              <div style={{ fontWeight: 600, color: "#15803d", marginBottom: 4 }}>
                Scadenza: {expiryDate.toLocaleDateString("it-IT")}
              </div>
              <div style={{ width: 200, height: 6, background: "#bbf7d0", borderRadius: 3, overflow: "hidden" }}>
                <div style={{ width: "100%", height: "100%", background: "#16a34a", borderRadius: 3 }} />
              </div>
              <div style={{ fontSize: "0.72rem", color: "#16a34a", marginTop: 2 }}>Rinnovo annuale</div>
            </>
          )}
        </div>
      </div>

      {/* ══════════════════════════════════════════
          Tab: Il mio profilo
      ══════════════════════════════════════════ */}
      {activeTab === "profilo" && (
        <div style={{ maxWidth: 1100, margin: "0 auto", padding: "20px 24px" }}>

          {/* Stats */}
          <div style={{ display: "flex", gap: 16, marginBottom: 20 }}>
            <StatCard label="Punteggio medio"   value="—"               sub="nessuna valutazione ancora"  accent="#f59e0b" />
            <StatCard label="Collaborazioni"     value="0"               sub="da avviare"                  accent={accent} />
            <StatCard label="Stato candidatura"  value={statusCfg.label} sub={submittedAt ? `Inviata ${submittedAt}` : "—"} accent={accent} />
            <StatCard label="Sezioni completate" value={`${completedCount}/5`} sub="sezioni del wizard"   accent="#6366f1" />
          </div>

          {/* Two-column layout */}
          <div style={{ display: "grid", gridTemplateColumns: "300px 1fr", gap: 20, alignItems: "start" }}>

            {/* ── LEFT: compact identity card ── */}
            <div style={{ background: "#fff", border: "1px solid #e5e7eb", borderRadius: 10, padding: "22px 18px", position: "sticky", top: 20 }}>
              <div style={{ textAlign: "center", marginBottom: 16 }}>
                <div style={{ width: 60, height: 60, borderRadius: "50%", background: accent, display: "flex", alignItems: "center", justifyContent: "center", fontWeight: 800, fontSize: "1.3rem", color: "#fff", margin: "0 auto 10px" }}>
                  {initials}
                </div>
                <div style={{ fontWeight: 800, fontSize: "1rem", color: "#1e293b" }}>{displayName}</div>
                <div style={{ fontSize: "0.82rem", color: MUTED, marginTop: 2 }}>
                  {roleOrType}{location ? ` — ${location}` : ""}
                </div>
                {isA && (
                  <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 6, marginTop: 8 }}>
                    <Stars rating={0} />
                    <span style={{ fontSize: "0.78rem", color: MUTED }}>nessuna valutazione</span>
                  </div>
                )}
                <div style={{ marginTop: 10 }}>
                  <Badge
                    text={statusCfg.label}
                    color={status === "APPROVED" ? "green" : status === "REJECTED" ? "red" : status === "DRAFT" ? "yellow" : "blue"}
                  />
                </div>
              </div>

              {tags.length > 0 && (
                <div style={{ display: "flex", flexWrap: "wrap", gap: 5, marginBottom: 14, justifyContent: "center" }}>
                  {tags.slice(0, 6).map(t => (
                    <span key={t} style={{ padding: "2px 8px", border: "1.5px solid #d1d5db", borderRadius: 20, fontSize: "0.72rem", fontWeight: 600, color: "#374151" }}>{t}</span>
                  ))}
                </div>
              )}

              <div style={{ borderTop: "1px solid #f1f5f9", paddingTop: 12 }}>
                {isA ? (
                  <>
                    {locationA     && <InfoRow icon={<MapPin size={12} />} label="Sede"       value={locationA} />}
                    {g1("email")   && <InfoRow icon={<User size={12} />}   label="E-mail"     value={g1("email")} />}
                    {g1("phone")   && <InfoRow icon={<MapPin size={12} />} label="Telefono"   value={g1("phone")} />}
                    {g3("areaTerritoriale") && <InfoRow icon={<Globe size={12} />} label="Territorio" value={g3("areaTerritoriale")} />}
                  </>
                ) : (
                  <>
                    {locationB        && <InfoRow icon={<MapPin size={12} />} label="Sede legale" value={locationB} />}
                    {gb1("email")     && <InfoRow icon={<User size={12} />}   label="E-mail"      value={gb1("email")} />}
                    {gb1("telefono")  && <InfoRow icon={<MapPin size={12} />} label="Telefono"    value={gb1("telefono")} />}
                    {gb1("sitoWeb")   && <InfoRow icon={<Globe size={12} />}  label="Sito web"    value={gb1("sitoWeb")} />}
                  </>
                )}
              </div>

              <div style={{ display: "flex", gap: 8, marginTop: 16 }}>
                <button type="button" onClick={() => setShowModal(true)}
                  style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center", gap: 5, padding: "8px 0", background: "#fff", border: `1.5px solid ${accent}`, borderRadius: 6, fontSize: "0.78rem", fontWeight: 600, color: accent, cursor: "pointer" }}>
                  <MessageSquare size={12} /> {isDraft ? "Continua" : "Modifica"}
                </button>
                <button type="button"
                  style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center", gap: 5, padding: "8px 0", background: "#fff", border: "1.5px solid #d1d5db", borderRadius: 6, fontSize: "0.78rem", fontWeight: 600, color: "#374151", cursor: "pointer" }}
                  title="Funzionalità in arrivo">
                  <Download size={12} /> Scarica PDF
                </button>
              </div>
            </div>

            {/* ── RIGHT: section data cards ── */}
            <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>

              {isA ? (
                /* ═══════ ALBO A ═══════ */
                <>
                  {/* S1 — Dati Anagrafici */}
                  <SectionCard n={1} title="Dati Anagrafici" done={!!sections.S1?.completed}>
                    <SubHead title="Dati personali" />
                    <DataRow label="Nome e cognome"   value={[g1("firstName"), g1("lastName")].filter(Boolean).join(" ")} />
                    <DataRow label="Codice Fiscale"   value={g1("taxCode")} />
                    <DataRow label="Partita IVA"      value={g1("vatNumber")} />
                    <DataRow label="Regime fiscale"   value={TAX_REGIME_LABELS[g1("taxRegime")] ?? g1("taxRegime")} />

                    <SubHead title="Indirizzo professionale / residenza" />
                    <DataRow label="Via e civico"     value={g1("address")} />
                    <DataRow label="Comune"           value={[g1("city"), g1("postalCode") ? `– ${g1("postalCode")}` : "", g1("province") ? `(${g1("province")})` : ""].filter(Boolean).join(" ")} />

                    <SubHead title="Contatti" />
                    <DataRow label="Telefono"         value={g1("phone")} />
                    <DataRow label="E-mail"           value={g1("email")} />
                    <DataRow label="LinkedIn"         value={g1("linkedin")} />
                  </SectionCard>

                  {/* S2 — Tipologia */}
                  <SectionCard n={2} title="Tipologia Professionale" done={!!sections.S2?.completed}>
                    <DataRow label="Tipologia"        value={TIPOLOGIA_LABELS[tipologia] ?? tipologia} />
                    <DataRow label="Codice ATECO"     value={g2("ateco")} />
                    {a(s2.multiRuoli).length > 0 && (
                      <>
                        <SubHead title="Ruoli aggiuntivi" />
                        <div>{a(s2.multiRuoli).map(r => <TagPill key={r} text={TIPOLOGIA_LABELS[r] ?? r} />)}</div>
                      </>
                    )}
                  </SectionCard>

                  {/* S3A — Competenze (Docente) */}
                  {isDocente && (
                    <SectionCard n={3} title="Competenze — Docente / Formatore" done={!!sections.S3A?.completed}>
                      <SubHead title="Istruzione e abilitazioni" />
                      <DataRow label="Titolo di studio"    value={g3("titoloStudio")} />
                      <DataRow label="Anno conseguimento"  value={g3("annoConseg")} />
                      <DataRow label="Ambito di studio"    value={g3("ambitoStudio")} />
                      <DataRow label="Certificazioni"      value={g3("certAbitazioni")} />

                      <SubHead title="Aree tematiche" />
                      {ga3("aree").length > 0
                        ? <div>{ga3("aree").map(id => <TagPill key={id} text={AREA_LABELS[id] ?? id} />)}</div>
                        : <span style={{ fontSize: "0.8rem", color: MUTED }}>—</span>}

                      <SubHead title="Operatività e contesto" />
                      <DataRow label="Docenza PA"          value={DOCENZA_PA_LABELS[g3("docenzaPA")] ?? g3("docenzaPA")} />
                      <DataRow label="Area territoriale"   value={g3("areaTerritoriale")} />
                      <DataRow label="Lingue parlate"      value={g3("lingue")} />
                      <DataRow label="Lingue docenza"      value={g3("lingueDocenza")} />
                      <DataRow label="Strumenti digitali"  value={g3("strumenti")} />
                      <DataRow label="Reti / associazioni" value={g3("reti")} />
                      {a(s3act.consulenza ?? ss3A.consulenza).length > 0 && (
                        <>
                          <SubHead title="Ambiti di consulenza" />
                          <div>{a(s3act.consulenza ?? ss3A.consulenza).map(c => <TagPill key={c} text={c} />)}</div>
                        </>
                      )}
                    </SectionCard>
                  )}

                  {/* S3B — Competenze (Non-Docente) */}
                  {!isDocente && (
                    <SectionCard n={3} title="Competenze — Profilo Professionale" done={!!sections.S3B?.completed}>
                      <SubHead title="Formazione e profilo" />
                      <DataRow label="Titolo di studio"      value={g3("titoloB")} />
                      <DataRow label="Ambito di studio"      value={g3("ambitoB")} />
                      <DataRow label="Anni di esperienza"    value={g3("anniEsp")} />
                      <DataRow label="Ordine professionale"  value={g3("ordine")} />
                      <DataRow label="Certificazioni"        value={g3("certB")} />

                      {ga3("servizi").length > 0 && (
                        <>
                          <SubHead title="Servizi offerti" />
                          <div>{ga3("servizi").map(sv => <TagPill key={sv} text={sv} />)}</div>
                        </>
                      )}
                      <DataRow label="Altro / note servizi"  value={g3("altroServ")} />
                    </SectionCard>
                  )}

                  {/* S4 — Disponibilità */}
                  <SectionCard n={4} title={isDocente ? "Disponibilità, Esperienze e Allegati" : "Disponibilità e Allegati"} done={!!sections.S4?.completed}>
                    {isDocente ? (
                      <>
                        <SubHead title="Disponibilità e tariffe" />
                        <DataRow label="Trasferte"           value={DISPONIBILITA_LABELS[g4("disponibilita")] ?? g4("disponibilita")} />
                        <DataRow label="Aree geografiche"    value={g4("areeSpecifiche")} />
                        <DataRow label="Tariffa giornaliera" value={g4("tariffaGiorn")} />
                        <DataRow label="Tariffa oraria"      value={g4("tariffaOra")} />

                        {espCount > 0 && (
                          <>
                            <SubHead title={`Esperienze formative (${espCount})`} />
                            {espCommittenti.map((c, i) => (
                              <div key={i} style={{ display: "grid", gridTemplateColumns: "1fr 140px 120px", gap: 8, padding: "5px 0", borderBottom: "1px solid #f8fafc", fontSize: "0.82rem" }}>
                                <span style={{ color: "#1e293b", fontWeight: 500 }}>{c}</span>
                                <span style={{ color: MUTED }}>{TIPO_INTERVENTO_LABELS[espTipi[i]] ?? espTipi[i]}</span>
                                <span style={{ color: MUTED }}>{espPeriodi[i]}</span>
                              </div>
                            ))}
                          </>
                        )}

                        <SubHead title="Allegati" />
                        <DataRow label="Curriculum Vitae"    value={g4("cvName")} />
                        <DataRow label="Certificazioni"      value={g4("certName")} />
                      </>
                    ) : (
                      <>
                        <DataRow label="Area territoriale"   value={g4("areaTerrB")} />
                        <DataRow label="Tariffa oraria"      value={g4("tariffaOraB")} />
                        <DataRow label="Curriculum Vitae"    value={g4("cvName")} />
                      </>
                    )}
                  </SectionCard>

                  {/* S5 — Dichiarazioni */}
                  <SectionCard n={5} title="Dichiarazioni e Consensi" done={!!sections.S5?.completed}>
                    {sections.S5?.completed ? (
                      <>
                        <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "6px 0" }}>
                          <span style={{ color: "#16a34a", fontSize: "1.1rem" }}>✓</span>
                          <span style={{ fontSize: "0.84rem", fontWeight: 600, color: "#1e293b" }}>Tutte le dichiarazioni obbligatorie accettate</span>
                        </div>
                        <DataRow label="Consenso commerciale" value={s5.marketingConsent ? "Sì" : s5.marketingConsent === false ? "No" : ""} />
                      </>
                    ) : (
                      <span style={{ fontSize: "0.82rem", color: MUTED }}>Sezione non ancora completata.</span>
                    )}
                  </SectionCard>
                </>
              ) : (
                /* ═══════ ALBO B ═══════ */
                <>
                  {/* S1 — Dati Aziendali */}
                  <SectionCard n={1} title="Dati Aziendali" done={!!sections.S1?.completed}>
                    <SubHead title="Anagrafica aziendale" />
                    <DataRow label="Ragione sociale"    value={gb1("ragioneSociale")} />
                    <DataRow label="Forma giuridica"    value={FORMA_MAP[gb1("formaGiuridica")] ?? gb1("formaGiuridica")} />
                    <DataRow label="Partita IVA"        value={gb1("piva")} />
                    <DataRow label="Codice Fiscale"     value={gb1("codiceFiscale")} />
                    <DataRow label="Numero REA"         value={gb1("rea")} />
                    <DataRow label="CCIAA"              value={gb1("cciaa")} />
                    <DataRow label="Data costituzione"  value={gb1("dataCostituzione")} />

                    <SubHead title="Sede legale" />
                    <DataRow label="Via e civico"       value={gb1("indirizzoLegale")} />
                    <DataRow label="Comune"             value={[gb1("comuneLegale"), gb1("capLegale") ? `– ${gb1("capLegale")}` : "", gb1("provinciaLegale") ? `(${gb1("provinciaLegale")})` : ""].filter(Boolean).join(" ")} />
                    <DataRow label="Sede operativa"     value={gb1("sedeOperativa")} />

                    <SubHead title="Contatti istituzionali" />
                    <DataRow label="E-mail"             value={gb1("email")} />
                    <DataRow label="PEC"                value={gb1("pec")} />
                    <DataRow label="Telefono"           value={gb1("telefono")} />
                    <DataRow label="Sito web"           value={gb1("sitoWeb")} />

                    <SubHead title="Legale rappresentante" />
                    <DataRow label="Nome e cognome"     value={gb1("lrNomeCognome")} />
                    <DataRow label="Codice Fiscale"     value={gb1("lrCodiceFiscale")} />
                    <DataRow label="Ruolo / carica"     value={gb1("lrRuolo")} />

                    <SubHead title="Referente operativo" />
                    <DataRow label="Nome e cognome"     value={gb1("refNome")} />
                    <DataRow label="Ruolo"              value={gb1("refRuolo")} />
                    <DataRow label="E-mail"             value={gb1("refEmail")} />
                    <DataRow label="Telefono"           value={gb1("refTelefono")} />
                  </SectionCard>

                  {/* S2 — Struttura e Dimensione */}
                  <SectionCard n={2} title="Struttura e Dimensione" done={!!sections.S2?.completed}>
                    <DataRow label="N. dipendenti"     value={DIPENDENTI_LABELS[gb2("dipendenti")] ?? gb2("dipendenti")} />
                    <DataRow label="Fatturato"         value={FATTURATO_LABELS[gb2("fatturato")] ?? gb2("fatturato")} />
                    <DataRow label="ATECO principale"  value={gb2("atecoMain")} />
                    {gab2("atecoSecondari").length > 0 && (
                      <DataRow label="ATECO secondari" value={gab2("atecoSecondari").join(", ")} />
                    )}

                    {gab2("regioni").length > 0 && (
                      <>
                        <SubHead title="Regioni di operatività" />
                        <div>{gab2("regioni").map(r => <TagPill key={r} text={r} />)}</div>
                      </>
                    )}

                    <SubHead title="Accreditamento formazione" />
                    <DataRow label="Accreditato"       value={gb2("accreditatoFormazione") === "si" ? "Sì" : gb2("accreditatoFormazione") === "no" ? "No" : gb2("accreditatoFormazione")} />
                    {gb2("accreditatoFormazione") === "si" && (
                      <>
                        <DataRow label="Regioni acc."  value={gab2("accreditamentoRegioni").join(", ")} />
                        <DataRow label="Tipi acc."     value={gab2("accreditamentoTipi").join(", ")} />
                      </>
                    )}

                    <SubHead title="Terzo Settore" />
                    <DataRow label="Terzo Settore"     value={gb2("isTerzoSettore") === "si" ? "Sì" : gb2("isTerzoSettore") === "no" ? "No" : gb2("isTerzoSettore")} />
                    {gb2("isTerzoSettore") === "si" && (
                      <>
                        <DataRow label="Tipo ETS"      value={gb2("tipoEts")} />
                        <DataRow label="N. RUNTS"      value={gb2("runts")} />
                      </>
                    )}
                  </SectionCard>

                  {/* S3 — Servizi Offerti */}
                  <SectionCard n={3} title="Servizi Offerti" done={!!sections.S3?.completed}>
                    {Object.entries(bCat).filter(([, c]) => c.voci?.length > 0).length === 0 ? (
                      <span style={{ fontSize: "0.82rem", color: MUTED }}>Nessun servizio inserito.</span>
                    ) : (
                      Object.entries(bCat).filter(([, c]) => c.voci?.length > 0).map(([key, cat]) => (
                        <div key={key} style={{ marginBottom: 14 }}>
                          <div style={{ fontSize: "0.78rem", fontWeight: 700, color: accent, marginBottom: 5 }}>
                            Categoria {key} — {CAT_NAMES[key] ?? key}
                          </div>
                          <div style={{ marginBottom: cat.descrizione ? 4 : 0 }}>
                            {cat.voci.map(v => <TagPill key={v} text={v} />)}
                          </div>
                          {cat.descrizione && (
                            <div style={{ fontSize: "0.8rem", color: MUTED, fontStyle: "italic", marginTop: 4, lineHeight: 1.5 }}>
                              {cat.descrizione}
                            </div>
                          )}
                        </div>
                      ))
                    )}
                  </SectionCard>

                  {/* S4 — Certificazioni e Allegati */}
                  <SectionCard n={4} title="Certificazioni e Allegati" done={!!sections.S4?.completed}>
                    <SubHead title="Certificazioni ISO" />
                    {Object.entries(certData).filter(([, c]) => c?.presente === "si").length === 0 ? (
                      <span style={{ fontSize: "0.8rem", color: MUTED }}>Nessuna certificazione presente.</span>
                    ) : (
                      Object.entries(certData).filter(([, c]) => c?.presente === "si").map(([key, c]) => (
                        <div key={key} style={{ padding: "5px 0", borderBottom: "1px solid #f8fafc" }}>
                          <div style={{ fontSize: "0.83rem", fontWeight: 600, color: "#1e293b" }}>{ISO_NAMES[key] ?? key}</div>
                          {(c.enteCertificatore || c.scadenza) && (
                            <div style={{ fontSize: "0.78rem", color: MUTED }}>
                              {c.enteCertificatore && `Ente: ${c.enteCertificatore}`}
                              {c.enteCertificatore && c.scadenza && " — "}
                              {c.scadenza && `Scadenza: ${c.scadenza}`}
                            </div>
                          )}
                        </div>
                      ))
                    )}
                    <DataRow label="Altre certificazioni"   value={gb4("altreCertificazioni")} />

                    <SubHead title="Accreditamenti" />
                    <DataRow label="Acc. formazione"         value={gb4("accreditamentoFormazione") === "si" ? "Sì" : gb4("accreditamentoFormazione") === "no" ? "No" : gb4("accreditamentoFormazione")} />
                    {gb4("accreditamentoFormazione") === "si" && (
                      <>
                        <DataRow label="Regioni"             value={gb4("accreditamentoRegioni")} />
                        <DataRow label="Tipo"                value={gb4("accreditamentoTipoFormazione")} />
                      </>
                    )}
                    <DataRow label="Acc. servizi al lavoro"  value={gb4("accreditamentoServiziLavoro") === "si" ? "Sì" : gb4("accreditamentoServiziLavoro") === "no" ? "No" : gb4("accreditamentoServiziLavoro")} />

                    <SubHead title="Documenti allegati" />
                    <DataRow label="Visura camerale"         value={allegati.visura} />
                    <DataRow label="DURC"                    value={allegati.durc} />
                    <DataRow label="Company profile"         value={allegati.companyProfile} />
                    <DataRow label="Certificati ISO / acc."  value={allegati.certificatiAllegati} />
                  </SectionCard>

                  {/* S5 — Dichiarazioni */}
                  <SectionCard n={5} title="Dichiarazioni e Compliance" done={!!sections.S5?.completed}>
                    {sections.S5?.completed ? (
                      <>
                        <DataRow label="Modello 231" value={MODELLO231_LABELS[gb5("modelloOrganizzativo231")] ?? gb5("modelloOrganizzativo231")} />
                        <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "8px 0" }}>
                          <span style={{ color: "#16a34a", fontSize: "1.1rem" }}>✓</span>
                          <span style={{ fontSize: "0.84rem", fontWeight: 600, color: "#1e293b" }}>Tutte le dichiarazioni obbligatorie accettate</span>
                        </div>
                        <DataRow label="Consenso commerciale" value={
                          s5.consensoComunicazioniCommerciali === true || ss5B.consensoComunicazioniCommerciali === true ? "Sì" :
                          s5.consensoComunicazioniCommerciali === false || ss5B.consensoComunicazioniCommerciali === false ? "No" : ""
                        } />
                      </>
                    ) : (
                      <span style={{ fontSize: "0.82rem", color: MUTED }}>Sezione non ancora completata.</span>
                    )}
                  </SectionCard>
                </>
              )}

              {/* ── Riepilogo completamento ── */}
              <div style={{ background: "#fff", border: "1px solid #e5e7eb", borderRadius: 10, padding: "18px 20px" }}>
                <div style={{ fontWeight: 700, fontSize: "0.9rem", color: "#1e293b", marginBottom: 12 }}>
                  Avanzamento candidatura
                </div>
                {(isA
                  ? [
                      { key: "S1",     label: "Dati Anagrafici" },
                      { key: "S2",     label: "Tipologia Professionale" },
                      { key: "S3A|S3", label: "Competenze" },
                      { key: "S4",     label: "Disponibilità e Allegati" },
                      { key: "S5",     label: "Dichiarazioni" },
                    ]
                  : [
                      { key: "S1", label: "Dati Aziendali" },
                      { key: "S2", label: "Struttura e Dimensione" },
                      { key: "S3", label: "Servizi Offerti" },
                      { key: "S4", label: "Certificazioni e Allegati" },
                      { key: "S5", label: "Dichiarazioni" },
                    ]
                ).map(({ key, label }) => {
                  const keys = key.split("|");
                  const sec  = keys.map(k => sections[k]).find(sec => sec !== undefined);
                  const done = sec?.completed === true;
                  return (
                    <div key={key} style={{ display: "flex", alignItems: "center", gap: 10, padding: "8px 0", borderBottom: "1px solid #f1f5f9" }}>
                      <span style={{ width: 20, height: 20, borderRadius: "50%", background: done ? "#16a34a" : "#f3f4f6", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "0.68rem", color: done ? "#fff" : "#9ca3af", fontWeight: 700, flexShrink: 0 }}>
                        {done ? "✓" : "—"}
                      </span>
                      <span style={{ fontSize: "0.83rem", color: done ? "#1e293b" : "#9ca3af", fontWeight: done ? 500 : 400, flex: 1 }}>{label}</span>
                      {sec?.updatedAt && (
                        <span style={{ fontSize: "0.72rem", color: MUTED }}>{new Date(sec.updatedAt).toLocaleDateString("it-IT")}</span>
                      )}
                    </div>
                  );
                })}
                <div style={{ marginTop: 12, display: "flex", alignItems: "center", gap: 10 }}>
                  <div style={{ flex: 1, height: 6, background: "#e5e7eb", borderRadius: 3, overflow: "hidden" }}>
                    <div style={{ width: `${(completedCount / 5) * 100}%`, height: "100%", background: accent, borderRadius: 3, transition: "width .4s" }} />
                  </div>
                  <span style={{ fontSize: "0.78rem", fontWeight: 600, color: accent }}>{completedCount}/5</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ── Tab: Documenti ── */}
      {activeTab === "documenti" && (
        <div style={{ maxWidth: 1080, margin: "40px auto", padding: "0 24px" }}>
          <div style={{ background: "#fff", border: "1px solid #e5e7eb", borderRadius: 10, padding: "40px 32px", textAlign: "center" }}>
            <FileText size={40} color="#d1d5db" style={{ margin: "0 auto 16px", display: "block" }} />
            <div style={{ fontWeight: 700, fontSize: "1rem", color: "#6b7280", marginBottom: 8 }}>Gestione documenti</div>
            <div style={{ fontSize: "0.84rem", color: MUTED }}>La gestione documenti sarà disponibile a breve.</div>
          </div>
        </div>
      )}

      {/* ── Tab: Valutazioni ── */}
      {activeTab === "valutazioni" && (
        <div style={{ maxWidth: 1080, margin: "40px auto", padding: "0 24px" }}>
          <div style={{ background: "#fff", border: "1px solid #e5e7eb", borderRadius: 10, padding: "40px 32px", textAlign: "center" }}>
            <Star size={40} color="#d1d5db" style={{ margin: "0 auto 16px", display: "block" }} />
            <div style={{ fontWeight: 700, fontSize: "1rem", color: "#6b7280", marginBottom: 8 }}>Nessuna valutazione ancora</div>
            <div style={{ fontSize: "0.84rem", color: MUTED }}>Le valutazioni appariranno qui dopo le prime collaborazioni con il Gruppo Solco.</div>
          </div>
        </div>
      )}

      {/* ── Tab: Comunicazioni ── */}
      {activeTab === "comunicazioni" && (
        <div style={{ maxWidth: 1080, margin: "40px auto", padding: "0 24px" }}>
          <div style={{ background: "#fff", border: "1px solid #e5e7eb", borderRadius: 10, padding: "20px 24px" }}>
            <div style={{ fontWeight: 700, fontSize: "0.95rem", color: "#1e293b", marginBottom: 14 }}>Tutte le comunicazioni</div>
            {[
              submittedAt ? { date: submittedAt, text: `Candidatura ricevuta — Codice protocollo: ${proto}` } : null,
              { date: new Date().toLocaleDateString("it-IT"), text: `Accesso all'area riservata — ${alboLabel}` },
            ].filter(Boolean).map((msg, i) => (
              <div key={i} style={{ display: "flex", alignItems: "flex-start", gap: 12, padding: "12px 0", borderBottom: "1px solid #f1f5f9" }}>
                <span style={{ fontSize: "0.73rem", color: MUTED, minWidth: 80, flexShrink: 0, marginTop: 2 }}>{msg!.date}</span>
                <span style={{ fontSize: "0.84rem", color: "#1e293b" }}>{msg!.text}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
