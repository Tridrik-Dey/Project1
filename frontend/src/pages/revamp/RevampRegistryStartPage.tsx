import { ChangeEvent, FormEvent, useEffect, useMemo, useRef, useState } from "react";
import { Navigate, useNavigate, useParams, Link } from "react-router-dom";
import { ArrowLeft, ArrowRight, Info, Save } from "lucide-react";
import { useAuth } from "../../auth/AuthContext";
import { createRevampApplicationDraft, getMyLatestRevampApplication, getRevampApplicationSections, saveRevampApplicationSection, uploadRevampAttachment } from "../../api/revampApplicationApi";
import type { AttachmentUploadResult } from "../../api/revampApplicationApi";
import { API_BASE_URL } from "../../api/http";

type RegistryType = "ALBO_A" | "ALBO_B";

function toRegistryType(param?: string): RegistryType | null {
  if (!param) return null;
  const n = param.trim().toLowerCase();
  if (n === "albo-a") return "ALBO_A";
  if (n === "albo-b") return "ALBO_B";
  return null;
}

/* ─── colours ─────────────────────────────────────── */
const NAVY  = "#0f2a52";
const GREEN = "#1a5c3a";
const MUTED = "#6b7280";
const ERR   = "#dc2626";
const WARN_BG     = "#fffbeb";
const WARN_BORDER = "#f59e0b";

const STEPS = ["Anagrafica", "Tipologia", "Competenze", "Disponibilità", "Dichiarazioni"];

const REGIMI_FISCALI = [
  { value: "ordinario",   label: "Regime ordinario" },
  { value: "forfettario", label: "Regime forfettario" },
  { value: "occasionale", label: "Regime occasionale" },
  { value: "ditta",       label: "Ditta individuale" },
  { value: "altro",       label: "Altro (specificare)" },
];

/* Regimes where PIVA is mandatory */
const PIVA_REQUIRED_REGIMES = new Set(["ordinario", "forfettario", "ditta"]);

const PROVINCE_IT = [
  { value: "AG", label: "Agrigento (AG)" },
  { value: "AL", label: "Alessandria (AL)" },
  { value: "AN", label: "Ancona (AN)" },
  { value: "AO", label: "Aosta (AO)" },
  { value: "AQ", label: "L'Aquila (AQ)" },
  { value: "AR", label: "Arezzo (AR)" },
  { value: "AP", label: "Ascoli Piceno (AP)" },
  { value: "AT", label: "Asti (AT)" },
  { value: "AV", label: "Avellino (AV)" },
  { value: "BA", label: "Bari (BA)" },
  { value: "BT", label: "Barletta-Andria-Trani (BT)" },
  { value: "BL", label: "Belluno (BL)" },
  { value: "BN", label: "Benevento (BN)" },
  { value: "BG", label: "Bergamo (BG)" },
  { value: "BI", label: "Biella (BI)" },
  { value: "BO", label: "Bologna (BO)" },
  { value: "BZ", label: "Bolzano (BZ)" },
  { value: "BS", label: "Brescia (BS)" },
  { value: "BR", label: "Brindisi (BR)" },
  { value: "CA", label: "Cagliari (CA)" },
  { value: "CL", label: "Caltanissetta (CL)" },
  { value: "CB", label: "Campobasso (CB)" },
  { value: "CE", label: "Caserta (CE)" },
  { value: "CT", label: "Catania (CT)" },
  { value: "CZ", label: "Catanzaro (CZ)" },
  { value: "CH", label: "Chieti (CH)" },
  { value: "CO", label: "Como (CO)" },
  { value: "CS", label: "Cosenza (CS)" },
  { value: "CR", label: "Cremona (CR)" },
  { value: "KR", label: "Crotone (KR)" },
  { value: "CN", label: "Cuneo (CN)" },
  { value: "EN", label: "Enna (EN)" },
  { value: "FM", label: "Fermo (FM)" },
  { value: "FE", label: "Ferrara (FE)" },
  { value: "FI", label: "Firenze (FI)" },
  { value: "FG", label: "Foggia (FG)" },
  { value: "FC", label: "Forlì-Cesena (FC)" },
  { value: "FR", label: "Frosinone (FR)" },
  { value: "GE", label: "Genova (GE)" },
  { value: "GO", label: "Gorizia (GO)" },
  { value: "GR", label: "Grosseto (GR)" },
  { value: "IM", label: "Imperia (IM)" },
  { value: "IS", label: "Isernia (IS)" },
  { value: "SP", label: "La Spezia (SP)" },
  { value: "LT", label: "Latina (LT)" },
  { value: "LE", label: "Lecce (LE)" },
  { value: "LC", label: "Lecco (LC)" },
  { value: "LI", label: "Livorno (LI)" },
  { value: "LO", label: "Lodi (LO)" },
  { value: "LU", label: "Lucca (LU)" },
  { value: "MC", label: "Macerata (MC)" },
  { value: "MN", label: "Mantova (MN)" },
  { value: "MS", label: "Massa-Carrara (MS)" },
  { value: "MT", label: "Matera (MT)" },
  { value: "ME", label: "Messina (ME)" },
  { value: "MI", label: "Milano (MI)" },
  { value: "MO", label: "Modena (MO)" },
  { value: "MB", label: "Monza e Brianza (MB)" },
  { value: "NA", label: "Napoli (NA)" },
  { value: "NO", label: "Novara (NO)" },
  { value: "NU", label: "Nuoro (NU)" },
  { value: "OR", label: "Oristano (OR)" },
  { value: "PD", label: "Padova (PD)" },
  { value: "PA", label: "Palermo (PA)" },
  { value: "PR", label: "Parma (PR)" },
  { value: "PV", label: "Pavia (PV)" },
  { value: "PG", label: "Perugia (PG)" },
  { value: "PU", label: "Pesaro e Urbino (PU)" },
  { value: "PE", label: "Pescara (PE)" },
  { value: "PC", label: "Piacenza (PC)" },
  { value: "PI", label: "Pisa (PI)" },
  { value: "PT", label: "Pistoia (PT)" },
  { value: "PN", label: "Pordenone (PN)" },
  { value: "PZ", label: "Potenza (PZ)" },
  { value: "PO", label: "Prato (PO)" },
  { value: "RG", label: "Ragusa (RG)" },
  { value: "RA", label: "Ravenna (RA)" },
  { value: "RC", label: "Reggio Calabria (RC)" },
  { value: "RE", label: "Reggio Emilia (RE)" },
  { value: "RI", label: "Rieti (RI)" },
  { value: "RN", label: "Rimini (RN)" },
  { value: "RM", label: "Roma (RM)" },
  { value: "RO", label: "Rovigo (RO)" },
  { value: "SA", label: "Salerno (SA)" },
  { value: "SS", label: "Sassari (SS)" },
  { value: "SV", label: "Savona (SV)" },
  { value: "SI", label: "Siena (SI)" },
  { value: "SR", label: "Siracusa (SR)" },
  { value: "SO", label: "Sondrio (SO)" },
  { value: "SU", label: "Sud Sardegna (SU)" },
  { value: "TA", label: "Taranto (TA)" },
  { value: "TE", label: "Teramo (TE)" },
  { value: "TR", label: "Terni (TR)" },
  { value: "TO", label: "Torino (TO)" },
  { value: "TP", label: "Trapani (TP)" },
  { value: "TN", label: "Trento (TN)" },
  { value: "TV", label: "Treviso (TV)" },
  { value: "TS", label: "Trieste (TS)" },
  { value: "UD", label: "Udine (UD)" },
  { value: "VA", label: "Varese (VA)" },
  { value: "VE", label: "Venezia (VE)" },
  { value: "VB", label: "Verbano-Cusio-Ossola (VB)" },
  { value: "VC", label: "Vercelli (VC)" },
  { value: "VR", label: "Verona (VR)" },
  { value: "VV", label: "Vibo Valentia (VV)" },
  { value: "VI", label: "Vicenza (VI)" },
  { value: "VT", label: "Viterbo (VT)" },
];

