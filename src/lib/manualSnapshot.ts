import type {
  Connection,
  DatabaseState,
  PlacedComponent,
  RouterConfig,
  ServerConfig,
} from "@/types/simulator";

export const MANUAL_SNAPSHOT_STORAGE_KEY = "simulator-manual-save";
export const MANUAL_SNAPSHOT_VERSION = 1;

export interface ManualSnapshotData {
  placedComponents: PlacedComponent[];
  connections: Connection[];
  microbitCode: string;
  flaskCode: string;
  database: DatabaseState;
  routerConfig: RouterConfig;
  serverConfig: ServerConfig;
  sensorValues?: Record<string, number>;
}

export interface ManualSnapshot {
  version: number;
  savedAt: string;
  data: ManualSnapshotData;
}

function isObjectRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function isNumberRecord(value: unknown): value is Record<string, number> {
  if (!isObjectRecord(value)) {
    return false;
  }

  return Object.values(value).every((item) => typeof item === "number");
}

function isStringArray(value: unknown): value is string[] {
  return Array.isArray(value) && value.every((item) => typeof item === "string");
}

export function validateSnapshot(payload: unknown): payload is ManualSnapshot {
  if (!isObjectRecord(payload)) {
    return false;
  }

  const version = payload.version;
  const savedAt = payload.savedAt;
  const data = payload.data;

  if (
    version !== MANUAL_SNAPSHOT_VERSION ||
    typeof savedAt !== "string" ||
    Number.isNaN(new Date(savedAt).getTime())
  ) {
    return false;
  }

  if (!isObjectRecord(data)) {
    return false;
  }

  const routerConfig = data.routerConfig;
  const serverConfig = data.serverConfig;
  const database = data.database;

  if (
    !Array.isArray(data.placedComponents) ||
    !Array.isArray(data.connections) ||
    typeof data.microbitCode !== "string" ||
    typeof data.flaskCode !== "string" ||
    !isObjectRecord(database) ||
    !Array.isArray(database.tables) ||
    !isObjectRecord(database.records) ||
    !isObjectRecord(routerConfig) ||
    typeof routerConfig.ssid !== "string" ||
    typeof routerConfig.password !== "string" ||
    typeof routerConfig.ip !== "string" ||
    !isStringArray(routerConfig.connectedDevices) ||
    !isObjectRecord(serverConfig) ||
    typeof serverConfig.ip !== "string" ||
    typeof serverConfig.port !== "number" ||
    typeof serverConfig.running !== "boolean" ||
    !Array.isArray(serverConfig.routes) ||
    !Array.isArray(serverConfig.logs)
  ) {
    return false;
  }

  if (data.sensorValues !== undefined && !isNumberRecord(data.sensorValues)) {
    return false;
  }

  return true;
}

export function saveManualSnapshot(data: ManualSnapshotData): ManualSnapshot {
  const snapshot: ManualSnapshot = {
    version: MANUAL_SNAPSHOT_VERSION,
    savedAt: new Date().toISOString(),
    data,
  };

  localStorage.setItem(MANUAL_SNAPSHOT_STORAGE_KEY, JSON.stringify(snapshot));
  return snapshot;
}

export function loadManualSnapshot(): ManualSnapshot | null {
  const raw = localStorage.getItem(MANUAL_SNAPSHOT_STORAGE_KEY);
  if (!raw) {
    return null;
  }

  try {
    const parsed = JSON.parse(raw);
    return validateSnapshot(parsed) ? parsed : null;
  } catch {
    return null;
  }
}
