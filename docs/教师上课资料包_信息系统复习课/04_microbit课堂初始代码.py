# 存储间温度监测与预警系统 - micro:bit 端
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
    url = "http://" + SERVER_IP + ":" + str(SERVER_PORT) + UPLOAD_ROUTE
    url = url + "?id=1&val=" + str(temp)
    obloq.http_get(url)

    sleep(5000)
