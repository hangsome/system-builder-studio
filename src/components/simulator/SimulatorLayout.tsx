import { ReactNode, useState, useEffect, useRef } from 'react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { useSimulatorStore } from '@/store/simulatorStore';
import { useLicense } from '@/hooks/useLicense';
import { useUpgradePrompt } from '@/components/UpgradePrompt';
import { getLicenseDisplayName } from '@/lib/license';
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
  Shuffle,
  Lock,
  Maximize2,
  Minimize2,
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
import { canRunSimulation } from '@/lib/simulationEngine';
import { cn } from '@/lib/utils';
import { UserRole } from '@/types/edu';
import { TeachingSubmissionPanel } from './TeachingSubmissionPanel';
import { toast } from 'sonner';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';

const PANEL_STATE_KEY = 'simulator-panel-state';
const MANUAL_SAVE_KEY = 'simulator-manual-save';
const OPENCLASS_CANVAS_INITIALIZED_KEY = 'openclass-classroom-canvas-initialized';
const OPENCLASS_CANVAS_VERSION_KEY = 'openclass-classroom-canvas-version';
const CURRENT_OPENCLASS_CANVAS_VERSION = '2026-05-22-blank-classroom-canvas';

interface SubmissionContext {
  assignmentId: number;
  assignmentTitle?: string;
  onSubmitted?: () => void;
}

interface SimulatorLayoutProps {
  role?: UserRole;
  submissionContext?: SubmissionContext;
  headerActions?: ReactNode;
}

interface PanelState {
  leftCollapsed: boolean;
  rightCollapsed: boolean;
  bottomCollapsed: boolean;
  bottomLarge: boolean;
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
  return { leftCollapsed: false, rightCollapsed: false, bottomCollapsed: false, bottomLarge: false };
}

function savePanelState(state: PanelState) {
  try {
    localStorage.setItem(PANEL_STATE_KEY, JSON.stringify(state));
  } catch (e) {
    console.error('Failed to save panel state:', e);
  }
}

