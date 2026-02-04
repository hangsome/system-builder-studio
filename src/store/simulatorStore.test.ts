import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { useSimulatorStore } from "@/store/simulatorStore";
import type { PlacedComponent } from "@/types/simulator";

const microbit: PlacedComponent = {
  instanceId: "microbit-1",
  definitionId: "microbit",
  position: { x: 0, y: 0 },
};

const tempSensor: PlacedComponent = {
  instanceId: "temp-1",
  definitionId: "temp-humidity-sensor",
  position: { x: 120, y: 0 },
};

describe("simulatorStore", () => {
  let idCounter = 0;

  beforeEach(() => {
    idCounter = 0;
    vi.stubGlobal("crypto", {
      randomUUID: () => `test-id-${++idCounter}`,
    });
    useSimulatorStore.persist.clearStorage();
    useSimulatorStore.getState().resetSimulator();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("creates a connection and prevents duplicates", () => {
    const store = useSimulatorStore.getState();

    store.addComponent(microbit);
    store.addComponent(tempSensor);

    store.startConnection("microbit-1", "p0");
    store.completeConnection("temp-1", "data");

    let state = useSimulatorStore.getState();
    expect(state.connections).toHaveLength(1);

    store.startConnection("microbit-1", "p0");
    store.completeConnection("temp-1", "data");

    state = useSimulatorStore.getState();
    expect(state.connections).toHaveLength(1);
    expect(state.lastConnectionResult?.success).toBe(false);
  });

  it("resetSimulator clears components and connections", () => {
    const store = useSimulatorStore.getState();

    store.addComponent(microbit);
    store.addComponent(tempSensor);

    store.resetSimulator();

    const state = useSimulatorStore.getState();
    expect(state.placedComponents).toHaveLength(0);
    expect(state.connections).toHaveLength(0);
    expect(state.isRunning).toBe(false);
  });
});
