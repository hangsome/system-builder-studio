import { ComponentDefinition } from '@/types/simulator';

// micro:bit 主板
export const microbitBoard: ComponentDefinition = {
  id: 'microbit',
  type: 'microbit',
  category: 'mainboard',
  name: 'micro:bit V2',
  description: 'BBC micro:bit 微控制器，配备5x5 LED点阵、A/B按钮',
  width: 160,
  height: 130,
  pins: [
    { id: 'usb', name: 'USB', type: 'usb', position: { x: 80, y: 0 } },
    { id: 'p0', name: 'P0', type: 'analog', position: { x: 30, y: 130 } },
    { id: 'p1', name: 'P1', type: 'analog', position: { x: 60, y: 130 } },
    { id: 'p2', name: 'P2', type: 'analog', position: { x: 90, y: 130 } },
    { id: '3v', name: '3V', type: 'power', position: { x: 120, y: 130 } },
    { id: 'gnd', name: 'GND', type: 'ground', position: { x: 140, y: 130 } },
  ],
};

// 扩展板
export const expansionBoard: ComponentDefinition = {
  id: 'expansion-board',
  type: 'expansion-board',
  category: 'mainboard',
  name: '扩展板',
  description: '完整的micro:bit扩展板，提供P0-P20引脚、3V和GND',
  width: 280,
  height: 200,
  pins: [
    // 顶部 - micro:bit 插槽
    { id: 'slot-p0', name: 'P0', type: 'analog', position: { x: 40, y: 10 } },
    { id: 'slot-p1', name: 'P1', type: 'analog', position: { x: 70, y: 10 } },
    { id: 'slot-p2', name: 'P2', type: 'analog', position: { x: 100, y: 10 } },
    { id: 'slot-3v', name: '3V', type: 'power', position: { x: 130, y: 10 } },
    { id: 'slot-gnd', name: 'GND', type: 'ground', position: { x: 160, y: 10 } },
    
    // 左侧引脚
    { id: 'p0', name: 'P0', type: 'analog', position: { x: 0, y: 40 } },
    { id: 'p1', name: 'P1', type: 'analog', position: { x: 0, y: 60 } },
    { id: 'p2', name: 'P2', type: 'analog', position: { x: 0, y: 80 } },
    { id: 'p3', name: 'P3', type: 'digital', position: { x: 0, y: 100 } },
    { id: 'p4', name: 'P4', type: 'digital', position: { x: 0, y: 120 } },
    { id: 'p5', name: 'P5', type: 'digital', position: { x: 0, y: 140 } },
    
    // 右侧引脚
    { id: 'p13', name: 'P13', type: 'digital', position: { x: 280, y: 40 } },
    { id: 'p14', name: 'P14', type: 'digital', position: { x: 280, y: 60 } },
    { id: 'p15', name: 'P15', type: 'digital', position: { x: 280, y: 80 } },
    { id: 'p16', name: 'P16', type: 'digital', position: { x: 280, y: 100 } },
    
    // 底部电源引脚（扩展为4组3V和4组GND）
    { id: '3v-out1', name: '3V', type: 'power', position: { x: 30, y: 200 } },
    { id: '3v-out2', name: '3V', type: 'power', position: { x: 55, y: 200 } },
    { id: '3v-out3', name: '3V', type: 'power', position: { x: 80, y: 200 } },
    { id: '3v-out4', name: '3V', type: 'power', position: { x: 105, y: 200 } },
    { id: 'gnd-out1', name: 'GND', type: 'ground', position: { x: 140, y: 200 } },
    { id: 'gnd-out2', name: 'GND', type: 'ground', position: { x: 165, y: 200 } },
    { id: 'gnd-out3', name: 'GND', type: 'ground', position: { x: 190, y: 200 } },
    { id: 'gnd-out4', name: 'GND', type: 'ground', position: { x: 215, y: 200 } },
    
    // 串口引脚（用于IoT模块）
    { id: 'tx', name: 'TX', type: 'serial_tx', position: { x: 240, y: 200 } },
    { id: 'rx', name: 'RX', type: 'serial_rx', position: { x: 265, y: 200 } },
  ],
};

