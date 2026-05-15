const { getScenarioById } = require('./scenarioCatalog');

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

function codeHasPostUpload(code) {
  const text = String(code || '');
  return /\/upload/i.test(text) && /(http_post|requests\.post|method\s*=\s*['"]POST['"])/i.test(text);
}

function flaskHasPostUploadRoute(code) {
  const text = String(code || '');
  return /@app\.route\s*\(\s*['"]\/upload['"]\s*,\s*methods\s*=\s*\[[^\]]*['"]POST['"]/i.test(text);
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
  const uploadOk = codeHasPostUpload(microbitCode);
  const flaskUploadOk = flaskHasPostUploadRoute(flaskCode);
  const homeRenderOk = codeHasHomeRender(flaskCode);

  const checks = [
    { ok: sensorFixed, score: 10, label: `传感器读取引脚与画布连线对应${sensorPin ? `(${sensorPin.toUpperCase()})` : ''}` },
    { ok: buzzerFixed, score: 10, label: `执行器控制引脚与画布连线对应${actuatorPin ? `(${actuatorPin.toUpperCase()})` : ''}` },
    { ok: uploadOk, score: 3, label: 'micro:bit 上传使用 POST /upload' },
    { ok: flaskUploadOk, score: 2, label: 'Flask 提供 POST /upload 接收路由' },
    { ok: homeRenderOk, score: 5, label: '首页使用 GET / 和 render_template 展示数据' },
  ];

  return {
    score: checks.filter((item) => item.ok).reduce((sum, item) => sum + item.score, 0),
    reason: checks.map((item) => `${item.label}=${item.ok ? 'yes' : 'no'}`).join(', '),
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
  const postUploadSucceeded = logs.some((log) => /POST\s+http:\/\/.+\/upload/i.test(String(log?.message || log || ''))) &&
    logs.some((log) => /响应:\s*200\s*OK/i.test(String(log?.message || log || '')));
  const sensorlogAdded = dbCount > 0 &&
    logs.some((log) => /sensorlog\s*表新增|数据库已更新/i.test(String(log?.message || log || '')));
  const actuatorResponded = logs.some((log) => /BUZZER_ON.*蜂鸣器已响应|蜂鸣器已响应|蜂鸣器报警/i.test(String(log?.message || log || '')));
  const browserGetSucceeded = logs.some((log) => /GET\s+http:\/\/.+\/$/i.test(String(log?.message || log || ''))) &&
    logs.some((log) => /GET\s+\/.*render_template|render_template.*sensorlog/i.test(String(log?.message || log || '')));

  const issueScore = issues.length === 0 ? 5 : Math.max(0, 5 - issues.length);
  const postScore = postUploadSucceeded ? 5 : 0;
  const dbScore = sensorlogAdded ? 5 : dbCount > 0 ? 3 : 0;
  const alarmScore = alarmRecorded && actuatorResponded ? 5 : alarmRecorded ? 3 : 0;
  const browserScore = browserGetSucceeded ? 5 : 0;

  return {
    score: issueScore + postScore + dbScore + alarmScore + browserScore,
    reason: `issues=${issues.length}, postUpload=${postUploadSucceeded ? 'yes' : 'no'}, sensorlogAdded=${sensorlogAdded ? 'yes' : 'no'}(${dbCount}), alarmAndActuator=${alarmScore === 5 ? 'yes' : alarmScore > 0 ? 'partial' : 'no'}, browserGet=${browserGetSucceeded ? 'yes' : 'no'}`,
  };
}

function scoreClassroomClient(snapshot) {
  const checks = [
    { ok: hasComponent(snapshot, 'pc-computer'), score: 5, label: '已补充 PC 电脑' },
    { ok: hasComponent(snapshot, 'browser'), score: 5, label: '已补充浏览器' },
    { ok: hasComponent(snapshot, 'mobile-client'), score: 5, label: '已补充手机/移动终端' },
  ];

  return {
    score: checks.filter((item) => item.ok).reduce((sum, item) => sum + item.score, 0),
    reason: checks.map((item) => `${item.label}=${item.ok ? 'yes' : 'no'}`).join(', '),
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
    const code = scoreClassroomCode(snapshot);
    const dataFlow = scoreDataFlow(snapshot, evidence);
    const client = scoreClassroomClient(snapshot);

    const dimensions = {
      canvas: {
        id: 'canvas',
        label: '画布组件与连线',
        max: 30,
        score: Math.round(completeness.score * 10) / 10,
        reason: completeness.reason,
      },
      code: {
        id: 'code',
        label: '代码关键修改',
        max: 30,
        score: Math.round(code.score * 10) / 10,
        reason: code.reason,
      },
      dataFlow: {
        id: 'dataFlow',
        label: '运行与数据流',
        max: 25,
        score: Math.round(dataFlow.score * 10) / 10,
        reason: dataFlow.reason,
      },
      client: {
        id: 'client',
        label: '用户端补全',
        max: 15,
        score: Math.round(client.score * 10) / 10,
        reason: client.reason,
      },
    };

    const total = Math.round(Object.values(dimensions).reduce((sum, item) => sum + item.score, 0) * 10) / 10;

    return {
      rubricVersion: 'classroom-temperature-v4',
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
