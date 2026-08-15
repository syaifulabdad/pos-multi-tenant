import type { ApiError, ApiSuccess, HealthData } from '@pos/contracts';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { app } from '../src/app';
import type { WorkerBindings } from '../src/types';

function createEnvironment(probe: DatabaseProbe = { ok: 1 }): WorkerBindings {
  const statement = {
    first: vi.fn(async () => probe),
  };
  const database = {
    prepare: vi.fn(() => statement),
  };

  return {
    DB: database as unknown as D1Database,
    STORAGE: {} as R2Bucket,
    CACHE: {} as KVNamespace,
    ASSETS: {} as Fetcher,
    APP_ENV: 'test',
    BASE_DOMAIN: 'example.test',
    LOG_LEVEL: 'error',
  };
}

interface DatabaseProbe {
  readonly ok: number;
}

describe('API foundation', () => {
  beforeEach(() => {
    vi.spyOn(console, 'error').mockImplementation(() => undefined);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('returns the standard success envelope and verifies D1', async () => {
    const response = await app.request('/api/v1/health', {}, createEnvironment());
    const body = await response.json<ApiSuccess<HealthData>>();

    expect(response.status).toBe(200);
    expect(response.headers.get('X-Request-ID')).toMatch(/^[0-9a-f-]{36}$/);
    expect(body.success).toBe(true);
    expect(body.data).toMatchObject({
      status: 'ok',
      environment: 'test',
      services: {
        database: 'up',
        objectStorage: 'configured',
        cache: 'configured',
      },
    });
    expect(body.meta.request_id).toBe(response.headers.get('X-Request-ID'));
  });

  it('keeps a valid caller request ID for distributed tracing', async () => {
    const requestId = 'edge-request-12345678';
    const response = await app.request(
      '/api/v1/health',
      { headers: { 'X-Request-ID': requestId } },
      createEnvironment(),
    );
    const body = await response.json<ApiSuccess<HealthData>>();

    expect(response.headers.get('X-Request-ID')).toBe(requestId);
    expect(body.meta.request_id).toBe(requestId);
  });

  it('replaces an invalid caller request ID', async () => {
    const response = await app.request(
      '/api/v1/health',
      { headers: { 'X-Request-ID': 'short' } },
      createEnvironment(),
    );

    expect(response.headers.get('X-Request-ID')).not.toBe('short');
    expect(response.headers.get('X-Request-ID')).toMatch(/^[0-9a-f-]{36}$/);
  });

  it('uses the standard error envelope for unknown routes', async () => {
    const response = await app.request('/api/v1/unknown', {}, createEnvironment());
    const body = await response.json<ApiError>();

    expect(response.status).toBe(404);
    expect(body).toMatchObject({
      success: false,
      message: 'Resource not found',
      errors: {},
      code: 'NOT_FOUND',
    });
    expect(body.request_id).toBe(response.headers.get('X-Request-ID'));
  });

  it('does not leak database errors when a dependency is unavailable', async () => {
    const env = createEnvironment();
    env.DB.prepare = vi.fn(() => {
      throw new Error('sensitive database connection detail');
    });

    const response = await app.request('/api/v1/health', {}, env);
    const body = await response.json<ApiError>();

    expect(response.status).toBe(503);
    expect(body).toMatchObject({
      success: false,
      message: 'Service temporarily unavailable',
      errors: {},
      code: 'DEPENDENCY_UNAVAILABLE',
    });
    expect(JSON.stringify(body)).not.toContain('sensitive database connection detail');
  });
});