// 温湿度传感器
export const tempHumiditySensor: ComponentDefinition = {
  id: 'temp-humidity-sensor',
  type: 'temp-humidity-sensor',
  category: 'sensor',
  name: '温湿度传感器',
  description: 'DHT11/DHT22 温湿度传感器模块',
  width: 80,
  height: 60,
  pins: [
    { id: 'vcc', name: 'VCC', type: 'power', position: { x: 20, y: 60 } },
    { id: 'data', name: 'DATA', type: 'data', position: { x: 40, y: 60 } },
    { id: 'gnd', name: 'GND', type: 'ground', position: { x: 60, y: 60 } },
  ],
};

// 光线传感器
export const lightSensor: ComponentDefinition = {
  id: 'light-sensor',
  type: 'light-sensor',
  category: 'sensor',
  name: '光线传感器',
  description: '光敏电阻传感器模块',
  width: 70,
  height: 55,
  pins: [
    { id: 'vcc', name: 'VCC', type: 'power', position: { x: 15, y: 55 } },
    { id: 'ao', name: 'AO', type: 'analog', position: { x: 35, y: 55 } },
    { id: 'gnd', name: 'GND', type: 'ground', position: { x: 55, y: 55 } },
  ],
};

// 红外传感器
export const infraredSensor: ComponentDefinition = {
  id: 'infrared-sensor',
  type: 'infrared-sensor',
  category: 'sensor',
  name: '红外传感器',
  description: '红外避障/人体感应传感器',
  width: 75,
  height: 50,
  pins: [
    { id: 'vcc', name: 'VCC', type: 'power', position: { x: 18, y: 50 } },
    { id: 'out', name: 'OUT', type: 'digital', position: { x: 38, y: 50 } },
    { id: 'gnd', name: 'GND', type: 'ground', position: { x: 58, y: 50 } },
  ],
};

// 声音传感器
export const soundSensor: ComponentDefinition = {
  id: 'sound-sensor',
  type: 'sound-sensor',
  category: 'sensor',
  name: '声音传感器',
  description: '麦克风声音检测模块',
  width: 70,
  height: 55,
  pins: [
    { id: 'vcc', name: 'VCC', type: 'power', position: { x: 15, y: 55 } },
    { id: 'ao', name: 'AO', type: 'analog', position: { x: 35, y: 55 } },
    { id: 'gnd', name: 'GND', type: 'ground', position: { x: 55, y: 55 } },
  ],
};

// LED灯带
export const ledStrip: ComponentDefinition = {
  id: 'led-strip',
  type: 'led-strip',
  category: 'actuator',
  name: 'LED灯带',
  description: 'WS2812B RGB LED灯带模块',
  width: 120,
  height: 40,
  pins: [
    { id: 'vcc', name: 'VCC', type: 'power', position: { x: 30, y: 40 } },
    { id: 'din', name: 'DIN', type: 'data', position: { x: 60, y: 40 } },
    { id: 'gnd', name: 'GND', type: 'ground', position: { x: 90, y: 40 } },
  ],
};

// 蜂鸣器
export const buzzer: ComponentDefinition = {
  id: 'buzzer',
  type: 'buzzer',
  category: 'actuator',
  name: '蜂鸣器',
  description: '有源蜂鸣器模块',
  width: 50,
  height: 50,
  pins: [
    { id: 'vcc', name: '+', type: 'power', position: { x: 15, y: 50 } },
    { id: 'io', name: 'IO', type: 'digital', position: { x: 25, y: 50 } },
    { id: 'gnd', name: '-', type: 'ground', position: { x: 35, y: 50 } },
  ],
};

// 舵机
export const servo: ComponentDefinition = {
  id: 'servo',
  type: 'servo',
  category: 'actuator',
  name: '舵机',
  description: 'SG90 9g微型舵机',
  width: 70,
  height: 45,
  pins: [
    { id: 'vcc', name: 'VCC', type: 'power', position: { x: 20, y: 45 } },
    { id: 'signal', name: 'SIG', type: 'digital', position: { x: 35, y: 45 } },
    { id: 'gnd', name: 'GND', type: 'ground', position: { x: 50, y: 45 } },
  ],
};

