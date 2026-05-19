
# 课堂活动提交服务

这个 Flask 服务用于单独接收 `老师上课带学生用_活动页面.html` 中每个环节的学生作答进度，并提供教师后台查看。

## 运行

```bash
cd 08_课堂活动提交服务
python -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
export ACTIVITY_ADMIN_PASSWORD='请改成教师自己的密码'
python app.py
```

默认端口：`5058`

## 学生活动页如何连接

新版活动页默认会把提交请求发送到：

```text
http://159.75.213.93/activity-submit/api/submit
```

如果临时改为教师机本地接收，可在打开活动页时添加参数：

```text
老师上课带学生用_活动页面.html?api=http://教师电脑IP:5058
```

学生页面只显示学生半成品画布入口，不显示教师后台入口。

## 教师后台

```text
http://教师电脑IP:5058/teacher
```

进入后台需要 `ACTIVITY_ADMIN_PASSWORD` 设置的密码。未设置时默认密码是 `OpenClass@2026`，正式上课建议修改。

如果部署到学校服务器并使用统一前缀，也可以访问：

```text
http://服务器地址/activity-submit/teacher
```

## 接口

- `POST /api/submit`：学生分环节提交答案。
- `POST /activity-submit/api/submit`：带统一前缀时的提交接口。
- `GET /teacher`：教师查看提交情况，需要登录。
- `GET /health`：服务健康检查。

提交时必须包含：

- `className`：班级
- `studentName`：姓名
- `section`：活动环节
- `answers`：本环节作答
