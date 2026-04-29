import { Suspense, lazy } from "react";
import { Navigate, Route, Routes } from "react-router-dom";
import { AppLayout } from "../components/layout/AppLayout";
import { RequireAuth } from "../auth/RequireAuth";
import { useAuth } from "../auth/AuthContext";
import { featureFlags } from "../config/featureFlags";
import { useAdminGovernanceRole } from "../hooks/useAdminGovernanceRole";
import type { AdminRole } from "../api/adminUsersRolesApi";
import { isRevampEmailVerified } from "../utils/revampEmailVerification";

const LoginPage = lazy(() => import("../pages/auth/LoginPage").then((m) => ({ default: m.LoginPage })));
const RegisterPage = lazy(() => import("../pages/auth/RegisterPage").then((m) => ({ default: m.RegisterPage })));
const VerifyOtpPage = lazy(() => import("../pages/auth/VerifyOtpPage").then((m) => ({ default: m.VerifyOtpPage })));
const AcceptAdminInvitePage = lazy(() => import("../pages/auth/AcceptAdminInvitePage").then((m) => ({ default: m.AcceptAdminInvitePage })));
const HomePage = lazy(() => import("../pages/home/HomePage").then((m) => ({ default: m.HomePage })));
const PrivacyPolicyPage = lazy(() => import("../pages/legal/PrivacyPolicyPage").then((m) => ({ default: m.PrivacyPolicyPage })));
const RevampApplicationStep1Page = lazy(() => import("../pages/revamp/RevampApplicationStep1Page").then((m) => ({ default: m.RevampApplicationStep1Page })));
const RevampApplicationStep2Page = lazy(() => import("../pages/revamp/RevampApplicationStep2Page").then((m) => ({ default: m.RevampApplicationStep2Page })));
const RevampApplicationStep3Page = lazy(() => import("../pages/revamp/RevampApplicationStep3Page").then((m) => ({ default: m.RevampApplicationStep3Page })));
const RevampApplicationStep4Page = lazy(() => import("../pages/revamp/RevampApplicationStep4Page").then((m) => ({ default: m.RevampApplicationStep4Page })));
const RevampApplicationStep5Page = lazy(() => import("../pages/revamp/RevampApplicationStep5Page").then((m) => ({ default: m.RevampApplicationStep5Page })));
const RevampApplicationRecapPage = lazy(() => import("../pages/revamp/RevampApplicationRecapPage").then((m) => ({ default: m.RevampApplicationRecapPage })));
const RevampApplicationSubmittedPage = lazy(() => import("../pages/revamp/RevampApplicationSubmittedPage").then((m) => ({ default: m.RevampApplicationSubmittedPage })));
const RevampEntryPage = lazy(() => import("../pages/revamp/RevampEntryPage").then((m) => ({ default: m.RevampEntryPage })));
const RevampRegistryStartPage = lazy(() => import("../pages/revamp/RevampRegistryStartPage").then((m) => ({ default: m.RevampRegistryStartPage })));
const RevampStep2TipologiaPage = lazy(() => import("../pages/revamp/RevampStep2TipologiaPage").then((m) => ({ default: m.RevampStep2TipologiaPage })));
const RevampStep3CompetenzePage = lazy(() => import("../pages/revamp/RevampStep3CompetenzePage").then((m) => ({ default: m.RevampStep3CompetenzePage })));
const RevampStep4DisponibilitaPage = lazy(() => import("../pages/revamp/RevampStep4DisponibilitaPage").then((m) => ({ default: m.RevampStep4DisponibilitaPage })));
const RevampStep5DichiarazioniPage = lazy(() => import("../pages/revamp/RevampStep5DichiarazioniPage").then((m) => ({ default: m.RevampStep5DichiarazioniPage })));
const RevampRecapPage = lazy(() => import("../pages/revamp/RevampRecapPage").then((m) => ({ default: m.RevampRecapPage })));
const RevampSupplierDashboardPage = lazy(() => import("../pages/revamp/RevampSupplierDashboardPage").then((m) => ({ default: m.RevampSupplierDashboardPage })));
const RevampSupplierHomeRedirect = lazy(() => import("../pages/revamp/RevampSupplierHomeRedirect").then((m) => ({ default: m.RevampSupplierHomeRedirect })));
const RevampAlboBStep1DatiAziendaliPage = lazy(() => import("../pages/revamp/RevampAlboBStep1DatiAziendaliPage").then((m) => ({ default: m.RevampAlboBStep1DatiAziendaliPage })));
const RevampAlboBStep2StrutturaDimensionePage = lazy(() => import("../pages/revamp/RevampAlboBStep2StrutturaDimensionePage").then((m) => ({ default: m.RevampAlboBStep2StrutturaDimensionePage })));
const RevampAlboBStep3ServiziPage = lazy(() => import("../pages/revamp/RevampAlboBStep3ServiziPage").then((m) => ({ default: m.RevampAlboBStep3ServiziPage })));
const RevampAlboBStep4CertificazioniPage = lazy(() => import("../pages/revamp/RevampAlboBStep4CertificazioniPage").then((m) => ({ default: m.RevampAlboBStep4CertificazioniPage })));
const RevampAlboBStep5DichiarazioniPage = lazy(() => import("../pages/revamp/RevampAlboBStep5DichiarazioniPage").then((m) => ({ default: m.RevampAlboBStep5DichiarazioniPage })));
const RevampAlboBRecapPage = lazy(() => import("../pages/revamp/RevampAlboBRecapPage").then((m) => ({ default: m.RevampAlboBRecapPage })));
const RevampInviteEntryPage = lazy(() => import("../pages/revamp/RevampInviteEntryPage").then((m) => ({ default: m.RevampInviteEntryPage })));
const SupplierDashboardPage = lazy(() => import("../pages/supplier/SupplierDashboardPage").then((m) => ({ default: m.SupplierDashboardPage })));
const SupplierCommunicationsPage = lazy(() => import("../pages/supplier/SupplierCommunicationsPage").then((m) => ({ default: m.SupplierCommunicationsPage })));
const SupplierRenewalPage = lazy(() => import("../pages/supplier/SupplierRenewalPage").then((m) => ({ default: m.SupplierRenewalPage })));
const AdminUsersRolesPage = lazy(() => import("../pages/admin/AdminUsersRolesPage").then((m) => ({ default: m.AdminUsersRolesPage })));
const AdminDashboardPage = lazy(() => import("../pages/admin/AdminDashboardPage").then((m) => ({ default: m.AdminDashboardPage })));
const AdminInvitesPage = lazy(() => import("../pages/admin/AdminInvitesPage").then((m) => ({ default: m.AdminInvitesPage })));
const AdminReportsPage = lazy(() => import("../pages/admin/AdminReportsPage").then((m) => ({ default: m.AdminReportsPage })));
const AdminEvaluationsPage = lazy(() => import("../pages/admin/AdminEvaluationsPage").then((m) => ({ default: m.AdminEvaluationsPage })));
const AdminApprovalEmailTemplatePage = lazy(() => import("../pages/admin/AdminApprovalEmailTemplatePage").then((m) => ({ default: m.AdminApprovalEmailTemplatePage })));
const AdminIntegrationPage = lazy(() => import("../pages/admin/AdminIntegrationPage").then((m) => ({ default: m.AdminIntegrationPage })));
const AdminQueuePage = lazy(() => import("../pages/admin/AdminQueuePage").then((m) => ({ default: m.AdminQueuePage })));
const AdminApplicationCasePage = lazy(() => import("../pages/admin/AdminApplicationCasePage").then((m) => ({ default: m.AdminApplicationCasePage })));
const AdminAlboAListPage = lazy(() => import("../pages/admin/AdminAlboAListPage").then((m) => ({ default: m.AdminAlboAListPage })));
const AdminAlboBListPage = lazy(() => import("../pages/admin/AdminAlboBListPage").then((m) => ({ default: m.AdminAlboBListPage })));
const AdminRegistryProfileDetailPage = lazy(() => import("../pages/admin/AdminRegistryProfileDetailPage").then((m) => ({ default: m.AdminRegistryProfileDetailPage })));

