export type FeatureMode = 'teaching' | 'commercial' | 'full';

export function normalizeFeatureMode(value: string | undefined): FeatureMode {
  const normalized = String(value || '').trim().toLowerCase();
  if (normalized === 'teaching') return 'teaching';
  if (normalized === 'commercial') return 'commercial';
  if (normalized === 'full') return 'full';
  return 'commercial';
}

export function resolveBooleanFlag(value: string | undefined, defaultValue: boolean) {
  const normalized = String(value || '').trim().toLowerCase();
  if (!normalized) return defaultValue;
  return ['1', 'true', 'yes', 'on'].includes(normalized);
}

export const featureMode: FeatureMode = normalizeFeatureMode(import.meta.env.VITE_FEATURE_MODE);

export function isTeachingEnabled() {
  return featureMode === 'teaching' || featureMode === 'full';
}

export function isCommercialEnabled() {
  return featureMode === 'commercial' || featureMode === 'full';
}

export function isLicenseRequired() {
  return resolveBooleanFlag(import.meta.env.VITE_REQUIRE_LICENSE, featureMode === 'commercial');
}

export function isOpenClassEnabled() {
  return resolveBooleanFlag(import.meta.env.VITE_ENABLE_OPENCLASS, isTeachingEnabled());
}
