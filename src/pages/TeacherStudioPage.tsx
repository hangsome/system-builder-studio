import { Link } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { SimulatorLayout } from '@/components/simulator/SimulatorLayout';

export default function TeacherStudioPage() {
  return (
    <div className="min-h-screen bg-background">
      <SimulatorLayout
        role="teacher"
        headerActions={
          <>
            <Button size="sm" variant="secondary" asChild>
              <Link to="/teacher">返回教师工作台</Link>
            </Button>
            <Button size="sm" variant="outline" asChild>
              <Link to="/teacher">查看学生提交</Link>
            </Button>
          </>
        }
      />
    </div>
  );
}
