const express = require('express');
const bcrypt = require('bcryptjs');
const { getDatabase } = require('../db/init');
const { authMiddleware, requireRole } = require('../middleware/auth');
const { scenarioCatalog, getScenarioById } = require('../services/scenarioCatalog');
const { scoreSubmission, resolveAssignmentConfig } = require('../services/scoring');

const router = express.Router();

router.use(authMiddleware);

function parseCsvText(csvText) {
  const text = String(csvText || '').trim();
  if (!text) return [];

  const lines = text
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);

  if (lines.length === 0) return [];

  const header = lines[0].split(',').map((cell) => cell.trim());
  const body = lines.slice(1);

  return body.map((line) => {
    const cells = line.split(',').map((cell) => cell.trim());
    const row = {};
    header.forEach((key, index) => {
      row[key] = cells[index] || '';
    });
    return row;
  });
}

function generateClassCode() {
  return `CLS${Date.now().toString(36).toUpperCase()}${Math.random().toString(36).slice(2, 6).toUpperCase()}`;
}

function assertClassWritable(db, classId, user) {
  const classRow = db.prepare('SELECT * FROM classes WHERE id = ?').get(classId);
  if (!classRow) return { ok: false, status: 404, error: 'Class not found' };

  if (user.role === 'admin') return { ok: true, classRow };
  if (user.role === 'teacher' && Number(classRow.teacher_id) === Number(user.sub)) {
    return { ok: true, classRow };
  }

  return { ok: false, status: 403, error: 'No permission for this class' };
}

function parseJsonField(jsonText, fallback = null) {
  if (!jsonText) return fallback;
  try {
    return JSON.parse(jsonText);
  } catch (error) {
    return fallback;
  }
}

router.get('/scenarios', (req, res) => {
  return res.json({ scenarios: scenarioCatalog });
});

router.post('/admin/teachers', requireRole('admin'), (req, res) => {
  const { username, displayName, password } = req.body;
  if (!username || !displayName || !password) {
    return res.status(400).json({ error: 'username, displayName and password are required' });
  }

  const db = getDatabase();
  const exists = db.prepare('SELECT id FROM users WHERE username = ?').get(String(username).trim());
  if (exists) {
    return res.status(409).json({ error: 'username already exists' });
  }

  const hash = bcrypt.hashSync(String(password), 10);
  const result = db.prepare(`
    INSERT INTO users (username, password_hash, role, display_name, must_change_password, status)
    VALUES (?, ?, 'teacher', ?, 1, 'active')
  `).run(String(username).trim(), hash, String(displayName).trim());

  return res.json({
    success: true,
    teacher: {
      id: result.lastInsertRowid,
      username: String(username).trim(),
      displayName: String(displayName).trim(),
    },
  });
});

router.get('/admin/teachers', requireRole('admin'), (req, res) => {
  const db = getDatabase();
  const teachers = db.prepare(`
    SELECT id, username, display_name, status, created_at
    FROM users
    WHERE role = 'teacher'
    ORDER BY created_at DESC
  `).all();

  return res.json({ teachers });
});

router.delete('/admin/teachers/:teacherId', requireRole('admin'), (req, res) => {
  const teacherId = Number(req.params.teacherId);
  if (!teacherId) {
    return res.status(400).json({ error: 'teacherId is invalid' });
  }

  const db = getDatabase();
  const teacher = db.prepare(`
    SELECT id, username, display_name
    FROM users
    WHERE id = ? AND role = 'teacher'
  `).get(teacherId);

  if (!teacher) {
    return res.status(404).json({ error: 'teacher not found' });
  }

  const classCountRow = db.prepare('SELECT COUNT(*) AS total FROM classes WHERE teacher_id = ?').get(teacherId);
  const classCount = Number(classCountRow?.total || 0);
  const result = db.prepare('DELETE FROM users WHERE id = ? AND role = ?').run(teacherId, 'teacher');
  if (result.changes === 0) {
    return res.status(404).json({ error: 'teacher not found' });
  }

  return res.json({
    success: true,
    teacher: {
      id: teacher.id,
      username: teacher.username,
      displayName: teacher.display_name,
      deletedClassCount: classCount,
    },
  });
});

