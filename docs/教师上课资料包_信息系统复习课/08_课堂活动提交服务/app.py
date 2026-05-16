# -*- coding: utf-8 -*-
"""课堂活动提交服务。

用途：
- 学生在活动页面中分环节提交答案。
- 教师通过受密码保护的后台查看学生进度、展开答案详情，并获得课堂参考评分。
"""

import json
import os
import sqlite3
from contextlib import contextmanager
from datetime import datetime
from pathlib import Path

from flask import Flask, Response, redirect, render_template, request, send_file, session, url_for

BASE_DIR = Path(__file__).resolve().parent
DB_PATH = Path(os.environ.get("ACTIVITY_DB_PATH", BASE_DIR / "activity_submissions.db"))
ADMIN_PASSWORD = os.environ.get("ACTIVITY_ADMIN_PASSWORD", "OpenClass@2026")
SECRET_KEY = os.environ.get("ACTIVITY_SECRET_KEY", "change-this-before-class")
ACTIVITY_PAGE_PATH = Path(os.environ.get("ACTIVITY_PAGE_PATH", BASE_DIR / "activity.html"))
TEACHER_BLANK_ENTRY_PATH = Path(
    os.environ.get("TEACHER_BLANK_ENTRY_PATH", BASE_DIR / "teacher-blank-entry.html")
)

SECTION_LABELS = {
    "hardware": "硬件搭建",
    "software": "软件分析",
    "debug": "运行排错",
    "summary": "知识总结",
}
SECTION_ORDER = ["hardware", "software", "debug", "summary"]
SECTION_MAX_SCORES = {
    "hardware": 20,
    "software": 40,
    "debug": 25,
    "summary": 15,
}

app = Flask(__name__, template_folder=str(BASE_DIR / "templates"))
app.secret_key = SECRET_KEY


def classroom_url(endpoint, **values):
    """生成当前访问前缀下的服务地址。"""

    path = url_for(endpoint, **values)
    if request.path.startswith("/activity-submit/") and not path.startswith("/activity-submit/"):
        return f"/activity-submit{path}"
    return path


@app.context_processor
def inject_classroom_url():
    return {"classroom_url": classroom_url}


@contextmanager
def get_conn():
    conn = sqlite3.connect(DB_PATH, timeout=10)
    conn.row_factory = sqlite3.Row
    try:
        yield conn
    finally:
        conn.close()


def normalize_answer(value):
    if value is None:
        return ""
    return str(value).strip().replace(" ", "").replace("　", "").lower()


def normalize_route(value):
    text = normalize_answer(value)
    if text and not text.startswith("/"):
        text = f"/{text}"
    return text


def normalize_url(value):
    return normalize_answer(value).rstrip("/")


def answer_list(value):
    if isinstance(value, list):
        return [normalize_answer(item) for item in value if normalize_answer(item)]
    if value is None or value == "":
        return []
    return [normalize_answer(value)]


def check_exact(answers, field, expected):
    return normalize_answer(answers.get(field)) == normalize_answer(expected)


def check_route(answers, field, expected):
    return normalize_route(answers.get(field)) == normalize_route(expected)


def check_any(answers, field, expected_values):
    actual = normalize_answer(answers.get(field))
    return actual in {normalize_answer(value) for value in expected_values}


def check_contains_any(answers, field, expected_keywords):
    actual = normalize_answer(answers.get(field))
    return any(normalize_answer(keyword) in actual for keyword in expected_keywords)


def check_url(answers, field):
    actual = normalize_url(answers.get(field))
    return actual == "http://192.168.1.100:5000"


def score_multi_select(answers, field, expected_values):
    expected = {normalize_answer(value) for value in expected_values}
    selected = set(answer_list(answers.get(field)))
    if not expected:
        return 0
    matched = len(selected & expected)
    wrong = len(selected - expected)
    return max(0, matched - wrong) / len(expected)


def add_check(checks, label, points, earned_ratio):
    ratio = max(0, min(1, float(earned_ratio)))
    earned = round(points * ratio, 1)
    if ratio >= 0.999:
        status = "正确"
    elif ratio > 0:
        status = "部分"
    else:
        status = "未得分"
    checks.append({
        "label": label,
        "points": points,
        "earned": earned,
        "status": status,
    })


