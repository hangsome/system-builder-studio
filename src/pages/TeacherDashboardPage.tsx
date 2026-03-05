import { FormEvent, useEffect, useMemo, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { toast } from 'sonner';
import { AuthTopBar } from '@/components/auth/AuthTopBar';
import { ScoreTrace } from '@/components/edu/ScoreTrace';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
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
import { useAuthStore } from '@/store/authStore';
import { AssignmentInfo, ClassInfo, ScenarioInfo, StudentInfo, SubmissionInfo } from '@/types/edu';

interface ScoreOverrideDraft {
  finalTotal: string;
  comment: string;
  reason: string;
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
  const [loadingSubmissions, setLoadingSubmissions] = useState(false);
  const [creatingClass, setCreatingClass] = useState(false);
  const [importingCsv, setImportingCsv] = useState(false);
  const [creatingAssignment, setCreatingAssignment] = useState(false);
  const [updatingScoreId, setUpdatingScoreId] = useState<number | null>(null);
  const [deletingClassId, setDeletingClassId] = useState<number | null>(null);
  const [deletingStudentId, setDeletingStudentId] = useState<number | null>(null);

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

  const loadBaseData = async () => {
    if (!token) return;
    setLoadingBase(true);
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

      const classExists = classResponse.classes.some((item) => item.id === selectedClassId);
      if (!classExists) {
        setSelectedClassId(classResponse.classes[0].id);
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : '加载教师基础数据失败';
      toast.error(message);
    } finally {
      setLoadingBase(false);
    }
  };

  const loadClassDetail = async (classId: number) => {
    if (!token) return;
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
      toast.error(message);
    }
  };

  const loadAssignmentSubmissions = async (assignmentId: number) => {
    if (!token) return;
    setLoadingSubmissions(true);
    try {
      const response = await getAssignmentSubmissionsApi(token, assignmentId);
      setSubmissions(response.submissions);
    } catch (error) {
      const message = error instanceof Error ? error.message : '加载提交列表失败';
      toast.error(message);
      setSubmissions([]);
    } finally {
      setLoadingSubmissions(false);
    }
  };

  useEffect(() => {
    void loadBaseData();
  }, [token]);

  useEffect(() => {
    if (!selectedClassId) return;
    void loadClassDetail(selectedClassId);
  }, [selectedClassId, token]);

  useEffect(() => {
    if (!selectedAssignmentId) return;
    void loadAssignmentSubmissions(selectedAssignmentId);
  }, [selectedAssignmentId, token]);

  const handleCreateClass = async (event: FormEvent) => {
    event.preventDefault();
    if (!token) return;

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
    if (!token || !selectedClassId) return;

    setImportingCsv(true);
    try {
      const response = await importStudentsCsvApi(token, selectedClassId, csvText);
      toast.success(`导入完成：成功 ${response.imported.length}，失败 ${response.failed.length}`);
      await loadClassDetail(selectedClassId);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'CSV 导入失败';
      toast.error(message);
    } finally {
      setImportingCsv(false);
    }
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
    if (!token || !selectedClassId) return;

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

  const handleOverrideScore = async (submissionId: number) => {
    if (!token) return;
    const draft = scoreDrafts[submissionId];
    const scoreValue = Number(draft?.finalTotal);

    if (Number.isNaN(scoreValue)) {
      toast.error('请输入合法分数');
      return;
    }

    setUpdatingScoreId(submissionId);
    try {
      await overrideSubmissionScoreApi(token, submissionId, {
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
    setSelectedAssignmentId(assignmentId);
    if (!token) return;
    setLoadingSubmissions(true);
    try {
      const response = await getAssignmentSubmissionsApi(token, assignmentId);
      setSubmissions(response.submissions);
      toast.success(`已加载 ${response.submissions.length} 条学生提交`);
    } catch (error) {
      const message = error instanceof Error ? error.message : '加载提交列表失败';
      toast.error(message);
      setSubmissions([]);
    } finally {
      setLoadingSubmissions(false);
    }
  };

  return (
    <div className="min-h-screen bg-muted/30">
      <AuthTopBar
        title="教师工作台"
        subtitle="班级、学生、作业与评分"
        actions={
          <Button variant="outline" size="sm" asChild>
            <Link to="/teacher/studio">打开教师画布</Link>
          </Button>
        }
      />

      <main className="mx-auto max-w-7xl px-4 py-6 space-y-4">
        <Card>
          <CardHeader>
            <CardTitle>创建班级</CardTitle>
          </CardHeader>
          <CardContent>
            <form className="grid gap-3 md:grid-cols-4" onSubmit={handleCreateClass}>
              <div className="space-y-1">
                <Label htmlFor="class-name">班级名称</Label>
                <Input
                  id="class-name"
                  value={classForm.name}
                  onChange={(event) => setClassForm((state) => ({ ...state, name: event.target.value }))}
                  placeholder="例如：高一(2)班"
                  required
                />
              </div>
              <div className="space-y-1">
                <Label htmlFor="class-term">学期</Label>
                <Input
                  id="class-term"
                  value={classForm.term}
                  onChange={(event) => setClassForm((state) => ({ ...state, term: event.target.value }))}
                  placeholder="2026 春季"
                />
              </div>
              <div className="md:col-span-2 flex items-end">
                <Button type="submit" disabled={creatingClass}>
                  {creatingClass ? '创建中...' : '创建班级'}
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>我的班级</CardTitle>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>ID</TableHead>
                  <TableHead>班级名</TableHead>
                  <TableHead>班级码</TableHead>
                  <TableHead>学期</TableHead>
                  <TableHead>学生数</TableHead>
                  <TableHead>操作</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {classes.map((item) => (
                  <TableRow key={item.id}>
                    <TableCell>{item.id}</TableCell>
                    <TableCell>{item.name}</TableCell>
                    <TableCell>{item.class_code}</TableCell>
                    <TableCell>{item.term || '-'}</TableCell>
                    <TableCell>{item.student_count ?? '-'}</TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <Button
                          size="sm"
                          variant={selectedClassId === item.id ? 'default' : 'outline'}
                          onClick={() => setSelectedClassId(item.id)}
                        >
                          选中
                        </Button>
                        <Button
                          size="sm"
                          variant="destructive"
                          disabled={deletingClassId === item.id}
                          onClick={() => void handleDeleteClass(item)}
                        >
                          {deletingClassId === item.id ? '删除中...' : '删除'}
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
                {classes.length === 0 && !loadingBase ? (
                  <TableRow>
                    <TableCell colSpan={6} className="text-center text-muted-foreground">
                      暂无班级数据
                    </TableCell>
                  </TableRow>
                ) : null}
              </TableBody>
            </Table>
          </CardContent>
        </Card>

        {selectedClass ? (
          <>
            <Card>
              <CardHeader>
                <CardTitle>
                  班级学生导入 <Badge variant="outline">{selectedClass.name}</Badge>
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <form className="space-y-3" onSubmit={handleImportCsv}>
                  <div className="space-y-1">
                    <Label htmlFor="csv-text">CSV 内容</Label>
                    <Textarea
                      id="csv-text"
                      value={csvText}
                      onChange={(event) => setCsvText(event.target.value)}
                      rows={5}
                    />
                  </div>
                  <Button type="submit" disabled={importingCsv}>
                    {importingCsv ? '导入中...' : '导入学生'}
                  </Button>
                </form>

                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>学号</TableHead>
                      <TableHead>姓名</TableHead>
                      <TableHead>用户名</TableHead>
                      <TableHead>状态</TableHead>
                      <TableHead>操作</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {students.map((student) => (
                      <TableRow key={`${student.id}-${student.student_no}`}>
                        <TableCell>{student.student_no}</TableCell>
                        <TableCell>{student.display_name}</TableCell>
                        <TableCell>{student.username}</TableCell>
                        <TableCell>{student.status}</TableCell>
                        <TableCell>
                          <Button
                            size="sm"
                            variant="destructive"
                            disabled={deletingStudentId === student.id}
                            onClick={() => void handleDeleteStudent(student)}
                          >
                            {deletingStudentId === student.id ? '删除中...' : '删除'}
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                    {students.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={5} className="text-center text-muted-foreground">
                          暂无学生
                        </TableCell>
                      </TableRow>
                    ) : null}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>发布作业（绑定预设场景）</CardTitle>
              </CardHeader>
              <CardContent>
                <form className="grid gap-3 md:grid-cols-2" onSubmit={handleCreateAssignment}>
                  <div className="space-y-1">
                    <Label htmlFor="assignment-title">作业标题</Label>
                    <Input
                      id="assignment-title"
                      value={assignmentForm.title}
                      onChange={(event) =>
                        setAssignmentForm((state) => ({ ...state, title: event.target.value }))
                      }
                      required
                    />
                  </div>
                  <div className="space-y-1">
                    <Label htmlFor="assignment-scenario">预设场景</Label>
                    <select
                      id="assignment-scenario"
                      className="w-full h-10 rounded-md border bg-background px-3 text-sm"
                      value={assignmentForm.scenarioId}
                      onChange={(event) =>
                        setAssignmentForm((state) => ({ ...state, scenarioId: event.target.value }))
                      }
                      required
                    >
                      <option value="">请选择场景</option>
                      {scenarios.map((scenario) => (
                        <option key={scenario.id} value={scenario.id}>
                          {scenario.name}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div className="space-y-1 md:col-span-2">
                    <Label htmlFor="assignment-description">描述</Label>
                    <Textarea
                      id="assignment-description"
                      value={assignmentForm.description}
                      onChange={(event) =>
                        setAssignmentForm((state) => ({ ...state, description: event.target.value }))
                      }
                      rows={3}
                    />
                  </div>
                  <div className="space-y-1">
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
                    <Button type="submit" disabled={creatingAssignment}>
                      {creatingAssignment ? '发布中...' : '发布作业'}
                    </Button>
                  </div>
                </form>
              </CardContent>
            </Card>

            <Card ref={submissionsSectionRef}>
              <CardHeader>
                <CardTitle>作业与提交</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>ID</TableHead>
                      <TableHead>标题</TableHead>
                      <TableHead>场景</TableHead>
                      <TableHead>截止</TableHead>
                      <TableHead />
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {assignments.map((assignment) => (
                      <TableRow key={assignment.id}>
                        <TableCell>{assignment.id}</TableCell>
                        <TableCell>{assignment.title}</TableCell>
                        <TableCell>{assignment.scenario_id}</TableCell>
                        <TableCell>{assignment.due_at || '-'}</TableCell>
                        <TableCell>
                          <Button
                            size="sm"
                            variant={selectedAssignmentId === assignment.id ? 'default' : 'outline'}
                            disabled={loadingSubmissions && selectedAssignmentId === assignment.id}
                            onClick={() => void handleSelectAssignment(assignment.id)}
                          >
                            {loadingSubmissions && selectedAssignmentId === assignment.id ? '加载中...' : '查看提交'}
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                    {assignments.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={5} className="text-center text-muted-foreground">
                          暂无作业
                        </TableCell>
                      </TableRow>
                    ) : null}
                  </TableBody>
                </Table>

                {selectedAssignment ? (
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-muted-foreground">
                      当前作业: #{selectedAssignment.id} {selectedAssignment.title}
                    </span>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => void loadAssignmentSubmissions(selectedAssignment.id)}
                      disabled={loadingSubmissions}
                    >
                      {loadingSubmissions ? '刷新中...' : '刷新提交'}
                    </Button>
                  </div>
                ) : null}

                <div className="rounded-md border">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>学生</TableHead>
                        <TableHead>尝试次数</TableHead>
                        <TableHead>评分轨迹</TableHead>
                        <TableHead>提交画布</TableHead>
                        <TableHead>覆写分数</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {submissions.map((submission) => {
                        const draft = scoreDrafts[submission.id] || {
                          finalTotal: String(submission.final_total ?? ''),
                          comment: submission.teacher_comment || '',
                          reason: '',
                        };
                        return (
                          <TableRow key={submission.id}>
                            <TableCell>
                              {submission.display_name || submission.username} (#{submission.id})
                            </TableCell>
                            <TableCell>{submission.attempt_no}</TableCell>
                            <TableCell>
                              <ScoreTrace submission={submission} />
                            </TableCell>
                            <TableCell>
                              <Button size="sm" variant="outline" asChild>
                                <Link to={`/teacher/submissions/${submission.id}/canvas`}>
                                  查看画布
                                </Link>
                              </Button>
                            </TableCell>
                            <TableCell>
                              <div className="grid gap-2">
                                <Input
                                  value={draft.finalTotal}
                                  onChange={(event) =>
                                    setScoreDrafts((state) => ({
                                      ...state,
                                      [submission.id]: { ...draft, finalTotal: event.target.value },
                                    }))
                                  }
                                  placeholder="最终分"
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
                                />
                                <Button
                                  size="sm"
                                  disabled={updatingScoreId === submission.id}
                                  onClick={() => void handleOverrideScore(submission.id)}
                                >
                                  {updatingScoreId === submission.id ? '提交中...' : '覆写评分'}
                                </Button>
                              </div>
                            </TableCell>
                          </TableRow>
                        );
                      })}

                      {submissions.length === 0 ? (
                        <TableRow>
                          <TableCell colSpan={5} className="text-center text-muted-foreground">
                            {selectedAssignmentId
                              ? '暂无提交（可点击“刷新提交”重试）'
                              : '请先选择一个作业查看提交'}
                          </TableCell>
                        </TableRow>
                      ) : null}
                    </TableBody>
                  </Table>
                </div>
              </CardContent>
            </Card>
          </>
        ) : null}
      </main>
    </div>
  );
}
