import type { CategoryResponse } from "../types/api";
import { apiRequest } from "./http";

export function fetchCategoryTree(token: string, language: "it" | "en"): Promise<CategoryResponse[]> {
  return apiRequest<CategoryResponse[]>(`/api/categories/tree?lang=${language}`, {}, token);
}
