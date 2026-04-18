import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { AdminApplicationCasePage } from "./AdminApplicationCasePage";

const getSummaryMock = vi.fn();
const getSectionsMock = vi.fn();
const getHistoryMock = vi.fn();
const getLatestIntegrationMock = vi.fn();
const saveDecisionMock = vi.fn();
let mockedAdminRole: "SUPER_ADMIN" | "RESPONSABILE_ALBO" | "REVISORE" | "VIEWER" | null = "SUPER_ADMIN";

vi.mock("../../auth/AuthContext", () => ({
  useAuth: () => ({
    auth: {
      token: "admin-token",
      role: "ADMIN"
    }
  })
}));

vi.mock("../../api/revampApplicationApi", () => ({
  getRevampApplicationSummary: (...args: unknown[]) => getSummaryMock(...args),
  getRevampApplicationSections: (...args: unknown[]) => getSectionsMock(...args)
}));

vi.mock("../../api/adminReviewApi", () => ({
  getAdminReviewHistory: (...args: unknown[]) => getHistoryMock(...args),
  getLatestAdminIntegrationRequest: (...args: unknown[]) => getLatestIntegrationMock(...args),
  saveAdminReviewDecision: (...args: unknown[]) => saveDecisionMock(...args)
}));

vi.mock("../../hooks/useAdminGovernanceRole", () => ({
  useAdminGovernanceRole: () => ({
    adminRole: mockedAdminRole,
    loading: false,
    resolved: true
  })
}));

function renderPage() {
  return render(
    <MemoryRouter initialEntries={["/admin/candidature/9e7775d9-9719-4bb7-9d8e-1f0ab1e4b2f6/review"]}>
      <Routes>
        <Route path="/admin/candidature/:applicationId/review" element={<AdminApplicationCasePage />} />
        <Route path="/admin/candidature/:applicationId/integration" element={<div>Integration destination</div>} />
      </Routes>
    </MemoryRouter>
  );
}

