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

  const providedDefinitionIds = new Set(components.map((item) => item.definitionId));
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

function scoreCorrectness(snapshot, evidence) {
  const issues = Array.isArray(evidence?.validationIssues) ? evidence.validationIssues : [];
  const logs = Array.isArray(evidence?.logs)
    ? evidence.logs
    : Array.isArray(snapshot?.serverConfig?.logs)
      ? snapshot.serverConfig.logs
      : [];

  const dbSensorLog = snapshot?.database?.records?.sensorlog;
  const dbCount = Array.isArray(dbSensorLog) ? dbSensorLog.length : Number(evidence?.sensorlogCount || 0);

  const systemScore = issues.length === 0 ? 10 : Math.max(0, 10 - issues.length * 2);
  const logsScore = Math.min(10, Math.round((logs.length / 5) * 10 * 10) / 10);
  const dbScore = dbCount > 0 ? 10 : 0;

  return {
    score: systemScore + logsScore + dbScore,
    reason: `issues=${issues.length}, logs=${logs.length}, sensorlog=${dbCount}`,
  };
}

function scoreTroubleshooting(labReport) {
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

  const completeness = scoreCompleteness(snapshot, assignmentConfig);
  const correctness = scoreCorrectness(snapshot, evidence);
  const troubleshooting = scoreTroubleshooting(labReport);
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
