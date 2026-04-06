import type { Client } from '@erinjs/core';

export interface BotEvent {
  name: string;
  once?: boolean;
  execute(...args: [...any[], Client]): void | Promise<void>;
}