router.post('/classes', requireRole('teacher', 'admin'), (req, res) => {
  const { name, term = '', teacherId } = req.body;
  if (!name) {
    return res.status(400).json({ error: 'name is required' });
  }

  const db = getDatabase();
  const effectiveTeacherId = req.user.role === 'admin'
    ? Number(teacherId || 0)
    : Number(req.user.sub);

  if (!effectiveTeacherId) {
    return res.status(400).json({ error: 'teacherId is required for admin' });
  }

  const teacher = db.prepare("SELECT id FROM users WHERE id = ? AND role = 'teacher'").get(effectiveTeacherId);
  if (!teacher) {
    return res.status(404).json({ error: 'teacher not found' });
  }

  const classCode = generateClassCode();
  const result = db.prepare(`
    INSERT INTO classes (name, class_code, teacher_id, term)
    VALUES (?, ?, ?, ?)
  `).run(String(name).trim(), classCode, effectiveTeacherId, String(term || '').trim());

  return res.json({
    success: true,
    class: {
      id: result.lastInsertRowid,
      name: String(name).trim(),
      classCode,
      teacherId: effectiveTeacherId,
      term: String(term || '').trim(),
    },
  });
});

router.get('/classes', requireRole('teacher', 'admin', 'student'), (req, res) => {
  const db = getDatabase();

  if (req.user.role === 'student') {
    const classes = db.prepare(`
      SELECT c.id, c.name, c.class_code, c.term, c.teacher_id,
             u.display_name as teacher_name,
             cs.student_no
      FROM class_students cs
      JOIN classes c ON c.id = cs.class_id
      JOIN users u ON u.id = c.teacher_id
      WHERE cs.student_id = ?
      ORDER BY c.created_at DESC
    `).all(Number(req.user.sub));

    return res.json({ classes });
  }

  if (req.user.role === 'teacher') {
    const classes = db.prepare(`
      SELECT c.id, c.name, c.class_code, c.term, c.teacher_id,
             (SELECT COUNT(*) FROM class_students cs WHERE cs.class_id = c.id) AS student_count
      FROM classes c
      WHERE c.teacher_id = ?
      ORDER BY c.created_at DESC
    `).all(Number(req.user.sub));

    return res.json({ classes });
  }

  const classes = db.prepare(`
    SELECT c.id, c.name, c.class_code, c.term, c.teacher_id,
           u.display_name as teacher_name,
           (SELECT COUNT(*) FROM class_students cs WHERE cs.class_id = c.id) AS student_count
    FROM classes c
    LEFT JOIN users u ON u.id = c.teacher_id
    ORDER BY c.created_at DESC
  `).all();

  return res.json({ classes });
});

router.delete('/classes/:classId', requireRole('teacher', 'admin'), (req, res) => {
  const classId = Number(req.params.classId);
  const db = getDatabase();

  const permission = assertClassWritable(db, classId, req.user);
  if (!permission.ok) {
    return res.status(permission.status).json({ error: permission.error });
  }

  const result = db.prepare('DELETE FROM classes WHERE id = ?').run(classId);
  if (result.changes === 0) {
    return res.status(404).json({ error: 'Class not found' });
  }

  return res.json({
    success: true,
    class: {
      id: classId,
      name: permission.classRow.name,
      classCode: permission.classRow.class_code,
    },
  });
});

router.post('/classes/:classId/students/import-csv', requireRole('teacher', 'admin'), (req, res) => {
  const classId = Number(req.params.classId);
  const db = getDatabase();

  const permission = assertClassWritable(db, classId, req.user);
  if (!permission.ok) {
    return res.status(permission.status).json({ error: permission.error });
  }

  const rows = parseCsvText(req.body.csvText);
  if (rows.length === 0) {
    return res.status(400).json({ error: 'csvText has no rows' });
  }

  const imported = [];
  const failed = [];

  const transaction = db.transaction(() => {
    rows.forEach((row, index) => {
      const studentNo = String(row.student_no || '').trim();
      const name = String(row.name || '').trim();
      const username = String(row.username || '').trim();
      const rawPassword = String(row.password || '').trim() || 'Student@123';

      if (!studentNo || !name || !username) {
        failed.push({ row: index + 2, reason: 'student_no/name/username required' });
        return;
      }

      let student = db.prepare('SELECT id, role FROM users WHERE username = ?').get(username);
      if (!student) {
        const hash = bcrypt.hashSync(rawPassword, 10);
        const insertUser = db.prepare(`
          INSERT INTO users (username, password_hash, role, display_name, must_change_password, status)
          VALUES (?, ?, 'student', ?, 1, 'active')
        `).run(username, hash, name);

        student = { id: Number(insertUser.lastInsertRowid), role: 'student' };
      } else if (student.role !== 'student') {
        failed.push({ row: index + 2, reason: `username '${username}' exists and is not student` });
        return;
      }

      db.prepare(`
        INSERT OR IGNORE INTO class_students (class_id, student_id, student_no)
        VALUES (?, ?, ?)
      `).run(classId, student.id, studentNo);

      imported.push({ studentNo, username, displayName: name, initialPassword: rawPassword });
    });
  });

  transaction();

  return res.json({ success: true, imported, failed });
});

