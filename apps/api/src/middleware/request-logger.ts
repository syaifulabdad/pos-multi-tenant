import { createMiddleware } from 'hono/factory';

import type { AppBindings, LogLevel } from '../types';

interface RequestLog {
  readonly timestamp: string;
  readonly level: 'info' | 'warn' | 'error';
  readonly event: 'request.completed';
  readonly request_id: string;
  readonly tenant_id: number | null;
  readonly user_id: number | null;
  readonly branch_id: number | null;
  readonly method: string;
  readonly route: string;
  readonly status: number;
  readonly duration_ms: number;
}

const LOG_PRIORITY: Readonly<Record<LogLevel, number>> = {
  debug: 10,
  info: 20,
  warn: 30,
  error: 40,
};

function requiredLevel(status: number): Exclude<LogLevel, 'debug'> {
  if (status >= 500) return 'error';
  if (status >= 400) return 'warn';
  return 'info';
}

function emit(log: RequestLog, configuredLevel: LogLevel): void {
  if (LOG_PRIORITY[log.level] < LOG_PRIORITY[configuredLevel]) return;

  const serialized = JSON.stringify(log);
  if (log.level === 'error') {
    console.error(serialized);
  } else if (log.level === 'warn') {
    console.warn(serialized);
  } else {
    console.info(serialized);
  }
}

export const requestLogger = createMiddleware<AppBindings>(async (context, next) => {
  const startedAt = performance.now();

  await next();

  const status = context.res.status;
  const level = requiredLevel(status);
  emit(
    {
      timestamp: new Date().toISOString(),
      level,
      event: 'request.completed',
      request_id: context.get('requestId'),
      tenant_id: context.get('tenant')?.id ?? null,
      user_id: context.get('user')?.id ?? null,
      branch_id: context.get('branch')?.id ?? null,
      method: context.req.method,
      route: context.req.path,
      status,
      duration_ms: Number((performance.now() - startedAt).toFixed(2)),
    },
    context.env.LOG_LEVEL,
  );
});
