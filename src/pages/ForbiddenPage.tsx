import { Link } from 'react-router-dom';
import { Button } from '@/components/ui/button';

export default function ForbiddenPage() {
  return (
    <main className="min-h-screen bg-muted/30 flex items-center justify-center p-4">
      <div className="max-w-md text-center space-y-4">
        <h1 className="text-3xl font-semibold">403</h1>
        <p className="text-muted-foreground">当前账号没有访问该页面的权限。</p>
        <Button asChild>
          <Link to="/">返回首页</Link>
        </Button>
      </div>
    </main>
  );
}

