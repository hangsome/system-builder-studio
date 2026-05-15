import { ReactNode } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { useAuthStore } from '@/store/authStore';

interface AuthTopBarProps {
  title: string;
  subtitle?: string;
  actions?: ReactNode;
}

export function AuthTopBar({ title, subtitle, actions }: AuthTopBarProps) {
  const navigate = useNavigate();
  const user = useAuthStore((state) => state.user);
  const clearSession = useAuthStore((state) => state.clearSession);
  const showLogout = user?.role !== 'student';

  return (
    <header className="border-b bg-card">
      <div className="mx-auto max-w-7xl px-4 py-3 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-lg font-semibold">{title}</h1>
          <p className="text-xs text-muted-foreground">
            {subtitle || '教学版控制台'} | 当前用户: {user?.displayName || user?.username}
          </p>
        </div>
        <div className="flex items-center gap-2">
          {actions}
          {showLogout ? (
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                clearSession();
                navigate('/login', { replace: true });
              }}
            >
              退出登录
            </Button>
          ) : null}
          <Button variant="ghost" size="sm" asChild>
            <Link to="/">首页</Link>
          </Button>
        </div>
      </div>
    </header>
  );
}
