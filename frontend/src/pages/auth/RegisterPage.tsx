import { FormEvent, useEffect, useRef, useState } from "react";
import { Lock, Mail, UserRound, UserPlus } from "lucide-react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { register } from "../../api/authApi";
import { HttpError } from "../../api/http";
import type { RevampRegistryType, RevampSourceChannel } from "../../api/revampApplicationApi";
import { useAuth } from "../../auth/AuthContext";
import { featureFlags } from "../../config/featureFlags";
import { AppToast } from "../../components/ui/toast";
import { useI18n } from "../../i18n/I18nContext";
import { saveRevampOnboardingContext } from "../../utils/revampOnboarding";
import { markRevampEmailVerified } from "../../utils/revampEmailVerification";
import { hasValidEmailDomainSuffix } from "../../validation/rules";

export function RegisterPage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { loginFromResponse } = useAuth();
  const { t } = useI18n();
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [toast, setToast] = useState<{ message: string; type: "error" | "success" } | null>(null);
  const [loading, setLoading] = useState(false);
  const emailInputRef = useRef<HTMLInputElement | null>(null);
  const inviteTokenFromQuery = searchParams.get("inviteToken")?.trim();
  const inviteIdFromQuery = searchParams.get("inviteId")?.trim();
  const invitedEmailFromQuery = searchParams.get("invitedEmail")?.trim();
  const sourceChannelFromQuery = searchParams.get("sourceChannel")?.trim().toUpperCase();
  const registryTypeFromQuery = searchParams.get("registryType")?.trim().toUpperCase();
  const inviteEmailLocked = sourceChannelFromQuery === "INVITE" && Boolean(invitedEmailFromQuery);

  function parseRegistryType(value?: string | null): RevampRegistryType | undefined {
    if (value === "ALBO_A" || value === "ALBO_B") return value;
    return undefined;
  }

  function parseSourceChannel(value?: string | null): RevampSourceChannel | undefined {
    if (value === "PUBLIC" || value === "INVITE") return value;
    return undefined;
  }

  useEffect(() => {
    if (!featureFlags.newWizardAb) return;
    const registryType = parseRegistryType(registryTypeFromQuery);
    const sourceChannel = parseSourceChannel(sourceChannelFromQuery);
    if (!registryType || !sourceChannel) return;

    saveRevampOnboardingContext({
      registryType,
      sourceChannel,
      inviteToken: inviteTokenFromQuery || undefined,
      inviteId: inviteIdFromQuery || undefined,
      invitedEmail: invitedEmailFromQuery || undefined
    });
  }, [inviteIdFromQuery, inviteTokenFromQuery, invitedEmailFromQuery, registryTypeFromQuery, sourceChannelFromQuery]);

  useEffect(() => {
    if (!inviteEmailLocked || !invitedEmailFromQuery) return;
    setEmail(invitedEmailFromQuery);
  }, [inviteEmailLocked, invitedEmailFromQuery]);

  function mapRegisterErrorMessage(rawMessage: string): string | null {
    const message = rawMessage.toLowerCase();
    if (message.includes("duplicate_email")) return t("validation.duplicate.email");
    if (message.includes("users_email_key") || message.includes("key (email)")) return t("validation.duplicate.email");
    if (message.includes("email already") || message.includes("email exists")) return t("validation.duplicate.email");
    return null;
  }

  async function onSubmit(event: FormEvent) {
    event.preventDefault();
    setError(null);
    setToast(null);

    const trimmedFullName = fullName.trim();
    const trimmedEmail = inviteEmailLocked && invitedEmailFromQuery
      ? invitedEmailFromQuery
      : email.trim();
    const namePattern = /^[A-Za-z\u00C0-\u00D6\u00D8-\u00F6\u00F8-\u00FF\s]+$/;

    if (!namePattern.test(trimmedFullName)) {
      setToast({ message: t("auth.fullName.invalid"), type: "error" });
      return;
    }

    if (emailInputRef.current) {
      emailInputRef.current.setCustomValidity("");
      if (!emailInputRef.current.checkValidity()) {
        emailInputRef.current.reportValidity();
        return;
      }
      if (!hasValidEmailDomainSuffix(trimmedEmail)) {
        emailInputRef.current.setCustomValidity(t("auth.email.invalid"));
        emailInputRef.current.reportValidity();
        return;
      }
    }

    setLoading(true);

    try {
      const response = await register({ fullName: trimmedFullName, email: trimmedEmail, password });
      loginFromResponse(response);
      markRevampEmailVerified(false);

      if (!featureFlags.newWizardAb) {
        navigate("/supplier");
        return;
      }
      navigate("/verify-otp");
      return;
    } catch (err) {
      if (err instanceof HttpError) {
        const normalized = err.message.toLowerCase();
        if (
          normalized.includes("domain suffix")
          || (normalized.includes("email") && normalized.includes("valid"))
          || normalized.includes("email must")
        ) {
          const message = t("auth.email.invalid");
          emailInputRef.current?.setCustomValidity(message);
          emailInputRef.current?.reportValidity();
          return;
        }
        const mapped = mapRegisterErrorMessage(err.message);
        if (mapped) {
          setError(mapped);
          setToast({ message: mapped, type: "error" });
          return;
        }
        setError(err.message);
        setToast({ message: err.message, type: "error" });
      } else setError(t("auth.register.failed"));
    } finally {
      setLoading(false);
    }
  }

  return (
    <section className="panel auth-panel auth-access-panel register-panel">
      {toast ? <AppToast toast={toast} onClose={() => setToast(null)} className="auth-toast" /> : null}
      <h2>{t("auth.register.title")}</h2>
      <form onSubmit={onSubmit} className="grid-form auth-form register-form">
        <label className={`floating-field ${fullName.trim() ? "has-value" : ""}`}>
          <UserRound className="floating-field-icon" />
          <input
            className="floating-input auth-input"
            value={fullName}
            placeholder=" "
            pattern="^[A-Za-z\u00C0-\u00D6\u00D8-\u00F6\u00F8-\u00FF\s]+$"
            title={t("auth.fullName.invalid")}
            onInvalid={(e) => {
              const input = e.currentTarget;
              if (input.validity.valueMissing) {
                input.setCustomValidity(t("validation.browser.required"));
                return;
              }
              input.setCustomValidity(t("auth.fullName.invalid"));
            }}
            onChange={(e) => {
              e.currentTarget.setCustomValidity("");
              setFullName(e.target.value);
            }}
            required
          />
          <span className="floating-field-label">{t("auth.fullName")}</span>
        </label>
        <label className={`floating-field ${email.trim() ? "has-value" : ""}`}>
          <Mail className="floating-field-icon" />
          <input
            className="floating-input auth-input"
            ref={emailInputRef}
            type="email"
            value={email}
            placeholder="nome@azienda.it"
            disabled={inviteEmailLocked}
            onInvalid={(e) => {
              const input = e.currentTarget;
              if (input.validity.valueMissing) {
                input.setCustomValidity(t("validation.browser.required"));
                return;
              }
              input.setCustomValidity(t("auth.email.invalid"));
            }}
            onChange={(e) => {
              if (inviteEmailLocked) return;
              e.currentTarget.setCustomValidity("");
              setEmail(e.target.value);
            }}
            pattern="^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+[.][A-Za-z]{2,}$"
            title={t("auth.email.invalid")}
            required
          />
          <span className="floating-field-label">{t("auth.email")}</span>
        </label>
        <label className={`floating-field register-password-field ${password ? "has-value" : ""}`}>
          <Lock className="floating-field-icon" />
          <input className="floating-input auth-input" type="password" value={password} placeholder=" " onChange={(e) => setPassword(e.target.value)} required />
          <span className="floating-field-label">{t("auth.password")}</span>
        </label>
        {error ? <p className="error register-error">{error}</p> : null}
        <button className={`auth-submit-btn register-submit-btn ${loading ? "is-loading" : ""}`} disabled={loading} type="submit">
          <span className="auth-submit-btn-content">
            {loading ? <span className="auth-submit-spinner" aria-hidden="true" /> : <UserPlus className="h-4 w-4" />}
            <span>{loading ? t("auth.register.loading") : t("auth.register.submit")}</span>
          </span>
        </button>
      </form>
      <p className="subtle register-footer">{t("auth.alreadyRegistered")} <Link to="/login">{t("auth.backToLogin")}</Link></p>
    </section>
  );
}
