import type { Context } from 'hono';
import { deleteCookie, getCookie, setCookie } from 'hono/cookie';

import type { AppBindings } from '../../types';
import { SESSION_TTL_SECONDS } from './service';
import type { ClientMetadata } from './domain';

const DEVELOPMENT_COOKIE = 'pos_session';
const PRODUCTION_COOKIE = '__Host-pos_session';

export function sessionCookieName(context: Context<AppBindings>): string {
  return context.env.APP_ENV === 'production' ? PRODUCTION_COOKIE : DEVELOPMENT_COOKIE;
}

export function readSessionCookie(context: Context<AppBindings>): string | undefined {
  return getCookie(context, sessionCookieName(context));
}

export function writeSessionCookie(context: Context<AppBindings>, token: string): void {
  setCookie(context, sessionCookieName(context), token, {
    httpOnly: true,
    maxAge: SESSION_TTL_SECONDS,
    path: '/',
    sameSite: 'Lax',
    secure: context.env.APP_ENV === 'production',
  });
}

export function clearSessionCookie(context: Context<AppBindings>): void {
  deleteCookie(context, sessionCookieName(context), {
    path: '/',
    secure: context.env.APP_ENV === 'production',
  });
}

export function clientMetadata(context: Context<AppBindings>): ClientMetadata {
  const ipHeader = context.req.header('CF-Connecting-IP');
  const userAgentHeader = context.req.header('User-Agent');
  return {
    ipAddress: ipHeader === undefined ? null : ipHeader.slice(0, 64),
    userAgent: userAgentHeader === undefined ? null : userAgentHeader.slice(0, 512),
  };
}
