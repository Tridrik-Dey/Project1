import { FormEvent, useEffect, useMemo, useState } from "react";
import { fetchCategoryTree } from "../../../api/categoryApi";
import { HttpError } from "../../../api/http";
import { CONTACT_TYPES, DOCUMENT_TYPES } from "../../../constants/options";
import {
  addSupplierContact,
  assignSupplierCategories,
  getSupplierDocuments,
  getSupplierProfile,
  removeSupplierContact,
  removeSupplierDocument,
  submitSupplierProfile,
  updateSupplierProfile,
  uploadSupplierDocument
} from "../../../api/supplierApi";
import { useAuth } from "../../../auth/AuthContext";
import { useI18n } from "../../../i18n/I18nContext";
import type { CategoryResponse, DocumentResponse, SupplierProfileResponse } from "../../../types/api";
import type { SupplierContactRequest, SupplierProfileRequest } from "../../../types/forms";
import {
  isItalianBusiness,
  isItalianRegistrationNumberValid,
  isItalianTaxIdValid,
  isItalianVatNumberValid
} from "../../../validation/rules";
import type { DocumentFormRow, InvalidSections, ToastState } from "../types";

export type SupplierDashboardT = (key: string, params?: Record<string, string | number>) => string;
type SupplierSection = "profile" | "categories" | "contacts" | "documents";
type ContactTypeValue = (typeof CONTACT_TYPES)[number];

type ValidateBeforeSubmitResult = { ok: boolean; message?: string };

export type UseSupplierDashboardResult = {
  t: SupplierDashboardT;
  language: "it" | "en";
  loading: boolean;
  isEditable: boolean;
  profile: SupplierProfileResponse | null;
  categories: CategoryResponse[];
  documents: DocumentResponse[];
  flatCategoryList: Array<{ id: string; label: string; code: string }>;
  selectedCategoryIds: string[];
  setSelectedCategoryIds: React.Dispatch<React.SetStateAction<string[]>>;
  error: string | null;
  notice: string | null;
  toast: ToastState;
  setToast: React.Dispatch<React.SetStateAction<ToastState>>;
  lastSuccessEvent: { section: SupplierSection; at: number } | null;
  invalidFields: Set<string>;
  invalidContactFields: Set<string>;
  invalidDocumentFields: Set<string>;
  invalidSections: InvalidSections;
  setInvalidSections: React.Dispatch<React.SetStateAction<InvalidSections>>;
  profileForm: SupplierProfileRequest;
  contactForm: SupplierContactRequest;
  setContactForm: React.Dispatch<React.SetStateAction<SupplierContactRequest>>;
  contactCountryCode: string;
  setContactCountryCode: React.Dispatch<React.SetStateAction<string>>;
  contactPhoneNumber: string;
  setContactPhoneNumber: React.Dispatch<React.SetStateAction<string>>;
  availableContactTypes: ContactTypeValue[];
  canAddContact: boolean;
  principalAlreadyAssigned: boolean;
  documentRows: DocumentFormRow[];
  updateProfileField: <K extends keyof SupplierProfileRequest>(key: K, value: SupplierProfileRequest[K]) => void;
  getInputClass: (fieldKey: string) => string;
  getContactInputClass: (fieldKey: string) => string;
  clearContactInvalidField: (fieldKey: string) => void;
  getDocumentInputClass: (rowId: string, fieldKey: "type" | "expiryDate" | "file") => string;
  addDocumentRow: () => void;
  removeDocumentRow: (id: string) => void;
  updateDocumentRow: (id: string, patch: Partial<DocumentFormRow>) => void;
  unlockDocumentRowForNewExpiry: (id: string) => void;
  saveProfile: (event: FormEvent<HTMLFormElement>) => Promise<void>;
  saveCategories: () => Promise<void>;
  addContact: (event: FormEvent<HTMLFormElement>) => Promise<void>;
  saveContactsSection: () => void;
  deleteContact: (contactId: string) => Promise<void>;
  deleteDocument: (documentId: string) => Promise<void>;
  uploadDocument: (event: FormEvent<HTMLFormElement>) => Promise<void>;
  submitProfileForReview: () => Promise<void>;
  getTodayIsoDate: () => string;
};

function getTodayIsoDate(): string {
  return new Date().toISOString().slice(0, 10);
}

function isPastIsoDate(dateValue?: string): boolean {
  if (!dateValue) return false;
  return dateValue < getTodayIsoDate();
}

function isFutureIsoDate(dateValue?: string): boolean {
  if (!dateValue) return false;
  return dateValue > getTodayIsoDate();
}

