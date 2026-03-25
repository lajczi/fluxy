'use strict';

const mockSettings: any = {
  slowmodeAllowedRoles: [] as string[],
  save: jest.fn().mockResolvedValue(true),
};

jest.mock('../../src/models/GuildSettings', () => ({
  getOrCreate: jest.fn().mockResolvedValue(mockSettings),
}));

jest.mock('../../src/utils/settingsCache', () => ({
  invalidate: jest.fn(),
}));

jest.mock('../../src/utils/isNetworkError', () => jest.fn(() => false));

import GuildSettings from '../../src/models/GuildSettings';
import settingsCache from '../../src/utils/settingsCache';
import slowmodepermsCmd from '../../src/commands/admin/slowmodeperms';

const slowmodeperms = slowmodepermsCmd as any;
const GuildSettingsMock = GuildSettings as any;
const settingsCacheMock = settingsCache as any;

function makeMessage(guildOverrides: Record<string, any> = {}) {
  const guild = {
    id: '1234567890123456789',
    name: 'Test Server',
    roles: {
      get: jest.fn((id: string) => ({ id, name: `Role-${id}` })),
    },
    fetchRole: jest.fn((id: string) => Promise.resolve({ id, name: `Role-${id}` })),
    ...guildOverrides,
  };

  return {
    guild,
    reply: jest.fn().mockResolvedValue({}),
  };
}

describe('slowmodeperms command', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockSettings.slowmodeAllowedRoles = [];
    mockSettings.save.mockResolvedValue(true);
    GuildSettingsMock.getOrCreate.mockResolvedValue(mockSettings);
  });

  test('no args shows help', async () => {
    const msg = makeMessage();
    await slowmodeperms.execute(msg, [], null);

    expect(msg.reply).toHaveBeenCalledWith(expect.stringContaining('Slowmode Permissions'));
    expect(msg.reply).toHaveBeenCalledWith(expect.stringContaining('!slowmodeperms add'));
  });

  test('invalid subcommand shows help', async () => {
    const msg = makeMessage();
    await slowmodeperms.execute(msg, ['invalid'], null);

    expect(msg.reply).toHaveBeenCalledWith(expect.stringContaining('Slowmode Permissions'));
  });

  test('add subcommand adds a role by mention', async () => {
    const msg = makeMessage();
    await slowmodeperms.execute(msg, ['add', '<@&12345678901234567>'], null);

    expect(mockSettings.slowmodeAllowedRoles).toContain('12345678901234567');
    expect(mockSettings.save).toHaveBeenCalled();
    expect(settingsCacheMock.invalidate).toHaveBeenCalledWith('1234567890123456789');
    expect(msg.reply).toHaveBeenCalledWith(expect.stringContaining('Added'));
  });

  test('add subcommand adds a role by ID', async () => {
    const msg = makeMessage();
    await slowmodeperms.execute(msg, ['add', '12345678901234567'], null);

    expect(mockSettings.slowmodeAllowedRoles).toContain('12345678901234567');
    expect(mockSettings.save).toHaveBeenCalled();
  });

  test('add subcommand rejects duplicate role', async () => {
    mockSettings.slowmodeAllowedRoles = ['12345678901234567'];
    const msg = makeMessage();
    await slowmodeperms.execute(msg, ['add', '12345678901234567'], null);

    expect(msg.reply).toHaveBeenCalledWith(expect.stringContaining('already'));
    expect(mockSettings.save).not.toHaveBeenCalled();
  });

  test('add subcommand rejects invalid format', async () => {
    const msg = makeMessage();
    await slowmodeperms.execute(msg, ['add', 'not-a-role'], null);

    expect(msg.reply).toHaveBeenCalledWith(expect.stringContaining('Invalid role'));
  });

  test('add subcommand requires role argument', async () => {
    const msg = makeMessage();
    await slowmodeperms.execute(msg, ['add'], null);

    expect(msg.reply).toHaveBeenCalledWith(expect.stringContaining('Please specify a role'));
  });

  test('remove subcommand removes a role', async () => {
    mockSettings.slowmodeAllowedRoles = ['12345678901234567'];
    const msg = makeMessage();
    await slowmodeperms.execute(msg, ['remove', '12345678901234567'], null);

    expect(mockSettings.slowmodeAllowedRoles).not.toContain('12345678901234567');
    expect(mockSettings.save).toHaveBeenCalled();
    expect(msg.reply).toHaveBeenCalledWith(expect.stringContaining('Removed'));
  });

  test('remove subcommand rejects role not in list', async () => {
    const msg = makeMessage();
    await slowmodeperms.execute(msg, ['remove', '12345678901234567'], null);

    expect(msg.reply).toHaveBeenCalledWith(expect.stringContaining('not in the slowmode allowlist'));
  });

  test('list subcommand shows empty message when no roles set', async () => {
    const msg = makeMessage();
    await slowmodeperms.execute(msg, ['list'], null);

    expect(msg.reply).toHaveBeenCalledWith(expect.stringContaining('No slowmode role overrides'));
  });

  test('list subcommand shows roles when set', async () => {
    mockSettings.slowmodeAllowedRoles = ['12345678901234567', '98765432109876543'];
    const msg = makeMessage();
    await slowmodeperms.execute(msg, ['list'], null);

    expect(msg.reply).toHaveBeenCalledWith(expect.stringContaining('Slowmode Allowed Roles'));
    expect(msg.reply).toHaveBeenCalledWith(expect.stringContaining('12345678901234567'));
  });

  test('clear subcommand clears all roles', async () => {
    mockSettings.slowmodeAllowedRoles = ['12345678901234567'];
    const msg = makeMessage();
    await slowmodeperms.execute(msg, ['clear'], null);

    expect(mockSettings.slowmodeAllowedRoles).toEqual([]);
    expect(mockSettings.save).toHaveBeenCalled();
    expect(msg.reply).toHaveBeenCalledWith(expect.stringContaining('Cleared'));
  });

  test('clear subcommand reports when nothing to clear', async () => {
    const msg = makeMessage();
    await slowmodeperms.execute(msg, ['clear'], null);

    expect(msg.reply).toHaveBeenCalledWith(expect.stringContaining('No slowmode role overrides to clear'));
  });
});
