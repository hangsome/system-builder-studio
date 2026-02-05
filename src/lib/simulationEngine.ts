// 仿真引擎 - 阶段五核心功能
import { PlacedComponent, Connection, DatabaseState, ServerConfig, LogEntry } from '@/types/simulator';
import { validateSystem } from './connectionValidator';

export interface SimulationState {
  sensorValues: Record<string, number>;
  actuatorStates: Record<string, boolean | number>;
  networkStatus: 'disconnected' | 'connecting' | 'connected';
  serverStatus: 'stopped' | 'starting' | 'running' | 'error';
  dataFlow: DataFlowEvent[];
}

export interface DataFlowEvent {
  id: string;
  fromComponent: string;
  toComponent: string;
  data: unknown;
  timestamp: Date;
  status: 'pending' | 'success' | 'error';
}

export interface SimulationConfig {
  speed: number; // 0.5x - 3x
  autoGenerateSensorData: boolean;
  sensorUpdateInterval: number; // ms
}

// 传感器配置
export const sensorConfigs: Record<string, { 
  min: number; 
  max: number; 
  unit: string; 
  defaultValue: number;
  decimals: number;
  fluctuation: number; // 自动波动范围
}> = {
  'temp-humidity-sensor': { 
    min: -10, max: 50, unit: '°C', defaultValue: 25, decimals: 1, fluctuation: 2 
  },
  'light-sensor': { 
    min: 0, max: 1000, unit: 'lux', defaultValue: 500, decimals: 0, fluctuation: 50 
  },
  'sound-sensor': { 
    min: 0, max: 120, unit: 'dB', defaultValue: 40, decimals: 0, fluctuation: 10 
  },
  'infrared-sensor': { 
    min: 0, max: 1, unit: '', defaultValue: 0, decimals: 0, fluctuation: 0 
  },
};

// 生成随机传感器值波动
export function generateSensorFluctuation(
  currentValue: number, 
  sensorType: string
): number {
  const config = sensorConfigs[sensorType];
  if (!config) return currentValue;

  const fluctuation = (Math.random() - 0.5) * 2 * config.fluctuation;
  let newValue = currentValue + fluctuation;
  
  // 确保在范围内
  newValue = Math.max(config.min, Math.min(config.max, newValue));
  
  // 处理小数
  return Number(newValue.toFixed(config.decimals));
}

// 模拟HTTP请求
export interface SimulatedHttpRequest {
  method: 'GET' | 'POST' | 'PUT' | 'DELETE';
  path: string;
  body?: Record<string, unknown>;
  timestamp: Date;
}

export interface SimulatedHttpResponse {
  status: number;
  body: unknown;
  timestamp: Date;
}

// 模拟Flask服务器路由处理
export function simulateFlaskRoute(
  request: SimulatedHttpRequest,
  serverConfig: ServerConfig,
  database: DatabaseState
): { response: SimulatedHttpResponse; updatedDatabase?: DatabaseState } {
  const route = serverConfig.routes.find(
    r => r.path === request.path && r.method === request.method
  );

  // 支持带参数的GET请求匹配（如 /upload?temperature=25）
  const pathWithoutParams = request.path.split('?')[0];
  const matchedRoute = route || serverConfig.routes.find(
    r => r.path === pathWithoutParams && r.method === request.method
  );

  if (!matchedRoute) {
    return {
      response: {
        status: 404,
        body: { error: 'Not Found' },
        timestamp: new Date(),
      },
    };
  }

  // 模拟不同路由的处理
  switch (matchedRoute.handler) {
    case 'upload_data': {
      // 处理传感器数据上传（GET请求，参数在URL中）
      // 解析URL参数：/upload?temperature=25.5&location=301
      const urlParams = new URLSearchParams(request.path.split('?')[1] || '');
      const temperature = parseFloat(urlParams.get('temperature') || '0');
      
      // 如果没有有效的温度数据，返回错误
      if (isNaN(temperature)) {
        return {
          response: { status: 400, body: { error: 'Invalid temperature parameter' }, timestamp: new Date() },
        };
      }

      // 添加到数据库
      const newRecord = {
        id: (database.records['sensorlog']?.length || 0) + 1,
        sensor_id: 1,
        value: temperature,
        timestamp: new Date().toISOString(),
      };

      const updatedDatabase: DatabaseState = {
        ...database,
        records: {
          ...database.records,
          sensorlog: [...(database.records['sensorlog'] || []), newRecord].slice(-100),
        },
      };

      // 返回成功响应，包含插入的记录ID
      return {
        response: { 
          status: 200, 
          body: { status: 'success', id: newRecord.id, message: `温度 ${temperature}°C 已记录` }, 
          timestamp: new Date() 
        },
        updatedDatabase,
      };
    }

    case 'query_data': {
      // 查询最近的传感器数据
      const records = database.records['sensorlog'] || [];
      const recentRecords = records.slice(-10).reverse();
      
      return {
        response: { status: 200, body: recentRecords, timestamp: new Date() },
      };
    }

    default:
      return {
        response: { status: 200, body: { message: 'OK' }, timestamp: new Date() },
      };
  }
}

// 检查系统是否可以运行仿真
export function canRunSimulation(
  placedComponents: PlacedComponent[],
  connections: Connection[],
  codeBurned: boolean,
  serverRunning: boolean
): { canRun: boolean; issues: string[] } {
  const issues: string[] = [];

  // 检查是否有micro:bit
  const hasMicrobit = placedComponents.some(c => c.definitionId === 'microbit');
  if (!hasMicrobit) {
    issues.push('需要添加 micro:bit 主板');
  }

  // 检查代码是否烧录
  if (!codeBurned) {
    issues.push('需要先烧录代码到 micro:bit');
  }

  // 检查服务器是否运行
  if (!serverRunning) {
    issues.push('需要启动 Flask 服务器');
  }

  // 检查连接验证
  const validation = validateSystem(placedComponents, connections);
  issues.push(...validation.issues);

  return {
    canRun: issues.length === 0,
    issues,
  };
}

// 生成数据流日志
export function createDataFlowLog(
  source: string,
  target: string,
  data: unknown,
  type: 'info' | 'data' | 'warning' | 'error'
): Omit<LogEntry, 'timestamp'> {
  let message = '';
  
  if (type === 'data') {
    message = `数据: ${JSON.stringify(data)}`;
  } else if (type === 'info') {
    message = String(data);
  } else if (type === 'warning') {
    message = `⚠️ ${data}`;
  } else {
    message = `❌ ${data}`;
  }

  return {
    type,
    source,
    message,
  };
}

// 模拟micro:bit代码执行
export function simulateMicrobitExecution(
  code: string,
  sensorValues: Record<string, number>
): { actions: string[]; displayValue?: string | number } {
  const actions: string[] = [];
  let displayValue: string | number | undefined;

  // 简单的代码解析模拟
  if (code.includes('temperature()')) {
    const tempSensor = Object.entries(sensorValues).find(([key]) => 
      key.includes('temp-humidity')
    );
    if (tempSensor) {
      displayValue = tempSensor[1];
      actions.push(`读取温度: ${tempSensor[1]}°C`);
    }
  }

  if (code.includes('display.scroll')) {
    actions.push('LED显示滚动文字');
  }

  if (code.includes('obloq.http_post')) {
    actions.push('发送HTTP POST请求');
  }

  if (code.includes('obloq.http_get')) {
    actions.push('发送HTTP GET请求');
  }

  return { actions, displayValue };
}
