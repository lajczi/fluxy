import type { Client, Message } from '@erinjs/core';

export interface Command {
  name: string;
  description: string | string[];
  usage?: string;
  category: string;
  aliases?: string[];
  permissions?: string[];
  cooldown?: number;
  ownerOnly?: boolean;
  allowDM?: boolean;
  hidden?: boolean;
  isAlias?: boolean;
  execute(message: Message, args: string[], client: Client, prefix?: string): Promise<void>;
}
