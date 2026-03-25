import formatDuration from '../../src/utils/formatDuration';

describe('formatDuration', () => {
  describe('edge cases', () => {
    test('returns "0 seconds" for 0 ms', () => {
      expect(formatDuration(0)).toBe('0 seconds');
    });

    test('returns "0 seconds" for null', () => {
      expect(formatDuration(null as any)).toBe('0 seconds');
    });

    test('returns "0 seconds" for undefined', () => {
      expect(formatDuration(undefined as any)).toBe('0 seconds');
    });

    test('returns "0 seconds" for negative value', () => {
      expect(formatDuration(-1000)).toBe('0 seconds');
    });

    test('returns "0 seconds" for non-number', () => {
      expect(formatDuration('1h' as any)).toBe('0 seconds');
    });
  });

  describe('seconds only', () => {
    test('1 second', () => {
      expect(formatDuration(1000)).toBe('1 second');
    });

    test('45 seconds', () => {
      expect(formatDuration(45_000)).toBe('45 seconds');
    });
  });

  describe('minutes (suppresses seconds when higher unit present)', () => {
    test('1 minute (60s)', () => {
      expect(formatDuration(60_000)).toBe('1 minute');
    });

    test('90 seconds shows only "1 minute" - seconds suppressed when other parts exist', () => {
      expect(formatDuration(90_000)).toBe('1 minute');
    });

    test('5 minutes', () => {
      expect(formatDuration(5 * 60_000)).toBe('5 minutes');
    });
  });

  describe('hours', () => {
    test('1 hour', () => {
      expect(formatDuration(3_600_000)).toBe('1 hour');
    });

    test('2 hours 30 minutes', () => {
      expect(formatDuration(2 * 3_600_000 + 30 * 60_000)).toBe('2 hours, 30 minutes');
    });
  });

  describe('days', () => {
    test('1 day', () => {
      expect(formatDuration(86_400_000)).toBe('1 day');
    });

    test('2 days 3 hours', () => {
      expect(formatDuration(2 * 86_400_000 + 3 * 3_600_000)).toBe('2 days, 3 hours');
    });
  });

  describe('weeks', () => {
    test('1 week', () => {
      expect(formatDuration(7 * 86_400_000)).toBe('1 week');
    });

    test('2 weeks', () => {
      expect(formatDuration(14 * 86_400_000)).toBe('2 weeks');
    });

    test('1 week 2 days', () => {
      expect(formatDuration(7 * 86_400_000 + 2 * 86_400_000)).toBe('1 week, 2 days');
    });

    test('1 week 1 day 2 hours 30 minutes', () => {
      const ms = 7 * 86_400_000 + 86_400_000 + 2 * 3_600_000 + 30 * 60_000;
      expect(formatDuration(ms)).toBe('1 week, 1 day, 2 hours, 30 minutes');
    });
  });

  describe('pluralization', () => {
    test('"1 second" is singular', () => {
      expect(formatDuration(1000)).toBe('1 second');
    });

    test('"2 seconds" is plural', () => {
      expect(formatDuration(2000)).toBe('2 seconds');
    });

    test('"1 minute" is singular', () => {
      expect(formatDuration(60_000)).toBe('1 minute');
    });

    test('"2 minutes" is plural', () => {
      expect(formatDuration(120_000)).toBe('2 minutes');
    });

    test('"1 hour" is singular', () => {
      expect(formatDuration(3_600_000)).toBe('1 hour');
    });

    test('"1 day" is singular', () => {
      expect(formatDuration(86_400_000)).toBe('1 day');
    });

    test('"1 week" is singular', () => {
      expect(formatDuration(604_800_000)).toBe('1 week');
    });
  });
});
