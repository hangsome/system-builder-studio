import type { Connection, PlacedComponent } from '@/types/simulator';

const sensorSignalPins = new Set(['data', 'io', 'out', 'signal']);
const actuatorSignalPins = new Set(['io', 'in', 'din', 'signal']);

export function extractMicrobitReadPins(code: string) {
  const pins = new Set<string>();
  const readPattern = /\bpin(\d+)\s*\.\s*read_(?:analog|digital)\s*\(/gi;
  let match = readPattern.exec(code);

  while (match) {
    pins.add(`p${match[1]}`);
    match = readPattern.exec(code);
  }

  return pins;
}

export function extractMicrobitWritePins(code: string) {
  const pins = new Set<string>();
  const writePattern = /\bpin(\d+)\s*\.\s*write_(?:analog|digital)\s*\(/gi;
  let match = writePattern.exec(code);

  while (match) {
    pins.add(`p${match[1]}`);
    match = writePattern.exec(code);
  }

  return pins;
}

export function getSensorExpansionPin(
  sensor: PlacedComponent,
  placedComponents: PlacedComponent[],
  connections: Connection[]
) {
  for (const connection of connections) {
    const sensorOnFromSide =
      connection.fromComponent === sensor.instanceId && sensorSignalPins.has(connection.fromPin);
    const sensorOnToSide =
      connection.toComponent === sensor.instanceId && sensorSignalPins.has(connection.toPin);

    if (!sensorOnFromSide && !sensorOnToSide) {
      continue;
    }

    const otherComponentId = sensorOnFromSide ? connection.toComponent : connection.fromComponent;
    const otherPinId = sensorOnFromSide ? connection.toPin : connection.fromPin;
    const otherComponent = placedComponents.find((component) => component.instanceId === otherComponentId);

    if (otherComponent?.definitionId === 'expansion-board' && /^p\d+$/i.test(otherPinId)) {
      return otherPinId.toLowerCase();
    }
  }

  return null;
}

export function getSensorPinMismatchMessage(
  sensor: PlacedComponent,
  placedComponents: PlacedComponent[],
  connections: Connection[],
  code: string
) {
  const readPins = extractMicrobitReadPins(code);
  if (readPins.size === 0) return null;

  const connectedPin = getSensorExpansionPin(sensor, placedComponents, connections);
  if (!connectedPin || readPins.has(connectedPin)) return null;

  const expectedPins = Array.from(readPins).map((pin) => pin.toUpperCase()).join(' / ');
  return `代码读取 ${expectedPins}，但传感器信号线接在 ${connectedPin.toUpperCase()}，micro:bit 无法读到该传感器数据`;
}

export function getActuatorExpansionPin(
  actuator: PlacedComponent,
  placedComponents: PlacedComponent[],
  connections: Connection[]
) {
  for (const connection of connections) {
    const actuatorOnFromSide =
      connection.fromComponent === actuator.instanceId && actuatorSignalPins.has(connection.fromPin);
    const actuatorOnToSide =
      connection.toComponent === actuator.instanceId && actuatorSignalPins.has(connection.toPin);

    if (!actuatorOnFromSide && !actuatorOnToSide) {
      continue;
    }

    const otherComponentId = actuatorOnFromSide ? connection.toComponent : connection.fromComponent;
    const otherPinId = actuatorOnFromSide ? connection.toPin : connection.fromPin;
    const otherComponent = placedComponents.find((component) => component.instanceId === otherComponentId);

    if (otherComponent?.definitionId === 'expansion-board' && /^p\d+$/i.test(otherPinId)) {
      return otherPinId.toLowerCase();
    }
  }

  return null;
}

export function getActuatorPinMismatchMessage(
  actuator: PlacedComponent,
  placedComponents: PlacedComponent[],
  connections: Connection[],
  code: string
) {
  const writePins = extractMicrobitWritePins(code);
  if (writePins.size === 0) return null;

  const connectedPin = getActuatorExpansionPin(actuator, placedComponents, connections);
  if (!connectedPin || writePins.has(connectedPin)) return null;

  const expectedPins = Array.from(writePins).map((pin) => pin.toUpperCase()).join(' / ');
  return `代码控制 ${expectedPins}，但执行器信号线接在 ${connectedPin.toUpperCase()}，服务器下发指令后执行器不会响应`;
}

export function getUploadMethodMismatchMessage(code: string) {
  const hasUploadRoute = /\/upload/i.test(code) || /UPLOAD_ROUTE\s*=\s*["']\/upload["']/i.test(code);
  const callsGetUpload = /http_get\s*\(/i.test(code) && hasUploadRoute;
  const hasIdParam = /[?&]id=|id\s*=/i.test(code);
  const hasValParam = /[?&]val=|val\s*=/i.test(code);
  if (callsGetUpload && hasIdParam && hasValParam) return null;

  if (/http_post\s*\(/i.test(code) && hasUploadRoute) {
    return '课堂设定 micro:bit 上传数据应使用 GET /upload?id=传感器编号&val=温度值，但当前代码仍在使用 POST /upload';
  }

  if (callsGetUpload) {
    return 'GET /upload 上传时需要同时带 id 和 val 两个查询参数';
  }

  return '没有检测到向 /upload 上传温度数据的 HTTP GET 请求';
}
