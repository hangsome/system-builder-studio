import { FormEvent, ReactNode, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  AlertTriangle,
  BookOpenCheck,
  CheckCircle2,
  ClipboardList,
  Eye,
  FileText,
  GraduationCap,
  Loader2,
  RefreshCw,
  Send,
  Users,
  XCircle,
} from 'lucide-react';
import { toast } from 'sonner';
import { AuthTopBar } from '@/components/auth/AuthTopBar';
import { ScoreTrace } from '@/components/edu/ScoreTrace';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Progress } from '@/components/ui/progress';
import { Skeleton } from '@/components/ui/skeleton';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Textarea } from '@/components/ui/textarea';
import {
  createAssignmentApi,
  createClassApi,
  deleteClassApi,
  getAssignmentSubmissionsApi,
  getClassAssignmentsApi,
  getClassesApi,
  getClassStudentsApi,
  getScenariosApi,
  importStudentsCsvApi,
  overrideSubmissionScoreApi,
  removeStudentFromClassApi,
} from '@/api/eduApi';
import { normalizeScoreDimensions } from '@/lib/scoreDimensions';
import { cn } from '@/lib/utils';
import { useAuthStore } from '@/store/authStore';
import { AssignmentInfo, ClassInfo, ScenarioInfo, StudentInfo, SubmissionInfo } from '@/types/edu';

interface ScoreOverrideDraft {
  finalTotal: string;
  comment: string;
  reason: string;
}

interface ImportFeedback {
  importedCount: number;
  failed: { row: number; reason: string }[];
}

interface MetricCardProps {
  title: string;
  value: string | number;
  hint: string;
  icon: ReactNode;
  muted?: boolean;
}

const DATE_TIME_FORMATTER = new Intl.DateTimeFormat('zh-CN', {
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
  hour: '2-digit',
  minute: '2-digit',
});

function formatDateTime(value?: string | null) {
  if (!value) return '未设置';

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;

  return DATE_TIME_FORMATTER.format(date);
}

function formatScore(value: number | null) {
  if (value === null || Number.isNaN(value)) return '-';
  return Number.isInteger(value) ? String(value) : value.toFixed(1);
}

function getAssignmentStatus(assignment: AssignmentInfo) {
  if (!assignment.due_at) return { label: '未设截止', variant: 'outline' as const };

  const dueTime = new Date(assignment.due_at).getTime();
  if (!Number.isNaN(dueTime) && dueTime < Date.now()) {
    return { label: '已截止', variant: 'destructive' as const };
  }

  return { label: '进行中', variant: 'secondary' as const };
}

function getScoreDraft(submission: SubmissionInfo, drafts: Record<number, ScoreOverrideDraft>) {
  return (
    drafts[submission.id] || {
      finalTotal: String(submission.final_total ?? ''),
      comment: submission.teacher_comment || '',
      reason: '',
    }
  );
}

function MetricCard({ title, value, hint, icon, muted }: MetricCardProps) {
  return (
    <div
      className={cn(
        'rounded-md border bg-background px-4 py-3',
        muted ? 'border-dashed text-muted-foreground' : 'shadow-sm'
      )}
    >
      <div className="flex items-center justify-between gap-3">
        <div className="space-y-1">
          <p className="text-xs font-medium text-muted-foreground">{title}</p>
          <p className="text-2xl font-semibold leading-none">{value}</p>
        </div>
        <div className="rounded-md bg-muted p-2 text-muted-foreground">{icon}</div>
      </div>
      <p className="mt-2 text-xs text-muted-foreground">{hint}</p>
    </div>
  );
}

function EmptyState({
  title,
  description,
  action,
}: {
  title: string;
  description: string;
  action?: ReactNode;
}) {
  return (
    <div className="flex min-h-28 flex-col items-center justify-center gap-3 rounded-md border border-dashed bg-muted/20 px-4 py-6 text-center">
      <div>
        <p className="text-sm font-medium">{title}</p>
        <p className="mt-1 text-xs text-muted-foreground">{description}</p>
      </div>
      {action}
    </div>
  );
}

function TableLoadingRows({ columns, rows = 3 }: { columns: number; rows?: number }) {
  return (
    <>
      {Array.from({ length: rows }).map((_, rowIndex) => (
        <TableRow key={rowIndex}>
          <TableCell colSpan={columns}>
            <Skeleton className="h-8 w-full" />
          </TableCell>
        </TableRow>
      ))}
    </>
  );
}

