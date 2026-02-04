import { useState } from 'react';
import { useSimulatorStore } from '@/store/simulatorStore';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Download, Play, Puzzle, FileCode } from 'lucide-react';
import { cn } from '@/lib/utils';

// 简化的积木块定义
interface Block {
  id: string;
  type: string;
  category: 'events' | 'control' | 'sensors' | 'network' | 'display';
  label: string;
  code: string;
  color: string;
}

const blockDefinitions: Block[] = [
  // 事件
  { id: 'on_start', type: 'event', category: 'events', label: '当程序启动时', code: '# 程序启动', color: 'bg-yellow-500' },
  { id: 'forever', type: 'loop', category: 'control', label: '永远循环', code: 'while True:', color: 'bg-orange-500' },
  
  // 传感器
  { id: 'read_temp', type: 'sensor', category: 'sensors', label: '读取温度', code: 'temperature()', color: 'bg-blue-500' },
  { id: 'read_light', type: 'sensor', category: 'sensors', label: '读取光线', code: 'pin0.read_analog()', color: 'bg-blue-500' },
  
  // 网络
  { id: 'wifi_connect', type: 'network', category: 'network', label: '连接WiFi', code: 'obloq.setup("WiFi名称", "密码")', color: 'bg-green-500' },
  { id: 'http_post', type: 'network', category: 'network', label: 'HTTP POST请求', code: 'obloq.http_post(url, data)', color: 'bg-green-500' },
  { id: 'http_get', type: 'network', category: 'network', label: 'HTTP GET请求', code: 'obloq.http_get(url)', color: 'bg-green-500' },
  
  // 显示
  { id: 'show_number', type: 'display', category: 'display', label: '显示数字', code: 'display.scroll(number)', color: 'bg-purple-500' },
  { id: 'show_icon', type: 'display', category: 'display', label: '显示图标', code: 'display.show(Image.HEART)', color: 'bg-purple-500' },
  { id: 'clear_display', type: 'display', category: 'display', label: '清除显示', code: 'display.clear()', color: 'bg-purple-500' },
  
  // 控制
  { id: 'wait', type: 'control', category: 'control', label: '等待', code: 'sleep(1000)', color: 'bg-orange-500' },
  { id: 'if_then', type: 'control', category: 'control', label: '如果...那么', code: 'if condition:', color: 'bg-orange-500' },
];

const categoryNames: Record<string, string> = {
  events: '事件',
  control: '控制',
  sensors: '传感器',
  network: '网络',
  display: '显示',
};

