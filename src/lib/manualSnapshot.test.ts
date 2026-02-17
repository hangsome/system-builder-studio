import { beforeEach, describe, expect, it } from "vitest";
import {
  loadManualSnapshot,
  MANUAL_SNAPSHOT_STORAGE_KEY,
  MANUAL_SNAPSHOT_VERSION,
  saveManualSnapshot,
  validateSnapshot,
  type ManualSnapshotData,
} from "@/lib/manualSnapshot";

const baseSnapshotData: ManualSnapshotData = {
  placedComponents: [
    {
      instanceId: "sensor-1",
      definitionId: "temp-humidity-sensor",
      position: { x: 10, y: 20 },
    },
  ],
  connections: [],
  microbitCode: "print('hello')",
  flaskCode: "app.run()",
  database: {
    tables: [],
    records: {},
  },
  routerConfig: {
    ssid: "School_WiFi",
    password: "12345678",
    ip: "192.168.1.1",
    connectedDevices: [],
  },
  serverConfig: {
    ip: "192.168.1.100",
    port: 5000,
    running: false,
    routes: [],
    logs: [],
  },
  sensorValues: {
    "sensor-1": 26.3,
  },
};

describe("manualSnapshot", () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it("saves and loads a valid snapshot", () => {
    const saved = saveManualSnapshot(baseSnapshotData);
    const loaded = loadManualSnapshot();

    expect(saved.version).toBe(MANUAL_SNAPSHOT_VERSION);
    expect(loaded).not.toBeNull();
    expect(loaded?.data.microbitCode).toBe(baseSnapshotData.microbitCode);
    expect(loaded?.data.sensorValues?.["sensor-1"]).toBe(26.3);
  });

  it("returns null when stored snapshot is malformed", () => {
    localStorage.setItem(
      MANUAL_SNAPSHOT_STORAGE_KEY,
      JSON.stringify({
        version: 999,
        savedAt: new Date().toISOString(),
        data: {},
      }),
    );

    expect(loadManualSnapshot()).toBeNull();
  });

  it("validates snapshot payload shape", () => {
    const validPayload = {
      version: MANUAL_SNAPSHOT_VERSION,
      savedAt: new Date().toISOString(),
      data: baseSnapshotData,
    };

    expect(validateSnapshot(validPayload)).toBe(true);
    expect(
      validateSnapshot({
        ...validPayload,
        data: { ...baseSnapshotData, sensorValues: { broken: "26" } },
      }),
    ).toBe(false);
  });
});
