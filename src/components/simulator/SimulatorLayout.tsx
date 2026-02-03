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
} from 'lucide-react';
import { ComponentLibrary } from './ComponentLibrary';
import { SimulatorCanvas } from './SimulatorCanvas';
import { PropertyPanel } from './PropertyPanel';
import { EnhancedCodeEditor } from './EnhancedCodeEditor';
import { EnhancedDatabasePanel } from './EnhancedDatabasePanel';
import { EnhancedSimulationPanel } from './EnhancedSimulationPanel';
import { ConnectionValidationPanel } from './ConnectionValidationPanel';
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
        <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
          {/* 上半部分：画布 */}
          <div className="flex-1 min-h-0 relative">
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
