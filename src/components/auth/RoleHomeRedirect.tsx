import { Navigate } from 'react-router-dom';
import { useAuthStore } from '@/store/authStore';

export function RoleHomeRedirect() {
  const hydrated = useAuthStore((state) => state.hydrated);
  const user = useAuthStore((state) => state.user);
  const token = useAuthStore((state) => state.token);
  const tokenExpireAt = useAuthStore((state) => state.tokenExpireAt);
  const hasValidSession = Boolean(token && tokenExpireAt && Date.now() < tokenExpireAt);

  if (!hydrated) {
    return (
      <div className="min-h-screen flex items-center justify-center text-muted-foreground">
        正在加载...
      </div>
    );
  }

  if (!hasValidSession || !user) {
    return <Navigate to="/login" replace />;
  }

  if (user.role === 'admin') return <Navigate to="/admin" replace />;
  if (user.role === 'teacher') return <Navigate to="/teacher" replace />;
  return <Navigate to="/student" replace />;
}
