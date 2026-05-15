import React, { useCallback, useEffect, useRef, useState } from 'react';
import { AlertTriangle, Globe, Pause, Play, RefreshCw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { useSimulatorStore } from '@/store/simulatorStore';
import { simulateFlaskRoute } from '@/lib/simulationEngine';
import { findFaultyComponent, getComponentFaultMessage } from '@/lib/faultModel';
import { CLASSROOM_TEMPERATURE_THRESHOLD } from '@/data/classroomLesson';
import { getActuatorPinMismatchMessage } from '@/lib/simulationDiagnostics';
import { useShallow } from 'zustand/react/shallow';

export const BrowserSimulator: React.FC = () => {
  const {
    serverConfig,
    database,
    isRunning,
    placedComponents,
    connections,
    microbitCode,
    browserUrl,
    browserResponse,
    browserPageRecords,
    browserLastUpdate,
    browserAutoRefresh,
    addLog,
    setBrowserUrl,
    setBrowserResponse,
    setBrowserPageRecords,
    setBrowserLastUpdate,
    setBrowserAutoRefresh,
  } = useSimulatorStore(
    useShallow((state) => ({
      serverConfig: state.serverConfig,
      database: state.database,
      isRunning: state.isRunning,
      placedComponents: state.placedComponents,
      connections: state.connections,
      microbitCode: state.microbitCode,
      browserUrl: state.browserUrl,
      browserResponse: state.browserResponse,
      browserPageRecords: state.browserPageRecords,
      browserLastUpdate: state.browserLastUpdate,
      browserAutoRefresh: state.browserAutoRefresh,
      addLog: state.addLog,
      setBrowserUrl: state.setBrowserUrl,
      setBrowserResponse: state.setBrowserResponse,
      setBrowserPageRecords: state.setBrowserPageRecords,
      setBrowserLastUpdate: state.setBrowserLastUpdate,
      setBrowserAutoRefresh: state.setBrowserAutoRefresh,
    }))
  );

  const [loading, setLoading] = useState(false);
  const refreshInterval = 2000;
  const lastGetLogRef = useRef<number>(0);
  const browserFault = findFaultyComponent(placedComponents, ['browser', 'mobile-client']);
  const serverFault = findFaultyComponent(placedComponents, ['web-server']);
  const databaseFault = findFaultyComponent(placedComponents, ['database']);
  const actuatorFault = findFaultyComponent(placedComponents, ['buzzer', 'led-strip', 'servo', 'relay']);
  const primaryActuator = placedComponents.find((component) =>
    ['buzzer', 'led-strip', 'servo', 'relay'].includes(component.definitionId)
  );
  const actuatorMismatchMessage = primaryActuator
    ? getActuatorPinMismatchMessage(primaryActuator, placedComponents, connections, microbitCode)
    : null;

  const markUpdated = useCallback(() => {
    setBrowserLastUpdate(Date.now());
  }, [setBrowserLastUpdate]);

  const handleRequest = useCallback(() => {
    setLoading(true);

    try {
      const requestUrl = browserUrl.trim();
      if (!requestUrl) {
        setBrowserPageRecords(null);
        setBrowserResponse('请先在地址栏填写完整 URL。');
        markUpdated();
        return;
      }

      if (browserFault) {
        setBrowserPageRecords(null);
        setBrowserResponse(getComponentFaultMessage(browserFault, '浏览器故障，无法完成页面查询'));
        markUpdated();
        return;
      }

      const urlObj = new URL(requestUrl);
      const path = urlObj.pathname + urlObj.search;
      const expectedHost = `${serverConfig.ip}:${serverConfig.port}`;

      if (urlObj.host !== expectedHost || path !== '/') {
        setBrowserPageRecords(null);
        setBrowserResponse('访问地址不正确。请根据 Flask 服务代码和服务器配置重新填写。');
        markUpdated();
        return;
      }

      const now = Date.now();
      if (now - lastGetLogRef.current > 5000) {
        lastGetLogRef.current = now;
        addLog({
          type: 'info',
          message: `发送请求: GET ${requestUrl}`,
          source: '浏览器',
        });
      }

      if (!serverConfig.running || serverFault) {
        setBrowserPageRecords(null);
        setBrowserResponse(getComponentFaultMessage(serverFault, '错误：Flask 服务器未运行，浏览器无法获取实时数据'));
        markUpdated();
        return;
      }

      if (databaseFault && path === '/') {
        setBrowserPageRecords(null);
        setBrowserResponse(getComponentFaultMessage(databaseFault, '错误：SQLite 数据库故障，无法读取 sensorlog 表'));
        markUpdated();
        return;
      }

      const result = simulateFlaskRoute(
        { method: 'GET', path, body: {}, timestamp: new Date() },
        serverConfig,
        database
      );

      if (result.response.status === 200) {
        const body = result.response.body as {
          template?: string;
          render?: string;
          records?: Array<{
            id: number;
            sensor_id: number;
            value: number;
            alarm?: number;
            timestamp: string;
          }>;
        };
        const records = Array.isArray(body.records) ? body.records : [];
        setBrowserPageRecords(records);
        setBrowserResponse(`GET / 成功：Flask 使用 ${body.render || 'render_template'} 渲染 ${body.template || 'index.html'}，本次查询到 ${records.length} 条记录。`);
        addLog({
          type: 'info',
          message: `响应: 200 OK - GET / 已通过 render_template 展示 ${records.length} 条 sensorlog 记录`,
          source: '浏览器',
        });
      } else {
        setBrowserPageRecords(null);
        setBrowserResponse(`错误 ${result.response.status}: ${JSON.stringify(result.response.body)}`);
      }
      markUpdated();
    } catch {
      setBrowserPageRecords(null);
      setBrowserResponse('无效的 URL 格式。');
      markUpdated();
    } finally {
      setLoading(false);
    }
  }, [
    addLog,
    browserFault,
    browserUrl,
    database,
    databaseFault,
    markUpdated,
    serverConfig,
    serverFault,
    setBrowserPageRecords,
    setBrowserResponse,
  ]);

  useEffect(() => {
    if (!browserAutoRefresh || !isRunning || !browserUrl.trim()) {
      return undefined;
    }

    const timer = window.setInterval(() => {
      handleRequest();
    }, refreshInterval);

    return () => window.clearInterval(timer);
  }, [browserAutoRefresh, browserUrl, handleRequest, isRunning]);

  const sensorLogs = browserPageRecords ?? [];
  const recentLogs = sensorLogs.slice(0, 5);
  const latestRecord = sensorLogs[0];
  const latestTemperature = latestRecord?.value;
  const lastUpdateLabel = browserLastUpdate ? new Date(browserLastUpdate).toLocaleTimeString() : '未查询';
  const isOverheated =
    !browserFault &&
    typeof latestTemperature === 'number' &&
    latestTemperature > CLASSROOM_TEMPERATURE_THRESHOLD;
  const actuatorBlocked = Boolean(isOverheated && (actuatorFault || actuatorMismatchMessage));
  const statusText = browserFault
    ? '浏览器故障'
    : browserAutoRefresh && isRunning
      ? '自动刷新中'
      : '已暂停';

  return (
    <div className="flex h-full flex-col overflow-hidden rounded-lg border bg-background">
      <div className="flex shrink-0 items-center justify-between border-b bg-muted px-3 py-2">
        <div className="flex items-center gap-2">
          <div className="flex gap-1.5">
            <div className="h-3 w-3 rounded-full bg-destructive" />
            <div className="h-3 w-3 rounded-full bg-primary/60" />
            <div className="h-3 w-3 rounded-full bg-primary" />
          </div>
          <span className="ml-2 text-xs text-muted-foreground">模拟浏览器</span>
        </div>

        <div className="flex items-center gap-2">
          <Badge variant={browserFault ? 'destructive' : browserAutoRefresh && isRunning ? 'default' : 'secondary'} className="text-xs">
            {statusText}
          </Badge>
          <Button
            size="sm"
            variant="ghost"
            onClick={() => setBrowserAutoRefresh(!browserAutoRefresh)}
            className="h-6 w-6 p-0"
            aria-label={browserAutoRefresh ? '暂停自动刷新' : '开启自动刷新'}
          >
            {browserAutoRefresh ? <Pause className="h-3 w-3" /> : <Play className="h-3 w-3" />}
          </Button>
        </div>
      </div>

      <div className="flex shrink-0 items-center gap-2 border-b bg-muted/50 px-3 py-2">
        <Globe className="h-4 w-4 text-muted-foreground" />
        <Input
          value={browserUrl}
          onChange={(event) => setBrowserUrl(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === 'Enter') {
              event.preventDefault();
              handleRequest();
            }
          }}
          className="h-7 flex-1 text-xs"
          placeholder=""
        />
        <Button
          size="sm"
          variant="ghost"
          onClick={handleRequest}
          disabled={loading}
          className="h-7 px-2"
          aria-label="刷新模拟浏览器"
        >
          <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
        </Button>
      </div>

      <div className="flex min-h-0 flex-1 flex-col gap-3 overflow-hidden p-3">
        <div className="flex shrink-0 items-center justify-between gap-3">
          <div>
            <h1 className="text-base font-bold leading-tight">存储间温度监测</h1>
            <p className="text-xs text-muted-foreground">上次更新：{lastUpdateLabel}</p>
          </div>
          <Badge variant={isOverheated ? 'destructive' : 'secondary'} className="shrink-0">
            {browserFault ? '无法查询' : latestRecord ? (isOverheated ? '温度超限' : '温度正常') : '暂无数据'}
          </Badge>
        </div>

        {isOverheated && (
          <Alert variant={actuatorBlocked ? 'default' : 'destructive'} className={actuatorBlocked ? 'shrink-0' : 'shrink-0 animate-pulse'}>
            <AlertTriangle className="h-4 w-4" />
            <AlertTitle>{actuatorBlocked ? '温度已超阈值，但执行器未响应' : '蜂鸣器报警中'}</AlertTitle>
            <AlertDescription className="text-xs">
              {actuatorBlocked
                ? actuatorFault
                  ? getComponentFaultMessage(actuatorFault, '执行器故障，无法响应服务器指令')
                  : actuatorMismatchMessage
                : `当前温度 ${latestTemperature?.toFixed(1)}°C 超过阈值 ${CLASSROOM_TEMPERATURE_THRESHOLD}°C，蜂鸣器已触发报警。`}
            </AlertDescription>
          </Alert>
        )}

        <div className="grid min-h-0 flex-1 gap-3 lg:grid-cols-[220px_minmax(0,1fr)]">
          <div className={`flex min-h-[126px] flex-col justify-center rounded-lg border p-3 text-center ${isOverheated ? 'border-destructive bg-destructive/10' : 'bg-muted/60'}`}>
            <div className="text-xs text-muted-foreground">当前温度</div>
            <div className={`text-3xl font-bold ${isOverheated ? 'text-destructive' : 'text-primary'}`}>
              {browserFault ? '故障' : latestRecord ? `${latestRecord.value.toFixed(1)}°C` : '--'}
            </div>
            <div className="mt-1 text-xs text-muted-foreground">
              {latestRecord ? `记录于 ${latestRecord.timestamp}` : '运行后输入地址并回车查询'}
            </div>
            <div className="mt-1 text-xs text-muted-foreground">
              本次查询 {sensorLogs.length} 条记录
            </div>
          </div>

          <div className="flex min-h-0 flex-col overflow-hidden rounded-lg border">
            <div className="flex shrink-0 items-center justify-between bg-muted px-3 py-2">
              <h2 className="text-sm font-semibold">最近记录</h2>
              <span className="text-xs text-muted-foreground">
                显示 {recentLogs.length}/{sensorLogs.length}
              </span>
            </div>
            <div className="min-h-0 flex-1 overflow-auto">
              <table className="w-full text-xs">
                <thead className="sticky top-0 bg-muted/95">
                  <tr>
                    <th className="px-2 py-1 text-left">ID</th>
                    <th className="px-2 py-1 text-left">温度</th>
                    <th className="px-2 py-1 text-left">报警</th>
                    <th className="px-2 py-1 text-left">时间</th>
                  </tr>
                </thead>
                <tbody>
                  {recentLogs.map((log) => (
                    <tr key={log.id} className="border-t">
                      <td className="px-2 py-1">{log.id}</td>
                      <td className="px-2 py-1">{log.value.toFixed(1)}°C</td>
                      <td className="px-2 py-1">{log.alarm ? '是' : '否'}</td>
                      <td className="px-2 py-1 text-muted-foreground">{log.timestamp}</td>
                    </tr>
                  ))}
                  {recentLogs.length === 0 && (
                    <tr>
                      <td colSpan={4} className="px-2 py-5 text-center text-muted-foreground">
                        暂无查询结果
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>

        {browserResponse && (
          <div className="shrink-0 rounded-md border bg-muted/60 px-3 py-2 text-xs text-muted-foreground">
            <span className="font-semibold text-foreground">页面响应：</span>
            {browserResponse}
          </div>
        )}
      </div>
    </div>
  );
};
