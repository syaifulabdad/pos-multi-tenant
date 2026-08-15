import type { ApiError, ApiMeta, ApiSuccess, FieldErrors } from '@pos/contracts';

export function successResponse<T>(
  requestId: string,
  data: T,
  message = 'OK',
  meta: Readonly<Record<string, unknown>> = {},
): ApiSuccess<T> {
  return {
    success: true,
    data,
    message,
    meta: {
      ...meta,
      request_id: requestId,
    } satisfies ApiMeta,
  };
}

export function errorResponse(
  requestId: string,
  message: string,
  errors: FieldErrors = {},
  code?: string,
): ApiError {
  return {
    success: false,
    message,
    errors,
    request_id: requestId,
    ...(code === undefined ? {} : { code }),
  };
}
