import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { toast } from 'sonner';
import {
  analyzeSubmissionWithAiApi,
  getSubmissionDetailApi,
  testAiModelApi,
  type AiModelConfig,
} from '@/api/eduApi';
import { SimulatorLayout } from '@/components/simulator/SimulatorLayout';
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
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { useAuthStore } from '@/store/authStore';
import { BrowserPageRecord, useSimulatorStore } from '@/store/simulatorStore';
import { SubmissionDetail } from '@/types/edu';
import { Bot, Loader2 } from 'lucide-react';
import {
  Connection,
  DatabaseState,
  LogEntry,
  PlacedComponent,
  RouterConfig,
  ServerConfig,
} from '@/types/simulator';

const AI_CONFIG_STORAGE_KEY = 'teacher-submission-ai-config-v1';

const defaultAiConfig: AiModelConfig = {
  apiUrl: '',
  apiKey: '',
  model: '',
};

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

function toLogEntries(value: unknown): LogEntry[] {
  if (!Array.isArray(value)) return [];

  return value
    .filter(isRecord)
    .map((item) => ({
      timestamp: typeof item.timestamp === 'number' ? item.timestamp : Date.now(),
      type: ['info', 'warning', 'error', 'data'].includes(String(item.type))
        ? (item.type as LogEntry['type'])
        : 'info',
      message: typeof item.message === 'string' ? item.message : '',
      source: typeof item.source === 'string' ? item.source : '系统',
    }))
    .filter((item) => item.message.trim().length > 0);
}

function toBrowserPageRecords(value: unknown): BrowserPageRecord[] | null {
  if (!Array.isArray(value)) return null;

  return value
    .filter(isRecord)
    .map((item) => ({
      id: Number(item.id || 0),
      sensor_id: Number(item.sensor_id || 0),
      value: Number(item.value || 0),
      alarm: item.alarm === undefined ? undefined : Number(item.alarm),
      timestamp: typeof item.timestamp === 'string' ? item.timestamp : '',
    }));
}

function applySubmissionSnapshot(submission: SubmissionDetail) {
  const snapshot = isRecord(submission.snapshot) ? submission.snapshot : {};
  const evidence = isRecord(submission.evidence) ? submission.evidence : {};
  const evidenceBrowser = isRecord(evidence.browser) ? evidence.browser : {};

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

  const nextStore = useSimulatorStore.getState();
  nextStore.setLogs(toLogEntries(evidence.logs));
  nextStore.setBrowserUrl(
    typeof snapshot.browserUrl === 'string'
      ? snapshot.browserUrl
      : typeof evidenceBrowser.url === 'string'
        ? evidenceBrowser.url
        : ''
  );
  nextStore.setBrowserResponse(
    typeof snapshot.browserResponse === 'string'
      ? snapshot.browserResponse
      : typeof evidenceBrowser.response === 'string'
        ? evidenceBrowser.response
        : ''
  );
  nextStore.setBrowserPageRecords(
    toBrowserPageRecords(snapshot.browserPageRecords) || toBrowserPageRecords(evidenceBrowser.records)
  );
  nextStore.setBrowserLastUpdate(
    typeof snapshot.browserLastUpdate === 'number'
      ? snapshot.browserLastUpdate
      : typeof evidenceBrowser.lastUpdate === 'number'
        ? evidenceBrowser.lastUpdate
        : null
  );
}

function loadAiConfig(): AiModelConfig {
  if (typeof window === 'undefined') return defaultAiConfig;
  try {
    const saved = window.localStorage.getItem(AI_CONFIG_STORAGE_KEY);
    const parsed = saved ? JSON.parse(saved) : null;
    if (!isRecord(parsed)) return defaultAiConfig;
    return {
      apiUrl: typeof parsed.apiUrl === 'string' ? parsed.apiUrl : '',
      apiKey: typeof parsed.apiKey === 'string' ? parsed.apiKey : '',
      model: typeof parsed.model === 'string' ? parsed.model : '',
    };
  } catch {
    return defaultAiConfig;
  }
}

function saveAiConfig(config: AiModelConfig) {
  try {
    window.localStorage.setItem(AI_CONFIG_STORAGE_KEY, JSON.stringify(config));
  } catch {
    // 忽略本地存储失败。
  }
}

