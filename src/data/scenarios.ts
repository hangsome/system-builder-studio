import { Scenario } from '@/types/simulator';

// 教室温度监测系统场景 - 完整连线版
export const classroomTemperatureScenario: Scenario = {
  id: 'classroom-temperature',
  name: '教室温度监测系统',
  description: '使用温湿度传感器监测教室温度，数据通过WiFi发送到服务器存储（已完成所有连线）',
  components: [
    {
      instanceId: 'microbit-1',
      definitionId: 'microbit',
      position: { x: 60, y: 20 },
      state: { powered: true, active: false },
    },
    {
      instanceId: 'expansion-1',
      definitionId: 'expansion-board',
      position: { x: 60, y: 180 },
      state: { powered: true, active: false },
    },
    {
      instanceId: 'temp-sensor-1',
      definitionId: 'temp-humidity-sensor',
      position: { x: 60, y: 420 },
      state: { powered: true, active: false, value: 25 },
    },
    {
      instanceId: 'iot-1',
      definitionId: 'iot-module',
      position: { x: 200, y: 420 },
      state: { powered: true, active: false },
    },
    {
      instanceId: 'router-1',
      definitionId: 'router',
      position: { x: 420, y: 180 },
      state: { powered: true, active: true },
    },
    {
      instanceId: 'server-1',
      definitionId: 'pc-server',
      position: { x: 580, y: 160 },
      state: { powered: true, active: true },
    },
    {
      instanceId: 'database-1',
      definitionId: 'database',
      position: { x: 600, y: 300 },
      state: { powered: true, active: true },
    },
    {
      instanceId: 'browser-1',
      definitionId: 'browser',
      position: { x: 580, y: 420 },
      state: { powered: true, active: true },
    },
    {
      instanceId: 'buzzer-1',
      definitionId: 'buzzer',
      position: { x: 320, y: 420 },
      state: { powered: true, active: false },
    },
  ],
  connections: [
    // micro:bit 与扩展板全连接
    {
      id: 'conn-mb-3v',
      fromComponent: 'microbit-1',
      fromPin: '3v',
      toComponent: 'expansion-1',
      toPin: 'slot-3v',
      type: 'power',
      valid: true,
    },
    {
      id: 'conn-mb-gnd',
      fromComponent: 'microbit-1',
      fromPin: 'gnd',
      toComponent: 'expansion-1',
      toPin: 'slot-gnd',
      type: 'ground',
      valid: true,
    },
    {
      id: 'conn-mb-p0',
      fromComponent: 'microbit-1',
      fromPin: 'p0',
      toComponent: 'expansion-1',
      toPin: 'slot-p0',
      type: 'data',
      valid: true,
    },
    {
      id: 'conn-mb-p1',
      fromComponent: 'microbit-1',
      fromPin: 'p1',
      toComponent: 'expansion-1',
      toPin: 'slot-p1',
      type: 'data',
      valid: true,
    },
    {
      id: 'conn-mb-p2',
      fromComponent: 'microbit-1',
      fromPin: 'p2',
      toComponent: 'expansion-1',
      toPin: 'slot-p2',
      type: 'data',
      valid: true,
    },
    // micro:bit USB连接PC服务器
    {
      id: 'conn-mb-usb',
      fromComponent: 'microbit-1',
      fromPin: 'usb',
      toComponent: 'server-1',
      toPin: 'usb',
      type: 'data',
      valid: true,
    },
    // 温湿度传感器 VCC
    {
      id: 'conn-temp-vcc',
      fromComponent: 'temp-sensor-1',
      fromPin: 'vcc',
      toComponent: 'expansion-1',
      toPin: '3v-out1',
      type: 'power',
      valid: true,
    },
    // 温湿度传感器 GND
    {
      id: 'conn-temp-gnd',
      fromComponent: 'temp-sensor-1',
      fromPin: 'gnd',
      toComponent: 'expansion-1',
      toPin: 'gnd-out1',
      type: 'ground',
      valid: true,
    },
    // 温湿度传感器 DATA
    {
      id: 'conn-temp-data',
      fromComponent: 'temp-sensor-1',
      fromPin: 'data',
      toComponent: 'expansion-1',
      toPin: 'p0',
      type: 'data',
      valid: true,
    },
    // IoT模块 VCC
    {
      id: 'conn-iot-vcc',
      fromComponent: 'iot-1',
      fromPin: 'vcc',
      toComponent: 'expansion-1',
      toPin: '3v-out2',
      type: 'power',
      valid: true,
    },
    // IoT模块 GND
    {
      id: 'conn-iot-gnd',
      fromComponent: 'iot-1',
      fromPin: 'gnd',
      toComponent: 'expansion-1',
      toPin: 'gnd-out2',
      type: 'ground',
      valid: true,
    },
    // IoT模块 TX -> 扩展板 RX (串口交叉)
    {
      id: 'conn-iot-tx',
      fromComponent: 'iot-1',
      fromPin: 'tx',
      toComponent: 'expansion-1',
      toPin: 'rx',
      type: 'serial',
      valid: true,
    },
    // IoT模块 RX -> 扩展板 TX (串口交叉)
    {
      id: 'conn-iot-rx',
      fromComponent: 'iot-1',
      fromPin: 'rx',
      toComponent: 'expansion-1',
      toPin: 'tx',
      type: 'serial',
      valid: true,
    },
    // IoT模块 WIFI -> 路由器 WIFI (无线连接)
    {
      id: 'conn-iot-wifi',
      fromComponent: 'iot-1',
      fromPin: 'wifi',
      toComponent: 'router-1',
      toPin: 'wifi',
      type: 'wireless',
      valid: true,
    },
    // 路由器连接服务器
    {
      id: 'conn-router-server',
      fromComponent: 'router-1',
      fromPin: 'lan',
      toComponent: 'server-1',
      toPin: 'network',
      type: 'data',
      valid: true,
    },
    // 服务器DB连接数据库CONN
    {
      id: 'conn-server-db',
      fromComponent: 'server-1',
      fromPin: 'db',
      toComponent: 'database-1',
      toPin: 'connection',
      type: 'data',
      valid: true,
    },
    // 浏览器连接路由器
    {
      id: 'conn-browser-router',
      fromComponent: 'browser-1',
      fromPin: 'http',
      toComponent: 'router-1',
      toPin: 'lan',
      type: 'data',
      valid: true,
    },
    // 蜂鸣器 VCC - 连接3V电源
    {
      id: 'conn-buzzer-vcc',
      fromComponent: 'buzzer-1',
      fromPin: 'vcc',
      toComponent: 'expansion-1',
      toPin: '3v-out3',
      type: 'power',
      valid: true,
    },
    // 蜂鸣器 GND - 连接接地
    {
      id: 'conn-buzzer-gnd',
      fromComponent: 'buzzer-1',
      fromPin: 'gnd',
      toComponent: 'expansion-1',
      toPin: 'gnd-out3',
      type: 'ground',
      valid: true,
    },
    // 蜂鸣器 IO - 连接数字引脚P3
    {
      id: 'conn-buzzer-io',
      fromComponent: 'buzzer-1',
      fromPin: 'io',
      toComponent: 'expansion-1',
      toPin: 'p3',
      type: 'data',
      valid: true,
    },
  ],
  microbitCode: `# 教室温度监测系统
from microbit import *
import obloq

# 连接WiFi
obloq.setup("School_WiFi", "12345678")

# 服务器地址
SERVER_URL = "http://192.168.1.100:5000/upload"

# 主循环
while True:
    # 读取温度
    temp = temperature()
    
    # 显示在LED点阵
    display.scroll(str(temp))
    
    # 发送到服务器
    data = {"temperature": temp, "location": "301教室"}
    obloq.http_post(SERVER_URL, data)
    
    # 等待5秒
    sleep(5000)
`,
  flaskCode: `# Flask 服务器 - 教室温度监测
from flask import Flask, request, jsonify
import sqlite3
from datetime import datetime

app = Flask(__name__)

# 初始化数据库
def init_db():
    conn = sqlite3.connect('sensor.db')
    cursor = conn.cursor()
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

# 接收温度数据
@app.route('/upload', methods=['POST'])
def upload_data():
    data = request.get_json()
    temperature = data.get('temperature')
    location = data.get('location', '未知')
    
    conn = sqlite3.connect('sensor.db')
    cursor = conn.cursor()
    cursor.execute('''
        INSERT INTO sensorlog (sensor_id, value, timestamp)
        VALUES (1, ?, ?)
    ''', (temperature, datetime.now()))
    conn.commit()
    conn.close()
    
    print(f"收到数据: {location} 温度 {temperature}°C")
    return jsonify({"status": "success"})

# 查询最近数据
@app.route('/query', methods=['GET'])
def query_data():
    conn = sqlite3.connect('sensor.db')
    cursor = conn.cursor()
    cursor.execute('SELECT * FROM sensorlog ORDER BY id DESC LIMIT 10')
    rows = cursor.fetchall()
    conn.close()
    return jsonify(rows)

if __name__ == '__main__':
    init_db()
    app.run(host='0.0.0.0', port=5000)
`,
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
    connectedDevices: ['IoT-001', 'PC-Server', 'Browser'],
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
};

