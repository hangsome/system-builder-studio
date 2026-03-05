import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { AuthTopBar } from '@/components/auth/AuthTopBar';
import { ScoreTrace } from '@/components/edu/ScoreTrace';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { getMyAssignmentsApi, getMySubmissionsApi } from '@/api/eduApi';
import { useAuthStore } from '@/store/authStore';
import { AssignmentInfo, SubmissionInfo } from '@/types/edu';
import { toast } from 'sonner';

export default function StudentDashboardPage() {
  const token = useAuthStore((state) => state.token);
  const [assignments, setAssignments] = useState<AssignmentInfo[]>([]);
  const [submissions, setSubmissions] = useState<SubmissionInfo[]>([]);
  const [selectedAssignmentId, setSelectedAssignmentId] = useState<number | null>(null);
  const [loading, setLoading] = useState(false);

  const selectedAssignment = useMemo(
    () => assignments.find((item) => item.id === selectedAssignmentId) || null,
    [assignments, selectedAssignmentId]
  );

  const loadAssignments = async () => {
    if (!token) return;
    setLoading(true);
    try {
      const response = await getMyAssignmentsApi(token);
      setAssignments(response.assignments);
      if (response.assignments.length > 0) {
        setSelectedAssignmentId((prev) => prev || response.assignments[0].id);
      } else {
        setSelectedAssignmentId(null);
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : '加载作业列表失败';
      toast.error(message);
    } finally {
      setLoading(false);
    }
  };

  const loadSubmissions = async (assignmentId?: number) => {
    if (!token) return;
    try {
      const response = await getMySubmissionsApi(token, assignmentId);
      setSubmissions(response.submissions);
    } catch (error) {
      const message = error instanceof Error ? error.message : '加载提交记录失败';
      toast.error(message);
    }
  };

  useEffect(() => {
    void loadAssignments();
  }, [token]);

  useEffect(() => {
    if (!selectedAssignmentId) {
      void loadSubmissions();
      return;
    }
    void loadSubmissions(selectedAssignmentId);
  }, [selectedAssignmentId, token]);

  return (
    <div className="min-h-screen bg-muted/30">
      <AuthTopBar title="学生工作台" subtitle="查看作业、提交实验、查看评分" />
      <main className="mx-auto max-w-7xl px-4 py-6 space-y-4">
        <Card>
          <CardHeader>
            <CardTitle>我的作业</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>ID</TableHead>
                  <TableHead>作业标题</TableHead>
                  <TableHead>班级</TableHead>
                  <TableHead>场景ID</TableHead>
                  <TableHead>尝试次数</TableHead>
                  <TableHead>最新分数</TableHead>
                  <TableHead />
                </TableRow>
              </TableHeader>
              <TableBody>
                {assignments.map((assignment) => (
                  <TableRow key={assignment.id}>
                    <TableCell>{assignment.id}</TableCell>
                    <TableCell>{assignment.title}</TableCell>
                    <TableCell>{assignment.class_name || '-'}</TableCell>
                    <TableCell>
                      <Badge variant="outline">{assignment.scenario_id}</Badge>
                    </TableCell>
                    <TableCell>{assignment.attempt_count || 0}</TableCell>
                    <TableCell>{assignment.latest_score ?? '-'}</TableCell>
                    <TableCell className="flex items-center gap-2">
                      <Button
                        size="sm"
                        variant={selectedAssignmentId === assignment.id ? 'default' : 'outline'}
                        onClick={() => setSelectedAssignmentId(assignment.id)}
                      >
                        查看成绩
                      </Button>
                      <Button size="sm" asChild>
                        <Link to={`/student/workspace/${assignment.id}`}>进入空白画布</Link>
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
                {assignments.length === 0 && !loading ? (
                  <TableRow>
                    <TableCell colSpan={7} className="text-center text-muted-foreground">
                      暂无作业
                    </TableCell>
                  </TableRow>
                ) : null}
              </TableBody>
            </Table>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>我的提交与评分</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="flex items-center gap-2">
              <span className="text-sm text-muted-foreground">筛选作业</span>
              <Select
                value={selectedAssignmentId ? String(selectedAssignmentId) : 'all'}
                onValueChange={(value) =>
                  setSelectedAssignmentId(value === 'all' ? null : Number(value))
                }
              >
                <SelectTrigger className="w-80">
                  <SelectValue placeholder="全部作业" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">全部作业</SelectItem>
                  {assignments.map((assignment) => (
                    <SelectItem key={assignment.id} value={String(assignment.id)}>
                      #{assignment.id} {assignment.title}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            {selectedAssignment ? (
              <p className="text-xs text-muted-foreground">
                当前作业: #{selectedAssignment.id} {selectedAssignment.title}
              </p>
            ) : null}
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>提交ID</TableHead>
                  <TableHead>作业</TableHead>
                  <TableHead>尝试</TableHead>
                  <TableHead>评分轨迹</TableHead>
                  <TableHead>提交时间</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {submissions.map((submission) => (
                  <TableRow key={submission.id}>
                    <TableCell>{submission.id}</TableCell>
                    <TableCell>{submission.title || '-'}</TableCell>
                    <TableCell>{submission.attempt_no}</TableCell>
                    <TableCell>
                      <ScoreTrace submission={submission} />
                    </TableCell>
                    <TableCell>{submission.submitted_at}</TableCell>
                  </TableRow>
                ))}
                {submissions.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={5} className="text-center text-muted-foreground">
                      暂无提交记录
                    </TableCell>
                  </TableRow>
                ) : null}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </main>
    </div>
  );
}

