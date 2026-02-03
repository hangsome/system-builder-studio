import { useSimulatorStore } from '@/store/simulatorStore';
import { componentDefinitions } from '@/data/componentDefinitions';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Slider } from '@/components/ui/slider';
import { Trash2, Settings, Zap, ZapOff } from 'lucide-react';

export function PropertyPanel() {
  const {
    selectedComponentId,
    placedComponents,
    connections,
    removeComponent,
    removeConnection,
  } = useSimulatorStore();

  const selectedComponent = placedComponents.find(
    (c) => c.instanceId === selectedComponentId
  );
  
  const definition = selectedComponent
    ? componentDefinitions.find((d) => d.id === selectedComponent.definitionId)
    : null;

  const componentConnections = connections.filter(
    (c) =>
      c.fromComponent === selectedComponentId ||
      c.toComponent === selectedComponentId
  );

  if (!selectedComponent || !definition) {
    return (
      <div className="h-full bg-card border-l border-border p-4">
        <h2 className="font-semibold text-sm text-foreground mb-4">属性面板</h2>
        <div className="text-sm text-muted-foreground text-center py-8">
          选择一个组件查看属性
        </div>
        
        <div className="mt-8 space-y-4">
          <h3 className="font-medium text-sm text-foreground">使用提示</h3>
          <ul className="text-xs text-muted-foreground space-y-2">
            <li>• 从组件库拖拽组件到画布</li>
            <li>• 点击引脚开始连线</li>
            <li>• 按住Ctrl滚轮缩放画布</li>
            <li>• 选中组件后可删除</li>
          </ul>
        </div>
      </div>
    );
  }

  return (
    <div className="h-full bg-card border-l border-border overflow-y-auto">
      <div className="p-4 space-y-6">
        {/* 组件信息 */}
        <div>
          <h2 className="font-semibold text-sm text-foreground mb-2">
            {definition.name}
          </h2>
          <p className="text-xs text-muted-foreground">
            {definition.description}
          </p>
        </div>

        {/* 状态 */}
        <div className="space-y-3">
          <h3 className="text-sm font-medium text-foreground flex items-center gap-2">
            <Settings className="h-4 w-4" />
            状态
          </h3>
          
          <div className="flex items-center justify-between">
            <span className="text-sm text-muted-foreground">电源</span>
            <span className={`flex items-center gap-1 text-sm ${selectedComponent.state?.powered ? 'text-green-500' : 'text-red-500'}`}>
              {selectedComponent.state?.powered ? (
                <>
                  <Zap className="h-4 w-4" />
                  已供电
                </>
              ) : (
                <>
                  <ZapOff className="h-4 w-4" />
                  未供电
                </>
              )}
            </span>
          </div>
          
          <div className="flex items-center justify-between">
            <span className="text-sm text-muted-foreground">位置</span>
            <span className="text-sm text-foreground font-mono">
              ({Math.round(selectedComponent.position.x)}, {Math.round(selectedComponent.position.y)})
            </span>
          </div>
        </div>

        {/* 引脚信息 */}
        <div className="space-y-3">
          <h3 className="text-sm font-medium text-foreground">
            引脚 ({definition.pins.length})
          </h3>
          <div className="space-y-2">
            {definition.pins.map((pin) => {
              const isConnected = connections.some(
                (c) =>
                  (c.fromComponent === selectedComponentId && c.fromPin === pin.id) ||
                  (c.toComponent === selectedComponentId && c.toPin === pin.id)
              );
              
              return (
                <div
                  key={pin.id}
                  className="flex items-center justify-between text-sm py-1 px-2 rounded bg-muted/50"
                >
                  <div className="flex items-center gap-2">
                    <div
                      className={`w-3 h-3 rounded-full ${getPinColorClass(pin.type)}`}
                    />
                    <span className="font-mono">{pin.name}</span>
                  </div>
                  <span className={`text-xs ${isConnected ? 'text-green-500' : 'text-muted-foreground'}`}>
                    {isConnected ? '已连接' : '未连接'}
                  </span>
                </div>
              );
            })}
          </div>
        </div>

        {/* 连接列表 */}
        {componentConnections.length > 0 && (
          <div className="space-y-3">
            <h3 className="text-sm font-medium text-foreground">
              连接 ({componentConnections.length})
            </h3>
            <div className="space-y-2">
              {componentConnections.map((conn) => {
                const isFrom = conn.fromComponent === selectedComponentId;
                const otherComponentId = isFrom ? conn.toComponent : conn.fromComponent;
                const otherComponent = placedComponents.find((c) => c.instanceId === otherComponentId);
                const otherDef = otherComponent
                  ? componentDefinitions.find((d) => d.id === otherComponent.definitionId)
                  : null;
                
                return (
                  <div
                    key={conn.id}
                    className="flex items-center justify-between text-sm py-1 px-2 rounded bg-muted/50"
                  >
                    <span className="text-xs text-muted-foreground">
                      {isFrom ? conn.fromPin : conn.toPin} → {otherDef?.name || '未知'}.{isFrom ? conn.toPin : conn.fromPin}
                    </span>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-6 w-6"
                      onClick={() => removeConnection(conn.id)}
                    >
                      <Trash2 className="h-3 w-3 text-destructive" />
                    </Button>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* 传感器值调节（如果是传感器） */}
        {definition.category === 'sensor' && (
          <div className="space-y-3">
            <h3 className="text-sm font-medium text-foreground">模拟数值</h3>
            <SensorValueControl
              type={definition.type}
              value={selectedComponent.state?.value as number || 0}
              onChange={(value) => {
                // TODO: 更新传感器值
                console.log('Sensor value:', value);
              }}
            />
          </div>
        )}

        {/* 删除按钮 */}
        <Button
          variant="destructive"
          size="sm"
          className="w-full"
          onClick={() => removeComponent(selectedComponentId!)}
        >
          <Trash2 className="h-4 w-4 mr-2" />
          删除组件
        </Button>
      </div>
    </div>
  );
}

function getPinColorClass(type: string) {
  switch (type) {
    case 'power': return 'bg-red-500';
    case 'ground': return 'bg-gray-800';
    case 'serial_tx': return 'bg-green-500';
    case 'serial_rx': return 'bg-green-400';
    case 'usb': return 'bg-purple-500';
    case 'analog': return 'bg-yellow-500';
    case 'digital': return 'bg-blue-500';
    default: return 'bg-blue-400';
  }
}

interface SensorValueControlProps {
  type: string;
  value: number;
  onChange: (value: number) => void;
}

function SensorValueControl({ type, value, onChange }: SensorValueControlProps) {
  const getSensorConfig = () => {
    switch (type) {
      case 'temp-humidity-sensor':
        return { label: '温度', unit: '°C', min: -10, max: 50, step: 1 };
      case 'light-sensor':
        return { label: '光照强度', unit: 'lux', min: 0, max: 1000, step: 10 };
      case 'sound-sensor':
        return { label: '声音强度', unit: 'dB', min: 0, max: 120, step: 1 };
      case 'infrared-sensor':
        return { label: '检测状态', unit: '', min: 0, max: 1, step: 1 };
      default:
        return { label: '数值', unit: '', min: 0, max: 100, step: 1 };
    }
  };

  const config = getSensorConfig();

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <Label className="text-xs">{config.label}</Label>
        <span className="text-sm font-mono">
          {value} {config.unit}
        </span>
      </div>
      <Slider
        value={[value]}
        min={config.min}
        max={config.max}
        step={config.step}
        onValueChange={([v]) => onChange(v)}
      />
    </div>
  );
}
