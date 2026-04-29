import { ChangeEvent, useEffect, useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import { ArrowLeft, ArrowRight, Info, Save, Upload } from "lucide-react";
import { useAuth } from "../../auth/AuthContext";
import { getMyLatestRevampApplication, getRevampApplicationSections, saveRevampApplicationSection } from "../../api/revampApplicationApi";

const GREEN = "#1a5c3a";
const MUTED = "#6b7280";
const ERR = "#dc2626";
const STEPS_B = ["Dati aziendali", "Struttura", "Servizi", "Certificazioni", "Dichiarazioni"];

type CertRecord = { presente: "si" | "no" | ""; enteCertificatore: string; scadenza: string; fileName: string };

const CERTS_ISO: { key: string; label: string; desc: string }[] = [
  { key: "iso9001",  label: "ISO 9001 — Qualità", desc: "Sistema di gestione per la qualità" },
  { key: "iso14001", label: "ISO 14001 — Ambiente", desc: "Sistema di gestione ambientale" },
  { key: "iso45001", label: "ISO 45001 / OHSAS 18001 — Salute e Sicurezza", desc: "Salute e sicurezza sul lavoro" },
  { key: "sa8000",   label: "SA8000 — Responsabilità Sociale", desc: "Responsabilità sociale d'impresa" },
  { key: "iso27001", label: "ISO 27001 — Sicurezza delle informazioni", desc: "Rilevante per fornitori di servizi IT" },
];

const MY_RE = /^(0[1-9]|1[0-2])\/\d{4}$/;

const col: React.CSSProperties    = { display: "flex", flexDirection: "column", gap: 4 };
const lbl: React.CSSProperties    = { fontSize: "0.78rem", fontWeight: 600, color: "#374151" };
const errTxt: React.CSSProperties = { fontSize: "0.74rem", color: ERR };
const baseInput = (error?: boolean): React.CSSProperties => ({
  width: "100%", padding: "10px 12px", fontSize: "0.88rem",
  border: `1.5px solid ${error ? ERR : "#d1d5db"}`,
  borderRadius: 6, outline: "none", boxSizing: "border-box", color: "#111827", background: "#fff",
});

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

function FileInput({ label, required, fileName, onChange, hintText, tooltip }: {
  label: string; required?: boolean; fileName: string; hintText?: string; tooltip?: string;
  onChange: (e: ChangeEvent<HTMLInputElement>) => void;
}) {
  const [showTip, setShowTip] = useState(false);
  return (
    <div style={col}>
      <span style={{ ...lbl, display: "flex", alignItems: "center", gap: 4 }}>
        {label}{required ? <span style={{ color: ERR }}> *</span> : null}
        {hintText ? <span style={{ fontWeight: 400, color: MUTED }}> — {hintText}</span> : null}
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
      <label style={{ display: "flex", alignItems: "center", gap: 8, padding: "9px 12px", border: `1.5px dashed ${fileName ? GREEN : "#d1d5db"}`, borderRadius: 6, cursor: "pointer", background: fileName ? "#f0fdf4" : "#fafafa", transition: "border-color .15s" }}>
        <Upload size={14} color={fileName ? GREEN : "#9ca3af"} />
        <span style={{ fontSize: "0.83rem", color: fileName ? GREEN : "#6b7280", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
          {fileName || "Seleziona file PDF (max 5 MB)"}
        </span>
        <input type="file" accept=".pdf" onChange={onChange} style={{ display: "none" }} />
      </label>
    </div>
  );
}

export function RevampAlboBStep4CertificazioniPage() {
  const navigate = useNavigate();
  const { auth } = useAuth();

  const [certs, setCerts] = useState<Record<string, CertRecord>>(
    Object.fromEntries(CERTS_ISO.map(c => [c.key, { presente: "", enteCertificatore: "", scadenza: "", fileName: "" }]))
  );
  const [altreCert,    setAltreCert]    = useState("");
  const [accFormazione, setAccFormazione] = useState<"si" | "no" | "">("");
  const [accRegioni,   setAccRegioni]   = useState("");
  const [accTipo,      setAccTipo]      = useState("");
  const [accLavoro,    setAccLavoro]    = useState<"si" | "no" | "">("");

  // Allegati
  const [visura,      setVisura]      = useState("");
  const [companyProf, setCompanyProf] = useState("");
  const [durc,        setDurc]        = useState("");
  const [certAlleg,   setCertAlleg]   = useState("");

  const [triedSubmit, setTriedSubmit] = useState(false);
  const [savedAt,     setSavedAt]     = useState<string | null>(null);

  useEffect(() => {
    if (!auth?.token) return;

    function applyS4(sections: { sectionKey: string; sectionVersion: number; payloadJson: string }[]) {
      const latest = sections
        .filter(s => s.sectionKey === "S4")
        .sort((a, b) => b.sectionVersion - a.sectionVersion)[0];
      if (!latest) return;
      const s4 = JSON.parse(latest.payloadJson) as Record<string, unknown>;
      const certData = s4.certificazioni as Record<string, CertRecord> | undefined;
      if (certData) {
        setCerts(prev => {
          const n = { ...prev };
          for (const key of Object.keys(certData)) {
            if (n[key]) n[key] = { ...n[key], ...certData[key] };
          }
          return n;
        });
      }
      if (s4.altreCertificazioni !== undefined) setAltreCert(s4.altreCertificazioni as string);
      if (s4.accreditamentoFormazione)          setAccFormazione(s4.accreditamentoFormazione as "si" | "no");
      if (s4.accreditamentoRegioni)             setAccRegioni(s4.accreditamentoRegioni as string);
      if (s4.accreditamentoTipoFormazione)      setAccTipo(s4.accreditamentoTipoFormazione as string);
      if (s4.accreditamentoServiziLavoro)       setAccLavoro(s4.accreditamentoServiziLavoro as "si" | "no");
    }

    const existingAppId = sessionStorage.getItem("revamp_applicationId");
    if (existingAppId) {
      getRevampApplicationSections(existingAppId, auth.token).then(applyS4).catch(() => {});
      return;
    }

    getMyLatestRevampApplication(auth.token).then(app => {
      if (!app || app.status !== "DRAFT" || app.registryType !== "ALBO_B") return;
      sessionStorage.setItem("revamp_applicationId", app.id);
      return getRevampApplicationSections(app.id, auth!.token!).then(applyS4);
    }).catch(() => {});
  }, [auth?.token]);

  function updateCert(key: string, field: keyof CertRecord, value: string) {
    setCerts(prev => ({ ...prev, [key]: { ...prev[key], [field]: value } }));
  }

  function handleFile(setter: (name: string) => void) {
    return (e: ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (file) setter(file.name);
    };
  }

  function validate(): Record<string, string> {
    const e: Record<string, string> = {};
    for (const c of CERTS_ISO) {
      const rec = certs[c.key];
      if (!rec.presente) e[`cert_${c.key}`] = "Indica se possiedi questa certificazione.";
      if (rec.presente === "si") {
        if (!rec.enteCertificatore.trim()) e[`cert_${c.key}_ente`] = "Inserisci l'ente certificatore.";
        if (!rec.scadenza.trim()) { e[`cert_${c.key}_scad`] = "Inserisci la scadenza."; }
        else if (!MY_RE.test(rec.scadenza.trim())) { e[`cert_${c.key}_scad`] = "Formato MM/AAAA non valido."; }
      }
    }
    if (!accFormazione) e.accFormazione = "Campo obbligatorio.";
    if (!accLavoro)     e.accLavoro     = "Campo obbligatorio.";
    if (!visura)  e.visura = "La visura camerale è obbligatoria.";
    if (!durc)    e.durc   = "Il DURC è obbligatorio.";
    return e;
  }

  function handleSave() {
    const now = new Date();
    setSavedAt(`${String(now.getHours()).padStart(2,"0")}:${String(now.getMinutes()).padStart(2,"0")}`);
  }

  async function handleSaveDraft() {
    if (!auth?.token) return;
    try {
      const appId = sessionStorage.getItem("revamp_applicationId");
      if (!appId) return;
      await saveRevampApplicationSection(appId, "S4", JSON.stringify({
        certificazioni: Object.fromEntries(CERTS_ISO.map(c => [c.key, { ...certs[c.key] }])),
        altreCertificazioni: altreCert,
        accreditamentoFormazione: accFormazione,
        accreditamentoRegioni: accRegioni,
        accreditamentoTipoFormazione: accTipo,
        accreditamentoServiziLavoro: accLavoro,
      }), false, auth.token);
      handleSave();
    } catch { /* best-effort */ }
  }

  async function handleNext() {
    setTriedSubmit(true);
    const errs = validate();
    if (Object.keys(errs).length) return;
    handleSave();
    const payload = {
      certificazioni: Object.fromEntries(CERTS_ISO.map(c => [c.key, { ...certs[c.key] }])),
      altreCertificazioni: altreCert,
      accreditamentoFormazione: accFormazione,
      accreditamentoRegioni: accRegioni,
      accreditamentoTipoFormazione: accTipo,
      accreditamentoServiziLavoro: accLavoro,
      allegati: { visura, companyProfile: companyProf, durc, certificatiAllegati: certAlleg },
    };
    sessionStorage.setItem("revamp_b4", JSON.stringify(payload));
    if (auth?.token) {
      try {
        const appId = sessionStorage.getItem("revamp_applicationId");
        if (appId) {
          const hasISO9001 = certs.iso9001?.presente === "si";
          const hasCerts = hasISO9001
            || CERTS_ISO.some(c => certs[c.key]?.presente === "si")
            || altreCert.trim().length > 0
            || accFormazione === "si"
            || accLavoro === "si";
          const attachments: { documentType: string; fileName: string; storageKey: string }[] = [
            { documentType: "VISURA_CAMERALE", fileName: visura || "visura_camerale.pdf", storageKey: "upload-pending" },
            { documentType: "DURC",            fileName: durc   || "durc.pdf",            storageKey: "upload-pending" },
          ];
          if (hasCerts) {
            attachments.push({ documentType: "CERTIFICATION", fileName: certAlleg || "certificazione.pdf", storageKey: "upload-pending" });
          }
          const apiPayload = {
            ...payload,
            iso9001:              hasISO9001 ? "YES" : "NO",
            accreditationSummary: accFormazione === "si" ? (accTipo || "Accreditato") : "",
            accreditationTraining: accFormazione,
            employmentServicesAccreditation: accLavoro,
            attachments,
          };
          await saveRevampApplicationSection(appId, "S4", JSON.stringify(apiPayload), true, auth.token);
        }
      } catch {
        window.alert("Salvataggio non riuscito. Controlla i dati e riprova.");
        return;
      }
    }
    navigate("/apply/albo-b/step/5");
  }

  const errors = triedSubmit ? validate() : {};
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
        <button type="button" onClick={() => void handleSaveDraft()} style={{ display: "flex", alignItems: "center", gap: 6, padding: "7px 16px", background: "#fff", border: "1.5px solid #d1d5db", borderRadius: 6, fontWeight: 600, fontSize: "0.82rem", cursor: "pointer", color: "#374151" }}>
          <Save size={14} /> {savedAt ? `Bozza salvata ${savedAt}` : "Salva bozza"}
        </button>
      </div>

      <StepBar active={3} />

      <div style={{ maxWidth: 1040, margin: "28px auto", padding: "0 24px 120px" }}>
        <div style={{ background: "#fff", borderRadius: 10, border: "1px solid #e5e7eb", padding: "28px 32px" }}>
          <h2 style={{ fontSize: "1.1rem", fontWeight: 700, color: "#1e293b", margin: "0 0 4px" }}>Sezione 4 — Certificazioni, accreditamenti e allegati</h2>
          <p style={{ fontSize: "0.82rem", color: MUTED, margin: 0 }}>Per ogni certificazione indica se è presente. Se sì, fornisci i dettagli. Carica gli allegati obbligatori.</p>
          <div style={{ height: 1, background: "#f3f4f6", margin: "16px 0 4px" }} />

          {/* Certificazioni ISO */}
          <SectionLabel label="Certificazioni" />
          {CERTS_ISO.map(c => {
            const rec = certs[c.key];
            const certErr = errors[`cert_${c.key}`];
            const enteErr = errors[`cert_${c.key}_ente`];
            const scadErr = errors[`cert_${c.key}_scad`];
            return (
              <div key={c.key} style={{ border: `1px solid ${rec.presente === "si" ? GREEN + "60" : "#e5e7eb"}`, borderRadius: 8, padding: "16px 20px", marginBottom: 12 }}>
                <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 16 }}>
                  <div>
                    <div style={{ fontWeight: 700, fontSize: "0.9rem", color: "#1e293b" }}>{c.label}</div>
                    <div style={{ fontSize: "0.76rem", color: MUTED }}>{c.desc}</div>
                  </div>
                  <div style={{ display: "flex", gap: 8, flexShrink: 0 }}>
                    {(["si","no"] as const).map(v => (
                      <label key={v} style={{ display: "flex", alignItems: "center", gap: 5, cursor: "pointer", padding: "5px 12px", borderRadius: 6, border: `1.5px solid ${rec.presente === v ? GREEN : "#e5e7eb"}`, background: rec.presente === v ? `${GREEN}0d` : "#fff", fontSize: "0.82rem", fontWeight: 600 }}>
                        <input type="radio" name={`cert_${c.key}`} value={v} checked={rec.presente === v} onChange={() => updateCert(c.key, "presente", v)} style={{ accentColor: GREEN }} />
                        {v === "si" ? "Sì" : "No"}
                      </label>
                    ))}
                  </div>
                </div>
                {certErr ? <div style={{ fontSize: "0.74rem", color: ERR, marginTop: 6 }}>{certErr}</div> : null}

                {rec.presente === "si" ? (
                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 14, marginTop: 14 }}>
                    <div style={col}>
                      <span style={lbl}>Ente certificatore <span style={{ color: ERR }}>*</span></span>
                      <input value={rec.enteCertificatore} onChange={e => updateCert(c.key, "enteCertificatore", e.target.value)} placeholder="Es. Bureau Veritas, DNV GL..." style={baseInput(!!enteErr)} />
                      {enteErr ? <span style={errTxt}>{enteErr}</span> : null}
                    </div>
                    <div style={col}>
                      <span style={lbl}>Scadenza certificato <span style={{ color: ERR }}>*</span></span>
                      <input value={rec.scadenza} onChange={e => updateCert(c.key, "scadenza", e.target.value)} placeholder="MM/AAAA" style={baseInput(!!scadErr)} />
                      {scadErr ? <span style={errTxt}>{scadErr}</span> : null}
                    </div>
                    <FileInput label="Certificato PDF" fileName={rec.fileName} onChange={e => { const f = e.target.files?.[0]; if (f) updateCert(c.key, "fileName", f.name); }} hintText="PDF max 5 MB" />
                  </div>
                ) : null}
              </div>
            );
          })}

          {/* Altre certificazioni */}
          <div style={{ marginBottom: 20 }}>
            <span style={lbl}>Altre certificazioni di settore <span style={{ fontWeight: 400, color: MUTED }}>(opzionale)</span></span>
            <textarea
              value={altreCert} onChange={e => setAltreCert(e.target.value)}
              rows={2} placeholder="Nome certificazione, ente rilasciante, anno, scadenza..."
              style={{ width: "100%", padding: "10px 12px", fontSize: "0.85rem", border: "1.5px solid #d1d5db", borderRadius: 6, outline: "none", boxSizing: "border-box", resize: "vertical", color: "#111827", lineHeight: 1.5, marginTop: 4 }}
            />
          </div>

          {/* Accreditamenti */}
          <SectionLabel label="Accreditamenti" />
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16, marginBottom: 16 }}>
            <div>
              <span style={lbl}>Accreditamento regionale per la formazione <span style={{ color: ERR }}>*</span></span>
              <div style={{ display: "flex", gap: 10, marginTop: 8 }}>
                {(["si","no"] as const).map(v => (
                  <label key={v} style={{ display: "flex", alignItems: "center", gap: 6, cursor: "pointer", padding: "7px 16px", borderRadius: 6, border: `1.5px solid ${accFormazione === v ? GREEN : "#e5e7eb"}`, background: accFormazione === v ? `${GREEN}0d` : "#fff", fontSize: "0.85rem", fontWeight: 600 }}>
                    <input type="radio" name="accFormazione" value={v} checked={accFormazione === v} onChange={() => setAccFormazione(v)} style={{ accentColor: GREEN }} />
                    {v === "si" ? "Sì" : "No"}
                  </label>
                ))}
              </div>
              {errors.accFormazione ? <div style={{ fontSize: "0.74rem", color: ERR, marginTop: 4 }}>{errors.accFormazione}</div> : null}
              {accFormazione === "si" ? (
                <div style={{ marginTop: 12, display: "flex", flexDirection: "column", gap: 10 }}>
                  <div style={col}>
                    <span style={lbl}>Regioni accreditate</span>
                    <input value={accRegioni} onChange={e => setAccRegioni(e.target.value)} placeholder="Es. Lombardia, Piemonte, Veneto..." style={baseInput()} />
                  </div>
                  <div style={col}>
                    <span style={lbl}>Tipo (professionale / continua / superiore)</span>
                    <input value={accTipo} onChange={e => setAccTipo(e.target.value)} placeholder="Es. Formazione professionale, Formazione continua..." style={baseInput()} />
                  </div>
                </div>
              ) : null}
            </div>
            <div>
              <span style={lbl}>Accreditamento servizi al lavoro (ANPAL/Regioni) <span style={{ color: ERR }}>*</span></span>
              <div style={{ display: "flex", gap: 10, marginTop: 8 }}>
                {(["si","no"] as const).map(v => (
                  <label key={v} style={{ display: "flex", alignItems: "center", gap: 6, cursor: "pointer", padding: "7px 16px", borderRadius: 6, border: `1.5px solid ${accLavoro === v ? GREEN : "#e5e7eb"}`, background: accLavoro === v ? `${GREEN}0d` : "#fff", fontSize: "0.85rem", fontWeight: 600 }}>
                    <input type="radio" name="accLavoro" value={v} checked={accLavoro === v} onChange={() => setAccLavoro(v)} style={{ accentColor: GREEN }} />
                    {v === "si" ? "Sì" : "No"}
                  </label>
                ))}
              </div>
              {errors.accLavoro ? <div style={{ fontSize: "0.74rem", color: ERR, marginTop: 4 }}>{errors.accLavoro}</div> : null}
              {accLavoro === "si" ? (
                <div style={{ marginTop: 12, background: "#f0fdf4", border: `1px solid ${GREEN}40`, borderRadius: 6, padding: "10px 14px", fontSize: "0.82rem", color: "#166534" }}>
                  ℹ Allega il provvedimento autorizzatorio nella sezione Allegati sottostante.
                </div>
              ) : null}
            </div>
          </div>

          {/* Allegati aziendali */}
          <SectionLabel label="Allegati aziendali" />
          <div style={{ background: "#fffbeb", border: "1px solid #f59e0b", borderRadius: 6, padding: "10px 14px", marginBottom: 16, fontSize: "0.82rem", color: "#92400e" }}>
            ⚠ La visura camerale e il DURC sono obbligatori. Il company profile è consigliato.
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16, marginBottom: 16 }}>
            <div style={col}>
              <FileInput label="Visura camerale ordinaria" required fileName={visura} onChange={handleFile(setVisura)} hintText="PDF max 5 MB" tooltip="emissione non anteriore a 6 mesi" />
              {errors.visura ? <span style={errTxt}>{errors.visura}</span> : null}
            </div>
            <FileInput label="Company profile / presentazione aziendale" fileName={companyProf} onChange={handleFile(setCompanyProf)} hintText="PDF max 10 MB — consigliato" />
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
            <div style={col}>
              <FileInput label="DURC — Documento Unico Regolarità Contributiva" required fileName={durc} onChange={handleFile(setDurc)} hintText="PDF max 5 MB" tooltip="validità 120 giorni" />
              {errors.durc ? <span style={errTxt}>{errors.durc}</span> : null}
            </div>
            <FileInput label="Certificati ISO e accreditamenti" fileName={certAlleg} onChange={handleFile(setCertAlleg)} hintText="PDF — un file per certificato (o archivio ZIP)" />
          </div>

          {/* Error summary */}
          {errorCount > 0 ? (
            <div style={{ background: "#fff5f5", border: "1px solid #fca5a5", borderRadius: 6, padding: "12px 16px", marginTop: 20 }}>
              <div style={{ fontSize: "0.82rem", fontWeight: 600, color: "#b91c1c" }}>⚠ {errorCount} {errorCount === 1 ? "campo richiede attenzione" : "campi richiedono attenzione"}</div>
            </div>
          ) : null}
        </div>
      </div>

      {/* Bottom nav */}
      <div style={{ background: "#fff", borderTop: "1px solid #e5e7eb", display: "flex", alignItems: "center", justifyContent: "space-between", padding: "14px 40px", position: "fixed", bottom: 0, left: 0, right: 0, zIndex: 10 }}>
        <Link to="/apply/albo-b/step/3" style={{ display: "flex", alignItems: "center", gap: 6, padding: "9px 20px", background: "#fff", border: `1.5px solid ${GREEN}`, borderRadius: 6, fontWeight: 600, fontSize: "0.85rem", color: GREEN, textDecoration: "none" }}>
          <ArrowLeft size={15} /> Sezione precedente
        </Link>
        <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 4 }}>
          <span style={{ fontSize: "0.78rem", color: MUTED }}>Avanzamento: <strong>80%</strong></span>
          <div style={{ width: 200, height: 4, background: "#e5e7eb", borderRadius: 2, overflow: "hidden" }}>
            <div style={{ width: "80%", height: "100%", background: GREEN, borderRadius: 2 }} />
          </div>
        </div>
        <button type="button" onClick={() => void handleNext()} style={{ display: "flex", alignItems: "center", gap: 6, padding: "9px 20px", background: GREEN, color: "#fff", border: "none", borderRadius: 6, fontWeight: 600, fontSize: "0.85rem", cursor: "pointer" }}>
          Sezione successiva <ArrowRight size={15} />
        </button>
      </div>
    </div>
  );
}
