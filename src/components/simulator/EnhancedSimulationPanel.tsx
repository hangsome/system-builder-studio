// 增强的仿真运行面板 - 阶段五功能
import { useEffect, useState, useCallback, useMemo } from 'react';
import { useSimulatorStore } from '@/store/simulatorStore';
import { componentDefinitions } from '@/data/componentDefinitions';
import { 
  sensorConfigs, 
  canRunSimulation
} from '@/lib/simulationEngine';
import { validateSystem } from '@/lib/connectionValidator';
import { Button } from '@/components/ui/button';
import { Slider } from '@/components/ui/slider';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  Play,
  Square,
  RotateCcw,
  Gauge,
  Wifi,
  WifiOff,
  Server,
  ServerOff,
  AlertCircle,
  CheckCircle2,
  Radio,
  ThermometerSun,
  Sun,
  Volume2,
  Eye,
  Flame
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { findFaultyComponent, getComponentFaultMessage } from '@/lib/faultModel';
import { useShallow } from 'zustand/react/shallow';
import { DataTransferTrace } from './DataTransferTrace';

const HTTP_METHOD_BADGE: Record<string, string> = {
  POST: 'bg-emerald-500/15 text-emerald-700 ring-1 ring-emerald-500/30 dark:bg-emerald-400/15 dark:text-emerald-300',
  GET: 'bg-sky-500/15 text-sky-700 ring-1 ring-sky-500/30 dark:bg-sky-400/15 dark:text-sky-300',
  PUT: 'bg-amber-500/15 text-amber-700 ring-1 ring-amber-500/30 dark:bg-amber-400/15 dark:text-amber-300',
  DELETE: 'bg-rose-500/15 text-rose-700 ring-1 ring-rose-500/30 dark:bg-rose-400/15 dark:text-rose-300',
};
const METHOD_REGEX = /\b(GET|POST|PUT|DELETE)\b/g;
const BODY_REGEX = /body=(\{[^}]*\})/;

function renderLogMessage(message: string) {
  const segments: Array<string | { method: string }> = [];
  let lastIndex = 0;
  let match: RegExpExecArray | null;
  METHOD_REGEX.lastIndex = 0;
  while ((match = METHOD_REGEX.exec(message)) !== null) {
    if (match.index > lastIndex) {
      segments.push(message.slice(lastIndex, match.index));
    }
    segments.push({ method: match[0] });
    lastIndex = match.index + match[0].length;
  }
  if (lastIndex < message.length) {
    segments.push(message.slice(lastIndex));
  }

  return segments.map((segment, index) => {
    if (typeof segment === 'string') {
      const bodyMatch = BODY_REGEX.exec(segment);
      if (!bodyMatch) return <span key={index}>{segment}</span>;
      const before = segment.slice(0, bodyMatch.index);
      const after = segment.slice(bodyMatch.index + bodyMatch[0].length);
      return (
        <span key={index}>
          {before}body=
          <span className="rounded bg-slate-500/10 px-1 py-px font-mono ring-1 ring-slate-500/20 dark:bg-slate-400/10 dark:ring-slate-400/30">
            {bodyMatch[1]}
          </span>
          {after}
        </span>
      );
    }
    return (
      <span
        key={index}
        className={cn(
          'mx-0.5 inline-flex items-center rounded px-1 py-px text-[10px] font-semibold uppercase tracking-wide',
          HTTP_METHOD_BADGE[segment.method] ?? 'bg-muted text-muted-foreground'
        )}
      >
        {segment.method}
      </span>
    );
  });
}

