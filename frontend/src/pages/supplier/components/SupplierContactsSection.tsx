import { useMemo, type FormEvent } from "react";
import { AtSign, BadgeCheck, Briefcase, Mail, Phone, PhoneCall, Save, ShieldCheck, UserPlus, UserRound, UserSquare2 } from "lucide-react";
import { PHONE_COUNTRY_PREFIXES } from "../../../constants/options";
import type { SupplierProfileResponse } from "../../../types/api";
import type { SupplierContactRequest } from "../../../types/forms";
import type { SupplierDashboardT } from "../hooks/useSupplierDashboard";

type SupplierContactsSectionProps = {
  t: SupplierDashboardT;
  language: "it" | "en";
  isEditable: boolean;
  sectionDone: boolean;
  sectionProgress: string;
  hasUnsavedChanges: boolean;
  canAddContact: boolean;
  canSaveSection: boolean;
  availableContactTypes: string[];
  principalAlreadyAssigned: boolean;
  getContactInputClass: (fieldKey: string) => string;
  clearContactInvalidField: (fieldKey: string) => void;
  profile: SupplierProfileResponse | null;
  contactForm: SupplierContactRequest;
  setContactForm: React.Dispatch<React.SetStateAction<SupplierContactRequest>>;
  contactCountryCode: string;
  setContactCountryCode: React.Dispatch<React.SetStateAction<string>>;
  contactPhoneNumber: string;
  setContactPhoneNumber: React.Dispatch<React.SetStateAction<string>>;
  onAddContact: (event: FormEvent<HTMLFormElement>) => Promise<void>;
  onSaveContactsSection: () => void;
  onDeleteContact: (contactId: string) => Promise<void>;
};

