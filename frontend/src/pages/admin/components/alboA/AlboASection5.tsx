import { ShieldCheck } from "lucide-react";
import { SectionCard } from "../shared/SectionCard";
import { BooleanChecklist } from "../shared/BooleanBadge";

type P = Record<string, unknown>;

function asBool(v: unknown): boolean | null {
  if (v === true || v === "true") return true;
  if (v === false || v === "false") return false;
  return null;
}

export function AlboASection5({ payload }: { payload: P | null }) {
  if (!payload) return (
    <SectionCard icon={<ShieldCheck className="h-5 w-5" />} title="Sezione 5 — Dichiarazioni e Consensi" accent="orange">
      <p className="profile-empty">Nessun dato disponibile per questa sezione.</p>
    </SectionCard>
  );

  return (
    <SectionCard icon={<ShieldCheck className="h-5 w-5" />} title="Sezione 5 — Dichiarazioni e Consensi" accent="orange">
      <BooleanChecklist items={[
        { label: "Assenza condanne penali ostative", value: asBool(payload.noCriminalConvictions) },
        { label: "Assenza conflitti di interesse", value: asBool(payload.noConflictOfInterest) },
        { label: "Veridicità delle informazioni dichiarate", value: asBool(payload.truthfulnessDeclaration) },
        { label: "Accettazione Privacy Policy", value: asBool(payload.privacyAccepted) },
        { label: "Accettazione Codice Etico", value: asBool(payload.ethicalCodeAccepted) },
        { label: "Accettazione standard qualità / ambiente / sicurezza", value: asBool(payload.qualityEnvSafetyAccepted) },
        { label: "Consenso trattamento dati per gestione Albo", value: asBool(payload.alboDataProcessingConsent) },
        { label: "Conformità D.Lgs. 81/2008 (attività in presenza)", value: asBool(payload.dlgs81ComplianceWhenInPresence) },
        { label: "Consenso comunicazioni commerciali", value: asBool(payload.marketingConsent), optional: true },
      ]} />
    </SectionCard>
  );
}
