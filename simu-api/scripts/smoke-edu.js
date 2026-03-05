require('dotenv').config();

const baseUrl = process.env.SMOKE_BASE_URL || `http://127.0.0.1:${process.env.PORT || 3000}`;

async function api(path, options = {}) {
  const mergedHeaders = {
    'Content-Type': 'application/json',
    ...(options.headers || {}),
  };

  const res = await fetch(`${baseUrl}${path}`, {
    ...options,
    headers: mergedHeaders,
  });

  const text = await res.text();
  const payload = text ? JSON.parse(text) : {};

  if (!res.ok) {
    throw new Error(`${path} failed: ${res.status} ${JSON.stringify(payload)}`);
  }

  return payload;
}

async function main() {
  const adminUsername = process.env.SEED_ADMIN_USERNAME || 'admin';
  const adminPassword = process.env.SEED_ADMIN_PASSWORD || 'Admin@123';
  const teacherUsername = process.env.SEED_TEACHER_USERNAME || 'teacher01';
  const teacherPassword = process.env.SEED_TEACHER_PASSWORD || 'Teacher@123';

  const adminLogin = await api('/api/auth/login', {
    method: 'POST',
    body: JSON.stringify({ username: adminUsername, password: adminPassword }),
  });

  await api('/api/edu/admin/teachers', {
    method: 'POST',
    headers: { Authorization: `Bearer ${adminLogin.token}` },
    body: JSON.stringify({
      username: `teacher_${Date.now().toString(36)}`,
      displayName: 'Smoke Teacher',
      password: 'Teacher@123',
    }),
  });

  const teacherLogin = await api('/api/auth/login', {
    method: 'POST',
    body: JSON.stringify({ username: teacherUsername, password: teacherPassword }),
  });

  const classResult = await api('/api/edu/classes', {
    method: 'POST',
    headers: { Authorization: `Bearer ${teacherLogin.token}` },
    body: JSON.stringify({ name: 'Smoke Class', term: '2026-Spring' }),
  });

  const studentUsername = `student_${Date.now().toString(36)}`;
  await api(`/api/edu/classes/${classResult.class.id}/students/import-csv`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${teacherLogin.token}` },
    body: JSON.stringify({
      csvText: `student_no,name,username,password\nS001,Smoke Student,${studentUsername},Student@123`,
    }),
  });

  const assignmentResult = await api(`/api/edu/classes/${classResult.class.id}/assignments`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${teacherLogin.token}` },
    body: JSON.stringify({
      scenarioId: 'classroom-temperature',
      title: 'Smoke Assignment',
      description: 'Smoke',
    }),
  });

  const studentLogin = await api('/api/auth/login', {
    method: 'POST',
    body: JSON.stringify({ username: studentUsername, password: 'Student@123' }),
  });

  await api(`/api/edu/assignments/${assignmentResult.assignment.id}/submissions`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${studentLogin.token}` },
    body: JSON.stringify({
      snapshot: {
        placedComponents: [{ instanceId: 'a', definitionId: 'microbit' }],
        connections: [],
        database: { records: { sensorlog: [] } },
      },
      evidence: { validationIssues: [], logs: [] },
      labReport: {
        temperature: 25,
        alarmTriggered: false,
        dbIncrease: 0,
        faultPoint: 'none',
        fixMethod: 'none',
        summary: 'smoke summary',
      },
    }),
  });

  const teacherSubmissions = await api(`/api/edu/assignments/${assignmentResult.assignment.id}/submissions`, {
    headers: { Authorization: `Bearer ${teacherLogin.token}` },
  });

  const targetSubmission = teacherSubmissions.submissions[0];

  await api(`/api/edu/submissions/${targetSubmission.id}/score`, {
    method: 'PATCH',
    headers: { Authorization: `Bearer ${teacherLogin.token}` },
    body: JSON.stringify({ finalTotal: 88, reason: 'smoke override', comment: 'ok' }),
  });

  const studentSubmissions = await api(`/api/edu/me/submissions?assignmentId=${assignmentResult.assignment.id}`, {
    headers: { Authorization: `Bearer ${studentLogin.token}` },
  });

  if (!studentSubmissions.submissions.length) {
    throw new Error('Student submissions not found');
  }

  console.log(JSON.stringify({
    success: true,
    assignmentId: assignmentResult.assignment.id,
    submissionId: studentSubmissions.submissions[0].id,
    finalTotal: studentSubmissions.submissions[0].final_total,
  }, null, 2));
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