// 继电器
export const relay: ComponentDefinition = {
  id: 'relay',
  type: 'relay',
  category: 'actuator',
  name: '继电器',
  description: '5V单路继电器模块',
  width: 60,
  height: 65,
  pins: [
    { id: 'vcc', name: 'VCC', type: 'power', position: { x: 15, y: 65 } },
    { id: 'in', name: 'IN', type: 'digital', position: { x: 30, y: 65 } },
    { id: 'gnd', name: 'GND', type: 'ground', position: { x: 45, y: 65 } },
  ],
};

// WiFi物联网模块 (OBLOQ)
export const iotModule: ComponentDefinition = {
  id: 'iot-module',
  type: 'iot-module',
  category: 'network',
  name: 'IoT模块',
  description: 'WiFi物联网通信模块',
  width: 90,
  height: 70,
  pins: [
    { id: 'vcc', name: 'VCC', type: 'power', position: { x: 15, y: 70 } },
    { id: 'gnd', name: 'GND', type: 'ground', position: { x: 35, y: 70 } },
    { id: 'tx', name: 'TX', type: 'serial_tx', position: { x: 55, y: 70 } },
    { id: 'rx', name: 'RX', type: 'serial_rx', position: { x: 75, y: 70 } },
    // WiFi 信号引脚 - 表示无线连接到路由器
    { id: 'wifi', name: 'WIFI', type: 'data', position: { x: 45, y: 0 } },
  ],
};

// 路由器
export const router: ComponentDefinition = {
  id: 'router',
  type: 'router',
  category: 'network',
  name: '无线路由器',
  description: 'WiFi无线路由器',
  width: 100,
  height: 70,
  pins: [
    // WiFi 信号引脚 - 接收无线设备连接
    { id: 'wifi', name: 'WIFI', type: 'data', position: { x: 50, y: 0 } },
    { id: 'wan', name: 'WAN', type: 'data', position: { x: 25, y: 70 } },
    { id: 'lan', name: 'LAN', type: 'data', position: { x: 75, y: 70 } },
  ],
};

// PC服务器
export const pcServer: ComponentDefinition = {
  id: 'pc-server',
  type: 'pc-server',
  category: 'server',
  name: 'PC服务器',
  description: '运行Flask服务器的电脑',
  width: 110,
  height: 90,
  pins: [
    { id: 'usb', name: 'USB', type: 'usb', position: { x: 25, y: 90 } },
    { id: 'network', name: 'NET', type: 'data', position: { x: 55, y: 90 } },
    // 数据库连接引脚
    { id: 'db', name: 'DB', type: 'data', position: { x: 85, y: 90 } },
  ],
};

// 数据库
export const database: ComponentDefinition = {
  id: 'database',
  type: 'database',
  category: 'server',
  name: 'SQLite数据库',
  description: 'SQLite本地数据库（运行于PC服务器内）',
  width: 70,
  height: 70,
  pins: [
    // 与PC服务器的DB引脚连接
    { id: 'connection', name: 'CONN', type: 'data', position: { x: 35, y: 0 } },
  ],
};

// 客户端浏览器
export const browser: ComponentDefinition = {
  id: 'browser',
  type: 'browser',
  category: 'server',
  name: '客户端浏览器',
  description: 'Web浏览器客户端',
  width: 90,
  height: 70,
  pins: [
    { id: 'http', name: 'HTTP', type: 'data', position: { x: 45, y: 70 } },
  ],
};

// 所有组件定义
export const componentDefinitions: ComponentDefinition[] = [
  microbitBoard,
  expansionBoard,
  tempHumiditySensor,
  lightSensor,
  infraredSensor,
  soundSensor,
  ledStrip,
  buzzer,
  servo,
  relay,
  iotModule,
  router,
  pcServer,
  database,
  browser,
];

// 按类别分组
export const componentsByCategory = {
  mainboard: [microbitBoard, expansionBoard],
  sensor: [tempHumiditySensor, lightSensor, infraredSensor, soundSensor],
  actuator: [ledStrip, buzzer, servo, relay],
  network: [iotModule, router],
  server: [pcServer, database, browser],
};

export const categoryNames: Record<string, string> = {
  mainboard: '主板',
  sensor: '传感器',
  actuator: '执行器',
  network: '网络设备',
  server: '服务器端',
};
