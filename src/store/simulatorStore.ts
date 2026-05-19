import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { 
  PlacedComponent, 
  Connection, 
  DatabaseState, 
  RouterConfig, 
  ServerConfig,
  LogEntry 
} from '@/types/simulator';
import { createId } from '@/lib/utils';
import { validateConnection } from '@/lib/connectionValidator';
import { componentDefinitions } from '@/data/componentDefinitions';
import {
  classroomDatabase,
  classroomFlaskCode,
  classroomRouterConfig,
  classroomServerConfig,
  classroomStarterMicrobitCode,
} from '@/data/classroomLesson';

export interface BrowserPageRecord {
  id: number;
  sensor_id: number;
  value: number;
  alarm?: number;
  timestamp: string;
}

interface SimulatorStore {
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
  tempConnectionEnd: { x: number; y: number } | null;
  
  // 运行状态
  isRunning: boolean;
  simulationSpeed: number;
  
  // 代码状态
  microbitCode: string;
  flaskCode: string;
  codeMode: 'blocks' | 'python';
  codeBurned: boolean;
  
  // 数据库状态
  database: DatabaseState;
  
  // 网络状态
  routerConfig: RouterConfig;
  serverConfig: ServerConfig;
  
  // 日志
  logs: LogEntry[];
  
  // 连接反馈
  lastConnectionResult: { success: boolean; message: string; type: string } | null;
  
  // 仿真状态 - 全局共享
  sensorValues: Record<string, number>;
  autoFluctuation: boolean;
  demoSweepActive: boolean;

  // 模拟浏览器状态
  browserUrl: string;
  browserResponse: string;
  browserPageRecords: BrowserPageRecord[] | null;
  browserLastUpdate: number | null;
  browserAutoRefresh: boolean;

  // 课堂细节显示
  detailsVisible: boolean;
  
  // Actions
  setZoom: (zoom: number) => void;
  setPan: (pan: { x: number; y: number }) => void;
  toggleGrid: () => void;
  
  addComponent: (component: PlacedComponent) => void;
  addSmartTerminal: (position: { x: number; y: number }) => void;
  removeComponent: (instanceId: string) => void;
  updateComponentPosition: (instanceId: string, position: { x: number; y: number }) => void;
  optimizeLayout: () => void;
  updateComponentState: (instanceId: string, nextState: Partial<NonNullable<PlacedComponent['state']>>) => void;
  setComponentFault: (
    instanceId: string,
    fault: boolean,
    faultType?: NonNullable<PlacedComponent['state']>['faultType'],
    faultMessage?: string
  ) => void;
  selectComponent: (instanceId: string | null) => void;
  
  startConnection: (componentId: string, pinId: string) => void;
  updateTempConnection: (position: { x: number; y: number }) => void;
  completeConnection: (toComponentId: string, toPinId: string) => void;
  cancelConnection: () => void;
  removeConnection: (connectionId: string) => void;
  
  setRunning: (running: boolean) => void;
  setSimulationSpeed: (speed: number) => void;
  
  setMicrobitCode: (code: string) => void;
  setFlaskCode: (code: string) => void;
  setCodeMode: (mode: 'blocks' | 'python') => void;
  burnCode: () => void;
  
  updateDatabase: (database: DatabaseState) => void;
  updateRouterConfig: (config: Partial<RouterConfig>) => void;
  updateServerConfig: (config: Partial<ServerConfig>) => void;
  
  addLog: (log: Omit<LogEntry, 'timestamp'>) => void;
  clearLogs: () => void;
  clearConnectionResult: () => void;
  
  setSensorValue: (instanceId: string, value: number) => void;
  setSensorValues: (values: Record<string, number>) => void;
  setAutoFluctuation: (enabled: boolean) => void;
  setDemoSweepActive: (active: boolean) => void;
  setBrowserUrl: (url: string) => void;
  setBrowserResponse: (response: string) => void;
  setBrowserPageRecords: (records: BrowserPageRecord[] | null) => void;
  setBrowserLastUpdate: (timestamp: number | null) => void;
  setBrowserAutoRefresh: (enabled: boolean) => void;
  toggleDetailsVisible: () => void;
  resetBrowserState: () => void;
  
  resetSimulator: () => void;
  loadScenario: (scenario: {
    components: PlacedComponent[];
    connections: Connection[];
    microbitCode: string;
    flaskCode: string;
    database: DatabaseState;
    routerConfig: RouterConfig;
    serverConfig: ServerConfig;
  }) => void;
}

const defaultMicrobitCode = classroomStarterMicrobitCode;
const defaultFlaskCode = classroomFlaskCode;

