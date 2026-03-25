jest.mock('@fluxerjs/types', () => ({
  Routes: {
    channelMessage: (channelId: string, msgId: string) => `/channels/${channelId}/messages/${msgId}`,
  },
}));

describe('antiSpam - checkSpam (pure synchronous tracker)', () => {
  let antiSpam: any;

  beforeEach(() => {
    jest.resetModules();
    antiSpam = require('../../src/automod/modules/antiSpam').default;
  });

  test('does not flag below threshold', () => {
    const result = antiSpam.checkSpam('g1', 'u1', 'msg1', 5, 5000);
    expect(result.isSpam).toBe(false);
    expect(result.count).toBe(1);
    expect(result.messageIds).toBeNull();
  });

  test('flags spam when threshold is reached', () => {
    for (let i = 0; i < 4; i++) {
      antiSpam.checkSpam('g1', 'u1', `msg${i}`, 5, 5000);
    }
    const result = antiSpam.checkSpam('g1', 'u1', 'msg4', 5, 5000);
    expect(result.isSpam).toBe(true);
    expect(result.messageIds).toHaveLength(5);
    expect(result.messageIds).toContain('msg0');
    expect(result.messageIds).toContain('msg4');
  });

  test('resets tracker after spam is detected (prevents re-trigger)', () => {
    for (let i = 0; i < 5; i++) {
      antiSpam.checkSpam('g1', 'u1', `msg${i}`, 5, 5000);
    }
    const result = antiSpam.checkSpam('g1', 'u1', 'msg5', 5, 5000);
    expect(result.isSpam).toBe(false);
    expect(result.count).toBe(1);
  });

  test('tracks users independently', () => {
    for (let i = 0; i < 4; i++) {
      antiSpam.checkSpam('g1', 'u1', `a${i}`, 5, 5000);
      antiSpam.checkSpam('g1', 'u2', `b${i}`, 5, 5000);
    }
    const r1 = antiSpam.checkSpam('g1', 'u1', 'a4', 5, 5000);
    expect(r1.isSpam).toBe(true);

    const r2 = antiSpam.checkSpam('g1', 'u2', 'b4', 5, 5000);
    expect(r2.isSpam).toBe(true);
  });

  test('tracks guilds independently', () => {
    for (let i = 0; i < 4; i++) {
      antiSpam.checkSpam('g1', 'u1', `a${i}`, 5, 5000);
    }
    const result = antiSpam.checkSpam('g2', 'u1', 'b0', 5, 5000);
    expect(result.isSpam).toBe(false);
    expect(result.count).toBe(1);
  });

  test('expires old messages outside the time window', () => {
    const realNow = Date.now;
    let fakeTime = 1000000;
    Date.now = () => fakeTime;

    try {
      for (let i = 0; i < 3; i++) {
        antiSpam.checkSpam('g1', 'u1', `old${i}`, 5, 5000);
      }

      fakeTime += 6000;

      for (let i = 0; i < 4; i++) {
        antiSpam.checkSpam('g1', 'u1', `new${i}`, 5, 5000);
      }
      const result = antiSpam.checkSpam('g1', 'u1', 'new4', 5, 5000);
      expect(result.isSpam).toBe(true);
      expect(result.messageIds).toHaveLength(5);
      expect(result.messageIds).not.toContain('old0');
    } finally {
      Date.now = realNow;
    }
  });

  test('respects custom maxMessages threshold', () => {
    const r1 = antiSpam.checkSpam('g1', 'u1', 'a', 2, 5000);
    expect(r1.isSpam).toBe(false);
    const r2 = antiSpam.checkSpam('g1', 'u1', 'b', 2, 5000);
    expect(r2.isSpam).toBe(true);
    expect(r2.messageIds).toEqual(['a', 'b']);
  });
});

