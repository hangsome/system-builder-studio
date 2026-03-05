import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { toast } from 'sonner';
import { getSubmissionDetailApi } from '@/api/eduApi';
import { SimulatorLayout } from '@/components/simulator/SimulatorLayout';
import { Button } from '@/components/ui/button';
import { useAuthStore } from '@/store/authStore';
import { useSimulatorStore } from '@/store/simulatorStore';
import { SubmissionDetail } from '@/types/edu';
import {
  Connection,
  DatabaseState,
  PlacedComponent,
  RouterConfig,
  ServerConfig,
} from '@/types/simulator';

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

function toRouterConfig(value: unknown, fallback: RouterConfig): RouterConfig {
  if (!isRecord(value)) return fallback;
  const merged = { ...fallback, ...(value as Partial<RouterConfig>) };
  if (!Array.isArray(merged.connectedDevices)) {
    merged.connectedDevices = fallback.connectedDevices;
  }
  return merged;
}

function toServerConfig(value: unknown, fallback: ServerConfig): ServerConfig {
  if (!isRecord(value)) return fallback;
  const merged = { ...fallback, ...(value as Partial<ServerConfig>) };
  if (!Array.isArray(merged.routes)) {
    merged.routes = fallback.routes;
  }
  if (!Array.isArray(merged.logs)) {
    merged.logs = fallback.logs;
  }
  return merged;
}

function toDatabaseState(value: unknown, fallback: DatabaseState): DatabaseState {
  if (!isRecord(value)) return fallback;
  const tables = Array.isArray(value.tables)
    ? (value.tables as DatabaseState['tables'])
    : fallback.tables;
  const records = isRecord(value.records)
    ? (value.records as DatabaseState['records'])
    : fallback.records;
  return {
    tables,
    records,
  };
}

function applySubmissionSnapshot(submission: SubmissionDetail) {
  const snapshot = isRecord(submission.snapshot) ? submission.snapshot : {};
  const evidence = isRecord(submission.evidence) ? submission.evidence : {};

  const store = useSimulatorStore.getState();
  store.resetSimulator();
  const baseline = useSimulatorStore.getState();

  const components = Array.isArray(snapshot.placedComponents)
    ? (snapshot.placedComponents as PlacedComponent[])
    : [];
  const connections = Array.isArray(snapshot.connections)
    ? (snapshot.connections as Connection[])
    : [];
  const microbitCode = typeof snapshot.microbitCode === 'string'
    ? snapshot.microbitCode
    : baseline.microbitCode;
  const flaskCode = typeof snapshot.flaskCode === 'string'
    ? snapshot.flaskCode
    : baseline.flaskCode;

  const databaseSource = snapshot.database ?? evidence.database;
  const database = toDatabaseState(databaseSource, baseline.database);
  const routerConfig = toRouterConfig(snapshot.routerConfig, baseline.routerConfig);
  const serverConfig = toServerConfig(snapshot.serverConfig, baseline.serverConfig);

  store.loadScenario({
    components,
    connections,
    microbitCode,
    flaskCode,
    database,
    routerConfig,
    serverConfig,
  });
}

export default function TeacherSubmissionCanvasPage() {
  const { submissionId: submissionIdText } = useParams();
  const token = useAuthStore((state) => state.token);
  const [submission, setSubmission] = useState<SubmissionDetail | null>(null);
  const [loading, setLoading] = useState(false);
  const submissionId = Number(submissionIdText || 0);

  useEffect(() => {
    if (!token || Number.isNaN(submissionId) || submissionId <= 0) return;

    const loadSubmission = async () => {
      setLoading(true);
      try {
        const response = await getSubmissionDetailApi(token, submissionId);
        setSubmission(response.submission);
        applySubmissionSnapshot(response.submission);
      } catch (error) {
        const message = error instanceof Error ? error.message : '加载提交画布失败';
        toast.error(message);
      } finally {
        setLoading(false);
      }
    };

    void loadSubmission();
  }, [submissionId, token]);

  if (Number.isNaN(submissionId) || submissionId <= 0) {
    return (
      <main className="min-h-screen flex items-center justify-center">
        <div className="text-center space-y-2">
          <p className="text-muted-foreground">无效提交编号</p>
          <Button asChild>
            <Link to="/teacher">返回教师工作台</Link>
          </Button>
        </div>
      </main>
    );
  }

  if (loading && !submission) {
    return (
      <main className="min-h-screen flex items-center justify-center">
        <p className="text-muted-foreground">正在加载学生提交画布...</p>
      </main>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <SimulatorLayout
        role="teacher"
        submissionContext={
          submission
            ? {
                assignmentId: submission.assignment_id,
                assignmentTitle: submission.assignment_title,
              }
            : undefined
        }
        headerActions={
          <>
            {submission ? (
              <span className="hidden md:inline-flex text-xs px-2 py-1 rounded border bg-muted/50">
                学生：{submission.display_name || submission.username || '-'} | 第 {submission.attempt_no} 次提交
              </span>
            ) : null}
            <Button size="sm" variant="secondary" asChild>
              <Link to="/teacher">返回教师工作台</Link>
            </Button>
          </>
        }
      />
    </div>
  );
}
