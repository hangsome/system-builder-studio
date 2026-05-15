import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { useSimulatorStore } from '@/store/simulatorStore';
import type { PlacedComponent } from '@/types/simulator';

const microbit: PlacedComponent = {
  instanceId: 'microbit-1',
  definitionId: 'microbit',
  position: { x: 0, y: 0 },
};

const expansionBoard: PlacedComponent = {
  instanceId: 'expansion-1',
  definitionId: 'expansion-board',
  position: { x: 20, y: 0 },
};

const iotModule: PlacedComponent = {
  instanceId: 'iot-1',
  definitionId: 'iot-module',
  position: { x: 40, y: 0 },
};

const tempSensor: PlacedComponent = {
  instanceId: 'temp-1',
  definitionId: 'temp-humidity-sensor',
  position: { x: 120, y: 0 },
};

const buzzer: PlacedComponent = {
  instanceId: 'buzzer-1',
  definitionId: 'buzzer',
  position: { x: 160, y: 0 },
};

const router: PlacedComponent = {
  instanceId: 'router-1',
  definitionId: 'router',
  position: { x: 200, y: 0 },
};

const webServer: PlacedComponent = {
  instanceId: 'server-1',
  definitionId: 'web-server',
  position: { x: 240, y: 0 },
};

const database: PlacedComponent = {
  instanceId: 'database-1',
  definitionId: 'database',
  position: { x: 280, y: 0 },
};

describe('simulatorStore', () => {
  let idCounter = 0;

  beforeEach(() => {
    idCounter = 0;
    vi.stubGlobal('crypto', {
      randomUUID: () => `test-id-${++idCounter}`,
    });
    useSimulatorStore.persist.clearStorage();
    useSimulatorStore.getState().resetSimulator();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('creates a connection and prevents duplicates', () => {
    const store = useSimulatorStore.getState();

    store.addComponent(microbit);
    store.addComponent(tempSensor);

    store.startConnection('microbit-1', 'p0');
    store.completeConnection('temp-1', 'data');

    let state = useSimulatorStore.getState();
    expect(state.connections).toHaveLength(1);

    store.startConnection('microbit-1', 'p0');
    store.completeConnection('temp-1', 'data');

    state = useSimulatorStore.getState();
    expect(state.connections).toHaveLength(1);
    expect(state.lastConnectionResult?.success).toBe(false);
  });

  it('resetSimulator clears components and connections', () => {
    const store = useSimulatorStore.getState();

    store.addComponent(microbit);
    store.addComponent(tempSensor);

    store.resetSimulator();

    const state = useSimulatorStore.getState();
    expect(state.placedComponents).toHaveLength(0);
    expect(state.connections).toHaveLength(0);
    expect(state.isRunning).toBe(false);
  });

  it('toggles a classroom component fault for troubleshooting activities', () => {
    const store = useSimulatorStore.getState();

    store.addComponent(tempSensor);
    store.setComponentFault(
      'temp-1',
      true,
      'hardware',
      '温度传感器故障：采集端无有效数据输出',
    );

    let state = useSimulatorStore.getState();
    expect(state.placedComponents[0].state?.fault).toBe(true);
    expect(state.placedComponents[0].state?.faultType).toBe('hardware');
    expect(state.lastConnectionResult?.success).toBe(false);

    store.setComponentFault('temp-1', false);

    state = useSimulatorStore.getState();
    expect(state.placedComponents[0].state?.fault).toBe(false);
    expect(state.placedComponents[0].state?.faultType).toBeUndefined();
    expect(state.lastConnectionResult?.success).toBe(true);
  });

  it('auto connects iot module to expansion board when added to canvas', () => {
    const store = useSimulatorStore.getState();

    store.addComponent(expansionBoard);
    store.addComponent(iotModule);

    const state = useSimulatorStore.getState();
    const hasConnection = (fromPin: string, toPin: string) =>
      state.connections.some(
        (connection) =>
          connection.fromComponent === 'iot-1' &&
          connection.toComponent === 'expansion-1' &&
          connection.fromPin === fromPin &&
          connection.toPin === toPin,
      );

    expect(hasConnection('vcc', '3v-out2')).toBe(true);
    expect(hasConnection('gnd', 'gnd-out2')).toBe(true);
    expect(hasConnection('tx', 'p15')).toBe(true);
    expect(hasConnection('rx', 'p16')).toBe(true);
  });

  it('auto connects classroom sensor and actuator to the planned pins', () => {
    const store = useSimulatorStore.getState();

    store.addComponent(expansionBoard);
    store.addComponent(tempSensor);
    store.addComponent(buzzer);

    const state = useSimulatorStore.getState();
    const hasConnection = (fromComponent: string, fromPin: string, toPin: string) =>
      state.connections.some(
        (connection) =>
          connection.fromComponent === fromComponent &&
          connection.toComponent === 'expansion-1' &&
          connection.fromPin === fromPin &&
          connection.toPin === toPin,
      );

    expect(hasConnection('temp-1', 'data', 'p1')).toBe(true);
    expect(hasConnection('buzzer-1', 'io', 'p2')).toBe(true);
  });

  it('auto connects IoT, router, server, and database classroom chain', () => {
    const store = useSimulatorStore.getState();

    store.addComponent(expansionBoard);
    store.addComponent(iotModule);
    store.addComponent(router);
    store.addComponent(webServer);
    store.addComponent(database);

    const state = useSimulatorStore.getState();
    const hasConnection = (fromComponent: string, fromPin: string, toComponent: string, toPin: string) =>
      state.connections.some(
        (connection) =>
          connection.fromComponent === fromComponent &&
          connection.fromPin === fromPin &&
          connection.toComponent === toComponent &&
          connection.toPin === toPin,
      );

    expect(hasConnection('iot-1', 'wifi', 'router-1', 'wifi')).toBe(true);
    expect(hasConnection('router-1', 'lan', 'server-1', 'network')).toBe(true);
    expect(hasConnection('server-1', 'db', 'database-1', 'connection')).toBe(true);
  });
});
