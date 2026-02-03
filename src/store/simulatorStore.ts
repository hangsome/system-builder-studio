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
  
  // Actions
  setZoom: (zoom: number) => void;
  setPan: (pan: { x: number; y: number }) => void;
  toggleGrid: () => void;
  
  addComponent: (component: PlacedComponent) => void;
  removeComponent: (instanceId: string) => void;
  updateComponentPosition: (instanceId: string, position: { x: number; y: number }) => void;
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

const defaultMicrobitCode = `# micro:bit Python 代码
from microbit import *
import obloq

# 连接WiFi
obloq.setup("WiFi名称", "密码")

# 主循环
while True:
    # 读取传感器数据
    temp = temperature()
    
    # 发送数据到服务器
    obloq.http_post("http://192.168.1.100:5000/upload", 
                    {"temperature": temp})
    
    # 显示数据
    display.scroll(str(temp))
    sleep(5000)
`;

const defaultFlaskCode = `# Flask 服务器代码
from flask import Flask, request, jsonify
import sqlite3

app = Flask(__name__)

# 接收传感器数据
@app.route('/upload', methods=['POST'])
def upload_data():
    data = request.get_json()
    temperature = data.get('temperature')
    
    # 存入数据库
    conn = sqlite3.connect('sensor.db')
    cursor = conn.cursor()
    cursor.execute('''
        INSERT INTO sensorlog (sensor_id, value, timestamp)
        VALUES (1, ?, datetime('now'))
    ''', (temperature,))
    conn.commit()
    conn.close()
    
    return jsonify({"status": "success"})

# 查询数据
@app.route('/query', methods=['GET'])
def query_data():
    conn = sqlite3.connect('sensor.db')
    cursor = conn.cursor()
    cursor.execute('SELECT * FROM sensorlog ORDER BY id DESC LIMIT 10')
    rows = cursor.fetchall()
    conn.close()
    return jsonify(rows)

if __name__ == '__main__':
    app.run(host='0.0.0.0', port=5000)
`;

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
  database: {
    tables: [
      {
        name: 'sensorlist',
        columns: [
          { name: 'id', type: 'INTEGER', primaryKey: true },
          { name: 'name', type: 'TEXT' },
          { name: 'type', type: 'TEXT' },
          { name: 'location', type: 'TEXT' },
        ],
      },
      {
        name: 'sensorlog',
        columns: [
          { name: 'id', type: 'INTEGER', primaryKey: true },
          { name: 'sensor_id', type: 'INTEGER' },
          { name: 'value', type: 'REAL' },
          { name: 'timestamp', type: 'DATETIME' },
        ],
      },
    ],
    records: {
      sensorlist: [
        { id: 1, name: '教室温度传感器', type: 'temperature', location: '301教室' },
      ],
      sensorlog: [],
    },
  },
  routerConfig: {
    ssid: 'School_WiFi',
    password: '12345678',
    ip: '192.168.1.1',
    connectedDevices: [],
  },
  serverConfig: {
    ip: '192.168.1.100',
    port: 5000,
    running: false,
    routes: [
      { path: '/upload', method: 'POST', handler: 'upload_data' },
      { path: '/query', method: 'GET', handler: 'query_data' },
    ],
    logs: [],
  },
  logs: [],
  lastConnectionResult: null,
};

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
        
        // 检查是否需要自动连接 micro:bit 和扩展板
        const microbit = newComponents.find(c => c.definitionId === 'microbit');
        const expansionBoard = newComponents.find(c => c.definitionId === 'expansion-board');
        
        if (microbit && expansionBoard) {
          // 检查是否已存在自动连接
          const autoConnectionExists = state.connections.some(
            c => (c.fromComponent === microbit.instanceId && c.toComponent === expansionBoard.instanceId) ||
                 (c.fromComponent === expansionBoard.instanceId && c.toComponent === microbit.instanceId)
          );
          
          if (!autoConnectionExists) {
            // 创建 micro:bit 到扩展板的自动连接
            const autoConnections: Connection[] = [
              {
                id: `auto-conn-p0-${Date.now()}`,
                fromComponent: microbit.instanceId,
                fromPin: 'p0',
                toComponent: expansionBoard.instanceId,
                toPin: 'slot-p0',
                type: 'data',
                valid: true,
              },
              {
                id: `auto-conn-p1-${Date.now() + 1}`,
                fromComponent: microbit.instanceId,
                fromPin: 'p1',
                toComponent: expansionBoard.instanceId,
                toPin: 'slot-p1',
                type: 'data',
                valid: true,
              },
              {
                id: `auto-conn-p2-${Date.now() + 2}`,
                fromComponent: microbit.instanceId,
                fromPin: 'p2',
                toComponent: expansionBoard.instanceId,
                toPin: 'slot-p2',
                type: 'data',
                valid: true,
              },
              {
                id: `auto-conn-3v-${Date.now() + 3}`,
                fromComponent: microbit.instanceId,
                fromPin: '3v',
                toComponent: expansionBoard.instanceId,
                toPin: 'slot-3v',
                type: 'power',
                valid: true,
              },
              {
                id: `auto-conn-gnd-${Date.now() + 4}`,
                fromComponent: microbit.instanceId,
                fromPin: 'gnd',
                toComponent: expansionBoard.instanceId,
                toPin: 'slot-gnd',
                type: 'ground',
                valid: true,
              },
            ];
            
            set({
              placedComponents: newComponents,
              connections: [...state.connections, ...autoConnections],
              lastConnectionResult: {
                success: true,
                message: 'micro:bit 已自动插入扩展板',
                type: 'power',
              },
            });
            return;
          }
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
        } else if (fromPinId.includes('tx') || fromPinId.includes('rx') || toPinId.includes('tx') || toPinId.includes('rx')) {
          connectionType = 'serial';
          connectionLabel = '串口(TX/RX)';
        } else {
          connectionLabel = '数据';
        }
        
        const newConnection: Connection = {
          id: `conn-${Date.now()}`,
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
      updateServerConfig: (config) => set((state) => ({
        serverConfig: { ...state.serverConfig, ...config },
      })),
      
      addLog: (log) => set((state) => ({
        logs: [...state.logs, { ...log, timestamp: new Date() }].slice(-100),
      })),
      clearLogs: () => set({ logs: [] }),
      clearConnectionResult: () => set({ lastConnectionResult: null }),
      
      resetSimulator: () => set({
        ...initialState,
        microbitCode: defaultMicrobitCode,
        flaskCode: defaultFlaskCode,
      }),
      
      loadScenario: (scenario) => set({
        placedComponents: scenario.components,
        connections: scenario.connections,
        microbitCode: scenario.microbitCode,
        flaskCode: scenario.flaskCode,
        database: scenario.database,
        routerConfig: scenario.routerConfig,
        serverConfig: scenario.serverConfig,
        selectedComponentId: null,
        isRunning: false,
        codeBurned: false,
      }),
    }),
    {
      name: 'simulator-storage',
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
