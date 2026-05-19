
# Flask 后台服务示例

这是“存储间温度监测与预警信息系统”的本地 Flask 后台服务示例。课堂正式使用时，学生仍然进入服务器模拟画布；本示例主要用于教师备课、代码讲解或本地演示。

## 运行方式

```bash
cd 06_Flask后台服务示例
python -m venv .venv
source .venv/bin/activate  # Windows PowerShell 可用 .venv\Scripts\Activate.ps1
pip install -r requirements.txt
python app.py
```

## 页面与接口

- 学生/浏览器查询页：`http://127.0.0.1:5000/`
- micro:bit 上传接口：`GET http://127.0.0.1:5000/upload?id=1&val=温度值`
- 教师数据查看页：`http://127.0.0.1:5000/teacher`

## 测试上传

```bash
curl "http://127.0.0.1:5000/upload?id=1&val=31.5"
```

## 课堂讲解重点

- `GET /upload?id=1&val=温度值`：micro:bit 上传采集到的温度。
- `GET /`：浏览器或手机查询最近数据，使用 `render_template` 渲染页面。
- `/teacher`：教师查看数据库记录和报警统计。
- `sensorlog`：保存温度值、报警状态、时间戳，是排查系统运行状态的证据。
