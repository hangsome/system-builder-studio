const { getScenarioById } = require('./scenarioCatalog');

const HARDWARE_MATCHING_MODULES = [
  { id: 'sensor', label: '温湿度传感器' },
  { id: 'smart-terminal', label: '智能终端' },
  { id: 'buzzer', label: '蜂鸣器' },
  { id: 'iot', label: 'IoT 模块' },
  { id: 'router', label: 'WiFi 路由器' },
  { id: 'server', label: 'Flask 服务器' },
  { id: 'database', label: 'SQLite 数据库' },
  { id: 'phone', label: '手机' },
];

const HARDWARE_MATCHING_FUNCTIONS = {
  'onsite-alert': '温度超过安全阈值时，在现场发出声音提醒',
  'history-records': '保存实时温度、报警状态和历史记录',
  'sense-temperature': '自动感知食堂储物间温度变化',
  'threshold-judge': '判断当前温度是否超过安全阈值',
  'network-link': '提供无线网络，让设备能够互相通信',
  'duty-view': '值班人员访问服务器页面查看数据',
  'process-control': '运行程序，读取采集值并控制报警执行器',
  'upload-abnormal': '把温度或异常信息发送到服务器',
  'http-service': '接收上传请求，并提供数据查看页面',
};

const HARDWARE_MATCHING_ANSWER_KEY = {
  sensor: ['sense-temperature'],
  'smart-terminal': ['process-control', 'threshold-judge'],
  buzzer: ['onsite-alert'],
  iot: ['upload-abnormal'],
  router: ['network-link'],
  server: ['http-service', 'threshold-judge'],
  database: ['history-records'],
  phone: ['duty-view'],
};

function normalizeConnection(connection, componentByInstance) {
  const fromDef = componentByInstance.get(connection.fromComponent)?.definitionId;
  const toDef = componentByInstance.get(connection.toComponent)?.definitionId;
  if (!fromDef || !toDef) return null;

  const left = `${fromDef}:${connection.fromPin}`;
  const right = `${toDef}:${connection.toPin}`;
  return left < right ? `${left}|${right}` : `${right}|${left}`;
}

function scoreCompleteness(snapshot, assignmentConfig) {
  const components = Array.isArray(snapshot?.placedComponents) ? snapshot.placedComponents : [];
  const connections = Array.isArray(snapshot?.connections) ? snapshot.connections : [];

  const requiredComponents = assignmentConfig.requiredComponents || [];
  const requiredConnections = assignmentConfig.requiredConnections || [];

  const providedDefinitionIds = new Set(components.map((item) => item.definitionId || item.type).filter(Boolean));
  const matchedComponentCount = requiredComponents.filter((id) => providedDefinitionIds.has(id)).length;

  const componentByInstance = new Map(components.map((item) => [item.instanceId, item]));
  const providedConnectionSet = new Set(
    connections
      .map((conn) => normalizeConnection(conn, componentByInstance))
      .filter(Boolean)
  );

  const requiredConnectionKeys = requiredConnections.map((pair) => {
    const left = `${pair[0]}:${pair[1]}`;
    const right = `${pair[2]}:${pair[3]}`;
    return left < right ? `${left}|${right}` : `${right}|${left}`;
  });

  const matchedConnectionCount = requiredConnectionKeys.filter((key) => providedConnectionSet.has(key)).length;

  const componentRatio = requiredComponents.length > 0 ? matchedComponentCount / requiredComponents.length : 1;
  const connectionRatio = requiredConnectionKeys.length > 0 ? matchedConnectionCount / requiredConnectionKeys.length : 1;

  const componentScore = Math.round(componentRatio * 15 * 10) / 10;
  const connectionScore = Math.round(connectionRatio * 15 * 10) / 10;

  return {
    score: componentScore + connectionScore,
    reason: `components ${matchedComponentCount}/${requiredComponents.length}, connections ${matchedConnectionCount}/${requiredConnectionKeys.length}`,
  };
}

