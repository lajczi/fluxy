import type { Command } from '../../types';
import isNetworkError from '../../utils/isNetworkError';

const startTime = Date.now();

const command: Command = {
  name: 'uptime',
  description: 'Show how long the bot has been running since its last restart',
  usage: '',
  category: 'info',
  cooldown: 5,

  async execute(message, _args, _client) {
    try {
      const uptime = Date.now() - startTime;

      const days = Math.floor(uptime / (24 * 60 * 60 * 1000));
      const hours = Math.floor((uptime % (24 * 60 * 60 * 1000)) / (60 * 60 * 1000));
      const minutes = Math.floor((uptime % (60 * 60 * 1000)) / (60 * 1000));
      const seconds = Math.floor((uptime % (60 * 1000)) / 1000);

      const uptimeParts: string[] = [];
      if (days > 0) uptimeParts.push(`${days} day${days !== 1 ? 's' : ''}`);
      if (hours > 0) uptimeParts.push(`${hours} hour${hours !== 1 ? 's' : ''}`);
      if (minutes > 0) uptimeParts.push(`${minutes} minute${minutes !== 1 ? 's' : ''}`);
      if (seconds > 0 || uptimeParts.length === 0) uptimeParts.push(`${seconds} second${seconds !== 1 ? 's' : ''}`);

      const uptimeString = uptimeParts.join(', ');

      const startDate = new Date(startTime);
      const startString = startDate.toLocaleString('en-US', {
        year: 'numeric',
        month: 'long',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
        timeZoneName: 'short'
      });

      await message.reply(`**Uptime:** ${uptimeString}\n**Started:** ${startString}`);

    } catch (error: any) {
      if (isNetworkError(error)) {
        console.warn(`Fluxer API unreachable during !uptime (ECONNRESET)`);
      } else {
        console.error(`Error in !uptime: ${error.message || error}`);
      }
    }
  }
};

export default command;
