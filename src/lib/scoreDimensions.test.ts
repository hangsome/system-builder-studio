import { describe, expect, it } from 'vitest';
import { normalizeScoreDimensions } from './scoreDimensions';
import type { SubmissionInfo } from '@/types/edu';

function submissionWithDimensions(
  dimensions: NonNullable<SubmissionInfo['auto_score']>['dimensions'],
): SubmissionInfo {
  return {
    id: 1,
    assignment_id: 1,
    attempt_no: 1,
    auto_total: 46,
    final_total: 46,
    submitted_at: '2026-05-10T00:00:00.000Z',
    auto_score: {
      rubricVersion: 'v1',
      dimensions,
      total: 46,
      reasons: [],
    },
  };
}

describe('normalizeScoreDimensions', () => {
  it('keeps array dimensions from older clients unchanged', () => {
    const dimensions = [
      { id: 'correctness', label: 'correctness', score: 10, max: 30, reason: 'ok' },
    ];

    expect(normalizeScoreDimensions(submissionWithDimensions(dimensions))).toEqual(dimensions);
  });

  it('turns the current backend dimension map into renderable rows', () => {
    const result = normalizeScoreDimensions(
      submissionWithDimensions({
        troubleshooting: { score: 20, max: 20, reason: 'faultPointLength=10' },
        communication: { label: 'communication', score: 16, max: 20, reason: 'summaryLength=14' },
      }),
    );

    expect(result).toEqual([
      {
        id: 'troubleshooting',
        label: 'troubleshooting',
        score: 20,
        max: 20,
        reason: 'faultPointLength=10',
      },
      {
        id: 'communication',
        label: 'communication',
        score: 16,
        max: 20,
        reason: 'summaryLength=14',
      },
    ]);
  });
});
