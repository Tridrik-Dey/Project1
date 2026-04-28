import { UserCheck } from "lucide-react";
import { SectionCard, ProfileSubsection } from "../shared/SectionCard";
import { FieldGrid } from "../shared/FieldGrid";
import { TagList } from "../shared/TagList";

type P = Record<string, unknown>;

function str(v: unknown): string {
  if (typeof v === "string") return v.trim();
  return "";
}

function strArr(v: unknown): string[] {
  if (!Array.isArray(v)) return [];
  return v.map((item) => str(item)).filter(Boolean);
}

const YEARS_BAND: Record<string, string> = {
  LT_1: "Meno di 1 anno",
  Y1_3: "1–3 anni",
  Y3_5: "3–5 anni",
  Y5_10: "5–10 anni",
  Y10_15: "10–15 anni",
  GT_15: "Oltre 15 anni",
};

export function AlboASection3B({ payload }: { payload: P | null }) {
  if (!payload) return (
    <SectionCard icon={<UserCheck className="h-5 w-5" />} title="Sezione 3B — Altro Professionista" accent="teal">
      <p className="profile-empty">Nessun dato disponibile per questa sezione.</p>
    </SectionCard>
  );

  const services = strArr(payload.services);
  const specificCerts = strArr(payload.specificCertifications);
  const territory = payload.territory as P | null | undefined;
  const regions = strArr(territory?.regions);
  const provinces = strArr(territory?.provinces);

  return (
    <SectionCard icon={<UserCheck className="h-5 w-5" />} title="Sezione 3B — Altro Professionista" accent="teal">
      <FieldGrid fields={[
        { label: "Ordine professionale", value: str(payload.professionalOrder) },
        { label: "Titolo di studio", value: str(payload.highestTitle) },
        { label: "Ambito di studio", value: str(payload.studyArea) },
        { label: "Anni di esperienza", value: YEARS_BAND[str(payload.experienceBand)] ?? str(payload.experienceBand) },
        { label: "Tariffa oraria", value: str(payload.hourlyRateRange) },
      ]} />

      {services.length > 0 ? (
        <ProfileSubsection title="Servizi offerti">
          <TagList items={services} color="teal" />
        </ProfileSubsection>
      ) : null}

      {(regions.length > 0 || provinces.length > 0) ? (
        <ProfileSubsection title="Area territoriale">
          {regions.length > 0 ? <><p className="territory-label">Regioni</p><TagList items={regions} color="blue" /></> : null}
          {provinces.length > 0 ? <><p className="territory-label">Province</p><TagList items={provinces} color="blue" /></> : null}
        </ProfileSubsection>
      ) : null}

      {specificCerts.length > 0 ? (
        <ProfileSubsection title="Certificazioni specifiche">
          <TagList items={specificCerts} color="orange" />
        </ProfileSubsection>
      ) : null}
    </SectionCard>
  );
}
