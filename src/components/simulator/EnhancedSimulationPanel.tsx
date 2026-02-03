// 增强的仿真运行面板 - 阶段五功能
import { useEffect, useState, useCallback, useRef } from 'react';
import { useSimulatorStore } from '@/store/simulatorStore';
import { componentDefinitions } from '@/data/componentDefinitions';
import { 
  sensorConfigs, 
  generateSensorFluctuation, 
  simulateFlaskRoute,
  canRunSimulation,
  createDataFlowLog
} from '@/lib/simulationEngine';
import { Button } from '@/components/ui/button';
import { Slider } from '@/components/ui/slider';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Progress } from '@/components/ui/progress';
import { 
  Play, 
  Pause, 
  Square,
  RotateCcw, 
  Gauge, 
  Activity,
  Wifi,
  WifiOff,
  Server,
  ServerOff,
  AlertCircle,
  CheckCircle2,
  Radio,
  Zap,
  ThermometerSun,
  Sun,
  Volume2,
  Eye
} from 'lucide-react';
import { cn } from '@/lib/utils';

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
    addLog,
    clearLogs,
    database,
    updateDatabase,
    codeBurned,
    microbitCode,
  } = useSimulatorStore();

  const [sensorValues, setSensorValues] = useState<Record<string, number>>({});
  const [autoFluctuation, setAutoFluctuation] = useState(true);
  const [networkConnected, setNetworkConnected] = useState(false);
  const simulationRef = useRef<NodeJS.Timeout | null>(null);
  const dataFlowRef = useRef<NodeJS.Timeout | null>(null);

  // 获取画布上的传感器组件
  const sensorComponents = placedComponents.filter((c) => {
    const def = componentDefinitions.find((d) => d.id === c.definitionId);
    return def?.category === 'sensor';
  });

  // 检查系统状态
  const systemCheck = canRunSimulation(placedComponents, connections, codeBurned, serverConfig.running);

  // 初始化传感器值
  useEffect(() => {
    const newValues: Record<string, number> = {};
    sensorComponents.forEach(sensor => {
      if (sensorValues[sensor.instanceId] === undefined) {
        const config = sensorConfigs[sensor.definitionId];
        newValues[sensor.instanceId] = config?.defaultValue ?? 25;
      }
    });
    if (Object.keys(newValues).length > 0) {
      setSensorValues(prev => ({ ...prev, ...newValues }));
    }
  }, [sensorComponents]);

  // 模拟网络连接
  useEffect(() => {
    if (isRunning && codeBurned) {
      // 模拟WiFi连接过程
      addLog({ type: 'info', message: '正在连接WiFi...', source: 'OBLOQ' });
      const timer = setTimeout(() => {
        setNetworkConnected(true);
        addLog({ type: 'info', message: `已连接到 ${routerConfig.ssid}`, source: 'OBLOQ' });
      }, 1000);
      return () => clearTimeout(timer);
    } else {
      setNetworkConnected(false);
    }
  }, [isRunning, codeBurned, routerConfig.ssid]);

  // 主仿真循环
  useEffect(() => {
    if (!isRunning) {
      if (simulationRef.current) clearInterval(simulationRef.current);
      if (dataFlowRef.current) clearInterval(dataFlowRef.current);
      return;
    }

    // 传感器波动
    if (autoFluctuation) {
      simulationRef.current = setInterval(() => {
        setSensorValues(prev => {
          const newValues = { ...prev };
          sensorComponents.forEach(sensor => {
            const currentValue = prev[sensor.instanceId];
            if (currentValue !== undefined) {
              newValues[sensor.instanceId] = generateSensorFluctuation(currentValue, sensor.definitionId);
            }
          });
          return newValues;
        });
      }, 2000 / simulationSpeed);
    }

    // 数据发送循环
    if (codeBurned && serverConfig.running && networkConnected) {
      dataFlowRef.current = setInterval(() => {
        sensorComponents.forEach(sensor => {
          const value = sensorValues[sensor.instanceId];
          const def = componentDefinitions.find(d => d.id === sensor.definitionId);
          
          // 记录传感器读取
          addLog({
            type: 'data',
            message: `读取 ${def?.name}: ${value?.toFixed(1) ?? '?'} ${sensorConfigs[sensor.definitionId]?.unit ?? ''}`,
            source: 'micro:bit',
          });

          // 模拟HTTP请求
          const result = simulateFlaskRoute(
            {
              method: 'POST',
              path: '/upload',
              body: { temperature: value, sensor_id: 1 },
              timestamp: new Date(),
            },
            serverConfig,
            database
          );

          // 记录请求结果
          if (result.response.status === 200) {
            addLog({
              type: 'info',
              message: `POST /upload -> ${result.response.status}`,
              source: 'Flask',
            });

            // 更新数据库
            if (result.updatedDatabase) {
              updateDatabase(result.updatedDatabase);
            }
          } else {
            addLog({
              type: 'error',
              message: `请求失败: ${result.response.status}`,
              source: 'Flask',
            });
          }
        });
      }, 3000 / simulationSpeed);
    }

    return () => {
      if (simulationRef.current) clearInterval(simulationRef.current);
      if (dataFlowRef.current) clearInterval(dataFlowRef.current);
    };
  }, [isRunning, simulationSpeed, autoFluctuation, codeBurned, serverConfig.running, networkConnected, sensorComponents, sensorValues, database]);

  // 传感器值变化处理
  const handleSensorValueChange = useCallback((instanceId: string, value: number) => {
    setSensorValues(prev => ({ ...prev, [instanceId]: value }));
  }, []);

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
                
                return (
                  <div key={sensor.instanceId} className="space-y-1">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-1">
                        <Icon className="h-3 w-3 text-muted-foreground" />
                        <Label className="text-[10px]">{def?.name}</Label>
                      </div>
                      <span className="text-xs font-mono font-medium">
                        {value.toFixed(config.decimals)} {config.unit}
                      </span>
                    </div>
                    <Slider
                      value={[value]}
                      min={config.min}
                      max={config.max}
                      step={config.decimals > 0 ? 0.1 : 1}
                      onValueChange={([v]) => handleSensorValueChange(sensor.instanceId, v)}
                      disabled={!isRunning}
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
        
        {/* 自动波动开关 */}
        <div className="p-2 border-t border-border">
          <div className="flex items-center justify-between">
            <Label className="text-[10px]">自动波动</Label>
            <Switch
              checked={autoFluctuation}
              onCheckedChange={setAutoFluctuation}
              disabled={!isRunning}
            />
          </div>
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
              type="password"
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
            <div className="flex gap-1">
              <Input
                value={serverConfig.ip}
                onChange={(e) => updateServerConfig({ ip: e.target.value })}
                className="h-6 text-[10px] flex-1"
                placeholder="IP"
              />
              <Input
                value={serverConfig.port}
                onChange={(e) => updateServerConfig({ port: parseInt(e.target.value) || 5000 })}
                className="h-6 text-[10px] w-14"
                type="number"
                placeholder="端口"
              />
            </div>
            <Button
              size="sm"
              variant={serverConfig.running ? 'destructive' : 'outline'}
              className="w-full h-6 text-[10px]"
              onClick={() => updateServerConfig({ running: !serverConfig.running })}
            >
              {serverConfig.running ? '停止服务器' : '启动服务器'}
            </Button>
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
                  点击"运行"开始仿真
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
                    <span className="flex-1">{log.message}</span>
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
