import isNetworkError from './isNetworkError';

const MAX_RETRIES = 2;
const RETRY_DELAYS = [1000, 3000]; // 1s, 3s

export async function retrySend(
  channel: any,
  opts: any,
  label = 'message',
): Promise<any> {
  let lastErr: any;
  for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
    try {
      return await channel.send(opts);
    } catch (err: any) {
      lastErr = err;
      if (attempt < MAX_RETRIES && isNetworkError(err)) {
        await new Promise(r => setTimeout(r, RETRY_DELAYS[attempt] || 2000));
        continue;
      }
      break;
    }
  }
  throw new Error(`Retry ${MAX_RETRIES} failed: ${lastErr?.message || lastErr}`);
}
