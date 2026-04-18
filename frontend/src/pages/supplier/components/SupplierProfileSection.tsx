import type { FormEvent } from "react";
import {
  AlignLeft,
  BarChart3,
  Building2,
  CalendarDays,
  FileText,
  Flag,
  Globe2,
  Hash,
  MapPin,
  MapPinned,
  MapPlus,
  Map,
  Tags,
  Users
} from "lucide-react";
import {
  ANNUAL_REVENUE_RANGES,
  COMPANY_TYPES,
  EMPLOYEE_COUNT_RANGES
} from "../../../constants/options";
import type { SupplierProfileRequest } from "../../../types/forms";
import type { SupplierDashboardT } from "../hooks/useSupplierDashboard";
import { SupplierDatePickerField } from "./SupplierDatePickerField";

type SupplierProfileSectionProps = {
  t: SupplierDashboardT;
  isEditable: boolean;
  profileForm: SupplierProfileRequest;
  sectionDone: boolean;
  sectionProgress: string;
  hasUnsavedChanges: boolean;
  canSave: boolean;
  getInputClass: (fieldKey: string) => string;
  updateProfileField: <K extends keyof SupplierProfileRequest>(key: K, value: SupplierProfileRequest[K]) => void;
  onSaveProfile: (event: FormEvent<HTMLFormElement>) => Promise<void>;
};

