import type { BotEvent } from '../types';

function restoreCollectionIfEmpty(target: any, source: Iterable<[string, any]> | null | undefined): void {
  if (!target || typeof target.set !== 'function' || typeof target.size !== 'number' || target.size > 0 || !source) {
    return;
  }

  for (const [id, value] of source) {
    target.set(id, value);
  }
}

function getClientGuildChannels(client: any, guildId: string): Array<[string, any]> {
  const entries: Array<[string, any]> = [];
  for (const channel of client?.channels?.values?.() || []) {
    const channelGuildId = channel?.guildId ?? channel?.guild_id ?? channel?.guild?.id ?? null;
    if (channelGuildId === guildId && channel?.id) {
      entries.push([channel.id, channel]);
    }
  }
  return entries;
}

const event: BotEvent = {
  name: 'guildUpdate',

  async execute(oldGuild: any, newGuild: any, client: any) {
    try {
      if (!newGuild?.id) return;

      const preservedChannels =
        oldGuild?.channels?.size > 0 ? oldGuild.channels.entries() : getClientGuildChannels(client, newGuild.id);

      restoreCollectionIfEmpty(newGuild.channels, preservedChannels);
      restoreCollectionIfEmpty(newGuild.roles, oldGuild?.roles?.entries?.());
      restoreCollectionIfEmpty(newGuild.members, oldGuild?.members?.entries?.());
      restoreCollectionIfEmpty(newGuild.emojis, oldGuild?.emojis?.entries?.());
      restoreCollectionIfEmpty(newGuild.stickers, oldGuild?.stickers?.entries?.());
    } catch (error) {
      console.error('Error in guildUpdate event:', error);
    }
  },
};

export default event;
