const http = require('http');
const child_process = require('child_process');
const fs = require('fs');
const path = require('path');
const assert = require('assert');

const ROOT = path.resolve(__dirname, '..');
const API_DIR = path.join(ROOT, 'simu-api');
const PORT = 3197;
const DB_PATH = path.join(ROOT, '.tmp-openclass-concurrency.sqlite');

for (const file of [DB_PATH, `${DB_PATH}-wal`, `${DB_PATH}-shm`]) {
  try {
    fs.unlinkSync(file);
  } catch {
    // ignore
  }
}

function request(method, url, body, token) {
  return new Promise((resolve, reject) => {
    const data = body ? JSON.stringify(body) : '';
    const u = new URL(url);
    const req = http.request({
      hostname: u.hostname,
      port: u.port,
      path: u.pathname + u.search,
      method,
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(data),
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
    }, (res) => {
      let chunks = '';
      res.setEncoding('utf8');
      res.on('data', (chunk) => {
        chunks += chunk;
      });
      res.on('end', () => {
        let parsed = chunks;
        try {
          parsed = chunks ? JSON.parse(chunks) : null;
        } catch {
          // keep text response
        }
        if (res.statusCode >= 400) {
          reject(new Error(`${method} ${url} -> ${res.statusCode}: ${chunks}`));
        } else {
          resolve(parsed);
        }
      });
    });
    req.on('error', reject);
    req.write(data);
    req.end();
  });
}

function component(id, definitionId) {
  return {
    instanceId: id,
    definitionId,
    position: { x: 0, y: 0 },
    state: { powered: true, active: true },
  };
}

function conn(a, ap, b, bp, type = 'data') {
  return {
    id: `${a}-${ap}-${b}-${bp}`,
    fromComponent: a,
    fromPin: ap,
    toComponent: b,
    toPin: bp,
    type,
    valid: true,
  };
}

function snapshotFor(i) {
  const placedComponents = [
    component('mb', 'microbit'),
    component('ex', 'expansion-board'),
    component('sensor', 'temp-humidity-sensor'),
    component('buzz', 'buzzer'),
    component('iot', 'iot-module'),
    component('router', 'router'),
    component('server', 'web-server'),
    component('db', 'database'),
    component('pc', 'pc-computer'),
    component('browser', 'browser'),
    component('phone', 'mobile-client'),
  ];
  const connections = [
    conn('mb', 'usb', 'pc', 'usb'),
    conn('mb', 'p1', 'ex', 'slot-p1'),
    conn('mb', 'p2', 'ex', 'slot-p2'),
    conn('mb', '3v', 'ex', 'slot-3v', 'power'),
    conn('mb', 'gnd', 'ex', 'slot-gnd', 'ground'),
    conn('sensor', 'vcc', 'ex', '3v-out1', 'power'),
    conn('sensor', 'gnd', 'ex', 'gnd-out1', 'ground'),
    conn('sensor', 'data', 'ex', 'p1'),
    conn('buzz', 'vcc', 'ex', '3v-out3', 'power'),
    conn('buzz', 'gnd', 'ex', 'gnd-out3', 'ground'),
    conn('buzz', 'io', 'ex', 'p2'),
    conn('iot', 'tx', 'ex', 'p15', 'serial'),
    conn('iot', 'rx', 'ex', 'p16', 'serial'),
    conn('iot', 'wifi', 'router', 'wifi', 'wireless'),
    conn('router', 'lan', 'server', 'network'),
    conn('server', 'db', 'db', 'connection'),
    conn('browser', 'http', 'router', 'lan'),
    conn('phone', 'http', 'router', 'lan'),
  ];
  const temp = 31 + (i % 5) / 10;
  return {
    placedComponents,
    connections,
    microbitCode: [
      'raw = pin1.read_analog()',
      'if temp > TEMP_THRESHOLD:',
      '    pin2.write_digital(1)',
      'url = "http://192.168.1.100:5000/upload"',
      'obloq.http_post(url, data)',
    ].join('\n'),
    flaskCode: [
      "@app.route('/upload', methods=['POST'])",
      'def upload_data():',
      '    pass',
      "@app.route('/', methods=['GET'])",
      'def index():',
      "    return render_template('index.html', records=rows)",
    ].join('\n'),
    database: {
      tables: [],
      records: {
        sensorlog: [{ id: i + 1, sensor_id: 1, value: temp, alarm: 1, timestamp: new Date().toISOString() }],
      },
    },
    routerConfig: { ssid: 'School_WiFi', password: '', ip: '192.168.1.1', connectedDevices: [] },
    serverConfig: { ip: '192.168.1.100', port: 5000, running: true, routes: [], logs: [] },
  };
}