export function SupplierContactsSection({
  t,
  language,
  isEditable,
  sectionDone,
  sectionProgress,
  hasUnsavedChanges,
  canAddContact,
  canSaveSection,
  availableContactTypes,
  principalAlreadyAssigned,
  getContactInputClass,
  clearContactInvalidField,
  profile,
  contactForm,
  setContactForm,
  contactCountryCode,
  setContactCountryCode,
  contactPhoneNumber,
  setContactPhoneNumber,
  onAddContact,
  onSaveContactsSection,
  onDeleteContact
}: SupplierContactsSectionProps) {
  const contacts = profile?.contacts ?? [];
  const phonePreview = contactPhoneNumber ? `${contactCountryCode} ${contactPhoneNumber}` : contactCountryCode;
  const contactTypeLabelKey: Record<string, string> = {
    PRIMARY: "option.contactType.primary",
    SECONDARY: "option.contactType.secondary",
    FINANCE: "option.contactType.finance",
    TECHNICAL: "option.contactType.technical"
  };
  const displayContactType = (value?: string) => {
    if (!value) return "";
    const key = contactTypeLabelKey[(value ?? "").toUpperCase()];
    return key ? t(key) : value;
  };
  const prefixOptions = useMemo(() => {
    const locale = language === "it" ? "it" : "en";
    const names = new Intl.DisplayNames([locale], { type: "region" });
    return PHONE_COUNTRY_PREFIXES
      .map(({ countryCode, dialCode }) => ({
        countryCode,
        dialCode,
        label: `${names.of(countryCode) ?? countryCode} (${dialCode})`
      }))
      .sort((a, b) => a.label.localeCompare(b.label, locale));
  }, [language]);

  return (
    <section className="panel supplier-contacts-panel">
      <div className="supplier-section-head">
        <h3>{t("supplier.contacts.title")}</h3>
        <div className="supplier-section-meta">
          <span className="supplier-section-progress">{sectionProgress}</span>
          {hasUnsavedChanges ? <span className="supplier-section-unsaved">{t("supplier.section.unsaved")}</span> : null}
          <span className={`supplier-section-chip ${sectionDone ? "complete" : "pending"}`}>
            {sectionDone ? t("supplier.section.complete") : t("supplier.section.pending")}
          </span>
        </div>
      </div>
      <div className="supplier-contacts-layout">
        <div className="supplier-contacts-editor">
          <div className="supplier-contacts-subhead">
            <strong>{t("supplier.contacts.add")}</strong>
            {hasUnsavedChanges ? <span className="supplier-section-unsaved">{t("supplier.section.unsaved")}</span> : null}
          </div>
          <form className="grid-form supplier-contacts-form" onSubmit={(event) => void onAddContact(event)}>
            <label className={`floating-field ${contactForm.fullName ? "has-value" : ""}`}>
              <UserRound className="floating-field-icon" />
              <input className={`floating-input ${getContactInputClass("fullName")}`} disabled={!isEditable} value={contactForm.fullName} placeholder=" " onChange={(e) => { clearContactInvalidField("fullName"); setContactForm((p) => ({ ...p, fullName: e.target.value })); }} />
              <span className="floating-field-label">{t("field.fullName")}</span>
            </label>
            <label className={`floating-field ${contactForm.email ? "has-value" : ""}`}>
              <Mail className="floating-field-icon" />
              <input className={`floating-input ${getContactInputClass("email")}`} disabled={!isEditable} type="email" value={contactForm.email ?? ""} placeholder="nome@azienda.it" onChange={(e) => { clearContactInvalidField("email"); setContactForm((p) => ({ ...p, email: e.target.value })); }} />
              <span className="floating-field-label">{t("field.email")}</span>
            </label>
            <label className={`floating-field ${contactForm.contactType ? "has-value" : ""}`}>
              <UserSquare2 className="floating-field-icon" />
              <select
                className={`floating-input ${getContactInputClass("contactType")}`}
                disabled={!isEditable || !availableContactTypes.length}
                value={contactForm.contactType}
                onChange={(e) => {
                  clearContactInvalidField("contactType");
                  setContactForm((p) => ({ ...p, contactType: e.target.value }));
                }}
              >
                <option value="">{t("supplier.contacts.typePlaceholder")}</option>
                {availableContactTypes.map((v) => <option key={v} value={v}>{displayContactType(v)}</option>)}
              </select>
              <span className="floating-field-label">{t("field.type")}</span>
            </label>
            <label className={`floating-field ${contactForm.jobTitle ? "has-value" : ""}`}>
              <Briefcase className="floating-field-icon" />
              <input className="floating-input" disabled={!isEditable} value={contactForm.jobTitle ?? ""} placeholder=" " onChange={(e) => setContactForm((p) => ({ ...p, jobTitle: e.target.value }))} />
              <span className="floating-field-label">{t("field.jobTitle")}</span>
            </label>
            <label className={`floating-field ${contactCountryCode ? "has-value" : ""}`}>
              <AtSign className="floating-field-icon" />
              <select className="floating-input" disabled={!isEditable} value={contactCountryCode} onChange={(e) => setContactCountryCode(e.target.value)}>
                {prefixOptions.map((item) => (
                  <option key={`${item.countryCode}-${item.dialCode}`} value={item.dialCode}>
                    {item.label}
                  </option>
                ))}
              </select>
              <span className="floating-field-label">{t("field.countryCode")}</span>
            </label>
            <label className={`floating-field ${contactPhoneNumber ? "has-value" : ""}`}>
              <PhoneCall className="floating-field-icon" />
              <input className={`floating-input ${getContactInputClass("phoneNumber")}`} disabled={!isEditable} value={contactPhoneNumber} placeholder="3451234567" onChange={(e) => { clearContactInvalidField("phoneNumber"); setContactPhoneNumber(e.target.value.replace(/\D/g, "")); }} />
              <span className="floating-field-label">{t("field.phoneNumber")}</span>
            </label>
            <div className="supplier-contact-phone-preview">{phonePreview}</div>
            <label className="supplier-contact-primary-switch full">
              <input
                className="supplier-switch-input"
                disabled={!isEditable || principalAlreadyAssigned}
                type="checkbox"
                checked={contactForm.isPrimary}
                onChange={(e) => setContactForm((p) => ({ ...p, isPrimary: e.target.checked }))}
              />
              <span className="supplier-switch-slider" aria-hidden="true" />
              <span className="supplier-switch-label"><ShieldCheck className="h-4 w-4" /> {t("field.primaryContact")}</span>
              <span className={`supplier-switch-state ${contactForm.isPrimary ? "on" : "off"}`}>
                {contactForm.isPrimary
                  ? t("supplier.primaryContact.on")
                  : (principalAlreadyAssigned ? t("validation.contact.primary.unique") : t("supplier.primaryContact.off"))}
              </span>
            </label>
            <button className={`supplier-contacts-add-btn ${!canAddContact ? "is-locked" : ""}`} disabled={!isEditable || !canAddContact} type="submit">
              <UserPlus className="h-4 w-4" />
              {t("supplier.contacts.add")}
            </button>
            <button
              className={`supplier-contacts-save-btn ${!canSaveSection ? "is-locked" : ""}`}
              disabled={!isEditable}
              type="button"
              onClick={onSaveContactsSection}
            >
              <Save className="h-4 w-4" />
              {t("supplier.contacts.save")}
            </button>
          </form>
        </div>

        <div className="supplier-contacts-list-wrap">
          <div className="supplier-contacts-subhead">
            <strong>{t("supplier.contacts.title")} ({contacts.length})</strong>
          </div>
          <ul className="list supplier-contacts-list">
            {contacts.map((c) => (
              <li key={c.id} className="supplier-contact-row">
                <div className="supplier-contact-main">
                  <div className="supplier-contact-topline">
                    <span className="supplier-contact-name"><UserRound className="h-4 w-4" /> {c.fullName}</span>
                    <span className="supplier-contact-type-pill">{displayContactType(c.contactType)}</span>
                    {c.isPrimary ? <span className="supplier-contact-primary-pill"><BadgeCheck className="h-3.5 w-3.5" /> {t("common.primary")}</span> : null}
                  </div>
                  <div className="supplier-contact-subline">
                    <span><Mail className="h-3.5 w-3.5" /> {c.email ?? t("common.noEmail")}</span>
                    <span><Phone className="h-3.5 w-3.5" /> {c.phone ?? t("common.noPhone")}</span>
                  </div>
                </div>
                <button className="supplier-contacts-remove-btn" disabled={!isEditable} onClick={() => void onDeleteContact(c.id)}>{t("supplier.contacts.remove")}</button>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </section>
  );
}
