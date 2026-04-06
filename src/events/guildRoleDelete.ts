import type { BotEvent } from '../types';
import { logServerEvent } from '../utils/logger';

const event: BotEvent = {
  name: 'guildRoleDelete',

  async execute(data: any, client: any) {
    try {
      const guild = client.guilds.get(data.guild_id);
      if (!guild) return;

      const roleId = data.role_id;
      if (!roleId) return;

      await logServerEvent(
        guild,
        'Role Deleted',
        0xe74c3c,
        [{ name: 'Role', value: `<@&${roleId}>`, inline: true }],
        client,
        { footer: `Role ID: ${roleId}`, eventType: 'role_delete' },
      );
    } catch (error) {
      console.error('Error in guildRoleDelete event:', error);
    }
  },
};

export default event;