router.get('/classes/:classId/students', requireRole('teacher', 'admin'), (req, res) => {
  const classId = Number(req.params.classId);
  const db = getDatabase();
  const permission = assertClassWritable(db, classId, req.user);
  if (!permission.ok) {
    return res.status(permission.status).json({ error: permission.error });
  }

  const students = db.prepare(`
    SELECT u.id, u.username, u.display_name, cs.student_no, u.status, cs.created_at
    FROM class_students cs
    JOIN users u ON u.id = cs.student_id
    WHERE cs.class_id = ?
    ORDER BY cs.student_no ASC
  `).all(classId);

  return res.json({ students });
});

router.delete('/classes/:classId/students/:studentId', requireRole('teacher', 'admin'), (req, res) => {
  const classId = Number(req.params.classId);
  const studentId = Number(req.params.studentId);
  const db = getDatabase();

  const permission = assertClassWritable(db, classId, req.user);
  if (!permission.ok) {
    return res.status(permission.status).json({ error: permission.error });
  }

  const studentRow = db.prepare(`
    SELECT u.id, u.username, u.display_name, cs.student_no
    FROM class_students cs
    JOIN users u ON u.id = cs.student_id
    WHERE cs.class_id = ? AND cs.student_id = ? AND u.role = 'student'
  `).get(classId, studentId);

  if (!studentRow) {
    return res.status(404).json({ error: 'student not found in class' });
  }

  const txResult = db.transaction(() => {
    const removed = db.prepare('DELETE FROM class_students WHERE class_id = ? AND student_id = ?').run(classId, studentId);
    if (removed.changes === 0) {
      return { removed: false, accountDisabled: false, remainingClassCount: 0 };
    }

    const remainingRow = db.prepare('SELECT COUNT(*) AS total FROM class_students WHERE student_id = ?').get(studentId);
    const remainingClassCount = Number(remainingRow?.total || 0);
    let accountDisabled = false;

    if (remainingClassCount === 0) {
      const disabled = db.prepare(`
        UPDATE users
        SET status = 'disabled', updated_at = datetime('now')
        WHERE id = ? AND role = 'student'
      `).run(studentId);
      accountDisabled = disabled.changes > 0;
    }

    return { removed: true, accountDisabled, remainingClassCount };
  })();

  if (!txResult.removed) {
    return res.status(404).json({ error: 'student not found in class' });
  }

  return res.json({
    success: true,
    student: {
      id: studentRow.id,
      username: studentRow.username,
      displayName: studentRow.display_name,
      studentNo: studentRow.student_no,
    },
    accountDisabled: txResult.accountDisabled,
    remainingClassCount: txResult.remainingClassCount,
  });
});

router.post('/classes/:classId/assignments', requireRole('teacher', 'admin'), (req, res) => {
  const classId = Number(req.params.classId);
  const { scenarioId, title, description = '', dueAt = null } = req.body;
  if (!scenarioId || !title) {
    return res.status(400).json({ error: 'scenarioId and title are required' });
  }

  const db = getDatabase();
  const permission = assertClassWritable(db, classId, req.user);
  if (!permission.ok) {
    return res.status(permission.status).json({ error: permission.error });
  }

  if (!getScenarioById(String(scenarioId))) {
    return res.status(400).json({ error: 'Invalid scenarioId' });
  }

  const result = db.prepare(`
    INSERT INTO assignments (class_id, scenario_id, title, description, due_at, published_by)
    VALUES (?, ?, ?, ?, ?, ?)
  `).run(classId, String(scenarioId), String(title).trim(), String(description || '').trim(), dueAt, Number(req.user.sub));

  return res.json({
    success: true,
    assignment: {
      id: result.lastInsertRowid,
      classId,
      scenarioId,
      title: String(title).trim(),
      description: String(description || '').trim(),
      dueAt,
    },
  });
});

router.get('/classes/:classId/assignments', requireRole('teacher', 'admin'), (req, res) => {
  const classId = Number(req.params.classId);
  const db = getDatabase();
  const permission = assertClassWritable(db, classId, req.user);
  if (!permission.ok) {
    return res.status(permission.status).json({ error: permission.error });
  }

  const assignments = db.prepare(`
    SELECT id, class_id, scenario_id, title, description, due_at, published_by, created_at
    FROM assignments
    WHERE class_id = ?
    ORDER BY created_at DESC
  `).all(classId);

  return res.json({ assignments });
});

