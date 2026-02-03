// 增强的代码编辑器 - 阶段三功能
import { useState, useCallback } from 'react';
import { useSimulatorStore } from '@/store/simulatorStore';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { 
  Download, 
  Play, 
  Puzzle, 
  FileCode, 
  Check,
  GripVertical,
  Trash2,
  RotateCcw
} from 'lucide-react';
import { cn } from '@/lib/utils';

// 积木块类型定义
interface CodeBlock {
  id: string;
  type: 'event' | 'control' | 'sensor' | 'network' | 'display' | 'variable';
  category: string;
  label: string;
  code: string;
  color: string;
  inputs?: { name: string; type: 'text' | 'number' | 'select'; default?: string; options?: string[] }[];
  hasBody?: boolean;
}

// 程序中使用的积木实例
interface BlockInstance {
  id: string;
  blockId: string;
  inputs: Record<string, string>;
  children?: BlockInstance[];
}

// 积木库定义
const blockLibrary: CodeBlock[] = [
  // 事件
  { 
    id: 'on_start', 
    type: 'event', 
    category: 'events', 
    label: '当程序启动时', 
    code: '# 程序启动\nfrom microbit import *\nimport obloq\n', 
    color: 'bg-amber-500' 
  },
  
  // 控制
  { 
    id: 'forever', 
    type: 'control', 
    category: 'control', 
    label: '永远循环', 
    code: 'while True:\n    {body}\n    sleep(100)', 
    color: 'bg-orange-500',
    hasBody: true
  },
  { 
    id: 'wait', 
    type: 'control', 
    category: 'control', 
    label: '等待 {time} 毫秒', 
    code: 'sleep({time})', 
    color: 'bg-orange-500',
    inputs: [{ name: 'time', type: 'number', default: '1000' }]
  },
  { 
    id: 'if_then', 
    type: 'control', 
    category: 'control', 
    label: '如果 {condition} 那么', 
    code: 'if {condition}:\n    {body}', 
    color: 'bg-orange-500',
    inputs: [{ name: 'condition', type: 'text', default: 'True' }],
    hasBody: true
  },
  { 
    id: 'if_else', 
    type: 'control', 
    category: 'control', 
    label: '如果...否则', 
    code: 'if {condition}:\n    {body1}\nelse:\n    {body2}', 
    color: 'bg-orange-500',
    inputs: [{ name: 'condition', type: 'text', default: 'True' }],
    hasBody: true
  },

  // 传感器
  { 
    id: 'read_temp', 
    type: 'sensor', 
    category: 'sensors', 
    label: '读取温度', 
    code: 'temperature()', 
    color: 'bg-blue-500' 
  },
  { 
    id: 'read_light', 
    type: 'sensor', 
    category: 'sensors', 
    label: '读取光线强度', 
    code: 'display.read_light_level()', 
    color: 'bg-blue-500' 
  },
  { 
    id: 'read_pin', 
    type: 'sensor', 
    category: 'sensors', 
    label: '读取引脚 {pin} 模拟值', 
    code: 'pin{pin}.read_analog()', 
    color: 'bg-blue-500',
    inputs: [{ name: 'pin', type: 'select', default: '0', options: ['0', '1', '2'] }]
  },
  { 
    id: 'button_pressed', 
    type: 'sensor', 
    category: 'sensors', 
    label: '按钮 {button} 被按下', 
    code: 'button_{button}.is_pressed()', 
    color: 'bg-blue-500',
    inputs: [{ name: 'button', type: 'select', default: 'a', options: ['a', 'b'] }]
  },

  // 网络
  { 
    id: 'wifi_connect', 
    type: 'network', 
    category: 'network', 
    label: '连接WiFi {ssid} 密码 {password}', 
    code: 'obloq.setup("{ssid}", "{password}")', 
    color: 'bg-green-500',
    inputs: [
      { name: 'ssid', type: 'text', default: 'School_WiFi' },
      { name: 'password', type: 'text', default: '12345678' }
    ]
  },
  { 
    id: 'http_post', 
    type: 'network', 
    category: 'network', 
    label: 'HTTP POST 到 {url} 数据 {data}', 
    code: 'obloq.http_post("{url}", {data})', 
    color: 'bg-green-500',
    inputs: [
      { name: 'url', type: 'text', default: 'http://192.168.1.100:5000/upload' },
      { name: 'data', type: 'text', default: '{"temperature": temp}' }
    ]
  },
  { 
    id: 'http_get', 
    type: 'network', 
    category: 'network', 
    label: 'HTTP GET {url}', 
    code: 'obloq.http_get("{url}")', 
    color: 'bg-green-500',
    inputs: [{ name: 'url', type: 'text', default: 'http://192.168.1.100:5000/query' }]
  },

  // 显示
  { 
    id: 'show_number', 
    type: 'display', 
    category: 'display', 
    label: '显示数字 {number}', 
    code: 'display.scroll({number})', 
    color: 'bg-purple-500',
    inputs: [{ name: 'number', type: 'text', default: 'temp' }]
  },
  { 
    id: 'show_string', 
    type: 'display', 
    category: 'display', 
    label: '显示文字 {text}', 
    code: 'display.scroll("{text}")', 
    color: 'bg-purple-500',
    inputs: [{ name: 'text', type: 'text', default: 'Hello' }]
  },
  { 
    id: 'show_icon', 
    type: 'display', 
    category: 'display', 
    label: '显示图标 {icon}', 
    code: 'display.show(Image.{icon})', 
    color: 'bg-purple-500',
    inputs: [{ name: 'icon', type: 'select', default: 'HEART', options: ['HEART', 'HAPPY', 'SAD', 'YES', 'NO'] }]
  },
  { 
    id: 'clear_display', 
    type: 'display', 
    category: 'display', 
    label: '清除显示', 
    code: 'display.clear()', 
    color: 'bg-purple-500' 
  },

  // 变量
  { 
    id: 'set_variable', 
    type: 'variable', 
    category: 'variables', 
    label: '设置 {name} = {value}', 
    code: '{name} = {value}', 
    color: 'bg-rose-500',
    inputs: [
      { name: 'name', type: 'text', default: 'temp' },
      { name: 'value', type: 'text', default: 'temperature()' }
    ]
  },
];

