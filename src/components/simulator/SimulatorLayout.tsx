import { useState, useEffect } from 'react';
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
  FolderOpen,
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
import { Globe } from 'lucide-react';
import { ComponentLibrary } from './ComponentLibrary';
import { SimulatorCanvas } from './SimulatorCanvas';
import { PropertyPanel } from './PropertyPanel';
import { EnhancedCodeEditor } from './EnhancedCodeEditor';
import { EnhancedDatabasePanel } from './EnhancedDatabasePanel';
import { EnhancedSimulationPanel } from './EnhancedSimulationPanel';
import { ConnectionValidationPanel } from './ConnectionValidationPanel';
import { BrowserSimulator } from './BrowserSimulator';
import { scenarios, loadScenario } from '@/data/scenarios';
import { useSimulationRunner } from '@/hooks/useSimulationRunner';
import { cn } from '@/lib/utils';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import { toast } from '@/components/ui/use-toast';
import { loadManualSnapshot, saveManualSnapshot } from '@/lib/manualSnapshot';

const PANEL_STATE_KEY = 'simulator-panel-state';

interface PanelState {
  leftCollapsed: boolean;
  rightCollapsed: boolean;
  bottomCollapsed: boolean;
}

function loadPanelState(): PanelState {
  try {
    const saved = localStorage.getItem(PANEL_STATE_KEY);
    if (saved) {
      return JSON.parse(saved);
    }
  } catch (e) {
    console.error('Failed to load panel state:', e);
  }
  return { leftCollapsed: false, rightCollapsed: false, bottomCollapsed: false };
}

function savePanelState(state: PanelState) {
  try {
    localStorage.setItem(PANEL_STATE_KEY, JSON.stringify(state));
  } catch (e) {
    console.error('Failed to save panel state:', e);
  }
}

export function SimulatorLayout() {
  // 启动后台仿真运行器
  useSimulationRunner();
  
  const [activeTab, setActiveTab] = useState('hardware');
  const [leftPanelCollapsed, setLeftPanelCollapsed] = useState(() => loadPanelState().leftCollapsed);
  const [rightPanelCollapsed, setRightPanelCollapsed] = useState(() => loadPanelState().rightCollapsed);
  const [bottomPanelCollapsed, setBottomPanelCollapsed] = useState(() => loadPanelState().bottomCollapsed);

  // 持久化面板状态
  useEffect(() => {
    savePanelState({
      leftCollapsed: leftPanelCollapsed,
      rightCollapsed: rightPanelCollapsed,
      bottomCollapsed: bottomPanelCollapsed,
    });
  }, [leftPanelCollapsed, rightPanelCollapsed, bottomPanelCollapsed]);
  
  const {
    isRunning,
    setRunning,
    gridEnabled,
    toggleGrid,
    resetSimulator,
    loadScenario: loadScenarioToStore,
    setSensorValues,
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

  const handleSave = () => {
    try {
      const state = useSimulatorStore.getState();
      const snapshot = saveManualSnapshot({
        placedComponents: state.placedComponents,
        connections: state.connections,
        microbitCode: state.microbitCode,
        flaskCode: state.flaskCode,
        database: state.database,
        routerConfig: state.routerConfig,
        serverConfig: state.serverConfig,
        sensorValues: state.sensorValues,
      });
      toast({
        title: '保存成功',
        description: `已保存快照：${new Date(snapshot.savedAt).toLocaleString()}`,
      });
    } catch (error) {
      console.error('[simulator] Manual save failed', error);
      toast({
        title: '保存失败',
        description: '无法写入本地快照，请检查浏览器存储权限。',
        variant: 'destructive',
      });
    }
  };

  const handleRestore = () => {
    const snapshot = loadManualSnapshot();
    if (!snapshot) {
      toast({
        title: '没有可恢复快照',
        description: '请先点击“保存”创建本地快照。',
      });
      return;
    }

    try {
      loadScenarioToStore({
        components: snapshot.data.placedComponents,
        connections: snapshot.data.connections,
        microbitCode: snapshot.data.microbitCode,
        flaskCode: snapshot.data.flaskCode,
        database: snapshot.data.database,
        routerConfig: snapshot.data.routerConfig,
        serverConfig: snapshot.data.serverConfig,
      });
      setSensorValues(snapshot.data.sensorValues ?? {});
      setRunning(false);
      toast({
        title: '恢复成功',
        description: `已恢复快照：${new Date(snapshot.savedAt).toLocaleString()}`,
      });
    } catch (error) {
      console.error('[simulator] Manual restore failed', error);
      toast({
        title: '恢复失败',
        description: '快照格式异常，请重新保存后再试。',
        variant: 'destructive',
      });
    }
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
            
            <Button variant="outline" size="sm" onClick={handleSave}>
              <Save className="h-4 w-4 mr-1" />
              保存
            </Button>

            <Button variant="outline" size="sm" onClick={handleRestore}>
              <FolderOpen className="h-4 w-4 mr-1" />
              恢复
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
                    <TabsTrigger value="browser" className="gap-1.5">
                      <Globe className="h-4 w-4" />
                      {!bottomPanelCollapsed && "浏览器"}
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
                    
                    <TabsContent value="browser" className="flex-1 m-0 overflow-hidden p-2">
                      <BrowserSimulator />
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
