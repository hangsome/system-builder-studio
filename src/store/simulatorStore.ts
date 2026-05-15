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
  
  // Actions
  setZoom: (zoom: number) => void;
  setPan: (pan: { x: number; y: number }) => void;
  toggleGrid: () => void;
  
  addComponent: (component: PlacedComponent) => void;
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
  if (!nextState.routerConfig?.password) {
    nextState.routerConfig = {
      ...createClassroomRouterConfig(),
      ...(nextState.routerConfig || {}),
      password: classroomRouterConfig.password,
    };
  }
  nextState.codeMode = 'python';
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
  codeBurned: false,
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
};

function syncFlaskCodeServerAddress(code: string, serverConfig: ServerConfig) {
  let nextCode = code;
  if (nextCode.includes("app.run(")) {
    nextCode = nextCode.replace(/app\.run\(host=['\"][^'\"]*['\"],\s*port=\d+\)/, `app.run(host='${serverConfig.ip}', port=${serverConfig.port})`);
  }
  return nextCode;
}

const optimizedLayoutPositions: Record<string, { x: number; y: number }> = {
  'pc-computer': { x: 60, y: 40 },
  microbit: { x: 300, y: 50 },
  'expansion-board': { x: 250, y: 240 },
  'temp-humidity-sensor': { x: 95, y: 500 },
  'light-sensor': { x: 95, y: 585 },
  'sound-sensor': { x: 95, y: 665 },
  'infrared-sensor': { x: 95, y: 745 },
  buzzer: { x: 360, y: 510 },
  'led-strip': { x: 450, y: 585 },
  servo: { x: 360, y: 630 },
  relay: { x: 455, y: 695 },
  'iot-module': { x: 610, y: 320 },
  obloq: { x: 610, y: 320 },
  router: { x: 765, y: 320 },
  'web-server': { x: 935, y: 245 },
  database: { x: 970, y: 405 },
  browser: { x: 1110, y: 245 },
  'mobile-client': { x: 1120, y: 385 },
};

function getOptimizedPosition(component: PlacedComponent, duplicateIndex: number) {
  const base = optimizedLayoutPositions[component.definitionId] ?? {
    x: 120 + (duplicateIndex % 4) * 150,
    y: 620 + Math.floor(duplicateIndex / 4) * 110,
  };

  if (duplicateIndex === 0) return base;

  return {
    x: base.x + (duplicateIndex % 3) * 140,
    y: base.y + Math.floor(duplicateIndex / 3) * 105,
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

        const pushAutoConnection = (
          fromComponent: string,
          fromPin: string,
          toComponent: string,
          toPin: string,
          type: Connection['type']
        ) => {
          if (hasExactConnection(fromComponent, fromPin, toComponent, toPin)) {
            return;
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
        };

        if (microbit && expansionBoard) {
          const beforeCount = pendingConnections.length;
          pushAutoConnection(microbit.instanceId, 'p0', expansionBoard.instanceId, 'slot-p0', 'data');
          pushAutoConnection(microbit.instanceId, 'p1', expansionBoard.instanceId, 'slot-p1', 'data');
          pushAutoConnection(microbit.instanceId, 'p2', expansionBoard.instanceId, 'slot-p2', 'data');
          pushAutoConnection(microbit.instanceId, '3v', expansionBoard.instanceId, 'slot-3v', 'power');
          pushAutoConnection(microbit.instanceId, 'gnd', expansionBoard.instanceId, 'slot-gnd', 'ground');
          if (pendingConnections.length > beforeCount) {
            autoMessages.push('micro:bit 已自动插入扩展板');
          }
        }

        if (expansionBoard) {
          const iotComponents = newComponents.filter((c) => isIotDefinition(c.definitionId));
          let autoConnectedIotCount = 0;

          iotComponents.forEach((iot) => {
            const beforeCount = pendingConnections.length;
            pushAutoConnection(iot.instanceId, 'vcc', expansionBoard.instanceId, '3v-out2', 'power');
            pushAutoConnection(iot.instanceId, 'gnd', expansionBoard.instanceId, 'gnd-out2', 'ground');
            pushAutoConnection(iot.instanceId, 'tx', expansionBoard.instanceId, 'p15', 'serial');
            pushAutoConnection(iot.instanceId, 'rx', expansionBoard.instanceId, 'p16', 'serial');
            if (pendingConnections.length > beforeCount) {
              autoConnectedIotCount += 1;
            }
          });

          if (autoConnectedIotCount === 1) {
            autoMessages.push('IOT模块已自动连接到扩展板(P15/P16)');
          } else if (autoConnectedIotCount > 1) {
            autoMessages.push(`已自动连接 ${autoConnectedIotCount} 个IOT模块到扩展板(P15/P16)`);
          }
        }

        if (expansionBoard) {
          const sensorMappings: Record<string, { signalPin: string; expansionPin: string }> = {
            'temp-humidity-sensor': { signalPin: 'data', expansionPin: 'p1' },
            'light-sensor': { signalPin: 'ao', expansionPin: 'p1' },
            'sound-sensor': { signalPin: 'ao', expansionPin: 'p1' },
            'infrared-sensor': { signalPin: 'out', expansionPin: 'p1' },
          };

          const sensorComponents = newComponents.filter((candidate) => sensorMappings[candidate.definitionId]);
          let autoConnectedSensorCount = 0;

          sensorComponents.forEach((sensor) => {
            const mapping = sensorMappings[sensor.definitionId];
            const beforeCount = pendingConnections.length;
            pushAutoConnection(sensor.instanceId, 'vcc', expansionBoard.instanceId, '3v-out1', 'power');
            pushAutoConnection(sensor.instanceId, 'gnd', expansionBoard.instanceId, 'gnd-out1', 'ground');
            pushAutoConnection(sensor.instanceId, mapping.signalPin, expansionBoard.instanceId, mapping.expansionPin, 'data');
            if (pendingConnections.length > beforeCount) {
              autoConnectedSensorCount += 1;
            }
          });

          if (autoConnectedSensorCount > 0) {
            autoMessages.push(`已自动连接 ${autoConnectedSensorCount} 个传感器到扩展板(P1)`);
          }

          const actuatorMappings: Record<string, { signalPin: string; expansionPin: string; powerPin: string; groundPin: string }> = {
            buzzer: { signalPin: 'io', expansionPin: 'p2', powerPin: '3v-out3', groundPin: 'gnd-out3' },
            'led-strip': { signalPin: 'din', expansionPin: 'p2', powerPin: '3v-out3', groundPin: 'gnd-out3' },
            servo: { signalPin: 'signal', expansionPin: 'p2', powerPin: '3v-out3', groundPin: 'gnd-out3' },
            relay: { signalPin: 'in', expansionPin: 'p2', powerPin: '3v-out3', groundPin: 'gnd-out3' },
          };

          const actuatorComponents = newComponents.filter((candidate) => actuatorMappings[candidate.definitionId]);
          let autoConnectedActuatorCount = 0;

          actuatorComponents.forEach((actuator) => {
            const mapping = actuatorMappings[actuator.definitionId];
            const beforeCount = pendingConnections.length;
            pushAutoConnection(actuator.instanceId, 'vcc', expansionBoard.instanceId, mapping.powerPin, 'power');
            pushAutoConnection(actuator.instanceId, 'gnd', expansionBoard.instanceId, mapping.groundPin, 'ground');
            pushAutoConnection(actuator.instanceId, mapping.signalPin, expansionBoard.instanceId, mapping.expansionPin, 'data');
            if (pendingConnections.length > beforeCount) {
              autoConnectedActuatorCount += 1;
            }
          });

          if (autoConnectedActuatorCount > 0) {
            autoMessages.push(`已自动连接 ${autoConnectedActuatorCount} 个执行器到扩展板(P2)`);
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
      
      removeComponent: (instanceId) => {
        const state = get();
        const componentToRemove = state.placedComponents.find(c => c.instanceId === instanceId);
        
        if (!componentToRemove) return;
        
        const removedConnections = state.connections.filter(
          (conn) => conn.fromComponent === instanceId || conn.toComponent === instanceId
        );
        const remainingConnections = state.connections.filter(
          (conn) => conn.fromComponent !== instanceId && conn.toComponent !== instanceId
        );
        
        // 生成移除提示
        let message = '';
        if (componentToRemove.definitionId === 'microbit') {
          message = 'micro:bit 已移除，扩展板连接已断开';
        } else if (componentToRemove.definitionId === 'expansion-board') {
          message = '扩展板已移除，所有连接已断开';
        } else if (removedConnections.length > 0) {
          message = `组件已移除，${removedConnections.length} 条连线已自动断开`;
        }
        
        set({
          placedComponents: state.placedComponents.filter((c) => c.instanceId !== instanceId),
          connections: remainingConnections,
          selectedComponentId: state.selectedComponentId === instanceId ? null : state.selectedComponentId,
          lastConnectionResult: message ? {
            success: true,
            message,
            type: 'data',
          } : null,
        });
      },
      
      updateComponentPosition: (instanceId, position) => set((state) => ({
        placedComponents: state.placedComponents.map((c) =>
          c.instanceId === instanceId ? { ...c, position } : c
        ),
      })),

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
        
        // 根据引脚类型判断连接类型
        let connectionType: 'power' | 'ground' | 'data' | 'serial' = 'data';
        let connectionLabel = '';
        
        // 简单判断逻辑
        if (fromPinId.includes('vcc') || fromPinId.includes('3v') || toPinId.includes('vcc') || toPinId.includes('3v')) {
          connectionType = 'power';
          connectionLabel = '电源(VCC/3V)';
        } else if (fromPinId.includes('gnd') || toPinId.includes('gnd')) {
          connectionType = 'ground';
          connectionLabel = '接地(GND)';
        } else if (
          fromPinId.includes('tx') ||
          fromPinId.includes('rx') ||
          toPinId.includes('tx') ||
          toPinId.includes('rx') ||
          fromPinId === 'p15' ||
          fromPinId === 'p16' ||
          toPinId === 'p15' ||
          toPinId === 'p16'
        ) {
          connectionType = 'serial';
          connectionLabel = 'IoT通信';
        } else {
          connectionLabel = '数据';
        }
        
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
      
      setMicrobitCode: (code) => set({ microbitCode: code, codeBurned: false }),
      setFlaskCode: (code) => set({ flaskCode: code }),
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
          routes: scenario.serverConfig.routes.map((route) => ({ ...route })),
          logs: [],
        },
        selectedComponentId: null,
        isRunning: false,
        codeBurned: false,
        sensorValues: {},
        browserUrl: '',
        browserResponse: '',
        browserPageRecords: null,
        browserLastUpdate: null,
        browserAutoRefresh: true,
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
