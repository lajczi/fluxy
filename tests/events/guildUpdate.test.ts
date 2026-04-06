const guildUpdate = require('../../src/events/guildUpdate').default;

describe('guildUpdate event', () => {
  test('preserves cached guild collections when the SDK replaces the guild object', async () => {
    const oldGuild = {
      id: 'g1',
      channels: new Map([['c1', { id: 'c1', name: 'rules' }]]),
      roles: new Map([['r1', { id: 'r1', name: 'Mod' }]]),
      members: new Map([['u1', { id: 'u1' }]]),
      emojis: new Map([['e1', { id: 'e1', name: 'wave' }]]),
      stickers: new Map([['s1', { id: 's1', name: 'hello' }]]),
    };

    const newGuild = {
      id: 'g1',
      channels: new Map(),
      roles: new Map(),
      members: new Map(),
      emojis: new Map(),
      stickers: new Map(),
    };

    await guildUpdate.execute(oldGuild, newGuild, { channels: new Map() });

    expect(Array.from(newGuild.channels.keys())).toEqual(['c1']);
    expect(Array.from(newGuild.roles.keys())).toEqual(['r1']);
    expect(Array.from(newGuild.members.keys())).toEqual(['u1']);
    expect(Array.from(newGuild.emojis.keys())).toEqual(['e1']);
    expect(Array.from(newGuild.stickers.keys())).toEqual(['s1']);
  });

  test('rehydrates channels from the global client cache when the previous guild cache is already empty', async () => {
    const newGuild = {
      id: 'g1',
      channels: new Map(),
      roles: new Map(),
      members: new Map(),
      emojis: new Map(),
      stickers: new Map(),
    };

    await guildUpdate.execute(
      { id: 'g1', channels: new Map(), roles: new Map(), members: new Map(), emojis: new Map(), stickers: new Map() },
      newGuild,
      {
        channels: new Map([
          ['c1', { id: 'c1', guildId: 'g1', name: 'rules' }],
          ['c2', { id: 'c2', guildId: 'g2', name: 'other' }],
        ]),
      },
    );

    expect(Array.from(newGuild.channels.keys())).toEqual(['c1']);
  });
});
