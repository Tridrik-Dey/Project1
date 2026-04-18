import { FormEvent, useMemo, useState } from "react";
import { ArrowRight, Link as LinkIcon } from "lucide-react";
import { Link, Navigate, useNavigate, useParams } from "react-router-dom";
import { useI18n } from "../../i18n/I18nContext";
import { saveRevampOnboardingContext } from "../../utils/revampOnboarding";

type RegistryType = "ALBO_A" | "ALBO_B";

function toRegistryType(param?: string): RegistryType | null {
  if (!param) return null;
  const normalized = param.trim().toLowerCase();
  if (normalized === "albo-a") return "ALBO_A";
  if (normalized === "albo-b") return "ALBO_B";
  return null;
}

export function RevampRegistryStartPage() {
  const { t } = useI18n();
  const navigate = useNavigate();
  const { registryType: registryParam } = useParams();
  const [inviteToken, setInviteToken] = useState("");
  const registryType = useMemo(() => toRegistryType(registryParam), [registryParam]);

  if (!registryType) {
    return <Navigate to="/apply" replace />;
  }
  const resolvedRegistry: RegistryType = registryType;

  const registryLabel = resolvedRegistry === "ALBO_A" ? t("revamp.entry.alboA.title") : t("revamp.entry.alboB.title");

  function startPublicFlow() {
    saveRevampOnboardingContext({
      registryType: resolvedRegistry,
      sourceChannel: "PUBLIC"
    });
  }

  function startInviteFlow(event: FormEvent) {
    event.preventDefault();
    const token = inviteToken.trim();
    if (!token) return;
    saveRevampOnboardingContext({
      registryType: resolvedRegistry,
      sourceChannel: "INVITE",
      inviteToken: token
    });
    navigate(`/invite/${encodeURIComponent(token)}`);
  }

  function startInviteFlowFromLink() {
    const token = inviteToken.trim();
    if (!token) return;
    saveRevampOnboardingContext({
      registryType: resolvedRegistry,
      sourceChannel: "INVITE",
      inviteToken: token
    });
  }

  const inviteRegisterUrl = `/invite/${encodeURIComponent(inviteToken.trim())}`;
  const publicRegisterUrl = `/register?registryType=${resolvedRegistry}&sourceChannel=PUBLIC`;

  return (
    <section className="stack">
      <div className="panel">
        <h2>{registryLabel}</h2>
        <p className="subtle">{t("revamp.start.subtitle")}</p>
      </div>

      <div className="panel home-step-card">
        <div className="home-step-head">
          <span className="home-step-index">A</span>
          <h4>{t("revamp.start.public.title")}</h4>
        </div>
        <p>{t("revamp.start.public.description")}</p>
        <Link className="home-inline-link home-inline-link-supplier" to={publicRegisterUrl} onClick={startPublicFlow}>
          <span>{t("revamp.start.public.cta")}</span>
          <ArrowRight className="h-4 w-4" />
        </Link>
      </div>

      <div className="panel home-step-card">
        <div className="home-step-head">
          <span className="home-step-index">B</span>
          <h4>{t("revamp.start.invite.title")}</h4>
        </div>
        <p>{t("revamp.start.invite.description")}</p>
        <form onSubmit={startInviteFlow} className="grid-form">
          <label className="floating-field has-value">
            <LinkIcon className="floating-field-icon" />
            <input
              className="floating-input auth-input"
              value={inviteToken}
              onChange={(e) => setInviteToken(e.target.value)}
              placeholder={t("revamp.start.invite.placeholder")}
            />
            <span className="floating-field-label">{t("revamp.start.invite.tokenLabel")}</span>
          </label>
          <Link
            className="home-inline-link home-inline-link-admin"
            to={inviteToken.trim() ? inviteRegisterUrl : "#"}
            onClick={(e) => {
              if (!inviteToken.trim()) {
                e.preventDefault();
                return;
              }
              startInviteFlowFromLink();
            }}
          >
            <span>{t("revamp.start.invite.cta")}</span>
            <ArrowRight className="h-4 w-4" />
          </Link>
        </form>
      </div>
    </section>
  );
}