const categoryConfig: Record<string, { name: string; color: string }> = {
  events: { name: '事件', color: 'bg-amber-500' },
  control: { name: '控制', color: 'bg-orange-500' },
  sensors: { name: '传感器', color: 'bg-blue-500' },
  network: { name: '网络', color: 'bg-green-500' },
  display: { name: '显示', color: 'bg-purple-500' },
  variables: { name: '变量', color: 'bg-rose-500' },
};

export function EnhancedCodeEditor() {
  const { 
    microbitCode, 
    flaskCode, 
    codeMode, 
    setMicrobitCode, 
    setFlaskCode, 
    setCodeMode, 
    burnCode, 
    codeBurned,
    updateServerConfig,
    serverConfig
  } = useSimulatorStore();
  
  const [activeEditor, setActiveEditor] = useState<'microbit' | 'flask'>('microbit');
  const [programBlocks, setProgramBlocks] = useState<BlockInstance[]>([]);
  const [activeCategory, setActiveCategory] = useState('events');

  // 添加积木到程序
  const addBlock = useCallback((block: CodeBlock) => {
    const instance: BlockInstance = {
      id: `${block.id}-${Date.now()}`,
      blockId: block.id,
      inputs: {},
    };
    
    // 设置默认输入值
    if (block.inputs) {
      block.inputs.forEach(input => {
        instance.inputs[input.name] = input.default || '';
      });
    }
    
    setProgramBlocks(prev => [...prev, instance]);
  }, []);

  // 移除积木
  const removeBlock = useCallback((instanceId: string) => {
    setProgramBlocks(prev => prev.filter(b => b.id !== instanceId));
  }, []);

  // 更新积木输入
  const updateBlockInput = useCallback((instanceId: string, inputName: string, value: string) => {
    setProgramBlocks(prev => prev.map(b => {
      if (b.id === instanceId) {
        return { ...b, inputs: { ...b.inputs, [inputName]: value } };
      }
      return b;
    }));
  }, []);

  // 生成代码
  const generateCode = useCallback(() => {
    const lines: string[] = [];
    
    programBlocks.forEach(instance => {
      const block = blockLibrary.find(b => b.id === instance.blockId);
      if (!block) return;
      
      let code = block.code;
      
      // 替换输入值
      Object.entries(instance.inputs).forEach(([name, value]) => {
        code = code.replace(new RegExp(`\\{${name}\\}`, 'g'), value);
      });
      
      // 处理缩进
      if (code.includes('\n')) {
        lines.push(...code.split('\n'));
      } else {
        lines.push('    ' + code);
      }
    });
    
    setMicrobitCode(lines.join('\n'));
  }, [programBlocks, setMicrobitCode]);

  // 清空程序
  const clearProgram = useCallback(() => {
    setProgramBlocks([]);
  }, []);

  // 烧录代码
  const handleBurn = () => {
    if (codeMode === 'blocks') {
      generateCode();
    }
    burnCode();
  };

  // 启动服务器
  const handleStartServer = () => {
    updateServerConfig({ running: !serverConfig.running });
  };

  return (
    <div className="h-full flex">
      {/* 左侧：编辑器类型切换 */}
      <div className="w-28 border-r border-border p-2 flex flex-col gap-2">
        <Button
          variant={activeEditor === 'microbit' ? 'default' : 'outline'}
          size="sm"
          className="justify-start text-xs"
          onClick={() => setActiveEditor('microbit')}
        >
          <Puzzle className="h-3 w-3 mr-1" />
          micro:bit
        </Button>
        <Button
          variant={activeEditor === 'flask' ? 'default' : 'outline'}
          size="sm"
          className="justify-start text-xs"
          onClick={() => setActiveEditor('flask')}
        >
          <FileCode className="h-3 w-3 mr-1" />
          Flask
        </Button>
        
        <div className="flex-1" />
        
        {activeEditor === 'microbit' && (
          <Button
            size="sm"
            onClick={handleBurn}
            disabled={codeBurned}
            className="w-full text-xs"
            variant={codeBurned ? 'outline' : 'default'}
          >
            {codeBurned ? (
              <>
                <Check className="h-3 w-3 mr-1" />
                已烧录
              </>
            ) : (
              <>
                <Download className="h-3 w-3 mr-1" />
                烧录
              </>
            )}
          </Button>
        )}
        
        {activeEditor === 'flask' && (
          <Button
            size="sm"
            className="w-full text-xs"
            variant={serverConfig.running ? 'destructive' : 'default'}
            onClick={handleStartServer}
          >
            <Play className="h-3 w-3 mr-1" />
            {serverConfig.running ? '停止' : '启动'}
          </Button>
        )}
      </div>

      {/* micro:bit 编辑区 */}
      {activeEditor === 'microbit' && (
        <div className="flex-1 flex">
          {codeMode === 'blocks' ? (
            <>
              {/* 积木库 */}
              <div className="w-44 border-r border-border flex flex-col">
                {/* 分类标签 */}
                <div className="flex flex-wrap gap-1 p-2 border-b border-border">
                  {Object.entries(categoryConfig).map(([key, { name, color }]) => (
                    <button
                      key={key}
                      onClick={() => setActiveCategory(key)}
                      className={cn(
                        'px-2 py-0.5 rounded text-[10px] text-white transition-opacity',
                        color,
                        activeCategory === key ? 'opacity-100' : 'opacity-50 hover:opacity-75'
                      )}
                    >
                      {name}
                    </button>
                  ))}
                </div>
                
                {/* 积木列表 */}
                <ScrollArea className="flex-1 p-2">
                  <div className="space-y-1">
                    {blockLibrary
                      .filter(b => b.category === activeCategory)
                      .map(block => (
                        <div
                          key={block.id}
                          onClick={() => addBlock(block)}
                          className={cn(
                            'px-2 py-1.5 rounded text-[11px] text-white cursor-pointer',
                            'hover:brightness-110 transition-all',
                            block.color
                          )}
                        >
                          {block.label.replace(/\{[^}]+\}/g, '___')}
                        </div>
                      ))}
                  </div>
                </ScrollArea>
              </div>
              
              {/* 程序工作区 */}
              <div className="flex-1 flex flex-col bg-muted/30">
                <div className="flex items-center justify-between p-2 border-b border-border">
                  <span className="text-xs font-medium">程序</span>
                  <div className="flex gap-1">
                    <Button size="sm" variant="outline" className="h-6 text-xs" onClick={generateCode}>
                      生成代码
                    </Button>
                    <Button size="sm" variant="outline" className="h-6 text-xs" onClick={clearProgram}>
                      <RotateCcw className="h-3 w-3" />
                    </Button>
                    <Button size="sm" variant="outline" className="h-6 text-xs" onClick={() => setCodeMode('python')}>
                      代码模式
                    </Button>
                  </div>
                </div>
                
                <ScrollArea className="flex-1 p-2">
                  {programBlocks.length === 0 ? (
                    <div className="flex items-center justify-center h-full text-sm text-muted-foreground">
                      点击左侧积木添加到程序
                    </div>
                  ) : (
                    <div className="space-y-1">
                      {programBlocks.map((instance) => {
                        const block = blockLibrary.find(b => b.id === instance.blockId);
                        if (!block) return null;
                        
                        return (
                          <div
                            key={instance.id}
                            className={cn(
                              'flex items-center gap-1 px-2 py-1.5 rounded text-[11px] text-white group',
                              block.color
                            )}
                          >
                            <GripVertical className="h-3 w-3 opacity-50" />
                            
                            {/* 渲染带输入框的标签 */}
                            <div className="flex-1 flex items-center gap-1 flex-wrap">
                              {block.label.split(/(\{[^}]+\})/).map((part, i) => {
                                const match = part.match(/\{([^}]+)\}/);
                                if (match) {
                                  const inputName = match[1];
                                  const inputDef = block.inputs?.find(inp => inp.name === inputName);
                                  
                                  if (inputDef?.type === 'select') {
                                    return (
                                      <select
                                        key={i}
                                        value={instance.inputs[inputName] || inputDef.default}
                                        onChange={(e) => updateBlockInput(instance.id, inputName, e.target.value)}
                                        className="bg-white/20 rounded px-1 text-white text-[10px]"
                                        onClick={(e) => e.stopPropagation()}
                                      >
                                        {inputDef.options?.map(opt => (
                                          <option key={opt} value={opt} className="text-foreground">
                                            {opt}
                                          </option>
                                        ))}
                                      </select>
                                    );
                                  }
                                  
                                  return (
                                    <input
                                      key={i}
                                      type={inputDef?.type === 'number' ? 'number' : 'text'}
                                      value={instance.inputs[inputName] || ''}
                                      onChange={(e) => updateBlockInput(instance.id, inputName, e.target.value)}
                                      className="bg-white/20 rounded px-1 w-16 text-white text-[10px] placeholder:text-white/50"
                                      onClick={(e) => e.stopPropagation()}
                                    />
                                  );
                                }
                                return <span key={i}>{part}</span>;
                              })}
                            </div>
                            
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-4 w-4 opacity-0 group-hover:opacity-100"
                              onClick={() => removeBlock(instance.id)}
                            >
                              <Trash2 className="h-3 w-3" />
                            </Button>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </ScrollArea>
              </div>
            </>
          ) : (
            /* Python 代码编辑器 */
            <div className="flex-1 flex flex-col">
              <div className="flex items-center justify-between p-2 border-b border-border">
                <span className="text-xs text-muted-foreground">micro:bit Python</span>
                <Button size="sm" variant="outline" className="h-6 text-xs" onClick={() => setCodeMode('blocks')}>
                  积木模式
                </Button>
              </div>
              <div className="flex-1 relative">
                <textarea
                  value={microbitCode}
                  onChange={(e) => setMicrobitCode(e.target.value)}
                  className="absolute inset-0 w-full h-full p-2 font-mono text-xs bg-muted/30 border-0 resize-none focus:outline-none focus:ring-0"
                  placeholder="在此编写 micro:bit Python 代码..."
                  spellCheck={false}
                />
              </div>
            </div>
          )}
        </div>
      )}

      {/* Flask 编辑区 */}
      {activeEditor === 'flask' && (
        <div className="flex-1 flex flex-col">
          <div className="flex items-center justify-between p-2 border-b border-border">
            <div className="flex items-center gap-2">
              <span className="text-xs text-muted-foreground">Flask 服务器</span>
              {serverConfig.running && (
                <Badge variant="outline" className="text-[10px] bg-green-50 text-green-700 border-green-200">
                  运行中 {serverConfig.ip}:{serverConfig.port}
                </Badge>
              )}
            </div>
          </div>
          <div className="flex-1 relative">
            <textarea
              value={flaskCode}
              onChange={(e) => setFlaskCode(e.target.value)}
              className="absolute inset-0 w-full h-full p-2 font-mono text-xs bg-muted/30 border-0 resize-none focus:outline-none focus:ring-0"
              placeholder="在此编写 Flask 服务器代码..."
              spellCheck={false}
            />
          </div>
        </div>
      )}
    </div>
  );
}