describe('antiSpam - resetSpamTracker', () => {
  let antiSpam: any;

  beforeEach(() => {
    jest.resetModules();
    antiSpam = require('../../src/automod/modules/antiSpam').default;
  });

  test('clears tracked messages for a user', () => {
    for (let i = 0; i < 4; i++) {
      antiSpam.checkSpam('g1', 'u1', `msg${i}`, 5, 5000);
    }
    antiSpam.resetSpamTracker('g1', 'u1');

    const result = antiSpam.checkSpam('g1', 'u1', 'msg_new', 5, 5000);
    expect(result.isSpam).toBe(false);
    expect(result.count).toBe(1);
  });

  test('does not affect other users', () => {
    for (let i = 0; i < 3; i++) {
      antiSpam.checkSpam('g1', 'u1', `a${i}`, 5, 5000);
      antiSpam.checkSpam('g1', 'u2', `b${i}`, 5, 5000);
    }
    antiSpam.resetSpamTracker('g1', 'u1');

    const result = antiSpam.checkSpam('g1', 'u2', 'b3', 5, 5000);
    expect(result.count).toBe(4);
  });
});

describe('antiSpam - trackViolation', () => {
  let antiSpam: any;

  beforeEach(() => {
    jest.resetModules();
    antiSpam = require('../../src/automod/modules/antiSpam').default;
  });

  test('increments violation count', () => {
    const config = { violationThreshold: 3, violationWindow: 1800000 };
    const r1 = antiSpam.trackViolation('g1', 'u1', config);
    expect(r1.count).toBe(1);
    expect(r1.shouldTimeout).toBe(false);

    const r2 = antiSpam.trackViolation('g1', 'u1', config);
    expect(r2.count).toBe(2);
    expect(r2.shouldTimeout).toBe(false);
  });

  test('triggers timeout at threshold', () => {
    const config = { violationThreshold: 3, violationWindow: 1800000 };
    antiSpam.trackViolation('g1', 'u1', config);
    antiSpam.trackViolation('g1', 'u1', config);
    const r3 = antiSpam.trackViolation('g1', 'u1', config);
    expect(r3.count).toBe(3);
    expect(r3.shouldTimeout).toBe(true);
  });

  test('expires old violations outside the window', () => {
    const realNow = Date.now;
    let fakeTime = 1000000;
    Date.now = () => fakeTime;

    try {
      const config = { violationThreshold: 3, violationWindow: 60000 };
      antiSpam.trackViolation('g1', 'u1', config);
      antiSpam.trackViolation('g1', 'u1', config);

      fakeTime += 70000;

      const result = antiSpam.trackViolation('g1', 'u1', config);
      expect(result.count).toBe(1);
      expect(result.shouldTimeout).toBe(false);
    } finally {
      Date.now = realNow;
    }
  });
});

describe('antiSpam - clearViolations', () => {
  let antiSpam: any;

  beforeEach(() => {
    jest.resetModules();
    antiSpam = require('../../src/automod/modules/antiSpam').default;
  });

  test('resets violation count to zero', () => {
    const config = { violationThreshold: 3, violationWindow: 1800000 };
    antiSpam.trackViolation('g1', 'u1', config);
    antiSpam.trackViolation('g1', 'u1', config);
    antiSpam.clearViolations('g1', 'u1');

    const result = antiSpam.trackViolation('g1', 'u1', config);
    expect(result.count).toBe(1);
  });
});

describe('antiSpam - defaultConfig', () => {
  let antiSpam: any;

  beforeAll(() => {
    jest.resetModules();
    antiSpam = require('../../src/automod/modules/antiSpam').default;
  });

  test('has expected default values', () => {
    expect(antiSpam.defaultConfig.maxMessages).toBe(5);
    expect(antiSpam.defaultConfig.timeWindow).toBe(5000);
    expect(antiSpam.defaultConfig.timeoutDuration).toBe(600000);
    expect(antiSpam.defaultConfig.violationThreshold).toBe(3);
    expect(antiSpam.defaultConfig.violationWindow).toBe(1800000);
  });
});
