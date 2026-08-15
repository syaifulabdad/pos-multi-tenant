const PASSWORD_ALGORITHM = 'pbkdf2-sha256';
const PASSWORD_ITERATIONS = 600_000;
const PASSWORD_KEY_BYTES = 32;
const PASSWORD_SALT_BYTES = 16;
const SESSION_TOKEN_BYTES = 32;

export const DUMMY_PASSWORD_HASH =
  'pbkdf2-sha256$600000$ex-faH6DgPNJ85gNTtZNPQ$pU2rhc8mfSSK9Mr1B08mNm329-zFMf0ahqQmGqTbnaM';

function bytesToBase64Url(bytes: Uint8Array): string {
  let binary = '';
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replaceAll('+', '-').replaceAll('/', '_').replace(/=+$/, '');
}

function base64UrlToBytes(value: string): Uint8Array<ArrayBuffer> | null {
  if (!/^[A-Za-z0-9_-]+$/.test(value)) return null;

  try {
    const normalized = value.replaceAll('-', '+').replaceAll('_', '/');
    const padding = '='.repeat((4 - (normalized.length % 4)) % 4);
    const binary = atob(`${normalized}${padding}`);
    return Uint8Array.from(binary, (character) => character.charCodeAt(0));
  } catch {
    return null;
  }
}

async function derivePasswordKey(
  password: string,
  salt: Uint8Array<ArrayBuffer>,
  iterations: number,
): Promise<Uint8Array<ArrayBuffer>> {
  const material = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(password),
    'PBKDF2',
    false,
    ['deriveBits'],
  );
  const bits = await crypto.subtle.deriveBits(
    { name: 'PBKDF2', hash: 'SHA-256', salt, iterations },
    material,
    PASSWORD_KEY_BYTES * 8,
  );
  return new Uint8Array(bits);
}

function constantTimeEqual(left: Uint8Array<ArrayBuffer>, right: Uint8Array<ArrayBuffer>): boolean {
  let difference = left.length ^ right.length;
  const length = Math.max(left.length, right.length);

  for (let index = 0; index < length; index += 1) {
    difference |= (left[index] ?? 0) ^ (right[index] ?? 0);
  }

  return difference === 0;
}

export async function hashPassword(password: string): Promise<string> {
  const salt = crypto.getRandomValues(new Uint8Array(PASSWORD_SALT_BYTES));
  const key = await derivePasswordKey(password, salt, PASSWORD_ITERATIONS);
  return `${PASSWORD_ALGORITHM}$${PASSWORD_ITERATIONS}$${bytesToBase64Url(salt)}$${bytesToBase64Url(key)}`;
}

export async function verifyPassword(password: string, encodedHash: string): Promise<boolean> {
  const [algorithm, iterationsValue, saltValue, expectedValue, ...remainder] =
    encodedHash.split('$');
  if (
    algorithm !== PASSWORD_ALGORITHM ||
    remainder.length !== 0 ||
    iterationsValue === undefined ||
    saltValue === undefined ||
    expectedValue === undefined
  ) {
    return false;
  }

  const iterations = Number(iterationsValue);
  const salt = base64UrlToBytes(saltValue);
  const expected = base64UrlToBytes(expectedValue);
  if (
    !Number.isSafeInteger(iterations) ||
    iterations < 100_000 ||
    iterations > 1_000_000 ||
    salt?.length !== PASSWORD_SALT_BYTES ||
    expected?.length !== PASSWORD_KEY_BYTES
  ) {
    return false;
  }

  const actual = await derivePasswordKey(password, salt, iterations);
  return constantTimeEqual(actual, expected);
}

export function generateSessionToken(): string {
  return bytesToBase64Url(crypto.getRandomValues(new Uint8Array(SESSION_TOKEN_BYTES)));
}

export async function sha256(value: string): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(value));
  return bytesToBase64Url(new Uint8Array(digest));
}
