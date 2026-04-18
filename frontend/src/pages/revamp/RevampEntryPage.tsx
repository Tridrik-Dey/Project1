import { ArrowRight, Building2, UserRound } from "lucide-react";
import { Link, useSearchParams } from "react-router-dom";
import { useI18n } from "../../i18n/I18nContext";
import { saveRevampOnboardingContext } from "../../utils/revampOnboarding";

export function RevampEntryPage() {
  const { t } = useI18n();
  const [searchParams] = useSearchParams();
  const inviteToken = searchParams.get("token")?.trim();
  const inviteRegistry = searchParams.get("registryType")?.trim().toUpperCase();

  if (inviteToken && (inviteRegistry === "ALBO_A" || inviteRegistry === "ALBO_B")) {
    saveRevampOnboardingContext({
      registryType: inviteRegistry as "ALBO_A" | "ALBO_B",
      sourceChannel: "INVITE",
      inviteToken
    });
  }

  return (
    <section className="stack">
      <div className="panel">
        <h2>{t("revamp.entry.title")}</h2>
        <p className="subtle">{t("revamp.entry.subtitle")}</p>
      </div>

      <div className="home-role-grid">
        <article className="panel home-role-card home-role-card-supplier">
          <div className="home-role-head">
            <span className="home-role-icon-badge" aria-hidden="true">
              <UserRound className="h-4 w-4" />
            </span>
            <h3>{t("revamp.entry.alboA.title")}</h3>
          </div>
          <p>{t("revamp.entry.alboA.description")}</p>
          <Link className="home-inline-link home-inline-link-supplier" to="/apply/albo-a">
            <span>{t("revamp.entry.continue")}</span>
            <ArrowRight className="h-4 w-4" />
          </Link>
        </article>

        <article className="panel home-role-card home-role-card-admin">
          <div className="home-role-head">
            <span className="home-role-icon-badge" aria-hidden="true">
              <Building2 className="h-4 w-4" />
            </span>
            <h3>{t("revamp.entry.alboB.title")}</h3>
          </div>
          <p>{t("revamp.entry.alboB.description")}</p>
          <Link className="home-inline-link home-inline-link-admin" to="/apply/albo-b">
            <span>{t("revamp.entry.continue")}</span>
            <ArrowRight className="h-4 w-4" />
          </Link>
        </article>
      </div>
    </section>
  );
}

