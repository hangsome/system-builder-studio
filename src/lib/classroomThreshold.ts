import { CLASSROOM_TEMPERATURE_THRESHOLD } from '@/data/classroomLesson';

export function getClassroomTemperatureThreshold(code?: string) {
  const text = String(code || '');
  const assignmentMatch = text.match(/\bTEMP_THRESHOLD\s*=\s*(-?\d+(?:\.\d+)?)/i);
  if (!assignmentMatch) return CLASSROOM_TEMPERATURE_THRESHOLD;

  const threshold = Number(assignmentMatch[1]);
  return Number.isFinite(threshold) ? threshold : CLASSROOM_TEMPERATURE_THRESHOLD;
}
