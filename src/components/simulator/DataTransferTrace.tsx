import {
  Activity,
  AlertCircle,
  ArrowRight,
  CheckCircle2,
  Cpu,
  Database,
  Monitor,
  Radio,
  Server,
  Wifi,
  type LucideIcon,
} from 'lucide-react';
import { useMemo, useState } from 'react';
import type { LogEntry } from '@/types/simulator';
import { cn } from '@/lib/utils';

export interface DataTransferSensor {
  id: string;
  name: string;
  value?: number;
  unit?: string;
  powered?: boolean;
}

type TraceStatus = 'blocked' | 'idle' | 'ready' | 'active';

interface TraceStage {
  id: string;
  title: string;
  subtitle: string;
  detail: string;
  status: TraceStatus;
  icon: LucideIcon;
}

interface DataTransferTraceProps {
  isRunning: boolean;
  codeBurned: boolean;
  sensors: DataTransferSensor[];
  serialConnected?: boolean;
  networkConnected: boolean;
  routerSsid: string;
  serverRunning: boolean;
  serverAddress: string;
  databaseRecordCount: number;
  logs?: LogEntry[];
}

const statusText: Record<TraceStatus, string> = {
  blocked: '阻塞',
  idle: '待机',
  ready: '就绪',
  active: '传输中',
};

const statusClass: Record<TraceStatus, string> = {
  blocked: 'border-red-200 bg-red-50 text-red-700 dark:border-red-900 dark:bg-red-950/20 dark:text-red-300',
  idle: 'border-border bg-background text-muted-foreground',
  ready: 'border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-900 dark:bg-emerald-950/20 dark:text-emerald-300',
  active: 'border-blue-200 bg-blue-50 text-blue-700 shadow-sm dark:border-blue-900 dark:bg-blue-950/30 dark:text-blue-300',
};

const dotClass: Record<TraceStatus, string> = {
  blocked: 'bg-red-500',
  idle: 'bg-muted-foreground/40',
  ready: 'bg-emerald-500',
  active: 'bg-blue-500 animate-pulse',
};

function formatSensorValue(sensor?: DataTransferSensor) {
  if (!sensor || sensor.value === undefined || Number.isNaN(sensor.value)) {
    return '暂无采样';
  }

  const decimals = Number.isInteger(sensor.value) ? 0 : 1;
  return `${sensor.value.toFixed(decimals)}${sensor.unit ? ` ${sensor.unit}` : ''}`;
}

function getLatestStageId(logs: LogEntry[] | undefined): string | null {
  const lastLog = logs?.[logs.length - 1];
  if (!lastLog) return null;

  const source = lastLog.source.toLowerCase();
  if (source.includes('sqlite') || source.includes('database')) return 'database';
  if (source.includes('flask') || source.includes('api')) return 'api';
  if (source.includes('iot') || source.includes('wifi')) return 'wifi';
  if (source.includes('micro')) return 'serial';
  if (lastLog.type === 'data') return 'sensor';
  return null;
}