// 智能灌溉系统场景 - 完整连线版
export const smartIrrigationScenario: Scenario = {
  id: 'smart-irrigation',
  name: '智能灌溉系统',
  description: '通过土壤湿度传感器检测土壤状态，自动控制继电器进行灌溉（已完成所有连线）',
  components: [
    {
      instanceId: 'microbit-1',
      definitionId: 'microbit',
      position: { x: 60, y: 20 },
      state: { powered: true, active: false },
    },
    {
      instanceId: 'expansion-1',
      definitionId: 'expansion-board',
      position: { x: 60, y: 180 },
      state: { powered: true, active: false },
    },
    {
      instanceId: 'temp-sensor-1',
      definitionId: 'temp-humidity-sensor',
      position: { x: 60, y: 420 },
      state: { powered: true, active: false, value: 40 },
    },
    {
      instanceId: 'relay-1',
      definitionId: 'relay',
      position: { x: 180, y: 420 },
      state: { powered: true, active: false },
    },
    {
      instanceId: 'server-1',
      definitionId: 'pc-server',
      position: { x: 420, y: 160 },
      state: { powered: true, active: true },
    },
  ],
  connections: [
    // micro:bit USB连接PC
    {
      id: 'conn-usb',
      fromComponent: 'microbit-1',
      fromPin: 'usb',
      toComponent: 'server-1',
      toPin: 'usb',
      type: 'data',
      valid: true,
    },
    // micro:bit 与扩展板全连接
    {
      id: 'conn-mb-3v',
      fromComponent: 'microbit-1',
      fromPin: '3v',
      toComponent: 'expansion-1',
      toPin: 'slot-3v',
      type: 'power',
      valid: true,
    },
    {
      id: 'conn-mb-gnd',
      fromComponent: 'microbit-1',
      fromPin: 'gnd',
      toComponent: 'expansion-1',
      toPin: 'slot-gnd',
      type: 'ground',
      valid: true,
    },
    {
      id: 'conn-mb-p0',
      fromComponent: 'microbit-1',
      fromPin: 'p0',
      toComponent: 'expansion-1',
      toPin: 'slot-p0',
      type: 'data',
      valid: true,
    },
    {
      id: 'conn-mb-p1',
      fromComponent: 'microbit-1',
      fromPin: 'p1',
      toComponent: 'expansion-1',
      toPin: 'slot-p1',
      type: 'data',
      valid: true,
    },
    {
      id: 'conn-mb-p2',
      fromComponent: 'microbit-1',
      fromPin: 'p2',
      toComponent: 'expansion-1',
      toPin: 'slot-p2',
      type: 'data',
      valid: true,
    },
    // 温湿度传感器连接
    {
      id: 'conn-temp-vcc',
      fromComponent: 'temp-sensor-1',
      fromPin: 'vcc',
      toComponent: 'expansion-1',
      toPin: '3v-out1',
      type: 'power',
      valid: true,
    },
    {
      id: 'conn-temp-gnd',
      fromComponent: 'temp-sensor-1',
      fromPin: 'gnd',
      toComponent: 'expansion-1',
      toPin: 'gnd-out1',
      type: 'ground',
      valid: true,
    },
    {
      id: 'conn-temp-data',
      fromComponent: 'temp-sensor-1',
      fromPin: 'data',
      toComponent: 'expansion-1',
      toPin: 'p0',
      type: 'data',
      valid: true,
    },
    // 继电器连接
    {
      id: 'conn-relay-vcc',
      fromComponent: 'relay-1',
      fromPin: 'vcc',
      toComponent: 'expansion-1',
      toPin: '3v-out2',
      type: 'power',
      valid: true,
    },
    {
      id: 'conn-relay-gnd',
      fromComponent: 'relay-1',
      fromPin: 'gnd',
      toComponent: 'expansion-1',
      toPin: 'gnd-out2',
      type: 'ground',
      valid: true,
    },
    {
      id: 'conn-relay-in',
      fromComponent: 'relay-1',
      fromPin: 'in',
      toComponent: 'expansion-1',
      toPin: 'p3',
      type: 'data',
      valid: true,
    },
  ],
  microbitCode: `# 智能灌溉系统
from microbit import *

# 湿度阈值（低于此值开始灌溉）
THRESHOLD = 30

while True:
    # 读取土壤湿度（模拟值0-100%）
    humidity = pin0.read_analog() / 10
    
    # 显示湿度值
    display.scroll(str(int(humidity)))
    
    # 判断是否需要灌溉
    if humidity < THRESHOLD:
        # 土壤干燥，开启继电器进行灌溉
        pin3.write_digital(1)
        display.show(Image.ARROW_S)  # 显示向下箭头表示灌溉中
    else:
        # 土壤湿润，关闭继电器
        pin3.write_digital(0)
        display.show(Image.HAPPY)  # 显示笑脸表示正常
    
    sleep(2000)
`,
  flaskCode: '',
  database: { tables: [], records: {} },
  routerConfig: {
    ssid: '',
    password: '',
    ip: '',
    connectedDevices: [],
  },
  serverConfig: {
    ip: '',
    port: 5000,
    running: false,
    routes: [],
    logs: [],
  },
};

// 所有预设场景
export const scenarios: Scenario[] = [
  classroomTemperatureScenario,
  smartIrrigationScenario,
];

// 加载场景
export function loadScenario(scenarioId: string) {
  return scenarios.find((s) => s.id === scenarioId);
}
