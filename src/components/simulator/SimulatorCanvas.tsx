import { type CSSProperties, useCallback, useMemo, useRef, useState, useEffect } from 'react';
import { useSimulatorStore } from '@/store/simulatorStore';
import { componentDefinitions, smartTerminalDefinition } from '@/data/componentDefinitions';
import { ComponentDefinition, Connection, PlacedComponent, Pin } from '@/types/simulator';
import { cn, createId } from '@/lib/utils';
import { ChevronDown, ChevronRight, Zap, CheckCircle2, XCircle, Eye, EyeOff, LayoutGrid } from 'lucide-react';
import { useShallow } from 'zustand/react/shallow';
import { isInitiallyPowered } from '@/lib/connectionValidator';

const GRID_SIZE = 20;

const isPowerPin = (pin: Pin) => pin.type === 'power' || pin.type === 'ground';
const isPowerConnection = (connection: { type: string }) =>
  connection.type === 'power' || connection.type === 'ground';

type PinSide = 'top' | 'right' | 'bottom' | 'left';

interface PinLayout {
  position: { x: number; y: number };
  side: PinSide;
}

type GetPinLayout = (component: PlacedComponent, definition: ComponentDefinition, pin: Pin) => PinLayout;

const PIN_EDGE_MARGIN = 14;

const pinKey = (componentId: string, pinId: string) => `${componentId}:${pinId}`;

interface SmartTerminalPair {
  microbit: PlacedComponent;
  expansionBoard: PlacedComponent;
}

const createSmartTerminalComponent = ({ microbit, expansionBoard }: SmartTerminalPair): PlacedComponent => ({
  ...expansionBoard,
  definitionId: smartTerminalDefinition.id,
  state: {
    powered: expansionBoard.state?.powered ?? microbit.state?.powered ?? true,
    active: expansionBoard.state?.active ?? microbit.state?.active ?? false,
    ...expansionBoard.state,
    fault: Boolean(expansionBoard.state?.fault || microbit.state?.fault),
    faultType: expansionBoard.state?.faultType || microbit.state?.faultType,
    faultMessage: expansionBoard.state?.faultMessage || microbit.state?.faultMessage,
    error: expansionBoard.state?.error || microbit.state?.error,
  },
});

const isSmartTerminalInternalConnection = (connection: Connection, pairs: SmartTerminalPair[]) =>
  pairs.some(({ microbit, expansionBoard }) => {
    const fromMicrobitToExpansion =
      connection.fromComponent === microbit.instanceId &&
      connection.toComponent === expansionBoard.instanceId;
    const fromExpansionToMicrobit =
      connection.fromComponent === expansionBoard.instanceId &&
      connection.toComponent === microbit.instanceId;

    return fromMicrobitToExpansion || fromExpansionToMicrobit;
  });

const clamp = (value: number, min: number, max: number) => {
  if (max < min) return (min + max) / 2;
  return Math.min(max, Math.max(min, value));
};

const getComponentCenter = (component: PlacedComponent, definition: ComponentDefinition) => ({
  x: component.position.x + definition.width / 2,
  y: component.position.y + definition.height / 2,
});

const inferPinSide = (pin: Pin, definition: ComponentDefinition): PinSide => {
  const distances = [
    { side: 'top' as const, distance: pin.position.y },
    { side: 'right' as const, distance: definition.width - pin.position.x },
    { side: 'bottom' as const, distance: definition.height - pin.position.y },
    { side: 'left' as const, distance: pin.position.x },
  ];

  return distances.reduce((nearest, current) =>
    current.distance < nearest.distance ? current : nearest
  ).side;
};

const chooseDockSide = (
  component: PlacedComponent,
  definition: ComponentDefinition,
  peerComponent: PlacedComponent,
  peerDefinition: ComponentDefinition
): PinSide => {
  const center = getComponentCenter(component, definition);
  const peerCenter = getComponentCenter(peerComponent, peerDefinition);
  const dx = peerCenter.x - center.x;
  const dy = peerCenter.y - center.y;

  if (Math.abs(dx) > Math.abs(dy)) {
    return dx >= 0 ? 'right' : 'left';
  }

  return dy >= 0 ? 'bottom' : 'top';
};

const projectPinToSide = (pin: Pin, definition: ComponentDefinition, side: PinSide) => {
  const horizontalMargin = Math.min(PIN_EDGE_MARGIN, definition.width / 2);
  const verticalMargin = Math.min(PIN_EDGE_MARGIN, definition.height / 2);
  const originalSide = inferPinSide(pin, definition);
  const projectedX =
    originalSide === 'left' || originalSide === 'right'
      ? (pin.position.y / definition.height) * definition.width
      : pin.position.x;
  const projectedY =
    originalSide === 'top' || originalSide === 'bottom'
      ? (pin.position.x / definition.width) * definition.height
      : pin.position.y;

  switch (side) {
    case 'top':
      return {
        x: clamp(projectedX, horizontalMargin, definition.width - horizontalMargin),
        y: 0,
      };
    case 'right':
      return {
        x: definition.width,
        y: clamp(projectedY, verticalMargin, definition.height - verticalMargin),
      };
    case 'bottom':
      return {
        x: clamp(projectedX, horizontalMargin, definition.width - horizontalMargin),
        y: definition.height,
      };
    case 'left':
    default:
      return {
        x: 0,
        y: clamp(projectedY, verticalMargin, definition.height - verticalMargin),
      };
  }
};

