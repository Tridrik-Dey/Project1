import { Lock } from "lucide-react";
import type { SupplierProfileResponse } from "../../../types/api";
import type { SupplierDashboardT } from "../hooks/useSupplierDashboard";

type SupplierDashboardHeroProps = {
  t: SupplierDashboardT;
  profile: SupplierProfileResponse | null;
  isEditable: boolean;
  error: string | null;
  notice: string | null;
};

export function SupplierDashboardHero({
  t,
  profile,
  isEditable,
  error,
  notice
}: SupplierDashboardHeroProps) {
  const status = (() => {
    const raw = profile?.status;
    if (!raw) return t("common.na");
    const key = `status.${raw.toLowerCase()}`;
    const translated = t(key);
    return translated === key ? raw.toUpperCase() : translated;
  })();

  return (
    <div className="panel supplier-hero">
      <div className="supplier-hero-top">
        <h2>{t("supplier.workspace")}</h2>
        <div className="supplier-hero-badges">
          <span className={`supplier-status-badge ${(profile?.status ?? "").toLowerCase()}`}>
            {status}
          </span>
          {!isEditable ? (
            <span className="supplier-lock-badge">
              <Lock className="h-3.5 w-3.5" />
              {t("supplier.locked.label")}
            </span>
          ) : null}
        </div>
      </div>
      {error ? <p className="error">{error}</p> : null}
      {notice ? <p className="success">{notice}</p> : null}
      {!isEditable ? <p className="supplier-hero-note">{t("supplier.locked.message")}</p> : null}
    </div>
  );
}
