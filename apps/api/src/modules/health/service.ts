import type { HealthData } from '@pos/contracts';

import { DependencyUnavailableError } from '../../lib/errors';
import type { WorkerBindings } from '../../types';

interface DatabaseProbe {
  readonly ok: number;
}

export async function checkHealth(env: WorkerBindings): Promise<HealthData> {
  try {
    const probe = await env.DB.prepare('SELECT 1 AS ok').first<DatabaseProbe>();
    if (probe?.ok !== 1) throw new Error('Unexpected database probe result');
  } catch (error) {
    throw new DependencyUnavailableError(error);
  }

  return {
    status: 'ok',
    environment: env.APP_ENV,
    services: {
      database: 'up',
      objectStorage: 'configured',
      cache: 'configured',
    },
    checkedAt: new Date().toISOString(),
  };
}