def score_activity_section(section, answers):
    checks = []

    if section == "hardware":
        each = SECTION_MAX_SCORES[section] / 12
        expected = [
            ("sensorChoice", "选择温湿度传感器", "温湿度传感器"),
            ("actuatorChoice", "选择蜂鸣器", "蜂鸣器"),
            ("sensorDataPin", "传感器 DATA 接 P1", "P1"),
            ("buzzerIoPin", "蜂鸣器 IO 接 P2", "P2"),
            ("systemArchitecture", "系统架构判断为 B/S", "B/S"),
            ("moduleReadTemp", "读取温度数据由智能终端完成", "智能终端"),
            ("moduleThreshold", "阈值判断由智能终端完成", "智能终端"),
            ("moduleBuzzer", "蜂鸣器控制由智能终端完成", "智能终端"),
            ("moduleWifiHttp", "WiFi HTTP 请求由 IoT 模块发送", "IoT模块"),
            ("moduleReceiveUpload", "上传请求由 Flask 服务器接收", "Flask服务器"),
            ("moduleRenderPage", "网页查询渲染由 Flask 服务器完成", "Flask服务器"),
            ("moduleViewRealtime", "实时温度由浏览器 / 手机查看", "浏览器 / 手机"),
        ]
        for field, label, expected_value in expected:
            add_check(checks, label, each, 1 if check_exact(answers, field, expected_value) else 0)

    elif section == "software":
        each = SECTION_MAX_SCORES[section] / 16
        checks_to_run = [
            ("WiFi 名称 School_WiFi", check_exact(answers, "microbitWifiSsid", "School_WiFi")),
            ("路由器密码 12345678", check_exact(answers, "microbitWifiPassword", "12345678")),
            ("服务器 IP 192.168.1.100", check_exact(answers, "microbitServerIp", "192.168.1.100")),
            ("服务器端口 5000", check_exact(answers, "microbitServerPort", "5000")),
            ("智能终端上传路由 /upload", check_route(answers, "uploadRoute", "/upload")),
            ("GET 参数选择 id 和 val", score_multi_select(answers, "microbitGetParams", ["id", "val"])),
            ("阈值变量或阈值识别正确", check_any(answers, "microbitThreshold", ["TEMP_THRESHOLD", "30"])),
            ("读取温度引脚 P1", check_exact(answers, "microbitReadPin", "P1")),
            ("蜂鸣器控制引脚 P2", check_exact(answers, "microbitBuzzerPin", "P2")),
            ("Flask 上传路由 /upload", check_route(answers, "flaskUploadRoute", "/upload")),
            ("Flask 上传方法 GET", check_exact(answers, "flaskUploadMethod", "GET")),
            ("id 参数含义识别正确", check_contains_any(answers, "flaskIdParam", ["id", "传感器", "编号", "sensor"])),
            ("val 参数含义识别正确", check_contains_any(answers, "flaskValParam", ["val", "温度", "数值", "value"])),
            ("浏览器首页路由 /", check_route(answers, "viewRoute", "/")),
            ("模拟浏览器 URL 完整", check_url(answers, "softwareBrowserUrl")),
            ("能把 GET 上传和浏览器查询区分开", check_exact(answers, "flaskUploadMethod", "GET")),
        ]
        for label, passed in checks_to_run:
            ratio = passed if isinstance(passed, (int, float)) else (1 if passed else 0)
            add_check(checks, label, each, ratio)

    elif section == "debug":
        add_check(checks, "排错确认传感器 DATA 接 P1", 5, 1 if check_exact(answers, "debugSensorPin", "P1") else 0)
        add_check(checks, "排错确认蜂鸣器 IO 接 P2", 5, 1 if check_exact(answers, "debugBuzzerPin", "P2") else 0)
        add_check(checks, "浏览器 URL 填写完整", 6, 1 if check_url(answers, "browserUrl") else 0)
        add_check(
            checks,
            "优先排查代码、服务器、URL、网络等关键环节",
            9,
            score_multi_select(answers, "debugCauses", ["代码引脚与画布不一致", "Flask服务器未启动", "浏览器URL写错", "网络链路故障"]),
        )

    elif section == "summary":
        for field, label in [
            ("scorePins", "完成引脚识别自评"),
            ("scoreMicrobitParams", "完成智能终端参数自评"),
            ("scoreUrl", "完成 URL 书写自评"),
            ("scoreFault", "完成故障排查自评"),
            ("scoreDataFlow", "完成数据流向自评"),
        ]:
            add_check(checks, label, 2, 1 if normalize_answer(answers.get(field)) else 0)
        add_check(checks, "写出还需要复习的问题", 5, 1 if normalize_answer(answers.get("needReview")) else 0)

    max_score = SECTION_MAX_SCORES.get(section, round(sum(item["points"] for item in checks), 1))
    score = min(max_score, round(sum(item["earned"] for item in checks), 1))
    percent = min(100, round((score / max_score * 100) if max_score else 0))
    return {
        "score": score,
        "max_score": max_score,
        "percent": percent,
        "checks": checks,
    }


def parse_answers_json(raw):
    try:
        data = json.loads(raw or "{}")
        return data if isinstance(data, dict) else {}
    except json.JSONDecodeError:
        return {}


def build_section_entry(row):
    answers = parse_answers_json(row["answers_json"])
    score = score_activity_section(row["section"], answers)
    return {
        "id": row["id"],
        "section": row["section"],
        "section_label": SECTION_LABELS.get(row["section"], row["section"]),
        "answers": answers,
        "answers_pretty": json.dumps(answers, ensure_ascii=False, indent=2),
        "submitted_at": row["submitted_at"],
        "created_at": row["created_at"],
        "score": score,
    }


def init_db():
    with get_conn() as conn:
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


