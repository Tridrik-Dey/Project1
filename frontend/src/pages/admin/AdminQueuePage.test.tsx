import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import { AdminQueuePage } from "./AdminQueuePage";

const getAdminReviewQueueMock = vi.fn();
const assignAdminReviewCaseMock = vi.fn();

vi.mock("../../auth/AuthContext", () => ({
  useAuth: () => ({
    auth: {
      token: "admin-token",
      role: "ADMIN"
    }
  })
}));

vi.mock("../../api/adminReviewApi", () => ({
  getAdminReviewQueue: (...args: unknown[]) => getAdminReviewQueueMock(...args),
  assignAdminReviewCase: (...args: unknown[]) => assignAdminReviewCaseMock(...args)
}));

vi.mock("../../hooks/useAdminGovernanceRole", () => ({
  useAdminGovernanceRole: () => ({
    adminRole: "SUPER_ADMIN",
    loading: false,
    resolved: true
  })
}));

function isoDaysAgo(days: number): string {
  return new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString();
}

describe("AdminQueuePage", () => {
  beforeEach(() => {
    getAdminReviewQueueMock.mockReset();
    assignAdminReviewCaseMock.mockReset();
  });

  it("renders queue KPIs and marks urgent rows with primary action", async () => {
    getAdminReviewQueueMock.mockResolvedValue([
      {
        id: "case-1",
        applicationId: "11111111-1111-4111-8111-111111111111",
        status: "PENDING_ASSIGNMENT",
        decision: null,
        updatedAt: isoDaysAgo(7)
      },
      {
        id: "case-2",
        applicationId: "22222222-2222-4222-8222-222222222222",
        status: "IN_PROGRESS",
        decision: "APPROVED",
        updatedAt: isoDaysAgo(1)
      }
    ]);

    render(
      <MemoryRouter>
        <AdminQueuePage />
      </MemoryRouter>
    );

    expect(await screen.findByText("In attesa revisione")).toBeInTheDocument();
    expect(screen.getByText("Integrazione richiesta")).toBeInTheDocument();
    expect(screen.getAllByText("Prese in carico").length).toBeGreaterThan(0);

    const examineButtons = await screen.findAllByRole("link", { name: "Esamina" });
    expect(examineButtons.length).toBe(2);
    expect(examineButtons.some((button) => button.className.includes("queue-action-primary"))).toBe(true);
  });

  it("filters rows by integration tab", async () => {
    getAdminReviewQueueMock.mockResolvedValue([
      {
        id: "case-1",
        applicationId: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
        status: "WAITING_SUPPLIER_RESPONSE",
        decision: "INTEGRATION_REQUIRED",
        updatedAt: isoDaysAgo(3)
      },
      {
        id: "case-2",
        applicationId: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb",
        status: "PENDING_ASSIGNMENT",
        decision: null,
        updatedAt: isoDaysAgo(2)
      }
    ]);

    const user = userEvent.setup();
    render(
      <MemoryRouter>
        <AdminQueuePage />
      </MemoryRouter>
    );

    await screen.findByText("APP-AAAAAAAA");
    await user.click(screen.getByRole("button", { name: /Integrazione/i }));

    expect(screen.getByText("APP-AAAAAAAA")).toBeInTheDocument();
    expect(screen.queryByText("APP-BBBBBBBB")).not.toBeInTheDocument();
  });

  it("builds action links to review and integration routes", async () => {
    getAdminReviewQueueMock.mockResolvedValue([
      {
        id: "case-1",
        applicationId: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
        status: "PENDING_ASSIGNMENT",
        decision: null,
        updatedAt: isoDaysAgo(1)
      }
    ]);

    render(
      <MemoryRouter>
        <AdminQueuePage />
      </MemoryRouter>
    );

    const reviewLink = await screen.findByRole("link", { name: "Esamina" });
    const integrationLink = screen.getByRole("link", { name: "Integrazione" });

    expect(reviewLink.getAttribute("href")).toContain("/admin/candidature/aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa/review");
    expect(integrationLink.getAttribute("href")).toContain("/admin/candidature/aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa/integration");
  });

  it("allows taking in charge for pending cases", async () => {
    getAdminReviewQueueMock.mockResolvedValueOnce([
      {
        id: "case-1",
        applicationId: "cccccccc-cccc-4ccc-8ccc-cccccccccccc",
        status: "PENDING_ASSIGNMENT",
        decision: null,
        updatedAt: isoDaysAgo(2)
      }
    ]).mockResolvedValueOnce([
      {
        id: "case-2",
        applicationId: "cccccccc-cccc-4ccc-8ccc-cccccccccccc",
        status: "IN_PROGRESS",
        decision: null,
        assignedToDisplayName: "Admin Test",
        updatedAt: isoDaysAgo(1)
      }
    ]);
    assignAdminReviewCaseMock.mockResolvedValue({
      id: "case-2",
      applicationId: "cccccccc-cccc-4ccc-8ccc-cccccccccccc",
      status: "IN_PROGRESS",
      decision: null,
      updatedAt: isoDaysAgo(1)
    });

    const user = userEvent.setup();
    render(
      <MemoryRouter>
        <AdminQueuePage />
      </MemoryRouter>
    );

    await screen.findByText("APP-CCCCCCCC");
    await user.click(screen.getByRole("button", { name: "Prendi in carico" }));

    expect(assignAdminReviewCaseMock).toHaveBeenCalled();
  });

  it("shows due-date urgency label for waiting supplier response rows", async () => {
    getAdminReviewQueueMock.mockResolvedValue([
      {
        id: "case-waiting",
        applicationId: "dddddddd-dddd-4ddd-8ddd-dddddddddddd",
        status: "WAITING_SUPPLIER_RESPONSE",
        decision: "INTEGRATION_REQUIRED",
        slaDueAt: "2099-01-02T00:00:00Z",
        updatedAt: isoDaysAgo(1)
      }
    ]);

    render(
      <MemoryRouter>
        <AdminQueuePage />
      </MemoryRouter>
    );

    expect(await screen.findByText(/ON_TRACK/i)).toBeInTheDocument();
  });
});
