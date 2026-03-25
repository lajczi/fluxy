// amax file size 2mb to save on storage because i only gave the ct 4gb :rofl:
// present me: no longer an issue lets go!!!!!

import { createHash } from 'crypto';
import { join } from 'path';
import { existsSync, mkdirSync, writeFileSync, unlinkSync } from 'fs';

const CACHE_DIR = join(__dirname, '..', '..', 'data', 'bg-cache');
const MAX_SIZE  = 2 * 1024 * 1024;

function urlToFilename(url: string): string {
  const hash = createHash('sha256').update(url).digest('hex').slice(0, 16);
  const ext = url.match(/\.(png|jpe?g|webp|gif)/i)?.[1]?.toLowerCase() || 'png';
  return `${hash}.${ext === 'jpeg' ? 'jpg' : ext}`;
}

export function getCachedPath(url: string | null): string | null {
  if (!url) return null;
  const filePath = join(CACHE_DIR, urlToFilename(url));
  return existsSync(filePath) ? filePath : null;
}

export async function download(url: string): Promise<string> {
  mkdirSync(CACHE_DIR, { recursive: true });
  const filePath = join(CACHE_DIR, urlToFilename(url));

  if (existsSync(filePath)) return filePath;

  const res = await fetch(url, { redirect: 'follow' });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);

  const contentType = res.headers.get('content-type') || '';
  if (!contentType.startsWith('image/')) throw new Error('URL is not an image');

  const buf = Buffer.from(await res.arrayBuffer());
  if (buf.length > MAX_SIZE) {
    throw new Error(`Image too large (${(buf.length / 1024 / 1024).toFixed(1)} MB, max 2 MB)`);
  }

  writeFileSync(filePath, buf);
  return filePath;
}

export function remove(url: string | null): void {
  if (!url) return;
  const filePath = join(CACHE_DIR, urlToFilename(url));
  if (existsSync(filePath)) unlinkSync(filePath);
}
