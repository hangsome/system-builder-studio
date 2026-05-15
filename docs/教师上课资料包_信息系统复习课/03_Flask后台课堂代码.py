# 存储间温度监测与预警系统 - Flask 服务端
# GET /upload?id=1&val=温度：接收 micro:bit 上传的温度数据
# GET  /      ：浏览器或手机访问首页查看最近的温度记录

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
    # 课堂约定：micro:bit 用 GET 请求上传，id 表示传感器编号，val 表示温度值。
    # 这里用 request.args.get(...) 读取 URL 参数。
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

    # 这里用模板渲染页面即可，不展开 HTML 模板代码，避免阅读负担过重。
    return render_template('index.html', records=rows)


if __name__ == '__main__':
    init_db()
    print("Flask 服务已启动：GET /upload?id=1&val=温度，GET /")
    app.run(host='0.0.0.0', port=5000)