const getPinLabelStyle = (side: PinSide, zoom: number): CSSProperties => {
  switch (side) {
    case 'top':
      return { left: '50%', top: -22 * zoom, transform: 'translateX(-50%)' };
    case 'right':
      return { left: 12 * zoom, top: '50%', transform: 'translateY(-50%)' };
    case 'bottom':
      return { left: '50%', top: 12 * zoom, transform: 'translateX(-50%)' };
    case 'left':
    default:
      return { left: -12 * zoom, top: '50%', transform: 'translate(-100%, -50%)' };
  }
};

// 连接成功音效
const playConnectionSound = (success: boolean) => {
  try {
    const AudioContextClass =
      window.AudioContext ||
      (window as Window & { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!AudioContextClass) return;
    const audioContext = new AudioContextClass();
    const oscillator = audioContext.createOscillator();
    const gainNode = audioContext.createGain();
    
    oscillator.connect(gainNode);
    gainNode.connect(audioContext.destination);
    
    if (success) {
      // 成功音效 - 上升音调
      oscillator.frequency.setValueAtTime(440, audioContext.currentTime);
      oscillator.frequency.setValueAtTime(660, audioContext.currentTime + 0.1);
      gainNode.gain.setValueAtTime(0.3, audioContext.currentTime);
      gainNode.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + 0.2);
    } else {
      // 失败音效 - 下降音调
      oscillator.frequency.setValueAtTime(330, audioContext.currentTime);
      oscillator.frequency.setValueAtTime(220, audioContext.currentTime + 0.1);
      gainNode.gain.setValueAtTime(0.3, audioContext.currentTime);
      gainNode.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + 0.2);
    }
    
    oscillator.start(audioContext.currentTime);
    oscillator.stop(audioContext.currentTime + 0.2);
  } catch {
    // 忽略音频错误
  }
};

