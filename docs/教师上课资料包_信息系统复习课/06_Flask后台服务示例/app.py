# 存储间温度监测与预警系统 - Flask 后台服务示例
# 用途：给教师备课、课堂讲解或本地演示使用。
# 路由设计：
#   GET /upload?id=1&val=温度   micro:bit 上传温度数据
#   GET  /         浏览器/手机查看最近温度记录
#   GET  /teacher  教师查看数据与报警统计，同时查看课堂活动提交
#   POST /api/submit  接收“老师上课带学生用_活动页面.html”的学生作答

from flask import Flask, Response, request, render_template, redirect, send_file, url_for
import json
import sqlite3
from datetime import datetime
from pathlib import Path

BASE_DIR = Path(__file__).resolve().parent
app = Flask(__name__, template_folder=str(BASE_DIR / "templates"))

DB_PATH = BASE_DIR / "sensor.db"
TEMP_THRESHOLD = 30
ACTIVITY_SECTION_LABELS = {
    "hardware": "硬件观察",
    "software": "软件分析",
    "debug": "运行排错",
    "summary": "知识总结",
}


def get_conn():
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    return conn


def init_db():
    # 初始化数据库：真实项目第一次运行时，需要创建数据表。
    # 学生课堂阅读时不必展开所有 SQL，只要理解 sensorlog 用来保存温度记录即可。
    with get_conn() as conn:
        conn.execute(
            """
            CREATE TABLE IF NOT EXISTS sensorlog (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                sensor_id INTEGER NOT NULL,
                value REAL NOT NULL,
                alarm INTEGER NOT NULL DEFAULT 0,
                timestamp TEXT NOT NULL
            )
            """
        )
        conn.execute(
            """
            CREATE TABLE IF NOT EXISTS activity_submissions (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                class_name TEXT NOT NULL DEFAULT '',
                student_name TEXT NOT NULL,
                client_id TEXT,
                section TEXT NOT NULL,
                answers_json TEXT NOT NULL,
                page_url TEXT,
                submitted_at TEXT NOT NULL,
                created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
            )
            """
        )
        columns = {
            row["name"]
            for row in conn.execute("PRAGMA table_info(activity_submissions)").fetchall()
        }
        if "class_name" not in columns:
            conn.execute("ALTER TABLE activity_submissions ADD COLUMN class_name TEXT NOT NULL DEFAULT ''")
        conn.execute("CREATE INDEX IF NOT EXISTS idx_activity_class ON activity_submissions(class_name)")
        conn.execute("CREATE INDEX IF NOT EXISTS idx_activity_student ON activity_submissions(student_name)")
        conn.execute("CREATE INDEX IF NOT EXISTS idx_activity_section ON activity_submissions(section)")
        conn.execute("CREATE INDEX IF NOT EXISTS idx_activity_created ON activity_submissions(created_at DESC)")
        conn.commit()


@app.after_request
def add_cors_headers(response):
    if request.path.startswith("/api/") or request.path.startswith("/activity-submit/api/"):
        response.headers["Access-Control-Allow-Origin"] = "*"
        response.headers["Access-Control-Allow-Headers"] = "Content-Type"
        response.headers["Access-Control-Allow-Methods"] = "GET, POST, OPTIONS"
    return response


@app.route("/api/submit", methods=["OPTIONS"])
@app.route("/activity-submit/api/submit", methods=["OPTIONS"])
def submit_activity_options():
    return Response(status=204)


@app.route("/api/submit", methods=["POST"])
@app.route("/activity-submit/api/submit", methods=["POST"])
def submit_activity():
    payload = request.get_json(silent=True) or {}
    class_name = str(payload.get("className", "")).strip()
    student_name = str(payload.get("studentName", "")).strip()
    section = str(payload.get("section", "")).strip()
    answers = payload.get("answers") or {}
    client_id = str(payload.get("clientId", "")).strip()
    page_url = str(payload.get("pageUrl", "")).strip()
    submitted_at = str(payload.get("submittedAt", "")).strip() or datetime.now().isoformat(timespec="seconds")

    if not class_name or not student_name:
        return {"error": "className and studentName are required"}, 400
    if section not in ACTIVITY_SECTION_LABELS:
        return {"error": "invalid section"}, 400
    if not isinstance(answers, dict):
        return {"error": "answers must be an object"}, 400

    with get_conn() as conn:
        cursor = conn.execute(
            """
            INSERT INTO activity_submissions
              (class_name, student_name, client_id, section, answers_json, page_url, submitted_at)
            VALUES (?, ?, ?, ?, ?, ?, ?)
            """,
            (
                class_name,
                student_name,
                client_id,
                section,
                json.dumps(answers, ensure_ascii=False),
                page_url,
                submitted_at,
            ),
        )
        conn.commit()

    return {
        "success": True,
        "id": cursor.lastrowid,
        "className": class_name,
        "studentName": student_name,
        "section": section,
        "sectionLabel": ACTIVITY_SECTION_LABELS[section],
    }