router.get('/me/assignments', requireRole('student'), (req, res) => {
  const db = getDatabase();
  const assignments = db.prepare(`
    SELECT a.id, a.class_id, a.scenario_id, a.title, a.description, a.due_at, a.created_at,
           c.name as class_name, c.class_code,
           (SELECT COUNT(*) FROM submissions s WHERE s.assignment_id = a.id AND s.student_id = ?) AS attempt_count,
           (SELECT s.final_total FROM submissions s WHERE s.assignment_id = a.id AND s.student_id = ? ORDER BY s.attempt_no DESC LIMIT 1) AS latest_score
    FROM assignments a
    JOIN classes c ON c.id = a.class_id
    JOIN class_students cs ON cs.class_id = c.id
    WHERE cs.student_id = ?
    ORDER BY a.created_at DESC
  `).all(Number(req.user.sub), Number(req.user.sub), Number(req.user.sub));

  return res.json({ assignments });
});

router.post('/assignments/:assignmentId/submissions', requireRole('student'), (req, res) => {
  const assignmentId = Number(req.params.assignmentId);
  const { snapshot, evidence = {}, labReport = {} } = req.body;
  if (!snapshot || typeof snapshot !== 'object') {
    return res.status(400).json({ error: 'snapshot is required' });
  }

  const db = getDatabase();
  const assignment = db.prepare(`
    SELECT a.*
    FROM assignments a
    JOIN class_students cs ON cs.class_id = a.class_id
    WHERE a.id = ? AND cs.student_id = ?
  `).get(assignmentId, Number(req.user.sub));

  if (!assignment) {
    return res.status(404).json({ error: 'assignment not found for current student' });
  }

  const latestAttempt = db.prepare(`
    SELECT MAX(attempt_no) as max_attempt
    FROM submissions
    WHERE assignment_id = ? AND student_id = ?
  `).get(assignmentId, Number(req.user.sub));

  const attemptNo = Number(latestAttempt?.max_attempt || 0) + 1;
  const assignmentConfig = resolveAssignmentConfig(assignment.scenario_id);
  const autoScore = scoreSubmission({
    submission: { snapshot, evidence, labReport },
    assignmentConfig,
  });

  const result = db.prepare(`
    INSERT INTO submissions (
      assignment_id, student_id, attempt_no,
      snapshot_json, evidence_json, lab_report_json,
      auto_score_json, auto_total,
      teacher_override_json, final_total, teacher_comment
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, NULL, ?, NULL)
  `).run(
    assignmentId,
    Number(req.user.sub),
    attemptNo,
    JSON.stringify(snapshot),
    JSON.stringify(evidence || {}),
    JSON.stringify(labReport || {}),
    JSON.stringify(autoScore),
    autoScore.total,
    autoScore.total
  );

  return res.json({
    success: true,
    submission: {
      id: result.lastInsertRowid,
      assignmentId,
      attemptNo,
      autoScore,
      finalTotal: autoScore.total,
    },
  });
});

router.get('/assignments/:assignmentId/submissions', requireRole('teacher', 'admin'), (req, res) => {
  const assignmentId = Number(req.params.assignmentId);
  const db = getDatabase();

  const assignment = db.prepare('SELECT * FROM assignments WHERE id = ?').get(assignmentId);
  if (!assignment) {
    return res.status(404).json({ error: 'assignment not found' });
  }

  const permission = assertClassWritable(db, Number(assignment.class_id), req.user);
  if (!permission.ok) {
    return res.status(permission.status).json({ error: permission.error });
  }

  const submissions = db.prepare(`
    SELECT s.id, s.assignment_id, s.student_id, s.attempt_no, s.auto_total, s.final_total,
           s.teacher_comment, s.submitted_at, s.graded_at,
           u.username, u.display_name
    FROM submissions s
    JOIN users u ON u.id = s.student_id
    WHERE s.assignment_id = ?
    ORDER BY s.submitted_at DESC
  `).all(assignmentId);

  return res.json({ submissions });
});

