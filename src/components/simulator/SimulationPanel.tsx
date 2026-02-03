import { useEffect, useState } from 'react';
import { useSimulatorStore } from '@/store/simulatorStore';
import { componentDefinitions } from '@/data/componentDefinitions';
import { Button } from '@/components/ui/button';
import { Slider } from '@/components/ui/slider';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { 
  Play, 
  Pause, 
  RotateCcw, 
  Gauge, 
  Activity,
  Wifi,
  Server,
  AlertCircle,
  CheckCircle2
} from 'lucide-react';

export function SimulationPanel() {
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
  } = useSimulatorStore();

  const [sensorValues, setSensorValues] = useState<Record<string, number>>({});

  // 获取画布上的传感器组件
  const sensorComponents = placedComponents.filter((c) => {
    const def = componentDefinitions.find((d) => d.id === c.definitionId);
    return def?.category === 'sensor';
  });

  // 模拟运行效果
  useEffect(() => {
    if (!isRunning) return;

    const interval = setInterval(() => {
      // 模拟传感器数据发送到服务器
      if (codeBurned && serverConfig.running) {
        sensorComponents.forEach((sensor) => {
          const value = sensorValues[sensor.instanceId] || Math.random() * 30 + 15;
          
          // 添加日志
          addLog({
            type: 'data',
            message: `传感器数据: ${value.toFixed(1)}`,
            source: sensor.definitionId,
          });

          // 更新数据库
          const newRecord = {
            id: (database.records['sensorlog']?.length || 0) + 1,
            sensor_id: 1,
            value: value,
            timestamp: new Date().toISOString(),
          };
          
          updateDatabase({
            ...database,
            records: {
              ...database.records,
              sensorlog: [...(database.records['sensorlog'] || []), newRecord].slice(-50),
            },
          });
        });
      }
    }, 3000 / simulationSpeed);

    return () => clearInterval(interval);
  }, [isRunning, codeBurned, serverConfig.running, sensorComponents, sensorValues, simulationSpeed]);

  // 检查系统状态
  const checkSystemStatus = () => {
    const issues: string[] = [];
    
    // 检查是否有 micro:bit
    const hasMicrobit = placedComponents.some((c) => c.definitionId === 'microbit');
    if (!hasMicrobit) issues.push('缺少 micro:bit');
    
    // 检查代码是否烧录
    if (!codeBurned) issues.push('代码未烧录');
    
    // 检查服务器是否运行
    if (!serverConfig.running) issues.push('服务器未启动');
    
    return issues;
  };

  const systemIssues = checkSystemStatus();

  const handleSensorValueChange = (instanceId: string, value: number) => {
    setSensorValues((prev) => ({ ...prev, [instanceId]: value }));
  };

  return (
    <div className="h-full flex">
      {/* 传感器控制 */}
      <div className="w-64 border-r border-border p-3 overflow-y-auto">
        <h4 className="text-sm font-medium mb-3 flex items-center gap-2">
          <Gauge className="h-4 w-4" />
          传感器模拟
        </h4>
        
        {sensorComponents.length === 0 ? (
          <p className="text-xs text-muted-foreground">请先添加传感器组件</p>
        ) : (
          <div className="space-y-4">
            {sensorComponents.map((sensor) => {
              const def = componentDefinitions.find((d) => d.id === sensor.definitionId);
              const config = getSensorConfig(sensor.definitionId);
              const value = sensorValues[sensor.instanceId] ?? config.defaultValue;
              
              return (
                <div key={sensor.instanceId} className="space-y-2">
                  <div className="flex items-center justify-between">
                    <Label className="text-xs">{def?.name}</Label>
                    <span className="text-sm font-mono">
                      {value.toFixed(config.decimals)} {config.unit}
                    </span>
                  </div>
                  <Slider
                    value={[value]}
                    min={config.min}
                    max={config.max}
                    step={config.step}
                    onValueChange={([v]) => handleSensorValueChange(sensor.instanceId, v)}
                    disabled={!isRunning}
                  />
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* 网络配置 */}
      <div className="w-56 border-r border-border p-3 space-y-4 overflow-y-auto">
        <div>
          <h4 className="text-sm font-medium mb-3 flex items-center gap-2">
            <Wifi className="h-4 w-4" />
            路由器配置
          </h4>
          <div className="space-y-2">
            <div>
              <Label className="text-xs">SSID</Label>
              <Input
                value={routerConfig.ssid}
                onChange={(e) => updateRouterConfig({ ssid: e.target.value })}
                className="h-8 text-xs"
              />
            </div>
            <div>
              <Label className="text-xs">密码</Label>
              <Input
                value={routerConfig.password}
                onChange={(e) => updateRouterConfig({ password: e.target.value })}
                className="h-8 text-xs"
                type="password"
              />
            </div>
          </div>
        </div>

        <div>
          <h4 className="text-sm font-medium mb-3 flex items-center gap-2">
            <Server className="h-4 w-4" />
            服务器配置
          </h4>
          <div className="space-y-2">
            <div className="flex gap-2">
              <div className="flex-1">
                <Label className="text-xs">IP地址</Label>
                <Input
                  value={serverConfig.ip}
                  onChange={(e) => updateServerConfig({ ip: e.target.value })}
                  className="h-8 text-xs"
                />
              </div>
              <div className="w-20">
                <Label className="text-xs">端口</Label>
                <Input
                  value={serverConfig.port}
                  onChange={(e) => updateServerConfig({ port: parseInt(e.target.value) || 5000 })}
                  className="h-8 text-xs"
                  type="number"
                />
              </div>
            </div>
            <Button
              size="sm"
              variant={serverConfig.running ? 'destructive' : 'default'}
              className="w-full"
              onClick={() => updateServerConfig({ running: !serverConfig.running })}
            >
              {serverConfig.running ? '停止服务器' : '启动服务器'}
            </Button>
          </div>
        </div>
      </div>

      {/* 状态监控和日志 */}
      <div className="flex-1 flex flex-col">
        {/* 系统状态 */}
        <div className="p-3 border-b border-border">
          <div className="flex items-center justify-between mb-2">
            <h4 className="text-sm font-medium flex items-center gap-2">
              <Activity className="h-4 w-4" />
              系统状态
            </h4>
            <div className="flex items-center gap-2">
              <Label className="text-xs">仿真速度</Label>
              <Slider
                value={[simulationSpeed]}
                min={0.5}
                max={3}
                step={0.5}
                onValueChange={([v]) => setSimulationSpeed(v)}
                className="w-20"
              />
              <span className="text-xs w-8">{simulationSpeed}x</span>
            </div>
          </div>
          
          <div className="flex flex-wrap gap-2">
            {systemIssues.length === 0 ? (
              <Badge variant="outline" className="bg-green-50 text-green-700 border-green-200">
                <CheckCircle2 className="h-3 w-3 mr-1" />
                系统就绪
              </Badge>
            ) : (
              systemIssues.map((issue, i) => (
                <Badge key={i} variant="outline" className="bg-red-50 text-red-700 border-red-200">
                  <AlertCircle className="h-3 w-3 mr-1" />
                  {issue}
                </Badge>
              ))
            )}
            
            {serverConfig.running && (
              <Badge variant="outline" className="bg-blue-50 text-blue-700 border-blue-200">
                服务器运行中: {serverConfig.ip}:{serverConfig.port}
              </Badge>
            )}
          </div>
        </div>

        {/* 日志 */}
        <div className="flex-1 flex flex-col min-h-0">
          <div className="flex items-center justify-between px-3 py-2 border-b border-border">
            <span className="text-xs font-medium">通信日志</span>
            <Button size="sm" variant="ghost" onClick={clearLogs}>
              <RotateCcw className="h-3 w-3 mr-1" />
              清除
            </Button>
          </div>
          
          <ScrollArea className="flex-1">
            <div className="p-2 space-y-1">
              {logs.length === 0 ? (
                <p className="text-xs text-muted-foreground text-center py-4">
                  暂无日志
                </p>
              ) : (
                logs.slice().reverse().map((log, i) => (
                  <div
                    key={i}
                    className={`text-xs font-mono p-1.5 rounded ${
                      log.type === 'error'
                        ? 'bg-red-50 text-red-700'
                        : log.type === 'warning'
                        ? 'bg-yellow-50 text-yellow-700'
                        : log.type === 'data'
                        ? 'bg-blue-50 text-blue-700'
                        : 'bg-muted text-muted-foreground'
                    }`}
                  >
                    <span className="opacity-50">
                      [{new Date(log.timestamp).toLocaleTimeString()}]
                    </span>{' '}
                    <span className="font-medium">[{log.source}]</span> {log.message}
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

function getSensorConfig(type: string) {
  switch (type) {
    case 'temp-humidity-sensor':
      return { min: -10, max: 50, step: 0.1, unit: '°C', defaultValue: 25, decimals: 1 };
    case 'light-sensor':
      return { min: 0, max: 1000, step: 10, unit: 'lux', defaultValue: 500, decimals: 0 };
    case 'sound-sensor':
      return { min: 0, max: 120, step: 1, unit: 'dB', defaultValue: 40, decimals: 0 };
    case 'infrared-sensor':
      return { min: 0, max: 1, step: 1, unit: '', defaultValue: 0, decimals: 0 };
    default:
      return { min: 0, max: 100, step: 1, unit: '', defaultValue: 50, decimals: 0 };
  }
}
