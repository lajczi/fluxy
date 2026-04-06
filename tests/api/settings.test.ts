import mongoose from 'mongoose';
import GuildSettings from '../../src/models/GuildSettings';

function makeAutomodPayload(timeoutDuration: number) {
  return {
    guildId: `test-guild-${Date.now()}`,
    automod: {
      level: 'off',
      antiSpam: false,
      antiLink: false,
      antiReactionSpam: false,
      ghostPing: false,
      maxMentions: 5,
      maxLines: 10,
      spam: {
        maxMessages: 5,
        timeWindow: 5,
        timeoutDuration,
        violationThreshold: 3,
      },
      allowedDomains: [],
      exemptRoles: [],
      exemptChannels: [],
    },
  };
}

describe('GuildSettings schema - automod.spam.timeoutDuration', () => {
  test('accepts timeoutDuration = 60 (old max, still valid)', () => {
    const doc = new GuildSettings(makeAutomodPayload(60));
    const err = doc.validateSync();
    expect(err).toBeUndefined();
  });

  test('accepts timeoutDuration = 61 (was invalid before fix)', () => {
    const doc = new GuildSettings(makeAutomodPayload(61));
    const err = doc.validateSync();
    expect(err).toBeUndefined();
  });

  test('accepts timeoutDuration = 600 (10 hours - typical use case)', () => {
    const doc = new GuildSettings(makeAutomodPayload(600));
    const err = doc.validateSync();
    expect(err).toBeUndefined();
  });

  test('accepts timeoutDuration = 1440 (24 hours - new max boundary)', () => {
    const doc = new GuildSettings(makeAutomodPayload(1440));
    const err = doc.validateSync();
    expect(err).toBeUndefined();
  });

  test('rejects timeoutDuration = 1441 (above new max)', () => {
    const doc = new GuildSettings(makeAutomodPayload(1441));
    const err = doc.validateSync();
    expect(err).toBeDefined();
    expect(err?.errors['automod.spam.timeoutDuration']).toBeDefined();
  });

  test('rejects timeoutDuration = 0 (below min: 1)', () => {
    const doc = new GuildSettings(makeAutomodPayload(0));
    const err = doc.validateSync();
    expect(err).toBeDefined();
    expect(err?.errors['automod.spam.timeoutDuration']).toBeDefined();
  });

  test('rejects timeoutDuration = -5 (negative)', () => {
    const doc = new GuildSettings(makeAutomodPayload(-5));
    const err = doc.validateSync();
    expect(err).toBeDefined();
    expect(err?.errors['automod.spam.timeoutDuration']).toBeDefined();
  });
});

describe('GuildSettings schema - automod.spam other constraints (unchanged)', () => {
  test('rejects maxMessages above 20', () => {
    const doc = new GuildSettings({
      guildId: `test-guild-${Date.now()}`,
      automod: { spam: { maxMessages: 21, timeWindow: 5, timeoutDuration: 10, violationThreshold: 3 } },
    });
    const err = doc.validateSync();
    expect(err?.errors['automod.spam.maxMessages']).toBeDefined();
  });

  test('rejects violationThreshold above 10', () => {
    const doc = new GuildSettings({
      guildId: `test-guild-${Date.now()}`,
      automod: { spam: { maxMessages: 5, timeWindow: 5, timeoutDuration: 10, violationThreshold: 11 } },
    });
    const err = doc.validateSync();
    expect(err?.errors['automod.spam.violationThreshold']).toBeDefined();
  });
});

afterAll(async () => {
  await mongoose.disconnect();
});