@app.route("/activity-submit/api/submit", methods=["OPTIONS"])
@app.route("/api/submit", methods=["OPTIONS"])
def submit_options():
    return Response(status=204)


@app.route("/activity-submit/api/submit", methods=["POST"])
@app.route("/api/submit", methods=["POST"])
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
    if section not in SECTION_LABELS:
        return {"error": "invalid section"}, 400
    if not isinstance(answers, dict):
        return {"error": "answers must be an object"}, 400

    with get_conn() as conn:
        result = conn.execute(
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
        "id": result.lastrowid,
        "className": class_name,
        "studentName": student_name,
        "section": section,
        "sectionLabel": SECTION_LABELS[section],
    }


@app.route("/activity-submit/")
@app.route("/activity-submit/activity")
@app.route("/activity")
def activity_page():
    if not ACTIVITY_PAGE_PATH.exists():
        return {"error": "activity page not found"}, 404
    return send_file(ACTIVITY_PAGE_PATH)


@app.route("/activity-submit/teacher-blank-entry")
@app.route("/activity-submit/teacher-blank-entry.html")
@app.route("/teacher-blank-entry")
def teacher_blank_entry_page():
    if not TEACHER_BLANK_ENTRY_PATH.exists():
        return {"error": "teacher blank entry page not found"}, 404
    return send_file(TEACHER_BLANK_ENTRY_PATH)


@app.route("/activity-submit/teacher/login", methods=["GET", "POST"])
@app.route("/teacher/login", methods=["GET", "POST"])
def teacher_login():
    error = ""
    if request.method == "POST":
        password = request.form.get("password", "")
        if password == ADMIN_PASSWORD:
            session["teacher_ok"] = True
            return redirect(classroom_url("teacher_dashboard"))
        error = "密码不正确"
    return render_template("login.html", error=error)


@app.route("/activity-submit/teacher/logout", methods=["POST"])
@app.route("/teacher/logout", methods=["POST"])
def teacher_logout():
    session.clear()
    return redirect(classroom_url("teacher_login"))


def require_teacher():
    return bool(session.get("teacher_ok"))


@app.route("/activity-submit/teacher")
@app.route("/teacher")
def teacher_dashboard():
    if not require_teacher():
        return redirect(classroom_url("teacher_login"))

    with get_conn() as conn:
        rows = conn.execute(
            """
            SELECT id, class_name, student_name, client_id, section, answers_json, page_url, submitted_at, created_at
            FROM activity_submissions
            ORDER BY created_at DESC, id DESC
            """
        ).fetchall()

    latest = {}
    for row in rows:
        key = (row["class_name"], row["student_name"], row["section"])
        if key not in latest:
            latest[key] = row

    students = {}
    for (class_name, student_name, section), row in latest.items():
        student_key = f"{class_name}::{student_name}"
        students.setdefault(student_key, {
            "class_name": class_name,
            "student_name": student_name,
            "sections": {},
        })
        students[student_key]["sections"][section] = build_section_entry(row)

    max_total_score = sum(SECTION_MAX_SCORES.values())
    student_cards = []
    for student in students.values():
        submitted_count = len(student["sections"])
        total_score = round(sum(entry["score"]["score"] for entry in student["sections"].values()), 1)
        updated_at = max((entry["created_at"] for entry in student["sections"].values()), default="")
        student["submitted_count"] = submitted_count
        student["completion_percent"] = round(submitted_count / len(SECTION_LABELS) * 100)
        student["total_score"] = total_score
        student["max_total_score"] = max_total_score
        student["score_percent"] = round(total_score / max_total_score * 100) if max_total_score else 0
        student["updated_at"] = updated_at
        student_cards.append(student)

    student_cards.sort(key=lambda item: (item["class_name"], item["student_name"]))

    recent_submissions = []
    for row in rows[:30]:
        entry = build_section_entry(row)
        entry["class_name"] = row["class_name"]
        entry["student_name"] = row["student_name"]
        recent_submissions.append(entry)

    total_students = len(student_cards)
    completed_students = sum(1 for student in student_cards if student["submitted_count"] == len(SECTION_LABELS))
    average_progress = round(
        sum(student["completion_percent"] for student in student_cards) / total_students
    ) if total_students else 0
    average_score = round(
        sum(student["score_percent"] for student in student_cards) / total_students
    ) if total_students else 0

    summary = {
        "total_submissions": len(rows),
        "total_students": total_students,
        "completed_students": completed_students,
        "average_progress": average_progress,
        "average_score": average_score,
    }

    return render_template(
        "teacher.html",
        students=student_cards,
        recent_submissions=recent_submissions,
        section_labels=SECTION_LABELS,
        section_order=SECTION_ORDER,
        summary=summary,
    )


@app.route("/activity-submit/health")
@app.route("/health")
def health():
    return {"status": "ok", "service": "classroom-activity-submit"}


init_db()


if __name__ == "__main__":
    app.run(host="0.0.0.0", port=int(os.environ.get("PORT", "5058")), debug=False)
