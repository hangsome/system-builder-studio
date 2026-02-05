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
      instanceId: 'pc-1',
      definitionId: 'pc-computer',
      position: { x: 60, y: -120 },
      state: { powered: true, active: true },
    },
    {
      instanceId: 'server-1',
      definitionId: 'web-server',
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
      id: 'conn-mb-usb',
      fromComponent: 'microbit-1',
      fromPin: 'usb',
      toComponent: 'pc-1',
      toPin: 'usb',
      type: 'data',
      valid: true,
    },
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
  microbitCode: `# ============================================
# 教室温度监测系统 - micro:bit 端代码
# ============================================
# 功能：采集教室温度，通过WiFi上传到服务器
# 硬件：micro:bit + 扩展板 + 温湿度传感器 + IoT模块
# 通信：HTTP GET 请求（参数附加在URL后）
# ============================================

from microbit import *
import obloq  # 导入OBLOQ物联网模块库

# ========== 配置参数 ==========
# WiFi连接配置
WIFI_SSID = "School_WiFi"      # 学校WiFi名称
WIFI_PASSWORD = "12345678"     # WiFi密码

# 服务器配置
SERVER_IP = "192.168.1.100"    # Flask服务器IP
SERVER_PORT = 5000             # 服务器端口

# 报警阈值
TEMP_THRESHOLD = 30            # 超过此温度触发蜂鸣器报警

# ========== 初始化 ==========
# 连接WiFi网络
obloq.setup(WIFI_SSID, WIFI_PASSWORD)

# ========== 主循环 ==========
while True:
    # 1. 读取温度传感器数据
    temp = temperature()
    
    # 2. LED点阵显示当前温度
    display.scroll(str(temp))
    
    # 3. 温度报警检测
    if temp > TEMP_THRESHOLD:
        pin3.write_digital(1)  # 触发蜂鸣器
    else:
        pin3.write_digital(0)  # 关闭蜂鸣器
    
    # 4. 构建GET请求URL
    # 格式：/upload?temperature=数值
    url = "http://" + SERVER_IP + ":" + str(SERVER_PORT)
    url = url + "/upload?temperature=" + str(temp)
    
    # 5. 发送HTTP GET请求上传数据
    obloq.http_get(url)
    
    # 6. 等待5秒后再次采集
    sleep(5000)
`,
  flaskCode: `# ============================================
# Flask 服务器 - 教室温度监测系统
# ============================================
# 功能：接收micro:bit上传的温度数据，存入SQLite数据库
# 接口说明：
#   GET /upload?temperature=数值  - 接收温度数据
#   GET /query                    - 查询最近10条记录
# ============================================

from flask import Flask, request, jsonify
import sqlite3
from datetime import datetime

app = Flask(__name__)

# ========== 数据库初始化函数 ==========
def init_db():
    """
    创建SQLite数据库和表结构
    表 sensorlog：存储传感器历史数据
    """
    conn = sqlite3.connect('sensor.db')
    cursor = conn.cursor()
    cursor.execute('''
        CREATE TABLE IF NOT EXISTS sensorlog (
            id INTEGER PRIMARY KEY AUTOINCREMENT,  -- 自增主键
            sensor_id INTEGER,                     -- 传感器ID
            value REAL,                            -- 传感器数值
            timestamp DATETIME                     -- 记录时间
        )
    ''')
    conn.commit()
    conn.close()

# ========== 数据接收接口 ==========
# 使用GET方法，参数通过URL传递
# 请求示例：GET /upload?temperature=25.5
@app.route('/upload', methods=['GET'])
def upload_data():
    # 1. 从URL中提取temperature参数
    # request.args.get() 用于获取GET请求的查询参数
    temperature = request.args.get('temperature', type=float)
    
    # 2. 参数校验
    if temperature is None:
        return jsonify({
            "status": "error",
            "message": "缺少temperature参数"
        })
    
    # 3. 将数据插入数据库
    conn = sqlite3.connect('sensor.db')
    cursor = conn.cursor()
    cursor.execute('''
        INSERT INTO sensorlog (sensor_id, value, timestamp)
        VALUES (1, ?, ?)
    ''', (temperature, datetime.now()))
    conn.commit()
    conn.close()
    
    # 4. 打印日志并返回成功响应
    print(f"[数据接收] 温度: {temperature}°C，时间: {datetime.now()}")
    return jsonify({
        "status": "success",
        "temperature": temperature,
        "message": "数据已保存"
    })

# ========== 数据查询接口 ==========
# 返回最近10条传感器记录
@app.route('/query', methods=['GET'])
def query_data():
    conn = sqlite3.connect('sensor.db')
    cursor = conn.cursor()
    # 按ID倒序排列，获取最新的10条记录
    cursor.execute('SELECT * FROM sensorlog ORDER BY id DESC LIMIT 10')
    rows = cursor.fetchall()
    conn.close()
    return jsonify(rows)

# ========== 服务器启动入口 ==========
if __name__ == '__main__':
    init_db()  # 先初始化数据库
    print("="*40)
    print("教室温度监测服务器已启动")
    print("数据接收: GET /upload?temperature=数值")
    print("数据查询: GET /query")
    print("="*40)
    app.run(host='0.0.0.0', port=5000, debug=True)
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
      { path: '/upload', method: 'GET', handler: 'upload_data' },
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
      definitionId: 'pc-computer',
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
