function parseFlag(value: string | undefined): boolean {
  if (!value) return false;
  const normalized = value.trim().toLowerCase();
  return normalized === "1" || normalized === "true" || normalized === "yes" || normalized === "on";
}

export const featureFlags = {
  newWizardAb: parseFlag(import.meta.env.VITE_FEATURE_NEW_WIZARD_AB),
  adminV2: parseFlag(import.meta.env.VITE_FEATURE_ADMIN_V2),
  evaluationV2: parseFlag(import.meta.env.VITE_FEATURE_EVALUATION_V2),
  renewalV2: parseFlag(import.meta.env.VITE_FEATURE_RENEWAL_V2)
} as const;

