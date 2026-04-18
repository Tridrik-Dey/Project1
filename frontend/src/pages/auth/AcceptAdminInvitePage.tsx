import { FormEvent, useMemo, useState } from "react";
import { Link, Navigate, useNavigate, useSearchParams } from "react-router-dom";
import { acceptInvite } from "../../api/authApi";
import { HttpError } from "../../api/http";
import { useAuth } from "../../auth/AuthContext";

export function AcceptAdminInvitePage() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const { loginFromResponse } = useAuth();
  const token = useMemo(() => searchParams.get("token")?.trim() ?? "", [searchParams]);
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  if (!token) return <Navigate to="/login" replace />;

  async function onSubmit(event: FormEvent) {
    event.preventDefault();
    setError(null);
    if (busy) return;
    if (password.length < 8) {
      setError("La password deve avere almeno 8 caratteri.");
      return;
    }
    if (password !== confirmPassword) {
      setError("Le password non coincidono.");
      return;
    }
    setBusy(true);
    try {
      const response = await acceptInvite(token, password);
      loginFromResponse(response);
      navigate(response.role === "SUPPLIER" ? "/supplier/dashboard" : "/admin/dashboard", { replace: true });
    } catch (err) {
      const message = err instanceof HttpError ? err.message : "Attivazione invito non riuscita.";
      setError(message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="auth-page">
      <div className="auth-card">
        <h2>Attiva il tuo account</h2>
        <p className="subtle">Imposta la tua password per completare l&apos;attivazione.</p>
        <form className="stack" onSubmit={onSubmit}>
          <label className={`floating-field ${password ? "has-value" : ""}`}>
            <input
              className="floating-input auth-input"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder=" "
              required
            />
            <span className="floating-field-label">Password</span>
          </label>
          <label className={`floating-field ${confirmPassword ? "has-value" : ""}`}>
            <input
              className="floating-input auth-input"
              type="password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              placeholder=" "
              required
            />
            <span className="floating-field-label">Conferma password</span>
          </label>
          {error ? <p className="error">{error}</p> : null}
          <button className="home-btn home-btn-primary" type="submit" disabled={busy}>
            {busy ? "Attivazione..." : "Attiva account"}
          </button>
        </form>
        <p className="subtle register-footer">
          <Link to="/login">Torna al login</Link>
        </p>
      </div>
    </section>
  );
}
