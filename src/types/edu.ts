export type UserRole = 'admin' | 'teacher' | 'student';

export interface AuthUser {
  id: number;
  username: string;
  role: UserRole;
  displayName: string;
  mustChangePassword?: boolean;
  createdAt?: string;
}

export interface ScenarioInfo {
  id: string;
  name: string;
  description: string;
  requiredComponents?: string[];
  requiredConnections?: string[][];
}

export interface ClassInfo {
  id: number;
  name: string;
  class_code: string;
  term?: string;
  teacher_id: number;
  teacher_name?: string;
  student_count?: number;
  student_no?: string;
}

export interface StudentInfo {
  id: number;
  username: string;
  display_name: string;
  student_no: string;
  status: string;
  created_at: string;
}

export interface AssignmentInfo {
  id: number;
  class_id: number;
  scenario_id: string;
  title: string;
  description: string;
  due_at: string | null;
  created_at?: string;
  class_name?: string;
  class_code?: string;
  attempt_count?: number;
  latest_score?: number | null;
}

export interface ScoreDimension {
  id: string;
  label: string;
  score: number;
  max: number;
  reason: string;
}

export type ScoreDimensionMap = Record<
  string,
  Partial<ScoreDimension> & Pick<ScoreDimension, 'score' | 'max' | 'reason'>
>;

export interface AutoScore {
  rubricVersion: string;
  dimensions: ScoreDimension[] | ScoreDimensionMap;
  total: number;
  reasons: string[];
}

export interface SubmissionInfo {
  id: number;
  assignment_id: number;
  student_id?: number;
  attempt_no: number;
  auto_total: number;
  final_total: number;
  teacher_comment?: string | null;
  submitted_at: string;
  graded_at?: string | null;
  username?: string;
  display_name?: string;
  submitted_student_name?: string;
  submitted_seat_no?: string;
  title?: string;
  scenario_id?: string;
  class_name?: string;
  auto_score?: AutoScore | null;
}

export interface SubmissionDetail extends SubmissionInfo {
  snapshot: Record<string, unknown>;
  evidence: Record<string, unknown> | null;
  lab_report: Record<string, unknown> | null;
  teacher_override?: Record<string, unknown> | null;
  assignment_title?: string;
}

export interface TeacherInfo {
  id: number;
  username: string;
  display_name: string;
  status: string;
  created_at: string;
}
