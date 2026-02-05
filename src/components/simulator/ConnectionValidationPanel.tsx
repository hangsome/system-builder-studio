// 连接验证面板 - 显示连接状态和错误
import { useSimulatorStore } from '@/store/simulatorStore';
import { validateSystem, getConnectionColor } from '@/lib/connectionValidator';
import { componentDefinitions } from '@/data/componentDefinitions';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { 
  AlertCircle, 
  CheckCircle2, 
  AlertTriangle, 
  Unplug, 
  Trash2,
  Zap,
  ZapOff 
} from 'lucide-react';

export function ConnectionValidationPanel() {
  const { 
    connections, 
    placedComponents, 
    removeConnection 
  } = useSimulatorStore();

  const validation = validateSystem(placedComponents, connections);

  return (
    <div className="p-4 h-full overflow-y-auto">
      {/* 系统状态概览 */}
      <div className="mb-4">
        <h3 className="font-medium text-sm mb-3 flex items-center gap-2">
          {validation.issues.length === 0 ? (
            <CheckCircle2 className="h-4 w-4 text-green-500" />
          ) : (
            <AlertCircle className="h-4 w-4 text-red-500" />
          )}
          连接验证
        </h3>

        {validation.issues.length > 0 && (
          <div className="space-y-2 mb-4">
            {validation.issues.map((issue, i) => (
              <div key={i} className="flex items-start gap-2 text-sm p-2 rounded bg-red-50 text-red-700 dark:bg-red-950/30 dark:text-red-400">
                <AlertCircle className="h-4 w-4 mt-0.5 flex-shrink-0" />
                <span>{issue}</span>
              </div>
            ))}
          </div>
        )}

        {validation.warnings.length > 0 && (
          <div className="space-y-2 mb-4">
            {validation.warnings.map((warning, i) => (
              <div key={i} className="flex items-start gap-2 text-sm p-2 rounded bg-yellow-50 text-yellow-700 dark:bg-yellow-950/30 dark:text-yellow-400">
                <AlertTriangle className="h-4 w-4 mt-0.5 flex-shrink-0" />
                <span>{warning}</span>
              </div>
            ))}
          </div>
        )}

        {validation.issues.length === 0 && validation.warnings.length === 0 && (
          <div className="flex items-center gap-2 text-sm p-2 rounded bg-green-50 text-green-700 dark:bg-green-950/30 dark:text-green-400">
            <CheckCircle2 className="h-4 w-4" />
            <span>所有连接正常</span>
          </div>
        )}
      </div>

      {/* 组件电源状态 */}
      <div className="mb-4">
        <h4 className="text-sm font-medium mb-2">组件电源状态</h4>
        <div className="space-y-1">
          {placedComponents.map(component => {
            const def = componentDefinitions.find(d => d.id === component.definitionId);
            const isPowered = validation.powerStatus.get(component.instanceId);
            
            return (
              <div key={component.instanceId} className="flex items-center justify-between text-sm py-1 px-2 rounded bg-muted/50">
                <span>{def?.name || component.definitionId}</span>
                {isPowered ? (
                  <span className="flex items-center gap-1 text-green-600">
                    <Zap className="h-3 w-3" />
                    已供电
                  </span>
                ) : (
                  <span className="flex items-center gap-1 text-muted-foreground">
                    <ZapOff className="h-3 w-3" />
                    未供电
                  </span>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* 连接列表 */}
      <div>
        <h4 className="text-sm font-medium mb-2">
          连接列表 ({connections.length})
        </h4>
        
        {connections.length === 0 ? (
          <p className="text-sm text-muted-foreground flex items-center gap-2 py-4">
            <Unplug className="h-4 w-4" />
            点击组件引脚开始连线
          </p>
        ) : (
          <ScrollArea className="h-[140px]">
            <div className="space-y-2 pr-4">
              {connections.map((conn) => {
                const fromComponent = placedComponents.find(c => c.instanceId === conn.fromComponent);
                const toComponent = placedComponents.find(c => c.instanceId === conn.toComponent);
                const fromDef = fromComponent ? componentDefinitions.find(d => d.id === fromComponent.definitionId) : null;
                const toDef = toComponent ? componentDefinitions.find(d => d.id === toComponent.definitionId) : null;

                return (
                  <div
                    key={conn.id}
                    className="flex items-center justify-between text-sm p-2 rounded bg-muted/50 group"
                  >
                    <div className="flex items-center gap-2 flex-1 min-w-0">
                      <div
                        className="w-3 h-3 rounded-full flex-shrink-0"
                        style={{ backgroundColor: getConnectionColor(conn.valid) }}
                      />
                      <span className="truncate">
                        {fromDef?.name}.{conn.fromPin}
                      </span>
                      <span className="text-muted-foreground">→</span>
                      <span className="truncate">
                        {toDef?.name}.{conn.toPin}
                      </span>
                      {!conn.valid && (
                        <Badge variant="destructive" className="text-[10px] px-1 py-0">
                          无效
                        </Badge>
                      )}
                    </div>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-6 w-6 opacity-0 group-hover:opacity-100 transition-opacity"
                      onClick={() => removeConnection(conn.id)}
                    >
                      <Trash2 className="h-3 w-3 text-destructive" />
                    </Button>
                  </div>
                );
              })}
            </div>
          </ScrollArea>
        )}
      </div>

      {/* 引脚颜色说明 */}
      <div className="mt-4 pt-4 border-t border-border">
        <h4 className="font-medium text-sm mb-2">引脚颜色说明</h4>
        <div className="grid grid-cols-2 gap-2 text-xs">
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 rounded-full bg-red-500" />
            <span>电源 (VCC/3V)</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 rounded-full bg-gray-800 dark:bg-gray-300" />
            <span>接地 (GND)</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 rounded-full bg-blue-500" />
            <span>数字信号</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 rounded-full bg-yellow-500" />
            <span>模拟信号</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 rounded-full bg-green-500" />
            <span>串口 TX</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 rounded-full bg-green-400" />
            <span>串口 RX</span>
          </div>
        </div>
      </div>
    </div>
  );
}