export function EnhancedSimulationPanel() {
  const {
    isRunning,
    setRunning,
    simulationSpeed,
    setSimulationSpeed,
    placedComponents,
    connections,
    routerConfig,
    serverConfig,
    updateRouterConfig,
    updateServerConfig,
    logs,
    database,
    addLog,
    clearLogs,
    codeBurned,
    sensorValues,
    setSensorValue,
    autoFluctuation,
    setAutoFluctuation,
    demoSweepActive,
    setDemoSweepActive,
    detailsVisible,
  } = useSimulatorStore(
    useShallow((state) => ({
      isRunning: state.isRunning,
      setRunning: state.setRunning,
      simulationSpeed: state.simulationSpeed,
      setSimulationSpeed: state.setSimulationSpeed,
      placedComponents: state.placedComponents,
      connections: state.connections,
      routerConfig: state.routerConfig,
      serverConfig: state.serverConfig,
      updateRouterConfig: state.updateRouterConfig,
      updateServerConfig: state.updateServerConfig,
      logs: state.logs,
      database: state.database,
      addLog: state.addLog,
      clearLogs: state.clearLogs,
      codeBurned: state.codeBurned,
      sensorValues: state.sensorValues,
      setSensorValue: state.setSensorValue,
      autoFluctuation: state.autoFluctuation,
      setAutoFluctuation: state.setAutoFluctuation,
      demoSweepActive: state.demoSweepActive,
      setDemoSweepActive: state.setDemoSweepActive,
      detailsVisible: state.detailsVisible,
    }))
  );

  const [networkConnected, setNetworkConnected] = useState(false);
  const [showDataTrace, setShowDataTrace] = useState(false);
  // 仿真循环现在由 useSimulationRunner 在后台处理

  // 获取画布上的传感器组件
  const sensorComponents = useMemo(() => {
    return placedComponents.filter((c) => {
      const def = componentDefinitions.find((d) => d.id === c.definitionId);
      return def?.category === 'sensor';
    });
  }, [placedComponents]);

  // 获取电源状态
  const { powerStatus, obloqPowered, obloqConnected } = useMemo(() => {
    const validation = validateSystem(placedComponents, connections);
    
    // 检查IOT模块是否有电源
    const iotModule = placedComponents.find(
      c => c.definitionId === 'iot-module' || c.definitionId === 'obloq'
    );
    const iotHasPower = iotModule ? validation.powerStatus.get(iotModule.instanceId) : false;
    
    // 检查 IOT 模块与扩展板之间的通信连接
    const hasMatchedSerialConnection = (iotPin: 'tx' | 'rx', expansionPin: 'p15' | 'p16') =>
      iotModule
        ? connections.some((connection) => {
            const iotOnFromSide =
              connection.fromComponent === iotModule.instanceId && connection.fromPin === iotPin;
            const iotOnToSide =
              connection.toComponent === iotModule.instanceId && connection.toPin === iotPin;

            if (!iotOnFromSide && !iotOnToSide) {
              return false;
            }

            const otherComponentId = iotOnFromSide ? connection.toComponent : connection.fromComponent;
            const otherPinId = iotOnFromSide ? connection.toPin : connection.fromPin;
            const otherComponent = placedComponents.find((component) => component.instanceId === otherComponentId);

            return otherComponent?.definitionId === 'expansion-board' && otherPinId === expansionPin;
          })
        : false;

    const iotHasSerial =
      hasMatchedSerialConnection('tx', 'p15') &&
      hasMatchedSerialConnection('rx', 'p16');
    
    return {
      powerStatus: validation.powerStatus,
      obloqPowered: iotHasPower,
      obloqConnected: iotHasPower && iotHasSerial,
    };
  }, [placedComponents, connections]);

  const faultSummary = useMemo(() => {
    const sensor = sensorComponents.find((component) => component.state?.fault);
    const microbit = findFaultyComponent(placedComponents, ['microbit']);
    const iot = findFaultyComponent(placedComponents, ['iot-module', 'obloq']);
    const router = findFaultyComponent(placedComponents, ['router']);
    const server = findFaultyComponent(placedComponents, ['web-server']);
    const databaseFault = findFaultyComponent(placedComponents, ['database']);
    const browser = findFaultyComponent(placedComponents, ['browser', 'mobile-client']);

    return { sensor, microbit, iot, router, server, database: databaseFault, browser };
  }, [placedComponents, sensorComponents]);

  const traceFaults = useMemo(() => ({
    sensor: faultSummary.sensor
      ? getComponentFaultMessage(faultSummary.sensor, '传感器故障，采集端没有有效数据')
      : undefined,
    microbit: faultSummary.microbit
      ? getComponentFaultMessage(faultSummary.microbit, 'micro:bit 故障，程序无法上传数据')
      : undefined,
    network: faultSummary.iot || faultSummary.router
      ? getComponentFaultMessage(faultSummary.iot || faultSummary.router, '网络链路故障，HTTP 请求无法到达服务器')
      : undefined,
    server: faultSummary.server
      ? getComponentFaultMessage(faultSummary.server, 'Flask 服务故障，无法接收请求')
      : undefined,
    database: faultSummary.database
      ? getComponentFaultMessage(faultSummary.database, 'SQLite 数据库故障，无法保存数据')
      : undefined,
    browser: faultSummary.browser
      ? getComponentFaultMessage(faultSummary.browser, '浏览器故障，无法展示查询结果')
      : undefined,
  }), [faultSummary]);

  const traceSensors = useMemo(() => {
    return sensorComponents.map((sensor) => {
      const def = componentDefinitions.find((d) => d.id === sensor.definitionId);
      const config = sensorConfigs[sensor.definitionId];

      return {
        id: sensor.instanceId,
        name: def?.name ?? sensor.definitionId,
        value: sensorValues[sensor.instanceId],
        unit: config?.unit,
        powered: (powerStatus.get(sensor.instanceId) ?? false) && !sensor.state?.fault,
      };
    });
  }, [sensorComponents, sensorValues, powerStatus]);

  const databaseRecordCount = database.records['sensorlog']?.length ?? 0;

  // 检查系统状态
  const systemCheck = canRunSimulation(placedComponents, connections, codeBurned, serverConfig.running);

  // 初始化传感器值
  useEffect(() => {
    sensorComponents.forEach((sensor) => {
      if (sensorValues[sensor.instanceId] === undefined) {
        const config = sensorConfigs[sensor.definitionId];
        setSensorValue(sensor.instanceId, config?.defaultValue ?? 25);
      }
    });
  }, [sensorComponents, sensorValues, setSensorValue]);

  // 模拟网络连接 - 需要 IOT 模块有电源和通信连接
  useEffect(() => {
    const networkFault = faultSummary.iot || faultSummary.router;

    if (isRunning && codeBurned && networkFault) {
      addLog({
        type: 'warning',
        message: getComponentFaultMessage(networkFault, '网络链路故障，HTTP 请求无法到达 Flask 服务器'),
        source: 'System',
      });
      setNetworkConnected(false);
    } else if (isRunning && codeBurned && obloqConnected) {
      // 模拟WiFi连接过程
      addLog({ type: 'info', message: '正在连接WiFi...', source: 'IOT模块' });
      const timer = setTimeout(() => {
        setNetworkConnected(true);
        addLog({ type: 'info', message: `已连接到 ${routerConfig.ssid}`, source: 'IOT模块' });
        addLog({ type: 'info', message: `IP地址: 192.168.1.${Math.floor(Math.random() * 100) + 100}`, source: 'IOT模块' });
      }, 1500);
      return () => clearTimeout(timer);
    } else if (isRunning && codeBurned && !obloqConnected) {
      if (!obloqPowered) {
        addLog({ type: 'warning', message: 'IOT模块未供电，无法连接WiFi', source: 'System' });
      } else {
        addLog({ type: 'warning', message: 'IOT模块与扩展板的通信连接未建立，无法进入无线链路', source: 'System' });
      }
      setNetworkConnected(false);
    } else {
      setNetworkConnected(false);
    }
  }, [isRunning, codeBurned, obloqConnected, obloqPowered, routerConfig.ssid, faultSummary.iot, faultSummary.router, addLog]);

  // 仿真循环现在由 useSimulationRunner hook 在 SimulatorLayout 中统一处理

  // 传感器值变化处理
  const handleSensorValueChange = useCallback((instanceId: string, value: number) => {
    setSensorValue(instanceId, value);
  }, [setSensorValue]);

  // 获取传感器图标
  const getSensorIcon = (type: string) => {
    switch (type) {
      case 'temp-humidity-sensor': return ThermometerSun;
      case 'light-sensor': return Sun;
      case 'sound-sensor': return Volume2;
      case 'infrared-sensor': return Eye;
      default: return Gauge;
    }
  };

  // 开始/停止仿真
  const toggleSimulation = () => {
    if (isRunning) {
      setRunning(false);
      addLog({ type: 'info', message: '仿真已停止', source: 'System' });
    } else {
      if (!systemCheck.canRun) {
        systemCheck.issues.forEach(issue => {
          addLog({ type: 'warning', message: issue, source: 'System' });
        });
        return;
      }
      clearLogs();
      setRunning(true);
      addLog({ type: 'info', message: '仿真开始运行', source: 'System' });
    }
  };

  return (
    <div className="h-full flex">
      {/* 传感器控制面板 */}
      <div className="w-56 border-r border-border flex flex-col">
        <div className="p-2 border-b border-border">
          <h4 className="text-xs font-medium flex items-center gap-2">
            <Gauge className="h-3 w-3" />
            传感器模拟
          </h4>
        </div>
        
        <ScrollArea className="flex-1 p-2">
          {sensorComponents.length === 0 ? (
            <p className="text-[10px] text-muted-foreground text-center py-4">
              请先添加传感器组件到画布
            </p>
          ) : (
            <div className="space-y-3">
              {sensorComponents.map((sensor) => {
                const def = componentDefinitions.find((d) => d.id === sensor.definitionId);
                const config = sensorConfigs[sensor.definitionId] || {
                  min: 0, max: 100, unit: '', defaultValue: 50, decimals: 0
                };
                const value = sensorValues[sensor.instanceId] ?? config.defaultValue;
                const Icon = getSensorIcon(sensor.definitionId);
                const isPowered = powerStatus.get(sensor.instanceId);
                
                return (
                  <div key={sensor.instanceId} className={cn(
                    "space-y-1 p-2 rounded border",
                    isPowered 
                      ? "border-border bg-background" 
                      : "border-destructive/50 bg-destructive/10"
                  )}>
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-1">
                        <Icon className={cn(
                          "h-3 w-3",
                          isPowered ? "text-muted-foreground" : "text-destructive"
                        )} />
                        <Label className="text-[10px]">{def?.name}</Label>
                      </div>
                      {isPowered ? (
                        <span className="text-xs font-mono font-medium">
                          {value.toFixed(config.decimals)} {config.unit}
                        </span>
                      ) : (
                        <span className="text-[10px] text-destructive font-medium">
                          未供电
                        </span>
                      )}
                    </div>
                    <Slider
                      value={[value]}
                      min={config.min}
                      max={config.max}
                      step={config.decimals > 0 ? 0.1 : 1}
                      onValueChange={([v]) => handleSensorValueChange(sensor.instanceId, v)}
                      disabled={!isRunning || !isPowered}
                      className="h-4"
                    />
                    <div className="flex justify-between text-[9px] text-muted-foreground">
                      <span>{config.min}{config.unit}</span>
                      <span>{config.max}{config.unit}</span>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </ScrollArea>
        
        {/* 自动波动 + 演示扫描 */}
        <div className="p-2 border-t border-border space-y-2">
          <div className="flex items-center justify-between">
            <Label className="text-[10px]">自动波动</Label>
            <Switch
              checked={autoFluctuation && !demoSweepActive}
              onCheckedChange={(checked) => {
                setAutoFluctuation(checked);
                if (checked) setDemoSweepActive(false);
              }}
              disabled={!isRunning}
            />
          </div>
          <Button
            size="sm"
            variant={demoSweepActive ? 'default' : 'outline'}
            className="h-7 w-full text-[10px] gap-1"
            onClick={() => setDemoSweepActive(!demoSweepActive)}
            disabled={!isRunning}
            title="让温度在 25°C↔32°C 之间正弦扫描，方便演示阈值触发与回落"
          >
            <Flame className="h-3 w-3" />
            {demoSweepActive ? '停止演示扫描' : '演示扫描（25 ↔ 33°C）'}
          </Button>
        </div>
      </div>

      {/* 网络配置面板 */}
      <div className="w-48 border-r border-border flex flex-col">
        <div className="p-2 border-b border-border">
          <h4 className="text-xs font-medium flex items-center gap-2">
            <Wifi className="h-3 w-3" />
            网络配置
          </h4>
        </div>
        
        <div className="p-2 space-y-3">
          {/* 路由器配置 */}
          <div className="space-y-2">
            <div className="flex items-center gap-1">
              {networkConnected ? (
                <Wifi className="h-3 w-3 text-green-500" />
              ) : (
                <WifiOff className="h-3 w-3 text-muted-foreground" />
              )}
              <Label className="text-[10px]">路由器</Label>
            </div>
            <Input
              value={routerConfig.ssid}
              onChange={(e) => updateRouterConfig({ ssid: e.target.value })}
              className="h-6 text-[10px]"
              placeholder="SSID"
            />
            <Input
              value={routerConfig.password}
              onChange={(e) => updateRouterConfig({ password: e.target.value })}
              className="h-6 text-[10px]"
              type="text"
              placeholder="密码"
            />
          </div>

          {/* 服务器配置 */}
          <div className="space-y-2 pt-2 border-t border-border">
            <div className="flex items-center gap-1">
              {serverConfig.running ? (
                <Server className="h-3 w-3 text-green-500" />
              ) : (
                <ServerOff className="h-3 w-3 text-muted-foreground" />
              )}
              <Label className="text-[10px]">Flask服务器</Label>
            </div>
            <div className="grid grid-cols-[minmax(0,1fr)_4.25rem] gap-1">
              <Input
                value={serverConfig.ip}
                onChange={(e) => updateServerConfig({ ip: e.target.value })}
                className="h-7 min-w-0 text-[11px] font-mono"
                placeholder="IP"
              />
              <Input
                value={serverConfig.port}
                onChange={(e) => updateServerConfig({ port: parseInt(e.target.value) || 5000 })}
                className="h-7 min-w-0 text-center text-[11px] font-mono"
                type="number"
                placeholder="端口"
              />
            </div>
            {detailsVisible && (
              <Button
                size="sm"
                variant={serverConfig.running ? 'destructive' : 'outline'}
                className="w-full h-6 text-[10px]"
                onClick={() => updateServerConfig({ running: !serverConfig.running })}
              >
                {serverConfig.running ? '停止服务器' : '启动服务器'}
              </Button>
            )}
          </div>
        </div>
      </div>

      {/* 状态监控和日志 */}
      <div className="flex-1 flex flex-col">
        {/* 控制栏 */}
        <div className="p-2 border-b border-border flex items-center gap-4">
          <Button
            size="sm"
            onClick={toggleSimulation}
            variant={isRunning ? 'destructive' : 'default'}
            className="h-7 px-4"
          >
            {isRunning ? (
              <>
                <Square className="h-3 w-3 mr-1" />
                停止
              </>
            ) : (
              <>
                <Play className="h-3 w-3 mr-1" />
                运行
              </>
            )}
          </Button>

          <div className="flex items-center gap-2">
            <Label className="text-[10px]">速度</Label>
            <Slider
              value={[simulationSpeed]}
              min={0.5}
              max={3}
              step={0.5}
              onValueChange={([v]) => setSimulationSpeed(v)}
              className="w-20"
            />
            <span className="text-[10px] w-6">{simulationSpeed}x</span>
          </div>

          <div className="flex items-center gap-2 rounded-md border border-border bg-background px-2 py-1">
            <Radio className="h-3 w-3 text-blue-600" />
            <Label className="text-[10px]" htmlFor="enhanced-data-trace-switch">数据链路</Label>
            <Switch
              id="enhanced-data-trace-switch"
              checked={showDataTrace}
              onCheckedChange={setShowDataTrace}
              aria-label="显示数据传输链路"
            />
          </div>

          <div className="flex-1" />

          {/* 系统状态指示器 */}
          <div className="flex items-center gap-2">
            {systemCheck.canRun ? (
              <Badge variant="outline" className="text-[10px] bg-green-50 text-green-700 border-green-200 dark:bg-green-950/30 dark:text-green-400">
                <CheckCircle2 className="h-3 w-3 mr-1" />
                就绪
              </Badge>
            ) : (
              <Badge variant="outline" className="text-[10px] bg-red-50 text-red-700 border-red-200 dark:bg-red-950/30 dark:text-red-400">
                <AlertCircle className="h-3 w-3 mr-1" />
                {systemCheck.issues.length}项问题
              </Badge>
            )}
            
            {isRunning && (
              <Badge variant="outline" className="text-[10px] bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-950/30 dark:text-blue-400 animate-pulse">
                <Radio className="h-3 w-3 mr-1" />
                运行中
              </Badge>
            )}
          </div>
        </div>

        {/* 系统问题列表 */}
        {!systemCheck.canRun && (
          <div className="px-2 py-1 bg-red-50 dark:bg-red-950/20 border-b border-red-200 dark:border-red-900">
            <div className="flex flex-wrap gap-1">
              {systemCheck.issues.map((issue, i) => (
                <span key={i} className="text-[10px] text-red-700 dark:text-red-400">
                  • {issue}
                </span>
              ))}
            </div>
          </div>
        )}

        {/* 日志区域 */}
        <div className="flex-1 flex flex-col min-h-0">
          {showDataTrace && (
            <DataTransferTrace
              isRunning={isRunning}
              codeBurned={codeBurned}
              sensors={traceSensors}
              serialConnected={obloqConnected}
              networkConnected={networkConnected && !faultSummary.iot && !faultSummary.router}
              routerSsid={routerConfig.ssid}
              serverRunning={serverConfig.running && !faultSummary.server}
              serverAddress={`${serverConfig.ip}:${serverConfig.port}`}
              databaseRecordCount={databaseRecordCount}
              logs={logs}
              faults={traceFaults}
            />
          )}

          <div className="flex items-center justify-between px-2 py-1 border-b border-border">
            <span className="text-[10px] font-medium">通信日志</span>
            <Button size="sm" variant="ghost" className="h-5 text-[10px]" onClick={clearLogs}>
              <RotateCcw className="h-3 w-3 mr-1" />
              清除
            </Button>
          </div>
          
          <ScrollArea className="flex-1">
            <div className="p-2 space-y-0.5">
              {logs.length === 0 ? (
                <p className="text-[10px] text-muted-foreground text-center py-4">
                  点击&quot;运行&quot;开始仿真
                </p>
              ) : (
                logs.slice().reverse().map((log, i) => (
                  <div
                    key={i}
                    className={cn(
                      'text-[10px] font-mono px-2 py-1 rounded flex items-start gap-2',
                      log.type === 'error' && 'bg-red-50 text-red-700 dark:bg-red-950/30 dark:text-red-400',
                      log.type === 'warning' && 'bg-yellow-50 text-yellow-700 dark:bg-yellow-950/30 dark:text-yellow-400',
                      log.type === 'data' && 'bg-blue-50 text-blue-700 dark:bg-blue-950/30 dark:text-blue-400',
                      log.type === 'info' && 'bg-muted text-muted-foreground'
                    )}
                  >
                    <span className="opacity-50 flex-shrink-0">
                      {new Date(log.timestamp).toLocaleTimeString('zh-CN', { hour12: false })}
                    </span>
                    <span className="font-medium flex-shrink-0">[{log.source}]</span>
                    <span className="flex-1 break-words">{renderLogMessage(log.message)}</span>
                  </div>
                ))
              )}
            </div>
          </ScrollArea>
        </div>
      </div>
    </div>
  );
}
