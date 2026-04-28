function parseFlag(value: string | undefined, defaultValue = false): boolean {
  if (!value) return defaultValue;
  const normalized = value.trim().toLowerCase();
  return normalized === "1" || normalized === "true" || normalized === "yes" || normalized === "on";
}

export const featureFlags = {
  newWizardAb: parseFlag(import.meta.env.VITE_FEATURE_NEW_WIZARD_AB, true),
  adminV2: parseFlag(import.meta.env.VITE_FEATURE_ADMIN_V2, true),
  evaluationV2: parseFlag(import.meta.env.VITE_FEATURE_EVALUATION_V2, true),
  renewalV2: parseFlag(import.meta.env.VITE_FEATURE_RENEWAL_V2, true)
} as const;
