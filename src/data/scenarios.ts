import { Scenario } from '@/types/simulator';

// 教室温度监测系统场景
export const classroomTemperatureScenario: Scenario = {
  id: 'classroom-temperature',
  name: '教室温度监测系统',
  description: '使用温湿度传感器监测教室温度，数据通过WiFi发送到服务器存储',
  components: [
    {
      instanceId: 'microbit-1',
      definitionId: 'microbit',
      position: { x: 100, y: 100 },
      state: { powered: false, active: false },
    },
    {
      instanceId: 'expansion-1',
      definitionId: 'expansion-board',
      position: { x: 300, y: 80 },
      state: { powered: false, active: false },
    },
    {
      instanceId: 'temp-sensor-1',
      definitionId: 'temp-humidity-sensor',
      position: { x: 100, y: 280 },
      state: { powered: false, active: false, value: 25 },
    },
    {
      instanceId: 'obloq-1',
      definitionId: 'obloq',
      position: { x: 320, y: 280 },
      state: { powered: false, active: false },
    },
    {
      instanceId: 'router-1',
      definitionId: 'router',
      position: { x: 500, y: 150 },
      state: { powered: true, active: true },
    },
    {
      instanceId: 'server-1',
      definitionId: 'pc-server',
      position: { x: 650, y: 120 },
      state: { powered: true, active: true },
    },
    {
      instanceId: 'database-1',
      definitionId: 'database',
      position: { x: 650, y: 250 },
      state: { powered: true, active: true },
    },
  ],
  connections: [
    {
      id: 'conn-1',
      fromComponent: 'temp-sensor-1',
      fromPin: 'data',
      toComponent: 'expansion-1',
      toPin: 'p0',
      type: 'data',
      valid: true,
    },
    {
      id: 'conn-2',
      fromComponent: 'temp-sensor-1',
      fromPin: 'vcc',
      toComponent: 'expansion-1',
      toPin: '3v-out1',
      type: 'power',
      valid: true,
    },
    {
      id: 'conn-3',
      fromComponent: 'temp-sensor-1',
      fromPin: 'gnd',
      toComponent: 'expansion-1',
      toPin: 'gnd-out1',
      type: 'ground',
      valid: true,
    },
    {
      id: 'conn-4',
      fromComponent: 'obloq-1',
      fromPin: 'tx',
      toComponent: 'expansion-1',
      toPin: 'rx',
      type: 'serial',
      valid: true,
    },
    {
      id: 'conn-5',
      fromComponent: 'obloq-1',
      fromPin: 'rx',
      toComponent: 'expansion-1',
      toPin: 'tx',
      type: 'serial',
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
    connectedDevices: ['OBLOQ-001', 'PC-Server'],
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

// 智能灌溉系统场景
export const smartIrrigationScenario: Scenario = {
  id: 'smart-irrigation',
  name: '智能灌溉系统',
  description: '通过土壤湿度传感器检测土壤状态，自动控制继电器进行灌溉',
  components: [
    {
      instanceId: 'microbit-1',
      definitionId: 'microbit',
      position: { x: 100, y: 100 },
      state: { powered: false, active: false },
    },
    {
      instanceId: 'expansion-1',
      definitionId: 'expansion-board',
      position: { x: 300, y: 80 },
      state: { powered: false, active: false },
    },
    {
      instanceId: 'temp-sensor-1',
      definitionId: 'temp-humidity-sensor',
      position: { x: 100, y: 280 },
      state: { powered: false, active: false, value: 40 },
    },
    {
      instanceId: 'relay-1',
      definitionId: 'relay',
      position: { x: 200, y: 280 },
      state: { powered: false, active: false },
    },
  ],
  connections: [],
  microbitCode: `# 智能灌溉系统
from microbit import *

# 湿度阈值
THRESHOLD = 30

while True:
    # 读取土壤湿度
    humidity = pin0.read_analog() / 10
    
    # 显示湿度值
    display.scroll(str(int(humidity)))
    
    # 判断是否需要灌溉
    if humidity < THRESHOLD:
        # 开启继电器（灌溉）
        pin1.write_digital(1)
        display.show(Image.ARROW_S)
    else:
        # 关闭继电器
        pin1.write_digital(0)
        display.show(Image.HAPPY)
    
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