/* ─── Validation regexes ───────────────────────────── */
const CF_RE    = /^[A-Z]{6}\d{2}[A-EHLMPR-T]\d{2}[A-Z]\d{3}[A-Z]$/i;
const PIVA_RE  = /^\d{11}$/;
const CAP_RE   = /^\d{5}$/;
const DATE_RE  = /^\d{2}\/\d{2}\/\d{4}$/;
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const URL_RE   = /^https?:\/\/.+\..+/;

const MAX_PHOTO_BYTES  = 2 * 1024 * 1024;
const PHOTO_MIME_TYPES = new Set(["image/jpeg", "image/png", "image/webp"]);

function isValidDate(s: string): boolean {
  if (!DATE_RE.test(s)) return false;
  const parts = s.split("/").map(Number);
  const [dd, mm, yyyy] = parts;
  if (mm < 1 || mm > 12 || dd < 1 || dd > 31) return false;
  const d = new Date(yyyy, mm - 1, dd);
  return d.getFullYear() === yyyy && d.getMonth() === mm - 1 && d.getDate() === dd;
}

/* ─── Shared styles ────────────────────────────────── */
type OnChange = (e: ChangeEvent<HTMLInputElement | HTMLSelectElement>) => void;

const baseInput = (error?: boolean): React.CSSProperties => ({
  width: "100%", padding: "10px 12px", fontSize: "0.88rem",
  border: `1.5px solid ${error ? ERR : "#d1d5db"}`,
  borderRadius: 6, outline: "none", boxSizing: "border-box",
  color: "#111827", background: "#fff"
});

const col: React.CSSProperties  = { display: "flex", flexDirection: "column", gap: 4 };
const lbl: React.CSSProperties  = { fontSize: "0.78rem", fontWeight: 600, color: "#374151" };
const hint: React.CSSProperties = { fontWeight: 400, color: MUTED };
const errTxt: React.CSSProperties = { fontSize: "0.74rem", color: ERR };

