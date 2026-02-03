import { useCallback, useRef, useState, useEffect } from 'react';
import { useSimulatorStore } from '@/store/simulatorStore';
import { componentDefinitions } from '@/data/componentDefinitions';
import { ComponentDefinition, PlacedComponent, Pin } from '@/types/simulator';
import { cn } from '@/lib/utils';

const GRID_SIZE = 20;

export function SimulatorCanvas() {
  const canvasRef = useRef<HTMLDivElement>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [draggedComponent, setDraggedComponent] = useState<string | null>(null);
  const [dragOffset, setDragOffset] = useState({ x: 0, y: 0 });
  
  const {
    zoom,
    pan,
    gridEnabled,
    placedComponents,
    connections,
    selectedComponentId,
    isDrawingConnection,
    connectionStart,
    tempConnectionEnd,
    addComponent,
    updateComponentPosition,
    selectComponent,
    startConnection,
    updateTempConnection,
    completeConnection,
    cancelConnection,
    setZoom,
    setPan,
  } = useSimulatorStore();

  // 处理拖放到画布
  const handleDrop = useCallback(
    (e: React.DragEvent<HTMLDivElement>) => {
      e.preventDefault();
      const data = e.dataTransfer.getData('component-definition');
      if (!data) return;

      const definition: ComponentDefinition = JSON.parse(data);
      const rect = canvasRef.current?.getBoundingClientRect();
      if (!rect) return;

      const x = (e.clientX - rect.left - pan.x) / zoom;
      const y = (e.clientY - rect.top - pan.y) / zoom;

      // 对齐到网格
      const snappedX = gridEnabled ? Math.round(x / GRID_SIZE) * GRID_SIZE : x;
      const snappedY = gridEnabled ? Math.round(y / GRID_SIZE) * GRID_SIZE : y;

      const newComponent: PlacedComponent = {
        instanceId: `${definition.id}-${Date.now()}`,
        definitionId: definition.id,
        position: { x: snappedX, y: snappedY },
        state: {
          powered: false,
          active: false,
        },
      };

      addComponent(newComponent);
    },
    [addComponent, pan, zoom, gridEnabled]
  );

  const handleDragOver = useCallback((e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'copy';
  }, []);

  // 处理组件拖拽
  const handleComponentMouseDown = useCallback(
    (e: React.MouseEvent, instanceId: string, component: PlacedComponent) => {
      e.stopPropagation();
      selectComponent(instanceId);
      
      if (e.button === 0) {
        const rect = canvasRef.current?.getBoundingClientRect();
        if (!rect) return;
        
        setIsDragging(true);
        setDraggedComponent(instanceId);
        setDragOffset({
          x: e.clientX - rect.left - (component.position.x * zoom + pan.x),
          y: e.clientY - rect.top - (component.position.y * zoom + pan.y),
        });
      }
    },
    [selectComponent, zoom, pan]
  );

  const handleMouseMove = useCallback(
    (e: React.MouseEvent) => {
      if (isDragging && draggedComponent) {
        const rect = canvasRef.current?.getBoundingClientRect();
        if (!rect) return;
        
        const canvasX = e.clientX - rect.left;
        const canvasY = e.clientY - rect.top;
        
        const x = (canvasX - dragOffset.x - pan.x) / zoom;
        const y = (canvasY - dragOffset.y - pan.y) / zoom;
        
        const snappedX = gridEnabled ? Math.round(x / GRID_SIZE) * GRID_SIZE : x;
        const snappedY = gridEnabled ? Math.round(y / GRID_SIZE) * GRID_SIZE : y;
        
        updateComponentPosition(draggedComponent, { x: snappedX, y: snappedY });
      }
      
      if (isDrawingConnection && canvasRef.current) {
        const rect = canvasRef.current.getBoundingClientRect();
        updateTempConnection({
          x: (e.clientX - rect.left - pan.x) / zoom,
          y: (e.clientY - rect.top - pan.y) / zoom,
        });
      }
    },
    [isDragging, draggedComponent, dragOffset, pan, zoom, gridEnabled, updateComponentPosition, isDrawingConnection, updateTempConnection]
  );

  const handleMouseUp = useCallback(() => {
    setIsDragging(false);
    setDraggedComponent(null);
  }, []);

  // 引脚点击处理
  const handlePinClick = useCallback(
    (e: React.MouseEvent, componentId: string, pinId: string) => {
      e.stopPropagation();
      
      if (isDrawingConnection && connectionStart) {
        completeConnection(componentId, pinId);
      } else {
        startConnection(componentId, pinId);
      }
    },
    [isDrawingConnection, connectionStart, completeConnection, startConnection]
  );

  // 取消连线
  const handleCanvasClick = useCallback(
    (e: React.MouseEvent) => {
      if (e.target === canvasRef.current || (e.target as HTMLElement).classList.contains('canvas-grid')) {
        if (isDrawingConnection) {
          cancelConnection();
        } else {
          selectComponent(null);
        }
      }
    },
    [isDrawingConnection, cancelConnection, selectComponent]
  );

  // 滚轮缩放
  const handleWheel = useCallback(
    (e: React.WheelEvent) => {
      if (e.ctrlKey || e.metaKey) {
        e.preventDefault();
        const delta = e.deltaY > 0 ? -0.1 : 0.1;
        setZoom(zoom + delta);
      }
    },
    [zoom, setZoom]
  );

  // 获取引脚的绝对位置
  const getPinPosition = (component: PlacedComponent, pin: Pin) => {
    return {
      x: component.position.x + pin.position.x,
      y: component.position.y + pin.position.y,
    };
  };

  // 获取连线的引脚位置
  const getConnectionPoints = (connection: typeof connections[0]) => {
    const fromComponent = placedComponents.find((c) => c.instanceId === connection.fromComponent);
    const toComponent = placedComponents.find((c) => c.instanceId === connection.toComponent);
    
    if (!fromComponent || !toComponent) return null;
    
    const fromDef = componentDefinitions.find((d) => d.id === fromComponent.definitionId);
    const toDef = componentDefinitions.find((d) => d.id === toComponent.definitionId);
    
    if (!fromDef || !toDef) return null;
    
    const fromPin = fromDef.pins.find((p) => p.id === connection.fromPin);
    const toPin = toDef.pins.find((p) => p.id === connection.toPin);
    
    if (!fromPin || !toPin) return null;
    
    return {
      from: getPinPosition(fromComponent, fromPin),
      to: getPinPosition(toComponent, toPin),
    };
  };

  // 获取连线颜色
  const getConnectionColor = (type: string) => {
    switch (type) {
      case 'power': return '#ef4444';
      case 'ground': return '#1f2937';
      case 'serial': return '#22c55e';
      default: return '#3b82f6';
    }
  };

  return (
    <div
      ref={canvasRef}
      className="relative w-full h-full bg-muted/30 overflow-hidden"
      onDrop={handleDrop}
      onDragOver={handleDragOver}
      onClick={handleCanvasClick}
      onMouseMove={handleMouseMove}
      onMouseUp={handleMouseUp}
      onMouseLeave={handleMouseUp}
      onWheel={handleWheel}
    >
      {/* 网格背景 */}
      {gridEnabled && (
        <div
          className="canvas-grid absolute inset-0 pointer-events-none"
          style={{
            backgroundImage: `
              linear-gradient(to right, hsl(var(--border)) 1px, transparent 1px),
              linear-gradient(to bottom, hsl(var(--border)) 1px, transparent 1px)
            `,
            backgroundSize: `${GRID_SIZE * zoom}px ${GRID_SIZE * zoom}px`,
            backgroundPosition: `${pan.x}px ${pan.y}px`,
          }}
        />
      )}

      {/* SVG 连线层 */}
      <svg
        className="absolute inset-0 pointer-events-none"
        style={{
          transform: `translate(${pan.x}px, ${pan.y}px) scale(${zoom})`,
          transformOrigin: '0 0',
        }}
      >
        {/* 已完成的连线 */}
        {connections.map((connection) => {
          const points = getConnectionPoints(connection);
          if (!points) return null;
          
          return (
            <g key={connection.id}>
              <line
                x1={points.from.x}
                y1={points.from.y}
                x2={points.to.x}
                y2={points.to.y}
                stroke={getConnectionColor(connection.type)}
                strokeWidth={3}
                strokeLinecap="round"
              />
              {/* 数据流动画 */}
              <circle
                r={4}
                fill={getConnectionColor(connection.type)}
              >
                <animateMotion
                  dur="2s"
                  repeatCount="indefinite"
                  path={`M${points.from.x},${points.from.y} L${points.to.x},${points.to.y}`}
                />
              </circle>
            </g>
          );
        })}
        
        {/* 正在绘制的连线 */}
        {isDrawingConnection && connectionStart && tempConnectionEnd && (() => {
          const fromComponent = placedComponents.find((c) => c.instanceId === connectionStart.componentId);
          if (!fromComponent) return null;
          
          const fromDef = componentDefinitions.find((d) => d.id === fromComponent.definitionId);
          if (!fromDef) return null;
          
          const fromPin = fromDef.pins.find((p) => p.id === connectionStart.pinId);
          if (!fromPin) return null;
          
          const fromPos = getPinPosition(fromComponent, fromPin);
          
          return (
            <line
              x1={fromPos.x}
              y1={fromPos.y}
              x2={tempConnectionEnd.x}
              y2={tempConnectionEnd.y}
              stroke="#94a3b8"
              strokeWidth={2}
              strokeDasharray="5,5"
            />
          );
        })()}
      </svg>

      {/* 组件层 - 直接渲染组件 */}
      {placedComponents.map((component) => {
        const definition = componentDefinitions.find((d) => d.id === component.definitionId);
        if (!definition) return null;

        return (
          <CanvasComponent
            key={component.instanceId}
            component={component}
            definition={definition}
            isSelected={selectedComponentId === component.instanceId}
            onMouseDown={(e) => handleComponentMouseDown(e, component.instanceId, component)}
            onPinClick={handlePinClick}
            isDrawingConnection={isDrawingConnection}
            zoom={zoom}
            pan={pan}
          />
        );
      })}

      {/* 空状态提示 */}
      {placedComponents.length === 0 && (
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
          <div className="text-center text-muted-foreground">
            <p className="text-lg font-medium">从左侧组件库拖拽组件到此处</p>
            <p className="text-sm mt-1">或双击组件添加到画布</p>
          </div>
        </div>
      )}

      {/* 缩放控制 */}
      <div className="absolute bottom-4 right-4 flex items-center gap-2 bg-card border border-border rounded-lg p-2 shadow-sm">
        <button
          onClick={() => setZoom(zoom - 0.1)}
          className="p-1 hover:bg-muted rounded"
        >
          <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <line x1="5" y1="12" x2="19" y2="12" />
          </svg>
        </button>
        <span className="text-sm font-medium min-w-[3rem] text-center">
          {Math.round(zoom * 100)}%
        </span>
        <button
          onClick={() => setZoom(zoom + 0.1)}
          className="p-1 hover:bg-muted rounded"
        >
          <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <line x1="12" y1="5" x2="12" y2="19" />
            <line x1="5" y1="12" x2="19" y2="12" />
          </svg>
        </button>
      </div>
    </div>
  );
}