function hasConnectionBetweenDefinitions(snapshot, leftDefinitionId, leftPin, rightDefinitionId, rightPin) {
  const components = getComponents(snapshot);
  const connections = getConnections(snapshot);

  return connections.some((connection) => {
    const fromComponent = components.find((item) => item.instanceId === connection.fromComponent);
    const toComponent = components.find((item) => item.instanceId === connection.toComponent);
    const fromDefinitionId = fromComponent?.definitionId || fromComponent?.type;
    const toDefinitionId = toComponent?.definitionId || toComponent?.type;

    return (
      fromDefinitionId === leftDefinitionId &&
      connection.fromPin === leftPin &&
      toDefinitionId === rightDefinitionId &&
      connection.toPin === rightPin
    ) || (
      fromDefinitionId === rightDefinitionId &&
      connection.fromPin === rightPin &&
      toDefinitionId === leftDefinitionId &&
      connection.toPin === leftPin
    );
  });
}

function scoreClassroomCompleteness(snapshot, assignmentConfig) {
  const requiredComponents = assignmentConfig.requiredComponents || [];
  const providedDefinitionIds = new Set(
    getComponents(snapshot).map((item) => item.definitionId || item.type).filter(Boolean)
  );
  const matchedComponentCount = requiredComponents.filter((id) => providedDefinitionIds.has(id)).length;
  const componentRatio = requiredComponents.length > 0 ? matchedComponentCount / requiredComponents.length : 1;
  const componentScore = Math.round((componentRatio * 15) * 10) / 10;

  const sensor = findComponentByDefinition(snapshot, 'temp-humidity-sensor');
  const actuator = findComponentByDefinition(snapshot, ['buzzer', 'led-strip', 'servo', 'relay']);
  const sensorSignalPin = getSignalExpansionPin(snapshot, sensor, ['data', 'io', 'out', 'signal']);
  const actuatorSignalPin = getSignalExpansionPin(snapshot, actuator, ['io', 'in', 'din', 'signal']);

  const connectionChecks = [
    hasConnectionBetweenDefinitions(snapshot, 'microbit', 'usb', 'pc-computer', 'usb'),
    hasConnectionBetweenDefinitions(snapshot, 'microbit', '3v', 'expansion-board', 'slot-3v'),
    hasConnectionBetweenDefinitions(snapshot, 'microbit', 'gnd', 'expansion-board', 'slot-gnd'),
    hasConnectionBetweenDefinitions(snapshot, 'temp-humidity-sensor', 'vcc', 'expansion-board', '3v-out1'),
    hasConnectionBetweenDefinitions(snapshot, 'temp-humidity-sensor', 'gnd', 'expansion-board', 'gnd-out1'),
    Boolean(sensorSignalPin),
    hasConnectionBetweenDefinitions(snapshot, 'buzzer', 'vcc', 'expansion-board', '3v-out3'),
    hasConnectionBetweenDefinitions(snapshot, 'buzzer', 'gnd', 'expansion-board', 'gnd-out3'),
    Boolean(actuatorSignalPin),
    hasConnectionBetweenDefinitions(snapshot, 'iot-module', 'wifi', 'router', 'wifi'),
    hasConnectionBetweenDefinitions(snapshot, 'router', 'lan', 'web-server', 'network'),
    hasConnectionBetweenDefinitions(snapshot, 'web-server', 'db', 'database', 'connection'),
    hasConnectionBetweenDefinitions(snapshot, 'browser', 'http', 'router', 'lan'),
    hasConnectionBetweenDefinitions(snapshot, 'mobile-client', 'http', 'router', 'lan'),
  ];
  const matchedConnectionCount = connectionChecks.filter(Boolean).length;
  const connectionScore = Math.round(((matchedConnectionCount / connectionChecks.length) * 15) * 10) / 10;

  return {
    score: componentScore + connectionScore,
    reason: `components ${matchedComponentCount}/${requiredComponents.length}, connections ${matchedConnectionCount}/${connectionChecks.length}, sensorSignal=${sensorSignalPin || 'missing'}, actuatorSignal=${actuatorSignalPin || 'missing'}`,
  };
}

