import { apiRequest } from "./http";

export type SupportContactPayload = {
  name: string;
  email: string;
  message: string;
  language: "it" | "en";
};

export function submitSupportContact(payload: SupportContactPayload) {
  return apiRequest<{ submitted: boolean }>("/api/support/contact", {
    method: "POST",
    body: JSON.stringify(payload)
  });
}

