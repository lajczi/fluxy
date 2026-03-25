// dunno if this works future me: ye it does

import type { BotEvent } from '../types';
import { logServerEvent } from '../utils/logger';

function colorHex(color: number | null | undefined): string {
  if (!color) return 'None';
  return `#${color.toString(16).padStart(6, '0').toUpperCase()}`;
}

const event: BotEvent = {
  name: 'guildRoleUpdate',

  async execute(data: any, client: any) {
    try {
      const guild = client.guilds.get(data.guild_id);
      if (!guild) return;

      const role = data.role;
      if (!role) return;

      await logServerEvent(
        guild,
        'Role Updated',
        0xf1c40f,
        [
          { name: 'Role',  value: `<@&${role.id}>`, inline: true },
          { name: 'Name',  value: role.name, inline: true },
          { name: 'Color', value: colorHex(role.color), inline: true },
        ],
        client,
        { footer: `Role ID: ${role.id}`, eventType: 'role_update' }
      );
    } catch (error) {
      console.error('Error in guildRoleUpdate event:', error);
    }
  }
};

export default event;
