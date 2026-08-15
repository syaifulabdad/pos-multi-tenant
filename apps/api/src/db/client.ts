import { drizzle } from 'drizzle-orm/d1';

import type { WorkerBindings } from '../types';

export type Database = ReturnType<typeof createDatabase>;

export function createDatabase(binding: WorkerBindings['DB']) {
  return drizzle(binding, {
    casing: 'snake_case',
  });
}