export function SimulatorCanvas() {
  const canvasRef = useRef<HTMLDivElement>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [draggedComponent, setDraggedComponent] = useState<string | null>(null);
  const [dragOffset, setDragOffset] = useState({ x: 0, y: 0 });
  const [showConnectionFeedback, setShowConnectionFeedback] = useState(false);
  
  // 画布拖拽平移状态
  const [isPanning, setIsPanning] = useState(false);
  const [panStart, setPanStart] = useState({ x: 0, y: 0 });
  const [initialPan, setInitialPan] = useState({ x: 0, y: 0 });
  
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
    lastConnectionResult,
    detailsVisible,
    addComponent,
    addSmartTerminal,
    updateComponentPosition,
    selectComponent,
    startConnection,
    updateTempConnection,
    completeConnection,
    cancelConnection,
    clearConnectionResult,
    optimizeLayout,
    toggleDetailsVisible,
    setZoom,
    setPan,
  } = useSimulatorStore(
    useShallow((state) => ({
      zoom: state.zoom,
      pan: state.pan,
      gridEnabled: state.gridEnabled,
      placedComponents: state.placedComponents,
      connections: state.connections,
      selectedComponentId: state.selectedComponentId,
      isDrawingConnection: state.isDrawingConnection,
      connectionStart: state.connectionStart,
      tempConnectionEnd: state.tempConnectionEnd,
      lastConnectionResult: state.lastConnectionResult,
      detailsVisible: state.detailsVisible,
      addComponent: state.addComponent,
      addSmartTerminal: state.addSmartTerminal,
      updateComponentPosition: state.updateComponentPosition,
      selectComponent: state.selectComponent,
      startConnection: state.startConnection,
      updateTempConnection: state.updateTempConnection,
      completeConnection: state.completeConnection,
      cancelConnection: state.cancelConnection,
      clearConnectionResult: state.clearConnectionResult,
      optimizeLayout: state.optimizeLayout,
      toggleDetailsVisible: state.toggleDetailsVisible,
      setZoom: state.setZoom,
      setPan: state.setPan,
    }))
  );

  const definitionById = useMemo(
    () => new Map([...componentDefinitions, smartTerminalDefinition].map((definition) => [definition.id, definition])),
    []
  );
  const pinsByDefinitionId = useMemo(() => {
    const map = new Map<string, Map<string, Pin>>();
    [...componentDefinitions, smartTerminalDefinition].forEach((definition) => {
      map.set(definition.id, new Map(definition.pins.map((pin) => [pin.id, pin])));
    });
    return map;
  }, []);
  const smartTerminalPairs = useMemo<SmartTerminalPair[]>(() => {
    if (detailsVisible) return [];

    const microbits = placedComponents.filter((component) => component.definitionId === 'microbit');
    const expansionBoards = placedComponents.filter((component) => component.definitionId === 'expansion-board');
    const pairCount = Math.min(microbits.length, expansionBoards.length);

    return Array.from({ length: pairCount }, (_, index) => ({
      microbit: microbits[index],
      expansionBoard: expansionBoards[index],
    }));
  }, [detailsVisible, placedComponents]);
  const collapsedMicrobitIds = useMemo(
    () => new Set(smartTerminalPairs.map((pair) => pair.microbit.instanceId)),
    [smartTerminalPairs]
  );
  const renderedComponents = useMemo(() => {
    if (detailsVisible || smartTerminalPairs.length === 0) {
      return placedComponents;
    }

    const pairByExpansionId = new Map(
      smartTerminalPairs.map((pair) => [pair.expansionBoard.instanceId, pair])
    );

    return placedComponents.flatMap((component) => {
      if (collapsedMicrobitIds.has(component.instanceId)) {
        return [];
      }

      const pair = pairByExpansionId.get(component.instanceId);
      if (pair) {
        return [createSmartTerminalComponent(pair)];
      }

      return [component];
    });
  }, [collapsedMicrobitIds, detailsVisible, placedComponents, smartTerminalPairs]);
  const connectionPlacedById = useMemo(() => {
    const map = new Map(placedComponents.map((component) => [component.instanceId, component]));

    smartTerminalPairs.forEach((pair) => {
      map.set(pair.expansionBoard.instanceId, createSmartTerminalComponent(pair));
    });

    return map;
  }, [placedComponents, smartTerminalPairs]);
  const visibleConnections = useMemo(
    () =>
      connections.filter((connection) => {
        if (detailsVisible) return true;
        if (isPowerConnection(connection)) return false;
        if (isSmartTerminalInternalConnection(connection, smartTerminalPairs)) return false;

        return !collapsedMicrobitIds.has(connection.fromComponent) && !collapsedMicrobitIds.has(connection.toComponent);
      }),
    [collapsedMicrobitIds, connections, detailsVisible, smartTerminalPairs]
  );
  const connectionPeerByPin = useMemo(() => {
    const map = new Map<string, string>();

    visibleConnections.forEach((connection) => {
      const fromKey = pinKey(connection.fromComponent, connection.fromPin);
      const toKey = pinKey(connection.toComponent, connection.toPin);

      if (!map.has(fromKey) || !isPowerConnection(connection)) {
        map.set(fromKey, connection.toComponent);
      }

      if (!map.has(toKey) || !isPowerConnection(connection)) {
        map.set(toKey, connection.fromComponent);
      }
    });

    return map;
  }, [visibleConnections]);
  
  // 监听连接结果并显示反馈
  useEffect(() => {
    if (lastConnectionResult) {
      playConnectionSound(lastConnectionResult.success);
      setShowConnectionFeedback(true);
      const timer = setTimeout(() => {
        setShowConnectionFeedback(false);
        clearConnectionResult();
      }, 2000);
      return () => clearTimeout(timer);
    }
  }, [lastConnectionResult, clearConnectionResult]);

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

      if (definition.id === 'smart-terminal') {
        addSmartTerminal({ x: snappedX, y: snappedY });
        return;
      }

      const newComponent: PlacedComponent = {
        instanceId: createId(),
        definitionId: definition.id,
        position: { x: snappedX, y: snappedY },
        state: {
          powered: isInitiallyPowered(definition.id),
          active: false,
        },
      };

      addComponent(newComponent);
    },
    [addComponent, addSmartTerminal, pan, zoom, gridEnabled]
  );

  const handleDragOver = useCallback((e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'copy';
  }, []);

  // 处理组件拖拽 - 标准 mousedown/mouseup 模式
  const handleComponentMouseDown = useCallback(
    (e: React.MouseEvent, instanceId: string, component: PlacedComponent) => {
      e.stopPropagation();
      e.preventDefault();
      
      selectComponent(instanceId);
      
      // 仅左键触发拖拽
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

  // 画布平移 - 鼠标按下（左键在空白处拖拽）
  const handleCanvasMouseDown = useCallback(
    (e: React.MouseEvent) => {
      // 检查是否点击在画布空白处（不是组件上）
      const target = e.target as HTMLElement;
      const isCanvasBackground = target === canvasRef.current || target.classList.contains('canvas-grid');
      
      // 左键在空白处拖拽画布
      if (e.button === 0 && isCanvasBackground && !isDrawingConnection) {
        e.preventDefault();
        setIsPanning(true);
        setPanStart({ x: e.clientX, y: e.clientY });
        setInitialPan({ x: pan.x, y: pan.y });
      }
    },
    [pan, isDrawingConnection]
  );

  const handleMouseMove = useCallback(
    (e: React.MouseEvent) => {
      // 画布平移
      if (isPanning) {
        const deltaX = e.clientX - panStart.x;
        const deltaY = e.clientY - panStart.y;
        setPan({
          x: initialPan.x + deltaX,
          y: initialPan.y + deltaY,
        });
        return;
      }
      
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
    [isPanning, panStart, initialPan, setPan, isDragging, draggedComponent, dragOffset, pan, zoom, gridEnabled, updateComponentPosition, isDrawingConnection, updateTempConnection]
  );

  const handleMouseUp = useCallback(() => {
    setIsDragging(false);
    setDraggedComponent(null);
    setIsPanning(false);
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

  // 点击画布空白处：取消连线、取消选择
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

  // 滚轮缩放和平移
  const handleWheel = useCallback(
    (e: React.WheelEvent) => {
      if (e.ctrlKey || e.metaKey) {
        // Ctrl + 滚轮 = 缩放
        e.preventDefault();
        const delta = e.deltaY > 0 ? -0.1 : 0.1;
        setZoom(zoom + delta);
      } else {
        // 普通滚轮 = 平移画布（支持上下左右）
        e.preventDefault();
        setPan({
          x: pan.x - e.deltaX,
          y: pan.y - e.deltaY,
        });
      }
    },
    [zoom, setZoom, pan, setPan]
  );

  const getPinLocalLayout: GetPinLayout = useCallback(
    (component, definition, pin) => {
      const peerComponentId = connectionPeerByPin.get(pinKey(component.instanceId, pin.id));
      const peerComponent = peerComponentId ? connectionPlacedById.get(peerComponentId) : null;
      const peerDefinition = peerComponent ? definitionById.get(peerComponent.definitionId) : null;
      const side = peerComponent && peerDefinition
        ? chooseDockSide(component, definition, peerComponent, peerDefinition)
        : inferPinSide(pin, definition);

      return {
        position: peerComponent ? projectPinToSide(pin, definition, side) : pin.position,
        side,
      };
    },
    [connectionPeerByPin, connectionPlacedById, definitionById]
  );

  // 获取引脚的绝对位置
  const getPinPosition = (component: PlacedComponent, definition: ComponentDefinition, pin: Pin) => {
    const layout = getPinLocalLayout(component, definition, pin);

    return {
      x: component.position.x + layout.position.x,
      y: component.position.y + layout.position.y,
    };
  };

  // 获取连线的引脚位置
  const getConnectionPoints = (connection: Connection) => {
    const fromComponent = connectionPlacedById.get(connection.fromComponent);
    const toComponent = connectionPlacedById.get(connection.toComponent);
    
    if (!fromComponent || !toComponent) return null;
    
    const fromDef = definitionById.get(fromComponent.definitionId);
    const toDef = definitionById.get(toComponent.definitionId);
    
    if (!fromDef || !toDef) return null;
    
    const fromPin = pinsByDefinitionId.get(fromDef.id)?.get(connection.fromPin);
    const toPin = pinsByDefinitionId.get(toDef.id)?.get(connection.toPin);
    
    if (!fromPin || !toPin) return null;
    
    return {
      from: getPinPosition(fromComponent, fromDef, fromPin),
      to: getPinPosition(toComponent, toDef, toPin),
    };
  };

  // 获取连线颜色 - 基于有效性（绿色=正确，红色=错误）
  const getConnectionColorByValidity = (valid: boolean) => {
    return valid ? '#22c55e' : '#ef4444'; // 绿色表示正确，红色表示错误
  };
  
  // 判断是否为无线连接
  const isWirelessConnection = (type: string) => type === 'wireless';

  return (
    <div
      ref={canvasRef}
      className={cn(
        "relative w-full h-full bg-muted/30 overflow-hidden",
        isPanning && "cursor-grabbing"
      )}
      onDrop={handleDrop}
      onDragOver={handleDragOver}
      onClick={handleCanvasClick}
      onMouseDown={handleCanvasMouseDown}
      onMouseMove={handleMouseMove}
      onMouseUp={handleMouseUp}
      onMouseLeave={handleMouseUp}
      onWheel={handleWheel}
    >
      {/* 网格背景 - z-0 */}
      {gridEnabled && (
        <div
          className="canvas-grid absolute inset-0 pointer-events-none z-0"
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

      <div className="absolute right-4 top-4 z-40 flex flex-wrap justify-end gap-2">
        <button
          type="button"
          onClick={optimizeLayout}
          className="inline-flex items-center gap-1.5 rounded-md border border-border bg-card px-3 py-2 text-xs font-medium text-foreground shadow-sm transition hover:bg-muted"
          title="按数据流顺序重新排布画布组件"
        >
          <LayoutGrid className="h-4 w-4" />
          一键优化布局
        </button>
        <button
          type="button"
          onClick={toggleDetailsVisible}
          className="inline-flex items-center gap-1.5 rounded-md border border-border bg-card px-3 py-2 text-xs font-medium text-foreground shadow-sm transition hover:bg-muted"
          title={detailsVisible ? '隐藏智能终端内部结构、VCC/GND 引脚、电源线和手动运行细节' : '显示智能终端内部结构、VCC/GND 引脚、电源线和手动运行细节'}
        >
          {detailsVisible ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
          {detailsVisible ? '隐藏细节' : '显示细节'}
        </button>
      </div>

      {/* SVG 连线层 - z-20 确保在组件之上，使用 viewBox 支持负坐标 */}
      <svg
        className="absolute pointer-events-none z-20"
        style={{
          left: pan.x - 5000,
          top: pan.y - 5000,
          width: '10000px',
          height: '10000px',
          transform: `scale(${zoom})`,
          transformOrigin: '5000px 5000px',
        }}
        viewBox="-5000 -5000 10000 10000"
      >
        {/* SVG Filters for glow effect */}
        <defs>
          <filter id="glow" x="-50%" y="-50%" width="200%" height="200%">
            <feGaussianBlur stdDeviation="3" result="coloredBlur"/>
            <feMerge>
              <feMergeNode in="coloredBlur"/>
              <feMergeNode in="SourceGraphic"/>
            </feMerge>
          </filter>
        </defs>
        {/* 已完成的连线 - 超增强可视化 */}
        {visibleConnections.map((connection) => {
          const points = getConnectionPoints(connection);
          if (!points) {
            console.warn('无法获取连线端点:', connection.id, connection.fromComponent, connection.fromPin, '->', connection.toComponent, connection.toPin);
            return null;
          }
          
          const color = getConnectionColorByValidity(connection.valid);
          const isWireless = isWirelessConnection(connection.type);
          
          // 计算连线长度用于动画时长
          const length = Math.sqrt(Math.pow(points.to.x - points.from.x, 2) + Math.pow(points.to.y - points.from.y, 2));
          const animDuration = Math.max(0.8, Math.min(2, length / 150));
          
          // 无线连接使用虚线样式
          const strokeDasharray = isWireless ? "12,8" : undefined;
          
          return (
            <g key={connection.id}>
              {/* 外层光晕效果 - 更宽更亮 */}
              <line
                x1={points.from.x}
                y1={points.from.y}
                x2={points.to.x}
                y2={points.to.y}
                stroke={color}
                strokeWidth={10}
                strokeLinecap="round"
                opacity={0.1}
                filter="url(#glow)"
                strokeDasharray={isWireless ? "14,10" : undefined}
              />
              {/* 中层阴影 */}
              <line
                x1={points.from.x}
                y1={points.from.y}
                x2={points.to.x}
                y2={points.to.y}
                stroke={color}
                strokeWidth={6}
                strokeLinecap="round"
                opacity={0.2}
                strokeDasharray={isWireless ? "10,8" : undefined}
              />
              {/* 主连线 - 更粗，无线连接用虚线 */}
              <line
                x1={points.from.x}
                y1={points.from.y}
                x2={points.to.x}
                y2={points.to.y}
                stroke={color}
                strokeWidth={3}
                strokeLinecap="round"
                strokeDasharray={strokeDasharray}
              />
              {/* 连线高光 */}
              <line
                x1={points.from.x}
                y1={points.from.y}
                x2={points.to.x}
                y2={points.to.y}
                stroke="#ffffff"
                strokeWidth={1}
                strokeLinecap="round"
                opacity={0.35}
                strokeDasharray={strokeDasharray}
              />
              {/* 连线端点圆圈 - 无线连接用wifi信号图标样式 */}
              {isWireless ? (
                <>
                  {/* 无线信号图标 - 起点 */}
                  <circle cx={points.from.x} cy={points.from.y} r={9} fill={color} stroke="#fff" strokeWidth={1.5} opacity={0.25} />
                  <circle cx={points.from.x} cy={points.from.y} r={6} fill={color} stroke="#fff" strokeWidth={1.5} opacity={0.45} />
                  <circle cx={points.from.x} cy={points.from.y} r={4} fill={color} stroke="#fff" strokeWidth={1.5} />
                  {/* 无线信号图标 - 终点 */}
                  <circle cx={points.to.x} cy={points.to.y} r={9} fill={color} stroke="#fff" strokeWidth={1.5} opacity={0.25} />
                  <circle cx={points.to.x} cy={points.to.y} r={6} fill={color} stroke="#fff" strokeWidth={1.5} opacity={0.45} />
                  <circle cx={points.to.x} cy={points.to.y} r={4} fill={color} stroke="#fff" strokeWidth={1.5} />
                </>
              ) : (
                <>
                  <circle cx={points.from.x} cy={points.from.y} r={7} fill={color} stroke="#fff" strokeWidth={2} />
                  <circle cx={points.to.x} cy={points.to.y} r={7} fill={color} stroke="#fff" strokeWidth={2} />
                </>
              )}
              {/* 连线不再显示类型标签：引脚端点已经标注 VCC/GND/DATA，隐藏连线文字可降低课堂投屏噪声 */}
              {/* 数据流动画 - 双层动画效果，无线连接用波浪扩散效果 */}
              {isWireless ? (
                <>
                  {/* 无线信号波动画 */}
                  <circle r={6} fill={color} opacity={0.8}>
                    <animateMotion
                      dur={`${animDuration * 0.8}s`}
                      repeatCount="indefinite"
                      path={`M${points.from.x},${points.from.y} L${points.to.x},${points.to.y}`}
                    />
                    <animate attributeName="r" values="4;8;4" dur="0.5s" repeatCount="indefinite" />
                    <animate attributeName="opacity" values="0.9;0.4;0.9" dur="0.5s" repeatCount="indefinite" />
                  </circle>
                </>
              ) : (
                <>
                  <circle r={7} fill="#ffffff" opacity={0.9}>
                    <animateMotion
                      dur={`${animDuration}s`}
                      repeatCount="indefinite"
                      path={`M${points.from.x},${points.from.y} L${points.to.x},${points.to.y}`}
                    />
                  </circle>
                  <circle r={4} fill={color}>
                    <animateMotion
                      dur={`${animDuration}s`}
                      repeatCount="indefinite"
                      path={`M${points.from.x},${points.from.y} L${points.to.x},${points.to.y}`}
                    />
                  </circle>
                </>
              )}
            </g>
          );
        })}
        
        {/* 正在绘制的连线 */}
        {isDrawingConnection && connectionStart && tempConnectionEnd && (() => {
          const fromComponent = connectionPlacedById.get(connectionStart.componentId);
          if (!fromComponent) return null;
          
          const fromDef = definitionById.get(fromComponent.definitionId);
          if (!fromDef) return null;
          
          const fromPin = pinsByDefinitionId.get(fromDef.id)?.get(connectionStart.pinId);
          if (!fromPin) return null;
          
          const fromPos = getPinPosition(fromComponent, fromDef, fromPin);
          
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
      {renderedComponents.map((component) => {
        const definition = definitionById.get(component.definitionId);
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
            showPowerPins={detailsVisible}
            zoom={zoom}
            pan={pan}
            getPinLayout={getPinLocalLayout}
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

      {/* 供电说明浮窗 - 可折叠 */}
      {detailsVisible && <PowerGuidePanel />}
      
      {/* 连接成功/失败反馈 */}
      {showConnectionFeedback && lastConnectionResult && (
        <div 
          className={cn(
            "absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2",
            "flex items-center gap-3 px-6 py-4 rounded-xl shadow-2xl z-50",
            "animate-scale-in",
            lastConnectionResult.success 
              ? "bg-green-500 text-white" 
              : "bg-red-500 text-white"
          )}
        >
          {lastConnectionResult.success ? (
            <CheckCircle2 className="w-8 h-8" />
          ) : (
            <XCircle className="w-8 h-8" />
          )}
          <div>
            <p className="font-bold text-lg">{lastConnectionResult.message}</p>
            {lastConnectionResult.success && (
              <p className="text-sm opacity-90">连线已建立</p>
            )}
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
  showPowerPins: boolean;
  zoom: number;
  pan: { x: number; y: number };
  getPinLayout: GetPinLayout;
}

function CanvasComponent({
  component,
  definition,
  isSelected,
  onMouseDown,
  onPinClick,
  isDrawingConnection,
  showPowerPins,
  zoom,
  pan,
  getPinLayout,
}: CanvasComponentProps) {
  const isFaulty = component.state?.fault === true;
  const visiblePins = showPowerPins ? definition.pins : definition.pins.filter((pin) => !isPowerPin(pin));

  // 计算基础 z-index：
  // - 细节模式中扩展板（较大底板）放在最底层，避免遮挡插入其上的 micro:bit / 传感器等
  // - 默认模式中智能终端作为合并组件显示在常规组件层
  // - micro:bit、传感器、执行器、IOT 模块等贴片组件抬升一层，保证可见
  // - 选中时再次抬升到最上层
  const layerZIndex = (() => {
    if (definition.id === 'expansion-board') return 5;
    if (definition.id === 'smart-terminal') return 12;
    if (definition.id === 'microbit') return 20;
    return 10;
  })();

  return (
    <div
      className={cn(
        "absolute cursor-move select-none",
        "rounded-lg border-2 bg-card shadow-md transition-shadow",
        isSelected
          ? "border-primary shadow-lg ring-2 ring-primary/20"
          : isFaulty
            ? "border-destructive shadow-destructive/20"
            : "border-border hover:border-muted-foreground"
      )}
      style={{
        left: component.position.x * zoom + pan.x,
        top: component.position.y * zoom + pan.y,
        width: definition.width * zoom,
        height: definition.height * zoom,
        zIndex: isSelected ? 100 : layerZIndex,
        overflow: 'visible',
      }}
      onMouseDown={onMouseDown}
    >
      {/* 组件可视化内容 */}
      <div className={cn("w-full h-full overflow-hidden rounded-md pointer-events-none", isFaulty && "opacity-50 grayscale")}>
        <ComponentVisual type={definition.type} label={definition.name} state={component.state} />
      </div>

      {isFaulty && (
        <div
          className="absolute right-1 top-1 rounded-sm border border-destructive/30 bg-destructive px-1.5 py-0.5 text-[10px] font-medium text-destructive-foreground shadow-sm"
          title={component.state?.faultMessage || '组件故障'}
        >
          故障
        </div>
      )}

      {visiblePins.map((pin) => {
        const pinLayout = getPinLayout(component, definition, pin);

        return (
        <div
          key={pin.id}
          className="absolute z-20"
          style={{
            left: pinLayout.position.x * zoom,
            top: pinLayout.position.y * zoom,
          }}
        >
          {/* 引脚圆点 */}
          <div
            className={cn(
              "rounded-full border-2 cursor-pointer transition-all",
              "flex items-center justify-center",
              "-translate-x-1/2 -translate-y-1/2",
              getPinColor(pin.type),
              isDrawingConnection && "animate-pulse hover:scale-150 hover:shadow-lg"
            )}
            style={{
              width: 18 * zoom,
              height: 18 * zoom,
            }}
            onMouseDown={(e) => {
              e.stopPropagation();
            }}
            onClick={(e) => {
              e.stopPropagation();
              e.preventDefault();
              onPinClick(e, component.instanceId, pin.id);
            }}
            title={`${pin.name} (${pin.type})`}
          />
          {/* 引脚名称标签 - 始终显示 */}
          <div
            className="absolute pointer-events-none whitespace-nowrap"
            style={getPinLabelStyle(pinLayout.side, zoom)}
          >
            <span
              className="px-1 py-0.5 rounded text-xs font-bold bg-card border border-border shadow-sm"
              style={{ 
                fontSize: Math.max(9, 10 * zoom),
                color: getPinLabelColor(pin.type),
              }}
            >
              {pin.name}
            </span>
          </div>
        </div>
        );
      })}
    </div>
  );
}

function getPinColor(type: string) {
  switch (type) {
    case 'power':
      return 'bg-red-500 border-red-700 shadow-red-500/50 shadow-md';
    case 'ground':
      return 'bg-gray-800 border-gray-900 shadow-gray-800/50 shadow-md';
    case 'serial_tx':
      return 'bg-green-500 border-green-700 shadow-green-500/50 shadow-md';
    case 'serial_rx':
      return 'bg-green-400 border-green-600 shadow-green-400/50 shadow-md';
    case 'usb':
      return 'bg-purple-500 border-purple-700 shadow-purple-500/50 shadow-md';
    case 'analog':
      return 'bg-yellow-500 border-yellow-700 shadow-yellow-500/50 shadow-md';
    case 'digital':
      return 'bg-blue-500 border-blue-700 shadow-blue-500/50 shadow-md';
    case 'data':
      return 'bg-cyan-500 border-cyan-700 shadow-cyan-500/50 shadow-md';
    default:
      return 'bg-blue-400 border-blue-600 shadow-blue-400/50 shadow-md';
  }
}

function getPinLabelColor(type: string) {
  switch (type) {
    case 'power':
      return '#ef4444';
    case 'ground':
      return '#374151';
    case 'serial_tx':
      return '#22c55e';
    case 'serial_rx':
      return '#4ade80';
    case 'usb':
      return '#a855f7';
    case 'analog':
      return '#eab308';
    case 'digital':
      return '#3b82f6';
    case 'data':
      return '#06b6d4';
    default:
      return '#60a5fa';
  }
}

function ComponentName({ label, tone = 'slate' }: { label: string; tone?: 'slate' | 'light' | 'dark' | 'blue' | 'green' | 'orange' }) {
  const toneClass = {
    slate: 'text-slate-800',
    light: 'text-white',
    dark: 'text-slate-900',
    blue: 'text-blue-900',
    green: 'text-green-50',
    orange: 'text-orange-900',
  }[tone];

  return (
    <div className={cn("w-full px-1 text-center text-[11px] font-semibold leading-tight tracking-tight break-keep", toneClass)}>
      {label}
    </div>
  );
}

function ComponentVisual({ type, label, state }: { type: string; label: string; state?: PlacedComponent['state'] }) {
  switch (type) {
    case 'smart-terminal':
      return (
        <div className="relative h-full w-full overflow-hidden rounded bg-emerald-900">
          <div className="absolute inset-x-5 top-6 h-16 rounded-lg border border-emerald-300/40 bg-emerald-700/40" />
          <div className="absolute left-8 top-10 grid grid-cols-5 gap-1">
            {Array.from({ length: 25 }).map((_, i) => (
              <div
                key={i}
                className={cn(
                  "h-2.5 w-2.5 rounded-[3px]",
                  state?.ledMatrix?.[Math.floor(i / 5)]?.[i % 5]
                    ? "bg-red-400 shadow-red-400/40 shadow-sm"
                    : "bg-emerald-200/25"
                )}
              />
            ))}
          </div>
          <div className="absolute right-8 top-12 flex gap-4">
            <div className="flex h-7 w-7 items-center justify-center rounded-full border border-slate-500 bg-slate-800 text-[9px] font-bold text-white">
              A
            </div>
            <div className="flex h-7 w-7 items-center justify-center rounded-full border border-slate-500 bg-slate-800 text-[9px] font-bold text-white">
              B
            </div>
          </div>
          <div className="absolute inset-x-0 top-[105px] flex items-center justify-center">
            <ComponentName label={label} tone="green" />
          </div>
          <div className="absolute inset-x-8 bottom-5 h-8 rounded-md border border-emerald-300/30 bg-emerald-950/30" />
        </div>
      );

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
          <ComponentName label={label} />
        </div>
      );
    
    case 'expansion-board':
      return (
        <div className="w-full h-full bg-green-800 rounded flex items-center justify-center">
          <ComponentName label={label} tone="green" />
        </div>
      );
    
    case 'temp-humidity-sensor':
      return (
        <div className="w-full h-full flex flex-col items-center justify-center gap-0.5 bg-blue-100 rounded px-1">
          <ComponentName label={label} tone="blue" />
          <span className="text-sm font-bold text-blue-800">DHT</span>
        </div>
      );
    
    case 'light-sensor':
      return (
        <div className="w-full h-full flex flex-col items-center justify-center gap-0.5 bg-yellow-100 rounded px-1">
          <ComponentName label={label} tone="orange" />
          <span className="text-sm font-bold text-yellow-800">LUX</span>
        </div>
      );
    
    case 'led-strip':
      return (
        <div className="w-full h-full flex flex-col items-center justify-center gap-1 bg-gray-900 rounded px-2">
          <ComponentName label={label} tone="light" />
          <div className="flex items-center justify-center gap-1">
            {[0, 1, 2, 3, 4].map((i) => (
              <div
                key={i}
                className={cn(
                  "w-3.5 h-3.5 rounded-full",
                  state?.active
                    ? ["bg-red-500", "bg-green-500", "bg-blue-500", "bg-yellow-500", "bg-purple-500"][i]
                    : "bg-gray-700"
                )}
              />
            ))}
          </div>
        </div>
      );
    
    case 'buzzer': {
      const alarming = Boolean(state?.active);
      return (
        <div
          className={cn(
            "w-full h-full flex flex-col items-center justify-center gap-0.5 rounded px-1 transition-colors duration-200",
            alarming
              ? "bg-red-500 text-white shadow-inner"
              : "bg-gray-200 text-gray-800"
          )}
        >
          <ComponentName label={label} tone={alarming ? "light" : "slate"} />
          <span className={cn("text-[10px] font-bold", alarming ? "text-white" : "text-gray-700")}>
            {alarming ? "报警中" : "静默"}
          </span>
        </div>
      );
    }
    
    case 'iot-module':
    case 'obloq':
      return (
        <div className="w-full h-full flex flex-col items-center justify-center gap-0.5 bg-blue-600 rounded px-1">
          <ComponentName label={label} tone="light" />
          <span className="text-white text-xs font-bold">IOT</span>
        </div>
      );
    
    case 'router':
      return (
        <div className="w-full h-full flex flex-col items-center justify-center gap-0.5 bg-gray-100 rounded px-1">
          <ComponentName label={label} />
          <span className="text-[10px] font-bold text-gray-700">WIFI</span>
        </div>
      );
    
    case 'pc-computer':
      return (
        <div className="w-full h-full flex flex-col items-center justify-center gap-0.5 bg-blue-100 rounded px-1">
          <ComponentName label={label} tone="blue" />
          <span className="text-sm font-bold text-blue-800">PC</span>
        </div>
      );
    
    case 'web-server':
      return (
        <div className="w-full h-full flex flex-col items-center justify-center gap-0.5 bg-gray-800 rounded px-1">
          <ComponentName label={label} tone="light" />
          <span className="text-sm font-bold text-gray-100">API</span>
        </div>
      );
    
    case 'database':
      return (
        <div className="w-full h-full flex flex-col items-center justify-center gap-0.5 bg-orange-100 rounded px-1">
          <ComponentName label={label} tone="orange" />
          <span className="text-sm font-bold text-orange-800">DB</span>
        </div>
      );
    
    case 'browser':
      return (
        <div className="w-full h-full flex flex-col items-center justify-center gap-0.5 bg-sky-100 rounded px-1">
          <ComponentName label={label} tone="blue" />
          <span className="text-sm font-bold text-sky-800">WEB</span>
        </div>
      );

    case 'mobile-client':
      return (
        <div className="w-full h-full flex flex-col items-center justify-center gap-0.5 rounded-2xl border-4 border-slate-800 bg-slate-100 px-1">
          <ComponentName label={label} />
          <span className="text-sm font-bold text-slate-800">APP</span>
        </div>
      );
    
    default:
      return (
        <div className="w-full h-full flex items-center justify-center">
          <ComponentName label={label} />
        </div>
      );
  }
}

// 可折叠的供电说明面板
function PowerGuidePanel() {
  const [isExpanded, setIsExpanded] = useState(false);

  return (
    <div className="absolute top-4 left-4 bg-card border border-border rounded-lg shadow-lg max-w-xs text-sm z-50">
      {/* 标题栏 - 可点击折叠 */}
      <button
        onClick={() => setIsExpanded(!isExpanded)}
        className="w-full flex items-center justify-between p-3 hover:bg-muted/50 rounded-lg transition-colors"
      >
        <div className="flex items-center gap-2">
          <Zap className="w-4 h-4 text-red-500" />
          <span className="font-semibold text-foreground">供电连接说明</span>
        </div>
        {isExpanded ? (
          <ChevronDown className="w-4 h-4 text-muted-foreground" />
        ) : (
          <ChevronRight className="w-4 h-4 text-muted-foreground" />
        )}
      </button>
      
      {/* 可折叠内容 */}
      {isExpanded && (
        <div className="px-3 pb-3 border-t border-border">
          <ul className="space-y-2 text-muted-foreground text-xs mt-2">
            <li className="flex items-start gap-2">
              <span className="w-1.5 h-1.5 rounded-full bg-purple-500 mt-1.5 flex-shrink-0"></span>
              <span><b className="text-foreground">智能终端细节</b>: 展开后可看到 micro:bit 与扩展板的内部连接</span>
            </li>
            <li className="flex items-start gap-2">
              <span className="w-1.5 h-1.5 rounded-full bg-red-500 mt-1.5 flex-shrink-0"></span>
              <span><b className="text-foreground">内部供电</b>: micro:bit 的 <span className="text-red-500 font-medium">3V</span>/<span className="text-gray-500 font-medium">GND</span> 连接到扩展板插槽</span>
            </li>
            <li className="flex items-start gap-2">
              <span className="w-1.5 h-1.5 rounded-full bg-yellow-500 mt-1.5 flex-shrink-0"></span>
              <span><b className="text-foreground">传感器</b>: 连接 <span className="text-red-500 font-medium">VCC</span> 到智能终端 3V，<span className="text-gray-500 font-medium">GND</span> 到智能终端 GND</span>
            </li>
            <li className="flex items-start gap-2">
              <span className="w-1.5 h-1.5 rounded-full bg-green-500 mt-1.5 flex-shrink-0"></span>
              <span><b className="text-foreground">IOT模块</b>: 连接 <span className="text-red-500 font-medium">VCC</span>/<span className="text-gray-500 font-medium">GND</span>，并保持与智能终端的通信引脚连接</span>
            </li>
          </ul>
          <div className="mt-3 p-2 bg-muted/50 rounded text-xs text-muted-foreground">
            <b>提示</b>：课堂排查重点是传感器 DATA、蜂鸣器 IO、网络、服务器与数据库链路。
          </div>
        </div>
      )}
    </div>
  );
}