router.get('/submissions/:submissionId', requireRole('teacher', 'admin'), (req, res) => {
  const submissionId = Number(req.params.submissionId);
  const db = getDatabase();

  const submission = db.prepare(`
    SELECT s.id, s.assignment_id, s.student_id, s.attempt_no, s.auto_total, s.final_total,
           s.teacher_comment, s.submitted_at, s.graded_at,
           s.snapshot_json, s.evidence_json, s.lab_report_json, s.auto_score_json, s.teacher_override_json,
           u.username, u.display_name,
           a.title AS assignment_title, a.scenario_id, a.class_id,
           c.name AS class_name
    FROM submissions s
    JOIN users u ON u.id = s.student_id
    JOIN assignments a ON a.id = s.assignment_id
    JOIN classes c ON c.id = a.class_id
    WHERE s.id = ?
  `).get(submissionId);

  if (!submission) {
    return res.status(404).json({ error: 'submission not found' });
  }

  const permission = assertClassWritable(db, Number(submission.class_id), req.user);
  if (!permission.ok) {
    return res.status(permission.status).json({ error: permission.error });
  }

  return res.json({
    submission: {
      id: submission.id,
      assignment_id: submission.assignment_id,
      student_id: submission.student_id,
      attempt_no: submission.attempt_no,
      auto_total: submission.auto_total,
      final_total: submission.final_total,
      teacher_comment: submission.teacher_comment,
      submitted_at: submission.submitted_at,
      graded_at: submission.graded_at,
      username: submission.username,
      display_name: submission.display_name,
      assignment_title: submission.assignment_title,
      scenario_id: submission.scenario_id,
      class_name: submission.class_name,
      snapshot: parseJsonField(submission.snapshot_json, {}),
      evidence: parseJsonField(submission.evidence_json, {}),
      lab_report: parseJsonField(submission.lab_report_json, {}),
      auto_score: parseJsonField(submission.auto_score_json, null),
      teacher_override: parseJsonField(submission.teacher_override_json, null),
    },
  });
});

router.patch('/submissions/:submissionId/score', requireRole('teacher', 'admin'), (req, res) => {
  const submissionId = Number(req.params.submissionId);
  const { finalTotal, rubricOverride = null, comment = '', reason = '' } = req.body;

  if (typeof finalTotal !== 'number' || Number.isNaN(finalTotal)) {
    return res.status(400).json({ error: 'finalTotal(number) is required' });
  }

  const db = getDatabase();
  const submission = db.prepare(`
    SELECT s.*, a.class_id
    FROM submissions s
    JOIN assignments a ON a.id = s.assignment_id
    WHERE s.id = ?
  `).get(submissionId);

  if (!submission) {
    return res.status(404).json({ error: 'submission not found' });
  }

  const permission = assertClassWritable(db, Number(submission.class_id), req.user);
  if (!permission.ok) {
    return res.status(permission.status).json({ error: permission.error });
  }

  const previousScore = Number(submission.final_total || 0);
  const overridePayload = {
    rubricOverride,
    reason: String(reason || ''),
    overrideBy: Number(req.user.sub),
    overrideAt: new Date().toISOString(),
  };

  const tx = db.transaction(() => {
    db.prepare(`
      UPDATE submissions
      SET final_total = ?,
          teacher_override_json = ?,
          teacher_comment = ?,
          graded_at = datetime('now'),
          graded_by = ?
      WHERE id = ?
    `).run(
      finalTotal,
      JSON.stringify(overridePayload),
      String(comment || ''),
      Number(req.user.sub),
      submissionId
    );

    db.prepare(`
      INSERT INTO score_overrides (
        submission_id, previous_score, override_score, override_by, reason, override_json
      ) VALUES (?, ?, ?, ?, ?, ?)
    `).run(
      submissionId,
      previousScore,
      finalTotal,
      Number(req.user.sub),
      String(reason || ''),
      JSON.stringify(overridePayload)
    );
  });

  tx();

  return res.json({
    success: true,
    score: {
      previousScore,
      finalTotal,
      comment: String(comment || ''),
    },
  });
});

router.get('/me/submissions', requireRole('student'), (req, res) => {
  const assignmentId = req.query.assignmentId ? Number(req.query.assignmentId) : null;
  const db = getDatabase();

  let sql = `
    SELECT s.id, s.assignment_id, s.attempt_no, s.auto_score_json, s.auto_total,
           s.final_total, s.teacher_comment, s.submitted_at,
           a.title, a.scenario_id, c.name as class_name
    FROM submissions s
    JOIN assignments a ON a.id = s.assignment_id
    JOIN classes c ON c.id = a.class_id
    WHERE s.student_id = ?
  `;
  const params = [Number(req.user.sub)];

  if (assignmentId) {
    sql += ' AND s.assignment_id = ?';
    params.push(assignmentId);
  }

  sql += ' ORDER BY s.submitted_at DESC';

  const submissions = db.prepare(sql).all(...params).map((row) => ({
    ...row,
    auto_score: row.auto_score_json ? JSON.parse(row.auto_score_json) : null,
  }));

  return res.json({ submissions });
});

module.exports = router;
