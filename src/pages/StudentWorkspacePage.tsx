import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { getMyAssignmentsApi } from '@/api/eduApi';
import { useAuthStore } from '@/store/authStore';
import { AssignmentInfo } from '@/types/edu';
import { toast } from 'sonner';
import { SimulatorLayout } from '@/components/simulator/SimulatorLayout';

export default function StudentWorkspacePage() {
  const { assignmentId: assignmentIdText } = useParams();
  const token = useAuthStore((state) => state.token);
  const [assignment, setAssignment] = useState<AssignmentInfo | null>(null);
  const assignmentId = Number(assignmentIdText || 0);

  useEffect(() => {
    if (!token || Number.isNaN(assignmentId) || assignmentId <= 0) return;
    const loadAssignment = async () => {
      try {
        const response = await getMyAssignmentsApi(token);
        const matched = response.assignments.find((item) => item.id === assignmentId) || null;
        setAssignment(matched);
      } catch (error) {
        const message = error instanceof Error ? error.message : '加载作业失败';
        toast.error(message);
      }
    };
    void loadAssignment();
  }, [assignmentId, token]);

  if (Number.isNaN(assignmentId) || assignmentId <= 0) {
    return (
      <main className="min-h-screen flex items-center justify-center">
        <div className="text-center space-y-2">
          <p className="text-muted-foreground">无效作业编号</p>
          <Button asChild>
            <Link to="/student">返回学生工作台</Link>
          </Button>
        </div>
      </main>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <SimulatorLayout
        role="student"
        initialScenarioId={assignment?.scenario_id || 'classroom-temperature'}
        submissionContext={{
          assignmentId,
          assignmentTitle: assignment?.title,
        }}
        headerActions={
          <Button size="sm" variant="secondary" asChild>
            <Link to="/student">返回学生工作台</Link>
          </Button>
        }
      />
    </div>
  );
}