function mapDuplicateProfileErrorMessage(rawMessage: string, t: SupplierDashboardT): string | null {
  const message = rawMessage.toLowerCase();
  if (message.includes("duplicate_vat_number")) {
    return t("validation.duplicate.vatNumber");
  }
  if (message.includes("duplicate_tax_id")) {
    return t("validation.duplicate.taxId");
  }
  if (message.includes("duplicate_registration_number")) {
    return t("validation.duplicate.registrationNumber");
  }
  if (message.includes("duplicate_email")) {
    return t("validation.duplicate.email");
  }
  if (message.includes("data_integrity_violation")) {
    return t("validation.duplicate.generic");
  }

  if (!message.includes("duplicate key value") && !message.includes("unique constraint")) {
    return null;
  }

  if (message.includes("supplier_profiles_tax_id_key") || message.includes("key (tax_id)")) {
    return t("validation.duplicate.taxId");
  }
  if (message.includes("supplier_profiles_vat_number_key") || message.includes("key (vat_number)")) {
    return t("validation.duplicate.vatNumber");
  }
  if (message.includes("users_email_key") || message.includes("key (email)")) {
    return t("validation.duplicate.email");
  }
  if (message.includes("supplier_profiles_registration_number_key") || message.includes("key (registration_number)")) {
    return t("validation.duplicate.registrationNumber");
  }

  return t("validation.duplicate.generic");
}

function mapProfileErrorFields(rawMessage: string): Set<string> {
  const message = rawMessage.toLowerCase();
  const fields = new Set<string>();

  if (
    message.includes("duplicate_vat_number") ||
    message.includes("supplier_profiles_vat_number_key") ||
    message.includes("key (vat_number)") ||
    message.includes("vat")
  ) {
    fields.add("vatNumber");
  }

  if (
    message.includes("duplicate_tax_id") ||
    message.includes("supplier_profiles_tax_id_key") ||
    message.includes("key (tax_id)") ||
    message.includes("tax id") ||
    message.includes("tax_id")
  ) {
    fields.add("taxId");
  }

  if (
    message.includes("duplicate_registration_number") ||
    message.includes("supplier_profiles_registration_number_key") ||
    message.includes("key (registration_number)") ||
    message.includes("registration")
  ) {
    fields.add("registrationNumber");
  }

  return fields;
}

function mapContactAddErrorMessage(rawMessage: string, t: SupplierDashboardT): string | null {
  const message = rawMessage.toLowerCase();
  if (message.includes("contact type already exists")) {
    return t("validation.contact.type.unique");
  }
  if (message.includes("primary contact already exists")) {
    return t("validation.contact.primary.unique");
  }
  if (message.includes("maximum contacts reached")) {
    return t("validation.contact.maxReached");
  }
  return null;
}

function flattenCategories(tree: CategoryResponse[]): Array<{ id: string; label: string; code: string }> {
  const out: Array<{ id: string; label: string; code: string }> = [];
  function normalizeCategoryLabel(label: string): string {
    return label
      .replace(/all\?+ingrosso/gi, "all'ingrosso")
      .replace(/all[�â€™’]+ingrosso/gi, "all'ingrosso");
  }
  function categoryTypeFromCode(code?: string): string {
    if (!code) return "";
    const match = code.trim().toUpperCase().match(/[A-Z]/);
    return match ? match[0] : "";
  }

  function walk(nodes: CategoryResponse[], prefix: string) {
    for (const node of nodes) {
      const normalizedName = normalizeCategoryLabel(node.name ?? "");
      const categoryType = categoryTypeFromCode(node.code);
      const currentLabel = normalizedName;
      const label = prefix ? `${prefix} > ${currentLabel}` : currentLabel;
      out.push({ id: node.id, label, code: categoryType });
      if (node.children?.length) walk(node.children, label);
    }
  }

  walk(tree, "");
  return out;
}

