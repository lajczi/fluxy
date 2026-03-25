import parseUserId from '../../src/utils/parseUserId';

describe('parseUserId', () => {
  describe('raw snowflake IDs', () => {
    test('accepts a 17-digit ID', () => {
      expect(parseUserId('12345678901234567')).toBe('12345678901234567');
    });

    test('accepts an 18-digit ID', () => {
      expect(parseUserId('123456789012345678')).toBe('123456789012345678');
    });

    test('accepts a 19-digit ID', () => {
      expect(parseUserId('1234567890123456789')).toBe('1234567890123456789');
    });

    test('rejects a 16-digit ID (too short)', () => {
      expect(parseUserId('1234567890123456')).toBe(null);
    });

    test('rejects a 20-digit ID (too long)', () => {
      expect(parseUserId('12345678901234567890')).toBe(null);
    });
  });

  describe('mention formats', () => {
    test('parses <@userId> mention', () => {
      expect(parseUserId('<@123456789012345678>')).toBe('123456789012345678');
    });

    test('parses <@!userId> mention (with exclamation)', () => {
      expect(parseUserId('<@!123456789012345678>')).toBe('123456789012345678');
    });
  });

  describe('invalid inputs', () => {
    test('returns null for empty string', () => {
      expect(parseUserId('')).toBe(null);
    });

    test('returns null for whitespace-only string', () => {
      expect(parseUserId('   ')).toBe(null);
    });

    test('returns null for null', () => {
      expect(parseUserId(null as any)).toBe(null);
    });

    test('returns null for undefined', () => {
      expect(parseUserId(undefined as any)).toBe(null);
    });

    test('returns null for a username string', () => {
      expect(parseUserId('someuser#1234')).toBe(null);
    });

    test('returns null for partial mention without closing bracket', () => {
      expect(parseUserId('<@123456789012345678')).toBe(null);
    });

    test('returns null for non-numeric ID', () => {
      expect(parseUserId('abcdefghijklmnopqr')).toBe(null);
    });
  });

  describe('whitespace handling', () => {
    test('trims leading/trailing whitespace from raw ID', () => {
      expect(parseUserId('  123456789012345678  ')).toBe('123456789012345678');
    });

    test('trims leading/trailing whitespace from mention', () => {
      expect(parseUserId('  <@123456789012345678>  ')).toBe('123456789012345678');
    });
  });
});
