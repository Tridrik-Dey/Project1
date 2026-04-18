import type { DocumentResponse, SupplierProfileResponse } from "../types/api";
import type { SupplierContactRequest, SupplierProfileRequest } from "../types/forms";
import { apiRequest } from "./http";

export function getSupplierProfile(token: string): Promise<SupplierProfileResponse> {
  return apiRequest<SupplierProfileResponse>("/api/supplier/profile", {}, token);
}

export function updateSupplierProfile(
  token: string,
  payload: SupplierProfileRequest
): Promise<SupplierProfileResponse> {
  return apiRequest<SupplierProfileResponse>("/api/supplier/profile", {
    method: "PUT",
    body: JSON.stringify(payload)
  }, token);
}

export function submitSupplierProfile(token: string): Promise<SupplierProfileResponse> {
  return apiRequest<SupplierProfileResponse>("/api/supplier/profile/submit", { method: "POST" }, token);
}

export function assignSupplierCategories(
  token: string,
  categoryIds: string[]
): Promise<SupplierProfileResponse> {
  return apiRequest<SupplierProfileResponse>("/api/supplier/profile/categories", {
    method: "POST",
    body: JSON.stringify({ categoryIds })
  }, token);
}

export function addSupplierContact(
  token: string,
  payload: SupplierContactRequest
): Promise<SupplierProfileResponse> {
  return apiRequest<SupplierProfileResponse>("/api/supplier/profile/contacts", {
    method: "POST",
    body: JSON.stringify(payload)
  }, token);
}

export function removeSupplierContact(token: string, contactId: string): Promise<void> {
  return apiRequest<void>(`/api/supplier/profile/contacts/${contactId}`, { method: "DELETE" }, token);
}

export function getSupplierDocuments(token: string, supplierId: string): Promise<DocumentResponse[]> {
  return apiRequest<DocumentResponse[]>(`/api/documents/${supplierId}`, {}, token);
}

export function uploadSupplierDocument(
  token: string,
  supplierId: string,
  file: File,
  type: string,
  expiryDate?: string,
  notes?: string
): Promise<DocumentResponse> {
  const formData = new FormData();
  formData.append("file", file);
  formData.append("type", type);
  if (expiryDate) formData.append("expiryDate", expiryDate);
  if (notes) formData.append("notes", notes);

  return apiRequest<DocumentResponse>(`/api/documents/upload/${supplierId}`, {
    method: "POST",
    body: formData
  }, token);
}

export function removeSupplierDocument(token: string, documentId: string): Promise<void> {
  return apiRequest<void>(`/api/documents/${documentId}`, { method: "DELETE" }, token);
}