def build_activity_students(rows):
    latest = {}
    for row in rows:
        key = (row["class_name"], row["student_name"], row["section"])
        if key not in latest:
            latest[key] = row

    students = {}
    for (class_name, student_name, section), row in latest.items():
        student_key = f"{class_name}｜{student_name}"
        students.setdefault(student_key, {"class_name": class_name, "student_name": student_name, "sections": {}})
        answers = json.loads(row["answers_json"] or "{}")
        students[student_key]["sections"][section] = {
            "id": row["id"],
            "answers": answers,
            "answers_pretty": json.dumps(answers, ensure_ascii=False, indent=2),
            "submitted_at": row["submitted_at"],
            "created_at": row["created_at"],
        }
    return students


@app.route("/upload", methods=["GET"])
def upload_data():
    # 课堂约定：micro:bit 用 GET 请求上传，id 表示传感器编号，val 表示温度值。
    # 这里用 request.args.get(...) 读取 URL 参数。
    temperature = request.args.get("val")
    sensor_id = request.args.get("id", 1)

    if temperature is None:
        return "缺少 val", 400

    temperature = float(temperature)
    alarm = 1 if temperature > TEMP_THRESHOLD else 0

    with get_conn() as conn:
        cursor = conn.execute(
            "INSERT INTO sensorlog (sensor_id, value, alarm, timestamp) VALUES (?, ?, ?, ?)",
            (sensor_id, temperature, alarm, datetime.now().strftime("%Y-%m-%d %H:%M:%S")),
        )
        conn.commit()
        row_id = cursor.lastrowid

    command = "BUZZER_ON" if alarm else "BUZZER_OFF"
    return f"success:{row_id}:{temperature}:{alarm}:{command}"


@app.route("/", methods=["GET"])
def index():
    # 浏览器地址栏访问首页属于 GET 请求，用于查询并展示数据。
    with get_conn() as conn:
        rows = conn.execute(
            "SELECT id, sensor_id, value, alarm, timestamp FROM sensorlog ORDER BY id DESC LIMIT 10"
        ).fetchall()
    return render_template("index.html", records=rows, threshold=TEMP_THRESHOLD)


@app.route("/activity", methods=["GET"])
def activity_page():
    host_name = request.host.split(":", 1)[0]
    if not request.args.get("api") and host_name in ("127.0.0.1", "localhost"):
        return redirect(url_for("activity_page", api=request.host_url.rstrip("/")))
    for file_name in ("老师上课带学生用_活动页面.html", "活动页面.html"):
        activity_file = BASE_DIR.parent / file_name
        if activity_file.exists():
            return send_file(activity_file)
    return "未找到活动页面.html", 404


@app.route("/teacher", methods=["GET"])
def teacher_dashboard():
    # 教师查看页：用于课堂中观察数据是否实时新增、是否触发报警。
    with get_conn() as conn:
        rows = conn.execute(
            "SELECT id, sensor_id, value, alarm, timestamp FROM sensorlog ORDER BY id DESC LIMIT 50"
        ).fetchall()
        total = conn.execute("SELECT COUNT(*) AS c FROM sensorlog").fetchone()["c"]
        alarm_count = conn.execute("SELECT COUNT(*) AS c FROM sensorlog WHERE alarm = 1").fetchone()["c"]
        latest = conn.execute(
            "SELECT value, alarm, timestamp FROM sensorlog ORDER BY id DESC LIMIT 1"
        ).fetchone()
        activity_rows = conn.execute(
            """
            SELECT id, class_name, student_name, client_id, section, answers_json, page_url, submitted_at, created_at
            FROM activity_submissions
            ORDER BY class_name ASC, student_name ASC, created_at DESC, id DESC
            """
        ).fetchall()

    return render_template(
        "teacher.html",
        records=rows,
        total=total,
        alarm_count=alarm_count,
        latest=latest,
        threshold=TEMP_THRESHOLD,
        activity_rows=activity_rows,
        activity_students=build_activity_students(activity_rows),
        activity_section_labels=ACTIVITY_SECTION_LABELS,
        activity_total=len(activity_rows),
    )


@app.route("/teacher/reset", methods=["POST"])
def reset_records():
    # 备课或重复演示时可清空记录。正式课堂慎用。
    with get_conn() as conn:
        conn.execute("DELETE FROM sensorlog")
        conn.commit()
    return redirect(url_for("teacher_dashboard"))


@app.route("/teacher/reset-activity", methods=["POST"])
def reset_activity_records():
    with get_conn() as conn:
        conn.execute("DELETE FROM activity_submissions")
        conn.commit()
    return redirect(url_for("teacher_dashboard"))


@app.route("/health", methods=["GET"])
def health():
    return {"status": "ok", "service": "flask-sensor-and-activity-demo"}


if __name__ == "__main__":
    init_db()
    print("Flask 服务已启动：")
    print("  学生/浏览器查询：http://127.0.0.1:5000/")
    print("  学生活动页面：   http://127.0.0.1:5000/activity")
    print("  micro:bit 上传：  GET http://127.0.0.1:5000/upload?id=1&val=31.5")
    print("  活动页提交：     POST http://127.0.0.1:5000/api/submit")
    print("  教师查看数据：   http://127.0.0.1:5000/teacher")
    app.run(host="0.0.0.0", port=5000, debug=True)