function SubmissionAiAnalysisDialog({
  token,
  submissionId,
  disabled,
}: {
  token: string | null;
  submissionId: number;
  disabled?: boolean;
}) {
  const [config, setConfig] = useState<AiModelConfig>(() => loadAiConfig());
  const [result, setResult] = useState('');
  const [busyAction, setBusyAction] = useState<'test' | 'analyze' | null>(null);

  const updateConfig = (field: keyof AiModelConfig, value: string) => {
    const nextConfig = { ...config, [field]: value };
    setConfig(nextConfig);
    saveAiConfig(nextConfig);
  };

  const validateConfig = () => {
    if (!token) {
      toast.error('登录已失效，请重新登录');
      return false;
    }
    if (!config.apiUrl.trim()) {
      toast.error('请填写 API URL');
      return false;
    }
    if (!config.model.trim()) {
      toast.error('请填写模型名称');
      return false;
    }
    return true;
  };

  const handleTestModel = async () => {
    if (!validateConfig() || !token) return;
    setBusyAction('test');
    setResult('');
    try {
      const response = await testAiModelApi(token, config);
      setResult(response.content);
      toast.success('模型测试通过');
    } catch (error) {
      const message = error instanceof Error ? error.message : '模型测试失败';
      setResult(message);
      toast.error(message);
    } finally {
      setBusyAction(null);
    }
  };

  const handleAnalyze = async () => {
    if (!validateConfig() || !token) return;
    setBusyAction('analyze');
    setResult('');
    try {
      const response = await analyzeSubmissionWithAiApi(token, submissionId, config);
      setResult(response.analysis);
      toast.success('AI 分析完成');
    } catch (error) {
      const message = error instanceof Error ? error.message : 'AI 分析失败';
      setResult(message);
      toast.error(message);
    } finally {
      setBusyAction(null);
    }
  };

  const busy = busyAction !== null;

  return (
    <Dialog>
      <DialogTrigger asChild>
        <Button size="sm" variant="outline" disabled={disabled}>
          <Bot className="mr-1 h-4 w-4" />
          AI分析
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>AI 分析学生画布</DialogTitle>
          <DialogDescription>
            使用 OpenAI-compatible Chat Completions 接口分析当前提交。配置保存在当前浏览器，API Key 不写入项目数据库。
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-4 py-2">
          <div className="grid gap-2">
            <Label htmlFor="ai-api-url">API URL</Label>
            <Input
              id="ai-api-url"
              value={config.apiUrl}
              onChange={(event) => updateConfig('apiUrl', event.target.value)}
              placeholder="https://api.example.com/v1 或 https://api.example.com/v1/chat/completions"
            />
          </div>

          <div className="grid gap-2 md:grid-cols-[minmax(0,1fr)_13rem]">
            <div className="grid gap-2">
              <Label htmlFor="ai-api-key">API Key</Label>
              <Input
                id="ai-api-key"
                type="password"
                value={config.apiKey}
                onChange={(event) => updateConfig('apiKey', event.target.value)}
                placeholder="sk-..."
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="ai-model">Model</Label>
              <Input
                id="ai-model"
                value={config.model}
                onChange={(event) => updateConfig('model', event.target.value)}
                placeholder="gpt-4o-mini"
              />
            </div>
          </div>

          <div className="grid gap-2">
            <Label htmlFor="ai-result">输出</Label>
            <Textarea
              id="ai-result"
              readOnly
              value={result}
              placeholder="先测试模型，或直接分析当前学生提交。"
              className="min-h-64 font-mono text-xs"
            />
          </div>
        </div>

        <DialogFooter className="gap-2 sm:justify-between">
          <Button variant="outline" onClick={handleTestModel} disabled={busy}>
            {busyAction === 'test' ? <Loader2 className="mr-1 h-4 w-4 animate-spin" /> : null}
            测试模型
          </Button>
          <Button onClick={handleAnalyze} disabled={busy}>
            {busyAction === 'analyze' ? <Loader2 className="mr-1 h-4 w-4 animate-spin" /> : null}
            分析当前画布
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
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
            <SubmissionAiAnalysisDialog
              token={token}
              submissionId={submissionId}
              disabled={!submission || loading}
            />
            {submission ? (
              <span className="hidden md:inline-flex text-xs px-2 py-1 rounded border bg-muted/50">
                学生：{submission.submitted_student_name || submission.display_name || submission.username || '-'} | 第 {submission.attempt_no} 次提交
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
