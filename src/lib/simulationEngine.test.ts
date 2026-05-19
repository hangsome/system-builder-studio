import { describe, expect, it } from 'vitest';
import { classroomDatabase, classroomServerConfig } from '@/data/classroomLesson';
import { simulateFlaskRoute } from '@/lib/simulationEngine';

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
