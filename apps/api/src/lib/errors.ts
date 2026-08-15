import type { FieldErrors } from '@pos/contracts';
import type { ContentfulStatusCode } from 'hono/utils/http-status';

interface AppErrorOptions {
  readonly status: ContentfulStatusCode;
  readonly code: string;
  readonly message: string;
  readonly errors?: FieldErrors;
  readonly cause?: unknown;
}

export class AppError extends Error {
  readonly status: ContentfulStatusCode;
  readonly code: string;
  readonly errors: FieldErrors;

  constructor(options: AppErrorOptions) {
    super(options.message, { cause: options.cause });
    this.name = 'AppError';
    this.status = options.status;
    this.code = options.code;
    this.errors = options.errors ?? {};
  }
}

export class ValidationError extends AppError {
  constructor(errors: FieldErrors) {
    super({
      status: 422,
      code: 'VALIDATION_FAILED',
      message: 'Validation failed',
      errors,
    });
    this.name = 'ValidationError';
  }
}

export class BadRequestError extends AppError {
  constructor(message = 'Invalid request') {
    super({ status: 400, code: 'BAD_REQUEST', message });
    this.name = 'BadRequestError';
  }
}

export class UnauthorizedError extends AppError {
  constructor(message = 'Authentication required') {
    super({ status: 401, code: 'UNAUTHORIZED', message });
    this.name = 'UnauthorizedError';
  }
}

export class DependencyUnavailableError extends AppError {
  constructor(cause?: unknown) {
    super({
      status: 503,
      code: 'DEPENDENCY_UNAVAILABLE',
      message: 'Service temporarily unavailable',
      cause,
    });
    this.name = 'DependencyUnavailableError';
  }
}
