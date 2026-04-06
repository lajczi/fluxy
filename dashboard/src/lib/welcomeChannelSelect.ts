import type { GuildDetail } from './api';

export interface WelcomeChannelOption {
  id: string;
  label: string;
  isCategory: boolean;
}

export interface WelcomeChannelSelectData {
  options: WelcomeChannelOption[];
  selectableIds: string[];
}

type GuildChannel = GuildDetail['channels'][number] & { parentId?: string | null };

function parentIdOf(channel: GuildChannel): string | null {
  return channel.parent_id ?? channel.parentId ?? null;
}

function isWelcomeSelectableChannel(channel: GuildChannel): boolean {
  return channel.type !== 4 && channel.type !== 2;
}

export function buildWelcomeChannelSelectData(channels: GuildDetail['channels']): WelcomeChannelSelectData {
  const categories = channels
    .filter(channel => channel.type === 4)
    .sort((a, b) => a.position - b.position);

  const selectableChannels = channels
    .filter(isWelcomeSelectableChannel)
    .sort((a, b) => a.position - b.position);

  const uncategorized = selectableChannels.filter(channel => !parentIdOf(channel));

  const options: WelcomeChannelOption[] = [];
  const includedIds = new Set<string>();

  for (const channel of uncategorized) {
    options.push({ id: channel.id, label: `# ${channel.name}`, isCategory: false });
    includedIds.add(channel.id);
  }

  for (const category of categories) {
    options.push({ id: category.id, label: category.name.toUpperCase(), isCategory: true });

    const children = selectableChannels.filter(channel => parentIdOf(channel) === category.id);
    for (const channel of children) {
      if (includedIds.has(channel.id)) continue;
      options.push({ id: channel.id, label: `  # ${channel.name}`, isCategory: false });
      includedIds.add(channel.id);
    }
  }

  return {
    options,
    selectableIds: Array.from(includedIds),
  };
}
