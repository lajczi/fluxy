const TRANSIENT_STATUS_CODES = new Set([429, 502, 503, 504]);
const TRANSIENT_ERROR_CODES = new Set([
  'ECONNRESET', 'ECONNREFUSED', 'ETIMEDOUT', 'EPIPE', 'EAI_AGAIN',
  'SERVICE_UNAVAILABLE', 'GATEWAY_TIMEOUT',
]);

interface ErrorLike {
  statusCode?: number;
  status?: number;
  code?: string;
  message?: string;
  cause?: ErrorLike;
}

export default function isNetworkError(error: unknown): boolean {
  if (!error) return false;

  const err = error as ErrorLike;

  // Fluxer API HTTP status codes (503, 504, 502, 429)
  if (TRANSIENT_STATUS_CODES.has(err.statusCode || err.status || 0)) return true;

  // Fluxer API error codes (SERVICE_UNAVAILABLE, GATEWAY_TIMEOUT)
  if (err.code && TRANSIENT_ERROR_CODES.has(err.code)) return true;

  // Node-level socket/DNS errors
  const causeCode = err?.cause?.code || (err?.cause as ErrorLike)?.cause?.code;
  if (causeCode && TRANSIENT_ERROR_CODES.has(causeCode)) return true;

  // Generic message checks
  const msg = err.message || '';
  if (msg.includes('fetch failed') || msg.includes('ECONNRESET') ||
      msg.includes('Service unavailable') || msg.includes('Gateway timeout') ||
      msg.includes('operation was aborted') || msg.includes('AbortError') ||
      msg.includes('socket hang up')) return true;

  return false;
}

// durrrrr im going to shoot myself in the head if fluxer api keeps being shite and making my embeds fail to send, so im just gonna retry them if they fail 
// due to network errors. hopefully this will reduce the amount of lost logs during fluxer downtime, which is pretty often smh
