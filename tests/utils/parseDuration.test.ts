import parseDuration from '../../src/utils/parseDuration';

describe('parseDuration', () => {
  describe('seconds (s)', () => {
    test('parses 1s as 1000 ms', () => {
      expect(parseDuration('1s')).toBe(1000);
    });

    test('parses 30s as 30000 ms', () => {
      expect(parseDuration('30s')).toBe(30000);
    });
  });

  describe('minutes (m)', () => {
    test('parses 1m as 60000 ms', () => {
      expect(parseDuration('1m')).toBe(60_000);
    });

    test('parses 60m as 3600000 ms', () => {
      expect(parseDuration('60m')).toBe(3_600_000);
    });
  });

  describe('hours (h)', () => {
    test('parses 1h as 3600000 ms', () => {
      expect(parseDuration('1h')).toBe(3_600_000);
    });

    test('parses 24h as 86400000 ms', () => {
      expect(parseDuration('24h')).toBe(86_400_000);
    });
  });

  describe('days (d)', () => {
    test('parses 1d as 86400000 ms', () => {
      expect(parseDuration('1d')).toBe(86_400_000);
    });

    test('parses 7d as 604800000 ms', () => {
      expect(parseDuration('7d')).toBe(604_800_000);
    });
  });

  describe('weeks (w)', () => {
    test('parses 1w as 604800000 ms', () => {
      expect(parseDuration('1w')).toBe(604_800_000);
    });

    test('parses 2w as 1209600000 ms', () => {
      expect(parseDuration('2w')).toBe(1_209_600_000);
    });
  });

  describe('invalid inputs', () => {
    test('returns null for null', () => {
      expect(parseDuration(null as any)).toBe(null);
    });

    test('returns null for undefined', () => {
      expect(parseDuration(undefined as any)).toBe(null);
    });

    test('returns null for empty string', () => {
      expect(parseDuration('')).toBe(null);
    });

    test('returns null for plain number string', () => {
      expect(parseDuration('60')).toBe(null);
    });

    test('returns null for uppercase unit "1H"', () => {
      expect(parseDuration('1H')).toBe(null);
    });

    test('returns null for uppercase unit "1S"', () => {
      expect(parseDuration('1S')).toBe(null);
    });

    test('returns null for unsupported unit "y"', () => {
      expect(parseDuration('1y')).toBe(null);
    });

    test('returns null for fractional amount', () => {
      expect(parseDuration('1.5h')).toBe(null);
    });

    test('returns null for non-string input', () => {
      expect(parseDuration(60 as any)).toBe(null);
    });

    test('returns null for "0s"', () => {
      expect(parseDuration('0s')).toBe(0);
    });
  });
});