/* ─── Field components ─────────────────────────────── */
function Field({
  label, required, placeholder, value, onChange, error, type = "text", hintText, tooltip
}: {
  label: string; required?: boolean; placeholder?: string;
  value?: string; onChange?: OnChange; error?: string; type?: string; hintText?: string; tooltip?: string;
}) {
  const [showTip, setShowTip] = useState(false);
  return (
    <div style={col}>
      <span style={{ ...lbl, display: "flex", alignItems: "center", gap: 4 }}>
        {label}{required ? <span style={{ color: ERR }}> *</span> : null}
        {hintText ? <span style={hint}> — {hintText}</span> : null}
        {tooltip ? (
          <span
            style={{ position: "relative", display: "inline-flex", alignItems: "center" }}
            onMouseEnter={() => setShowTip(true)}
            onMouseLeave={() => setShowTip(false)}
          >
            <Info size={12} style={{ color: MUTED, cursor: "help" }} />
            {showTip && (
              <span style={{
                position: "absolute", bottom: "calc(100% + 4px)", left: "50%",
                transform: "translateX(-50%)", background: "#1f2937", color: "#fff",
                fontSize: "0.72rem", padding: "4px 8px", borderRadius: 4,
                whiteSpace: "nowrap", pointerEvents: "none", zIndex: 100,
              }}>{tooltip}</span>
            )}
          </span>
        ) : null}
      </span>
      <input
        type={type}
        placeholder={placeholder ?? ""}
        value={value ?? ""}
        onChange={onChange}
        style={baseInput(!!error)}
      />
      {error ? <span style={errTxt}>{error}</span> : null}
    </div>
  );
}

function PhoneField({
  label, required, value, onChange, error
}: {
  label: string; required?: boolean; value: string; onChange: OnChange; error?: string;
}) {
  return (
    <div style={col}>
      <span style={lbl}>
        {label}{required ? <span style={{ color: ERR }}> *</span> : null}
      </span>
      <div style={{ display: "flex" }}>
        <span style={{
          display: "flex", alignItems: "center", padding: "0 10px",
          background: "#f3f4f6", border: `1.5px solid ${error ? ERR : "#d1d5db"}`,
          borderRight: "none", borderRadius: "6px 0 0 6px",
          fontSize: "0.85rem", color: MUTED, whiteSpace: "nowrap", flexShrink: 0
        }}>
          +39
        </span>
        <input
          type="tel"
          placeholder="333 1234567"
          value={value}
          onChange={onChange}
          style={{ ...baseInput(!!error), borderRadius: "0 6px 6px 0" }}
        />
      </div>
      {error ? <span style={errTxt}>{error}</span> : null}
    </div>
  );
}