interface CanvasComponentProps {
  component: PlacedComponent;
  definition: ComponentDefinition;
  isSelected: boolean;
  onMouseDown: (e: React.MouseEvent) => void;
  onPinClick: (e: React.MouseEvent, componentId: string, pinId: string) => void;
  isDrawingConnection: boolean;
  zoom: number;
  pan: { x: number; y: number };
}

function CanvasComponent({
  component,
  definition,
  isSelected,
  onMouseDown,
  onPinClick,
  isDrawingConnection,
  zoom,
  pan,
}: CanvasComponentProps) {
  const handleComponentClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    onMouseDown(e);
  };

  return (
    <div
      className={cn(
        "absolute cursor-move select-none",
        "rounded-lg border-2 bg-card shadow-md transition-shadow",
        isSelected ? "border-primary shadow-lg ring-2 ring-primary/20" : "border-border hover:border-muted-foreground"
      )}
      style={{
        left: component.position.x * zoom + pan.x,
        top: component.position.y * zoom + pan.y,
        width: definition.width * zoom,
        height: definition.height * zoom,
        zIndex: isSelected ? 100 : 10,
        overflow: 'visible', // Allow pins to overflow the component bounds
      }}
      onMouseDown={handleComponentClick}
      onClick={handleComponentClick}
    >
      {/* 组件名称 */}
      <div 
        className="absolute left-0 right-0 text-center pointer-events-none"
        style={{ top: -24 * zoom }}
      >
        <span 
          className="font-medium text-foreground bg-card px-2 py-0.5 rounded border border-border"
          style={{ fontSize: 12 * zoom }}
        >
          {definition.name}
        </span>
      </div>

      {/* 组件可视化内容 */}
      <div className="w-full h-full overflow-hidden rounded-md pointer-events-none">
        <ComponentVisual type={definition.type} state={component.state} />
      </div>

      {/* 引脚 */}
      {definition.pins.map((pin) => (
        <div
          key={pin.id}
          className={cn(
            "absolute rounded-full border-2 cursor-pointer transition-all z-20",
            "flex items-center justify-center",
            "-translate-x-1/2 -translate-y-1/2",
            getPinColor(pin.type),
            isDrawingConnection && "animate-pulse hover:scale-125"
          )}
          style={{
            left: pin.position.x * zoom,
            top: pin.position.y * zoom,
            width: 16 * zoom,
            height: 16 * zoom,
          }}
          onMouseDown={(e) => {
            e.stopPropagation();
          }}
          onClick={(e) => {
            e.stopPropagation();
            e.preventDefault();
            onPinClick(e, component.instanceId, pin.id);
          }}
          title={pin.name}
        >
          <span className="font-bold text-white pointer-events-none" style={{ fontSize: 6 * zoom }}>{pin.name.charAt(0)}</span>
        </div>
      ))}
    </div>
  );
}

