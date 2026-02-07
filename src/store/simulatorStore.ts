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
  
  setSensorValue: (instanceId: string, value: number) => void;
  setSensorValues: (values: Record<string, number>) => void;
  setAutoFluctuation: (enabled: boolean) => void;
  
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

const defaultMicrobitCode = `# ============================================
# micro:bit Python 代码 - 传感器数据上传示例
# ============================================
# 功能：读取温度传感器数据，通过WiFi发送到服务器
# 通信方式：HTTP GET 请求（参数附加在URL后）
# ============================================

from microbit import *
import obloq  # 导入IOT物联网模块库

# ========== 网络配置 ==========
# WiFi连接参数（需与路由器设置一致）
WIFI_SSID = "School_WiFi"      # WiFi名称
WIFI_PASSWORD = "12345678"     # WiFi密码

# 服务器配置（Flask服务器地址）
SERVER_IP = "192.168.1.100"    # 服务器IP地址
SERVER_PORT = 5000             # 服务器端口号

# ========== 初始化连接 ==========
# 调用setup函数连接到WiFi网络
obloq.setup(WIFI_SSID, WIFI_PASSWORD)

# ========== 主循环 ==========
while True:
    # 1. 读取温度传感器数据
    temp = temperature()
    
    # 2. 在LED点阵上显示当前温度
    display.scroll(str(temp))
    
    # 3. 构建GET请求URL（参数附加在URL后面）
    # 格式：http://服务器IP:端口/upload?temperature=数值
    url = "http://" + SERVER_IP + ":" + str(SERVER_PORT)
    url = url + "/upload?temperature=" + str(temp)
    
    # 4. 发送HTTP GET请求到服务器
    # 服务器收到请求后会将数据存入数据库
    obloq.http_get(url)
    
    # 5. 等待5秒后再次采集（避免频繁请求）
    sleep(5000)
`;

const defaultFlaskCode = `# ============================================
# Flask 服务器代码 - 传感器数据接收与存储
# ============================================
# 功能：接收来自micro:bit的传感器数据，存入SQLite数据库
# 接口：GET /upload?temperature=数值 - 接收温度数据
#       GET /query - 查询最近10条记录
# ============================================

from flask import Flask, request, jsonify
import sqlite3
from datetime import datetime

app = Flask(__name__)

# ========== 数据库初始化 ==========
def init_db():
    """创建数据库和表结构"""
    conn = sqlite3.connect('sensor.db')
    cursor = conn.cursor()
    # 创建传感器日志表
    cursor.execute('''
        CREATE TABLE IF NOT EXISTS sensorlog (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            sensor_id INTEGER,
            value REAL,
            timestamp DATETIME
        )
    ''')
    conn.commit()
    conn.close()

# ========== 接收传感器数据接口 ==========
# 使用GET方法，参数通过URL传递
# 示例请求：GET /upload?temperature=25.5
@app.route('/upload', methods=['GET'])
def upload_data():
    # 1. 从URL参数中获取温度值
    # request.args 用于获取GET请求的参数
    temperature = request.args.get('temperature', type=float)
    
    # 2. 参数校验
    if temperature is None:
        return jsonify({"status": "error", "message": "缺少temperature参数"})
    
    # 3. 连接数据库并插入数据
    conn = sqlite3.connect('sensor.db')
    cursor = conn.cursor()
    cursor.execute('''
        INSERT INTO sensorlog (sensor_id, value, timestamp)
        VALUES (1, ?, ?)
    ''', (temperature, datetime.now()))
    conn.commit()
    conn.close()
    
    # 4. 返回成功响应
    print(f"[数据接收] 温度: {temperature}°C")
    return jsonify({"status": "success", "temperature": temperature})

# ========== 查询数据接口 ==========
# 返回最近10条传感器记录
@app.route('/query', methods=['GET'])
def query_data():
    conn = sqlite3.connect('sensor.db')
    cursor = conn.cursor()
    # 按ID倒序查询最近10条
    cursor.execute('SELECT * FROM sensorlog ORDER BY id DESC LIMIT 10')
    rows = cursor.fetchall()
    conn.close()
    return jsonify(rows)

# ========== 启动服务器 ==========
if __name__ == '__main__':
    init_db()  # 初始化数据库
    print("Flask服务器启动中...")
    print("数据接收接口: GET /upload?temperature=数值")
    print("数据查询接口: GET /query")
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
        { path: '/upload', method: 'GET', handler: 'upload_data' },
      { path: '/query', method: 'GET', handler: 'query_data' },
    ],
    logs: [],
  },
  logs: [],
  lastConnectionResult: null,
  sensorValues: {},
  autoFluctuation: true,
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
        const microbit = newComponents.find(c => c.definitionId === 'microbit');
        const expansionBoard = newComponents.find(c => c.definitionId === 'expansion-board');
        const pendingConnections: Connection[] = [];
        const autoMessages: string[] = [];

        const isIotDefinition = (definitionId: string) =>
          definitionId === 'iot-module' || definitionId === 'obloq';

        const hasExactConnection = (
          fromComponent: string,
          fromPin: string,
          toComponent: string,
          toPin: string
        ) =>
          state.connections.some(
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
          connectionLabel = '串口(TX/RX-P15/P16)';
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
      updateServerConfig: (config) => set((state) => ({
        serverConfig: { ...state.serverConfig, ...config },
      })),
      
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
        sensorValues: {},
      }),
    }),
    {
      name: 'simulator-storage',
      version: 2,
      migrate: (persistedState, version) => {
        const state = persistedState as Partial<SimulatorStore>;
        if (version < 2 && state?.routerConfig) {
          return {
            ...state,
            routerConfig: {
              ...state.routerConfig,
              password: '',
            },
          } as SimulatorStore;
        }
        return state as SimulatorStore;
      },
      partialize: (state) => ({
        placedComponents: state.placedComponents,
        connections: state.connections,
        microbitCode: state.microbitCode,
        flaskCode: state.flaskCode,
        database: state.database,
        routerConfig: { ...state.routerConfig, password: '' },
        serverConfig: state.serverConfig,
      }),
    }
  )
);