export function SupplierProfileSection({
  t,
  isEditable,
  profileForm,
  sectionDone,
  sectionProgress,
  hasUnsavedChanges,
  canSave,
  getInputClass,
  updateProfileField,
  onSaveProfile
}: SupplierProfileSectionProps) {
  const todayIso = new Date().toISOString().slice(0, 10);
  const companyTypeLabelKey: Record<(typeof COMPANY_TYPES)[number], string> = {
    LLC: "option.companyType.llc",
    SOLE_TRADER: "option.companyType.sole_trader",
    PARTNERSHIP: "option.companyType.partnership",
    CORPORATION: "option.companyType.corporation",
    NON_PROFIT: "option.companyType.non_profit",
    OTHER: "option.companyType.other"
  };
  const employeeCountLabelKey: Record<(typeof EMPLOYEE_COUNT_RANGES)[number], string> = {
    MICRO: "option.employeeCount.micro",
    SMALL: "option.employeeCount.small",
    MEDIUM: "option.employeeCount.medium",
    LARGE: "option.employeeCount.large"
  };
  const annualRevenueLabelKey: Record<(typeof ANNUAL_REVENUE_RANGES)[number], string> = {
    UNDER_100K: "option.annualRevenue.under_100k",
    _100K_500K: "option.annualRevenue._100k_500k",
    _500K_1M: "option.annualRevenue._500k_1m",
    _1M_5M: "option.annualRevenue._1m_5m",
    ABOVE_5M: "option.annualRevenue.above_5m"
  };

  return (
    <form
      className="panel grid-form supplier-profile-form"
      onSubmit={(event) => void onSaveProfile(event)}
    >
      <div className="supplier-section-head">
        <h3>{t("supplier.profile.title")}</h3>
        <div className="supplier-section-meta">
          <span className="supplier-section-progress">{sectionProgress}</span>
          {hasUnsavedChanges ? <span className="supplier-section-unsaved">{t("supplier.section.unsaved")}</span> : null}
          <span className={`supplier-section-chip ${sectionDone ? "complete" : "pending"}`}>
            {sectionDone ? t("supplier.section.complete") : t("supplier.section.pending")}
          </span>
        </div>
      </div>
      <section className="full supplier-profile-group">
        <div className="supplier-profile-group-head">
          <h4>Identita Azienda</h4>
        </div>
        <div className="supplier-profile-group-grid supplier-profile-group-grid-spaced">
          <label className={`floating-field ${profileForm.companyName ? "has-value" : ""}`}>
            <Building2 className="floating-field-icon" />
            <input className={`floating-input ${getInputClass("companyName")}`} disabled={!isEditable} value={profileForm.companyName} placeholder=" " onChange={(e) => updateProfileField("companyName", e.target.value)} />
            <span className="floating-field-label">{t("field.companyName")}</span>
          </label>
          <label className={`floating-field ${profileForm.country ? "has-value" : ""}`}>
            <Flag className="floating-field-icon" />
            <input className={`floating-input ${getInputClass("country")}`} disabled={!isEditable} value={profileForm.country} placeholder=" " onChange={(e) => updateProfileField("country", e.target.value)} />
            <span className="floating-field-label">{t("field.country")}</span>
          </label>
          <label className={`floating-field ${profileForm.tradingName ? "has-value" : ""}`}>
            <Building2 className="floating-field-icon" />
            <input className={`floating-input ${getInputClass("tradingName")}`} disabled={!isEditable} value={profileForm.tradingName ?? ""} placeholder=" " onChange={(e) => updateProfileField("tradingName", e.target.value)} />
            <span className="floating-field-label">{t("field.tradingName")}</span>
          </label>
          <label className={`floating-field ${profileForm.companyType ? "has-value" : ""}`}>
            <Tags className="floating-field-icon" />
            <select className={`floating-input ${getInputClass("companyType")}`} disabled={!isEditable} value={profileForm.companyType ?? ""} onChange={(e) => updateProfileField("companyType", e.target.value || undefined)}>
              <option value="">{t("common.select")}</option>
              {COMPANY_TYPES.map((v) => <option key={v} value={v}>{t(companyTypeLabelKey[v])}</option>)}
            </select>
            <span className="floating-field-label">{t("field.companyType")}</span>
          </label>
          <label className={`floating-field ${profileForm.website ? "has-value" : ""}`}>
            <Globe2 className="floating-field-icon" />
            <input className={`floating-input ${getInputClass("website")}`} disabled={!isEditable} value={profileForm.website ?? ""} placeholder="https://azienda.it" onChange={(e) => updateProfileField("website", e.target.value)} />
            <span className="floating-field-label">{t("field.website")}</span>
          </label>
        </div>
      </section>

      <section className="full supplier-profile-group">
        <div className="supplier-profile-group-head">
          <h4>Dati Legali</h4>
        </div>
        <div className="supplier-profile-group-grid supplier-profile-group-grid-spaced">
          <label className={`floating-field ${profileForm.registrationNumber ? "has-value" : ""}`}>
            <Hash className="floating-field-icon" />
            <input
              className={`floating-input ${getInputClass("registrationNumber")}`}
              disabled={!isEditable}
              title={t("field.hint.registrationNumber")}
              value={profileForm.registrationNumber ?? ""}
              placeholder=" "
              onChange={(e) => updateProfileField("registrationNumber", e.target.value)}
            />
            <span className="floating-field-label">{t("field.registrationNumber")}</span>
          </label>
          <label className={`floating-field ${profileForm.taxId ? "has-value" : ""}`}>
            <FileText className="floating-field-icon" />
            <input
              className={`floating-input ${getInputClass("taxId")}`}
              disabled={!isEditable}
              title={t("field.hint.taxId")}
              value={profileForm.taxId ?? ""}
              placeholder={t("field.hint.taxIdExample")}
              onChange={(e) => updateProfileField("taxId", e.target.value)}
            />
            <span className="floating-field-label">{t("field.taxId")}</span>
          </label>
          <label className={`floating-field ${profileForm.vatNumber ? "has-value" : ""}`}>
            <FileText className="floating-field-icon" />
            <input
              className={`floating-input ${getInputClass("vatNumber")}`}
              disabled={!isEditable}
              title={t("field.hint.vat")}
              value={profileForm.vatNumber ?? ""}
              placeholder={t("field.hint.vatExample")}
              onChange={(e) => updateProfileField("vatNumber", e.target.value)}
            />
            <span className="floating-field-label">{t("field.vatNumber")}</span>
          </label>
          <label className={`floating-field ${profileForm.countryOfIncorporation ? "has-value" : ""}`}>
            <Flag className="floating-field-icon" />
            <input className={`floating-input ${getInputClass("countryOfIncorporation")}`} disabled={!isEditable} value={profileForm.countryOfIncorporation ?? ""} placeholder=" " onChange={(e) => updateProfileField("countryOfIncorporation", e.target.value)} />
            <span className="floating-field-label">{t("field.countryOfIncorporation")}</span>
          </label>
          <label className={`floating-field ${profileForm.incorporationDate ? "has-value" : ""}`}>
            <CalendarDays className="floating-field-icon" />
            <SupplierDatePickerField
              t={t}
              value={profileForm.incorporationDate ?? ""}
              onChange={(next) => updateProfileField("incorporationDate", next || undefined)}
              disabled={!isEditable}
              maxDate={todayIso}
              className={`floating-input floating-input-date ${getInputClass("incorporationDate")}`}
            />
            <span className="floating-field-label">{t("field.incorporationDate")}</span>
          </label>
          <label className={`floating-field ${profileForm.employeeCountRange ? "has-value" : ""}`}>
            <Users className="floating-field-icon" />
            <select className={`floating-input ${getInputClass("employeeCountRange")}`} disabled={!isEditable} value={profileForm.employeeCountRange ?? ""} onChange={(e) => updateProfileField("employeeCountRange", e.target.value || undefined)}>
              <option value="">{t("common.select")}</option>
              {EMPLOYEE_COUNT_RANGES.map((v) => <option key={v} value={v}>{t(employeeCountLabelKey[v])}</option>)}
            </select>
            <span className="floating-field-label">{t("field.employeeCount")}</span>
          </label>
          <label className={`floating-field ${profileForm.annualRevenueRange ? "has-value" : ""}`}>
            <BarChart3 className="floating-field-icon" />
            <select className={`floating-input ${getInputClass("annualRevenueRange")}`} disabled={!isEditable} value={profileForm.annualRevenueRange ?? ""} onChange={(e) => updateProfileField("annualRevenueRange", e.target.value || undefined)}>
              <option value="">{t("common.select")}</option>
              {ANNUAL_REVENUE_RANGES.map((v) => <option key={v} value={v}>{t(annualRevenueLabelKey[v])}</option>)}
            </select>
            <span className="floating-field-label">{t("field.annualRevenue")}</span>
          </label>
        </div>
      </section>

      <section className="full supplier-profile-group">
        <div className="supplier-profile-group-head">
          <h4>Sede e Contatti</h4>
        </div>
        <div className="supplier-profile-group-grid">
          <label className={`floating-field ${profileForm.addressLine1 ? "has-value" : ""}`}>
            <MapPinned className="floating-field-icon" />
            <input className={`floating-input ${getInputClass("addressLine1")}`} disabled={!isEditable} value={profileForm.addressLine1 ?? ""} placeholder=" " onChange={(e) => updateProfileField("addressLine1", e.target.value)} />
            <span className="floating-field-label">{t("field.addressLine1")}</span>
          </label>
          <label className={`floating-field ${profileForm.addressLine2 ? "has-value" : ""}`}>
            <MapPlus className="floating-field-icon" />
            <input className={`floating-input ${getInputClass("addressLine2")}`} disabled={!isEditable} value={profileForm.addressLine2 ?? ""} placeholder=" " onChange={(e) => updateProfileField("addressLine2", e.target.value)} />
            <span className="floating-field-label">{t("field.addressLine2")}</span>
          </label>
          <label className={`floating-field ${profileForm.city ? "has-value" : ""}`}>
            <MapPin className="floating-field-icon" />
            <input className={`floating-input ${getInputClass("city")}`} disabled={!isEditable} value={profileForm.city ?? ""} placeholder=" " onChange={(e) => updateProfileField("city", e.target.value)} />
            <span className="floating-field-label">{t("field.city")}</span>
          </label>
          <label className={`floating-field ${profileForm.stateProvince ? "has-value" : ""}`}>
            <Map className="floating-field-icon" />
            <input className={`floating-input ${getInputClass("stateProvince")}`} disabled={!isEditable} value={profileForm.stateProvince ?? ""} placeholder=" " onChange={(e) => updateProfileField("stateProvince", e.target.value)} />
            <span className="floating-field-label">{t("field.stateProvince")}</span>
          </label>
          <label className={`floating-field ${profileForm.postalCode ? "has-value" : ""}`}>
            <Hash className="floating-field-icon" />
            <input className={`floating-input ${getInputClass("postalCode")}`} disabled={!isEditable} value={profileForm.postalCode ?? ""} placeholder=" " onChange={(e) => updateProfileField("postalCode", e.target.value)} />
            <span className="floating-field-label">{t("field.postalCode")}</span>
          </label>
          <label className={`full floating-field ${profileForm.description ? "has-value" : ""}`}>
            <AlignLeft className="floating-field-icon" />
            <textarea className="floating-input" disabled={!isEditable} rows={4} placeholder=" " value={profileForm.description ?? ""} onChange={(e) => updateProfileField("description", e.target.value)} />
            <span className="floating-field-label">{t("field.description")}</span>
          </label>
        </div>
      </section>

      <div className="full supplier-profile-actions">
        <button className={`supplier-profile-save-btn ${!canSave ? "is-locked" : ""}`} disabled={!isEditable} type="submit">{t("supplier.profile.save")}</button>
      </div>
    </form>
  );
}