function getPinColor(type: string) {
  switch (type) {
    case 'power':
      return 'bg-red-500 border-red-700';
    case 'ground':
      return 'bg-gray-800 border-gray-900';
    case 'serial_tx':
      return 'bg-green-500 border-green-700';
    case 'serial_rx':
      return 'bg-green-400 border-green-600';
    case 'usb':
      return 'bg-purple-500 border-purple-700';
    case 'analog':
      return 'bg-yellow-500 border-yellow-700';
    case 'digital':
      return 'bg-blue-500 border-blue-700';
    default:
      return 'bg-blue-400 border-blue-600';
  }
}

function ComponentVisual({ type, state }: { type: string; state?: PlacedComponent['state'] }) {
  switch (type) {
    case 'microbit':
      return (
        <div className="w-full h-full flex flex-col items-center justify-center gap-1 p-2">
          {/* 5x5 LED 点阵 */}
          <div className="grid grid-cols-5 gap-0.5">
            {Array.from({ length: 25 }).map((_, i) => (
              <div
                key={i}
                className={cn(
                  "w-3 h-3 rounded-sm",
                  state?.ledMatrix?.[Math.floor(i / 5)]?.[i % 5]
                    ? "bg-red-500 shadow-red-500/50 shadow-sm"
                    : "bg-red-900/30"
                )}
              />
            ))}
          </div>
          {/* A/B 按钮 */}
          <div className="flex gap-8 mt-1">
            <div className="w-6 h-6 rounded-full bg-gray-700 border-2 border-gray-600 flex items-center justify-center text-[8px] text-white font-bold">
              A
            </div>
            <div className="w-6 h-6 rounded-full bg-gray-700 border-2 border-gray-600 flex items-center justify-center text-[8px] text-white font-bold">
              B
            </div>
          </div>
        </div>
      );
    
    case 'expansion-board':
      return (
        <div className="w-full h-full bg-green-800 rounded flex items-center justify-center">
          <div className="text-xs text-green-200 font-mono">扩展板</div>
        </div>
      );
    
    case 'temp-humidity-sensor':
      return (
        <div className="w-full h-full flex flex-col items-center justify-center bg-blue-100 rounded">
          <span className="text-lg">🌡️</span>
          <span className="text-[8px] text-blue-800">DHT11</span>
        </div>
      );
    
    case 'light-sensor':
      return (
        <div className="w-full h-full flex flex-col items-center justify-center bg-yellow-100 rounded">
          <span className="text-lg">☀️</span>
          <span className="text-[8px] text-yellow-800">光敏</span>
        </div>
      );
    
    case 'led-strip':
      return (
        <div className="w-full h-full flex items-center justify-center gap-1 bg-gray-900 rounded px-2">
          {[0, 1, 2, 3, 4].map((i) => (
            <div
              key={i}
              className={cn(
                "w-4 h-4 rounded-full",
                state?.active
                  ? ["bg-red-500", "bg-green-500", "bg-blue-500", "bg-yellow-500", "bg-purple-500"][i]
                  : "bg-gray-700"
              )}
            />
          ))}
        </div>
      );
    
    case 'buzzer':
      return (
        <div className="w-full h-full flex items-center justify-center bg-gray-200 rounded">
          <span className="text-xl">🔊</span>
        </div>
      );
    
    case 'obloq':
      return (
        <div className="w-full h-full flex flex-col items-center justify-center bg-blue-600 rounded">
          <span className="text-white text-xs font-bold">OBLOQ</span>
          <span className="text-blue-200 text-[8px]">WiFi</span>
        </div>
      );
    
    case 'router':
      return (
        <div className="w-full h-full flex flex-col items-center justify-center bg-gray-100 rounded">
          <span className="text-2xl">📶</span>
          <span className="text-[8px] text-gray-600">路由器</span>
        </div>
      );
    
    case 'pc-server':
      return (
        <div className="w-full h-full flex flex-col items-center justify-center bg-gray-800 rounded">
          <span className="text-2xl">🖥️</span>
          <span className="text-[8px] text-gray-300">Flask服务器</span>
        </div>
      );
    
    case 'database':
      return (
        <div className="w-full h-full flex flex-col items-center justify-center bg-orange-100 rounded">
          <span className="text-2xl">🗄️</span>
          <span className="text-[8px] text-orange-800">SQLite</span>
        </div>
      );
    
    case 'browser':
      return (
        <div className="w-full h-full flex flex-col items-center justify-center bg-sky-100 rounded">
          <span className="text-2xl">🌐</span>
          <span className="text-[8px] text-sky-800">浏览器</span>
        </div>
      );
    
    default:
      return (
        <div className="w-full h-full flex items-center justify-center">
          <span className="text-lg">📦</span>
        </div>
      );
  }
}
