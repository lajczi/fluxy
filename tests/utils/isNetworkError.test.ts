import isNetworkError from '../../src/utils/isNetworkError';

describe('isNetworkError', () => {
  test('returns true when error.cause.code is ECONNRESET', () => {
    const error = { cause: { code: 'ECONNRESET' } };
    expect(isNetworkError(error)).toBe(true);
  });

  test('returns true when error.cause.cause.code is ECONNRESET', () => {
    const error = { cause: { cause: { code: 'ECONNRESET' } } };
    expect(isNetworkError(error)).toBe(true);
  });

  test('returns true when message includes "fetch failed"', () => {
    const error = { message: 'fetch failed: network unreachable' };
    expect(isNetworkError(error)).toBe(true);
  });

  test('returns true when message includes "ECONNRESET"', () => {
    const error = { message: 'socket hang up ECONNRESET' };
    expect(isNetworkError(error)).toBe(true);
  });

  test('returns false for a generic error', () => {
    const error = new Error('Something went wrong');
    expect(isNetworkError(error)).toBe(false);
  });

  test('returns false for a permission error (code 50013)', () => {
    const error = { code: 50013, message: 'Missing Permissions' };
    expect(isNetworkError(error)).toBe(false);
  });

  test('returns falsy for null', () => {
    expect(isNetworkError(null)).toBeFalsy();
  });

  test('returns falsy for undefined', () => {
    expect(isNetworkError(undefined)).toBeFalsy();
  });

  test('returns falsy for empty object', () => {
    expect(isNetworkError({})).toBeFalsy();
  });
});
