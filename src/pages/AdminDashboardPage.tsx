import { FormEvent, useEffect, useState } from 'react';
import { AuthTopBar } from '@/components/auth/AuthTopBar';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { createTeacherApi, deleteTeacherApi, getTeachersApi } from '@/api/eduApi';
import { useAuthStore } from '@/store/authStore';
import { TeacherInfo } from '@/types/edu';
import { toast } from 'sonner';

export default function AdminDashboardPage() {
  const token = useAuthStore((state) => state.token);
  const [teachers, setTeachers] = useState<TeacherInfo[]>([]);
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [deletingTeacherId, setDeletingTeacherId] = useState<number | null>(null);
  const [form, setForm] = useState({
    username: '',
    displayName: '',
    password: '',
  });

  const loadTeachers = async () => {
    if (!token) return;
    setLoading(true);
    try {
      const response = await getTeachersApi(token);
      setTeachers(response.teachers);
    } catch (error) {
      const message = error instanceof Error ? error.message : '加载教师列表失败';
      toast.error(message);
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteTeacher = async (teacher: TeacherInfo) => {
    if (!token) return;
    const confirmed = window.confirm(
      `确认删除教师账号「${teacher.display_name}(${teacher.username})」吗？其名下班级与作业数据会一并删除。`
    );
    if (!confirmed) return;

    setDeletingTeacherId(teacher.id);
    try {
      const response = await deleteTeacherApi(token, teacher.id);
      toast.success(
        `已删除教师 ${response.teacher.displayName}，同步删除班级 ${response.teacher.deletedClassCount} 个`
      );
      await loadTeachers();
    } catch (error) {
      const message = error instanceof Error ? error.message : '删除教师失败';
      toast.error(message);
    } finally {
      setDeletingTeacherId(null);
    }
  };

  useEffect(() => {
    void loadTeachers();
  }, [token]);

  const handleCreateTeacher = async (event: FormEvent) => {
    event.preventDefault();
    if (!token) return;
    setSubmitting(true);
    try {
      await createTeacherApi(token, form);
      toast.success('教师账号已创建');
      setForm({ username: '', displayName: '', password: '' });
      await loadTeachers();
    } catch (error) {
      const message = error instanceof Error ? error.message : '创建教师失败';
      toast.error(message);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-muted/30">
      <AuthTopBar title="管理员工作台" subtitle="教师账号管理" />
      <main className="mx-auto max-w-7xl px-4 py-6 space-y-4">
        <Card>
          <CardHeader>
            <CardTitle>创建教师账号</CardTitle>
          </CardHeader>
          <CardContent>
            <form className="grid gap-3 md:grid-cols-4" onSubmit={handleCreateTeacher}>
              <div className="space-y-1">
                <Label htmlFor="teacher-username">用户名</Label>
                <Input
                  id="teacher-username"
                  value={form.username}
                  onChange={(event) => setForm((state) => ({ ...state, username: event.target.value }))}
                  required
                />
              </div>
              <div className="space-y-1">
                <Label htmlFor="teacher-name">显示名</Label>
                <Input
                  id="teacher-name"
                  value={form.displayName}
                  onChange={(event) => setForm((state) => ({ ...state, displayName: event.target.value }))}
                  required
                />
              </div>
              <div className="space-y-1">
                <Label htmlFor="teacher-password">初始密码</Label>
                <Input
                  id="teacher-password"
                  value={form.password}
                  onChange={(event) => setForm((state) => ({ ...state, password: event.target.value }))}
                  required
                />
              </div>
              <div className="flex items-end">
                <Button type="submit" disabled={submitting} className="w-full">
                  {submitting ? '创建中...' : '创建教师'}
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>教师列表</CardTitle>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>ID</TableHead>
                  <TableHead>用户名</TableHead>
                  <TableHead>显示名</TableHead>
                  <TableHead>状态</TableHead>
                  <TableHead>创建时间</TableHead>
                  <TableHead>操作</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {teachers.map((teacher) => (
                  <TableRow key={teacher.id}>
                    <TableCell>{teacher.id}</TableCell>
                    <TableCell>{teacher.username}</TableCell>
                    <TableCell>{teacher.display_name}</TableCell>
                    <TableCell>{teacher.status}</TableCell>
                    <TableCell>{teacher.created_at}</TableCell>
                    <TableCell>
                      <Button
                        size="sm"
                        variant="destructive"
                        disabled={deletingTeacherId === teacher.id}
                        onClick={() => void handleDeleteTeacher(teacher)}
                      >
                        {deletingTeacherId === teacher.id ? '删除中...' : '删除'}
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
                {teachers.length === 0 && !loading ? (
                  <TableRow>
                    <TableCell colSpan={6} className="text-center text-muted-foreground">
                      暂无教师数据
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
