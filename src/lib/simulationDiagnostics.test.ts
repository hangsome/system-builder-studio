import { describe, expect, it } from 'vitest';
import {
  extractMicrobitReadPins,
  extractMicrobitWritePins,
  getActuatorExpansionPin,
  getActuatorPinMismatchMessage,
  getSensorExpansionPin,
  getSensorPinMismatchMessage,
  getUploadMethodMismatchMessage,
} from '@/lib/simulationDiagnostics';
import type { Connection, PlacedComponent } from '@/types/simulator';

const tempSensor: PlacedComponent = {
  instanceId: 'temp-1',
  definitionId: 'temp-humidity-sensor',
  position: { x: 0, y: 0 },
};

const buzzer: PlacedComponent = {
  instanceId: 'buzzer-1',
  definitionId: 'buzzer',
  position: { x: 0, y: 0 },
};

const expansionBoard: PlacedComponent = {
  instanceId: 'expansion-1',
  definitionId: 'expansion-board',
  position: { x: 0, y: 0 },
};

function sensorDataConnection(expansionPin: string): Connection {
  return {
    id: `conn-${expansionPin}`,
    fromComponent: tempSensor.instanceId,
    fromPin: 'data',
    toComponent: expansionBoard.instanceId,
    toPin: expansionPin,
    type: 'data',
    valid: true,
  };
}

function actuatorSignalConnection(expansionPin: string): Connection {
  return {
    id: `conn-buzzer-${expansionPin}`,
    fromComponent: buzzer.instanceId,
    fromPin: 'io',
    toComponent: expansionBoard.instanceId,
    toPin: expansionPin,
    type: 'data',
    valid: true,
  };
}

describe('simulation diagnostics', () => {
  it('extracts micro:bit sensor read pins from Python code', () => {
    const pins = extractMicrobitReadPins(`
raw = pin0.read_analog()
button = pin8.read_digital()
pin3.write_digital(1)
`);

    expect(Array.from(pins).sort()).toEqual(['p0', 'p8']);
  });

  it('detects the expansion pin used by the sensor signal wire', () => {
    expect(
      getSensorExpansionPin(tempSensor, [tempSensor, expansionBoard], [sensorDataConnection('p1')])
    ).toBe('p1');
  });

  it('returns no mismatch when code and sensor wiring use the same pin', () => {
    expect(
      getSensorPinMismatchMessage(
        tempSensor,
        [tempSensor, expansionBoard],
        [sensorDataConnection('p0')],
        'raw = pin0.read_analog()'
      )
    ).toBeNull();
  });

  it('reports a classroom-friendly sensor mismatch when wiring and code disagree', () => {
    const message = getSensorPinMismatchMessage(
      tempSensor,
      [tempSensor, expansionBoard],
      [sensorDataConnection('p1')],
      'raw = pin0.read_analog()'
    );

    expect(message).toContain('P0');
    expect(message).toContain('P1');
  });

  it('extracts micro:bit actuator write pins from Python code', () => {
    const pins = extractMicrobitWritePins(`
pin3.write_digital(1)
pin8.write_analog(200)
raw = pin1.read_analog()
`);

    expect(Array.from(pins).sort()).toEqual(['p3', 'p8']);
  });

  it('detects and reports actuator signal pin mismatch', () => {
    expect(
      getActuatorExpansionPin(buzzer, [buzzer, expansionBoard], [actuatorSignalConnection('p2')])
    ).toBe('p2');

    const message = getActuatorPinMismatchMessage(
      buzzer,
      [buzzer, expansionBoard],
      [actuatorSignalConnection('p2')],
      'pin3.write_digital(1)'
    );

    expect(message).toContain('P3');
    expect(message).toContain('P2');
  });

  it('requires GET with id and val when uploading classroom data to /upload', () => {
    expect(getUploadMethodMismatchMessage('url = "/upload?id=1&val=25"\\nobloq.http_get(url)')).toBeNull();
    expect(getUploadMethodMismatchMessage('UPLOAD_ROUTE = "/upload"\\nobloq.http_post(url, data)')).toContain('GET /upload');
    expect(getUploadMethodMismatchMessage('url = "/upload?temperature=25"\\nobloq.http_get(url)')).toContain('id 和 val');
  });
});