function ScoreDimensionBars({ submission }: { submission: SubmissionInfo }) {
  const dimensions = normalizeScoreDimensions(submission);
  if (dimensions.length === 0) return null;

  return (
    <div className="mt-2 grid gap-1.5">
      {dimensions.slice(0, 4).map((dimension) => {
        const max = Number(dimension.max || 0);
        const score = Number(dimension.score || 0);
        const percent = max > 0 ? Math.max(0, Math.min(100, Math.round((score / max) * 100))) : 0;

        return (
          <div key={dimension.id} className="grid gap-1">
            <div className="flex items-center justify-between gap-2 text-[11px] text-muted-foreground">
              <span className="truncate">{dimension.label}</span>
              <span className="shrink-0">
                {score}/{max}
              </span>
            </div>
            <Progress value={percent} className="h-1.5" />
          </div>
        );
      })}
    </div>
  );
}

export default function TeacherDashboardPage() {
  const token = useAuthStore((state) => state.token);

  const [classes, setClasses] = useState<ClassInfo[]>([]);
  const [scenarios, setScenarios] = useState<ScenarioInfo[]>([]);
  const [students, setStudents] = useState<StudentInfo[]>([]);
  const [assignments, setAssignments] = useState<AssignmentInfo[]>([]);
  const [submissions, setSubmissions] = useState<SubmissionInfo[]>([]);

  const [selectedClassId, setSelectedClassId] = useState<number | null>(null);
  const [selectedAssignmentId, setSelectedAssignmentId] = useState<number | null>(null);

  const [loadingBase, setLoadingBase] = useState(false);
  const [loadingClassDetail, setLoadingClassDetail] = useState(false);
  const [loadingSubmissions, setLoadingSubmissions] = useState(false);
  const [creatingClass, setCreatingClass] = useState(false);
  const [importingCsv, setImportingCsv] = useState(false);
  const [creatingAssignment, setCreatingAssignment] = useState(false);
  const [updatingScoreId, setUpdatingScoreId] = useState<number | null>(null);
  const [deletingClassId, setDeletingClassId] = useState<number | null>(null);
  const [deletingStudentId, setDeletingStudentId] = useState<number | null>(null);

  const [baseError, setBaseError] = useState<string | null>(null);
  const [classDetailError, setClassDetailError] = useState<string | null>(null);
  const [submissionsError, setSubmissionsError] = useState<string | null>(null);
  const [lastImportFeedback, setLastImportFeedback] = useState<ImportFeedback | null>(null);

  const [classForm, setClassForm] = useState({ name: '', term: '' });
  const [csvText, setCsvText] = useState(
    'student_no,name,username,password\n2026001,张三,stu_zhangsan,Student@123'
  );
  const [assignmentForm, setAssignmentForm] = useState({
    scenarioId: '',
    title: '',
    description: '',
    dueAt: '',
  });
  const [scoreDrafts, setScoreDrafts] = useState<Record<number, ScoreOverrideDraft>>({});
  const submissionsSectionRef = useRef<HTMLDivElement | null>(null);

  const selectedClass = useMemo(
    () => classes.find((item) => item.id === selectedClassId) || null,
    [classes, selectedClassId]
  );

  const selectedAssignment = useMemo(
    () => assignments.find((item) => item.id === selectedAssignmentId) || null,
    [assignments, selectedAssignmentId]
  );

  const scenarioNameById = useMemo(
    () => new Map(scenarios.map((scenario) => [scenario.id, scenario.name])),
    [scenarios]
  );

  const submittedStudentCount = useMemo(() => {
    const keys = new Set<string>();
    submissions.forEach((submission) => {
      keys.add(String(submission.student_id ?? submission.username ?? submission.id));
    });
    return keys.size;
  }, [submissions]);

  const averageFinalScore = useMemo(() => {
    if (submissions.length === 0) return null;
    const scores = submissions
      .map((submission) => Number(submission.final_total))
      .filter((score) => Number.isFinite(score));
    if (scores.length === 0) return null;
    return scores.reduce((sum, score) => sum + score, 0) / scores.length;
  }, [submissions]);

  const csvDataRows = useMemo(() => {
    const rows = csvText.split(/\r?\n/).filter((line) => line.trim().length > 0);
    return Math.max(0, rows.length - 1);
  }, [csvText]);

  const selectedClassStudentCount = selectedClass
    ? loadingClassDetail
      ? selectedClass.student_count ?? students.length
      : students.length
    : 0;
  const submissionCoverage = students.length > 0 ? Math.round((submittedStudentCount / students.length) * 100) : 0;
  const overriddenCount = submissions.filter(
    (submission) => Number(submission.final_total) !== Number(submission.auto_total)
  ).length;
  const canCreateClass = classForm.name.trim().length > 0 && !creatingClass;
  const canImportCsv = Boolean(selectedClassId && csvText.trim()) && !importingCsv && !loadingClassDetail;
  const canCreateAssignment =
    Boolean(selectedClassId && assignmentForm.title.trim() && assignmentForm.scenarioId) &&
    !creatingAssignment &&
    scenarios.length > 0;

  const loadBaseData = useCallback(async () => {
    if (!token) return;
    setLoadingBase(true);
    setBaseError(null);
    try {
      const [classResponse, scenarioResponse] = await Promise.all([
        getClassesApi(token),
        getScenariosApi(token),
      ]);
      setClasses(classResponse.classes);
      setScenarios(scenarioResponse.scenarios);

      if (classResponse.classes.length === 0) {
        setSelectedClassId(null);
        setStudents([]);
        setAssignments([]);
        setSelectedAssignmentId(null);
        setSubmissions([]);
        return;
      }

      setSelectedClassId((currentClassId) => {
        const classExists = classResponse.classes.some((item) => item.id === currentClassId);
        return classExists ? currentClassId : classResponse.classes[0].id;
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : '加载教师基础数据失败';
      setBaseError(message);
      toast.error(message);
    } finally {
      setLoadingBase(false);
    }
  }, [token]);

  const loadClassDetail = useCallback(async (classId: number) => {
    if (!token) return;
    setLoadingClassDetail(true);
    setClassDetailError(null);
    try {
      const [studentsResponse, assignmentResponse] = await Promise.all([
        getClassStudentsApi(token, classId),
        getClassAssignmentsApi(token, classId),
      ]);

      const nextAssignments = assignmentResponse.assignments;
      setStudents(studentsResponse.students);
      setAssignments(nextAssignments);

      if (nextAssignments.length === 0) {
        setSelectedAssignmentId(null);
        setSubmissions([]);
        return;
      }

      setSelectedAssignmentId((prev) => {
        if (prev && nextAssignments.some((item) => item.id === prev)) {
          return prev;
        }
        return nextAssignments[0].id;
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : '加载班级详情失败';
      setClassDetailError(message);
      toast.error(message);
    } finally {
      setLoadingClassDetail(false);
    }
  }, [token]);

  const loadAssignmentSubmissions = useCallback(async (assignmentId: number) => {
    if (!token) return null;
    setLoadingSubmissions(true);
    setSubmissionsError(null);
    try {
      const response = await getAssignmentSubmissionsApi(token, assignmentId);
      setSubmissions(response.submissions);
      return response.submissions.length;
    } catch (error) {
      const message = error instanceof Error ? error.message : '加载提交列表失败';
      setSubmissionsError(message);
      toast.error(message);
      setSubmissions([]);
      return null;
    } finally {
      setLoadingSubmissions(false);
    }
  }, [token]);

  useEffect(() => {
    void loadBaseData();
  }, [loadBaseData]);

  useEffect(() => {
    if (!selectedClassId) return;
    setLastImportFeedback(null);
    void loadClassDetail(selectedClassId);
  }, [loadClassDetail, selectedClassId]);

  useEffect(() => {
    if (!selectedAssignmentId) return;
    void loadAssignmentSubmissions(selectedAssignmentId);
  }, [loadAssignmentSubmissions, selectedAssignmentId]);

  const handleCreateClass = async (event: FormEvent) => {
    event.preventDefault();
    if (!token || !classForm.name.trim()) return;

    setCreatingClass(true);
    try {
      await createClassApi(token, classForm);
      toast.success('班级创建成功');
      setClassForm({ name: '', term: '' });
      await loadBaseData();
    } catch (error) {
      const message = error instanceof Error ? error.message : '创建班级失败';
      toast.error(message);
    } finally {
      setCreatingClass(false);
    }
  };

  const handleImportCsv = async (event: FormEvent) => {
    event.preventDefault();
    if (!token || !selectedClassId || !csvText.trim()) return;

    setImportingCsv(true);
    setLastImportFeedback(null);
    try {
      const response = await importStudentsCsvApi(token, selectedClassId, csvText);
      setLastImportFeedback({
        importedCount: response.imported.length,
        failed: response.failed,
      });
      toast.success(`导入完成：成功 ${response.imported.length}，失败 ${response.failed.length}`);
      await loadClassDetail(selectedClassId);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'CSV 导入失败';
      toast.error(message);
    } finally {
      setImportingCsv(false);
    }
  };

  const handleSelectClass = (classId: number) => {
    if (classId === selectedClassId) return;
    setSelectedClassId(classId);
    setStudents([]);
    setAssignments([]);
    setSelectedAssignmentId(null);
    setSubmissions([]);
    setSubmissionsError(null);
    setScoreDrafts({});
  };

  const handleDeleteClass = async (classItem: ClassInfo) => {
    if (!token) return;
    const confirmed = window.confirm(
      `确认删除班级「${classItem.name}」吗？该班级下作业、提交与评分将一起删除。`
    );
    if (!confirmed) return;

    setDeletingClassId(classItem.id);
    try {
      await deleteClassApi(token, classItem.id);
      toast.success(`班级「${classItem.name}」已删除`);
      await loadBaseData();
    } catch (error) {
      const message = error instanceof Error ? error.message : '删除班级失败';
      toast.error(message);
    } finally {
      setDeletingClassId(null);
    }
  };

  const handleDeleteStudent = async (student: StudentInfo) => {
    if (!token || !selectedClassId) return;
    const confirmed = window.confirm(
      `确认从当前班级删除学生「${student.display_name}(${student.student_no})」吗？`
    );
    if (!confirmed) return;

    setDeletingStudentId(student.id);
    try {
      const response = await removeStudentFromClassApi(token, selectedClassId, student.id);
      const suffix = response.accountDisabled ? '（该学生已无班级，账号已停用）' : '';
      toast.success(`已删除学生 ${student.display_name}${suffix}`);
      await loadClassDetail(selectedClassId);
    } catch (error) {
      const message = error instanceof Error ? error.message : '删除学生失败';
      toast.error(message);
    } finally {
      setDeletingStudentId(null);
    }
  };

  const handleCreateAssignment = async (event: FormEvent) => {
    event.preventDefault();
    if (!token || !selectedClassId || !assignmentForm.title.trim() || !assignmentForm.scenarioId) return;

    setCreatingAssignment(true);
    try {
      await createAssignmentApi(token, selectedClassId, {
        scenarioId: assignmentForm.scenarioId,
        title: assignmentForm.title,
        description: assignmentForm.description,
        dueAt: assignmentForm.dueAt ? new Date(assignmentForm.dueAt).toISOString() : null,
      });
      toast.success('作业发布成功');
      setAssignmentForm({ scenarioId: '', title: '', description: '', dueAt: '' });
      await loadClassDetail(selectedClassId);
    } catch (error) {
      const message = error instanceof Error ? error.message : '发布作业失败';
      toast.error(message);
    } finally {
      setCreatingAssignment(false);
    }
  };

  const handleOverrideScore = async (submission: SubmissionInfo) => {
    if (!token) return;
    const draft = getScoreDraft(submission, scoreDrafts);
    const scoreValue = Number(draft.finalTotal);

    if (Number.isNaN(scoreValue)) {
      toast.error('请输入合法分数');
      return;
    }

    setUpdatingScoreId(submission.id);
    try {
      await overrideSubmissionScoreApi(token, submission.id, {
        finalTotal: scoreValue,
        comment: draft.comment,
        reason: draft.reason,
        rubricOverride: null,
      });
      toast.success('评分覆写成功，已写入审计记录');
      if (selectedAssignmentId) {
        await loadAssignmentSubmissions(selectedAssignmentId);
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : '覆写评分失败';
      toast.error(message);
    } finally {
      setUpdatingScoreId(null);
    }
  };

  const handleSelectAssignment = async (assignmentId: number) => {
    submissionsSectionRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });

    if (assignmentId !== selectedAssignmentId) {
      setSelectedAssignmentId(assignmentId);
      return;
    }

    const count = await loadAssignmentSubmissions(assignmentId);
    if (count !== null) {
      toast.success(`已加载 ${count} 条学生提交`);
    }
  };

  return (
    <div className="min-h-screen bg-muted/30">
      <AuthTopBar
        title="教师工作台"
        subtitle="班级、学生、作业与评分"
        actions={
          <>
            <Button variant="outline" size="sm" asChild>
              <Link to="/lesson-flow">课堂流程页</Link>
            </Button>
            <Button variant="outline" size="sm" asChild>
            <Link to="/teacher/studio">打开教师画布</Link>
            </Button>
          </>
        }
      />

      <main className="mx-auto max-w-7xl space-y-4 px-4 py-6">
        <section className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
          <MetricCard
            title="班级"
            value={classes.length}
            hint={selectedClass ? `当前：${selectedClass.name}` : '尚未选择班级'}
            icon={<GraduationCap className="h-4 w-4" />}
            muted={classes.length === 0}
          />
          <MetricCard
            title="学生"
            value={selectedClassStudentCount}
            hint={selectedClass ? `${selectedClass.name} 已加载学生` : '选择班级后显示'}
            icon={<Users className="h-4 w-4" />}
            muted={!selectedClass}
          />
          <MetricCard
            title="作业"
            value={assignments.length}
            hint={selectedAssignment ? `当前：${selectedAssignment.title}` : '暂无选中作业'}
            icon={<BookOpenCheck className="h-4 w-4" />}
            muted={assignments.length === 0}
          />
          <MetricCard
            title="提交"
            value={submissions.length}
            hint={averageFinalScore === null ? '暂无评分数据' : `平均最终分 ${formatScore(averageFinalScore)}`}
            icon={<ClipboardList className="h-4 w-4" />}
            muted={submissions.length === 0}
          />
        </section>

        {baseError ? (
          <Alert variant="destructive">
            <AlertTriangle className="h-4 w-4" />
            <AlertTitle>基础数据加载失败</AlertTitle>
            <AlertDescription>{baseError}</AlertDescription>
          </Alert>
        ) : null}

        <div className="grid gap-4 lg:grid-cols-[minmax(0,1.1fr)_minmax(360px,0.9fr)]">
          <Card>
            <CardHeader className="pb-3">
              <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <CardTitle className="text-lg">我的班级</CardTitle>
                  <CardDescription>选择班级后管理学生、作业和提交。</CardDescription>
                </div>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  disabled={loadingBase}
                  onClick={() => void loadBaseData()}
                >
                  {loadingBase ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <RefreshCw className="mr-2 h-4 w-4" />}
                  刷新
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              <div className="overflow-x-auto rounded-md border">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>班级</TableHead>
                      <TableHead>班级码</TableHead>
                      <TableHead>学期</TableHead>
                      <TableHead>学生</TableHead>
                      <TableHead className="text-right">操作</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {loadingBase ? <TableLoadingRows columns={5} /> : null}
                    {!loadingBase
                      ? classes.map((item) => {
                          const selected = selectedClassId === item.id;
                          return (
                            <TableRow key={item.id} className={cn(selected && 'bg-muted/50')}>
                              <TableCell>
                                <div className="space-y-1">
                                  <div className="flex items-center gap-2">
                                    <span className="font-medium">{item.name}</span>
                                    {selected ? <Badge variant="secondary">当前</Badge> : null}
                                  </div>
                                  <p className="text-xs text-muted-foreground">ID #{item.id}</p>
                                </div>
                              </TableCell>
                              <TableCell>
                                <code className="rounded bg-muted px-2 py-1 text-xs">{item.class_code}</code>
                              </TableCell>
                              <TableCell>{item.term || '-'}</TableCell>
                              <TableCell>{item.student_count ?? '-'}</TableCell>
                              <TableCell>
                                <div className="flex justify-end gap-2">
                                  <Button
                                    type="button"
                                    size="sm"
                                    variant={selected ? 'default' : 'outline'}
                                    disabled={selected || loadingClassDetail}
                                    onClick={() => handleSelectClass(item.id)}
                                  >
                                    {selected ? '已选中' : '选中'}
                                  </Button>
                                  <Button
                                    type="button"
                                    size="sm"
                                    variant="destructive"
                                    disabled={deletingClassId === item.id}
                                    onClick={() => void handleDeleteClass(item)}
                                  >
                                    {deletingClassId === item.id ? (
                                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                    ) : null}
                                    删除
                                  </Button>
                                </div>
                              </TableCell>
                            </TableRow>
                          );
                        })
                      : null}
                    {classes.length === 0 && !loadingBase ? (
                      <TableRow>
                        <TableCell colSpan={5}>
                          <EmptyState title="暂无班级" description="创建第一个班级后即可导入学生并发布作业。" />
                        </TableCell>
                      </TableRow>
                    ) : null}
                  </TableBody>
                </Table>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-lg">创建班级</CardTitle>
              <CardDescription>班级名称必填，学期用于归档和筛选。</CardDescription>
            </CardHeader>
            <CardContent>
              <form className="grid gap-3" onSubmit={handleCreateClass}>
                <div className="space-y-1.5">
                  <Label htmlFor="class-name">班级名称</Label>
                  <Input
                    id="class-name"
                    value={classForm.name}
                    onChange={(event) => setClassForm((state) => ({ ...state, name: event.target.value }))}
                    placeholder="例如：高一(2)班"
                    required
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="class-term">学期</Label>
                  <Input
                    id="class-term"
                    value={classForm.term}
                    onChange={(event) => setClassForm((state) => ({ ...state, term: event.target.value }))}
                    placeholder="2026 春季"
                  />
                </div>
                <Button type="submit" disabled={!canCreateClass} className="justify-self-start">
                  {creatingClass ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                  {creatingClass ? '创建中' : '创建班级'}
                </Button>
              </form>
            </CardContent>
          </Card>
        </div>

        {selectedClass ? (
          <>
            {classDetailError ? (
              <Alert variant="destructive">
                <AlertTriangle className="h-4 w-4" />
                <AlertTitle>班级详情加载失败</AlertTitle>
                <AlertDescription>{classDetailError}</AlertDescription>
              </Alert>
            ) : null}

            <Card>
              <CardHeader className="pb-3">
                <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                  <div>
                    <CardTitle className="flex items-center gap-2 text-lg">
                      班级学生
                      <Badge variant="outline">{selectedClass.name}</Badge>
                    </CardTitle>
                    <CardDescription>
                      班级码 {selectedClass.class_code}，当前学生 {selectedClassStudentCount} 人。
                    </CardDescription>
                  </div>
                  {loadingClassDetail ? (
                    <Badge variant="secondary" className="w-fit">
                      <Loader2 className="mr-1 h-3 w-3 animate-spin" />
                      同步中
                    </Badge>
                  ) : null}
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                <form className="grid gap-3 lg:grid-cols-[minmax(0,1fr)_220px]" onSubmit={handleImportCsv}>
                  <div className="space-y-1.5">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <Label htmlFor="csv-text">CSV 批量导入</Label>
                      <span className="text-xs text-muted-foreground">待导入 {csvDataRows} 行</span>
                    </div>
                    <Textarea
                      id="csv-text"
                      value={csvText}
                      onChange={(event) => setCsvText(event.target.value)}
                      rows={5}
                      spellCheck={false}
                      className="font-mono text-xs"
                    />
                    <p className="text-xs text-muted-foreground">
                      表头保持 student_no,name,username,password；失败行会在下方展示。
                    </p>
                  </div>
                  <div className="flex flex-col justify-end gap-2">
                    <Button type="submit" disabled={!canImportCsv}>
                      {importingCsv ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <FileText className="mr-2 h-4 w-4" />}
                      {importingCsv ? '导入中' : '导入学生'}
                    </Button>
                    <Button
                      type="button"
                      variant="outline"
                      disabled={loadingClassDetail}
                      onClick={() => void loadClassDetail(selectedClass.id)}
                    >
                      <RefreshCw className="mr-2 h-4 w-4" />
                      刷新名单
                    </Button>
                  </div>
                </form>

                {lastImportFeedback ? (
                  <Alert variant={lastImportFeedback.failed.length > 0 ? 'destructive' : 'default'}>
                    {lastImportFeedback.failed.length > 0 ? (
                      <XCircle className="h-4 w-4" />
                    ) : (
                      <CheckCircle2 className="h-4 w-4" />
                    )}
                    <AlertTitle>
                      导入结果：成功 {lastImportFeedback.importedCount}，失败 {lastImportFeedback.failed.length}
                    </AlertTitle>
                    {lastImportFeedback.failed.length > 0 ? (
                      <AlertDescription>
                        <div className="mt-2 grid gap-1">
                          {lastImportFeedback.failed.slice(0, 5).map((item) => (
                            <p key={`${item.row}-${item.reason}`}>
                              第 {item.row} 行：{item.reason}
                            </p>
                          ))}
                          {lastImportFeedback.failed.length > 5 ? (
                            <p>其余 {lastImportFeedback.failed.length - 5} 条失败记录请检查 CSV 内容。</p>
                          ) : null}
                        </div>
                      </AlertDescription>
                    ) : null}
                  </Alert>
                ) : null}

                <div className="overflow-x-auto rounded-md border">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>学号</TableHead>
                        <TableHead>姓名</TableHead>
                        <TableHead>用户名</TableHead>
                        <TableHead>状态</TableHead>
                        <TableHead className="text-right">操作</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {loadingClassDetail ? <TableLoadingRows columns={5} rows={2} /> : null}
                      {!loadingClassDetail
                        ? students.map((student) => (
                            <TableRow key={`${student.id}-${student.student_no}`}>
                              <TableCell className="font-medium">{student.student_no}</TableCell>
                              <TableCell>{student.display_name}</TableCell>
                              <TableCell>{student.username}</TableCell>
                              <TableCell>
                                <Badge variant={student.status === 'active' ? 'secondary' : 'outline'}>
                                  {student.status}
                                </Badge>
                              </TableCell>
                              <TableCell className="text-right">
                                <Button
                                  type="button"
                                  size="sm"
                                  variant="destructive"
                                  disabled={deletingStudentId === student.id}
                                  onClick={() => void handleDeleteStudent(student)}
                                >
                                  {deletingStudentId === student.id ? (
                                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                  ) : null}
                                  删除
                                </Button>
                              </TableCell>
                            </TableRow>
                          ))
                        : null}
                      {students.length === 0 && !loadingClassDetail ? (
                        <TableRow>
                          <TableCell colSpan={5}>
                            <EmptyState title="暂无学生" description="导入学生后，作业提交覆盖率会在这里计算。" />
                          </TableCell>
                        </TableRow>
                      ) : null}
                    </TableBody>
                  </Table>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-lg">发布作业</CardTitle>
                <CardDescription>绑定一个预设场景，学生提交后可在下方集中评分。</CardDescription>
              </CardHeader>
              <CardContent>
                <form className="grid gap-3 md:grid-cols-2" onSubmit={handleCreateAssignment}>
                  <div className="space-y-1.5">
                    <Label htmlFor="assignment-title">作业标题</Label>
                    <Input
                      id="assignment-title"
                      value={assignmentForm.title}
                      onChange={(event) =>
                        setAssignmentForm((state) => ({ ...state, title: event.target.value }))
                      }
                      placeholder="例如：校园网络拓扑搭建"
                      required
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="assignment-scenario">预设场景</Label>
                    <select
                      id="assignment-scenario"
                      className="h-10 w-full rounded-md border bg-background px-3 text-sm disabled:cursor-not-allowed disabled:opacity-50"
                      value={assignmentForm.scenarioId}
                      onChange={(event) =>
                        setAssignmentForm((state) => ({ ...state, scenarioId: event.target.value }))
                      }
                      disabled={scenarios.length === 0}
                      required
                    >
                      <option value="">{scenarios.length === 0 ? '暂无可用场景' : '请选择场景'}</option>
                      {scenarios.map((scenario) => (
                        <option key={scenario.id} value={scenario.id}>
                          {scenario.name}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div className="space-y-1.5 md:col-span-2">
                    <Label htmlFor="assignment-description">描述</Label>
                    <Textarea
                      id="assignment-description"
                      value={assignmentForm.description}
                      onChange={(event) =>
                        setAssignmentForm((state) => ({ ...state, description: event.target.value }))
                      }
                      placeholder="补充目标、限制条件或评分关注点"
                      rows={3}
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="assignment-due">截止时间</Label>
                    <Input
                      id="assignment-due"
                      type="datetime-local"
                      value={assignmentForm.dueAt}
                      onChange={(event) =>
                        setAssignmentForm((state) => ({ ...state, dueAt: event.target.value }))
                      }
                    />
                  </div>
                  <div className="flex items-end">
                    <Button type="submit" disabled={!canCreateAssignment}>
                      {creatingAssignment ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Send className="mr-2 h-4 w-4" />}
                      {creatingAssignment ? '发布中' : '发布作业'}
                    </Button>
                  </div>
                </form>
              </CardContent>
            </Card>

            <Card ref={submissionsSectionRef}>
              <CardHeader className="pb-3">
                <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                  <div>
                    <CardTitle className="text-lg">作业与提交</CardTitle>
                    <CardDescription>
                      提交覆盖率 {submissionCoverage}% ，已覆写 {overriddenCount} 条评分。
                    </CardDescription>
                  </div>
                  <div className="min-w-48 space-y-1">
                    <div className="flex items-center justify-between text-xs text-muted-foreground">
                      <span>提交覆盖</span>
                      <span>
                        {submittedStudentCount}/{students.length}
                      </span>
                    </div>
                    <Progress value={submissionCoverage} className="h-2" />
                  </div>
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="overflow-x-auto rounded-md border">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>作业</TableHead>
                        <TableHead>场景</TableHead>
                        <TableHead>截止</TableHead>
                        <TableHead>状态</TableHead>
                        <TableHead className="text-right">提交</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {loadingClassDetail ? <TableLoadingRows columns={5} rows={2} /> : null}
                      {!loadingClassDetail
                        ? assignments.map((assignment) => {
                            const status = getAssignmentStatus(assignment);
                            const selected = selectedAssignmentId === assignment.id;
                            return (
                              <TableRow key={assignment.id} className={cn(selected && 'bg-muted/50')}>
                                <TableCell>
                                  <div className="space-y-1">
                                    <div className="flex items-center gap-2">
                                      <span className="font-medium">{assignment.title}</span>
                                      {selected ? <Badge variant="secondary">当前</Badge> : null}
                                    </div>
                                    <p className="text-xs text-muted-foreground">ID #{assignment.id}</p>
                                  </div>
                                </TableCell>
                                <TableCell>{scenarioNameById.get(assignment.scenario_id) || assignment.scenario_id}</TableCell>
                                <TableCell>{formatDateTime(assignment.due_at)}</TableCell>
                                <TableCell>
                                  <Badge variant={status.variant}>{status.label}</Badge>
                                </TableCell>
                                <TableCell className="text-right">
                                  <Button
                                    type="button"
                                    size="sm"
                                    variant={selected ? 'default' : 'outline'}
                                    disabled={loadingSubmissions && selected}
                                    onClick={() => void handleSelectAssignment(assignment.id)}
                                  >
                                    {loadingSubmissions && selected ? (
                                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                    ) : (
                                      <Eye className="mr-2 h-4 w-4" />
                                    )}
                                    {selected ? '查看提交' : '选择'}
                                  </Button>
                                </TableCell>
                              </TableRow>
                            );
                          })
                        : null}
                      {assignments.length === 0 && !loadingClassDetail ? (
                        <TableRow>
                          <TableCell colSpan={5}>
                            <EmptyState title="暂无作业" description="发布作业后，学生提交和评分记录会显示在这里。" />
                          </TableCell>
                        </TableRow>
                      ) : null}
                    </TableBody>
                  </Table>
                </div>

                {selectedAssignment ? (
                  <div className="flex flex-col gap-3 rounded-md border bg-muted/20 p-3 sm:flex-row sm:items-center sm:justify-between">
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium">{selectedAssignment.title}</p>
                      <p className="text-xs text-muted-foreground">
                        场景 {scenarioNameById.get(selectedAssignment.scenario_id) || selectedAssignment.scenario_id}
                        {' · '}
                        截止 {formatDateTime(selectedAssignment.due_at)}
                      </p>
                    </div>
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      onClick={() => void loadAssignmentSubmissions(selectedAssignment.id)}
                      disabled={loadingSubmissions}
                    >
                      {loadingSubmissions ? (
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      ) : (
                        <RefreshCw className="mr-2 h-4 w-4" />
                      )}
                      {loadingSubmissions ? '刷新中' : '刷新提交'}
                    </Button>
                  </div>
                ) : null}

                {submissionsError ? (
                  <Alert variant="destructive">
                    <AlertTriangle className="h-4 w-4" />
                    <AlertTitle>提交列表加载失败</AlertTitle>
                    <AlertDescription>{submissionsError}</AlertDescription>
                  </Alert>
                ) : null}

                <div className="overflow-x-auto rounded-md border">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>学生</TableHead>
                        <TableHead>评分轨迹</TableHead>
                        <TableHead>提交画布</TableHead>
                        <TableHead className="min-w-[240px]">覆写评分</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {loadingSubmissions ? <TableLoadingRows columns={4} rows={3} /> : null}
                      {!loadingSubmissions
                        ? submissions.map((submission) => {
                            const draft = getScoreDraft(submission, scoreDrafts);
                            const studentName =
                              submission.submitted_student_name ||
                              submission.display_name ||
                              submission.username ||
                              `学生 #${submission.student_id}`;
                            return (
                              <TableRow key={submission.id}>
                                <TableCell className="align-top">
                                  <div className="space-y-1">
                                    <p className="font-medium">{studentName}</p>
                                    <p className="text-xs text-muted-foreground">
                                      提交 #{submission.id} · 第 {submission.attempt_no} 次
                                    </p>
                                    <p className="text-xs text-muted-foreground">
                                      {formatDateTime(submission.submitted_at)}
                                    </p>
                                  </div>
                                </TableCell>
                                <TableCell className="min-w-[260px] align-top">
                                  <ScoreTrace submission={submission} />
                                  <ScoreDimensionBars submission={submission} />
                                </TableCell>
                                <TableCell className="align-top">
                                  <Button size="sm" variant="outline" asChild>
                                    <Link to={`/teacher/submissions/${submission.id}/canvas`}>
                                      <Eye className="mr-2 h-4 w-4" />
                                      查看画布
                                    </Link>
                                  </Button>
                                </TableCell>
                                <TableCell className="align-top">
                                  <div className="grid gap-2">
                                    <Input
                                      type="number"
                                      step="0.1"
                                      value={draft.finalTotal}
                                      onChange={(event) =>
                                        setScoreDrafts((state) => ({
                                          ...state,
                                          [submission.id]: { ...draft, finalTotal: event.target.value },
                                        }))
                                      }
                                      placeholder="最终分"
                                      aria-label={`提交 ${submission.id} 最终分`}
                                    />
                                    <Input
                                      value={draft.reason}
                                      onChange={(event) =>
                                        setScoreDrafts((state) => ({
                                          ...state,
                                          [submission.id]: { ...draft, reason: event.target.value },
                                        }))
                                      }
                                      placeholder="覆写原因"
                                      aria-label={`提交 ${submission.id} 覆写原因`}
                                    />
                                    <Input
                                      value={draft.comment}
                                      onChange={(event) =>
                                        setScoreDrafts((state) => ({
                                          ...state,
                                          [submission.id]: { ...draft, comment: event.target.value },
                                        }))
                                      }
                                      placeholder="评语"
                                      aria-label={`提交 ${submission.id} 评语`}
                                    />
                                    <Button
                                      type="button"
                                      size="sm"
                                      disabled={updatingScoreId === submission.id}
                                      onClick={() => void handleOverrideScore(submission)}
                                    >
                                      {updatingScoreId === submission.id ? (
                                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                      ) : null}
                                      {updatingScoreId === submission.id ? '提交中' : '覆写评分'}
                                    </Button>
                                  </div>
                                </TableCell>
                              </TableRow>
                            );
                          })
                        : null}

                      {submissions.length === 0 && !loadingSubmissions ? (
                        <TableRow>
                          <TableCell colSpan={4}>
                            <EmptyState
                              title={selectedAssignmentId ? '暂无提交' : '请选择作业'}
                              description={selectedAssignmentId ? '学生提交后会显示评分轨迹和画布入口。' : '选择上方作业后查看提交。'}
                              action={
                                selectedAssignment ? (
                                  <Button
                                    type="button"
                                    size="sm"
                                    variant="outline"
                                    onClick={() => void loadAssignmentSubmissions(selectedAssignment.id)}
                                  >
                                    <RefreshCw className="mr-2 h-4 w-4" />
                                    刷新提交
                                  </Button>
                                ) : null
                              }
                            />
                          </TableCell>
                        </TableRow>
                      ) : null}
                    </TableBody>
                  </Table>
                </div>
              </CardContent>
            </Card>
          </>
        ) : (
          <EmptyState title="未选择班级" description="创建或选择班级后，教师端管理区域会显示在这里。" />
        )}
      </main>
    </div>
  );
}