export function CodeEditor() {
  const { microbitCode, flaskCode, codeMode, setMicrobitCode, setFlaskCode, setCodeMode, burnCode, codeBurned } = useSimulatorStore();
  const [activeEditor, setActiveEditor] = useState<'microbit' | 'flask'>('microbit');
  const [selectedBlocks, setSelectedBlocks] = useState<string[]>([]);

  const handleBlockClick = (block: Block) => {
    if (selectedBlocks.includes(block.id)) {
      setSelectedBlocks(selectedBlocks.filter((id) => id !== block.id));
    } else {
      setSelectedBlocks([...selectedBlocks, block.id]);
    }
  };

  const generateCodeFromBlocks = () => {
    const lines: string[] = [
      'from microbit import *',
      'import obloq',
      '',
    ];
    
    selectedBlocks.forEach((blockId) => {
      const block = blockDefinitions.find((b) => b.id === blockId);
      if (block) {
        lines.push(block.code);
      }
    });
    
    setMicrobitCode(lines.join('\n'));
  };

  const handleBurn = () => {
    burnCode();
  };

  return (
    <div className="h-full flex">
      {/* 代码类型切换 */}
      <div className="w-32 border-r border-border p-2 flex flex-col gap-2">
        <Button
          variant={activeEditor === 'microbit' ? 'default' : 'outline'}
          size="sm"
          className="justify-start"
          onClick={() => setActiveEditor('microbit')}
        >
          <Puzzle className="h-4 w-4 mr-1" />
          micro:bit
        </Button>
        <Button
          variant={activeEditor === 'flask' ? 'default' : 'outline'}
          size="sm"
          className="justify-start"
          onClick={() => setActiveEditor('flask')}
        >
          <FileCode className="h-4 w-4 mr-1" />
          Flask
        </Button>
        
        <div className="flex-1" />
        
        {activeEditor === 'microbit' && (
          <Button
            size="sm"
            onClick={handleBurn}
            disabled={codeBurned}
            className="w-full"
          >
            <Download className="h-4 w-4 mr-1" />
            {codeBurned ? '已烧录' : '烧录代码'}
          </Button>
        )}
        
        {activeEditor === 'flask' && (
          <Button
            size="sm"
            className="w-full"
          >
            <Play className="h-4 w-4 mr-1" />
            启动服务器
          </Button>
        )}
      </div>

      {/* micro:bit 编辑区 */}
      {activeEditor === 'microbit' && (
        <div className="flex-1 flex">
          {codeMode === 'blocks' ? (
            <>
              {/* 积木库 */}
              <div className="w-48 border-r border-border overflow-y-auto p-2">
                {Object.entries(categoryNames).map(([category, name]) => (
                  <div key={category} className="mb-4">
                    <h4 className="text-xs font-medium text-muted-foreground mb-2">
                      {name}
                    </h4>
                    <div className="space-y-1">
                      {blockDefinitions
                        .filter((b) => b.category === category)
                        .map((block) => (
                          <div
                            key={block.id}
                            onClick={() => handleBlockClick(block)}
                            className={cn(
                              'px-2 py-1.5 rounded text-xs text-white cursor-pointer',
                              block.color,
                              selectedBlocks.includes(block.id) && 'ring-2 ring-white'
                            )}
                          >
                            {block.label}
                          </div>
                        ))}
                    </div>
                  </div>
                ))}
              </div>
              
              {/* 积木工作区 */}
              <div className="flex-1 p-4 bg-muted/30">
                <div className="flex justify-between items-center mb-4">
                  <h4 className="text-sm font-medium">程序积木</h4>
                  <div className="flex gap-2">
                    <Button size="sm" variant="outline" onClick={generateCodeFromBlocks}>
                      生成代码
                    </Button>
                    <Button size="sm" variant="outline" onClick={() => setCodeMode('python')}>
                      切换到代码
                    </Button>
                  </div>
                </div>
                
                <div className="min-h-[120px] border-2 border-dashed border-border rounded-lg p-4">
                  {selectedBlocks.length === 0 ? (
                    <p className="text-sm text-muted-foreground text-center">
                      点击左侧积木添加到程序
                    </p>
                  ) : (
                    <div className="space-y-1">
                      {selectedBlocks.map((blockId) => {
                        const block = blockDefinitions.find((b) => b.id === blockId);
                        if (!block) return null;
                        return (
                          <div
                            key={blockId}
                            className={cn(
                              'px-3 py-2 rounded text-sm text-white inline-block mr-2 mb-2',
                              block.color
                            )}
                          >
                            {block.label}
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              </div>
            </>
          ) : (
            <div className="flex-1 flex flex-col p-2">
              <div className="flex justify-between items-center mb-2">
                <span className="text-xs text-muted-foreground">micro:bit Python 代码</span>
                <Button size="sm" variant="outline" onClick={() => setCodeMode('blocks')}>
                  切换到积木
                </Button>
              </div>
              <Textarea
                value={microbitCode}
                onChange={(e) => setMicrobitCode(e.target.value)}
                className="flex-1 font-mono text-sm resize-none"
                placeholder="在此编写 micro:bit Python 代码..."
              />
            </div>
          )}
        </div>
      )}

      {/* Flask 编辑区 */}
      {activeEditor === 'flask' && (
        <div className="flex-1 flex flex-col p-2">
          <div className="flex justify-between items-center mb-2">
            <span className="text-xs text-muted-foreground">Flask 服务器代码 (Python)</span>
          </div>
          <Textarea
            value={flaskCode}
            onChange={(e) => setFlaskCode(e.target.value)}
            className="flex-1 font-mono text-sm resize-none"
            placeholder="在此编写 Flask 服务器代码..."
          />
        </div>
      )}
    </div>
  );
}
