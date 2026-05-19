from __future__ import annotations

import json
import sqlite3
from datetime import datetime, timezone
from pathlib import Path

from flask import Flask, jsonify, request, send_file


ROOT = Path(__file__).resolve().parents[1]
HTML_PATH = ROOT / "docs" / "信息系统复习课活动页面.html"
DB_PATH = ROOT / "docs" / "student_progress.sqlite3"

app = Flask(__name__)


def db() -> sqlite3.Connection:
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    conn.execute(
        """
        CREATE TABLE IF NOT EXISTS activity_progress (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            student_id TEXT NOT NULL,
            student_name TEXT,
            class_name TEXT,
            activity_id TEXT NOT NULL,
            score INTEGER NOT NULL,
            total INTEGER NOT NULL,
            answers_json TEXT NOT NULL,
            issues_json TEXT NOT NULL,
            submitted_at TEXT NOT NULL,
            received_at TEXT NOT NULL,
            UNIQUE(student_id, activity_id)
        )
        """
    )
    return conn


@app.after_request
def add_cors_headers(response):
    response.headers["Access-Control-Allow-Origin"] = "*"
    response.headers["Access-Control-Allow-Headers"] = "Content-Type"
    response.headers["Access-Control-Allow-Methods"] = "GET, POST, OPTIONS"
    return response


@app.route("/")
def activity_page():
    return send_file(HTML_PATH)


@app.route("/api/progress", methods=["OPTIONS"])
def progress_options():
    return ("", 204)


@app.route("/api/progress", methods=["POST"])
def save_progress():
    payload = request.get_json(silent=True) or {}
    required = ["student_id", "activity_id", "answers", "score", "total", "issues"]
    missing = [key for key in required if key not in payload]
    if missing:
        return jsonify({"ok": False, "error": "missing_fields", "fields": missing}), 400

    student_id = str(payload["student_id"]).strip() or "未填班级-未填姓名"
    activity_id = str(payload["activity_id"]).strip()
    if not activity_id:
        return jsonify({"ok": False, "error": "missing_activity_id"}), 400

    now = datetime.now(timezone.utc).isoformat()
    submitted_at = str(payload.get("submitted_at") or now)

    with db() as conn:
        conn.execute(
            """
            INSERT INTO activity_progress (
                student_id, student_name, class_name, activity_id,
                score, total, answers_json, issues_json, submitted_at, received_at
            )
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            ON CONFLICT(student_id, activity_id) DO UPDATE SET
                student_name=excluded.student_name,
                class_name=excluded.class_name,
                score=excluded.score,
                total=excluded.total,
                answers_json=excluded.answers_json,
                issues_json=excluded.issues_json,
                submitted_at=excluded.submitted_at,
                received_at=excluded.received_at
            """,
            (
                student_id,
                str(payload.get("student_name") or ""),
                str(payload.get("class_name") or ""),
                activity_id,
                int(payload.get("score") or 0),
                int(payload.get("total") or 0),
                json.dumps(payload.get("answers") or {}, ensure_ascii=False),
                json.dumps(payload.get("issues") or [], ensure_ascii=False),
                submitted_at,
                now,
            ),
        )

    return jsonify({"ok": True, "student_id": student_id, "activity_id": activity_id})


@app.route("/api/progress/summary")
def progress_summary():
    with db() as conn:
        rows = conn.execute(
            """
            SELECT activity_id,
                   COUNT(*) AS submitted_count,
                   AVG(CASE WHEN total = 0 THEN 0 ELSE 1.0 * score / total END) AS avg_rate
            FROM activity_progress
            GROUP BY activity_id
            ORDER BY activity_id
            """
        ).fetchall()
        issue_rows = conn.execute("SELECT activity_id, issues_json FROM activity_progress").fetchall()

    common_issues: dict[str, dict[str, int]] = {}
    for row in issue_rows:
        activity = row["activity_id"]
        common_issues.setdefault(activity, {})
        for issue in json.loads(row["issues_json"] or "[]"):
            label = issue.get("label") or issue.get("question") or "未知题目"
            common_issues[activity][label] = common_issues[activity].get(label, 0) + 1

    return jsonify(
        {
            "ok": True,
            "activities": [
                {
                    "activity_id": row["activity_id"],
                    "submitted_count": row["submitted_count"],
                    "avg_rate": round(float(row["avg_rate"] or 0), 3),
                    "common_issues": sorted(
                        common_issues.get(row["activity_id"], {}).items(),
                        key=lambda item: item[1],
                        reverse=True,
                    ),
                }
                for row in rows
            ],
        }
    )


@app.route("/api/progress/students")
def progress_students():
    with db() as conn:
        rows = conn.execute(
            """
            SELECT student_id, student_name, class_name, activity_id, score, total, issues_json, received_at
            FROM activity_progress
            ORDER BY class_name, student_name, activity_id
            """
        ).fetchall()
    return jsonify(
        {
            "ok": True,
            "submissions": [
                {
                    "student_id": row["student_id"],
                    "student_name": row["student_name"],
                    "class_name": row["class_name"],
                    "activity_id": row["activity_id"],
                    "score": row["score"],
                    "total": row["total"],
                    "issues": json.loads(row["issues_json"] or "[]"),
                    "received_at": row["received_at"],
                }
                for row in rows
            ],
        }
    )


if __name__ == "__main__":
    print("学生作答页：http://127.0.0.1:5055/")
    print("进度汇总：http://127.0.0.1:5055/api/progress/summary")
    app.run(host="0.0.0.0", port=5055, debug=False)
