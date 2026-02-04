import { describe, expect, it } from "vitest";
import {
  simulateFlaskRoute,
  type SimulatedHttpRequest,
} from "@/lib/simulationEngine";
import type { DatabaseState, ServerConfig } from "@/types/simulator";

const baseDatabase: DatabaseState = {
  tables: [],
  records: {
    sensorlog: [],
  },
};

const serverConfig: ServerConfig = {
  ip: "192.168.1.100",
  port: 5000,
  running: true,
  routes: [
    { path: "/upload", method: "POST", handler: "upload_data" },
    { path: "/query", method: "GET", handler: "query_data" },
  ],
  logs: [],
};

describe("simulateFlaskRoute", () => {
  it("handles upload_data by appending to the database", () => {
    const request: SimulatedHttpRequest = {
      method: "POST",
      path: "/upload",
      body: { temperature: 23.5 },
      timestamp: new Date(),
    };

    const result = simulateFlaskRoute(request, serverConfig, baseDatabase);

    expect(result.response.status).toBe(200);
    expect(result.updatedDatabase?.records.sensorlog.length).toBe(1);
  });

  it("returns recent records for query_data", () => {
    const uploadRequest: SimulatedHttpRequest = {
      method: "POST",
      path: "/upload",
      body: { temperature: 25 },
      timestamp: new Date(),
    };
    const uploadResult = simulateFlaskRoute(uploadRequest, serverConfig, baseDatabase);

    const queryRequest: SimulatedHttpRequest = {
      method: "GET",
      path: "/query",
      timestamp: new Date(),
    };
    const queryResult = simulateFlaskRoute(
      queryRequest,
      serverConfig,
      uploadResult.updatedDatabase ?? baseDatabase,
    );

    expect(queryResult.response.status).toBe(200);
    expect(Array.isArray(queryResult.response.body)).toBe(true);
  });

  it("returns 404 for unknown routes", () => {
    const request: SimulatedHttpRequest = {
      method: "GET",
      path: "/missing",
      timestamp: new Date(),
    };

    const result = simulateFlaskRoute(request, serverConfig, baseDatabase);

    expect(result.response.status).toBe(404);
  });
});
