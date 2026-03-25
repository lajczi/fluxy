import type { BotEvent } from '../types';
import { logServerEvent } from '../utils/logger';
import * as memberCounter from '../utils/memberCounter';
import settingsCache from '../utils/settingsCache';
import sendGoodbye from '../utils/sendGoodbye';

const event: BotEvent = {
  name: 'guildMemberRemove',

  async execute(member: any, client: any) {
    try {
      const guild = member.guild;
      if (!guild) return;

      const userId = member.id || member.user?.id;
      if (!userId) return;

      const memberCount = memberCounter.decrement(guild.id);

      const leaveFields: any[] = [];
      if (memberCount) {
        leaveFields.push({ name: 'Members', value: memberCount.toLocaleString(), inline: true });
      }

      await logServerEvent(
        guild,
        'Member Left',
        0xe67e22,
        leaveFields,
        client,
        {
          description: `<@${userId}> left the server`,
          footer: `User ID: ${userId}`,
          eventType: 'member_leave',
        }
      );

      try {
        const settings = await settingsCache.get(guild.id);
        if (settings) {
          await sendGoodbye(member, guild, settings, client);
        }
      } catch (err: any) {
        console.error(`[goodbye] Error sending goodbye in ${guild.name}: ${err.message}`);
      }
    } catch (error) {
      console.error('Error in guildMemberRemove event:', error);
    }
  }
};

export default event;
