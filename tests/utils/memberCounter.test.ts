describe('memberCounter - get', () => {
  let memberCounter: typeof import('../../src/utils/memberCounter');

  beforeAll(() => {
    jest.resetModules();
    memberCounter = require('../../src/utils/memberCounter');
  });

  test('returns null for unknown guild', () => {
    expect(memberCounter.get('unknown_guild')).toBeNull();
  });
});

describe('memberCounter - set and get', () => {
  let memberCounter: typeof import('../../src/utils/memberCounter');

  beforeAll(() => {
    jest.resetModules();
    memberCounter = require('../../src/utils/memberCounter');
  });

  test('set stores count for a guild', () => {
    memberCounter.set('g1', 100);
    expect(memberCounter.get('g1')).toBe(100);
  });

  test('set overwrites existing count', () => {
    memberCounter.set('g2', 50);
    memberCounter.set('g2', 75);
    expect(memberCounter.get('g2')).toBe(75);
  });

  test('set with 0 is allowed', () => {
    memberCounter.set('g3', 0);
    expect(memberCounter.get('g3')).toBe(0);
  });
});

describe('memberCounter - increment', () => {
  let memberCounter: typeof import('../../src/utils/memberCounter');

  beforeAll(() => {
    jest.resetModules();
    memberCounter = require('../../src/utils/memberCounter');
  });

  test('increment on unknown guild starts at 1', () => {
    const result = memberCounter.increment('g_new');
    expect(result).toBe(1);
    expect(memberCounter.get('g_new')).toBe(1);
  });

  test('increment adds to existing count and returns the new value', () => {
    memberCounter.set('g_inc', 10);
    const result = memberCounter.increment('g_inc');
    expect(result).toBe(11);
    expect(memberCounter.get('g_inc')).toBe(11);
  });

  test('multiple increments accumulate correctly', () => {
    memberCounter.set('g_multi', 5);
    memberCounter.increment('g_multi');
    memberCounter.increment('g_multi');
    const result = memberCounter.increment('g_multi');
    expect(result).toBe(8);
  });
});

describe('memberCounter - decrement', () => {
  let memberCounter: typeof import('../../src/utils/memberCounter');

  beforeAll(() => {
    jest.resetModules();
    memberCounter = require('../../src/utils/memberCounter');
  });

  test('decrement subtracts from existing count and returns the new value', () => {
    memberCounter.set('g_dec', 10);
    const result = memberCounter.decrement('g_dec');
    expect(result).toBe(9);
    expect(memberCounter.get('g_dec')).toBe(9);
  });

  test('decrement on unknown guild returns 0 (defaults to 1 - 1 = 0)', () => {
    const result = memberCounter.decrement('g_unknown_dec');
    expect(result).toBe(0);
  });

  test('decrement does not go below 0 (floor at 0)', () => {
    memberCounter.set('g_floor', 0);
    const result = memberCounter.decrement('g_floor');
    expect(result).toBe(0);
    expect(memberCounter.get('g_floor')).toBe(0);
  });

  test('decrement from 1 reaches 0 without going negative', () => {
    memberCounter.set('g_one', 1);
    const result = memberCounter.decrement('g_one');
    expect(result).toBe(0);
  });

  test('increment then decrement returns to original count', () => {
    memberCounter.set('g_roundtrip', 20);
    memberCounter.increment('g_roundtrip');
    const result = memberCounter.decrement('g_roundtrip');
    expect(result).toBe(20);
  });
});
