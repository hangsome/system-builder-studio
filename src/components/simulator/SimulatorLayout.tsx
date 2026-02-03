import { useState } from 'react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
import { useSimulatorStore } from '@/store/simulatorStore';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Play,
  Square,
  Save,
  RotateCcw,
  Layers,
  Code,
  Database,
  Activity,
  Grid3X3,
  PanelLeftClose,
  PanelLeftOpen,
  PanelRightClose,
  PanelRightOpen,
  Package,
  Settings,
} from 'lucide-react';
import { ComponentLibrary } from './ComponentLibrary';
import { SimulatorCanvas } from './SimulatorCanvas';
import { PropertyPanel } from './PropertyPanel';
import { EnhancedCodeEditor } from './EnhancedCodeEditor';
import { EnhancedDatabasePanel } from './EnhancedDatabasePanel';
import { EnhancedSimulationPanel } from './EnhancedSimulationPanel';
import { ConnectionValidationPanel } from './ConnectionValidationPanel';
import { scenarios, loadScenario } from '@/data/scenarios';
import { cn } from '@/lib/utils';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';

export function SimulatorLayout() {
  const [activeTab, setActiveTab] = useState('hardware');
  const [leftPanelCollapsed, setLeftPanelCollapsed] = useState(false);
  const [rightPanelCollapsed, setRightPanelCollapsed] = useState(false);
  const [bottomPanelCollapsed, setBottomPanelCollapsed] = useState(false);
  
  const {
    isRunning,
    setRunning,
    gridEnabled,
    toggleGrid,
    resetSimulator,
    loadScenario: loadScenarioToStore,
  } = useSimulatorStore();

  const handleScenarioChange = (scenarioId: string) => {
    if (scenarioId === 'blank') {
      resetSimulator();
    } else {
      const scenario = loadScenario(scenarioId);
      if (scenario) {
        loadScenarioToStore(scenario);
      }
    }
  };

  const handleRun = () => {
    setRunning(!isRunning);
  };

  return (
    <TooltipProvider>
      <div className="h-screen flex flex-col bg-background">
        {/* 顶部工具栏 */}
        <header className="h-14 border-b border-border flex items-center justify-between px-4 bg-card">
          <div className="flex items-center gap-4">
            <h1 className="text-lg font-semibold text-foreground flex items-center gap-2">
              <span className="text-2xl">📐</span>
              信息系统搭建模拟器
            </h1>
            
            <Select onValueChange={handleScenarioChange}>
              <SelectTrigger className="w-48">
                <SelectValue placeholder="选择预设场景" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="blank">空白画布</SelectItem>
                {scenarios.map((scenario) => (
                  <SelectItem key={scenario.id} value={scenario.id}>
                    {scenario.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="flex items-center gap-2">
            {/* 面板切换按钮 */}
            <div className="flex items-center gap-1 mr-2 border-r border-border pr-2">
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setLeftPanelCollapsed(!leftPanelCollapsed)}
                    className="h-8 w-8 p-0"
                  >
                    {leftPanelCollapsed ? (
                      <PanelLeftOpen className="h-4 w-4" />
                    ) : (
                      <PanelLeftClose className="h-4 w-4" />
                    )}
                  </Button>
                </TooltipTrigger>
                <TooltipContent>
                  {leftPanelCollapsed ? '展开组件库' : '收起组件库'}
                </TooltipContent>
              </Tooltip>

              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setRightPanelCollapsed(!rightPanelCollapsed)}
                    className="h-8 w-8 p-0"
                  >
                    {rightPanelCollapsed ? (
                      <PanelRightOpen className="h-4 w-4" />
                    ) : (
                      <PanelRightClose className="h-4 w-4" />
                    )}
                  </Button>
                </TooltipTrigger>
                <TooltipContent>
                  {rightPanelCollapsed ? '展开属性面板' : '收起属性面板'}
                </TooltipContent>
              </Tooltip>
            </div>

            <Button
              variant="outline"
              size="sm"
              onClick={toggleGrid}
              className={gridEnabled ? 'bg-muted' : ''}
            >
              <Grid3X3 className="h-4 w-4 mr-1" />
              网格
            </Button>
            
            <Button variant="outline" size="sm">
              <Save className="h-4 w-4 mr-1" />
              保存
            </Button>
            
            <Button variant="outline" size="sm" onClick={resetSimulator}>
              <RotateCcw className="h-4 w-4 mr-1" />
              重置
            </Button>
            
            <Button
              size="sm"
              onClick={handleRun}
              variant={isRunning ? 'destructive' : 'default'}
            >
              {isRunning ? (
                <>
                  <Square className="h-4 w-4 mr-1" />
                  停止
                </>
              ) : (
                <>
                  <Play className="h-4 w-4 mr-1" />
                  运行
                </>
              )}
            </Button>
          </div>
        </header>

        {/* 主内容区 */}
        <div className="flex-1 flex overflow-hidden">
          {/* 左侧组件库 */}
          <div
            className={cn(
              "flex-shrink-0 transition-all duration-300 ease-in-out border-r border-border",
              leftPanelCollapsed ? "w-12" : "w-56"
            )}
          >
            {leftPanelCollapsed ? (
              <CollapsedLeftPanel onExpand={() => setLeftPanelCollapsed(false)} />
            ) : (
              <ComponentLibrary />
            )}
          </div>

          {/* 中间主区域 */}
          <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
            {/* 上半部分：画布 */}
            <div className={cn(
              "min-h-0 relative transition-all duration-300",
              bottomPanelCollapsed ? "flex-1" : "flex-1"
            )}>
              <SimulatorCanvas />
            </div>

            {/* 下半部分：标签页面板 */}
            <div className={cn(
              "border-t border-border flex-shrink-0 transition-all duration-300",
              bottomPanelCollapsed ? "h-10" : "h-72"
            )}>
              <Tabs value={activeTab} onValueChange={setActiveTab} className="h-full flex flex-col">
                <div className="flex items-center justify-between px-4 pt-2">
                  <TabsList className="self-start">
                    <TabsTrigger value="hardware" className="gap-1.5">
                      <Layers className="h-4 w-4" />
                      {!bottomPanelCollapsed && "硬件连接"}
                    </TabsTrigger>
                    <TabsTrigger value="code" className="gap-1.5">
                      <Code className="h-4 w-4" />
                      {!bottomPanelCollapsed && "代码编辑"}
                    </TabsTrigger>
                    <TabsTrigger value="database" className="gap-1.5">
                      <Database className="h-4 w-4" />
                      {!bottomPanelCollapsed && "数据库"}
                    </TabsTrigger>
                    <TabsTrigger value="simulation" className="gap-1.5">
                      <Activity className="h-4 w-4" />
                      {!bottomPanelCollapsed && "运行仿真"}
                    </TabsTrigger>
                  </TabsList>
                  
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setBottomPanelCollapsed(!bottomPanelCollapsed)}
                    className="h-6 w-6 p-0"
                  >
                    {bottomPanelCollapsed ? (
                      <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <polyline points="18 15 12 9 6 15" />
                      </svg>
                    ) : (
                      <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <polyline points="6 9 12 15 18 9" />
                      </svg>
                    )}
                  </Button>
                </div>

                {!bottomPanelCollapsed && (
                  <>
                    <TabsContent value="hardware" className="flex-1 m-0 overflow-hidden">
                      <ConnectionValidationPanel />
                    </TabsContent>
                    
                    <TabsContent value="code" className="flex-1 m-0 overflow-hidden">
                      <EnhancedCodeEditor />
                    </TabsContent>
                    
                    <TabsContent value="database" className="flex-1 m-0 overflow-hidden">
                      <EnhancedDatabasePanel />
                    </TabsContent>
                    
                    <TabsContent value="simulation" className="flex-1 m-0 overflow-hidden">
                      <EnhancedSimulationPanel />
                    </TabsContent>
                  </>
                )}
              </Tabs>
            </div>
          </div>

          {/* 右侧属性面板 */}
          <div
            className={cn(
              "flex-shrink-0 transition-all duration-300 ease-in-out",
              rightPanelCollapsed ? "w-12" : "w-64"
            )}
          >
            {rightPanelCollapsed ? (
              <CollapsedRightPanel onExpand={() => setRightPanelCollapsed(false)} />
            ) : (
              <PropertyPanel />
            )}
          </div>
        </div>
      </div>
    </TooltipProvider>
  );
}

// 收起状态的左侧面板
function CollapsedLeftPanel({ onExpand }: { onExpand: () => void }) {
  return (
    <div className="h-full bg-card flex flex-col items-center py-3 gap-2">
      <Tooltip>
        <TooltipTrigger asChild>
          <Button
            variant="ghost"
            size="sm"
            onClick={onExpand}
            className="h-8 w-8 p-0"
          >
            <Package className="h-4 w-4" />
          </Button>
        </TooltipTrigger>
        <TooltipContent side="right">
          展开组件库
        </TooltipContent>
      </Tooltip>
      
      <div className="w-6 h-px bg-border my-1" />
      
      <div className="flex-1 flex flex-col gap-1 items-center">
        <Tooltip>
          <TooltipTrigger asChild>
            <div className="w-8 h-8 rounded bg-muted/50 flex items-center justify-center cursor-pointer hover:bg-muted">
              <span className="text-xs">主</span>
            </div>
          </TooltipTrigger>
          <TooltipContent side="right">主板</TooltipContent>
        </Tooltip>
        <Tooltip>
          <TooltipTrigger asChild>
            <div className="w-8 h-8 rounded bg-muted/50 flex items-center justify-center cursor-pointer hover:bg-muted">
              <span className="text-xs">传</span>
            </div>
          </TooltipTrigger>
          <TooltipContent side="right">传感器</TooltipContent>
        </Tooltip>
        <Tooltip>
          <TooltipTrigger asChild>
            <div className="w-8 h-8 rounded bg-muted/50 flex items-center justify-center cursor-pointer hover:bg-muted">
              <span className="text-xs">执</span>
            </div>
          </TooltipTrigger>
          <TooltipContent side="right">执行器</TooltipContent>
        </Tooltip>
        <Tooltip>
          <TooltipTrigger asChild>
            <div className="w-8 h-8 rounded bg-muted/50 flex items-center justify-center cursor-pointer hover:bg-muted">
              <span className="text-xs">网</span>
            </div>
          </TooltipTrigger>
          <TooltipContent side="right">网络设备</TooltipContent>
        </Tooltip>
        <Tooltip>
          <TooltipTrigger asChild>
            <div className="w-8 h-8 rounded bg-muted/50 flex items-center justify-center cursor-pointer hover:bg-muted">
              <span className="text-xs">服</span>
            </div>
          </TooltipTrigger>
          <TooltipContent side="right">服务器端</TooltipContent>
        </Tooltip>
      </div>
    </div>
  );
}

// 收起状态的右侧面板
function CollapsedRightPanel({ onExpand }: { onExpand: () => void }) {
  const { selectedComponentId } = useSimulatorStore();
  
  return (
    <div className="h-full bg-card border-l border-border flex flex-col items-center py-3 gap-2">
      <Tooltip>
        <TooltipTrigger asChild>
          <Button
            variant="ghost"
            size="sm"
            onClick={onExpand}
            className="h-8 w-8 p-0"
          >
            <Settings className="h-4 w-4" />
          </Button>
        </TooltipTrigger>
        <TooltipContent side="left">
          展开属性面板
        </TooltipContent>
      </Tooltip>
      
      <div className="w-6 h-px bg-border my-1" />
      
      {selectedComponentId && (
        <Tooltip>
          <TooltipTrigger asChild>
            <div className="w-8 h-8 rounded bg-primary/10 flex items-center justify-center">
              <div className="w-2 h-2 rounded-full bg-primary animate-pulse" />
            </div>
          </TooltipTrigger>
          <TooltipContent side="left">
            已选中组件
          </TooltipContent>
        </Tooltip>
      )}
    </div>
  );
}