export function DataTransferTrace({
  isRunning,
  codeBurned,
  sensors,
  serialConnected = true,
  networkConnected,
  routerSsid,
  serverRunning,
  serverAddress,
  databaseRecordCount,
  logs,
}: DataTransferTraceProps) {
  const [selectedStageId, setSelectedStageId] = useState('sensor');

  const poweredSensors = useMemo(
    () => sensors.filter((sensor) => sensor.powered !== false),
    [sensors]
  );
  const primarySensor = poweredSensors[0] ?? sensors[0];
  const latestStageId = getLatestStageId(logs);
  const hasSensor = sensors.length > 0;
  const hasPoweredSensor = poweredSensors.length > 0;
  const hasRouteTarget = Boolean(routerSsid.trim()) && serverRunning;
  const activeFlow = isRunning && codeBurned && hasPoweredSensor && serialConnected && networkConnected && serverRunning;

  const stages: TraceStage[] = [
    {
      id: 'sensor',
      title: '传感器 / 采集',
      subtitle: hasSensor ? `${poweredSensors.length}/${sensors.length} 路可读` : '未放置传感器',
      detail: hasSensor
        ? `当前样本: ${primarySensor?.name ?? '传感器'} = ${formatSensorValue(primarySensor)}`
        : '先在画布中放置传感器，仿真才有可采集的数据源。',
      status: !hasSensor ? 'blocked' : isRunning && hasPoweredSensor ? 'active' : hasPoweredSensor ? 'ready' : 'blocked',
      icon: Activity,
    },
    {
      id: 'serial',
      title: 'micro:bit / 串口',
      subtitle: codeBurned ? '代码已烧录' : '等待烧录',
      detail: serialConnected
        ? 'micro:bit 读取采样值，并通过 TX/RX 串口把数据交给 IoT 模块。'
        : '需要保持 IoT TX/RX 与扩展板 P15/P16 的串口链路可用。',
      status: !codeBurned || !serialConnected ? 'blocked' : isRunning ? 'active' : 'ready',
      icon: Cpu,
    },
    {
      id: 'wifi',
      title: 'IoT / WiFi',
      subtitle: networkConnected ? routerSsid || 'WiFi 已连接' : '未连接 WiFi',
      detail: networkConnected
        ? `IoT 模块已接入 ${routerSsid || '无线网络'}，准备发起 HTTP 请求。`
        : 'IoT 模块需要供电、串口连接，并配置可用 SSID 后才能进入无线链路。',
      status: !networkConnected ? 'blocked' : isRunning ? 'active' : 'ready',
      icon: Wifi,
    },
    {
      id: 'api',
      title: 'Flask / API',
      subtitle: serverRunning ? serverAddress : '服务未启动',
      detail: serverRunning
        ? `请求路径: GET http://${serverAddress}/upload?temperature=${formatSensorValue(primarySensor).replace(/\s/g, '')}`
        : '启动 Flask 服务后，IoT 模块的 HTTP 请求才有接收端。',
      status: !serverRunning ? 'blocked' : activeFlow || latestStageId === 'api' ? 'active' : 'ready',
      icon: Server,
    },
    {
      id: 'database',
      title: '数据库 / 浏览器',
      subtitle: `sensorlog ${databaseRecordCount} 条`,
      detail: hasRouteTarget
        ? 'Flask 写入 SQLite 后，浏览器查询接口可以读取最新记录。'
        : '数据库展示依赖 Flask API 写入和浏览器查询链路。',
      status: activeFlow || latestStageId === 'database' ? 'active' : databaseRecordCount > 0 ? 'ready' : 'idle',
      icon: Database,
    },
  ];

  const selectedStage = stages.find((stage) => stage.id === selectedStageId) ?? stages[0];
  const packetPreview = formatSensorValue(primarySensor);

  return (
    <div className="border-b border-border bg-muted/20 px-3 py-2">
      <div className="mb-2 flex items-center justify-between gap-2">
        <div className="flex min-w-0 items-center gap-2">
          <Radio className="h-3.5 w-3.5 text-blue-600" />
          <span className="truncate text-xs font-medium">数据传输链路</span>
          <span className="rounded-full border bg-background px-2 py-0.5 text-[10px] text-muted-foreground">
            {activeFlow ? '端到端传输中' : isRunning ? '仿真运行中' : '等待运行'}
          </span>
        </div>
        <div className="hidden items-center gap-1 text-[10px] text-muted-foreground sm:flex">
          <Monitor className="h-3 w-3" />
          <span>浏览器读取 SQLite 查询结果</span>
        </div>
      </div>

      <div className="flex items-stretch gap-1 overflow-x-auto pb-1">
        {stages.map((stage, index) => {
          const Icon = stage.icon;
          const selected = selectedStage.id === stage.id;
          return (
            <div key={stage.id} className="flex min-w-fit items-center gap-1">
              <button
                type="button"
                onClick={() => setSelectedStageId(stage.id)}
                className={cn(
                  'min-w-32 rounded-md border px-2 py-1.5 text-left transition-colors hover:bg-accent hover:text-accent-foreground focus:outline-none focus:ring-2 focus:ring-ring',
                  statusClass[stage.status],
                  selected && 'ring-2 ring-ring'
                )}
              >
                <div className="flex items-center justify-between gap-2">
                  <div className="flex min-w-0 items-center gap-1.5">
                    <Icon className="h-3.5 w-3.5 flex-shrink-0" />
                    <span className="truncate text-[11px] font-medium">{stage.title}</span>
                  </div>
                  <span className={cn('h-2 w-2 flex-shrink-0 rounded-full', dotClass[stage.status])} />
                </div>
                <div className="mt-1 truncate text-[10px] opacity-80">{stage.subtitle}</div>
              </button>

              {index < stages.length - 1 ? (
                <ArrowRight className="h-3.5 w-3.5 flex-shrink-0 text-muted-foreground/70" />
              ) : null}
            </div>
          );
        })}
      </div>

      <div className="mt-2 grid gap-2 text-[10px] md:grid-cols-[minmax(0,1fr)_minmax(180px,0.85fr)]">
        <div className="min-w-0 rounded-md border bg-background px-2 py-1.5">
          <div className="mb-1 flex items-center gap-1.5 font-medium">
            {activeFlow ? (
              <CheckCircle2 className="h-3 w-3 text-emerald-600" />
            ) : (
              <AlertCircle className="h-3 w-3 text-muted-foreground" />
            )}
            <span>当前数据包</span>
          </div>
          <div className="truncate font-mono text-muted-foreground">
            {primarySensor?.name ?? 'sensor'} → temperature={packetPreview} → GET /upload → sensorlog
          </div>
        </div>

        <div className="min-w-0 rounded-md border bg-background px-2 py-1.5">
          <div className="mb-1 flex items-center justify-between gap-2">
            <span className="font-medium">{selectedStage.title}</span>
            <span className={cn('rounded-full px-1.5 py-0.5', statusClass[selectedStage.status])}>
              {statusText[selectedStage.status]}
            </span>
          </div>
          <p className="line-clamp-2 text-muted-foreground">{selectedStage.detail}</p>
        </div>
      </div>
    </div>
  );
}
