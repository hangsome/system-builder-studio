import type { ScoreDimension, SubmissionInfo } from '@/types/edu';

export function normalizeScoreDimensions(submission: SubmissionInfo): ScoreDimension[] {
  const dimensions = submission.auto_score?.dimensions;
  if (!dimensions) return [];
  if (Array.isArray(dimensions)) return dimensions;

  return Object.entries(dimensions).map(([id, dimension]) => ({
    id: dimension.id || id,
    label: dimension.label || id,
    score: Number(dimension.score || 0),
    max: Number(dimension.max || 0),
    reason: dimension.reason || '',
    checks: Array.isArray(dimension.checks) ? dimension.checks : undefined,
  }));
}
