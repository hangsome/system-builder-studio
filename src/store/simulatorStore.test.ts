import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { useSimulatorStore } from '@/store/simulatorStore';
import { loadScenario } from '@/data/scenarios';
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

const lightSensor: PlacedComponent = {
  instanceId: 'light-1',
  definitionId: 'light-sensor',
  position: { x: 120, y: 80 },
};

const buzzer: PlacedComponent = {
  instanceId: 'buzzer-1',
  definitionId: 'buzzer',
  position: { x: 160, y: 0 },
};

const ledStrip: PlacedComponent = {
  instanceId: 'led-1',
  definitionId: 'led-strip',
  position: { x: 160, y: 80 },
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
    useSimulatorStore.getState().setAutoConnectEnabled(false);
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

  it('rejects a manual connection when either pin is already occupied', () => {
    const store = useSimulatorStore.getState();

    store.addComponent(microbit);
    store.addComponent(tempSensor);
    store.addComponent(lightSensor);

    store.startConnection('microbit-1', 'p0');
    store.completeConnection('temp-1', 'data');
    store.startConnection('microbit-1', 'p0');
    store.completeConnection('light-1', 'ao');

    const state = useSimulatorStore.getState();
    expect(state.connections).toHaveLength(1);
    expect(state.lastConnectionResult?.success).toBe(false);
    expect(state.lastConnectionResult?.message).toContain('已被占用');
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

  it('keeps component auto connection disabled by default', () => {
    const store = useSimulatorStore.getState();

    store.addComponent(expansionBoard);
    store.addComponent(iotModule);

    const state = useSimulatorStore.getState();
    expect(state.autoConnectEnabled).toBe(false);
    expect(state.connections).toHaveLength(0);
  });

  it('auto connects iot module to expansion board when added to canvas', () => {
    const store = useSimulatorStore.getState();

    store.setAutoConnectEnabled(true);
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

  it('adds a smart terminal as a microbit and expansion board pair', () => {
    const store = useSimulatorStore.getState();

    store.setAutoConnectEnabled(true);
    store.addSmartTerminal({ x: 250, y: 260 });

    const state = useSimulatorStore.getState();
    const microbit = state.placedComponents.find((component) => component.definitionId === 'microbit');
    const expansion = state.placedComponents.find((component) => component.definitionId === 'expansion-board');

    expect(microbit?.position).toEqual({ x: 310, y: 85 });
    expect(expansion?.position).toEqual({ x: 250, y: 260 });
    expect(
      state.connections.some(
        (connection) =>
          connection.fromComponent === microbit?.instanceId &&
          connection.fromPin === 'p1' &&
          connection.toComponent === expansion?.instanceId &&
          connection.toPin === 'slot-p1',
      ),
    ).toBe(true);
  });

  it('moves a collapsed smart terminal as one grouped component', () => {
    const store = useSimulatorStore.getState();

    store.addComponent(microbit);
    store.addComponent(expansionBoard);
    store.updateComponentPosition('expansion-1', { x: 120, y: 140 });

    const state = useSimulatorStore.getState();
    expect(state.placedComponents.find((component) => component.instanceId === 'expansion-1')?.position).toEqual({
      x: 120,
      y: 140,
    });
    expect(state.placedComponents.find((component) => component.instanceId === 'microbit-1')?.position).toEqual({
      x: 100,
      y: 140,
    });
  });

  it('loads the classroom starter canvas as the optimized core chain only', () => {
    const scenario = loadScenario('classroom-temperature');
    expect(scenario).toBeTruthy();

    useSimulatorStore.getState().loadScenario(scenario!);
    const state = useSimulatorStore.getState();
    const definitionIds = state.placedComponents.map((component) => component.definitionId);

    expect(definitionIds).toEqual([
      'microbit',
      'expansion-board',
      'iot-module',
      'router',
      'web-server',
      'database',
    ]);
    expect(state.placedComponents.find((component) => component.definitionId === 'expansion-board')?.position).toEqual({
      x: 250,
      y: 260,
    });
    expect(state.browserUrl).toBe('');
    expect(state.detailsVisible).toBe(false);
  });

  it('keeps a manually entered browser URL until the browser state is reset', () => {
    const store = useSimulatorStore.getState();

    store.setBrowserUrl('http://192.168.1.100:5000/');
    expect(useSimulatorStore.getState().browserUrl).toBe('http://192.168.1.100:5000/');

    store.resetBrowserState();
    expect(useSimulatorStore.getState().browserUrl).toBe('');
  });

  it('auto connects classroom sensor and actuator to the planned pins', () => {
    const store = useSimulatorStore.getState();

    store.setAutoConnectEnabled(true);
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

    expect(hasConnection('temp-1', 'data', 'p0')).toBe(true);
    expect(hasConnection('buzzer-1', 'io', 'p3')).toBe(true);
  });

  it('only auto connects classroom components that match the current code pins', () => {
    const store = useSimulatorStore.getState();

    store.setAutoConnectEnabled(true);
    store.addComponent(expansionBoard);
    store.addComponent(tempSensor);
    store.addComponent(lightSensor);
    store.addComponent(buzzer);
    store.addComponent(ledStrip);

    const state = useSimulatorStore.getState();
    const expansionPins = state.connections
      .filter((connection) => connection.toComponent === 'expansion-1')
      .map((connection) => connection.toPin);
    const uniqueExpansionPins = new Set(expansionPins);

    expect(uniqueExpansionPins.size).toBe(expansionPins.length);
    expect(
      state.connections.some(
        (connection) =>
          connection.fromComponent === 'temp-1' &&
          connection.fromPin === 'data' &&
          connection.toComponent === 'expansion-1' &&
          connection.toPin === 'p0',
      ),
    ).toBe(true);
    expect(
      state.connections.some(
        (connection) =>
          connection.fromComponent === 'buzzer-1' &&
          connection.fromPin === 'io' &&
          connection.toComponent === 'expansion-1' &&
          connection.toPin === 'p3',
      ),
    ).toBe(true);
    expect(state.connections.some((connection) => connection.fromComponent === 'light-1')).toBe(false);
    expect(state.connections.some((connection) => connection.fromComponent === 'led-1')).toBe(false);
  });

  it('auto connects IoT, router, server, and database classroom chain', () => {
    const store = useSimulatorStore.getState();

    store.setAutoConnectEnabled(true);
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

  it('auto connects the WiFi link when router and IoT are added in either order', () => {
    let store = useSimulatorStore.getState();

    store.setAutoConnectEnabled(true);
    store.addComponent(iotModule);
    store.addComponent(router);

    let state = useSimulatorStore.getState();
    expect(
      state.connections.some(
        (connection) =>
          connection.fromComponent === 'iot-1' &&
          connection.fromPin === 'wifi' &&
          connection.toComponent === 'router-1' &&
          connection.toPin === 'wifi',
      ),
    ).toBe(true);

    useSimulatorStore.getState().resetSimulator();
    store = useSimulatorStore.getState();
    store.addComponent(router);
    store.addComponent(iotModule);

    state = useSimulatorStore.getState();
    expect(
      state.connections.some(
        (connection) =>
          connection.fromComponent === 'iot-1' &&
          connection.fromPin === 'wifi' &&
          connection.toComponent === 'router-1' &&
          connection.toPin === 'wifi',
      ),
    ).toBe(true);
  });
});