export function useSupplierDashboard(): UseSupplierDashboardResult {
  const { auth } = useAuth();
  const { t, language } = useI18n();
  const token = auth?.token ?? "";

  const [profile, setProfile] = useState<SupplierProfileResponse | null>(null);
  const [categories, setCategories] = useState<CategoryResponse[]>([]);
  const [documents, setDocuments] = useState<DocumentResponse[]>([]);
  const [selectedCategoryIds, setSelectedCategoryIds] = useState<string[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [toast, setToast] = useState<ToastState>(null);
  const [lastSuccessEvent, setLastSuccessEvent] = useState<{ section: SupplierSection; at: number } | null>(null);
  const [invalidFields, setInvalidFields] = useState<Set<string>>(new Set());
  const [invalidContactFields, setInvalidContactFields] = useState<Set<string>>(new Set());
  const [invalidDocumentFields, setInvalidDocumentFields] = useState<Set<string>>(new Set());
  const [invalidSections, setInvalidSections] = useState<InvalidSections>({
    profile: false,
    categories: false,
    contacts: false,
    documents: false
  });
  const [loading, setLoading] = useState(true);

  const [profileForm, setProfileForm] = useState<SupplierProfileRequest>({
    companyName: "",
    country: "",
    preferredLanguage: "IT"
  });

  const [contactForm, setContactForm] = useState<SupplierContactRequest>({
    fullName: "",
    email: "",
    contactType: "",
    jobTitle: "",
    phone: "",
    isPrimary: false
  });
  const [contactCountryCode, setContactCountryCode] = useState<string>("+39");
  const [contactPhoneNumber, setContactPhoneNumber] = useState<string>("");

  const [documentRows, setDocumentRows] = useState<DocumentFormRow[]>([
    {
      id: "doc-1",
      type: "",
      expiryDate: "",
      notes: "",
      file: null,
      lockedType: false,
      lockedExpiry: false,
      excludedType: null
    }
  ]);

  const flatCategoryList = useMemo(() => flattenCategories(categories), [categories]);
  const usedContactTypes = useMemo(
    () => new Set((profile?.contacts ?? []).map((contact) => (contact.contactType ?? "").toUpperCase())),
    [profile?.contacts]
  );
  const availableContactTypes = useMemo<ContactTypeValue[]>(
    () => CONTACT_TYPES.filter((type) => !usedContactTypes.has(type)),
    [usedContactTypes]
  );
  const canAddContact = availableContactTypes.length > 0;
  const principalAlreadyAssigned = useMemo(
    () => (profile?.contacts ?? []).some((contact) => Boolean(contact.isPrimary)),
    [profile?.contacts]
  );

  function hydrateRowsWithDocuments(rows: DocumentFormRow[], docs: DocumentResponse[]): DocumentFormRow[] {
    return rows.map((row) => {
      const hasUploaded = docs.some((doc) => doc.documentType === row.type);
      return {
        ...row,
        // Once a type has at least one uploaded file, keep type locked.
        lockedType: hasUploaded ? true : (row.lockedType ?? false),
        // Expiry is locked after upload, and only unlocked via "+" action.
        lockedExpiry: hasUploaded ? (row.lockedExpiry ?? true) : false
      };
    });
  }

  useEffect(() => {
    async function loadData() {
      try {
        const [profileData, categoryData] = await Promise.all([
          getSupplierProfile(token),
          fetchCategoryTree(token, language)
        ]);
        setProfile(profileData);
        setCategories(categoryData);
        setSelectedCategoryIds(profileData.categories?.map((c) => c.id) ?? []);
        setProfileForm({
          companyName: profileData.companyName ?? "",
          preferredLanguage: profileData.preferredLanguage ?? (language === "en" ? "EN" : "IT"),
          tradingName: profileData.tradingName ?? "",
          companyType: profileData.companyType,
          registrationNumber: profileData.registrationNumber ?? "",
          vatNumber: profileData.vatNumber ?? "",
          taxId: (profileData.taxId ?? "").toUpperCase(),
          countryOfIncorporation: profileData.countryOfIncorporation ?? "",
          incorporationDate: profileData.incorporationDate,
          website: profileData.website ?? "",
          description: profileData.description ?? "",
          employeeCountRange: profileData.employeeCountRange,
          annualRevenueRange: profileData.annualRevenueRange,
          addressLine1: profileData.addressLine1 ?? "",
          addressLine2: profileData.addressLine2 ?? "",
          city: profileData.city ?? "",
          stateProvince: profileData.stateProvince ?? "",
          postalCode: profileData.postalCode ?? "",
          country: profileData.country ?? ""
        });
        const docs = await getSupplierDocuments(token, profileData.id);
        setDocuments(docs);
        setDocumentRows((prev) => hydrateRowsWithDocuments(prev, docs));
      } catch (err) {
        setError(err instanceof HttpError ? err.message : t("supplier.error.load"));
      } finally {
        setLoading(false);
      }
    }

    if (token) {
      void loadData();
    }
  }, [token, language, t]);

  useEffect(() => {
    const selectedContactType = (contactForm.contactType ?? "").toUpperCase();
    if (!selectedContactType) return;
    if (!availableContactTypes.some((type) => type === selectedContactType)) {
      setContactForm((prev) => ({ ...prev, contactType: "" }));
    }
  }, [availableContactTypes, contactForm.contactType]);

  useEffect(() => {
    if (!principalAlreadyAssigned) return;
    if (!contactForm.isPrimary) return;
    setContactForm((prev) => ({ ...prev, isPrimary: false }));
  }, [principalAlreadyAssigned, contactForm.isPrimary]);

  function updateProfileField<K extends keyof SupplierProfileRequest>(key: K, value: SupplierProfileRequest[K]) {
    const normalizedValue = key === "taxId" && typeof value === "string"
      ? value.toUpperCase()
      : value;
    setProfileForm((prev) => ({ ...prev, [key]: normalizedValue }));
    setInvalidFields((prev) => {
      const next = new Set(prev);
      next.delete(String(key));
      return next;
    });
  }

  function pushToast(message: string, type: "error" | "success" = "error") {
    setToast({ message, type });
  }

  function validateRequiredProfileFields(values: SupplierProfileRequest): string | null {
    const requiredChecks: Array<{ key: string; value: string | undefined }> = [
      { key: "field.companyName", value: values.companyName },
      { key: "field.country", value: values.country },
      { key: "field.tradingName", value: values.tradingName },
      { key: "field.companyType", value: values.companyType },
      { key: "field.registrationNumber", value: values.registrationNumber },
      { key: "field.taxId", value: values.taxId },
      { key: "field.vatNumber", value: values.vatNumber },
      { key: "field.countryOfIncorporation", value: values.countryOfIncorporation },
      { key: "field.incorporationDate", value: values.incorporationDate },
      { key: "field.website", value: values.website },
      { key: "field.employeeCount", value: values.employeeCountRange },
      { key: "field.annualRevenue", value: values.annualRevenueRange },
      { key: "field.addressLine1", value: values.addressLine1 },
      { key: "field.addressLine2", value: values.addressLine2 },
      { key: "field.city", value: values.city },
      { key: "field.stateProvince", value: values.stateProvince },
      { key: "field.postalCode", value: values.postalCode }
    ];
    const missing = requiredChecks.filter((item) => !(item.value ?? "").trim());
    if (missing.length === 0) return null;
    if (missing.length > 1) return t("validation.requiredFields.common");
    return t("validation.requiredField", { field: t(missing[0].key) });
  }

  function validateSupplierProfile(values: SupplierProfileRequest): string | null {
    if (!values.companyName.trim()) return t("validation.companyName.required");
    if (!values.country.trim()) return t("validation.country.required");
    if (isFutureIsoDate(values.incorporationDate)) return t("validation.incorporationDate.future");

    const italianBusiness = isItalianBusiness(values.country, values.countryOfIncorporation);
    if (!italianBusiness) return null;

    if (!(values.registrationNumber ?? "").trim()) return t("validation.it.registration.required");
    if (!isItalianRegistrationNumberValid(values.registrationNumber)) return t("validation.it.registration.invalid");

    if (!(values.taxId ?? "").trim()) return t("validation.it.taxId.required");
    if (!isItalianTaxIdValid(values.taxId)) return t("validation.it.taxId.invalid");

    if (!(values.vatNumber ?? "").trim()) return t("validation.it.vat.required");
    if (!isItalianVatNumberValid(values.vatNumber)) return t("validation.it.vat.invalid");

    return null;
  }

  function getInputClass(fieldKey: string): string {
    return invalidFields.has(fieldKey) ? "input-invalid" : "";
  }

  function getContactInputClass(fieldKey: string): string {
    return invalidContactFields.has(fieldKey) ? "input-invalid" : "";
  }

  function clearContactInvalidField(fieldKey: string) {
    setInvalidContactFields((prev) => {
      if (!prev.has(fieldKey)) return prev;
      const next = new Set(prev);
      next.delete(fieldKey);
      return next;
    });
  }

  function getDocumentInputClass(rowId: string, fieldKey: "type" | "expiryDate" | "file"): string {
    return invalidDocumentFields.has(`${rowId}:${fieldKey}`) ? "input-invalid" : "";
  }

  function addDocumentRow() {
    const usedTypes = new Set(documentRows.map((row) => row.type));
    const firstAvailableType = DOCUMENT_TYPES.find((docType) => !usedTypes.has(docType)) ?? DOCUMENT_TYPES[0];

    setDocumentRows((prev) => [
      ...prev,
      {
        id: `doc-${Date.now()}-${prev.length + 1}`,
        type: firstAvailableType,
        expiryDate: "",
        notes: "",
        file: null,
        lockedType: false,
        lockedExpiry: false,
        excludedType: null
      }
    ]);
  }

  function removeDocumentRow(id: string) {
    setDocumentRows((prev) => (prev.length <= 1 ? prev : prev.filter((row) => row.id !== id)));
    setInvalidDocumentFields((prev) => {
      const next = new Set(prev);
      for (const key of Array.from(next)) {
        if (key.startsWith(`${id}:`)) next.delete(key);
      }
      return next;
    });
  }

  function updateDocumentRow(id: string, patch: Partial<DocumentFormRow>) {
    setDocumentRows((prev) => prev.map((row) => (row.id === id ? { ...row, ...patch } : row)));
    if (Object.keys(patch).length > 0) {
      setInvalidDocumentFields((prev) => {
        const next = new Set(prev);
        if (patch.type !== undefined) next.delete(`${id}:type`);
        if (patch.expiryDate !== undefined) next.delete(`${id}:expiryDate`);
        if (patch.file !== undefined) next.delete(`${id}:file`);
        return next;
      });
    }
  }

  function unlockDocumentRowForNewExpiry(id: string) {
    setDocumentRows((prev) => prev.map((row) => (
      row.id === id
        ? {
            ...row,
            expiryDate: "",
            notes: "",
            file: null,
            lockedExpiry: false
          }
        : row
    )));
    setInvalidDocumentFields((prev) => {
      const next = new Set(prev);
      next.delete(`${id}:expiryDate`);
      next.delete(`${id}:file`);
      return next;
    });
  }

  function validateBeforeSubmit(
    validationProfile?: SupplierProfileResponse | null,
    validationDocuments?: DocumentResponse[]
  ): ValidateBeforeSubmitResult {
    const profileData = validationProfile ?? profile;
    const docsData = validationDocuments ?? documents;
    const requiredProfileFields: Array<keyof SupplierProfileRequest> = [
      "companyName",
      "country",
      "tradingName",
      "companyType",
      "registrationNumber",
      "taxId",
      "vatNumber",
      "countryOfIncorporation",
      "incorporationDate",
      "website",
      "employeeCountRange",
      "annualRevenueRange",
      "addressLine1",
      "addressLine2",
      "city",
      "stateProvince",
      "postalCode"
    ];

    const nextInvalidFields = new Set<string>();
    const nextInvalidSections: InvalidSections = { profile: false, categories: false, contacts: false, documents: false };

    for (const field of requiredProfileFields) {
      const value = profileForm[field];
      if (!(value ?? "").toString().trim()) {
        nextInvalidFields.add(String(field));
        nextInvalidSections.profile = true;
      }
    }

    const italy = isItalianBusiness(profileForm.country, profileForm.countryOfIncorporation);
    if (italy) {
      if (!isItalianRegistrationNumberValid(profileForm.registrationNumber)) nextInvalidFields.add("registrationNumber");
      if (!isItalianTaxIdValid(profileForm.taxId)) nextInvalidFields.add("taxId");
      if (!isItalianVatNumberValid(profileForm.vatNumber)) nextInvalidFields.add("vatNumber");
      if (nextInvalidFields.has("registrationNumber") || nextInvalidFields.has("taxId") || nextInvalidFields.has("vatNumber")) {
        nextInvalidSections.profile = true;
      }
    }
    if (isFutureIsoDate(profileForm.incorporationDate)) {
      nextInvalidFields.add("incorporationDate");
      nextInvalidSections.profile = true;
    }

    const persistedCategories = profileData?.categories?.length ?? 0;
    if (!selectedCategoryIds.length && persistedCategories === 0) {
      nextInvalidSections.categories = true;
    }

    const contacts = profileData?.contacts ?? [];
    if (!contacts.length) {
      nextInvalidSections.contacts = true;
    } else {
      const hasInvalidContact = contacts.some((c) => !(c.email ?? "").trim() || !(c.phone ?? "").trim());
      if (hasInvalidContact) {
        nextInvalidSections.contacts = true;
      }
    }

    if (!docsData.length) {
      nextInvalidSections.documents = true;
    }

    setInvalidFields(nextInvalidFields);
    setInvalidSections(nextInvalidSections);

    if (
      nextInvalidFields.size > 0 ||
      nextInvalidSections.categories ||
      nextInvalidSections.contacts ||
      nextInvalidSections.documents
    ) {
      return { ok: false, message: t("supplier.submit.incomplete") };
    }

    return { ok: true };
  }

  async function saveProfile(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setNotice(null);
    if (!profile || !["DRAFT", "NEEDS_REVISION"].includes(profile.status)) {
      const message = t("supplier.error.locked");
      setError(message);
      pushToast(message);
      return;
    }
    const requiredValidation = validateRequiredProfileFields(profileForm);
    if (requiredValidation) {
      const requiredFields: Array<keyof SupplierProfileRequest> = [
        "companyName",
        "country",
        "tradingName",
        "companyType",
        "registrationNumber",
        "taxId",
        "vatNumber",
        "countryOfIncorporation",
        "incorporationDate",
        "website",
        "employeeCountRange",
        "annualRevenueRange",
        "addressLine1",
        "addressLine2",
        "city",
        "stateProvince",
        "postalCode"
      ];
      const missingFields = new Set<string>();
      for (const field of requiredFields) {
        if (!(profileForm[field] ?? "").toString().trim()) missingFields.add(String(field));
      }
      setInvalidFields(missingFields);
      setInvalidSections((prev) => ({ ...prev, profile: true }));
      setError(requiredValidation);
      pushToast(requiredValidation);
      return;
    }
    const validationMessage = validateSupplierProfile(profileForm);
    if (validationMessage) {
      const nextInvalidFields = new Set<string>();
      if (isFutureIsoDate(profileForm.incorporationDate)) nextInvalidFields.add("incorporationDate");
      const italianBusiness = isItalianBusiness(profileForm.country, profileForm.countryOfIncorporation);
      if (italianBusiness) {
        if (!isItalianRegistrationNumberValid(profileForm.registrationNumber)) nextInvalidFields.add("registrationNumber");
        if (!isItalianTaxIdValid(profileForm.taxId)) nextInvalidFields.add("taxId");
        if (!isItalianVatNumberValid(profileForm.vatNumber)) nextInvalidFields.add("vatNumber");
      }
      if (nextInvalidFields.size > 0) {
        setInvalidFields(nextInvalidFields);
      }
      setInvalidSections((prev) => ({ ...prev, profile: true }));
      setError(validationMessage);
      pushToast(validationMessage);
      return;
    }

    try {
      const updated = await updateSupplierProfile(token, {
        ...profileForm,
        preferredLanguage: language === "en" ? "EN" : "IT"
      });
      setProfile(updated);
      setInvalidFields(new Set());
      setInvalidSections((prev) => ({ ...prev, profile: false }));
      const message = t("supplier.notice.profileSaved");
      setNotice(message);
      pushToast(message, "success");
      setLastSuccessEvent({ section: "profile", at: Date.now() });
    } catch (err) {
      if (err instanceof HttpError) {
        const mappedFields = mapProfileErrorFields(err.message);
        if (mappedFields.size > 0) {
          setInvalidFields(mappedFields);
          setInvalidSections((prev) => ({ ...prev, profile: true }));
        }
        const duplicateMessage = mapDuplicateProfileErrorMessage(err.message, t);
        if (duplicateMessage) {
          setError(null);
          pushToast(duplicateMessage);
          return;
        }
        setError(err.message);
        return;
      }
      setError(t("supplier.error.profile"));
    }
  }

  async function saveCategories() {
    setError(null);
    setNotice(null);
    setInvalidSections((prev) => ({ ...prev, categories: false }));
    if (!profile || !["DRAFT", "NEEDS_REVISION"].includes(profile.status)) {
      const message = t("supplier.error.locked");
      setError(message);
      pushToast(message);
      return;
    }
    if (!selectedCategoryIds.length) {
      const message = t("validation.category.required");
      setInvalidSections((prev) => ({ ...prev, categories: true }));
      setError(message);
      pushToast(message);
      return;
    }

    try {
      const updated = await assignSupplierCategories(token, selectedCategoryIds);
      setProfile(updated);
      const message = t("supplier.notice.categoriesSaved");
      setNotice(message);
      pushToast(message, "success");
      setLastSuccessEvent({ section: "categories", at: Date.now() });
    } catch (err) {
      setError(err instanceof HttpError ? err.message : t("supplier.error.categories"));
    }
  }

  async function addContact(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setNotice(null);
    if (!profile || !["DRAFT", "NEEDS_REVISION"].includes(profile.status)) {
      const message = t("supplier.error.locked");
      setError(message);
      pushToast(message);
      return;
    }
    if (!canAddContact) {
      const message = t("validation.contact.maxReached");
      setError(message);
      pushToast(message);
      return;
    }
    const selectedContactType = (contactForm.contactType ?? "").toUpperCase();
    if (!selectedContactType) {
      const message = t("validation.requiredField", { field: t("field.type") });
      setInvalidContactFields((prev) => {
        const next = new Set(prev);
        next.add("contactType");
        return next;
      });
      setError(message);
      pushToast(message);
      return;
    }
    if (!availableContactTypes.some((type) => type === selectedContactType)) {
      const message = t("validation.contact.type.unique");
      setError(message);
      pushToast(message);
      return;
    }
    if (principalAlreadyAssigned && Boolean(contactForm.isPrimary)) {
      const message = t("validation.contact.primary.unique");
      setError(message);
      pushToast(message);
      return;
    }

    const email = (contactForm.email ?? "").trim();
    const fullName = (contactForm.fullName ?? "").trim();
    const phoneNumber = contactPhoneNumber.trim();
    const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    const phoneNumberPattern = /^[0-9]{6,15}$/;

    const nextInvalidContactFields = new Set<string>();
    if (!fullName) nextInvalidContactFields.add("fullName");
    if (!email || !emailPattern.test(email)) nextInvalidContactFields.add("email");
    if (!phoneNumber || !phoneNumberPattern.test(phoneNumber)) nextInvalidContactFields.add("phoneNumber");

    if (nextInvalidContactFields.size > 0) {
      setInvalidContactFields(nextInvalidContactFields);
      setInvalidSections((prev) => ({ ...prev, contacts: true }));
    }

    if (!fullName) {
      const message = t("validation.requiredField", { field: t("field.fullName") });
      setError(message);
      pushToast(message);
      return;
    }
    if (!email) {
      const message = t("validation.contact.email.required");
      setError(message);
      pushToast(message);
      return;
    }
    if (!emailPattern.test(email)) {
      const message = t("validation.contact.email.invalid");
      setError(message);
      pushToast(message);
      return;
    }
    if (!phoneNumber) {
      const message = t("validation.contact.phone.required");
      setError(message);
      pushToast(message);
      return;
    }
    if (!phoneNumberPattern.test(phoneNumber)) {
      const message = t("validation.contact.phone.invalid");
      setError(message);
      pushToast(message);
      return;
    }

    const payload: SupplierContactRequest = {
      ...contactForm,
      email,
      phone: `${contactCountryCode} ${phoneNumber}`
    };

    try {
      await addSupplierContact(token, payload);
      const refreshed = await getSupplierProfile(token);
      setProfile(refreshed);
      setContactForm({
        fullName: "",
        email: "",
        contactType: "",
        jobTitle: "",
        phone: "",
        isPrimary: false
      });
      setContactCountryCode("+39");
      setContactPhoneNumber("");
      setInvalidContactFields(new Set());
      setInvalidSections((prev) => ({ ...prev, contacts: false }));
      const message = t("supplier.notice.contactAdded");
      setNotice(message);
      pushToast(message, "success");
    } catch (err) {
      if (err instanceof HttpError) {
        const mapped = mapContactAddErrorMessage(err.message, t);
        if (mapped) {
          setError(mapped);
          pushToast(mapped);
          return;
        }
        setError(err.message);
        return;
      }
      setError(t("supplier.error.contactAdd"));
    }
  }

  function saveContactsSection() {
    setError(null);
    setNotice(null);
    const count = profile?.contacts?.length ?? 0;
    if (count < 1) {
      const message = t("validation.contact.minOne");
      setInvalidSections((prev) => ({ ...prev, contacts: true }));
      setError(message);
      pushToast(message);
      return;
    }
    setInvalidSections((prev) => ({ ...prev, contacts: false }));
    const message = t("supplier.notice.contactsSaved");
    setNotice(message);
    pushToast(message, "success");
    setLastSuccessEvent({ section: "contacts", at: Date.now() });
  }

  async function deleteContact(contactId: string) {
    setError(null);
    setNotice(null);
    if (!profile || !["DRAFT", "NEEDS_REVISION"].includes(profile.status)) {
      const message = t("supplier.error.locked");
      setError(message);
      pushToast(message);
      return;
    }

    try {
      await removeSupplierContact(token, contactId);
      const refreshed = await getSupplierProfile(token);
      setProfile(refreshed);
      const message = t("supplier.notice.contactRemoved");
      setNotice(message);
      pushToast(message, "success");
    } catch (err) {
      setError(err instanceof HttpError ? err.message : t("supplier.error.contactRemove"));
    }
  }

  async function uploadDocument(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!profile) return;
    if (!["DRAFT", "NEEDS_REVISION"].includes(profile.status)) {
      setError(t("supplier.error.locked"));
      return;
    }

    setError(null);
    setNotice(null);

    const rowsToUpload = documentRows.filter((row) => row.file !== null);
    if (rowsToUpload.length === 0) {
      const nextInvalidDocumentFields = new Set<string>();
      for (const row of documentRows) nextInvalidDocumentFields.add(`${row.id}:file`);
      setInvalidDocumentFields(nextInvalidDocumentFields);
      const message = t("validation.document.minOne");
      setError(message);
      pushToast(message);
      setInvalidSections((prev) => ({ ...prev, documents: true }));
      return;
    }

    try {
      const uploadedResponses: DocumentResponse[] = [];
      for (const row of rowsToUpload) {
        const nextInvalidDocumentFields = new Set<string>();
        if (!row.type || !row.file) {
          if (!row.type) nextInvalidDocumentFields.add(`${row.id}:type`);
          if (!row.file) nextInvalidDocumentFields.add(`${row.id}:file`);
          setInvalidDocumentFields(nextInvalidDocumentFields);
          const message = t("validation.document.rowInvalid");
          setError(message);
          pushToast(message);
          setInvalidSections((prev) => ({ ...prev, documents: true }));
          return;
        }
        if (isPastIsoDate(row.expiryDate)) {
          nextInvalidDocumentFields.add(`${row.id}:expiryDate`);
          setInvalidDocumentFields(nextInvalidDocumentFields);
          const message = t("validation.document.expiryPast");
          setError(message);
          pushToast(message);
          setInvalidSections((prev) => ({ ...prev, documents: true }));
          return;
        }
        const uploaded = await uploadSupplierDocument(
          token,
          profile.id,
          row.file,
          row.type,
          row.expiryDate || undefined,
          row.notes || undefined
        );
        uploadedResponses.push(uploaded);
      }
      try {
        const docs = await getSupplierDocuments(token, profile.id);
        if (docs.length === 0 && uploadedResponses.length > 0) {
          setDocuments(uploadedResponses);
          setDocumentRows((prev) => hydrateRowsWithDocuments(prev, uploadedResponses));
        } else {
          setDocuments(docs);
          setDocumentRows((prev) => hydrateRowsWithDocuments(prev, docs));
        }
      } catch {
        setDocuments((prev) => {
          const existingIds = new Set(prev.map((d) => d.id));
          const fallbackNew = uploadedResponses.filter((d) => !existingIds.has(d.id));
          return [...fallbackNew, ...prev];
        });
        setDocumentRows((prev) => {
          const existingDocIds = new Set(documents.map((d) => d.id));
          const mergedDocs = [...uploadedResponses.filter((d) => !existingDocIds.has(d.id)), ...documents];
          return hydrateRowsWithDocuments(prev, mergedDocs);
        });
      }
      setDocumentRows((prev) => {
        const uploadedRowIds = new Set(rowsToUpload.map((row) => row.id));
        return prev.map((row) => {
          if (!uploadedRowIds.has(row.id)) return row;
          return {
            ...row,
            file: null,
            notes: "",
            lockedType: true,
            lockedExpiry: true,
            excludedType: null
          };
        });
      });
      setInvalidDocumentFields(new Set());
      setInvalidSections((prev) => ({ ...prev, documents: false }));
      const message = t("supplier.notice.documentUploaded");
      setNotice(message);
      pushToast(message, "success");
      setLastSuccessEvent({ section: "documents", at: Date.now() });
    } catch (err) {
      const message = err instanceof HttpError ? err.message : t("supplier.error.documentUpload");
      setError(message);
      pushToast(message);
    }
  }

  async function deleteDocument(documentId: string) {
    setError(null);
    setNotice(null);
    if (!profile || !["DRAFT", "NEEDS_REVISION"].includes(profile.status)) {
      const message = t("supplier.error.locked");
      setError(message);
      pushToast(message);
      return;
    }

    try {
      await removeSupplierDocument(token, documentId);
      const docs = await getSupplierDocuments(token, profile.id);
      setDocuments(docs);
      setDocumentRows((prev) => hydrateRowsWithDocuments(prev, docs));
      const message = t("supplier.notice.documentRemoved");
      setNotice(message);
      pushToast(message, "success");
    } catch (err) {
      const message = err instanceof HttpError ? err.message : t("supplier.error.documentRemove");
      setError(message);
      pushToast(message);
    }
  }

  async function submitProfileForReview() {
    setError(null);
    setNotice(null);
    let latestProfile: SupplierProfileResponse | null = profile;
    let latestDocs: DocumentResponse[] = documents;
    try {
      [latestProfile, latestDocs] = await Promise.all([
        getSupplierProfile(token),
        profile ? getSupplierDocuments(token, profile.id) : Promise.resolve([])
      ]);
      setProfile(latestProfile);
      setDocuments(latestDocs);
    } catch (err) {
      const message = err instanceof HttpError ? err.message : t("supplier.error.load");
      setError(message);
      pushToast(message);
      return;
    }

    const validation = validateBeforeSubmit(latestProfile, latestDocs);
    if (!validation.ok) {
      const message = validation.message ?? t("supplier.submit.incomplete");
      setError(message);
      pushToast(message);
      return;
    }

    try {
      const updated = await submitSupplierProfile(token);
      setProfile(updated);
      const message = t("supplier.notice.submitted");
      setNotice(message);
      pushToast(message, "success");
      setInvalidFields(new Set());
      setInvalidSections({ profile: false, categories: false, contacts: false, documents: false });
    } catch (err) {
      setError(err instanceof HttpError ? err.message : t("supplier.error.submit"));
    }
  }

  const isEditable = !!profile && ["DRAFT", "NEEDS_REVISION"].includes(profile.status);

  return {
    t,
    language,
    loading,
    isEditable,
    profile,
    categories,
    documents,
    flatCategoryList,
    selectedCategoryIds,
    setSelectedCategoryIds,
    error,
    notice,
    toast,
    setToast,
    lastSuccessEvent,
    invalidFields,
    invalidContactFields,
    invalidDocumentFields,
    invalidSections,
    setInvalidSections,
    profileForm,
    contactForm,
    setContactForm,
    contactCountryCode,
    setContactCountryCode,
    contactPhoneNumber,
    setContactPhoneNumber,
    availableContactTypes,
    canAddContact,
    principalAlreadyAssigned,
    documentRows,
    updateProfileField,
    getInputClass,
    getContactInputClass,
    clearContactInvalidField,
    getDocumentInputClass,
    addDocumentRow,
    removeDocumentRow,
    updateDocumentRow,
    unlockDocumentRowForNewExpiry,
    saveProfile,
    saveCategories,
    addContact,
    saveContactsSection,
    deleteContact,
    deleteDocument,
    uploadDocument,
    submitProfileForReview,
    getTodayIsoDate
  };
}