function recoverPersistedCodeState(state: Partial<SimulatorStore> | null | undefined) {
  const nextState = { ...(state || {}) };
  if (typeof nextState.microbitCode !== 'string' || nextState.microbitCode.trim().length === 0) {
    nextState.microbitCode = defaultMicrobitCode;
  }
  if (typeof nextState.flaskCode !== 'string' || nextState.flaskCode.trim().length === 0) {
    nextState.flaskCode = defaultFlaskCode;
  }
  if (!nextState.routerConfig?.password) {
    nextState.routerConfig = {
      ...createClassroomRouterConfig(),
      ...(nextState.routerConfig || {}),
      password: classroomRouterConfig.password,
    };
  }
  nextState.serverConfig = {
    ...createClassroomServerConfig(),
    ...(nextState.serverConfig || {}),
    routes: (nextState.serverConfig?.routes || createClassroomServerConfig().routes).map((route) => ({ ...route })),
    logs: nextState.serverConfig?.logs || [],
    running: typeof nextState.flaskCode === 'string' && nextState.flaskCode.trim().length > 0,
  };
  nextState.codeBurned = typeof nextState.microbitCode === 'string' && nextState.microbitCode.trim().length > 0;
  nextState.codeMode = 'python';
  nextState.detailsVisible = false;
  return nextState;
}

function cloneClassroomDatabase() {
  return JSON.parse(JSON.stringify(classroomDatabase));
}

function createClassroomRouterConfig() {
  return {
    ...classroomRouterConfig,
    connectedDevices: [...classroomRouterConfig.connectedDevices],
  };
}

function createClassroomServerConfig() {
  return {
    ...classroomServerConfig,
    running: true,
    routes: classroomServerConfig.routes.map((route) => ({ ...route })),
    logs: [],
  };
}

const initialState = {
  zoom: 1,
  pan: { x: 0, y: 0 },
  gridEnabled: true,
  placedComponents: [],
  connections: [],
  selectedComponentId: null,
  isDrawingConnection: false,
  connectionStart: null,
  tempConnectionEnd: null,
  isRunning: false,
  simulationSpeed: 1,
  microbitCode: defaultMicrobitCode,
  flaskCode: defaultFlaskCode,
  codeMode: 'python' as const,
  codeBurned: true,
  database: cloneClassroomDatabase(),
  routerConfig: createClassroomRouterConfig(),
  serverConfig: createClassroomServerConfig(),
  logs: [],
  lastConnectionResult: null,
  sensorValues: {},
  autoFluctuation: true,
  demoSweepActive: false,
  browserUrl: '',
  browserResponse: '',
  browserPageRecords: null,
  browserLastUpdate: null,
  browserAutoRefresh: true,
  detailsVisible: false,
};

