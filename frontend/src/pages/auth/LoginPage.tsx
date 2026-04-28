import { FormEvent, useState } from "react";
import { Lock, LogIn, Mail } from "lucide-react";
import { Link, useNavigate } from "react-router-dom";
import { login } from "../../api/authApi";
import { HttpError } from "../../api/http";
import { useAuth } from "../../auth/AuthContext";
import { AppToast } from "../../components/ui/toast";
import { featureFlags } from "../../config/featureFlags";
import { useI18n } from "../../i18n/I18nContext";
import { isRevampEmailVerified, markRevampEmailVerified } from "../../utils/revampEmailVerification";

export function LoginPage() {
  const navigate = useNavigate();
  const { loginFromResponse } = useAuth();
  const { t } = useI18n();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [toast, setToast] = useState<{ message: string; type: "error" | "success" } | null>(null);
  const [loading, setLoading] = useState(false);

  function pushToast(message: string, type: "error" | "success" = "error") {
    setToast({ message, type });
  }

  function mapLoginErrorMessage(rawMessage: string): string {
    const normalized = rawMessage.toLowerCase();
    if (normalized.includes("email not found")) {
      return t("auth.login.emailAndPasswordWrong");
    }
    if (normalized.includes("wrong password")) {
      return t("auth.login.wrongPassword");
    }
    if (normalized.includes("bad credentials")) {
      return t("auth.login.badCredentials");
    }
    if (normalized.includes("account deactivated") || normalized.includes("user is inactive")) {
      return "Account disattivato. Contatta un Super Admin per riattivarlo.";
    }
    return rawMessage || t("auth.login.failed");
  }

  async function onSubmit(event: FormEvent) {
    event.preventDefault();
    setToast(null);
    setLoading(true);
    const normalizedEmail = email.trim();

    try {
      const response = await login({ email: normalizedEmail, password });
      loginFromResponse(response);
      if (response.role === "SUPPLIER" && featureFlags.newWizardAb) {
        if (!isRevampEmailVerified()) {
          markRevampEmailVerified(false);
          navigate("/verify-otp");
          return;
        }
      }
      if (response.role === "SUPPLIER") {
        navigate("/supplier");
      } else {
        navigate("/admin/dashboard");
      }
    } catch (err) {
      if (err instanceof HttpError) {
        pushToast(mapLoginErrorMessage(err.message));
      } else {
        pushToast(t("auth.login.failed"));
      }
    } finally {
      setLoading(false);
    }
  }

  return (
    <>
      {toast ? <AppToast toast={toast} onClose={() => setToast(null)} className="auth-toast" /> : null}
      <section className="panel auth-panel auth-access-panel">
        <h2>{t("auth.login.title")}</h2>
        <form onSubmit={onSubmit} className="grid-form auth-form">
          <label className={`floating-field ${email.trim() ? "has-value" : ""}`}>
            <Mail className="floating-field-icon" />
            <input
              className="floating-input auth-input"
              type="email"
              value={email}
              placeholder="nome@azienda.it"
              title={t("auth.email.invalid")}
              onInvalid={(e) => {
                const input = e.currentTarget;
                if (input.validity.valueMissing) {
                  input.setCustomValidity(t("validation.browser.required"));
                  return;
                }
                input.setCustomValidity(t("auth.email.invalid"));
              }}
              onChange={(e) => {
                e.currentTarget.setCustomValidity("");
                setEmail(e.target.value);
              }}
              required
            />
            <span className="floating-field-label">{t("auth.email")}</span>
          </label>
          <label className={`floating-field ${password ? "has-value" : ""}`}>
            <Lock className="floating-field-icon" />
            <input className="floating-input auth-input" type="password" value={password} placeholder=" " onChange={(e) => setPassword(e.target.value)} required />
            <span className="floating-field-label">{t("auth.password")}</span>
          </label>
          <button className={`auth-submit-btn ${loading ? "is-loading" : ""}`} disabled={loading} type="submit">
            <span className="auth-submit-btn-content">
              {loading ? <span className="auth-submit-spinner" aria-hidden="true" /> : <LogIn className="h-4 w-4" />}
              <span>{loading ? t("auth.login.loading") : t("auth.login.submit")}</span>
            </span>
          </button>
        </form>
        <p className="subtle auth-footer">{t("auth.noAccount")} <Link to="/register">{t("auth.registerSupplier")}</Link></p>
      </section>
    </>
  );
}
