import { BadRequestError, ValidationError } from '../../lib/errors';

export interface LoginInput {
  readonly email: string;
  readonly password: string;
}

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function parseLoginInput(value: unknown): LoginInput {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    throw new BadRequestError('Request body must be a JSON object');
  }

  const body = value as Readonly<Record<string, unknown>>;
  const email = typeof body.email === 'string' ? body.email.trim().toLowerCase() : '';
  const password = typeof body.password === 'string' ? body.password : '';
  const errors: Record<string, string[]> = {};

  if (email.length === 0) errors.email = ['Email is required'];
  else if (email.length > 254 || !EMAIL_PATTERN.test(email)) errors.email = ['Email is invalid'];

  if (password.length === 0) errors.password = ['Password is required'];
  else if (password.length < 8 || password.length > 128) {
    errors.password = ['Password must contain between 8 and 128 characters'];
  }

  if (Object.keys(errors).length > 0) throw new ValidationError(errors);
  return { email, password };
}
