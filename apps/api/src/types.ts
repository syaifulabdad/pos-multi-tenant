import type { BranchAccess } from './modules/access/domain';
import type { AuthenticatedSession, AuthenticatedUser } from './modules/auth/domain';
import type { TenantContext } from './modules/tenants/domain';

export type AppEnvironment = 'development' | 'staging' | 'production' | 'test';
export type LogLevel = 'debug' | 'info' | 'warn' | 'error';

export interface WorkerBindings {
  DB: D1Database;
  STORAGE: R2Bucket;
  CACHE: KVNamespace;
  ASSETS: Fetcher;
  APP_ENV: AppEnvironment;
  BASE_DOMAIN: string;
  LOG_LEVEL: LogLevel;
}

export interface RequestVariables {
  requestId: string;
  tenant: TenantContext | null;
  user: AuthenticatedUser | null;
  session: AuthenticatedSession | null;
  permissions: readonly string[];
  branches: readonly BranchAccess[];
  branch: BranchAccess | null;
}

export interface AppBindings {
  Bindings: WorkerBindings;
  Variables: RequestVariables;
}
