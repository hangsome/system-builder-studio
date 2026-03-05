const Database = require('better-sqlite3');
const bcrypt = require('bcryptjs');

const db = new Database('./db/licenses.db');

const username = process.argv[2] || 'student_test01';
const password = process.argv[3] || 'Student@123';
const displayName = process.argv[4] || '测试学生';

let user = db.prepare('SELECT id FROM users WHERE username = ?').get(username);
if (!user) {
  const hash = bcrypt.hashSync(password, 10);
  const result = db
    .prepare(`
      INSERT INTO users (username, password_hash, role, display_name, must_change_password, status)
      VALUES (?, ?, 'student', ?, 0, 'active')
    `)
    .run(username, hash, displayName);
  user = { id: Number(result.lastInsertRowid) };
}

const latestClass = db.prepare('SELECT id FROM classes ORDER BY id DESC LIMIT 1').get();
let classId = null;
let enrolled = false;
if (latestClass) {
  classId = Number(latestClass.id);
  const studentNo = `TEST${String(user.id).padStart(4, '0')}`;
  db.prepare(`
    INSERT OR IGNORE INTO class_students (class_id, student_id, student_no)
    VALUES (?, ?, ?)
  `).run(classId, user.id, studentNo);
  enrolled = true;
}

console.log(
  JSON.stringify(
    {
      username,
      password,
      displayName,
      userId: user.id,
      classId,
      enrolled,
    },
    null,
    2
  )
);

