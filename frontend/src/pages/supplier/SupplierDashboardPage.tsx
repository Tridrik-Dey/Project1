import { useEffect, useRef, useState } from "react";
import { Building2, ChevronLeft, ChevronRight, Files, Loader2, Lock, Send, Tags, Users } from "lucide-react";
import { Link } from "react-router-dom";
import { getMyLatestRevampApplication } from "../../api/revampApplicationApi";
import { useAuth } from "../../auth/AuthContext";
import { SupplierCategoriesSection } from "./components/SupplierCategoriesSection";
import { SupplierContactsSection } from "./components/SupplierContactsSection";
import { SupplierDashboardHero } from "./components/SupplierDashboardHero";
import { SupplierDocumentsSection } from "./components/SupplierDocumentsSection";
import { SupplierProfileSection } from "./components/SupplierProfileSection";
import { useSupplierDashboard } from "./hooks/useSupplierDashboard";
import { AppToast } from "../../components/ui/toast";
import { featureFlags } from "../../config/featureFlags";
import { loadRevampApplicationSession, type RevampApplicationSession } from "../../utils/revampApplicationSession";

type StepId = "profile" | "categories" | "contacts" | "documents";

interface SupplierDashboardPageProps {
  initialStep?: StepId;
}

export function SupplierDashboardPage({ initialStep = "profile" }: SupplierDashboardPageProps) {
  const { auth } = useAuth();
  const dashboard = useSupplierDashboard();
  const [revampSession, setRevampSession] = useState<RevampApplicationSession | null>(() => loadRevampApplicationSession());
  const profileRequiredFields = [
    dashboard.profile?.companyName,
    dashboard.profile?.country,
    dashboard.profile?.tradingName,
    dashboard.profile?.companyType,
    dashboard.profile?.registrationNumber,
    dashboard.profile?.taxId,
    dashboard.profile?.vatNumber,
    dashboard.profile?.countryOfIncorporation,
    dashboard.profile?.incorporationDate,
    dashboard.profile?.website,
    dashboard.profile?.employeeCountRange,
    dashboard.profile?.annualRevenueRange,
    dashboard.profile?.addressLine1,
    dashboard.profile?.addressLine2,
    dashboard.profile?.city,
    dashboard.profile?.stateProvince,
    dashboard.profile?.postalCode
  ];
  const profileCompleted = profileRequiredFields.filter((v) => String(v ?? "").trim().length > 0).length;
  const profileDone = profileCompleted === profileRequiredFields.length;
  const profileCanSave = [
    dashboard.profileForm.companyName,
    dashboard.profileForm.country,
    dashboard.profileForm.tradingName,
    dashboard.profileForm.companyType,
    dashboard.profileForm.registrationNumber,
    dashboard.profileForm.taxId,
    dashboard.profileForm.vatNumber,
    dashboard.profileForm.countryOfIncorporation,
    dashboard.profileForm.incorporationDate,
    dashboard.profileForm.website,
    dashboard.profileForm.employeeCountRange,
    dashboard.profileForm.annualRevenueRange,
    dashboard.profileForm.addressLine1,
    dashboard.profileForm.addressLine2,
    dashboard.profileForm.city,
    dashboard.profileForm.stateProvince,
    dashboard.profileForm.postalCode
  ].every((v) => String(v ?? "").trim().length > 0);
  const profileHasUnsavedChanges = Boolean(
    dashboard.profile && (
      (dashboard.profileForm.companyName ?? "") !== (dashboard.profile.companyName ?? "") ||
      (dashboard.profileForm.country ?? "") !== (dashboard.profile.country ?? "") ||
      (dashboard.profileForm.tradingName ?? "") !== (dashboard.profile.tradingName ?? "") ||
      (dashboard.profileForm.companyType ?? "") !== (dashboard.profile.companyType ?? "") ||
      (dashboard.profileForm.registrationNumber ?? "") !== (dashboard.profile.registrationNumber ?? "") ||
      (dashboard.profileForm.taxId ?? "") !== ((dashboard.profile.taxId ?? "").toUpperCase()) ||
      (dashboard.profileForm.vatNumber ?? "") !== (dashboard.profile.vatNumber ?? "") ||
      (dashboard.profileForm.countryOfIncorporation ?? "") !== (dashboard.profile.countryOfIncorporation ?? "") ||
      (dashboard.profileForm.incorporationDate ?? "") !== (dashboard.profile.incorporationDate ?? "") ||
      (dashboard.profileForm.website ?? "") !== (dashboard.profile.website ?? "") ||
      (dashboard.profileForm.employeeCountRange ?? "") !== (dashboard.profile.employeeCountRange ?? "") ||
      (dashboard.profileForm.annualRevenueRange ?? "") !== (dashboard.profile.annualRevenueRange ?? "") ||
      (dashboard.profileForm.addressLine1 ?? "") !== (dashboard.profile.addressLine1 ?? "") ||
      (dashboard.profileForm.addressLine2 ?? "") !== (dashboard.profile.addressLine2 ?? "") ||
      (dashboard.profileForm.city ?? "") !== (dashboard.profile.city ?? "") ||
      (dashboard.profileForm.stateProvince ?? "") !== (dashboard.profile.stateProvince ?? "") ||
      (dashboard.profileForm.postalCode ?? "") !== (dashboard.profile.postalCode ?? "") ||
      (dashboard.profileForm.description ?? "") !== (dashboard.profile.description ?? "")
    )
  );
  const selectedCategoryCount = Math.max(
    dashboard.profile?.categories?.length ?? 0,
    dashboard.selectedCategoryIds.length
  );
  const categoriesDone = selectedCategoryCount > 0;
  const categoriesCanSave = dashboard.selectedCategoryIds.length > 0;
  const contactCount = dashboard.profile?.contacts?.length ?? 0;
  const contactsDone = contactCount > 0;
  const contactsCanAdd = Boolean(
    dashboard.canAddContact &&
    dashboard.contactForm.fullName.trim() &&
    (dashboard.contactForm.email ?? "").trim() &&
    dashboard.contactPhoneNumber.trim()
  );
  const contactsCanSaveSection = contactCount > 0;
  const contactsHasUnsavedChanges = Boolean(
    dashboard.contactForm.fullName.trim() ||
    (dashboard.contactForm.email ?? "").trim() ||
    (dashboard.contactForm.jobTitle ?? "").trim() ||
    dashboard.contactPhoneNumber.trim() ||
    dashboard.contactCountryCode !== "+39" ||
    dashboard.contactForm.isPrimary
  );
  const documentTypeCount = new Set(dashboard.documents.map((d) => d.documentType)).size;
  const documentsDone = documentTypeCount > 0;
  const todayIsoDate = dashboard.getTodayIsoDate();
  const documentsCanSave = dashboard.documentRows.some((row) =>
    !!row.file && !!row.type && (!row.expiryDate || row.expiryDate >= todayIsoDate)
  );
  const documentsHasUnsavedChanges = dashboard.documentRows.some((row, index) => {
    const isInitialDefaultRow =
      index === 0 &&
      row.id === "doc-1" &&
      row.type === "" &&
      !row.expiryDate &&
      !row.notes &&
      row.file === null &&
      !row.lockedType &&
      !row.lockedExpiry;
    if (isInitialDefaultRow) return false;
    if (row.file) return true;
    if (row.expiryDate || row.notes) return true;
    if (!row.lockedType && !row.lockedExpiry && index > 0) return true;
    return false;
  });
  const completedSections = [profileDone, categoriesDone, contactsDone, documentsDone].filter(Boolean).length;
  const [currentStep, setCurrentStep] = useState<StepId>(initialStep);
  const [navDirection, setNavDirection] = useState<"forward" | "backward">("forward");
  const [isSubmittingReview, setIsSubmittingReview] = useState(false);
  const [readyPulseTick, setReadyPulseTick] = useState(0);
  const lastHandledSuccessAtRef = useRef<number | null>(null);
  const wasFullyCompleteRef = useRef(false);

  const steps = [
    { id: "profile" as const, title: dashboard.t("supplier.profile.title"), done: profileDone, icon: Building2 },
    { id: "categories" as const, title: dashboard.t("supplier.categories.title"), done: categoriesDone, icon: Tags },
    { id: "contacts" as const, title: dashboard.t("supplier.contacts.title"), done: contactsDone, icon: Users },
    { id: "documents" as const, title: dashboard.t("supplier.documents.title"), done: documentsDone, icon: Files }
  ];
  const currentIndex = steps.findIndex((s) => s.id === currentStep);
  const atFirstStep = currentIndex <= 0;
  const atLastStep = currentIndex >= steps.length - 1;

  useEffect(() => {
    const success = dashboard.lastSuccessEvent;
    if (!success) return;
    if (lastHandledSuccessAtRef.current === success.at) return;
    if (success.section !== currentStep) return;
    if (atLastStep) return;
    lastHandledSuccessAtRef.current = success.at;
    setNavDirection("forward");
    setCurrentStep(steps[currentIndex + 1].id);
  }, [dashboard.lastSuccessEvent, currentStep, atLastStep, currentIndex, steps]);

  useEffect(() => {
    if (completedSections === 4 && !wasFullyCompleteRef.current) {
      setReadyPulseTick((prev) => prev + 1);
      wasFullyCompleteRef.current = true;
      return;
    }
    if (completedSections < 4) {
      wasFullyCompleteRef.current = false;
    }
  }, [completedSections]);

  useEffect(() => {
    const token = auth?.token;
    if (!featureFlags.newWizardAb || !token) return;
    const authToken: string = token;
    let cancelled = false;
    async function refreshRevampStatusCard() {
      try {
        const latest = await getMyLatestRevampApplication(authToken);
        if (cancelled) return;
        if (latest) {
          setRevampSession({
            applicationId: latest.id,
            status: latest.status,
            protocolCode: latest.protocolCode,
            updatedAt: latest.updatedAt,
            resumePath: latest.status === "SUBMITTED" ? `/application/${latest.id}/submitted` : `/application/${latest.id}/step/1`
          });
          return;
        }
      } catch {
        // fallback on session cache
      }
      if (!cancelled) {
        setRevampSession(loadRevampApplicationSession());
      }
    }
    void refreshRevampStatusCard();
    return () => {
      cancelled = true;
    };
  }, [auth?.token, dashboard.notice, dashboard.toast]);

  useEffect(() => {
    setCurrentStep(initialStep);
  }, [initialStep]);

  if (dashboard.loading) return <section className="panel">{dashboard.t("supplier.loading")}</section>;

  function goToStep(index: number) {
    if (index < 0 || index >= steps.length) return;
    setNavDirection(index > currentIndex ? "forward" : "backward");
    setCurrentStep(steps[index].id);
  }

  function moveNext() {
    const current = steps[currentIndex];
    if (!current?.done) {
      dashboard.setToast({ message: dashboard.t("supplier.wizard.completeStep", { step: current?.title ?? "" }), type: "error" });
      return;
    }
    goToStep(currentIndex + 1);
  }

  async function submitForReview() {
    if (!dashboard.isEditable || completedSections < 4 || isSubmittingReview) return;
    setIsSubmittingReview(true);
    try {
      await dashboard.submitProfileForReview();
    } finally {
      setIsSubmittingReview(false);
    }
  }

  const stepCard = (() => {
    if (currentStep === "profile") {
      return (
        <SupplierProfileSection
          t={dashboard.t}
          isEditable={dashboard.isEditable}
          profileForm={dashboard.profileForm}
          sectionDone={profileDone}
          sectionProgress={`${profileCompleted}/${profileRequiredFields.length}`}
          hasUnsavedChanges={profileHasUnsavedChanges}
          canSave={profileCanSave}
          getInputClass={dashboard.getInputClass}
          updateProfileField={dashboard.updateProfileField}
          onSaveProfile={dashboard.saveProfile}
        />
      );
    }
    if (currentStep === "categories") {
      return (
        <SupplierCategoriesSection
          t={dashboard.t}
          isEditable={dashboard.isEditable}
          invalidCategoriesSection={dashboard.invalidSections.categories}
          sectionDone={categoriesDone}
          sectionProgress={toPlusProgress(selectedCategoryCount)}
          canSave={categoriesCanSave}
          flatCategoryList={dashboard.flatCategoryList}
          savedCategoryIds={dashboard.profile?.categories?.map((category) => category.id) ?? []}
          selectedCategoryIds={dashboard.selectedCategoryIds}
          setSelectedCategoryIds={dashboard.setSelectedCategoryIds}
          setInvalidSections={dashboard.setInvalidSections}
          onSaveCategories={dashboard.saveCategories}
        />
      );
    }
    if (currentStep === "contacts") {
      return (
        <SupplierContactsSection
          t={dashboard.t}
          language={dashboard.language}
          isEditable={dashboard.isEditable}
          sectionDone={contactsDone}
          sectionProgress={toPlusProgress(contactCount)}
          hasUnsavedChanges={contactsHasUnsavedChanges}
          canAddContact={contactsCanAdd}
          canSaveSection={contactsCanSaveSection}
          availableContactTypes={dashboard.availableContactTypes}
          principalAlreadyAssigned={dashboard.principalAlreadyAssigned}
          getContactInputClass={dashboard.getContactInputClass}
          clearContactInvalidField={dashboard.clearContactInvalidField}
          profile={dashboard.profile}
          contactForm={dashboard.contactForm}
          setContactForm={dashboard.setContactForm}
          contactCountryCode={dashboard.contactCountryCode}
          setContactCountryCode={dashboard.setContactCountryCode}
          contactPhoneNumber={dashboard.contactPhoneNumber}
          setContactPhoneNumber={dashboard.setContactPhoneNumber}
          onAddContact={dashboard.addContact}
          onSaveContactsSection={dashboard.saveContactsSection}
          onDeleteContact={dashboard.deleteContact}
        />
      );
    }
    return (
      <SupplierDocumentsSection
        t={dashboard.t}
        isEditable={dashboard.isEditable}
        sectionDone={documentsDone}
        sectionProgress={documentTypeCount > 0 ? `${documentTypeCount}/${documentTypeCount}+` : "0/1+"}
        hasUnsavedChanges={documentsHasUnsavedChanges}
        canSave={documentsCanSave}
        documentRows={dashboard.documentRows}
        documents={dashboard.documents}
        getTodayIsoDate={dashboard.getTodayIsoDate}
        addDocumentRow={dashboard.addDocumentRow}
        removeDocumentRow={dashboard.removeDocumentRow}
        updateDocumentRow={dashboard.updateDocumentRow}
        unlockDocumentRowForNewExpiry={dashboard.unlockDocumentRowForNewExpiry}
        getDocumentInputClass={dashboard.getDocumentInputClass}
        onDeleteDocument={dashboard.deleteDocument}
        onUploadDocument={dashboard.uploadDocument}
      />
    );
  })();

  const revampCtaPath = (() => {
    if (!revampSession) return "/apply";
    const normalizedStatus = (revampSession.status ?? "").toUpperCase();
    if (normalizedStatus === "SUBMITTED") return `/application/${revampSession.applicationId}/submitted`;
    if (normalizedStatus === "DRAFT" || normalizedStatus === "INTEGRATION_REQUIRED") return revampSession.resumePath ?? `/application/${revampSession.applicationId}/step/1`;
    return revampSession.resumePath ?? `/application/${revampSession.applicationId}/recap`;
  })();

  const revampCtaLabel = (() => {
    if (!revampSession) return "Avvia nuova candidatura revamp";
    const normalizedStatus = (revampSession.status ?? "").toUpperCase();
    if (normalizedStatus === "SUBMITTED") return "Apri conferma candidatura";
    if (normalizedStatus === "DRAFT" || normalizedStatus === "INTEGRATION_REQUIRED") return "Riprendi candidatura revamp";
    return "Apri riepilogo candidatura";
  })();

  const profileCompletionPct = Math.round((profileCompleted / Math.max(1, profileRequiredFields.length)) * 100);
  const docsWithExpiry = dashboard.documents.filter((doc) => Boolean(doc.expiryDate));
  const docsValid = docsWithExpiry.filter((doc) => (doc.expiryDate ?? "") >= todayIsoDate).length;
  const docsExpired = docsWithExpiry.filter((doc) => (doc.expiryDate ?? "") < todayIsoDate).length;
  const docsWithoutExpiry = dashboard.documents.length - docsWithExpiry.length;

  const renewalProgress = (() => {
    const createdAt = dashboard.profile?.createdAt ? Date.parse(dashboard.profile.createdAt) : NaN;
    if (!Number.isFinite(createdAt)) return 0;
    const elapsedDays = Math.max(0, Math.floor((Date.now() - createdAt) / (1000 * 60 * 60 * 24)));
    return Math.max(0, Math.min(100, Math.round((elapsedDays / 365) * 100)));
  })();

  const profileStatusLabel = (() => {
    const status = (dashboard.profile?.status ?? "").toLowerCase();
    if (!status) return "N/D";
    if (status === "approved") return "Attivo";
    if (status === "pending_review") return "In attesa revisione";
    if (status === "needs_revision") return "Integrazione richiesta";
    if (status === "rejected") return "Rigettato";
    return status.toUpperCase();
  })();

  const communications = [
    dashboard.notice ? `Sistema: ${dashboard.notice}` : null,
    dashboard.profile?.reviewerName ? `Referente revisione: ${dashboard.profile.reviewerName}` : null,
    dashboard.profile?.revisionNotes ? `Note revisione: ${dashboard.profile.revisionNotes}` : null,
    dashboard.profile?.lastReviewedAt ? `Ultima revisione: ${new Date(dashboard.profile.lastReviewedAt).toLocaleString("it-IT")}` : null,
    dashboard.profile?.submittedAt ? `Profilo inviato: ${new Date(dashboard.profile.submittedAt).toLocaleString("it-IT")}` : null
  ].filter(Boolean) as string[];

  return (
    <section className="stack supplier-page-stack">
      {dashboard.toast ? <AppToast toast={dashboard.toast} onClose={() => dashboard.setToast(null)} /> : null}

      <SupplierDashboardHero
        t={dashboard.t}
        profile={dashboard.profile}
        isEditable={dashboard.isEditable}
        error={dashboard.error}
        notice={dashboard.notice}
      />

      <div className="home-steps">
        <div className="panel home-step-card">
          <div className="home-step-head"><span className="home-step-index">K1</span><h4>Completamento profilo</h4></div>
          <p style={{ fontSize: "1.35rem", fontWeight: 800 }}>{profileCompletionPct}%</p>
          <p className="subtle">{profileCompleted}/{profileRequiredFields.length} campi richiesti</p>
        </div>
        <div className="panel home-step-card">
          <div className="home-step-head"><span className="home-step-index">K2</span><h4>Documenti</h4></div>
          <p style={{ fontSize: "1.35rem", fontWeight: 800 }}>{dashboard.documents.length}</p>
          <p className="subtle">Validi: {docsValid} · Scaduti: {docsExpired} · Senza scadenza: {docsWithoutExpiry}</p>
        </div>
        <div className="panel home-step-card">
          <div className="home-step-head"><span className="home-step-index">K3</span><h4>Collaborazioni</h4></div>
          <p style={{ fontSize: "1.35rem", fontWeight: 800 }}>{dashboard.profile?.contacts?.length ?? 0}</p>
          <p className="subtle">Referenti attivi registrati</p>
        </div>
        <div className="panel home-step-card">
          <div className="home-step-head"><span className="home-step-index">K4</span><h4>Stato profilo</h4></div>
          <p style={{ fontSize: "1.35rem", fontWeight: 800 }}>{profileStatusLabel}</p>
          <p className="subtle">Categorie associate: {selectedCategoryCount}</p>
        </div>
      </div>

      <div className="home-steps">
        <div className="panel home-step-card">
          <div className="home-step-head"><span className="home-step-index">RN</span><h4>Barra rinnovo annuale</h4></div>
          <div style={{ height: "10px", background: "#e6eef6", borderRadius: "999px", overflow: "hidden" }}>
            <div style={{ width: `${renewalProgress}%`, height: "100%", background: renewalProgress >= 85 ? "#c0392b" : "#2f6da5" }} />
          </div>
          <p className="subtle" style={{ marginTop: "0.45rem" }}>
            Progresso ciclo annuale: {renewalProgress}% (stima su data creazione profilo)
          </p>
          <Link className="home-inline-link home-inline-link-supplier" to="/supplier/renewal">
            <span>Apri area rinnovo</span>
          </Link>
        </div>
        <div className="panel home-step-card">
          <div className="home-step-head"><span className="home-step-index">CM</span><h4>Comunicazioni recenti</h4></div>
          {communications.length === 0 ? <p className="subtle">Nessuna comunicazione recente.</p> : null}
          {communications.length > 0 ? (
            <div className="stack">
              {communications.slice(0, 4).map((message, idx) => (
                <p key={`${idx}-${message}`} className="subtle">{message}</p>
              ))}
            </div>
          ) : null}
          <Link className="home-inline-link home-inline-link-supplier" to="/supplier/communications">
            <span>Apri comunicazioni</span>
          </Link>
        </div>
      </div>

      {featureFlags.newWizardAb ? (
        <div className="panel home-step-card">
          <div className="home-step-head">
            <span className="home-step-index">RV</span>
            <h4>Stato candidatura revamp</h4>
          </div>
          {revampSession ? (
            <>
              <p>
                Stato: <strong>{revampSession.status ?? "DRAFT"}</strong>
                {revampSession.protocolCode ? ` · Protocollo: ${revampSession.protocolCode}` : ""}
              </p>
              <p className="subtle">
                Ultimo aggiornamento: {revampSession.updatedAt ? new Date(revampSession.updatedAt).toLocaleString("it-IT") : "n/d"}
              </p>
            </>
          ) : (
            <p className="subtle">Nessuna candidatura revamp in sessione.</p>
          )}
          <Link className="home-inline-link home-inline-link-supplier" to={revampCtaPath}>
            <span>{revampCtaLabel}</span>
          </Link>
        </div>
      ) : null}

      <div
        key={`${currentStep}-${navDirection}`}
        className={`supplier-step-stage ${navDirection === "forward" ? "forward" : "backward"}`}
      >
        {stepCard}
      </div>

      <div className="supplier-sticky-submit supplier-wizard-rail" role="region" aria-label={dashboard.t("supplier.submitReview")}>
        <div className="supplier-sticky-progress">
          {dashboard.t("supplier.progress.sections", { count: completedSections })}
        </div>
        <div className="supplier-wizard-steps">
          {steps.map((step, idx) => (
            <button
              key={step.id}
              type="button"
              className={`supplier-wizard-step ${step.done ? "done" : ""} ${idx === currentIndex ? "active" : ""}`}
              onClick={() => goToStep(idx)}
              title={step.title}
              aria-label={step.title}
            >
              <step.icon className="h-4 w-4" />
              <span>{step.title}</span>
            </button>
          ))}
        </div>
        <div className="supplier-wizard-nav">
          <button
            type="button"
            className="supplier-wizard-nav-btn"
            title={dashboard.t("supplier.wizard.previous")}
            aria-label={dashboard.t("supplier.wizard.previous")}
            disabled={atFirstStep}
            onClick={() => goToStep(currentIndex - 1)}
          >
            <ChevronLeft className="h-4 w-4" />
          </button>
          <button
            type="button"
            className="supplier-wizard-nav-btn"
            title={dashboard.t("supplier.wizard.next")}
            aria-label={dashboard.t("supplier.wizard.next")}
            disabled={atLastStep}
            onClick={moveNext}
          >
            <ChevronRight className="h-4 w-4" />
          </button>
          <button
            key={`supplier-submit-${readyPulseTick}`}
            className={`supplier-submit-btn supplier-submit-final ${completedSections === 4 ? "is-ready" : "is-locked"} ${isSubmittingReview ? "is-submitting" : ""}`}
            disabled={!dashboard.isEditable || completedSections < 4 || isSubmittingReview}
            onClick={() => void submitForReview()}
          >
            <span className="supplier-submit-icon-stack" aria-hidden="true">
              <Lock className="h-4 w-4 supplier-submit-icon supplier-submit-icon-lock" />
              <Send className="h-4 w-4 supplier-submit-icon supplier-submit-icon-send" />
            </span>
            {isSubmittingReview ? <Loader2 className="h-4 w-4 supplier-btn-spinner supplier-submit-spinner" /> : null}
            {isSubmittingReview ? dashboard.t("supplier.submitReview.loading") : dashboard.t("supplier.submitReview")}
          </button>
        </div>
      </div>
    </section>
  );
}
  function toPlusProgress(count: number): string {
    return count > 0 ? `${count}/${count}+` : "0/1+";
  }