function syncFlaskCodeServerAddress(code: string, serverConfig: ServerConfig) {
  let nextCode = code;
  if (nextCode.includes("app.run(")) {
    nextCode = nextCode.replace(/app\.run\(host=['\"][^'\"]*['\"],\s*port=\d+\)/, `app.run(host='${serverConfig.ip}', port=${serverConfig.port})`);
  }
  return nextCode;
}

const EXPANSION_POWER_PINS = ['3v-out1', '3v-out2', '3v-out3', '3v-out4'];
const EXPANSION_GROUND_PINS = ['gnd-out1', 'gnd-out2', 'gnd-out3', 'gnd-out4'];
const EXPANSION_SENSOR_SIGNAL_PINS = ['p1', 'p0', 'p3', 'p4', 'p5', 'p13', 'p14'];
const EXPANSION_ACTUATOR_SIGNAL_PINS = ['p2', 'p3', 'p4', 'p5', 'p0', 'p13', 'p14'];
const SMART_TERMINAL_MICROBIT_OFFSET = { x: 60, y: -175 };

function isPinOccupied(connections: Connection[], componentId: string, pinId: string) {
  return connections.some(
    (connection) =>
      (connection.fromComponent === componentId && connection.fromPin === pinId) ||
      (connection.toComponent === componentId && connection.toPin === pinId)
  );
}

const optimizedLayoutPositions: Record<string, { x: number; y: number }> = {
  'pc-computer': { x: 75, y: 105 },
  microbit: { x: 310, y: 85 },
  'expansion-board': { x: 250, y: 260 },
  'temp-humidity-sensor': { x: 80, y: 330 },
  'light-sensor': { x: 85, y: 435 },
  'sound-sensor': { x: 85, y: 535 },
  'infrared-sensor': { x: 83, y: 638 },
  buzzer: { x: 365, y: 515 },
  'led-strip': { x: 330, y: 610 },
  servo: { x: 355, y: 708 },
  relay: { x: 360, y: 800 },
  'iot-module': { x: 635, y: 325 },
  obloq: { x: 635, y: 325 },
  router: { x: 800, y: 325 },
  'web-server': { x: 965, y: 315 },
  database: { x: 985, y: 505 },
  browser: { x: 1135, y: 325 },
  'mobile-client': { x: 1145, y: 490 },
};

const componentDimensionsById = new Map(
  componentDefinitions.map((definition) => [
    definition.id,
    { width: definition.width, height: definition.height },
  ])
);

const layoutColumns = {
  classroomInput: 120,
  smartTerminal: 390,
  iot: 680,
  router: 850,
  server: 1020,
  client: 1180,
} as const;

const layoutRows = {
  top: 150,
  main: 360,
  stack1: 462,
  stack2: 562,
  stack3: 662,
  stack4: 540,
  stack5: 630,
  stack6: 730,
  stack7: 832,
} as const;

const optimizedLayoutSlots: Record<string, { centerX: number; centerY: number }> = {
  'pc-computer': { centerX: layoutColumns.classroomInput, centerY: layoutRows.top },
  microbit: { centerX: layoutColumns.smartTerminal, centerY: layoutRows.top },
  'expansion-board': { centerX: layoutColumns.smartTerminal, centerY: layoutRows.main },
  'temp-humidity-sensor': { centerX: layoutColumns.classroomInput, centerY: layoutRows.main },
  'light-sensor': { centerX: layoutColumns.classroomInput, centerY: layoutRows.stack1 },
  'sound-sensor': { centerX: layoutColumns.classroomInput, centerY: layoutRows.stack2 },
  'infrared-sensor': { centerX: layoutColumns.classroomInput, centerY: layoutRows.stack3 },
  buzzer: { centerX: layoutColumns.smartTerminal, centerY: layoutRows.stack4 },
  'led-strip': { centerX: layoutColumns.smartTerminal, centerY: layoutRows.stack5 },
  servo: { centerX: layoutColumns.smartTerminal, centerY: layoutRows.stack6 },
  relay: { centerX: layoutColumns.smartTerminal, centerY: layoutRows.stack7 },
  'iot-module': { centerX: layoutColumns.iot, centerY: layoutRows.main },
  obloq: { centerX: layoutColumns.iot, centerY: layoutRows.main },
  router: { centerX: layoutColumns.router, centerY: layoutRows.main },
  'web-server': { centerX: layoutColumns.server, centerY: layoutRows.main },
  database: { centerX: layoutColumns.server, centerY: layoutRows.stack4 },
  browser: { centerX: layoutColumns.client, centerY: layoutRows.main },
  'mobile-client': { centerX: layoutColumns.client, centerY: layoutRows.stack4 },
};

function getPositionFromCenter(definitionId: string, centerX: number, centerY: number) {
  const dimensions = componentDimensionsById.get(definitionId) ?? { width: 90, height: 70 };

  return {
    x: Math.round(centerX - dimensions.width / 2),
    y: Math.round(centerY - dimensions.height / 2),
  };
}

function getOptimizedPosition(component: PlacedComponent, duplicateIndex: number) {
  const slot = optimizedLayoutSlots[component.definitionId];
  const base = slot
    ? getPositionFromCenter(component.definitionId, slot.centerX, slot.centerY)
    : optimizedLayoutPositions[component.definitionId] ?? {
        x: 120 + (duplicateIndex % 4) * 150,
        y: 620 + Math.floor(duplicateIndex / 4) * 110,
      };

  if (duplicateIndex === 0) return base;

  return {
    x: base.x,
    y: base.y + duplicateIndex * 96,
  };
}

export const useSimulatorStore = create<SimulatorStore>()(
  persist(
    (set, get) => ({
      ...initialState,
      
      setZoom: (zoom) => set({ zoom: Math.max(0.25, Math.min(2, zoom)) }),
      setPan: (pan) => set({ pan }),
      toggleGrid: () => set((state) => ({ gridEnabled: !state.gridEnabled })),
      
      addComponent: (component) => {
        const state = get();
        const newComponents = [...state.placedComponents, component];
        const microbit = newComponents.find(c => c.definitionId === 'microbit');
        const expansionBoard = newComponents.find(c => c.definitionId === 'expansion-board');
        const pendingConnections: Connection[] = [];
        const autoMessages: string[] = [];

        const isIotDefinition = (definitionId: string) =>
          definitionId === 'iot-module' || definitionId === 'obloq';

        const findFirstComponent = (definitionIds: string[]) =>
          newComponents.find((candidate) => definitionIds.includes(candidate.definitionId));

        const hasExactConnection = (
          fromComponent: string,
          fromPin: string,
          toComponent: string,
          toPin: string
        ) =>
          [...state.connections, ...pendingConnections].some(
            (c) =>
              (c.fromComponent === fromComponent &&
                c.fromPin === fromPin &&
                c.toComponent === toComponent &&
                c.toPin === toPin) ||
              (c.fromComponent === toComponent &&
                c.fromPin === toPin &&
                c.toComponent === fromComponent &&
                c.toPin === fromPin)
          );

        const activeConnections = () => [...state.connections, ...pendingConnections];

        const hasPinConnection = (componentId: string, pinId: string) =>
          isPinOccupied(activeConnections(), componentId, pinId);

        const findAvailablePin = (componentId: string, pinIds: string[]) =>
          pinIds.find((pinId) => !hasPinConnection(componentId, pinId));

        const pushAutoConnection = (
          fromComponent: string,
          fromPin: string,
          toComponent: string,
          toPin: string,
          type: Connection['type']
        ) => {
          if (hasExactConnection(fromComponent, fromPin, toComponent, toPin)) {
            return false;
          }

          if (hasPinConnection(fromComponent, fromPin) || hasPinConnection(toComponent, toPin)) {
            return false;
          }

          pendingConnections.push({
            id: createId(),
            fromComponent,
            fromPin,
            toComponent,
            toPin,
            type,
            valid: true,
          });

          return true;
        };

        if (microbit && expansionBoard) {
          const beforeCount = pendingConnections.length;
          pushAutoConnection(microbit.instanceId, 'p0', expansionBoard.instanceId, 'slot-p0', 'data');
          pushAutoConnection(microbit.instanceId, 'p1', expansionBoard.instanceId, 'slot-p1', 'data');
          pushAutoConnection(microbit.instanceId, 'p2', expansionBoard.instanceId, 'slot-p2', 'data');
          pushAutoConnection(microbit.instanceId, '3v', expansionBoard.instanceId, 'slot-3v', 'power');
          pushAutoConnection(microbit.instanceId, 'gnd', expansionBoard.instanceId, 'slot-gnd', 'ground');
          if (pendingConnections.length > beforeCount) {
            autoMessages.push('智能终端内部连接已建立');
          }
        }

        if (expansionBoard) {
          const iotComponents = newComponents.filter((c) => isIotDefinition(c.definitionId));
          let autoConnectedIotCount = 0;

          iotComponents.forEach((iot) => {
            const beforeCount = pendingConnections.length;
            if (hasPinConnection(iot.instanceId, 'tx') || hasPinConnection(iot.instanceId, 'rx')) {
              return;
            }

            const powerPin = findAvailablePin(expansionBoard.instanceId, ['3v-out2', ...EXPANSION_POWER_PINS]);
            const groundPin = findAvailablePin(expansionBoard.instanceId, ['gnd-out2', ...EXPANSION_GROUND_PINS]);

            if (
              !powerPin ||
              !groundPin ||
              hasPinConnection(expansionBoard.instanceId, 'p15') ||
              hasPinConnection(expansionBoard.instanceId, 'p16')
            ) {
              return;
            }

            pushAutoConnection(iot.instanceId, 'vcc', expansionBoard.instanceId, powerPin, 'power');
            pushAutoConnection(iot.instanceId, 'gnd', expansionBoard.instanceId, groundPin, 'ground');
            pushAutoConnection(iot.instanceId, 'tx', expansionBoard.instanceId, 'p15', 'serial');
            pushAutoConnection(iot.instanceId, 'rx', expansionBoard.instanceId, 'p16', 'serial');
            if (pendingConnections.length > beforeCount) {
              autoConnectedIotCount += 1;
            }
          });

          if (autoConnectedIotCount === 1) {
            autoMessages.push('IOT模块已自动连接到智能终端(P15/P16)');
          } else if (autoConnectedIotCount > 1) {
            autoMessages.push(`已自动连接 ${autoConnectedIotCount} 个IOT模块到智能终端(P15/P16)`);
          }
        }

        if (expansionBoard) {
          const sensorMappings: Record<string, { signalPin: string; expansionPins: string[] }> = {
            'temp-humidity-sensor': { signalPin: 'data', expansionPins: EXPANSION_SENSOR_SIGNAL_PINS },
            'light-sensor': { signalPin: 'ao', expansionPins: ['p0', 'p3', 'p4', 'p5', 'p13', 'p14', 'p1'] },
            'sound-sensor': { signalPin: 'ao', expansionPins: ['p3', 'p4', 'p5', 'p13', 'p14', 'p0', 'p1'] },
            'infrared-sensor': { signalPin: 'out', expansionPins: ['p4', 'p5', 'p13', 'p14', 'p3', 'p0', 'p1'] },
          };

          const sensorComponents = newComponents.filter((candidate) => sensorMappings[candidate.definitionId]);
          let autoConnectedSensorCount = 0;

          sensorComponents.forEach((sensor) => {
            const mapping = sensorMappings[sensor.definitionId];
            const beforeCount = pendingConnections.length;
            if (hasPinConnection(sensor.instanceId, mapping.signalPin)) {
              return;
            }

            const powerPin = findAvailablePin(expansionBoard.instanceId, EXPANSION_POWER_PINS);
            const groundPin = findAvailablePin(expansionBoard.instanceId, EXPANSION_GROUND_PINS);
            const expansionPin = findAvailablePin(expansionBoard.instanceId, mapping.expansionPins);

            if (!powerPin || !groundPin || !expansionPin) {
              return;
            }

            pushAutoConnection(sensor.instanceId, 'vcc', expansionBoard.instanceId, powerPin, 'power');
            pushAutoConnection(sensor.instanceId, 'gnd', expansionBoard.instanceId, groundPin, 'ground');
            pushAutoConnection(sensor.instanceId, mapping.signalPin, expansionBoard.instanceId, expansionPin, 'data');
            if (pendingConnections.length > beforeCount) {
              autoConnectedSensorCount += 1;
            }
          });

          if (autoConnectedSensorCount > 0) {
            autoMessages.push(`已自动连接 ${autoConnectedSensorCount} 个传感器到智能终端空闲引脚`);
          }

          const actuatorMappings: Record<string, { signalPin: string; expansionPins: string[] }> = {
            buzzer: { signalPin: 'io', expansionPins: EXPANSION_ACTUATOR_SIGNAL_PINS },
            'led-strip': { signalPin: 'din', expansionPins: ['p3', 'p4', 'p5', 'p13', 'p14', 'p2', 'p0'] },
            servo: { signalPin: 'signal', expansionPins: ['p4', 'p5', 'p13', 'p14', 'p3', 'p2', 'p0'] },
            relay: { signalPin: 'in', expansionPins: ['p5', 'p13', 'p14', 'p4', 'p3', 'p2', 'p0'] },
          };

          const actuatorComponents = newComponents.filter((candidate) => actuatorMappings[candidate.definitionId]);
          let autoConnectedActuatorCount = 0;

          actuatorComponents.forEach((actuator) => {
            const mapping = actuatorMappings[actuator.definitionId];
            const beforeCount = pendingConnections.length;
            if (hasPinConnection(actuator.instanceId, mapping.signalPin)) {
              return;
            }

            const powerPin = findAvailablePin(expansionBoard.instanceId, ['3v-out3', ...EXPANSION_POWER_PINS]);
            const groundPin = findAvailablePin(expansionBoard.instanceId, ['gnd-out3', ...EXPANSION_GROUND_PINS]);
            const expansionPin = findAvailablePin(expansionBoard.instanceId, mapping.expansionPins);

            if (!powerPin || !groundPin || !expansionPin) {
              return;
            }

            pushAutoConnection(actuator.instanceId, 'vcc', expansionBoard.instanceId, powerPin, 'power');
            pushAutoConnection(actuator.instanceId, 'gnd', expansionBoard.instanceId, groundPin, 'ground');
            pushAutoConnection(actuator.instanceId, mapping.signalPin, expansionBoard.instanceId, expansionPin, 'data');
            if (pendingConnections.length > beforeCount) {
              autoConnectedActuatorCount += 1;
            }
          });

          if (autoConnectedActuatorCount > 0) {
            autoMessages.push(`已自动连接 ${autoConnectedActuatorCount} 个执行器到智能终端空闲引脚`);
          }
        }

        const router = findFirstComponent(['router']);
        const webServer = findFirstComponent(['web-server']);
        const database = findFirstComponent(['database']);

        if (router) {
          const iotComponents = newComponents.filter((c) => isIotDefinition(c.definitionId));
          let autoConnectedWirelessCount = 0;

          iotComponents.forEach((iot) => {
            const beforeCount = pendingConnections.length;
            pushAutoConnection(iot.instanceId, 'wifi', router.instanceId, 'wifi', 'wireless');
            if (pendingConnections.length > beforeCount) {
              autoConnectedWirelessCount += 1;
            }
          });

          if (autoConnectedWirelessCount > 0) {
            autoMessages.push('IoT 模块已自动接入 WiFi 路由器');
          }
        }

        if (router && webServer) {
          const beforeCount = pendingConnections.length;
          pushAutoConnection(router.instanceId, 'lan', webServer.instanceId, 'network', 'data');
          if (pendingConnections.length > beforeCount) {
            autoMessages.push('WiFi 路由器已自动连接 Flask 服务器');
          }
        }

        if (webServer && database) {
          const beforeCount = pendingConnections.length;
          pushAutoConnection(webServer.instanceId, 'db', database.instanceId, 'connection', 'data');
          if (pendingConnections.length > beforeCount) {
            autoMessages.push('Flask 服务器已自动连接 SQLite 数据库');
          }
        }

        if (pendingConnections.length > 0) {
          const feedbackType =
            pendingConnections.find((connection) => connection.type === 'serial')?.type ??
            pendingConnections[0].type;

          set({
            placedComponents: newComponents,
            connections: [...state.connections, ...pendingConnections],
            lastConnectionResult: {
              success: true,
              message: autoMessages.join('；'),
              type: feedbackType,
            },
          });
          return;
        }

        set({ placedComponents: newComponents });
      },

      addSmartTerminal: (position) => {
        const microbit: PlacedComponent = {
          instanceId: createId(),
          definitionId: 'microbit',
          position: {
            x: position.x + SMART_TERMINAL_MICROBIT_OFFSET.x,
            y: position.y + SMART_TERMINAL_MICROBIT_OFFSET.y,
          },
          state: { powered: true, active: false },
        };

        const expansionBoard: PlacedComponent = {
          instanceId: createId(),
          definitionId: 'expansion-board',
          position,
          state: { powered: true, active: false },
        };

        get().addComponent(microbit);
        get().addComponent(expansionBoard);
      },
      
      removeComponent: (instanceId) => {
        const state = get();
        const componentToRemove = state.placedComponents.find(c => c.instanceId === instanceId);
        
        if (!componentToRemove) return;

        const smartTerminalPartner = !state.detailsVisible && componentToRemove.definitionId === 'expansion-board'
          ? state.placedComponents.find((component) => component.definitionId === 'microbit')
          : null;
        const removeIds = new Set([
          instanceId,
          ...(smartTerminalPartner ? [smartTerminalPartner.instanceId] : []),
        ]);
        
        const removedConnections = state.connections.filter(
          (conn) => removeIds.has(conn.fromComponent) || removeIds.has(conn.toComponent)
        );
        const remainingConnections = state.connections.filter(
          (conn) => !removeIds.has(conn.fromComponent) && !removeIds.has(conn.toComponent)
        );
        
        // 生成移除提示
        let message = '';
        if (smartTerminalPartner) {
          message = '智能终端已移除，相关连接已断开';
        } else if (componentToRemove.definitionId === 'microbit') {
          message = '智能终端中的 micro:bit 已移除，内部连接已断开';
        } else if (componentToRemove.definitionId === 'expansion-board') {
          message = '智能终端中的扩展板已移除，所有连接已断开';
        } else if (removedConnections.length > 0) {
          message = `组件已移除，${removedConnections.length} 条连线已自动断开`;
        }
        
        set({
          placedComponents: state.placedComponents.filter((c) => !removeIds.has(c.instanceId)),
          connections: remainingConnections,
          selectedComponentId: state.selectedComponentId && removeIds.has(state.selectedComponentId) ? null : state.selectedComponentId,
          lastConnectionResult: message ? {
            success: true,
            message,
            type: 'data',
          } : null,
        });
      },
      
      updateComponentPosition: (instanceId, position) => set((state) => {
        const component = state.placedComponents.find((candidate) => candidate.instanceId === instanceId);
        if (!component) {
          return {};
        }

        if (!state.detailsVisible && component.definitionId === 'expansion-board') {
          const microbit = state.placedComponents.find((candidate) => candidate.definitionId === 'microbit');
          if (microbit) {
            const deltaX = position.x - component.position.x;
            const deltaY = position.y - component.position.y;

            return {
              placedComponents: state.placedComponents.map((candidate) => {
                if (candidate.instanceId === instanceId) {
                  return { ...candidate, position };
                }

                if (candidate.instanceId === microbit.instanceId) {
                  return {
                    ...candidate,
                    position: {
                      x: candidate.position.x + deltaX,
                      y: candidate.position.y + deltaY,
                    },
                  };
                }

                return candidate;
              }),
            };
          }
        }

        return {
          placedComponents: state.placedComponents.map((c) =>
            c.instanceId === instanceId ? { ...c, position } : c
          ),
        };
      }),

      optimizeLayout: () => set((state) => {
        const seenByDefinition = new Map<string, number>();

        return {
          placedComponents: state.placedComponents.map((component) => {
            const duplicateIndex = seenByDefinition.get(component.definitionId) ?? 0;
            seenByDefinition.set(component.definitionId, duplicateIndex + 1);

            return {
              ...component,
              position: getOptimizedPosition(component, duplicateIndex),
            };
          }),
          zoom: 0.82,
          pan: { x: 40, y: 30 },
          selectedComponentId: null,
          lastConnectionResult: {
            success: true,
            message: '已按课堂最清晰链路重新排列画布',
            type: 'data',
          },
        };
      }),

      updateComponentState: (instanceId, nextState) => set((state) => ({
        placedComponents: state.placedComponents.map((component) =>
          component.instanceId === instanceId
            ? {
                ...component,
                state: {
                  powered: component.state?.powered ?? false,
                  active: component.state?.active ?? false,
                  ...component.state,
                  ...nextState,
                },
              }
            : component
        ),
      })),

      setComponentFault: (instanceId, fault, faultType, faultMessage) => set((state) => ({
        placedComponents: state.placedComponents.map((component) =>
          component.instanceId === instanceId
            ? {
                ...component,
                state: {
                  powered: component.state?.powered ?? false,
                  active: component.state?.active ?? false,
                  ...component.state,
                  fault,
                  faultType: fault ? faultType : undefined,
                  faultMessage: fault ? faultMessage : undefined,
                  error: fault ? faultMessage : undefined,
                },
              }
            : component
        ),
        lastConnectionResult: {
          success: !fault,
          message: fault ? (faultMessage || '组件已设置为故障状态') : '组件故障已解除',
          type: fault ? 'error' : 'data',
        },
      })),
      
      selectComponent: (instanceId) => set({ selectedComponentId: instanceId }),
      
      startConnection: (componentId, pinId) => set({
        isDrawingConnection: true,
        connectionStart: { componentId, pinId },
      }),
      
      updateTempConnection: (position) => set({ tempConnectionEnd: position }),
      
      completeConnection: (toComponentId, toPinId) => {
        const state = get();
        if (!state.connectionStart) return;
        
        const { componentId: fromComponentId, pinId: fromPinId } = state.connectionStart;
        
        // 检查是否已存在相同连接
        const exists = state.connections.some(
          (c) =>
            (c.fromComponent === fromComponentId && c.fromPin === fromPinId &&
             c.toComponent === toComponentId && c.toPin === toPinId) ||
            (c.fromComponent === toComponentId && c.fromPin === toPinId &&
             c.toComponent === fromComponentId && c.toPin === fromPinId)
        );
        
        if (exists || fromComponentId === toComponentId) {
          set({
            isDrawingConnection: false,
            connectionStart: null,
            tempConnectionEnd: null,
            lastConnectionResult: { 
              success: false, 
              message: exists ? '连接已存在' : '不能连接到同一组件',
              type: 'error'
            },
          });
          return;
        }
        
        const validation = validateConnection(
          fromComponentId,
          fromPinId,
          toComponentId,
          toPinId,
          state.placedComponents,
          state.connections
        );

        if (!validation.valid) {
          set({
            isDrawingConnection: false,
            connectionStart: null,
            tempConnectionEnd: null,
            lastConnectionResult: {
              success: false,
              message: validation.errors[0] || '连接不符合规则',
              type: 'error',
            },
          });
          return;
        }

        const connectionType = validation.type;
        const connectionLabels: Record<Connection['type'], string> = {
          power: '电源(VCC/3V)',
          ground: '接地(GND)',
          data: '数据',
          serial: 'IoT通信',
          wireless: 'WiFi',
        };
        const connectionLabel = connectionLabels[connectionType];
        
        const newConnection: Connection = {
          id: createId(),
          fromComponent: fromComponentId,
          fromPin: fromPinId,
          toComponent: toComponentId,
          toPin: toPinId,
          type: connectionType,
          valid: true,
        };
        
        set((state) => ({
          connections: [...state.connections, newConnection],
          isDrawingConnection: false,
          connectionStart: null,
          tempConnectionEnd: null,
          lastConnectionResult: {
            success: true,
            message: `${connectionLabel}连接成功`,
            type: connectionType,
          },
        }));
      },
      
      cancelConnection: () => set({
        isDrawingConnection: false,
        connectionStart: null,
        tempConnectionEnd: null,
      }),
      
      removeConnection: (connectionId) => set((state) => ({
        connections: state.connections.filter((c) => c.id !== connectionId),
      })),
      
      setRunning: (running) => set({ isRunning: running }),
      setSimulationSpeed: (speed) => set({ simulationSpeed: speed }),
      
      setMicrobitCode: (code) => set({ microbitCode: code, codeBurned: code.trim().length > 0 }),
      setFlaskCode: (code) => set((state) => ({
        flaskCode: code,
        serverConfig: {
          ...state.serverConfig,
          running: code.trim().length > 0,
        },
      })),
      setCodeMode: (mode) => set({ codeMode: mode }),
      burnCode: () => set({ codeBurned: true }),
      
      updateDatabase: (database) => set({ database }),
      updateRouterConfig: (config) => set((state) => ({
        routerConfig: { ...state.routerConfig, ...config },
      })),
      updateServerConfig: (config) => set((state) => {
        const nextServerConfig = { ...state.serverConfig, ...config };
        return {
          serverConfig: nextServerConfig,
          flaskCode: syncFlaskCodeServerAddress(state.flaskCode, nextServerConfig),
        };
      }),
      
      addLog: (log) => set((state) => ({
        logs: [...state.logs, { ...log, timestamp: Date.now() }].slice(-100),
      })),
      clearLogs: () => set({ logs: [] }),
      clearConnectionResult: () => set({ lastConnectionResult: null }),
      
      setSensorValue: (instanceId, value) => set((state) => ({
        sensorValues: { ...state.sensorValues, [instanceId]: value },
      })),
      setSensorValues: (values) => set({ sensorValues: values }),
      setAutoFluctuation: (enabled) => set({ autoFluctuation: enabled }),
      setDemoSweepActive: (active) => set({ demoSweepActive: active }),
      setBrowserUrl: (url) => set({ browserUrl: url }),
      setBrowserResponse: (response) => set({ browserResponse: response }),
      setBrowserPageRecords: (records) => set({ browserPageRecords: records }),
      setBrowserLastUpdate: (timestamp) => set({ browserLastUpdate: timestamp }),
      setBrowserAutoRefresh: (enabled) => set({ browserAutoRefresh: enabled }),
      toggleDetailsVisible: () => set((state) => ({ detailsVisible: !state.detailsVisible })),
      resetBrowserState: () => set({
        browserUrl: initialState.browserUrl,
        browserResponse: initialState.browserResponse,
        browserPageRecords: initialState.browserPageRecords,
        browserLastUpdate: initialState.browserLastUpdate,
        browserAutoRefresh: initialState.browserAutoRefresh,
      }),
      
      resetSimulator: () => set({
        ...initialState,
        microbitCode: defaultMicrobitCode,
        flaskCode: defaultFlaskCode,
        database: cloneClassroomDatabase(),
        routerConfig: createClassroomRouterConfig(),
        serverConfig: createClassroomServerConfig(),
      }),
      
      loadScenario: (scenario) => set({
        placedComponents: scenario.components,
        connections: scenario.connections,
        microbitCode: scenario.microbitCode,
        flaskCode: scenario.flaskCode,
        database: JSON.parse(JSON.stringify(scenario.database)),
        routerConfig: {
          ...scenario.routerConfig,
          connectedDevices: [...scenario.routerConfig.connectedDevices],
        },
        serverConfig: {
          ...scenario.serverConfig,
          running: scenario.flaskCode.trim().length > 0 || scenario.serverConfig.running,
          routes: scenario.serverConfig.routes.map((route) => ({ ...route })),
          logs: [],
        },
        selectedComponentId: null,
        isRunning: false,
        codeBurned: scenario.microbitCode.trim().length > 0,
        sensorValues: {},
        browserUrl: '',
        browserResponse: '',
        browserPageRecords: null,
        browserLastUpdate: null,
        browserAutoRefresh: true,
        detailsVisible: false,
      }),
    }),
    {
      name: 'simulator-storage',
      version: 4,
      migrate: (persistedState, version) => {
        let state = persistedState as Partial<SimulatorStore>;
        if (version < 2 && state?.routerConfig) {
          state = {
            ...state,
            routerConfig: {
              ...state.routerConfig,
              password: '',
            },
          };
        }
        if (version < 3) {
          state = {
            ...state,
            microbitCode: defaultMicrobitCode,
            flaskCode: defaultFlaskCode,
            database: cloneClassroomDatabase(),
            routerConfig: createClassroomRouterConfig(),
            serverConfig: createClassroomServerConfig(),
          };
        }
        return recoverPersistedCodeState(state) as SimulatorStore;
      },
      merge: (persistedState, currentState) => ({
        ...currentState,
        ...recoverPersistedCodeState(persistedState as Partial<SimulatorStore>),
      }),
      partialize: (state) => ({
        placedComponents: state.placedComponents,
        connections: state.connections,
        microbitCode: state.microbitCode,
        flaskCode: state.flaskCode,
        database: state.database,
        routerConfig: state.routerConfig,
        serverConfig: state.serverConfig,
      }),
    }
  )
);