describe("AdminApplicationCasePage", () => {
  beforeEach(() => {
    getSummaryMock.mockReset();
    getSectionsMock.mockReset();
    getHistoryMock.mockReset();
    getLatestIntegrationMock.mockReset();
    saveDecisionMock.mockReset();
    mockedAdminRole = "SUPER_ADMIN";
    getLatestIntegrationMock.mockResolvedValue(null);
  });

  it("renders urgency banner and all three decision actions", async () => {
    getSummaryMock.mockResolvedValue({
      id: "9e7775d9-9719-4bb7-9d8e-1f0ab1e4b2f6",
      applicantUserId: "supplier-1",
      registryType: "ALBO_A",
      sourceChannel: "PUBLIC",
      status: "SUBMITTED",
      protocolCode: "A-2026-0042",
      currentRevision: 1,
      submittedAt: "2026-04-01T10:00:00Z",
      updatedAt: "2026-04-10T10:00:00Z"
    });
    getSectionsMock.mockResolvedValue([
      {
        id: "sec-1",
        applicationId: "9e7775d9-9719-4bb7-9d8e-1f0ab1e4b2f6",
        sectionKey: "STEP_1_ANAGRAFICA",
        sectionVersion: 1,
        completed: true,
        payloadJson: "{}",
        updatedAt: "2026-04-10T10:00:00Z"
      }
    ]);
    getHistoryMock.mockResolvedValue([
      {
        id: "case-1",
        applicationId: "9e7775d9-9719-4bb7-9d8e-1f0ab1e4b2f6",
        status: "IN_PROGRESS",
        decision: null,
        updatedAt: "2026-04-10T10:00:00Z"
      }
    ]);

    renderPage();

    expect(await screen.findByText(/oltre la soglia di alert/i)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Approva" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Invia richiesta" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Rigetta" })).toBeInTheDocument();
  });

  it("submits approve decision with reason", async () => {
    getSummaryMock.mockResolvedValue({
      id: "9e7775d9-9719-4bb7-9d8e-1f0ab1e4b2f6",
      applicantUserId: "supplier-1",
      registryType: "ALBO_A",
      sourceChannel: "PUBLIC",
      status: "SUBMITTED",
      protocolCode: "A-2026-0042",
      currentRevision: 1,
      submittedAt: "2026-04-14T10:00:00Z",
      updatedAt: "2026-04-15T10:00:00Z"
    });
    getSectionsMock.mockResolvedValue([]);
    getHistoryMock.mockResolvedValue([
      {
        id: "case-approve",
        applicationId: "9e7775d9-9719-4bb7-9d8e-1f0ab1e4b2f6",
        status: "IN_PROGRESS",
        decision: null,
        updatedAt: "2026-04-15T10:00:00Z"
      }
    ]);
    saveDecisionMock.mockResolvedValue({
      id: "case-approve",
      applicationId: "9e7775d9-9719-4bb7-9d8e-1f0ab1e4b2f6",
      status: "DECIDED",
      decision: "APPROVED",
      updatedAt: "2026-04-16T10:00:00Z"
    });

    const user = userEvent.setup();
    renderPage();

    await screen.findByText("Decisione sulla candidatura");
    await user.type(screen.getByLabelText("Motivazione approvazione"), "Documentazione completa.");
    await user.click(screen.getByRole("button", { name: "Approva" }));

    await waitFor(() => {
      expect(saveDecisionMock).toHaveBeenCalledWith("case-approve", "admin-token", {
        decision: "APPROVED",
        reason: "Documentazione completa."
      });
    });
  });

  it("navigates to integration page after integration decision", async () => {
    getSummaryMock.mockResolvedValue({
      id: "9e7775d9-9719-4bb7-9d8e-1f0ab1e4b2f6",
      applicantUserId: "supplier-1",
      registryType: "ALBO_A",
      sourceChannel: "PUBLIC",
      status: "SUBMITTED",
      protocolCode: "A-2026-0042",
      currentRevision: 1,
      submittedAt: "2026-04-14T10:00:00Z",
      updatedAt: "2026-04-15T10:00:00Z"
    });
    getSectionsMock.mockResolvedValue([]);
    getHistoryMock.mockResolvedValue([
      {
        id: "case-integration",
        applicationId: "9e7775d9-9719-4bb7-9d8e-1f0ab1e4b2f6",
        status: "IN_PROGRESS",
        decision: null,
        updatedAt: "2026-04-15T10:00:00Z"
      }
    ]);
    saveDecisionMock.mockResolvedValue({
      id: "case-integration",
      applicationId: "9e7775d9-9719-4bb7-9d8e-1f0ab1e4b2f6",
      status: "WAITING_SUPPLIER_RESPONSE",
      decision: "INTEGRATION_REQUIRED",
      updatedAt: "2026-04-16T10:00:00Z"
    });

    const user = userEvent.setup();
    renderPage();

    await screen.findByText("Decisione sulla candidatura");
    await user.type(screen.getByLabelText("Motivazione integrazione"), "Manca documento identita.");
    await user.click(screen.getByRole("button", { name: "Invia richiesta" }));

    await waitFor(() => {
      expect(saveDecisionMock).toHaveBeenCalledWith("case-integration", "admin-token", {
        decision: "INTEGRATION_REQUIRED",
        reason: "Manca documento identita."
      });
    });
    expect(await screen.findByText("Integration destination")).toBeInTheDocument();
  });

  it("renders payload-backed candidate title and keeps viewer in read-only mode", async () => {
    mockedAdminRole = "VIEWER";
    getSummaryMock.mockResolvedValue({
      id: "9e7775d9-9719-4bb7-9d8e-1f0ab1e4b2f6",
      applicantUserId: "supplier-1",
      registryType: "ALBO_B",
      sourceChannel: "PUBLIC",
      status: "SUBMITTED",
      protocolCode: "A-2026-0042",
      currentRevision: 1,
      submittedAt: "2026-04-14T10:00:00Z",
      updatedAt: "2026-04-15T10:00:00Z"
    });
    getSectionsMock.mockResolvedValue([
      {
        id: "sec-s1",
        applicationId: "9e7775d9-9719-4bb7-9d8e-1f0ab1e4b2f6",
        sectionKey: "S1",
        sectionVersion: 1,
        completed: true,
        payloadJson: JSON.stringify({
          companyName: "Alpha Form SRL",
          vatNumber: "IT123",
          operationalContactEmail: "ops@alpha.test"
        }),
        updatedAt: "2026-04-15T10:00:00Z"
      }
    ]);
    getHistoryMock.mockResolvedValue([
      {
        id: "case-viewer",
        applicationId: "9e7775d9-9719-4bb7-9d8e-1f0ab1e4b2f6",
        status: "IN_PROGRESS",
        decision: null,
        updatedAt: "2026-04-15T10:00:00Z"
      }
    ]);

    renderPage();

    expect(await screen.findByRole("heading", { name: "Alpha Form SRL" })).toBeInTheDocument();
    expect(screen.getByText(/Ruolo VIEWER/i)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Approva" })).toBeDisabled();
  });

  it("shows latest integration-request details when available", async () => {
    getSummaryMock.mockResolvedValue({
      id: "9e7775d9-9719-4bb7-9d8e-1f0ab1e4b2f6",
      applicantUserId: "supplier-1",
      registryType: "ALBO_A",
      sourceChannel: "PUBLIC",
      status: "INTEGRATION_REQUIRED",
      protocolCode: "A-2026-0042",
      currentRevision: 1,
      submittedAt: "2026-04-14T10:00:00Z",
      updatedAt: "2026-04-15T10:00:00Z"
    });
    getSectionsMock.mockResolvedValue([]);
    getHistoryMock.mockResolvedValue([
      {
        id: "case-1",
        applicationId: "9e7775d9-9719-4bb7-9d8e-1f0ab1e4b2f6",
        status: "WAITING_SUPPLIER_RESPONSE",
        decision: "INTEGRATION_REQUIRED",
        updatedAt: "2026-04-15T10:00:00Z"
      }
    ]);
    getLatestIntegrationMock.mockResolvedValue({
      id: "int-1",
      reviewCaseId: "case-1",
      status: "OPEN",
      dueAt: "2026-04-30T00:00:00",
      requestMessage: "Caricare i file mancanti",
      requestedItemsJson: { items: [{ code: "ID_DOCUMENT" }] },
      updatedAt: "2026-04-16T10:00:00Z"
    });

    renderPage();

    expect(await screen.findByText("Ultima richiesta integrazione")).toBeInTheDocument();
    expect(screen.getByText(/Caricare i file mancanti/i)).toBeInTheDocument();
  });

  it("keeps revisore unable to approve/reject but allowed to request integration", async () => {
    mockedAdminRole = "REVISORE";
    getSummaryMock.mockResolvedValue({
      id: "9e7775d9-9719-4bb7-9d8e-1f0ab1e4b2f6",
      applicantUserId: "supplier-1",
      registryType: "ALBO_A",
      sourceChannel: "PUBLIC",
      status: "UNDER_REVIEW",
      protocolCode: "A-2026-0042",
      currentRevision: 1,
      submittedAt: "2026-04-14T10:00:00Z",
      updatedAt: "2026-04-15T10:00:00Z"
    });
    getSectionsMock.mockResolvedValue([]);
    getHistoryMock.mockResolvedValue([
      {
        id: "case-rev",
        applicationId: "9e7775d9-9719-4bb7-9d8e-1f0ab1e4b2f6",
        status: "IN_PROGRESS",
        decision: null,
        updatedAt: "2026-04-15T10:00:00Z"
      }
    ]);

    renderPage();

    await screen.findByText("Decisione sulla candidatura");
    expect(screen.getByRole("button", { name: "Approva" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "Rigetta" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "Invia richiesta" })).toBeEnabled();
  });

  it("renders finalized case in read-only mode", async () => {
    getSummaryMock.mockResolvedValue({
      id: "9e7775d9-9719-4bb7-9d8e-1f0ab1e4b2f6",
      applicantUserId: "supplier-1",
      registryType: "ALBO_A",
      sourceChannel: "PUBLIC",
      status: "APPROVED",
      protocolCode: "A-2026-0042",
      currentRevision: 1,
      submittedAt: "2026-04-14T10:00:00Z",
      updatedAt: "2026-04-15T10:00:00Z"
    });
    getSectionsMock.mockResolvedValue([]);
    getHistoryMock.mockResolvedValue([
      {
        id: "case-final",
        applicationId: "9e7775d9-9719-4bb7-9d8e-1f0ab1e4b2f6",
        status: "DECIDED",
        decision: "APPROVED",
        updatedAt: "2026-04-15T10:00:00Z"
      }
    ]);

    renderPage();

    expect(await screen.findByText(/decisione finale registrata/i)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Approva" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "Invia richiesta" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "Rigetta" })).toBeDisabled();
  });
});
