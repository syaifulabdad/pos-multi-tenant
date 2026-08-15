import type { ApiResponse } from '@pos/contracts';

export class ApiClientError extends Error {
  readonly status: number;
  readonly requestId?: string;

  constructor(message: string, status: number, requestId?: string) {
    super(message);
    this.name = 'ApiClientError';
    this.status = status;
    if (requestId !== undefined) this.requestId = requestId;
  }
}

async function requestJson<T>(path: string, init: RequestInit): Promise<T> {
  const response = await fetch(path, {
    ...init,
    credentials: 'same-origin',
    headers: {
      Accept: 'application/json',
      ...init.headers,
    },
  });

  let payload: ApiResponse<T>;
  try {
    payload = (await response.json()) as ApiResponse<T>;
  } catch {
    throw new ApiClientError('Respons server tidak dapat dibaca.', response.status);
  }

  if (!response.ok || !payload.success) {
    const message = payload.success ? 'Permintaan gagal diproses.' : payload.message;
    const requestId = payload.success ? undefined : payload.request_id;
    throw new ApiClientError(message, response.status, requestId);
  }

  return payload.data;
}

export function getJson<T>(path: string, signal?: AbortSignal): Promise<T> {
  return requestJson(path, {
    method: 'GET',
    ...(signal === undefined ? {} : { signal }),
  });
}

export function deleteJson<T>(path: string): Promise<T> {
  return requestJson(path, { method: 'DELETE' });
}

export function postJson<T>(path: string, body?: unknown): Promise<T> {
  return requestJson(path, {
    method: 'POST',
    ...(body === undefined
      ? {}
      : {
          body: JSON.stringify(body),
          headers: { 'Content-Type': 'application/json' },
        }),
  });
}
