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
import { Textarea } from '@/components/ui/textarea';
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
  const [evidenceNotes, setEvidenceNotes] = useState('');
  const [troubleshooting, setTroubleshooting] = useState('');
  const [summary, setSummary] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async () => {
    if (!token) {
      toast.error('登录已失效，请重新登录');
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
        routerConfig: simulator.routerConfig,
        serverConfig: simulator.serverConfig,
      };

      const evidence = {
        notes: evidenceNotes,
        logs: simulator.logs.slice(-30),
        database: simulator.database,
        counters: {
          componentCount: simulator.placedComponents.length,
          connectionCount: simulator.connections.length,
        },
      };

      const labReport = {
        summary,
        troubleshooting,
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
      setEvidenceNotes('');
      setTroubleshooting('');
      setSummary('');
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
      <DialogContent className="sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>提交实验作业</DialogTitle>
          <DialogDescription>
            作业 #{assignmentId} {assignmentTitle ? `- ${assignmentTitle}` : ''}
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-4 py-2">
          <div className="grid gap-2">
            <Label htmlFor="evidence-notes">证据说明</Label>
            <Textarea
              id="evidence-notes"
              value={evidenceNotes}
              onChange={(event) => setEvidenceNotes(event.target.value)}
              placeholder="填写关键连线、运行结果、数据库证据..."
              rows={4}
            />
          </div>
          <div className="grid gap-2">
            <Label htmlFor="troubleshooting">排错过程</Label>
            <Textarea
              id="troubleshooting"
              value={troubleshooting}
              onChange={(event) => setTroubleshooting(event.target.value)}
              placeholder="填写故障现象、定位过程、修复步骤..."
              rows={4}
            />
          </div>
          <div className="grid gap-2">
            <Label htmlFor="summary">任务单总结</Label>
            <Textarea
              id="summary"
              value={summary}
              onChange={(event) => setSummary(event.target.value)}
              placeholder="填写实验结论、收获与改进点..."
              rows={4}
            />
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