function SelectField({
  label, required, value, onChange, options, error, placeholder, hintText
}: {
  label: string; required?: boolean; value: string; onChange: OnChange;
  options: { value: string; label: string }[]; error?: string; placeholder?: string; hintText?: string;
}) {
  return (
    <div style={col}>
      <span style={lbl}>
        {label}{required ? <span style={{ color: ERR }}> *</span> : null}
        {hintText ? <span style={hint}> — {hintText}</span> : null}
      </span>
      <select value={value} onChange={onChange} style={baseInput(!!error)}>
        <option value="">{placeholder ?? "Seleziona..."}</option>
        {options.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
      </select>
      {error ? <span style={errTxt}>{error}</span> : null}
    </div>
  );
}

function SectionLabel({ label, accent }: { label: string; accent: string }) {
  return (
    <div style={{
      fontSize: "0.72rem", fontWeight: 700, color: accent,
      letterSpacing: "0.06em", textTransform: "uppercase",
      margin: "20px 0 12px", borderLeft: `3px solid ${accent}`,
      paddingLeft: 8
    }}>
      {label}
    </div>
  );
}

/* ─── Main component ───────────────────────────────── */
export function RevampRegistryStartPage() {
  const navigate  = useNavigate();
  const { registryType: registryParam } = useParams();
  const registryType = useMemo(() => toRegistryType(registryParam), [registryParam]);
  const { auth } = useAuth();

  const [form, setForm] = useState({
    firstName: "", lastName: "", birthDate: "", birthPlace: "",
    taxCode: "", vatNumber: "", taxRegime: "", taxRegimeOther: "",
    address: "", city: "", postalCode: "", province: "",
    phone: "", phoneSecondary: "",
    email: auth?.email ?? "", emailSecondary: "", pec: "",
    website: "", linkedin: ""
  });
  const [errors, setErrors]   = useState<Record<string, string>>({});
  const [savedAt, setSavedAt] = useState<string | null>(null);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [profilePhotoPreviewUrl, setProfilePhotoPreviewUrl] = useState<string | null>(null);
  const [profilePhotoAttachment, setProfilePhotoAttachment] = useState<AttachmentUploadResult | null>(null);
  const [photoError, setPhotoError] = useState<string | null>(null);
  const [photoUploading, setPhotoUploading] = useState(false);
  const photoInputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    if (!auth?.token || !registryType) return;

    function applyS1(sections: { sectionKey: string; sectionVersion: number; payloadJson: string }[]) {
      const latest = sections
        .filter(s => s.sectionKey === "S1")
        .sort((a, b) => b.sectionVersion - a.sectionVersion)[0];
      if (!latest) return;
      const s1 = JSON.parse(latest.payloadJson) as Record<string, unknown>;
      setForm(prev => ({
        ...prev,
        firstName:      (s1.firstName      as string) ?? prev.firstName,
        lastName:       (s1.lastName       as string) ?? prev.lastName,
        birthDate:      (s1.birthDate      as string) ?? prev.birthDate,
        birthPlace:     (s1.birthPlace     as string) ?? prev.birthPlace,
        taxCode:        (s1.taxCode        as string) ?? prev.taxCode,
        vatNumber:      (s1.vatNumber      as string) ?? prev.vatNumber,
        taxRegime:      (s1.taxRegime      as string) ?? prev.taxRegime,
        address:        ((s1.addressLine ?? s1.address) as string) ?? prev.address,
        city:           (s1.city           as string) ?? prev.city,
        postalCode:     (s1.postalCode     as string) ?? prev.postalCode,
        province:       (s1.province       as string) ?? prev.province,
        phone:          (s1.phone          as string) ?? prev.phone,
        phoneSecondary: (s1.secondaryPhone as string) ?? prev.phoneSecondary,
        email:          (s1.email          as string) ?? prev.email,
        emailSecondary: (s1.secondaryEmail as string) ?? prev.emailSecondary,
        pec:            (s1.pec            as string) ?? prev.pec,
        website:        (s1.website        as string) ?? prev.website,
        linkedin:       (s1.linkedin       as string) ?? prev.linkedin,
      }));
      if (s1.profilePhotoAttachment && typeof s1.profilePhotoAttachment === "object") {
        setProfilePhotoAttachment(s1.profilePhotoAttachment as AttachmentUploadResult);
      }
    }

    const existingAppId = sessionStorage.getItem("revamp_applicationId");
    if (existingAppId) {
      getRevampApplicationSections(existingAppId, auth.token).then(applyS1).catch(() => {});
      return;
    }

    const expectedType = registryType === "ALBO_A" ? "ALBO_A" : "ALBO_B";
    getMyLatestRevampApplication(auth.token).then(app => {
      if (!app || app.status !== "DRAFT" || app.registryType !== expectedType) return;
      sessionStorage.setItem("revamp_applicationId", app.id);
      return getRevampApplicationSections(app.id, auth.token!).then(applyS1);
    }).catch(() => {});
  }, [auth?.token, registryType]);

  useEffect(() => {
    return () => { if (profilePhotoPreviewUrl) URL.revokeObjectURL(profilePhotoPreviewUrl); };
  }, [profilePhotoPreviewUrl]);

  useEffect(() => {
    if (!profilePhotoAttachment || profilePhotoPreviewUrl || !auth?.token) return;
    const appId = sessionStorage.getItem("revamp_applicationId");
    if (!appId) return;
    let cancelled = false;
    fetch(
      `${API_BASE_URL}/api/v2/applications/${appId}/attachments/download?storageKey=${encodeURIComponent(profilePhotoAttachment.storageKey)}`,
      { headers: { Authorization: `Bearer ${auth.token}` } }
    )
      .then(r => r.blob())
      .then(blob => { if (!cancelled) setProfilePhotoPreviewUrl(URL.createObjectURL(blob)); })
      .catch(() => {});
    return () => { cancelled = true; };
  }, [profilePhotoAttachment?.storageKey]);

  async function onProfilePhotoChange(e: ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!PHOTO_MIME_TYPES.has(file.type)) {
      setPhotoError("Formato non supportato. Usa JPG, PNG o WEBP.");
      return;
    }
    if (file.size > MAX_PHOTO_BYTES) {
      setPhotoError("Dimensione massima 2 MB.");
      return;
    }
    setPhotoError(null);
    setPhotoUploading(true);
    setProfilePhotoPreviewUrl(prev => { if (prev) URL.revokeObjectURL(prev); return URL.createObjectURL(file); });
    try {
      let appId = sessionStorage.getItem("revamp_applicationId");
      if (!appId && auth?.token) {
        const draft = await createRevampApplicationDraft(
          { registryType: registryType === "ALBO_A" ? "ALBO_A" : "ALBO_B", sourceChannel: "PUBLIC" },
          auth.token
        );
        appId = draft.id;
        sessionStorage.setItem("revamp_applicationId", appId);
      }
      if (!appId || !auth?.token) {
        setPhotoError("Sessione scaduta. Effettua nuovamente il login.");
        return;
      }
      const result = await uploadRevampAttachment(appId, file, auth.token);
      setProfilePhotoAttachment(result);
    } catch {
      setPhotoError("Caricamento non riuscito. Riprova.");
      setProfilePhotoPreviewUrl(prev => { if (prev) URL.revokeObjectURL(prev); return null; });
    } finally {
      setPhotoUploading(false);
    }
  }

  function onRemoveProfilePhoto() {
    setProfilePhotoPreviewUrl(prev => { if (prev) URL.revokeObjectURL(prev); return null; });
    setProfilePhotoAttachment(null);
    if (photoInputRef.current) photoInputRef.current.value = "";
  }

  if (!registryType) return <Navigate to="/apply" replace />;

  const isA        = registryType === "ALBO_A";
  const accent     = isA ? NAVY : GREEN;
  const title      = isA ? "Albo A — Professionisti" : "Albo B — Aziende";
  const pivaReq    = PIVA_REQUIRED_REGIMES.has(form.taxRegime);
  const showOtherRegime = form.taxRegime === "altro";

  function set(field: keyof typeof form): OnChange {
    return (e) => {
      setForm(prev => ({ ...prev, [field]: e.target.value }));
      if (errors[field]) setErrors(prev => { const n = { ...prev }; delete n[field]; return n; });
    };
  }

  function validate(): Record<string, string> {
    const e: Record<string, string> = {};

    if (!form.firstName.trim())  e.firstName  = "Campo obbligatorio.";
    if (!form.lastName.trim())   e.lastName   = "Campo obbligatorio.";

    if (!form.birthDate.trim()) {
      e.birthDate = "Campo obbligatorio.";
    } else if (!isValidDate(form.birthDate.trim())) {
      e.birthDate = "Data non valida. Usa il formato GG/MM/AAAA.";
    }

    if (!form.birthPlace.trim()) e.birthPlace = "Campo obbligatorio.";

    if (!form.taxCode.trim()) {
      e.taxCode = "Campo obbligatorio.";
    } else if (!CF_RE.test(form.taxCode.trim())) {
      e.taxCode = "Formato non valido (16 caratteri: AAABBB99A99A999A).";
    }

    if (pivaReq && !form.vatNumber.trim()) {
      e.vatNumber = "Obbligatoria per il regime fiscale selezionato.";
    } else if (form.vatNumber.trim() && !PIVA_RE.test(form.vatNumber.trim())) {
      e.vatNumber = "Formato non valido: deve avere esattamente 11 cifre.";
    }

    if (!form.taxRegime)                                         e.taxRegime      = "Campo obbligatorio.";
    if (showOtherRegime && !form.taxRegimeOther.trim())          e.taxRegimeOther = "Specifica il regime fiscale.";

    if (!form.address.trim())    e.address   = "Campo obbligatorio.";
    if (!form.city.trim())       e.city      = "Campo obbligatorio.";

    if (!form.postalCode.trim()) {
      e.postalCode = "Campo obbligatorio.";
    } else if (!CAP_RE.test(form.postalCode.trim())) {
      e.postalCode = "Inserisci un CAP di 5 cifre.";
    }

    if (!form.province)          e.province  = "Campo obbligatorio.";
    if (!form.phone.trim())      e.phone     = "Campo obbligatorio.";

    if (!form.email.trim()) {
      e.email = "Campo obbligatorio.";
    } else if (!EMAIL_RE.test(form.email.trim())) {
      e.email = "Inserisci un indirizzo e-mail valido.";
    }

    if (form.emailSecondary.trim() && !EMAIL_RE.test(form.emailSecondary.trim()))
      e.emailSecondary = "Indirizzo e-mail non valido.";

    if (form.pec.trim() && !EMAIL_RE.test(form.pec.trim()))
      e.pec = "Indirizzo PEC non valido.";

    if (form.website.trim() && !URL_RE.test(form.website.trim()))
      e.website = "Inserisci un URL valido (es. https://www.esempio.it).";

    return e;
  }

  function handleSave() {
    const now = new Date();
    setSavedAt(`${String(now.getHours()).padStart(2, "0")}:${String(now.getMinutes()).padStart(2, "0")}`);
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
        const draft = await createRevampApplicationDraft(
          { registryType: isA ? "ALBO_A" : "ALBO_B", sourceChannel: "PUBLIC" },
          auth.token
        );
        appId = draft.id;
        sessionStorage.setItem("revamp_applicationId", appId);
      }
      const payload = JSON.stringify({
        firstName: form.firstName, lastName: form.lastName,
        birthDate: form.birthDate, birthPlace: form.birthPlace,
        taxCode: form.taxCode, vatNumber: form.vatNumber,
        taxRegime: form.taxRegime, email: form.email,
        phone: form.phone, address: form.address, addressLine: form.address,
        city: form.city, postalCode: form.postalCode,
        province: form.province, linkedin: form.linkedin,
        secondaryPhone: form.phoneSecondary,
        secondaryEmail: form.emailSecondary,
        pec: form.pec,
        website: form.website,
        ...(profilePhotoAttachment ? { profilePhotoAttachment } : {}),
      });
      await saveRevampApplicationSection(appId, "S1", payload, false, auth.token);
      handleSave();
    } catch {
      setSaveError("Salvataggio non riuscito. Riprova.");
    }
  }

  async function handleNext(ev: FormEvent) {
    ev.preventDefault();
    setSaveError(null);
    const errs = validate();
    if (Object.keys(errs).length) { setErrors(errs); return; }
    handleSave();
    sessionStorage.setItem("revamp_s1", JSON.stringify({
      firstName: form.firstName, lastName: form.lastName,
      birthDate: form.birthDate, birthPlace: form.birthPlace,
      taxCode: form.taxCode, vatNumber: form.vatNumber,
      taxRegime: form.taxRegime, email: form.email,
      phone: form.phone, address: form.address, addressLine: form.address,
      city: form.city, postalCode: form.postalCode,
      province: form.province, linkedin: form.linkedin,
      secondaryPhone: form.phoneSecondary,
      secondaryEmail: form.emailSecondary,
      pec: form.pec,
      website: form.website,
      ...(profilePhotoAttachment ? { profilePhotoAttachment } : {}),
    }));
    if (auth?.token) {
      try {
        let appId = sessionStorage.getItem("revamp_applicationId");
        if (!appId) {
          const draft = await createRevampApplicationDraft(
            { registryType: isA ? "ALBO_A" : "ALBO_B", sourceChannel: "PUBLIC" },
            auth.token
          );
          appId = draft.id;
          sessionStorage.setItem("revamp_applicationId", appId);
        }
        await saveRevampApplicationSection(appId, "S1", sessionStorage.getItem("revamp_s1") ?? "{}", true, auth.token);
      } catch {
        setSaveError("Salvataggio non riuscito. Controlla i dati e riprova.");
        return;
      }
    }
    navigate(`/apply/${registryParam}/step/2`);
  }

  const errorCount = Object.keys(errors).length;

  return (
    <div style={{ margin: "-1rem", background: "#f0f4f8", minHeight: "100%" }}>

      {/* ── Inner page header ── */}
      <div style={{ background: "#fff", borderBottom: "1px solid #e5e7eb", display: "flex", alignItems: "center", justifyContent: "space-between", padding: "12px 32px" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
          <span style={{ display: "inline-flex", alignItems: "center", justifyContent: "center", width: 26, height: 26, background: "#f5c800", borderRadius: 4 }}>
            <span style={{ width: 7, height: 7, borderRadius: "50%", background: "#fff", display: "inline-block" }} />
          </span>
          <span style={{ fontWeight: 800, fontSize: "1.05rem", color: "#1a1a2e" }}>
            Solco<sup style={{ color: "#f5c800", fontSize: "0.55rem", verticalAlign: "super" }}>+</sup>
          </span>
        </div>
        <div style={{ textAlign: "center" }}>
          <div style={{ fontWeight: 700, fontSize: "1rem", color: "#1e293b" }}>{title}</div>
          <div style={{ fontSize: "0.75rem", color: MUTED }}>Questionario di iscrizione</div>
        </div>
        <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", gap: 4 }}>
          <button type="button" onClick={() => void handleSaveDraft()} style={{ display: "flex", alignItems: "center", gap: 6, padding: "7px 16px", background: "#fff", border: "1.5px solid #d1d5db", borderRadius: 6, fontWeight: 600, fontSize: "0.82rem", cursor: "pointer", color: "#374151" }}>
            <Save size={14} />
            {savedAt ? `Bozza salvata ${savedAt}` : "Salva bozza"}
          </button>
          {saveError ? <span style={{ fontSize: "0.72rem", color: "#dc2626" }}>{saveError}</span> : null}
        </div>
      </div>

      {/* ── Step bar ── */}
      <div style={{ background: "#fff", borderBottom: "1px solid #e5e7eb", padding: "16px 40px" }}>
        <div style={{ maxWidth: 820, margin: "0 auto", display: "flex", alignItems: "flex-start", justifyContent: "space-between", position: "relative" }}>
          <div style={{ position: "absolute", top: 18, left: "10%", right: "10%", height: 2, background: "#e5e7eb", zIndex: 0 }} />
          {STEPS.map((step, i) => {
            const active = i === 0;
            return (
              <div key={step} style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 6, zIndex: 1 }}>
                <span style={{ width: 36, height: 36, borderRadius: "50%", background: active ? accent : "#fff", border: `2px solid ${active ? accent : "#d1d5db"}`, display: "flex", alignItems: "center", justifyContent: "center", fontWeight: 700, fontSize: "0.85rem", color: active ? "#fff" : "#9ca3af" }}>
                  {i + 1}
                </span>
                <span style={{ fontSize: "0.72rem", color: active ? accent : "#9ca3af", fontWeight: active ? 600 : 400, textAlign: "center" }}>
                  {step}
                </span>
              </div>
            );
          })}
        </div>
      </div>

      {/* ── Form ── */}
      <form onSubmit={handleNext} noValidate>
        <div style={{ maxWidth: 980, margin: "28px auto", padding: "0 24px" }}>
          <div style={{ background: "#fff", borderRadius: 10, border: "1px solid #e5e7eb", padding: "28px 32px" }}>

            {/* Card header */}
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
              <div>
                <h2 style={{ fontSize: "1.1rem", fontWeight: 700, color: "#1e293b", margin: 0 }}>
                  Sezione 1 — Dati Anagrafici
                </h2>
                <p style={{ fontSize: "0.82rem", color: MUTED, margin: "4px 0 0" }}>
                  Compila i tuoi dati personali e di contatto. I campi con <span style={{ color: ERR }}>*</span> sono obbligatori.
                </p>
              </div>
              {savedAt ? (
                <span style={{ display: "flex", alignItems: "center", gap: 5, fontSize: "0.75rem", color: "#16a34a", background: "#f0fdf4", border: "1px solid #bbf7d0", borderRadius: 4, padding: "3px 10px", whiteSpace: "nowrap" }}>
                  ✓ Bozza salvata {savedAt}
                </span>
              ) : null}
            </div>
            <div style={{ height: 1, background: "#f3f4f6", margin: "16px 0 4px" }} />

            {/* ── Foto profilo ── */}
            <SectionLabel label="Foto profilo" accent={accent} />
            <div style={{ marginBottom: 20 }}>
              <p style={{ fontSize: "0.82rem", color: MUTED, margin: "0 0 10px" }}>
                Opzionale. Formati supportati: JPG, PNG, WEBP. Dimensione massima: 2 MB.
              </p>
              <input
                ref={photoInputRef}
                type="file"
                accept="image/jpeg,image/png,image/webp"
                onChange={e => void onProfilePhotoChange(e)}
                disabled={photoUploading}
                style={{ display: "none" }}
              />
              <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
                {/* Clickable upload area */}
                <div
                  onClick={() => !photoUploading && photoInputRef.current?.click()}
                  style={{
                    border: `1.5px dashed ${profilePhotoAttachment ? "#16a34a" : "#d1d5db"}`,
                    borderRadius: 8, padding: "12px 18px", cursor: photoUploading ? "default" : "pointer",
                    background: profilePhotoAttachment ? "#f0fdf4" : "#fafafa",
                    display: "flex", alignItems: "center", gap: 10, minWidth: 240,
                  }}
                >
                  {photoUploading ? (
                    <span style={{ fontSize: "0.82rem", color: MUTED }}>Caricamento in corso...</span>
                  ) : profilePhotoAttachment ? (
                    <span style={{ fontSize: "0.82rem", color: "#16a34a", fontWeight: 600 }}>✓ {profilePhotoAttachment.fileName}</span>
                  ) : (
                    <span style={{ fontSize: "0.82rem", color: "#9ca3af" }}>Clicca per caricare una foto</span>
                  )}
                </div>
                {/* Thumbnail or placeholder */}
                {(profilePhotoPreviewUrl || profilePhotoAttachment) && !photoUploading && (
                  <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 6 }}>
                    {profilePhotoPreviewUrl ? (
                      <img src={profilePhotoPreviewUrl} alt="Anteprima"
                        style={{ width: 72, height: 72, objectFit: "cover", borderRadius: 8, border: "1px solid #d1d5db" }} />
                    ) : (
                      <div style={{ width: 72, height: 72, borderRadius: 8, border: "1px solid #d1d5db", background: "#f3f4f6", display: "flex", alignItems: "center", justifyContent: "center" }}>
                        <span style={{ fontSize: "1.6rem" }}>🖼</span>
                      </div>
                    )}
                    <button type="button" onClick={onRemoveProfilePhoto}
                      style={{ fontSize: "0.72rem", color: "#b91c1c", background: "none", border: "none", cursor: "pointer", padding: 0, fontWeight: 600 }}>
                      ✕ Rimuovi
                    </button>
                  </div>
                )}
              </div>
              {photoError ? <span style={{ ...errTxt, display: "block", marginTop: 6 }}>{photoError}</span> : null}
            </div>

            {/* ── Dati personali ── */}
            <SectionLabel label="Dati personali" accent={accent} />
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr 1fr", gap: 16, marginBottom: 16 }}>
              <Field label="Nome" required value={form.firstName} onChange={set("firstName")} error={errors.firstName} placeholder="Mario" />
              <Field label="Cognome" required value={form.lastName} onChange={set("lastName")} error={errors.lastName} placeholder="Rossi" />
              <Field label="Data di nascita" required value={form.birthDate} onChange={set("birthDate")} error={errors.birthDate} placeholder="GG/MM/AAAA" />
              <Field label="Luogo di nascita" required value={form.birthPlace} onChange={set("birthPlace")} error={errors.birthPlace} placeholder="Milano (MI)" tooltip="Comune e Paese se estero" />
            </div>

            {/* ── Dati fiscali ── */}
            <SectionLabel label="Dati fiscali" accent={accent} />
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 16, marginBottom: showOtherRegime ? 12 : 16 }}>
              <Field
                label="Codice Fiscale" required
                value={form.taxCode} onChange={set("taxCode")} error={errors.taxCode}
                placeholder="RSSMRA80C15F205X"
              />
              <SelectField
                label="Regime fiscale" required
                value={form.taxRegime} onChange={set("taxRegime")} error={errors.taxRegime}
                options={REGIMI_FISCALI}
              />
              <Field
                label="Partita IVA" required={pivaReq}
                value={form.vatNumber} onChange={set("vatNumber")} error={errors.vatNumber}
                placeholder="12345678901"
                hintText={pivaReq ? "obbligatoria per questo regime" : "opzionale — 11 cifre"}
              />
            </div>
            {showOtherRegime ? (
              <div style={{ marginBottom: 16 }}>
                <Field
                  label="Specifica il regime fiscale" required
                  value={form.taxRegimeOther} onChange={set("taxRegimeOther")} error={errors.taxRegimeOther}
                  placeholder="Descrivi il tuo regime fiscale"
                />
              </div>
            ) : null}

            {/* ── Indirizzo ── */}
            <SectionLabel label="Indirizzo professionale / di residenza" accent={accent} />
            <div style={{ display: "grid", gridTemplateColumns: "2fr 1fr 0.6fr 1fr", gap: 16, marginBottom: 16 }}>
              <Field label="Via e numero civico" required value={form.address} onChange={set("address")} error={errors.address} placeholder="Via Dante, 14" />
              <Field label="Comune" required value={form.city} onChange={set("city")} error={errors.city} placeholder="Milano" />
              <Field label="CAP" required value={form.postalCode} onChange={set("postalCode")} error={errors.postalCode} placeholder="20121" />
              <SelectField
                label="Provincia" required
                value={form.province} onChange={set("province")} error={errors.province}
                options={PROVINCE_IT}
              />
            </div>

            {/* ── Contatti ── */}
            <SectionLabel label="Contatti telefonici" accent={accent} />
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16, marginBottom: 16 }}>
              <PhoneField label="Telefono principale" required value={form.phone} onChange={set("phone")} error={errors.phone} />
              <PhoneField label="Telefono secondario / WhatsApp" value={form.phoneSecondary} onChange={set("phoneSecondary")} />
            </div>

            <SectionLabel label="Contatti e-mail" accent={accent} />
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 16, marginBottom: 16 }}>
              <Field
                label="E-mail principale" required type="email"
                value={form.email} onChange={set("email")} error={errors.email}
                placeholder="mario.rossi@email.it"
              />
              <Field
                label="E-mail secondaria" type="email"
                value={form.emailSecondary} onChange={set("emailSecondary")} error={errors.emailSecondary}
                placeholder="facoltativa"
              />
              <Field
                label="PEC" type="email"
                value={form.pec} onChange={set("pec")} error={errors.pec}
                placeholder="mario.rossi@pec.it"
              />
            </div>

            {/* ── Presenza online ── */}
            <SectionLabel label="Presenza online" accent={accent} />
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16, marginBottom: 20 }}>
              <Field
                label="Sito web / Portfolio online" type="url"
                value={form.website} onChange={set("website")} error={errors.website}
                placeholder="https://www.esempio.it"
              />
              <Field
                label="Profilo LinkedIn"
                value={form.linkedin} onChange={set("linkedin")} error={errors.linkedin}
                placeholder="linkedin.com/in/mario-rossi"
              />
            </div>

            {/* ── Error summary ── */}
            {errorCount > 0 ? (
              <div style={{ background: WARN_BG, border: `1px solid ${WARN_BORDER}`, borderRadius: 6, padding: "12px 16px" }}>
                <div style={{ fontSize: "0.82rem", fontWeight: 600, color: "#92400e", marginBottom: 6 }}>
                  ⚠ {errorCount} {errorCount === 1 ? "campo richiede attenzione" : "campi richiedono attenzione"}:
                </div>
                <ul style={{ margin: 0, paddingLeft: 16 }}>
                  {Object.entries(errors).map(([field, msg]) => (
                    <li key={field} style={{ fontSize: "0.8rem", color: "#78350f" }}>
                      <strong>{FIELD_LABELS[field] ?? field}</strong> — {msg}
                    </li>
                  ))}
                </ul>
              </div>
            ) : null}
          </div>
        </div>

        {/* ── Bottom navigation ── */}
        <div style={{ background: "#fff", borderTop: "1px solid #e5e7eb", display: "flex", alignItems: "center", justifyContent: "space-between", padding: "14px 40px", position: "sticky", bottom: 0 }}>
          <Link
            to="/apply"
            style={{ display: "flex", alignItems: "center", gap: 6, padding: "9px 20px", background: "#fff", border: `1.5px solid ${accent}`, borderRadius: 6, fontWeight: 600, fontSize: "0.85rem", color: accent, textDecoration: "none" }}
          >
            <ArrowLeft size={15} /> Sezione precedente
          </Link>

          <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 4 }}>
            <span style={{ fontSize: "0.78rem", color: MUTED }}>Avanzamento: <strong>20%</strong></span>
            <div style={{ width: 200, height: 4, background: "#e5e7eb", borderRadius: 2, overflow: "hidden" }}>
              <div style={{ width: "20%", height: "100%", background: accent, borderRadius: 2 }} />
            </div>
          </div>

          <button
            type="submit"
            style={{ display: "flex", alignItems: "center", gap: 6, padding: "9px 20px", background: accent, color: "#fff", border: "none", borderRadius: 6, fontWeight: 600, fontSize: "0.85rem", cursor: "pointer" }}
          >
            Sezione successiva <ArrowRight size={15} />
          </button>
        </div>
      </form>
    </div>
  );
}

const FIELD_LABELS: Record<string, string> = {
  firstName: "Nome", lastName: "Cognome",
  birthDate: "Data di nascita", birthPlace: "Luogo di nascita",
  taxCode: "Codice Fiscale", vatNumber: "Partita IVA",
  taxRegime: "Regime fiscale", taxRegimeOther: "Specifica regime",
  address: "Via e numero civico", city: "Comune",
  postalCode: "CAP", province: "Provincia",
  phone: "Telefono principale",
  email: "E-mail principale", emailSecondary: "E-mail secondaria", pec: "PEC",
  website: "Sito web / Portfolio", linkedin: "Profilo LinkedIn"
};
