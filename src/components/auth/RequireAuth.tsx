import { ReactNode, useEffect, useState } from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { useAuthStore } from '@/store/authStore';
import { UserRole } from '@/types/edu';

interface RequireAuthProps {
  allowedRoles?: UserRole[];
  children: ReactNode;
}

function RoleMismatchLoginRedirect({ from }: { from: string }) {
  const clearSession = useAuthStore((state) => state.clearSession);
  const [cleared, setCleared] = useState(false);

  useEffect(() => {
    clearSession();
    setCleared(true);
  }, [clearSession]);

  if (!cleared) {
    return (
      <div className="min-h-screen flex items-center justify-center text-muted-foreground">
        正在切换登录身份...
      </div>
    );
  }

  return <Navigate to="/login" replace state={{ from }} />;
}

export function RequireAuth({ allowedRoles, children }: RequireAuthProps) {
  const location = useLocation();
  const hydrated = useAuthStore((state) => state.hydrated);
  const user = useAuthStore((state) => state.user);
  const token = useAuthStore((state) => state.token);
  const tokenExpireAt = useAuthStore((state) => state.tokenExpireAt);
  const hasValidSession = Boolean(token && tokenExpireAt && Date.now() < tokenExpireAt);

  if (!hydrated) {
    return (
      <div className="min-h-screen flex items-center justify-center text-muted-foreground">
        正在恢复登录状态...
      </div>
    );
  }

  if (!hasValidSession || !user) {
    return <Navigate to="/login" replace state={{ from: location.pathname }} />;
  }

  if (allowedRoles && allowedRoles.length > 0 && !allowedRoles.includes(user.role)) {
    return <RoleMismatchLoginRedirect from={location.pathname} />;
  }

  return <>{children}</>;
}
