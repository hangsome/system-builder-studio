import { describe, expect, it } from 'vitest';
import { classroomDatabase, classroomServerConfig } from '@/data/classroomLesson';
import { classroomTemperatureScenario } from '@/data/scenarios';
import { canRunSimulation, simulateFlaskRoute } from '@/lib/simulationEngine';

function cloneDatabase() {
  return JSON.parse(JSON.stringify(classroomDatabase));
}

describe('simulateFlaskRoute classroom HTTP methods', () => {
  it('accepts GET /upload with id and val and writes a sensorlog record', () => {
    const result = simulateFlaskRoute(
      {
        method: 'GET',
        path: '/upload?id=2&val=31.2',
        timestamp: new Date(),
      },
      classroomServerConfig,
      cloneDatabase()
    );

    expect(result.response.status).toBe(200);
    expect(result.response.body).toMatchObject({ command: 'BUZZER_ON' });
    expect(result.updatedDatabase?.records.sensorlog).toHaveLength(1);
    expect(result.updatedDatabase?.records.sensorlog[0]).toMatchObject({ sensor_id: 2, value: 31.2 });
  });

  it('rejects POST /upload when the route is configured as GET', () => {
    const result = simulateFlaskRoute(
      {
        method: 'POST',
        path: '/upload',
        body: { id: 1, val: 31.2 },
        timestamp: new Date(),
      },
      classroomServerConfig,
      cloneDatabase()
    );

    expect(result.response.status).toBe(404);
  });

  it('serves GET / with render_template-style data without changing the database', () => {
    const database = cloneDatabase();
    const result = simulateFlaskRoute(
      {
        method: 'GET',
        path: '/',
        timestamp: new Date(),
      },
      classroomServerConfig,
      database
    );

    expect(result.response.status).toBe(200);
    expect(result.response.body).toMatchObject({
      template: 'index.html',
      render: 'render_template',
      records: [],
    });
    expect(result.updatedDatabase).toBeUndefined();
  });
});

describe('classroom canvas runtime readiness', () => {
  it('keeps the starter canvas half-finished without pre-placed user-end devices', () => {
    const definitionIds = classroomTemperatureScenario.components.map((component) => component.definitionId);
    expect(definitionIds).toEqual(
      expect.arrayContaining([
        'microbit',
        'expansion-board',
        'iot-module',
        'router',
        'web-server',
        'database',
      ])
    );
    expect(definitionIds).not.toContain('pc-computer');
    expect(definitionIds).not.toContain('browser');
    expect(definitionIds).not.toContain('mobile-client');
    expect(definitionIds).not.toContain('temp-humidity-sensor');
    expect(definitionIds).not.toContain('buzzer');

    const readiness = canRunSimulation(
      classroomTemperatureScenario.components,
      classroomTemperatureScenario.connections,
      true,
      true
    );
    expect(readiness.canRun).toBe(true);
    expect(readiness.issues).toEqual([]);
  });
});
