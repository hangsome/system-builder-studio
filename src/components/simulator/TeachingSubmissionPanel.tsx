import { useState } from 'react';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { submitAssignmentApi } from '@/api/eduApi';
import { useSimulatorStore } from '@/store/simulatorStore';
import { useAuthStore } from '@/store/authStore';
import { toast } from 'sonner';

interface TeachingSubmissionPanelProps {
  assignmentId: number;
  assignmentTitle?: string;
  onSubmitted?: () => void;
}

export function TeachingSubmissionPanel({
  assignmentId,
  assignmentTitle,
  onSubmitted,
}: TeachingSubmissionPanelProps) {
  const token = useAuthStore((state) => state.token);
  const [open, setOpen] = useState(false);
  const [studentName, setStudentName] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async () => {
    if (!token) {
      toast.error('登录已失效，请重新登录');
      return;
    }

    if (!studentName.trim()) {
      toast.error('请先填写姓名，方便教师后台识别提交');
      return;
    }

    setSubmitting(true);
    try {
      const simulator = useSimulatorStore.getState();
      const snapshot = {
        placedComponents: simulator.placedComponents,
        connections: simulator.connections,
        microbitCode: simulator.microbitCode,
        flaskCode: simulator.flaskCode,
        database: simulator.database,
        routerConfig: simulator.routerConfig,
        serverConfig: simulator.serverConfig,
      };

      const evidence = {
        studentName: studentName.trim(),
        logs: simulator.logs.slice(-30),
        database: simulator.database,
        sensorlogCount: simulator.database.records.sensorlog?.length ?? 0,
        counters: {
          componentCount: simulator.placedComponents.length,
          connectionCount: simulator.connections.length,
        },
      };

      const labReport = {
        studentName: studentName.trim(),
        submittedAt: new Date().toISOString(),
      };

      const response = await submitAssignmentApi(token, assignmentId, {
        snapshot,
        evidence,
        labReport,
      });

      toast.success(
        `提交成功：第 ${response.submission.attemptNo} 次，自动分 ${response.submission.finalTotal}`
      );
      setOpen(false);
      setStudentName('');
      onSubmitted?.();
    } catch (error) {
      const message = error instanceof Error ? error.message : '提交失败';
      toast.error(message);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="sm">提交作业</Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>提交课堂画布</DialogTitle>
          <DialogDescription>
            {assignmentTitle ? `${assignmentTitle}：` : ''}
            只需要填写姓名。系统会自动提交当前画布、连线、代码、数据库和运行日志，并自动检测关键任务得分。
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-4 py-2">
          <div className="grid gap-2">
            <Label htmlFor="student-name">姓名</Label>
            <Input
              id="student-name"
              value={studentName}
              onChange={(event) => setStudentName(event.target.value)}
              placeholder="例如：王同学"
            />
          </div>

          <div className="rounded-lg border bg-muted/40 p-3 text-sm leading-6 text-muted-foreground">
            自动提交内容：画布组件、连线、micro:bit 代码、Flask 代码、数据库记录、运行日志。教师后台可打开该同学提交的画布，并查看自动检测得分。
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)} disabled={submitting}>
            取消
          </Button>
          <Button onClick={handleSubmit} disabled={submitting}>
            {submitting ? '提交中...' : '确认提交'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
