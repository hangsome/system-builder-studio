// 组件类型定义
export type ComponentCategory = 'mainboard' | 'sensor' | 'actuator' | 'network' | 'server';

export interface Pin {
  id: string;
  name: string;
  type: 'power' | 'ground' | 'digital' | 'analog' | 'serial_tx' | 'serial_rx' | 'usb' | 'data';
  position: { x: number; y: number }; // 相对于组件的位置
  connected?: boolean;
}

export interface ComponentDefinition {
  id: string;
  type: string;
  category: ComponentCategory;
  name: string;
  description: string;
  width: number;
  height: number;
  pins: Pin[];
  icon?: string;
}

export interface PlacedComponent {
  instanceId: string;
  definitionId: string;
  position: { x: number; y: number };
  rotation?: number;
  properties?: Record<string, unknown>;
  state?: ComponentState;
}

export interface ComponentState {
  powered: boolean;
  active: boolean;
  value?: number | string;
  ledMatrix?: boolean[][]; // 5x5 for micro:bit
  error?: string;
}

export interface Connection {
  id: string;
  fromComponent: string;
  fromPin: string;
  toComponent: string;
  toPin: string;
  type: 'power' | 'ground' | 'data' | 'serial';
  valid: boolean;
}

export interface SimulatorState {
  // 画布状态
  zoom: number;
  pan: { x: number; y: number };
  gridEnabled: boolean;
  
  // 组件状态
  placedComponents: PlacedComponent[];
  connections: Connection[];
  selectedComponentId: string | null;
  
  // 连线状态
  isDrawingConnection: boolean;
  connectionStart: { componentId: string; pinId: string } | null;
  
  // 运行状态
  isRunning: boolean;
  simulationSpeed: number;
  
  // 代码状态
  microbitCode: string;
  flaskCode: string;
  codeMode: 'blocks' | 'python';
  
  // 数据库状态
  database: DatabaseState;
  
  // 网络状态
  routerConfig: RouterConfig;
  serverConfig: ServerConfig;
}

export interface DatabaseState {
  tables: DatabaseTable[];
  records: Record<string, unknown[]>;
}

export interface DatabaseTable {
  name: string;
  columns: { name: string; type: string; primaryKey?: boolean }[];
}

export interface RouterConfig {
  ssid: string;
  password: string;
  ip: string;
  connectedDevices: string[];
}

export interface ServerConfig {
  ip: string;
  port: number;
  running: boolean;
  routes: { path: string; method: string; handler: string }[];
  logs: LogEntry[];
}

export interface LogEntry {
  timestamp: Date;
  type: 'info' | 'warning' | 'error' | 'data';
  message: string;
  source: string;
}

// 预设场景
export interface Scenario {
  id: string;
  name: string;
  description: string;
  components: PlacedComponent[];
  connections: Connection[];
  microbitCode: string;
  flaskCode: string;
  database: DatabaseState;
  routerConfig: RouterConfig;
  serverConfig: ServerConfig;
}