function RequireRevampOtpForSupplier({ children }: { children: JSX.Element }) {
  const { auth } = useAuth();

  if (!featureFlags.newWizardAb) return children;
  if (!auth || auth.role !== "SUPPLIER") return children;
  if (isRevampEmailVerified()) return children;
  return <Navigate to="/verify-otp" replace />;
}

function RequireAdminGovernanceRoles({
  children,
  allowed
}: {
  children: JSX.Element;
  allowed: AdminRole[];
}) {
  const { auth } = useAuth();
  const { adminRole, loading, resolved } = useAdminGovernanceRole();

  if (!auth || auth.role !== "ADMIN") return <Navigate to="/login" replace />;
  if (loading || !resolved) {
    return (
      <section className="stack">
        <div className="panel">
          <h2>Caricamento autorizzazioni...</h2>
        </div>
      </section>
    );
  }
  if (!adminRole || !allowed.includes(adminRole)) return <Navigate to="/admin/dashboard" replace />;
  return children;
}

export function AppRouter() {
  const { auth } = useAuth();
  const authenticatedHome = auth ? (auth.role === "SUPPLIER" ? "/supplier/dashboard" : "/admin/dashboard") : "/";

  return (
    <AppLayout>
      <Suspense fallback={(
        <section className="stack">
          <div className="panel">
            <h2>Caricamento pagina...</h2>
          </div>
        </section>
      )}
      >
        <Routes>
          <Route path="/" element={<HomePage />} />
          <Route path="/privacy" element={<PrivacyPolicyPage />} />
          <Route path="/login" element={auth ? <Navigate to={authenticatedHome} replace /> : <LoginPage />} />
          <Route path="/register" element={<RegisterPage />} />
          <Route path="/activate-account" element={<AcceptAdminInvitePage />} />
          <Route path="/accept-admin-invite" element={<AcceptAdminInvitePage />} />
          {featureFlags.newWizardAb ? (
            <Route
              path="/verify-otp"
              element={(
                <RequireAuth allowedRoles={["SUPPLIER"]}>
                  <VerifyOtpPage />
                </RequireAuth>
              )}
            />
          ) : null}
          {featureFlags.newWizardAb ? (
            <Route
              path="/apply"
              element={(
                <RequireAuth allowedRoles={["SUPPLIER"]}>
                  <RequireRevampOtpForSupplier>
                    <RevampEntryPage />
                  </RequireRevampOtpForSupplier>
                </RequireAuth>
              )}
            />
          ) : null}
          {featureFlags.newWizardAb ? (
            <Route
              path="/apply/albo-b"
              element={(
                <RequireAuth allowedRoles={["SUPPLIER"]}>
                  <RequireRevampOtpForSupplier>
                    <RevampAlboBStep1DatiAziendaliPage />
                  </RequireRevampOtpForSupplier>
                </RequireAuth>
              )}
            />
          ) : null}
          {featureFlags.newWizardAb ? (
            <Route
              path="/apply/albo-b/step/2"
              element={(
                <RequireAuth allowedRoles={["SUPPLIER"]}>
                  <RequireRevampOtpForSupplier>
                    <RevampAlboBStep2StrutturaDimensionePage />
                  </RequireRevampOtpForSupplier>
                </RequireAuth>
              )}
            />
          ) : null}
          {featureFlags.newWizardAb ? (
            <Route
              path="/apply/albo-b/step/3"
              element={(
                <RequireAuth allowedRoles={["SUPPLIER"]}>
                  <RequireRevampOtpForSupplier>
                    <RevampAlboBStep3ServiziPage />
                  </RequireRevampOtpForSupplier>
                </RequireAuth>
              )}
            />
          ) : null}
          {featureFlags.newWizardAb ? (
            <Route
              path="/apply/albo-b/step/4"
              element={(
                <RequireAuth allowedRoles={["SUPPLIER"]}>
                  <RequireRevampOtpForSupplier>
                    <RevampAlboBStep4CertificazioniPage />
                  </RequireRevampOtpForSupplier>
                </RequireAuth>
              )}
            />
          ) : null}
          {featureFlags.newWizardAb ? (
            <Route
              path="/apply/albo-b/step/5"
              element={(
                <RequireAuth allowedRoles={["SUPPLIER"]}>
                  <RequireRevampOtpForSupplier>
                    <RevampAlboBStep5DichiarazioniPage />
                  </RequireRevampOtpForSupplier>
                </RequireAuth>
              )}
            />
          ) : null}
          {featureFlags.newWizardAb ? (
            <Route
              path="/apply/albo-b/recap"
              element={(
                <RequireAuth allowedRoles={["SUPPLIER"]}>
                  <RequireRevampOtpForSupplier>
                    <RevampAlboBRecapPage />
                  </RequireRevampOtpForSupplier>
                </RequireAuth>
              )}
            />
          ) : null}
          {featureFlags.newWizardAb ? (
            <Route
              path="/apply/:registryType"
              element={(
                <RequireAuth allowedRoles={["SUPPLIER"]}>
                  <RequireRevampOtpForSupplier>
                    <RevampRegistryStartPage />
                  </RequireRevampOtpForSupplier>
                </RequireAuth>
              )}
            />
          ) : null}
          {featureFlags.newWizardAb ? (
            <Route
              path="/apply/:registryType/step/2"
              element={(
                <RequireAuth allowedRoles={["SUPPLIER"]}>
                  <RequireRevampOtpForSupplier>
                    <RevampStep2TipologiaPage />
                  </RequireRevampOtpForSupplier>
                </RequireAuth>
              )}
            />
          ) : null}
          {featureFlags.newWizardAb ? (
            <Route
              path="/apply/:registryType/step/3"
              element={(
                <RequireAuth allowedRoles={["SUPPLIER"]}>
                  <RequireRevampOtpForSupplier>
                    <RevampStep3CompetenzePage />
                  </RequireRevampOtpForSupplier>
                </RequireAuth>
              )}
            />
          ) : null}
          {featureFlags.newWizardAb ? (
            <Route
              path="/apply/:registryType/step/4"
              element={(
                <RequireAuth allowedRoles={["SUPPLIER"]}>
                  <RequireRevampOtpForSupplier>
                    <RevampStep4DisponibilitaPage />
                  </RequireRevampOtpForSupplier>
                </RequireAuth>
              )}
            />
          ) : null}
          {featureFlags.newWizardAb ? (
            <Route
              path="/apply/:registryType/step/5"
              element={(
                <RequireAuth allowedRoles={["SUPPLIER"]}>
                  <RequireRevampOtpForSupplier>
                    <RevampStep5DichiarazioniPage />
                  </RequireRevampOtpForSupplier>
                </RequireAuth>
              )}
            />
          ) : null}
          {featureFlags.newWizardAb ? (
            <Route
              path="/apply/:registryType/recap"
              element={(
                <RequireAuth allowedRoles={["SUPPLIER"]}>
                  <RequireRevampOtpForSupplier>
                    <RevampRecapPage />
                  </RequireRevampOtpForSupplier>
                </RequireAuth>
              )}
            />
          ) : null}
          {featureFlags.newWizardAb ? (
            <Route
              path="/apply/:registryType/my-profile"
              element={(
                <RequireAuth allowedRoles={["SUPPLIER"]}>
                  <RevampSupplierDashboardPage />
                </RequireAuth>
              )}
            />
          ) : null}
          {featureFlags.newWizardAb ? <Route path="/invite/:token" element={<RevampInviteEntryPage />} /> : null}
          {featureFlags.newWizardAb ? (
            <Route
              path="/application/:applicationId/step/1"
              element={(
                <RequireAuth allowedRoles={["SUPPLIER"]}>
                  <RequireRevampOtpForSupplier>
                    <RevampApplicationStep1Page />
                  </RequireRevampOtpForSupplier>
                </RequireAuth>
              )}
            />
          ) : null}
          {featureFlags.newWizardAb ? (
            <Route
              path="/application/:applicationId/step/2"
              element={(
                <RequireAuth allowedRoles={["SUPPLIER"]}>
                  <RequireRevampOtpForSupplier>
                    <RevampApplicationStep2Page />
                  </RequireRevampOtpForSupplier>
                </RequireAuth>
              )}
            />
          ) : null}
          {featureFlags.newWizardAb ? (
            <Route
              path="/application/:applicationId/step/3"
              element={(
                <RequireAuth allowedRoles={["SUPPLIER"]}>
                  <RequireRevampOtpForSupplier>
                    <RevampApplicationStep3Page />
                  </RequireRevampOtpForSupplier>
                </RequireAuth>
              )}
            />
          ) : null}
          {featureFlags.newWizardAb ? (
            <Route
              path="/application/:applicationId/step/4"
              element={(
                <RequireAuth allowedRoles={["SUPPLIER"]}>
                  <RequireRevampOtpForSupplier>
                    <RevampApplicationStep4Page />
                  </RequireRevampOtpForSupplier>
                </RequireAuth>
              )}
            />
          ) : null}
          {featureFlags.newWizardAb ? (
            <Route
              path="/application/:applicationId/step/5"
              element={(
                <RequireAuth allowedRoles={["SUPPLIER"]}>
                  <RequireRevampOtpForSupplier>
                    <RevampApplicationStep5Page />
                  </RequireRevampOtpForSupplier>
                </RequireAuth>
              )}
            />
          ) : null}
          {featureFlags.newWizardAb ? (
            <Route
              path="/application/:applicationId/recap"
              element={(
                <RequireAuth allowedRoles={["SUPPLIER"]}>
                  <RequireRevampOtpForSupplier>
                    <RevampApplicationRecapPage />
                  </RequireRevampOtpForSupplier>
                </RequireAuth>
              )}
            />
          ) : null}
          {featureFlags.newWizardAb ? (
            <Route
              path="/application/:applicationId/submitted"
              element={(
                <RequireAuth allowedRoles={["SUPPLIER"]}>
                  <RequireRevampOtpForSupplier>
                    <RevampApplicationSubmittedPage />
                  </RequireRevampOtpForSupplier>
                </RequireAuth>
              )}
            />
          ) : null}
          <Route
            path="/supplier"
            element={
              <RequireAuth allowedRoles={["SUPPLIER"]}>
                <Navigate to="/supplier/dashboard" replace />
              </RequireAuth>
            }
          />
          <Route
            path="/supplier/dashboard"
            element={
              <RequireAuth allowedRoles={["SUPPLIER"]}>
                {featureFlags.newWizardAb ? <RevampSupplierHomeRedirect /> : <SupplierDashboardPage />}
              </RequireAuth>
            }
          />
          <Route
            path="/supplier/profile"
            element={
              <RequireAuth allowedRoles={["SUPPLIER"]}>
                {featureFlags.newWizardAb ? <RevampSupplierHomeRedirect /> : <SupplierDashboardPage initialStep="profile" />}
              </RequireAuth>
            }
          />
          <Route
            path="/supplier/documents"
            element={
              <RequireAuth allowedRoles={["SUPPLIER"]}>
                {featureFlags.newWizardAb ? <RevampSupplierHomeRedirect /> : <SupplierDashboardPage initialStep="documents" />}
              </RequireAuth>
            }
          />
          <Route
            path="/supplier/communications"
            element={
              <RequireAuth allowedRoles={["SUPPLIER"]}>
                <SupplierCommunicationsPage />
              </RequireAuth>
            }
          />
          <Route
            path="/supplier/renewal"
            element={
              <RequireAuth allowedRoles={["SUPPLIER"]}>
                <SupplierRenewalPage />
              </RequireAuth>
            }
          />
          <Route
            path="/admin"
            element={
              <RequireAuth allowedRoles={["ADMIN"]}>
                <Navigate to="/admin/dashboard" replace />
              </RequireAuth>
            }
          />
          <Route
            path="/admin/dashboard"
            element={
              <RequireAuth allowedRoles={["ADMIN"]}>
                <AdminDashboardPage />
              </RequireAuth>
            }
          />
          <Route
            path="/admin/albo-a"
            element={
              <RequireAuth allowedRoles={["ADMIN"]}>
                <RequireAdminGovernanceRoles allowed={["SUPER_ADMIN", "RESPONSABILE_ALBO", "REVISORE", "VIEWER"]}>
                  <AdminAlboAListPage />
                </RequireAdminGovernanceRoles>
              </RequireAuth>
            }
          />
          <Route
            path="/admin/albo-a/:profileId"
            element={
              <RequireAuth allowedRoles={["ADMIN"]}>
                <RequireAdminGovernanceRoles allowed={["SUPER_ADMIN", "RESPONSABILE_ALBO", "REVISORE", "VIEWER"]}>
                  <AdminRegistryProfileDetailPage />
                </RequireAdminGovernanceRoles>
              </RequireAuth>
            }
          />
          <Route
            path="/admin/albo-b"
            element={
              <RequireAuth allowedRoles={["ADMIN"]}>
                <RequireAdminGovernanceRoles allowed={["SUPER_ADMIN", "RESPONSABILE_ALBO", "REVISORE", "VIEWER"]}>
                  <AdminAlboBListPage />
                </RequireAdminGovernanceRoles>
              </RequireAuth>
            }
          />
          <Route
            path="/admin/albo-b/:profileId"
            element={
              <RequireAuth allowedRoles={["ADMIN"]}>
                <RequireAdminGovernanceRoles allowed={["SUPER_ADMIN", "RESPONSABILE_ALBO", "REVISORE", "VIEWER"]}>
                  <AdminRegistryProfileDetailPage />
                </RequireAdminGovernanceRoles>
              </RequireAuth>
            }
          />
          <Route
            path="/admin/queue"
            element={
              <RequireAuth allowedRoles={["ADMIN"]}>
                <RequireAdminGovernanceRoles allowed={["SUPER_ADMIN", "RESPONSABILE_ALBO", "REVISORE"]}>
                  <AdminQueuePage />
                </RequireAdminGovernanceRoles>
              </RequireAuth>
            }
          />
          <Route
            path="/admin/candidature"
            element={
              <RequireAuth allowedRoles={["ADMIN"]}>
                <RequireAdminGovernanceRoles allowed={["SUPER_ADMIN", "RESPONSABILE_ALBO", "REVISORE"]}>
                  <AdminQueuePage />
                </RequireAdminGovernanceRoles>
              </RequireAuth>
            }
          />
          <Route
            path="/admin/applications/:applicationId"
            element={
              <RequireAuth allowedRoles={["ADMIN"]}>
                <RequireAdminGovernanceRoles allowed={["SUPER_ADMIN", "RESPONSABILE_ALBO", "REVISORE"]}>
                  <AdminApplicationCasePage />
                </RequireAdminGovernanceRoles>
              </RequireAuth>
            }
          />
          <Route
            path="/admin/candidature/:applicationId/review"
            element={
              <RequireAuth allowedRoles={["ADMIN"]}>
                <RequireAdminGovernanceRoles allowed={["SUPER_ADMIN", "RESPONSABILE_ALBO", "REVISORE"]}>
                  <AdminApplicationCasePage />
                </RequireAdminGovernanceRoles>
              </RequireAuth>
            }
          />
          <Route
            path="/admin/integrations/:applicationId"
            element={
              <RequireAuth allowedRoles={["ADMIN"]}>
                <RequireAdminGovernanceRoles allowed={["SUPER_ADMIN", "RESPONSABILE_ALBO", "REVISORE"]}>
                  <AdminIntegrationPage />
                </RequireAdminGovernanceRoles>
              </RequireAuth>
            }
          />
          <Route
            path="/admin/candidature/:applicationId/integration"
            element={
              <RequireAuth allowedRoles={["ADMIN"]}>
                <RequireAdminGovernanceRoles allowed={["SUPER_ADMIN", "RESPONSABILE_ALBO", "REVISORE"]}>
                  <AdminIntegrationPage />
                </RequireAdminGovernanceRoles>
              </RequireAuth>
            }
          />
          <Route
            path="/admin/invites"
            element={
              <RequireAuth allowedRoles={["ADMIN"]}>
                <RequireAdminGovernanceRoles allowed={["SUPER_ADMIN", "RESPONSABILE_ALBO"]}>
                  <AdminInvitesPage mode="manage" />
                </RequireAdminGovernanceRoles>
              </RequireAuth>
            }
          />
          <Route
            path="/admin/invites/new"
            element={
              <RequireAuth allowedRoles={["ADMIN"]}>
                <RequireAdminGovernanceRoles allowed={["SUPER_ADMIN", "RESPONSABILE_ALBO"]}>
                  <AdminInvitesPage mode="new" />
                </RequireAdminGovernanceRoles>
              </RequireAuth>
            }
          />
          <Route
            path="/admin/invites/approval-email-template"
            element={
              <RequireAuth allowedRoles={["ADMIN"]}>
                <RequireAdminGovernanceRoles allowed={["SUPER_ADMIN", "RESPONSABILE_ALBO"]}>
                  <AdminApprovalEmailTemplatePage />
                </RequireAdminGovernanceRoles>
              </RequireAuth>
            }
          />
          <Route
            path="/admin/evaluations"
            element={
              <RequireAuth allowedRoles={["ADMIN"]}>
                <RequireAdminGovernanceRoles allowed={["SUPER_ADMIN", "RESPONSABILE_ALBO", "REVISORE", "VIEWER"]}>
                  <AdminEvaluationsPage mode="search" />
                </RequireAdminGovernanceRoles>
              </RequireAuth>
            }
          />
          <Route
            path="/admin/evaluations/new"
            element={
              <RequireAuth allowedRoles={["ADMIN"]}>
                <RequireAdminGovernanceRoles allowed={["SUPER_ADMIN", "RESPONSABILE_ALBO", "REVISORE"]}>
                  <AdminEvaluationsPage mode="new" />
                </RequireAdminGovernanceRoles>
              </RequireAuth>
            }
          />
          <Route
            path="/admin/evaluations/:supplierId"
            element={
              <RequireAuth allowedRoles={["ADMIN"]}>
                <RequireAdminGovernanceRoles allowed={["SUPER_ADMIN", "RESPONSABILE_ALBO", "REVISORE", "VIEWER"]}>
                  <AdminEvaluationsPage mode="detail" />
                </RequireAdminGovernanceRoles>
              </RequireAuth>
            }
          />
          <Route
            path="/admin/evaluations/new/:supplierId"
            element={
              <RequireAuth allowedRoles={["ADMIN"]}>
                <RequireAdminGovernanceRoles allowed={["SUPER_ADMIN", "RESPONSABILE_ALBO", "REVISORE"]}>
                  <AdminEvaluationsPage mode="new" />
                </RequireAdminGovernanceRoles>
              </RequireAuth>
            }
          />
          <Route
            path="/admin/reports"
            element={
              <RequireAuth allowedRoles={["ADMIN"]}>
                <RequireAdminGovernanceRoles allowed={["SUPER_ADMIN", "RESPONSABILE_ALBO", "REVISORE", "VIEWER"]}>
                  <AdminReportsPage />
                </RequireAdminGovernanceRoles>
              </RequireAuth>
            }
          />
          <Route
            path="/admin/users-roles"
            element={
              <RequireAuth allowedRoles={["ADMIN"]}>
                <RequireAdminGovernanceRoles allowed={["SUPER_ADMIN"]}>
                  <AdminUsersRolesPage />
                </RequireAdminGovernanceRoles>
              </RequireAuth>
            }
          />
          <Route path="*" element={<Navigate to={authenticatedHome} replace />} />
        </Routes>
      </Suspense>
    </AppLayout>
  );
}

