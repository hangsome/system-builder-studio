import type { DatabaseState, RouterConfig, ServerConfig } from '@/types/simulator';

export const CLASSROOM_TEMPERATURE_THRESHOLD = 30;

export const classroomStarterMicrobitCode = `# 教室温度检测系统 - micro:bit 端
# 本段代码用于软件分析与运行测试。先读懂数据采集、阈值判断和网络上传流程。

from microbit import *
import obloq

# 网络参数：要和画布中的 WiFi 路由器、Flask 服务器保持一致
WIFI_SSID = "School_WiFi"
WIFI_PASSWORD = "12345678"
SERVER_IP = "192.168.1.100"
SERVER_PORT = 5000
UPLOAD_ROUTE = "/upload"
TEMP_THRESHOLD = 30

obloq.setup(WIFI_SSID, WIFI_PASSWORD)

while True:
    # 读取温度采集
    raw = pin1.read_analog()
    temp = round(raw / 10, 1)
    display.scroll(str(temp))

    # 超过阈值时控制蜂鸣器报警
    if temp > TEMP_THRESHOLD:
        pin2.write_digital(1)
    else:
        pin2.write_digital(0)

    # 上传采集数据：GET 请求带两个参数，id 表示传感器编号，val 表示温度值
    url = "http://" + SERVER_IP + ":" + str(SERVER_PORT) + UPLOAD_ROUTE + "?id=1&val=" + str(temp)
    obloq.http_get(url)

    sleep(5000)
`;

export const classroomFlaskCode = `# 教室温度检测系统 - Flask 服务端
# GET /upload?id=1&val=温度：接收 micro:bit 上传的温度数据
# GET /                  ：浏览器或手机访问首页查看最近的温度记录

from flask import Flask, request, render_template
import sqlite3
from datetime import datetime

app = Flask(__name__)
TEMP_THRESHOLD = 30

def init_db():
    # 初始化数据库：真实项目第一次运行时，需要创建 sensorlog 表。
    # 本节复习课不要求同学阅读完整建表 SQL；模拟器已经预置好表结构。
    return

@app.route('/upload', methods=['GET'])
def upload_data():
    # micro:bit 使用 GET /upload?id=1&val=温度 上传采集结果。
    # 这里用 request.args.get(...) 读取 URL 查询参数 id 和 val。
    temperature = request.args.get('val')
    sensor_id = request.args.get('id', 1)
    if temperature is None:
        return "缺少 val", 400

    temperature = float(temperature)
    alarm = 1 if temperature > TEMP_THRESHOLD else 0

    conn = sqlite3.connect('sensor.db')
    cursor = conn.cursor()
    cursor.execute(
        'INSERT INTO sensorlog (sensor_id, value, alarm, timestamp) VALUES (?, ?, ?, ?)',
        (sensor_id, temperature, alarm, datetime.now())
    )
    conn.commit()
    conn.close()

    command = "BUZZER_ON" if alarm else "BUZZER_OFF"
    return "success:" + command

@app.route('/', methods=['GET'])
def index():
    # 浏览器地址栏访问首页属于 GET 请求，用于查询并展示数据。
    conn = sqlite3.connect('sensor.db')
    cursor = conn.cursor()
    cursor.execute('SELECT id, sensor_id, value, alarm, timestamp FROM sensorlog ORDER BY id DESC LIMIT 10')
    rows = cursor.fetchall()
    conn.close()
    # 这里用模板渲染页面即可，不展开 HTML 模板代码。
    return render_template('index.html', records=rows)

if __name__ == '__main__':
    init_db()
    print("Flask 服务已启动：GET /upload?id=1&val=温度，GET /")
    app.run(host='192.168.1.100', port=5000)
`;

export const classroomDatabase: DatabaseState = {
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
        { name: 'alarm', type: 'INTEGER' },
        { name: 'timestamp', type: 'DATETIME' },
      ],
    },
  ],
  records: {
    sensorlist: [
      { id: 1, name: '教室温度传感器', type: 'temperature', location: '教室前排' },
    ],
    sensorlog: [],
  },
};

export const classroomRouterConfig: RouterConfig = {
  ssid: 'School_WiFi',
  password: '12345678',
  ip: '192.168.1.1',
  connectedDevices: ['IoT-001', 'Flask-Server'],
};

export const classroomServerConfig: ServerConfig = {
  ip: '192.168.1.100',
  port: 5000,
  running: false,
  routes: [
    { path: '/upload', method: 'GET', handler: 'upload_data' },
    { path: '/', method: 'GET', handler: 'index' },
  ],
  logs: [],
};
