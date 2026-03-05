import { Badge } from '@/components/ui/badge';
import { SubmissionInfo } from '@/types/edu';

interface ScoreTraceProps {
  submission: SubmissionInfo;
}

export function ScoreTrace({ submission }: ScoreTraceProps) {
  const autoTotal = Number(submission.auto_total || 0);
  const finalTotal = Number(submission.final_total || 0);
  const overridden = finalTotal !== autoTotal;

  return (
    <div className="flex flex-wrap items-center gap-2 text-xs">
      <Badge variant="secondary">自动分: {autoTotal}</Badge>
      <Badge variant={overridden ? 'destructive' : 'default'}>最终分: {finalTotal}</Badge>
      {overridden ? <Badge variant="outline">已覆写</Badge> : <Badge variant="outline">未覆写</Badge>}
      {submission.teacher_comment ? (
        <span className="text-muted-foreground">评语: {submission.teacher_comment}</span>
      ) : null}
    </div>
  );
}