function hasComponent(snapshot, definitionId) {
  const components = Array.isArray(snapshot?.placedComponents) ? snapshot.placedComponents : [];
  return components.some((item) => item.definitionId === definitionId || item.type === definitionId);
}

function getComponents(snapshot) {
  return Array.isArray(snapshot?.placedComponents) ? snapshot.placedComponents : [];
}

function getConnections(snapshot) {
  return Array.isArray(snapshot?.connections) ? snapshot.connections : [];
}

function extractReadPins(code) {
  const pins = new Set();
  const pattern = /\bpin(\d+)\s*\.\s*read_(?:analog|digital)\s*\(/gi;
  let match;
  while ((match = pattern.exec(String(code || ''))) !== null) {
    pins.add(`p${match[1]}`);
  }
  return pins;
}

function extractWritePins(code) {
  const pins = new Set();
  const pattern = /\bpin(\d+)\s*\.\s*write_(?:analog|digital)\s*\(/gi;
  let match;
  while ((match = pattern.exec(String(code || ''))) !== null) {
    pins.add(`p${match[1]}`);
  }
  return pins;
}

function findComponentByDefinition(snapshot, definitionIds) {
  const ids = Array.isArray(definitionIds) ? definitionIds : [definitionIds];
  return getComponents(snapshot).find((component) =>
    ids.includes(component.definitionId || component.type)
  );
}

function getSignalExpansionPin(snapshot, component, signalPins) {
  if (!component) return null;
  const components = getComponents(snapshot);
  const connections = getConnections(snapshot);
  const signalPinSet = new Set(signalPins);

  for (const connection of connections) {
    const componentOnFromSide =
      connection.fromComponent === component.instanceId && signalPinSet.has(connection.fromPin);
    const componentOnToSide =
      connection.toComponent === component.instanceId && signalPinSet.has(connection.toPin);

    if (!componentOnFromSide && !componentOnToSide) continue;

    const otherComponentId = componentOnFromSide ? connection.toComponent : connection.fromComponent;
    const otherPinId = componentOnFromSide ? connection.toPin : connection.fromPin;
    const otherComponent = components.find((item) => item.instanceId === otherComponentId);

    if ((otherComponent?.definitionId || otherComponent?.type) === 'expansion-board' && /^p\d+$/i.test(otherPinId)) {
      return otherPinId.toLowerCase();
    }
  }

  return null;
}

function codeHasGetUpload(code) {
  const text = String(code || '');
  const hasUploadRoute = /\/upload/i.test(text) || /UPLOAD_ROUTE\s*=\s*['"]\/upload['"]/i.test(text);
  const callsGet = /http_get\s*\(/i.test(text) || /requests\.get\s*\(/i.test(text);
  const hasIdParam = /[?&]id=|id\s*=/i.test(text);
  const hasValParam = /[?&]val=|val\s*=/i.test(text);
  return hasUploadRoute && callsGet && hasIdParam && hasValParam;
}

function flaskHasGetUploadRoute(code) {
  const text = String(code || '');
  return /@app\.route\s*\(\s*['"]\/upload['"]\s*,\s*methods\s*=\s*\[[^\]]*['"]GET['"]/i.test(text) ||
    /@app\.route\s*\(\s*['"]\/upload['"]\s*\)/i.test(text);
}

function codeHasHomeRender(code) {
  const text = String(code || '');
  const hasHomeRoute = /@app\.route\s*\(\s*['"]\/['"]\s*,\s*methods\s*=\s*\[[^\]]*['"]GET['"]/.test(text) ||
    /@app\.route\s*\(\s*['"]\/['"]\s*\)/.test(text);
  return hasHomeRoute && /render_template\s*\(/i.test(text);
}

function scoreClassroomCode(snapshot) {
  const microbitCode = String(snapshot?.microbitCode || '');
  const flaskCode = String(snapshot?.flaskCode || '');
  const sensor = findComponentByDefinition(snapshot, 'temp-humidity-sensor');
  const actuator = findComponentByDefinition(snapshot, ['buzzer', 'led-strip', 'servo', 'relay']);
  const sensorPin = getSignalExpansionPin(snapshot, sensor, ['data', 'io', 'out', 'signal']);
  const actuatorPin = getSignalExpansionPin(snapshot, actuator, ['io', 'in', 'din', 'signal']);
  const sensorPinsInCode = extractReadPins(microbitCode);
  const actuatorPinsInCode = extractWritePins(microbitCode);
  const sensorFixed = Boolean(sensorPin && sensorPinsInCode.has(sensorPin));
  const buzzerFixed = Boolean(actuatorPin && actuatorPinsInCode.has(actuatorPin));
  const uploadOk = codeHasGetUpload(microbitCode);
  const flaskUploadOk = flaskHasGetUploadRoute(flaskCode);
  const homeRenderOk = codeHasHomeRender(flaskCode);

  const checks = [
    {
      id: 'sensor-pin',
      ok: sensorFixed,
      score: 10,
      label: `传感器读取引脚与画布连线对应${sensorPin ? `(${sensorPin.toUpperCase()})` : ''}`,
    },
    {
      id: 'actuator-pin',
      ok: buzzerFixed,
      score: 10,
      label: `执行器控制引脚与画布连线对应${actuatorPin ? `(${actuatorPin.toUpperCase()})` : ''}`,
    },
    { id: 'microbit-upload', ok: uploadOk, score: 3, label: 'micro:bit 使用 GET /upload?id=...&val=... 上传' },
    { id: 'flask-upload', ok: flaskUploadOk, score: 2, label: 'Flask 提供 GET /upload 接收路由' },
    { id: 'home-render', ok: homeRenderOk, score: 5, label: '首页使用 GET / 和 render_template 展示数据' },
  ];

  return {
    score: checks.filter((item) => item.ok).reduce((sum, item) => sum + item.score, 0),
    reason: checks.map((item) => `${item.label}=${item.ok ? 'yes' : 'no'}`).join(', '),
    checks,
  };
}

function scoreDataFlow(snapshot, evidence) {
  const issues = Array.isArray(evidence?.validationIssues) ? evidence.validationIssues : [];
  const logs = Array.isArray(evidence?.logs)
    ? evidence.logs
    : Array.isArray(snapshot?.serverConfig?.logs)
      ? snapshot.serverConfig.logs
      : [];

  const dbSensorLog = snapshot?.database?.records?.sensorlog;
  const dbCount = Array.isArray(dbSensorLog) ? dbSensorLog.length : Number(evidence?.sensorlogCount || 0);
  const alarmRecorded = Array.isArray(dbSensorLog)
    ? dbSensorLog.some((row) => Number(row?.alarm || 0) === 1 || String(row?.command || '').includes('BUZZER_ON'))
    : false;
  const getUploadSucceeded = logs.some((log) => /GET\s+http:\/\/.+\/upload/i.test(String(log?.message || log || ''))) &&
    logs.some((log) => /响应:\s*200\s*OK/i.test(String(log?.message || log || '')));
  const sensorlogAdded = dbCount > 0 &&
    logs.some((log) => /sensorlog\s*表新增|数据库已更新/i.test(String(log?.message || log || '')));
  const actuatorResponded = logs.some((log) => /BUZZER_ON.*蜂鸣器已响应|蜂鸣器已响应|蜂鸣器报警/i.test(String(log?.message || log || '')));
  const browserGetSucceeded = logs.some((log) => /GET\s+http:\/\/.+\/$/i.test(String(log?.message || log || ''))) &&
    logs.some((log) => /GET\s+\/.*render_template|render_template.*sensorlog/i.test(String(log?.message || log || '')));

  const issueScore = issues.length === 0 ? 5 : Math.max(0, 5 - issues.length);
  const uploadScore = getUploadSucceeded ? 5 : 0;
  const dbScore = sensorlogAdded ? 5 : dbCount > 0 ? 3 : 0;
  const alarmScore = alarmRecorded && actuatorResponded ? 5 : alarmRecorded ? 3 : 0;
  const browserScore = browserGetSucceeded ? 5 : 0;
  const checks = [
    { id: 'validation', ok: issues.length === 0, score: issueScore, label: '运行前没有阻断性校验问题' },
    { id: 'get-upload-run', ok: getUploadSucceeded, score: uploadScore, label: '运行日志出现 GET /upload 且返回 200' },
    { id: 'database-write', ok: sensorlogAdded || dbCount > 0, score: dbScore, label: 'sensorlog 有温度记录写入' },
    { id: 'alarm-actuator', ok: alarmScore === 5, score: alarmScore, label: '超阈值后报警记录与执行器响应一致' },
    { id: 'browser-view', ok: browserGetSucceeded, score: browserScore, label: '浏览器 GET / 能展示数据库记录' },
  ];

  return {
    score: issueScore + uploadScore + dbScore + alarmScore + browserScore,
    reason: `issues=${issues.length}, getUpload=${getUploadSucceeded ? 'yes' : 'no'}, sensorlogAdded=${sensorlogAdded ? 'yes' : 'no'}(${dbCount}), alarmAndActuator=${alarmScore === 5 ? 'yes' : alarmScore > 0 ? 'partial' : 'no'}, browserGet=${browserGetSucceeded ? 'yes' : 'no'}`,
    checks,
  };
}

function scoreHardwareMatching(labReport) {
  const answers = labReport?.hardwareMatching?.answers && typeof labReport.hardwareMatching.answers === 'object'
    ? labReport.hardwareMatching.answers
    : {};
  const expectedCount = Object.values(HARDWARE_MATCHING_ANSWER_KEY).reduce((sum, item) => sum + item.length, 0);
  const itemMax = 10 / expectedCount;
  const checks = HARDWARE_MATCHING_MODULES.flatMap((module) => {
    const expectedFunctionIds = HARDWARE_MATCHING_ANSWER_KEY[module.id] || [];
    const actualFunctionIds = Array.isArray(answers[module.id]) ? answers[module.id] : [];

    return expectedFunctionIds.map((expectedFunctionId) => {
      const ok = actualFunctionIds.includes(expectedFunctionId);
      return {
        id: `hardware-match-${module.id}-${expectedFunctionId}`,
        ok,
        score: ok ? itemMax : 0,
        max: itemMax,
        label: `${module.label} -> ${HARDWARE_MATCHING_FUNCTIONS[expectedFunctionId]}`,
      };
    });
  });
  const correctCount = checks.filter((item) => item.ok).length;

  return {
    score: Math.round(checks.reduce((sum, item) => sum + item.score, 0) * 10) / 10,
    reason: `hardwareMatching ${correctCount}/${checks.length}`,
    checks,
  };
}

function scoreClassroomClient(snapshot) {
  const checks = [
    { id: 'pc-computer', ok: hasComponent(snapshot, 'pc-computer'), score: 2, label: '已补充 PC 电脑' },
    { id: 'browser', ok: hasComponent(snapshot, 'browser'), score: 4, label: '已补充浏览器' },
    { id: 'mobile-client', ok: hasComponent(snapshot, 'mobile-client'), score: 4, label: '已补充手机/移动终端' },
  ];

  return {
    score: checks.filter((item) => item.ok).reduce((sum, item) => sum + item.score, 0),
    reason: checks.map((item) => `${item.label}=${item.ok ? 'yes' : 'no'}`).join(', '),
    checks,
  };
}

function scoreWrittenTroubleshooting(labReport) {
  const faultPoint = String(labReport?.faultPoint || '').trim();
  const fixMethod = String(labReport?.fixMethod || '').trim();

  const faultScore = faultPoint.length >= 8 ? 10 : faultPoint.length >= 4 ? 5 : 0;
  const fixScore = fixMethod.length >= 8 ? 10 : fixMethod.length >= 4 ? 5 : 0;

  return {
    score: faultScore + fixScore,
    reason: `faultPointLength=${faultPoint.length}, fixMethodLength=${fixMethod.length}`,
  };
}

function scoreCommunication(labReport) {
  const requiredFields = ['temperature', 'alarmTriggered', 'dbIncrease'];
  const presentCount = requiredFields.filter((field) => labReport?.[field] !== undefined && labReport?.[field] !== '').length;
  const fieldScore = (presentCount / requiredFields.length) * 10;

  const summary = String(labReport?.summary || '').trim();
  const summaryScore = summary.length >= 30 ? 10 : summary.length >= 12 ? 6 : summary.length > 0 ? 3 : 0;

  return {
    score: Math.round((fieldScore + summaryScore) * 10) / 10,
    reason: `requiredFields=${presentCount}/${requiredFields.length}, summaryLength=${summary.length}`,
  };
}

function scoreSubmission({ submission, assignmentConfig }) {
  const snapshot = submission?.snapshot || {};
  const evidence = submission?.evidence || {};
  const labReport = submission?.labReport || {};

  const isClassroomTemperature = assignmentConfig?.id === 'classroom-temperature';

  if (isClassroomTemperature) {
    const completeness = scoreClassroomCompleteness(snapshot, assignmentConfig);
    const hardwareMatch = scoreHardwareMatching(labReport);
    const code = scoreClassroomCode(snapshot);
    const dataFlow = scoreDataFlow(snapshot, evidence);
    const client = scoreClassroomClient(snapshot);

    const dimensions = {
      canvas: {
        id: 'canvas',
        label: '画布组件与连线',
        max: 25,
        score: Math.round(((completeness.score / 30) * 25) * 10) / 10,
        reason: completeness.reason,
      },
      hardwareMatch: {
        id: 'hardwareMatch',
        label: '硬件模块功能匹配',
        max: 10,
        score: Math.round(hardwareMatch.score * 10) / 10,
        reason: hardwareMatch.reason,
        checks: hardwareMatch.checks,
      },
      code: {
        id: 'code',
        label: '代码关键修改',
        max: 30,
        score: Math.round(code.score * 10) / 10,
        reason: code.reason,
        checks: code.checks,
      },
      dataFlow: {
        id: 'dataFlow',
        label: '运行与数据流',
        max: 25,
        score: Math.round(dataFlow.score * 10) / 10,
        reason: dataFlow.reason,
        checks: dataFlow.checks,
      },
      client: {
        id: 'client',
        label: '用户端补全',
        max: 10,
        score: Math.round(client.score * 10) / 10,
        reason: client.reason,
        checks: client.checks,
      },
    };

    const total = Math.round(Object.values(dimensions).reduce((sum, item) => sum + item.score, 0) * 10) / 10;

    return {
      rubricVersion: 'classroom-temperature-v6',
      dimensions,
      total,
      reasons: Object.values(dimensions).map((item) => item.reason),
    };
  }

  const completeness = scoreCompleteness(snapshot, assignmentConfig);
  const correctness = scoreDataFlow(snapshot, evidence);
  const troubleshooting = scoreWrittenTroubleshooting(labReport);
  const communication = scoreCommunication(labReport);

  const dimensions = {
    completeness: {
      max: 30,
      score: Math.round(completeness.score * 10) / 10,
      reason: completeness.reason,
    },
    correctness: {
      max: 30,
      score: Math.round(correctness.score * 10) / 10,
      reason: correctness.reason,
    },
    troubleshooting: {
      max: 20,
      score: Math.round(troubleshooting.score * 10) / 10,
      reason: troubleshooting.reason,
    },
    communication: {
      max: 20,
      score: Math.round(communication.score * 10) / 10,
      reason: communication.reason,
    },
  };

  const total = Math.round((
    dimensions.completeness.score +
    dimensions.correctness.score +
    dimensions.troubleshooting.score +
    dimensions.communication.score
  ) * 10) / 10;

  return {
    rubricVersion: 'v1',
    dimensions,
    total,
    reasons: Object.values(dimensions).map((item) => item.reason),
  };
}

function resolveAssignmentConfig(scenarioId) {
  return getScenarioById(scenarioId) || {
    id: scenarioId,
    name: 'Custom assignment',
    description: 'No strict scene template',
    requiredComponents: [],
    requiredConnections: [],
  };
}

module.exports = {
  scoreSubmission,
  resolveAssignmentConfig,
};
