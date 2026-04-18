export type DocumentFormRow = {
  id: string;
  type: string;
  expiryDate: string;
  notes: string;
  file: File | null;
  lockedType?: boolean;
  lockedExpiry?: boolean;
  excludedType?: string | null;
};

export type InvalidSections = {
  profile: boolean;
  categories: boolean;
  contacts: boolean;
  documents: boolean;
};

export type ToastState = { message: string; type: "error" | "success" } | null;
