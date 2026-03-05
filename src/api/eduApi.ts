import { httpJson } from '@/api/http';
import {
  AssignmentInfo,
  ClassInfo,
  ScenarioInfo,
  StudentInfo,
  SubmissionDetail,
  SubmissionInfo,
  TeacherInfo,
} from '@/types/edu';

export function getScenariosApi(token: string) {
  return httpJson<{ scenarios: ScenarioInfo[] }>('/edu/scenarios', {
    method: 'GET',
    token,
  });
}

export function getClassesApi(token: string) {
  return httpJson<{ classes: ClassInfo[] }>('/edu/classes', {
    method: 'GET',
    token,
  });
}

export function createClassApi(
  token: string,
  payload: { name: string; term?: string; teacherId?: number }
) {
  return httpJson<{
    success: boolean;
    class: { id: number; name: string; classCode: string; teacherId: number; term: string };
  }>('/edu/classes', {
    method: 'POST',
    token,
    body: payload,
  });
}

export function importStudentsCsvApi(token: string, classId: number, csvText: string) {
  return httpJson<{
    success: boolean;
    imported: { studentNo: string; username: string; displayName: string; initialPassword: string }[];
    failed: { row: number; reason: string }[];
  }>(`/edu/classes/${classId}/students/import-csv`, {
    method: 'POST',
    token,
    body: { csvText },
  });
}

export function getClassStudentsApi(token: string, classId: number) {
  return httpJson<{ students: StudentInfo[] }>(`/edu/classes/${classId}/students`, {
    method: 'GET',
    token,
  });
}

export function createAssignmentApi(
  token: string,
  classId: number,
  payload: { scenarioId: string; title: string; description?: string; dueAt?: string | null }
) {
  return httpJson<{
    success: boolean;
    assignment: { id: number; classId: number; scenarioId: string; title: string; description: string; dueAt: string | null };
  }>(`/edu/classes/${classId}/assignments`, {
    method: 'POST',
    token,
    body: payload,
  });
}

export function getClassAssignmentsApi(token: string, classId: number) {
  return httpJson<{ assignments: AssignmentInfo[] }>(`/edu/classes/${classId}/assignments`, {
    method: 'GET',
    token,
  });
}

export function getAssignmentSubmissionsApi(token: string, assignmentId: number) {
  return httpJson<{ submissions: SubmissionInfo[] }>(`/edu/assignments/${assignmentId}/submissions`, {
    method: 'GET',
    token,
  });
}

export function getSubmissionDetailApi(token: string, submissionId: number) {
  return httpJson<{ submission: SubmissionDetail }>(`/edu/submissions/${submissionId}`, {
    method: 'GET',
    token,
  });
}

export function submitAssignmentApi(
  token: string,
  assignmentId: number,
  payload: { snapshot: Record<string, unknown>; evidence: Record<string, unknown>; labReport: Record<string, unknown> }
) {
  return httpJson<{
    success: boolean;
    submission: {
      id: number;
      assignmentId: number;
      attemptNo: number;
      autoScore: Record<string, unknown>;
      finalTotal: number;
    };
  }>(`/edu/assignments/${assignmentId}/submissions`, {
    method: 'POST',
    token,
    body: payload,
  });
}

export function overrideSubmissionScoreApi(
  token: string,
  submissionId: number,
  payload: { finalTotal: number; comment?: string; reason?: string; rubricOverride?: Record<string, unknown> | null }
) {
  return httpJson<{
    success: boolean;
    score: { previousScore: number; finalTotal: number; comment: string };
  }>(`/edu/submissions/${submissionId}/score`, {
    method: 'PATCH',
    token,
    body: payload,
  });
}

export function getMyAssignmentsApi(token: string) {
  return httpJson<{ assignments: AssignmentInfo[] }>('/edu/me/assignments', {
    method: 'GET',
    token,
  });
}

export function getMySubmissionsApi(token: string, assignmentId?: number) {
  const suffix = assignmentId ? `?assignmentId=${assignmentId}` : '';
  return httpJson<{ submissions: SubmissionInfo[] }>(`/edu/me/submissions${suffix}`, {
    method: 'GET',
    token,
  });
}

export function createTeacherApi(
  token: string,
  payload: { username: string; displayName: string; password: string }
) {
  return httpJson<{
    success: boolean;
    teacher: { id: number; username: string; displayName: string };
  }>('/edu/admin/teachers', {
    method: 'POST',
    token,
    body: payload,
  });
}

export function getTeachersApi(token: string) {
  return httpJson<{ teachers: TeacherInfo[] }>('/edu/admin/teachers', {
    method: 'GET',
    token,
  });
}

export function deleteTeacherApi(token: string, teacherId: number) {
  return httpJson<{
    success: boolean;
    teacher: { id: number; username: string; displayName: string; deletedClassCount: number };
  }>(`/edu/admin/teachers/${teacherId}`, {
    method: 'DELETE',
    token,
  });
}

export function deleteClassApi(token: string, classId: number) {
  return httpJson<{
    success: boolean;
    class: { id: number; name: string; classCode: string };
  }>(`/edu/classes/${classId}`, {
    method: 'DELETE',
    token,
  });
}

export function removeStudentFromClassApi(token: string, classId: number, studentId: number) {
  return httpJson<{
    success: boolean;
    student: { id: number; username: string; displayName: string; studentNo: string };
    accountDisabled: boolean;
    remainingClassCount: number;
  }>(`/edu/classes/${classId}/students/${studentId}`, {
    method: 'DELETE',
    token,
  });
}
