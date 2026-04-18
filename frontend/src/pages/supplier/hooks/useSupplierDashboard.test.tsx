import { renderHook, waitFor } from "@testing-library/react";
import type { CategoryResponse, DocumentResponse, SupplierProfileResponse } from "../../../types/api";
import { useSupplierDashboard } from "./useSupplierDashboard";

vi.mock("../../../auth/AuthContext", () => ({
  useAuth: () => ({ auth: { token: "test-token" } })
}));

vi.mock("../../../i18n/I18nContext", () => ({
  useI18n: () => ({
    language: "en",
    t: (key: string) => key
  })
}));

const getSupplierProfileMock = vi.fn();
const getSupplierDocumentsMock = vi.fn();
const fetchCategoryTreeMock = vi.fn();

vi.mock("../../../api/supplierApi", () => ({
  getSupplierProfile: (...args: unknown[]) => getSupplierProfileMock(...args),
  getSupplierDocuments: (...args: unknown[]) => getSupplierDocumentsMock(...args),
  addSupplierContact: vi.fn(),
  assignSupplierCategories: vi.fn(),
  removeSupplierContact: vi.fn(),
  submitSupplierProfile: vi.fn(),
  updateSupplierProfile: vi.fn(),
  uploadSupplierDocument: vi.fn()
}));

vi.mock("../../../api/categoryApi", () => ({
  fetchCategoryTree: (...args: unknown[]) => fetchCategoryTreeMock(...args)
}));

describe("useSupplierDashboard", () => {
  it("loads profile, categories and documents", async () => {
    const profile: SupplierProfileResponse = {
      id: "profile-1",
      userId: "user-1",
      status: "DRAFT",
      createdAt: "2026-01-01T00:00:00",
      updatedAt: "2026-01-01T00:00:00",
      contacts: [],
      categories: [{ id: "cat-1", code: "A", name: "Agriculture" }],
      companyName: "Acme"
    };
    const categories: CategoryResponse[] = [{ id: "cat-1", code: "A", name: "Agriculture", parentId: null, children: [] }];
    const documents: DocumentResponse[] = [];

    getSupplierProfileMock.mockResolvedValue(profile);
    fetchCategoryTreeMock.mockResolvedValue(categories);
    getSupplierDocumentsMock.mockResolvedValue(documents);

    const { result } = renderHook(() => useSupplierDashboard());

    await waitFor(() => expect(result.current.loading).toBe(false));

    expect(result.current.profile?.id).toBe("profile-1");
    expect(result.current.flatCategoryList).toEqual([{ id: "cat-1", label: "Agriculture", code: "A" }]);
    expect(result.current.documents).toEqual([]);
    expect(result.current.isEditable).toBe(true);
  });
});