(async () => {
  const server = child_process.spawn('node', ['index.js'], {
    cwd: API_DIR,
    env: {
      ...process.env,
      PORT: String(PORT),
      DB_PATH,
      FEATURE_MODE: 'teaching',
      EDU_FEATURE_ENABLED: 'true',
      JWT_SECRET: 'local-test-secret',
      OPEN_CLASS_TEACHER_USERNAME: 'teacher01',
      OPEN_CLASS_TEACHER_PASSWORD: 'Teacher@123',
      OPEN_CLASS_USERNAME: 'openclass',
      OPEN_CLASS_PASSWORD: 'Open@12345',
      SQLITE_BUSY_TIMEOUT_MS: '5000',
    },
    stdio: ['ignore', 'pipe', 'pipe'],
  });

  server.stdout.on('data', (data) => process.stdout.write(`[api] ${data}`));
  server.stderr.on('data', (data) => process.stderr.write(`[api-err] ${data}`));

  try {
    const base = `http://127.0.0.1:${PORT}`;
    let healthOk = false;
    for (let n = 0; n < 240; n += 1) {
      try {
        await request('GET', `${base}/health`);
        healthOk = true;
        break;
      } catch {
        await new Promise((resolve) => setTimeout(resolve, 100));
      }
    }
    if (!healthOk) {
      throw new Error('local API did not become healthy in time');
    }

    const entries = await Promise.all(
      Array.from({ length: 60 }, () => request('GET', `${base}/api/edu/open-class`))
    );
    assert.equal(entries.length, 60);
    const assignmentId = entries[0].assignment.id;
    assert(entries.every((entry) => entry.assignment.id === assignmentId), 'assignment id should be stable');

    const submitted = await Promise.all(entries.map((entry, index) => {
      const snapshot = snapshotFor(index);
      const studentName = `测试学生${String(index + 1).padStart(2, '0')}`;
      return request('POST', `${base}/api/edu/assignments/${assignmentId}/submissions`, {
        snapshot,
        evidence: {
          studentName,
          logs: [
            { message: '发送请求: POST http://192.168.1.100:5000/upload', source: 'micro:bit' },
            { message: '响应: 200 OK', source: 'Flask' },
            { message: 'sensorlog 表新增 1 条记录', source: 'SQLite' },
            { message: 'BUZZER_ON，蜂鸣器已响应', source: 'micro:bit' },
            { message: '发送请求: GET http://192.168.1.100:5000/', source: '浏览器' },
            { message: 'GET / 已通过 render_template 展示 sensorlog 记录', source: '浏览器' },
          ],
          database: snapshot.database,
          sensorlogCount: 1,
        },
        labReport: { studentName, submittedAt: new Date().toISOString() },
      }, entry.token);
    }));
    assert.equal(submitted.length, 60);
    assert(submitted.every((item) => item.success && item.submission.finalTotal >= 80), 'all submissions should score high');

    const teacherLogin = await request('POST', `${base}/api/auth/login`, {
      username: 'teacher01',
      password: 'Teacher@123',
    });
    const list = await request('GET', `${base}/api/edu/assignments/${assignmentId}/submissions`, null, teacherLogin.token);
    assert.equal(list.submissions.length, 60);
    const names = new Set(list.submissions.map((submission) => submission.submitted_student_name));
    assert.equal(names.size, 60, 'teacher list should retain unique submitted names');
    assert(list.submissions.every((submission) => Number(submission.final_total) >= 80), 'teacher list should include scores');

    const detail = await request('GET', `${base}/api/edu/submissions/${list.submissions[0].id}`, null, teacherLogin.token);
    assert(detail.submission.snapshot.placedComponents.length >= 11, 'teacher detail should include canvas snapshot');
    assert(detail.submission.lab_report.studentName, 'teacher detail should include submitted name');

    console.log(JSON.stringify({
      ok: true,
      openClassEntries: entries.length,
      submissions: list.submissions.length,
      uniqueNames: names.size,
      sampleScore: list.submissions[0].final_total,
    }, null, 2));
  } finally {
    server.kill('SIGTERM');
  }
})().catch((error) => {
  console.error(error);
  process.exit(1);
});
