import { ChangeEvent, FormEvent, useEffect, useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import { ArrowLeft, ArrowRight, Save } from "lucide-react";
import { useAuth } from "../../auth/AuthContext";
import { createRevampApplicationDraft, getMyLatestRevampApplication, getRevampApplicationSections, saveRevampApplicationSection } from "../../api/revampApplicationApi";

const GREEN = "#1a5c3a";
const MUTED = "#6b7280";
const ERR = "#dc2626";
const WARN_BG = "#fffbeb";
const WARN_BORDER = "#f59e0b";

const STEPS_B = ["Dati aziendali", "Struttura", "Servizi", "Certificazioni", "Dichiarazioni"];

const FORME_GIURIDICHE = [
  { value: "srl",             label: "S.r.l. — Società a Responsabilità Limitata" },
  { value: "srls",            label: "S.r.l.s. — Semplificata" },
  { value: "spa",             label: "S.p.A. — Società per Azioni" },
  { value: "sas",             label: "S.a.s. — Società in Accomandita Semplice" },
  { value: "snc",             label: "S.n.c. — Società in Nome Collettivo" },
  { value: "ss",              label: "S.S. — Società Semplice" },
  { value: "coop_sociale",    label: "Cooperativa Sociale" },
  { value: "coop_nonsociale", label: "Cooperativa non Sociale" },
  { value: "consorzio",       label: "Consorzio" },
  { value: "fondazione",      label: "Fondazione" },
  { value: "associazione",    label: "Associazione" },
  { value: "aps",             label: "APS — Associazione di Promozione Sociale" },
  { value: "odv",             label: "ODV — Organizzazione di Volontariato" },
  { value: "impresa_sociale", label: "Impresa Sociale" },
  { value: "studio_associato",label: "Studio Associato" },
  { value: "ditta_individuale",label: "Ditta Individuale" },
  { value: "altro",           label: "Altro" },
];

const PROVINCE_IT = [
  { value: "AG", label: "Agrigento (AG)" }, { value: "AL", label: "Alessandria (AL)" },
  { value: "AN", label: "Ancona (AN)" }, { value: "AO", label: "Aosta (AO)" },
  { value: "AQ", label: "L'Aquila (AQ)" }, { value: "AR", label: "Arezzo (AR)" },
  { value: "AP", label: "Ascoli Piceno (AP)" }, { value: "AT", label: "Asti (AT)" },
  { value: "AV", label: "Avellino (AV)" }, { value: "BA", label: "Bari (BA)" },
  { value: "BT", label: "Barletta-Andria-Trani (BT)" }, { value: "BL", label: "Belluno (BL)" },
  { value: "BN", label: "Benevento (BN)" }, { value: "BG", label: "Bergamo (BG)" },
  { value: "BI", label: "Biella (BI)" }, { value: "BO", label: "Bologna (BO)" },
  { value: "BZ", label: "Bolzano (BZ)" }, { value: "BS", label: "Brescia (BS)" },
  { value: "BR", label: "Brindisi (BR)" }, { value: "CA", label: "Cagliari (CA)" },
  { value: "CL", label: "Caltanissetta (CL)" }, { value: "CB", label: "Campobasso (CB)" },
  { value: "CE", label: "Caserta (CE)" }, { value: "CT", label: "Catania (CT)" },
  { value: "CZ", label: "Catanzaro (CZ)" }, { value: "CH", label: "Chieti (CH)" },
  { value: "CO", label: "Como (CO)" }, { value: "CS", label: "Cosenza (CS)" },
  { value: "CR", label: "Cremona (CR)" }, { value: "KR", label: "Crotone (KR)" },
  { value: "CN", label: "Cuneo (CN)" }, { value: "EN", label: "Enna (EN)" },
  { value: "FM", label: "Fermo (FM)" }, { value: "FE", label: "Ferrara (FE)" },
  { value: "FI", label: "Firenze (FI)" }, { value: "FG", label: "Foggia (FG)" },
  { value: "FC", label: "Forlì-Cesena (FC)" }, { value: "FR", label: "Frosinone (FR)" },
  { value: "GE", label: "Genova (GE)" }, { value: "GO", label: "Gorizia (GO)" },
  { value: "GR", label: "Grosseto (GR)" }, { value: "IM", label: "Imperia (IM)" },
  { value: "IS", label: "Isernia (IS)" }, { value: "SP", label: "La Spezia (SP)" },
  { value: "LT", label: "Latina (LT)" }, { value: "LE", label: "Lecce (LE)" },
  { value: "LC", label: "Lecco (LC)" }, { value: "LI", label: "Livorno (LI)" },
  { value: "LO", label: "Lodi (LO)" }, { value: "LU", label: "Lucca (LU)" },
  { value: "MC", label: "Macerata (MC)" }, { value: "MN", label: "Mantova (MN)" },
  { value: "MS", label: "Massa-Carrara (MS)" }, { value: "MT", label: "Matera (MT)" },
  { value: "ME", label: "Messina (ME)" }, { value: "MI", label: "Milano (MI)" },
  { value: "MO", label: "Modena (MO)" }, { value: "MB", label: "Monza e Brianza (MB)" },
  { value: "NA", label: "Napoli (NA)" }, { value: "NO", label: "Novara (NO)" },
  { value: "NU", label: "Nuoro (NU)" }, { value: "OR", label: "Oristano (OR)" },
  { value: "PD", label: "Padova (PD)" }, { value: "PA", label: "Palermo (PA)" },
  { value: "PR", label: "Parma (PR)" }, { value: "PV", label: "Pavia (PV)" },
  { value: "PG", label: "Perugia (PG)" }, { value: "PU", label: "Pesaro e Urbino (PU)" },
  { value: "PE", label: "Pescara (PE)" }, { value: "PC", label: "Piacenza (PC)" },
  { value: "PI", label: "Pisa (PI)" }, { value: "PT", label: "Pistoia (PT)" },
  { value: "PN", label: "Pordenone (PN)" }, { value: "PZ", label: "Potenza (PZ)" },
  { value: "PO", label: "Prato (PO)" }, { value: "RG", label: "Ragusa (RG)" },
  { value: "RA", label: "Ravenna (RA)" }, { value: "RC", label: "Reggio Calabria (RC)" },
  { value: "RE", label: "Reggio Emilia (RE)" }, { value: "RI", label: "Rieti (RI)" },
  { value: "RN", label: "Rimini (RN)" }, { value: "RM", label: "Roma (RM)" },
  { value: "RO", label: "Rovigo (RO)" }, { value: "SA", label: "Salerno (SA)" },
  { value: "SS", label: "Sassari (SS)" }, { value: "SV", label: "Savona (SV)" },
  { value: "SI", label: "Siena (SI)" }, { value: "SR", label: "Siracusa (SR)" },
  { value: "SO", label: "Sondrio (SO)" }, { value: "SU", label: "Sud Sardegna (SU)" },
  { value: "TA", label: "Taranto (TA)" }, { value: "TE", label: "Teramo (TE)" },
  { value: "TR", label: "Terni (TR)" }, { value: "TO", label: "Torino (TO)" },
  { value: "TP", label: "Trapani (TP)" }, { value: "TN", label: "Trento (TN)" },
  { value: "TV", label: "Treviso (TV)" }, { value: "TS", label: "Trieste (TS)" },
  { value: "UD", label: "Udine (UD)" }, { value: "VA", label: "Varese (VA)" },
  { value: "VE", label: "Venezia (VE)" }, { value: "VB", label: "Verbano-Cusio-Ossola (VB)" },
  { value: "VC", label: "Vercelli (VC)" }, { value: "VR", label: "Verona (VR)" },
  { value: "VV", label: "Vibo Valentia (VV)" }, { value: "VI", label: "Vicenza (VI)" },
  { value: "VT", label: "Viterbo (VT)" },
];

const PIVA_RE  = /^\d{11}$/;
const CF_RE    = /^[A-Z]{6}\d{2}[A-EHLMPR-T]\d{2}[A-Z]\d{3}[A-Z]$/i;
const CAP_RE   = /^\d{5}$/;
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const URL_RE   = /^https?:\/\/.+\..+/;
const REA_RE   = /^[A-Z]{2}-\d+$/i;
const MY_RE    = /^(0[1-9]|1[0-2])\/\d{4}$/;

type OnChange = (e: ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => void;

const col: React.CSSProperties  = { display: "flex", flexDirection: "column", gap: 4 };
const lbl: React.CSSProperties  = { fontSize: "0.78rem", fontWeight: 600, color: "#374151" };
const hint: React.CSSProperties = { fontWeight: 400, color: MUTED };
const errTxt: React.CSSProperties = { fontSize: "0.74rem", color: ERR };

const baseInput = (error?: boolean): React.CSSProperties => ({
  width: "100%", padding: "10px 12px", fontSize: "0.88rem",
  border: `1.5px solid ${error ? ERR : "#d1d5db"}`,
  borderRadius: 6, outline: "none", boxSizing: "border-box",
  color: "#111827", background: "#fff",
});

function Field({ label, required, placeholder, value, onChange, error, type = "text", hintText }: {
  label: string; required?: boolean; placeholder?: string; value?: string;
  onChange?: OnChange; error?: string; type?: string; hintText?: string;
}) {
  return (
    <div style={col}>
      <span style={lbl}>{label}{required ? <span style={{ color: ERR }}> *</span> : null}
        {hintText ? <span style={hint}> — {hintText}</span> : null}
      </span>
      <input type={type} placeholder={placeholder ?? ""} value={value ?? ""} onChange={onChange} style={baseInput(!!error)} />
      {error ? <span style={errTxt}>{error}</span> : null}
    </div>
  );
}

function SelectField({ label, required, value, onChange, options, error, hintText }: {
  label: string; required?: boolean; value: string; onChange: OnChange;
  options: { value: string; label: string }[]; error?: string; hintText?: string;
}) {
  return (
    <div style={col}>
      <span style={lbl}>{label}{required ? <span style={{ color: ERR }}> *</span> : null}
        {hintText ? <span style={hint}> — {hintText}</span> : null}
      </span>
      <select value={value} onChange={onChange} style={baseInput(!!error)}>
        <option value="">Seleziona...</option>
        {options.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
      </select>
      {error ? <span style={errTxt}>{error}</span> : null}
    </div>
  );
}

function SectionLabel({ label }: { label: string }) {
  return (
    <div style={{ fontSize: "0.72rem", fontWeight: 700, color: GREEN, letterSpacing: "0.06em",
      textTransform: "uppercase", margin: "20px 0 12px", borderLeft: `3px solid ${GREEN}`, paddingLeft: 8 }}>
      {label}
    </div>
  );
}

function StepBar({ active }: { active: number }) {
  return (
    <div style={{ background: "#fff", borderBottom: "1px solid #e5e7eb", padding: "16px 40px" }}>
      <div style={{ maxWidth: 820, margin: "0 auto", display: "flex", alignItems: "flex-start", justifyContent: "space-between", position: "relative" }}>
        <div style={{ position: "absolute", top: 17, left: "10%", right: "10%", height: 2, background: "#e5e7eb", zIndex: 0 }} />
        <div style={{ position: "absolute", top: 17, left: "10%", width: `${(active / (STEPS_B.length - 1)) * 80}%`, height: 2, background: GREEN, zIndex: 0, transition: "width .3s" }} />
        {STEPS_B.map((step, i) => {
          const done = i < active; const isActive = i === active;
          return (
            <div key={step} style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 6, zIndex: 1 }}>
              <span style={{ width: 36, height: 36, borderRadius: "50%", background: done || isActive ? GREEN : "#fff", border: `2px solid ${done || isActive ? GREEN : "#d1d5db"}`, display: "flex", alignItems: "center", justifyContent: "center", fontWeight: 700, fontSize: "0.85rem", color: done || isActive ? "#fff" : "#9ca3af" }}>{i + 1}</span>
              <span style={{ fontSize: "0.72rem", color: isActive ? GREEN : done ? GREEN : "#9ca3af", fontWeight: isActive || done ? 600 : 400, textAlign: "center" }}>{step}</span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

export function RevampAlboBStep1DatiAziendaliPage() {
  const navigate = useNavigate();
  const { auth } = useAuth();

  const [form, setForm] = useState({
    ragioneSociale: "", formaGiuridica: "", piva: "", codiceFiscale: "",
    rea: "", cciaa: "", dataCostituzione: "",
    indirizzoLegale: "", comuneLegale: "", capLegale: "", provinciaLegale: "",
    sedeOperativa: "",
    email: "", pec: "", telefono: "", sitoWeb: "", linkedin: "",
    lrNomeCognome: "", lrCodiceFiscale: "", lrRuolo: "",
    refNome: "", refRuolo: "", refEmail: "", refTelefono: "",
  });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [savedAt, setSavedAt] = useState<string | null>(null);
  const [saveError, setSaveError] = useState<string | null>(null);

  useEffect(() => {
    if (!auth?.token) return;

    function applyS1(sections: { sectionKey: string; sectionVersion: number; payloadJson: string }[]) {
      const latest = sections
        .filter(s => s.sectionKey === "S1")
        .sort((a, b) => b.sectionVersion - a.sectionVersion)[0];
      if (!latest) return;
      const s1 = JSON.parse(latest.payloadJson) as Record<string, string>;
      setForm(prev => ({
        ...prev,
        ragioneSociale:   s1.ragioneSociale   ?? prev.ragioneSociale,
        formaGiuridica:   s1.formaGiuridica   ?? prev.formaGiuridica,
        piva:             s1.piva             ?? prev.piva,
        codiceFiscale:    s1.codiceFiscale    ?? prev.codiceFiscale,
        rea:              s1.rea              ?? prev.rea,
        cciaa:            s1.cciaa            ?? prev.cciaa,
        dataCostituzione: s1.dataCostituzione ?? prev.dataCostituzione,
        indirizzoLegale:  s1.indirizzoLegale  ?? prev.indirizzoLegale,
        comuneLegale:     s1.comuneLegale     ?? prev.comuneLegale,
        capLegale:        s1.capLegale        ?? prev.capLegale,
        provinciaLegale:  s1.provinciaLegale  ?? prev.provinciaLegale,
        sedeOperativa:    s1.sedeOperativa    ?? prev.sedeOperativa,
        email:            s1.email            ?? prev.email,
        pec:              s1.pec              ?? prev.pec,
        telefono:         s1.telefono         ?? prev.telefono,
        sitoWeb:          s1.sitoWeb          ?? prev.sitoWeb,
        linkedin:         s1.linkedin         ?? prev.linkedin,
        lrNomeCognome:    s1.lrNomeCognome    ?? prev.lrNomeCognome,
        lrCodiceFiscale:  s1.lrCodiceFiscale  ?? prev.lrCodiceFiscale,
        lrRuolo:          s1.lrRuolo          ?? prev.lrRuolo,
        refNome:          s1.refNome          ?? prev.refNome,
        refRuolo:         s1.refRuolo         ?? prev.refRuolo,
        refEmail:         s1.refEmail         ?? prev.refEmail,
        refTelefono:      s1.refTelefono      ?? prev.refTelefono,
      }));
    }

    const existingAppId = sessionStorage.getItem("revamp_applicationId");
    if (existingAppId) {
      getRevampApplicationSections(existingAppId, auth.token).then(applyS1).catch(() => {});
      return;
    }

    getMyLatestRevampApplication(auth.token).then(app => {
      if (!app || app.status !== "DRAFT" || app.registryType !== "ALBO_B") return;
      sessionStorage.setItem("revamp_applicationId", app.id);
      return getRevampApplicationSections(app.id, auth!.token!).then(applyS1);
    }).catch(() => {});
  }, [auth?.token]);

  function set(field: keyof typeof form): OnChange {
    return (e) => {
      setForm(prev => ({ ...prev, [field]: e.target.value }));
      if (errors[field]) setErrors(prev => { const n = { ...prev }; delete n[field]; return n; });
    };
  }

  function validate(): Record<string, string> {
    const e: Record<string, string> = {};
    if (!form.ragioneSociale.trim()) e.ragioneSociale = "Campo obbligatorio.";
    if (!form.formaGiuridica) e.formaGiuridica = "Campo obbligatorio.";
    if (!form.piva.trim()) { e.piva = "Campo obbligatorio."; }
    else if (!PIVA_RE.test(form.piva.trim())) { e.piva = "Deve contenere esattamente 11 cifre."; }
    if (form.codiceFiscale.trim() && !CF_RE.test(form.codiceFiscale.trim())) { e.codiceFiscale = "Formato non valido (16 caratteri alfanumerici)."; }
    if (!form.rea.trim()) { e.rea = "Campo obbligatorio."; }
    else if (!REA_RE.test(form.rea.trim())) { e.rea = "Formato non valido. Es. MI-1234567"; }
    if (!form.cciaa) e.cciaa = "Campo obbligatorio.";
    if (!form.dataCostituzione.trim()) { e.dataCostituzione = "Campo obbligatorio."; }
    else if (!MY_RE.test(form.dataCostituzione.trim())) { e.dataCostituzione = "Formato non valido. Usa MM/AAAA."; }
    if (!form.indirizzoLegale.trim()) e.indirizzoLegale = "Campo obbligatorio.";
    if (!form.comuneLegale.trim()) e.comuneLegale = "Campo obbligatorio.";
    if (!form.capLegale.trim()) { e.capLegale = "Campo obbligatorio."; }
    else if (!CAP_RE.test(form.capLegale.trim())) { e.capLegale = "Inserisci un CAP di 5 cifre."; }
    if (!form.provinciaLegale) e.provinciaLegale = "Campo obbligatorio.";
    if (!form.email.trim()) { e.email = "Campo obbligatorio."; }
    else if (!EMAIL_RE.test(form.email.trim())) { e.email = "Indirizzo email non valido."; }
    if (!form.pec.trim()) { e.pec = "Campo obbligatorio."; }
    else if (!EMAIL_RE.test(form.pec.trim())) { e.pec = "Indirizzo PEC non valido."; }
    if (!form.telefono.trim()) e.telefono = "Campo obbligatorio.";
    if (form.sitoWeb.trim() && !URL_RE.test(form.sitoWeb.trim())) e.sitoWeb = "Inserisci un URL valido (es. https://www.azienda.it).";
    if (form.linkedin.trim() && !URL_RE.test(form.linkedin.trim())) e.linkedin = "Inserisci un URL valido (es. https://www.linkedin.com/company/...).";

    if (!form.lrNomeCognome.trim()) e.lrNomeCognome = "Campo obbligatorio.";
    if (!form.lrCodiceFiscale.trim()) { e.lrCodiceFiscale = "Campo obbligatorio."; }
    else if (!CF_RE.test(form.lrCodiceFiscale.trim())) { e.lrCodiceFiscale = "Formato codice fiscale non valido."; }
    if (!form.lrRuolo.trim()) e.lrRuolo = "Campo obbligatorio.";
    if (!form.refNome.trim()) e.refNome = "Campo obbligatorio.";
    if (!form.refRuolo.trim()) e.refRuolo = "Campo obbligatorio.";
    if (!form.refEmail.trim()) { e.refEmail = "Campo obbligatorio."; }
    else if (!EMAIL_RE.test(form.refEmail.trim())) { e.refEmail = "Indirizzo email non valido."; }
    if (!form.refTelefono.trim()) e.refTelefono = "Campo obbligatorio.";
    return e;
  }

  function handleSave() {
    const now = new Date();
    setSavedAt(`${String(now.getHours()).padStart(2,"0")}:${String(now.getMinutes()).padStart(2,"0")}`);
  }

  async function handleSaveDraft() {
    setSaveError(null);
    if (!auth?.token) {
      setSaveError("Sessione scaduta. Effettua nuovamente il login.");
      return;
    }
    try {
      let appId = sessionStorage.getItem("revamp_applicationId");
      if (!appId) {
        const draft = await createRevampApplicationDraft({ registryType: "ALBO_B", sourceChannel: "PUBLIC" }, auth.token);
        appId = draft.id;
        sessionStorage.setItem("revamp_applicationId", appId);
      }
      await saveRevampApplicationSection(appId, "S1", JSON.stringify({ ...form }), false, auth.token);
      handleSave();
    } catch {
      setSaveError("Salvataggio non riuscito. Riprova.");
    }
  }

  async function handleNext(ev: FormEvent) {
    ev.preventDefault();
    const errs = validate();
    if (Object.keys(errs).length) { setErrors(errs); return; }
    handleSave();
    const payload = { ...form };
    sessionStorage.setItem("revamp_b1", JSON.stringify(payload));
    if (auth?.token) {
      try {
        let appId = sessionStorage.getItem("revamp_applicationId");
        if (!appId) {
          const draft = await createRevampApplicationDraft({ registryType: "ALBO_B", sourceChannel: "PUBLIC" }, auth.token);
          appId = draft.id;
          sessionStorage.setItem("revamp_applicationId", appId);
        }
        const FORMA_TO_BACKEND: Record<string, string> = {
          srl: "SRL", srls: "SRL", spa: "SPA", sas: "SAS", snc: "SNC",
          coop_sociale: "COOPERATIVA", coop_nonsociale: "COOPERATIVA",
          consorzio: "ALTRO", fondazione: "FONDAZIONE", associazione: "ASSOCIAZIONE",
          aps: "ASSOCIAZIONE", odv: "ASSOCIAZIONE", impresa_sociale: "ETS",
          studio_associato: "ALTRO", ditta_individuale: "ALTRO", altro: "ALTRO",
        };
        const apiPayload = {
          ...payload,
          companyName:        form.ragioneSociale,
          vatNumber:          form.piva,
          reaNumber:          form.rea,
          cciaaProvince:      form.cciaa,
          incorporationDate:  form.dataCostituzione,
          legalForm:          FORMA_TO_BACKEND[form.formaGiuridica] ?? "ALTRO",
          institutionalEmail: form.email || form.pec,
          phone:              form.telefono,
          linkedin:           form.linkedin || undefined,
          legalRepresentative: {
            name:    form.lrNomeCognome,
            taxCode: form.lrCodiceFiscale,
            role:    form.lrRuolo,
          },
          operationalContact: {
            name:  form.refNome,
            email: form.refEmail,
            phone: form.refTelefono,
          },
          legalAddress: {
            street:   form.indirizzoLegale,
            city:     form.comuneLegale,
            cap:      form.capLegale,
            province: form.provinciaLegale,
          },
        };
        await saveRevampApplicationSection(appId, "S1", JSON.stringify(apiPayload), true, auth.token);
      } catch {
        window.alert("Salvataggio non riuscito. Controlla i dati e riprova.");
        return;
      }
    }
    navigate("/apply/albo-b/step/2");
  }

  const errorCount = Object.keys(errors).length;

  return (
    <div style={{ margin: "-1rem", background: "#f0f4f8", minHeight: "100%" }}>
      {/* Header */}
      <div style={{ background: "#fff", borderBottom: "1px solid #e5e7eb", display: "flex", alignItems: "center", justifyContent: "space-between", padding: "12px 32px" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
          <span style={{ display: "inline-flex", alignItems: "center", justifyContent: "center", width: 26, height: 26, background: "#f5c800", borderRadius: 4 }}>
            <span style={{ width: 7, height: 7, borderRadius: "50%", background: "#fff", display: "inline-block" }} />
          </span>
          <span style={{ fontWeight: 800, fontSize: "1.05rem", color: "#1a1a2e" }}>Solco<sup style={{ color: "#f5c800", fontSize: "0.55rem", verticalAlign: "super" }}>+</sup></span>
        </div>
        <div style={{ textAlign: "center" }}>
          <div style={{ fontWeight: 700, fontSize: "1rem", color: "#1e293b" }}>Albo B — Aziende</div>
          <div style={{ fontSize: "0.75rem", color: MUTED }}>Questionario di iscrizione</div>
        </div>
        <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", gap: 4 }}>
          <button type="button" onClick={() => void handleSaveDraft()} style={{ display: "flex", alignItems: "center", gap: 6, padding: "7px 16px", background: "#fff", border: "1.5px solid #d1d5db", borderRadius: 6, fontWeight: 600, fontSize: "0.82rem", cursor: "pointer", color: "#374151" }}>
            <Save size={14} /> {savedAt ? `Bozza salvata ${savedAt}` : "Salva bozza"}
          </button>
          {saveError ? <span style={{ fontSize: "0.72rem", color: "#dc2626" }}>{saveError}</span> : null}
        </div>
      </div>

      <StepBar active={0} />

      <form onSubmit={handleNext} noValidate>
        <div style={{ maxWidth: 1040, margin: "28px auto", padding: "0 24px" }}>
          <div style={{ background: "#fff", borderRadius: 10, border: "1px solid #e5e7eb", padding: "28px 32px" }}>

            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
              <div>
                <h2 style={{ fontSize: "1.1rem", fontWeight: 700, color: "#1e293b", margin: 0 }}>Sezione 1 — Dati Aziendali</h2>
                <p style={{ fontSize: "0.82rem", color: MUTED, margin: "4px 0 0" }}>Compila i dati dell'organizzazione. I campi con <span style={{ color: ERR }}>*</span> sono obbligatori.</p>
              </div>
              {savedAt ? <span style={{ fontSize: "0.75rem", color: "#16a34a", background: "#f0fdf4", border: "1px solid #bbf7d0", borderRadius: 4, padding: "3px 10px" }}>✓ Bozza salvata {savedAt}</span> : null}
            </div>
            <div style={{ height: 1, background: "#f3f4f6", margin: "16px 0 4px" }} />

            {/* Dati aziendali */}
            <SectionLabel label="Dati aziendali" />
            <div style={{ display: "grid", gridTemplateColumns: "2fr 1fr", gap: 16, marginBottom: 16 }}>
              <Field label="Ragione sociale" required value={form.ragioneSociale} onChange={set("ragioneSociale")} error={errors.ragioneSociale} placeholder="Esempio S.r.l." />
              <SelectField label="Forma giuridica" required value={form.formaGiuridica} onChange={set("formaGiuridica")} error={errors.formaGiuridica} options={FORME_GIURIDICHE} />
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr 1fr", gap: 16, marginBottom: 16 }}>
              <Field label="Partita IVA" required value={form.piva} onChange={set("piva")} error={errors.piva} placeholder="12345678901" />
              <Field label="Codice Fiscale" value={form.codiceFiscale} onChange={set("codiceFiscale")} error={errors.codiceFiscale} placeholder="Se diverso dalla P.IVA" hintText="opzionale" />
              <Field label="Numero REA" required value={form.rea} onChange={set("rea")} error={errors.rea} placeholder="MI-1234567" hintText="es. MI-1234567" />
              <SelectField label="CCIAA di iscrizione" required value={form.cciaa} onChange={set("cciaa")} error={errors.cciaa} options={PROVINCE_IT} />
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 3fr", gap: 16, marginBottom: 16 }}>
              <Field label="Data di costituzione" required value={form.dataCostituzione} onChange={set("dataCostituzione")} error={errors.dataCostituzione} placeholder="MM/AAAA" hintText="mese/anno" />
            </div>

            {/* Sede legale */}
            <SectionLabel label="Sede legale" />
            <div style={{ display: "grid", gridTemplateColumns: "2fr 1fr 0.6fr 1fr", gap: 16, marginBottom: 16 }}>
              <Field label="Via e numero civico" required value={form.indirizzoLegale} onChange={set("indirizzoLegale")} error={errors.indirizzoLegale} placeholder="Via Roma, 1" />
              <Field label="Comune" required value={form.comuneLegale} onChange={set("comuneLegale")} error={errors.comuneLegale} placeholder="Milano" />
              <Field label="CAP" required value={form.capLegale} onChange={set("capLegale")} error={errors.capLegale} placeholder="20121" />
              <SelectField label="Provincia" required value={form.provinciaLegale} onChange={set("provinciaLegale")} error={errors.provinciaLegale} options={PROVINCE_IT} />
            </div>
            <div style={{ marginBottom: 16 }}>
              <Field label="Sede operativa principale" value={form.sedeOperativa} onChange={set("sedeOperativa")} placeholder="Solo se diversa dalla sede legale — indirizzo completo" hintText="opzionale" />
            </div>

            {/* Contatti */}
            <SectionLabel label="Contatti istituzionali" />
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 16, marginBottom: 16 }}>
              <Field label="E-mail istituzionale" required type="email" value={form.email} onChange={set("email")} error={errors.email} placeholder="info@azienda.it" />
              <Field label="PEC" required type="email" value={form.pec} onChange={set("pec")} error={errors.pec} placeholder="azienda@pec.it" />
              <Field label="Telefono principale" required value={form.telefono} onChange={set("telefono")} error={errors.telefono} placeholder="+39 02 1234567" />
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16, marginBottom: 16 }}>
              <Field label="Sito web aziendale" type="url" value={form.sitoWeb} onChange={set("sitoWeb")} error={errors.sitoWeb} placeholder="https://www.azienda.it" hintText="opzionale" />
              <Field label="LinkedIn aziendale" type="url" value={form.linkedin} onChange={set("linkedin")} error={errors.linkedin} placeholder="https://www.linkedin.com/company/azienda" hintText="opzionale" />
            </div>

            {/* Legale rappresentante */}
            <SectionLabel label="Legale rappresentante" />
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 16, marginBottom: 16 }}>
              <Field label="Nome e Cognome" required value={form.lrNomeCognome} onChange={set("lrNomeCognome")} error={errors.lrNomeCognome} placeholder="Mario Rossi" />
              <Field label="Codice Fiscale" required value={form.lrCodiceFiscale} onChange={set("lrCodiceFiscale")} error={errors.lrCodiceFiscale} placeholder="RSSMRA80C15F205X" />
              <Field label="Ruolo / Carica" required value={form.lrRuolo} onChange={set("lrRuolo")} error={errors.lrRuolo} placeholder="Es. Amministratore Unico, Presidente CdA" />
            </div>

            {/* Referente operativo */}
            <SectionLabel label="Referente operativo per Gruppo Solco" />
            <p style={{ fontSize: "0.82rem", color: MUTED, marginBottom: 12 }}>
              La persona di contatto per la gestione quotidiana del rapporto con il Gruppo. Può coincidere con il legale rappresentante.
            </p>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr 1fr", gap: 16, marginBottom: 16 }}>
              <Field label="Nome e Cognome" required value={form.refNome} onChange={set("refNome")} error={errors.refNome} placeholder="Anna Bianchi" />
              <Field label="Ruolo" required value={form.refRuolo} onChange={set("refRuolo")} error={errors.refRuolo} placeholder="Responsabile commerciale" />
              <Field label="E-mail" required type="email" value={form.refEmail} onChange={set("refEmail")} error={errors.refEmail} placeholder="referente@azienda.it" />
              <Field label="Telefono" required value={form.refTelefono} onChange={set("refTelefono")} error={errors.refTelefono} placeholder="+39 333 1234567" />
            </div>

            {/* Error summary */}
            {errorCount > 0 ? (
              <div style={{ background: WARN_BG, border: `1px solid ${WARN_BORDER}`, borderRadius: 6, padding: "12px 16px" }}>
                <div style={{ fontSize: "0.82rem", fontWeight: 600, color: "#92400e", marginBottom: 6 }}>
                  ⚠ {errorCount} {errorCount === 1 ? "campo richiede attenzione" : "campi richiedono attenzione"}
                </div>
              </div>
            ) : null}
          </div>
        </div>

        {/* Bottom nav */}
        <div style={{ background: "#fff", borderTop: "1px solid #e5e7eb", display: "flex", alignItems: "center", justifyContent: "space-between", padding: "14px 40px", position: "sticky", bottom: 0 }}>
          <Link to="/apply" style={{ display: "flex", alignItems: "center", gap: 6, padding: "9px 20px", background: "#fff", border: `1.5px solid ${GREEN}`, borderRadius: 6, fontWeight: 600, fontSize: "0.85rem", color: GREEN, textDecoration: "none" }}>
            <ArrowLeft size={15} /> Torna alla selezione
          </Link>
          <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 4 }}>
            <span style={{ fontSize: "0.78rem", color: MUTED }}>Avanzamento: <strong>20%</strong></span>
            <div style={{ width: 200, height: 4, background: "#e5e7eb", borderRadius: 2, overflow: "hidden" }}>
              <div style={{ width: "20%", height: "100%", background: GREEN, borderRadius: 2 }} />
            </div>
          </div>
          <button type="submit" style={{ display: "flex", alignItems: "center", gap: 6, padding: "9px 20px", background: GREEN, color: "#fff", border: "none", borderRadius: 6, fontWeight: 600, fontSize: "0.85rem", cursor: "pointer" }}>
            Sezione successiva <ArrowRight size={15} />
          </button>
        </div>
      </form>
    </div>
  );
}
