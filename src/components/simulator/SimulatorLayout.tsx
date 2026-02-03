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
  Download,
  Settings,
  Layers,
  Code,
  Database,
  Activity,
  Grid3X3,
} from 'lucide-react';
import { ComponentLibrary } from './ComponentLibrary';
import { SimulatorCanvas } from './SimulatorCanvas';
import { PropertyPanel } from './PropertyPanel';
import { CodeEditor } from './CodeEditor';
import { DatabasePanel } from './DatabasePanel';
import { SimulationPanel } from './SimulationPanel';
import { scenarios, loadScenario } from '@/data/scenarios';

export function SimulatorLayout() {
  const [activeTab, setActiveTab] = useState('hardware');
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
        <div className="w-56 flex-shrink-0">
          <ComponentLibrary />
        </div>

        {/* 中间主区域 */}
        <div className="flex-1 flex flex-col min-w-0">
          {/* 上半部分：画布 */}
          <div className="flex-1 min-h-0">
            <SimulatorCanvas />
          </div>

          {/* 下半部分：标签页面板 */}
          <div className="h-72 border-t border-border flex-shrink-0">
            <Tabs value={activeTab} onValueChange={setActiveTab} className="h-full flex flex-col">
              <TabsList className="mx-4 mt-2 self-start">
                <TabsTrigger value="hardware" className="gap-1.5">
                  <Layers className="h-4 w-4" />
                  硬件连接
                </TabsTrigger>
                <TabsTrigger value="code" className="gap-1.5">
                  <Code className="h-4 w-4" />
                  代码编辑
                </TabsTrigger>
                <TabsTrigger value="database" className="gap-1.5">
                  <Database className="h-4 w-4" />
                  数据库
                </TabsTrigger>
                <TabsTrigger value="simulation" className="gap-1.5">
                  <Activity className="h-4 w-4" />
                  运行仿真
                </TabsTrigger>
              </TabsList>

              <TabsContent value="hardware" className="flex-1 m-0 overflow-hidden">
                <HardwarePanel />
              </TabsContent>
              
              <TabsContent value="code" className="flex-1 m-0 overflow-hidden">
                <CodeEditor />
              </TabsContent>
              
              <TabsContent value="database" className="flex-1 m-0 overflow-hidden">
                <DatabasePanel />
              </TabsContent>
              
              <TabsContent value="simulation" className="flex-1 m-0 overflow-hidden">
                <SimulationPanel />
              </TabsContent>
            </Tabs>
          </div>
        </div>

        {/* 右侧属性面板 */}
        <div className="w-64 flex-shrink-0">
          <PropertyPanel />
        </div>
      </div>
    </div>
  );
}

function HardwarePanel() {
  const { connections, placedComponents } = useSimulatorStore();

  return (
    <div className="p-4 h-full overflow-y-auto">
      <h3 className="font-medium text-sm mb-3">连接状态</h3>
      
      {connections.length === 0 ? (
        <p className="text-sm text-muted-foreground">
          暂无连接。点击组件引脚开始连线。
        </p>
      ) : (
        <div className="space-y-2">
          {connections.map((conn) => (
            <div
              key={conn.id}
              className="flex items-center gap-2 text-sm p-2 rounded bg-muted/50"
            >
              <span
                className={`w-2 h-2 rounded-full ${conn.valid ? 'bg-green-500' : 'bg-red-500'}`}
              />
              <span>
                {conn.fromComponent.split('-')[0]}.{conn.fromPin}
              </span>
              <span className="text-muted-foreground">→</span>
              <span>
                {conn.toComponent.split('-')[0]}.{conn.toPin}
              </span>
            </div>
          ))}
        </div>
      )}
      
      <div className="mt-4">
        <h4 className="font-medium text-sm mb-2">引脚颜色说明</h4>
        <div className="grid grid-cols-2 gap-2 text-xs">
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 rounded-full bg-red-500" />
            <span>电源 (VCC/3V)</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 rounded-full bg-gray-800" />
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
