import type { IncomingMessage } from 'http';
import { validateFluxerToken } from './auth';
import config from '../../config';

function parseCookies(cookieHeader: string | undefined): Record<string, string> {
  const result: Record<string, string> = {};
  if (!cookieHeader) return result;
  for (const part of cookieHeader.split(';')) {
    const [key, ...rest] = part.trim().split('=');
    if (key) result[key.trim()] = decodeURIComponent(rest.join('=').trim());
  }
  return result;
}

export async function verifyWsToken(
  req: IncomingMessage,
  requireOwner = false,
): Promise<string | null> {
  let token: string | null = null;

  const cookies = parseCookies(req.headers.cookie);
  if (cookies['fluxy_token']) {
    token = cookies['fluxy_token'];
  }

  if (!token) {
    const url = new URL(req.url || '', `http://${req.headers.host}`);
    token = url.searchParams.get('token');
  }

  if (!token) return null;

  if (config.api.adminToken && token === config.api.adminToken) {
    return config.ownerId || 'admin';
  }

  const userId = await validateFluxerToken(token);
  if (!userId) return null;

  if (requireOwner) {
    const isOwner = config.ownerId ? userId === config.ownerId : false;
    if (!isOwner) return null;
  }

  return userId;
}