export function SimulatorLayout({ role, submissionContext, headerActions }: SimulatorLayoutProps) {
  useSimulationRunner();

  const { licenseState, featureAccess } = useLicense();
  const upgradePrompt = useUpgradePrompt();
  const isClassroomMode = role === 'student';

  const [activeTab, setActiveTab] = useState(isClassroomMode ? 'code' : 'hardware');
  const [leftPanelCollapsed, setLeftPanelCollapsed] = useState(() => loadPanelState().leftCollapsed);
  const [rightPanelCollapsed, setRightPanelCollapsed] = useState(() => loadPanelState().rightCollapsed);
  const [bottomPanelCollapsed, setBottomPanelCollapsed] = useState(() =>
    isClassroomMode ? false : loadPanelState().bottomCollapsed
  );
  const [bottomPanelLarge, setBottomPanelLarge] = useState(() =>
    isClassroomMode ? false : Boolean(loadPanelState().bottomLarge)
  );
  const bottomPanelSizeLabels: Record<string, string> = {
    browser: '浏览器',
    database: '数据库',
    simulation: '运行区',
  };
  const bottomPanelSizeLabel = bottomPanelSizeLabels[activeTab] ?? '代码区';

  useEffect(() => {
    savePanelState({
      leftCollapsed: leftPanelCollapsed,
      rightCollapsed: rightPanelCollapsed,
      bottomCollapsed: bottomPanelCollapsed,
      bottomLarge: bottomPanelLarge,
    });
  }, [leftPanelCollapsed, rightPanelCollapsed, bottomPanelCollapsed, bottomPanelLarge]);

  const {
    isRunning,
    setRunning,
    gridEnabled,
    toggleGrid,
    resetSimulator,
    loadScenario: loadScenarioToStore,
    placedComponents,
    connections,
    codeBurned,
    serverConfig,
    addLog,
    clearLogs,
    autoConnectEnabled,
    setAutoConnectEnabled,
    generateRandomFault,
  } = useSimulatorStore();

  const canLoadPresetScenarios = role === 'teacher' || role === 'admin' || !role;
  const studentScenarioInitializedRef = useRef(false);

  useEffect(() => {
    if (isClassroomMode) {
      setAutoConnectEnabled(false);
      if (studentScenarioInitializedRef.current) {
        return;
      }
      studentScenarioInitializedRef.current = true;

      let alreadyInitialized = false;
      try {
        alreadyInitialized =
          localStorage.getItem(OPENCLASS_CANVAS_VERSION_KEY) === CURRENT_OPENCLASS_CANVAS_VERSION ||
          localStorage.getItem(OPENCLASS_CANVAS_INITIALIZED_KEY) === CURRENT_OPENCLASS_CANVAS_VERSION;
      } catch {
        // localStorage 不可用时继续按画布内容判断。
      }
      if (alreadyInitialized) {
        return;
      }

      resetSimulator();
      try {
        localStorage.setItem(OPENCLASS_CANVAS_INITIALIZED_KEY, CURRENT_OPENCLASS_CANVAS_VERSION);
        localStorage.setItem(OPENCLASS_CANVAS_VERSION_KEY, CURRENT_OPENCLASS_CANVAS_VERSION);
      } catch {
        // 忽略存储失败。
      }
    }
  }, [isClassroomMode, resetSimulator, setAutoConnectEnabled]);

  const handleScenarioChange = (scenarioId: string) => {
    if (!canLoadPresetScenarios && scenarioId !== 'blank') {
      toast.error('学生仅可使用课堂空白画布');
      setAutoConnectEnabled(false);
      resetSimulator();
      return;
    }

    if (!featureAccess.canUseAllComponents && scenarioId !== 'blank') {
      const scenarioIndex = scenarios.findIndex((s) => s.id === scenarioId);
      if (scenarioIndex >= featureAccess.maxScenarios) {
        upgradePrompt.show('该预设场景');
        return;
      }
    }

    if (scenarioId === 'blank') {
      resetSimulator();
    } else {
      const scenario = loadScenario(scenarioId);
      if (scenario) {
        loadScenarioToStore(scenario);
      }
    }
  };

  const handleReset = () => {
    if (isClassroomMode) {
      const confirmed = window.confirm('确定要重置为课堂空白画布吗？当前修改会被清空。');
      if (!confirmed) return;

      setAutoConnectEnabled(false);
      resetSimulator();
      try {
        localStorage.setItem(OPENCLASS_CANVAS_INITIALIZED_KEY, CURRENT_OPENCLASS_CANVAS_VERSION);
        localStorage.setItem(OPENCLASS_CANVAS_VERSION_KEY, CURRENT_OPENCLASS_CANVAS_VERSION);
      } catch {
        // 忽略存储失败。
      }
      toast.success('已恢复课堂空白画布');
      return;
    }

    resetSimulator();
  };

  const handleRun = () => {
    if (isRunning) {
      setRunning(false);
      addLog({ type: 'info', message: '仿真已停止', source: 'System' });
      return;
    }

    const systemCheck = canRunSimulation(placedComponents, connections, codeBurned, serverConfig.running);
    if (!systemCheck.canRun) {
      systemCheck.issues.forEach((issue) => {
        addLog({ type: 'warning', message: issue, source: 'System' });
      });
      toast.warning(`暂不能运行：${systemCheck.issues[0] || '请先完成运行准备'}`);
      return;
    }

    clearLogs();
    setRunning(true);
    addLog({ type: 'info', message: '仿真开始运行', source: 'System' });
  };

  const handleSave = () => {
    if (!featureAccess.canSave) {
      upgradePrompt.show('保存功能');
      return;
    }

    try {
      const state = useSimulatorStore.getState();
      const snapshot = {
        savedAt: new Date().toISOString(),
        data: {
          placedComponents: state.placedComponents,
          connections: state.connections,
          microbitCode: state.microbitCode,
          flaskCode: state.flaskCode,
          database: state.database,
          routerConfig: state.routerConfig,
          serverConfig: state.serverConfig,
        },
      };
      localStorage.setItem(MANUAL_SAVE_KEY, JSON.stringify(snapshot));
      console.info('[simulator] Manual save completed', snapshot.savedAt);
    } catch (error) {
      console.error('[simulator] Manual save failed', error);
    }
  };

  const handleGenerateRandomFault = () => {
    const result = generateRandomFault();
    if (result.success) {
      toast.warning(result.message);
    } else {
      toast.error(result.message);
    }
  };

  return (
    <TooltipProvider>
      <div className="h-screen flex flex-col bg-background">
        <upgradePrompt.UpgradePromptComponent />

        <header className="h-14 border-b border-border flex items-center justify-between px-4 bg-card">
          <div className="flex items-center gap-4">
            <h1 className="text-lg font-semibold text-foreground flex items-center gap-2">
              <Package className="h-5 w-5 text-primary" />
              信息系统搭建模拟器
              {licenseState && (
                !isClassroomMode ? (
                  <span
                    className={cn(
                      'text-xs px-2 py-0.5 rounded-full',
                      licenseState.licenseType === 'trial'
                        ? 'bg-muted text-muted-foreground'
                        : 'bg-primary/10 text-primary'
                    )}
                  >
                    {getLicenseDisplayName(licenseState.licenseType)}
                  </span>
                ) : null
              )}
            </h1>

            {canLoadPresetScenarios ? (
              <Select onValueChange={handleScenarioChange}>
                <SelectTrigger className="w-48">
                  <SelectValue placeholder="选择预设场景" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="blank">空白画布</SelectItem>
                  {scenarios.map((scenario, index) => (
                    <SelectItem key={scenario.id} value={scenario.id} className="flex items-center">
                      <span className="flex items-center gap-2">
                        {scenario.name}
                        {!featureAccess.canUseAllComponents && index >= featureAccess.maxScenarios && (
                          <Lock className="h-3 w-3 text-muted-foreground" />
                        )}
                      </span>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            ) : (
              <div className="text-xs px-3 py-2 rounded-md border bg-muted/50">学生模式：课堂空白画布</div>
            )}

            {submissionContext ? (
              <div className="text-xs px-3 py-2 rounded-md border bg-muted/50">
                作业 #{submissionContext.assignmentId}
                {submissionContext.assignmentTitle ? ` - ${submissionContext.assignmentTitle}` : ''}
              </div>
            ) : null}
          </div>

          <div className="flex items-center gap-2">
            {headerActions ? <div className="flex items-center gap-2 mr-2">{headerActions}</div> : null}

            {!isClassroomMode ? (
              <div className="mr-2 flex items-center gap-2 rounded-md border border-border bg-muted/40 px-2.5 py-1.5">
                <Settings className="h-4 w-4 text-muted-foreground" />
                <span className="text-xs font-medium text-muted-foreground">自动连线</span>
                <Switch
                  checked={autoConnectEnabled}
                  onCheckedChange={(enabled) => {
                    setAutoConnectEnabled(enabled);
                    toast.info(enabled ? '已开启教师自动连线' : '已关闭自动连线，组件将保持未连接');
                  }}
                  aria-label="教师自动连线"
                />
              </div>
            ) : null}

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
                <TooltipContent>{leftPanelCollapsed ? '展开组件库' : '收起组件库'}</TooltipContent>
              </Tooltip>

              {!isClassroomMode ? (
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
                  <TooltipContent>{rightPanelCollapsed ? '展开属性面板' : '收起属性面板'}</TooltipContent>
                </Tooltip>
              ) : null}
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

            {!isClassroomMode ? (
              <Button variant="outline" size="sm" onClick={handleSave}>
                <Save className="h-4 w-4 mr-1" />
                保存
                {!featureAccess.canSave && <Lock className="h-3 w-3 ml-1 text-muted-foreground" />}
              </Button>
            ) : null}

            {!isClassroomMode ? (
              <Button variant="outline" size="sm" onClick={handleGenerateRandomFault}>
                <Shuffle className="h-4 w-4 mr-1" />
                随机故障
              </Button>
            ) : null}

            <Button variant="outline" size="sm" onClick={handleReset}>
              <RotateCcw className="h-4 w-4 mr-1" />
              重置
            </Button>

            <Button size="sm" onClick={handleRun} variant={isRunning ? 'destructive' : 'default'}>
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

            {role === 'student' && submissionContext ? (
              <TeachingSubmissionPanel
                assignmentId={submissionContext.assignmentId}
                assignmentTitle={submissionContext.assignmentTitle}
                onSubmitted={submissionContext.onSubmitted}
              />
            ) : null}
          </div>
        </header>

        <div className="flex-1 flex overflow-hidden">
          <div
            className={cn(
              'flex-shrink-0 transition-all duration-300 ease-in-out border-r border-border',
              leftPanelCollapsed ? 'w-12' : 'w-56'
            )}
          >
            {leftPanelCollapsed ? (
              <CollapsedLeftPanel onExpand={() => setLeftPanelCollapsed(false)} />
            ) : (
              <ComponentLibrary />
            )}
          </div>

          <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
            <div className={cn('min-h-0 relative transition-all duration-300', bottomPanelCollapsed ? 'flex-1' : 'flex-1')}>
              <SimulatorCanvas classroomMode={isClassroomMode} />
            </div>

            <div
              className={cn(
                'border-t border-border flex-shrink-0 transition-all duration-300',
                bottomPanelCollapsed ? 'h-10' : bottomPanelLarge ? 'h-[54vh]' : 'h-72'
              )}
            >
              <Tabs
                value={activeTab}
                onValueChange={(value) => {
                  setActiveTab(value);
                  if (value === 'browser') {
                    setBottomPanelLarge(true);
                  }
                }}
                className="h-full flex flex-col"
              >
                <div className="flex items-center justify-between px-4 pt-2">
                  <TabsList className="self-start">
                    {!isClassroomMode ? (
                      <TabsTrigger value="hardware" className="gap-1.5">
                        <Layers className="h-4 w-4" />
                        {!bottomPanelCollapsed && '硬件连接'}
                      </TabsTrigger>
                    ) : null}
                    <TabsTrigger value="code" className="gap-1.5">
                      <Code className="h-4 w-4" />
                      {!bottomPanelCollapsed && '代码编辑'}
                    </TabsTrigger>
                    <TabsTrigger value="database" className="gap-1.5">
                      <Database className="h-4 w-4" />
                      {!bottomPanelCollapsed && '数据库'}
                    </TabsTrigger>
                    <TabsTrigger value="simulation" className="gap-1.5">
                      <Activity className="h-4 w-4" />
                      {!bottomPanelCollapsed && '运行仿真'}
                    </TabsTrigger>
                    <TabsTrigger value="browser" className="gap-1.5">
                      <Globe className="h-4 w-4" />
                      {!bottomPanelCollapsed && '浏览器'}
                    </TabsTrigger>
                  </TabsList>

                  <div className="flex items-center gap-1">
                    {!bottomPanelCollapsed && (
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => setBottomPanelLarge(!bottomPanelLarge)}
                        className="h-7 gap-1 px-2 text-xs"
                      >
                        {bottomPanelLarge ? <Minimize2 className="h-3.5 w-3.5" /> : <Maximize2 className="h-3.5 w-3.5" />}
                        {bottomPanelLarge ? `标准${bottomPanelSizeLabel}` : `放大${bottomPanelSizeLabel}`}
                      </Button>
                    )}
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => setBottomPanelCollapsed(!bottomPanelCollapsed)}
                      className="h-6 w-6 p-0"
                      aria-label={bottomPanelCollapsed ? '展开底部面板' : '收起底部面板'}
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

          {!isClassroomMode ? (
            <div
              className={cn(
                'flex-shrink-0 transition-all duration-300 ease-in-out',
                rightPanelCollapsed ? 'w-12' : 'w-64'
              )}
            >
              {rightPanelCollapsed ? (
                <CollapsedRightPanel onExpand={() => setRightPanelCollapsed(false)} />
              ) : (
                <PropertyPanel />
              )}
            </div>
          ) : null}
        </div>
      </div>
    </TooltipProvider>
  );
}

function CollapsedLeftPanel({ onExpand }: { onExpand: () => void }) {
  return (
    <div className="h-full bg-card flex flex-col items-center py-3 gap-2">
      <Tooltip>
        <TooltipTrigger asChild>
          <Button variant="ghost" size="sm" onClick={onExpand} className="h-8 w-8 p-0">
            <Package className="h-4 w-4" />
          </Button>
        </TooltipTrigger>
        <TooltipContent side="right">展开组件库</TooltipContent>
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

function CollapsedRightPanel({ onExpand }: { onExpand: () => void }) {
  const { selectedComponentId } = useSimulatorStore();

  return (
    <div className="h-full bg-card border-l border-border flex flex-col items-center py-3 gap-2">
      <Tooltip>
        <TooltipTrigger asChild>
          <Button variant="ghost" size="sm" onClick={onExpand} className="h-8 w-8 p-0">
            <Settings className="h-4 w-4" />
          </Button>
        </TooltipTrigger>
        <TooltipContent side="left">展开属性面板</TooltipContent>
      </Tooltip>

      <div className="w-6 h-px bg-border my-1" />

      {selectedComponentId && (
        <Tooltip>
          <TooltipTrigger asChild>
            <div className="w-8 h-8 rounded bg-primary/10 flex items-center justify-center">
              <div className="w-2 h-2 rounded-full bg-primary animate-pulse" />
            </div>
          </TooltipTrigger>
          <TooltipContent side="left">已选中组件</TooltipContent>
        </Tooltip>
      )}
    </div>
  );
}
