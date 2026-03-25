import type { Client } from '@fluxerjs/core';

export interface BotEvent {
  name: string;
  once?: boolean;
  execute(...args: [...any[], Client]): void | Promise<void>;
}
