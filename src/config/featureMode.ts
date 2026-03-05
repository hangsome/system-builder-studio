type FeatureMode = 'teaching' | 'commercial' | 'full';

function normalizeMode(value: string | undefined): FeatureMode {
  const normalized = String(value || '').trim().toLowerCase();
  if (normalized === 'teaching') return 'teaching';
  if (normalized === 'commercial') return 'commercial';
  return 'commercial';
}

export const featureMode: FeatureMode = normalizeMode(import.meta.env.VITE_FEATURE_MODE);

export function isTeachingEnabled() {
  return featureMode === 'teaching' || featureMode === 'full';
}

