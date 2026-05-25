import { FormEvent, useEffect, useState } from 'react';
import { Navigate, useLocation, useNavigate } from 'react-router-dom';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { useAuthStore } from '@/store/authStore';
import { toast } from 'sonner';

function roleHome(role: string) {
  if (role === 'admin') return '/admin';
  if (role === 'teacher') return '/teacher';
  return '/student';
}

function canUseReturnPath(path: string, role: string) {
  if (path.startsWith('/admin')) return role === 'admin';
  if (path.startsWith('/teacher')) return role === 'teacher';
  if (path.startsWith('/student')) return role === 'student';
  return true;
}

export default function LoginPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const hydrated = useAuthStore((state) => state.hydrated);
  const user = useAuthStore((state) => state.user);
  const token = useAuthStore((state) => state.token);
  const tokenExpireAt = useAuthStore((state) => state.tokenExpireAt);
  const login = useAuthStore((state) => state.login);
  const refreshMe = useAuthStore((state) => state.refreshMe);
  const hasValidSession = Boolean(token && tokenExpireAt && Date.now() < tokenExpireAt);

  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (hasValidSession && !user) {
      void refreshMe();
    }
  }, [hasValidSession, refreshMe, user]);

  if (hydrated && hasValidSession && user) {
    return <Navigate to={roleHome(user.role)} replace />;
  }

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault();
    setSubmitting(true);
    try {
      const loggedUser = await login(username.trim(), password);
      toast.success(`欢迎回来，${loggedUser.displayName}`);
      const from = (location.state as { from?: string } | null)?.from;
      const nextPath = from && canUseReturnPath(from, loggedUser.role)
        ? from
        : roleHome(loggedUser.role);
      navigate(nextPath, { replace: true });
    } catch (error) {
      const message = error instanceof Error ? error.message : '登录失败';
      toast.error(message);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <main className="min-h-screen bg-muted/30 flex items-center justify-center p-4">
      <Card className="w-full max-w-md">
        <CardHeader>
          <CardTitle>教学版登录</CardTitle>
          <CardDescription>学生/教师/管理员使用统一入口登录</CardDescription>
        </CardHeader>
        <CardContent>
          <form className="space-y-4" onSubmit={handleSubmit}>
            <div className="space-y-2">
              <Label htmlFor="username">用户名</Label>
              <Input
                id="username"
                value={username}
                onChange={(event) => setUsername(event.target.value)}
                placeholder="请输入用户名"
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="password">密码</Label>
              <Input
                id="password"
                type="password"
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                placeholder="请输入密码"
                required
              />
            </div>
            <Button className="w-full" type="submit" disabled={submitting}>
              {submitting ? '登录中...' : '登录'}
            </Button>
          </form>
          <p className="mt-4 text-xs text-muted-foreground">
            默认种子账号可由后端脚本创建（管理员与教师），学生账号由 CSV 导入生成。
          </p>
        </CardContent>
      </Card>
    </main>
  );
}
