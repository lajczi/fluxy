import type { Command } from '../../types';
import { EmbedBuilder } from '@fluxerjs/core';
import { Routes } from '@fluxerjs/types';

const CHECK_DELAY_MS = 80;
const BAR_LENGTH = 12;
const FILLED = '▓';
const EMPTY = '░';

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function parseUserId(arg: string): string | null {
  const idMatch = arg.match(/^\d{17,20}$/);
  if (idMatch) return idMatch[0];
  const mentionMatch = arg.match(/<@!?(\d{17,20})>/);
  return mentionMatch ? mentionMatch[1] : null;
}

function progressBar(pct: number): string {
  const filled = Math.round((pct / 100) * BAR_LENGTH);
  return FILLED.repeat(Math.min(filled, BAR_LENGTH)) + EMPTY.repeat(BAR_LENGTH - filled);
}

const command: Command = {
  name: 'whois',
  description: 'Check shared servers with a user ID (owner only)',
  usage: '<user-id>',
  category: 'owner',
  ownerOnly: true,
  hidden: true,

  async execute(message, args, client, prefix = '!') {
    const userId = args[0] ? parseUserId(args[0]) : null;
    if (!userId) {
      return void await message.reply(`Usage: \`${prefix}whois <user-id>\``);
    }

    const progressMsg = await message.reply(
      `Checking shared servers for <@${userId}>...\n\`${progressBar(0)}\` 0%\nFetching guild list...`
    );

    const updateProgress = async (
      done: number,
      total: number,
      phase: string,
      sharedCount: number,
      force = false,
    ) => {
      const pct = total > 0 ? Math.min(100, Math.round((done / total) * 100)) : 0;
      const content = [
        `Checking shared servers for <@${userId}>...`,
        `\`${progressBar(total > 0 ? pct : 0)}\` ${total > 0 ? `${pct}%` : '0%'}`,
        phase,
        `Shared servers so far: ${sharedCount.toLocaleString()}`,
      ].join('\n');
      if (!force && done % 8 !== 0 && done < total) return;
      await progressMsg.edit({ content }).catch(() => {});
    };

    let guildIds: string[] = [];
    try {
      let after: string | undefined;
      while (true) {
        const route = `${Routes.currentUserGuilds()}?limit=200${after ? `&after=${after}` : ''}`;
        const response = await client.rest.get(route) as any;
        const page = Array.isArray(response) ? response : (response?.guilds ?? []);
        guildIds.push(...page.map((g: any) => String(g?.id)).filter(Boolean));
        if (page.length < 200) break;
        after = page[page.length - 1]?.id;
        if (!after) break;
        await delay(120);
      }
    } catch {
      guildIds = client.guilds ? [...client.guilds.keys()] : [];
    }

    const totalGuilds = guildIds.length;
    const sharedGuilds: Array<{ id: string; name: string }> = [];

    await updateProgress(0, totalGuilds, `Scanning ${totalGuilds} guilds...`, 0, true);

    for (let i = 0; i < guildIds.length; i++) {
      const guildId = guildIds[i];
      try {
        let guild: any = client.guilds?.get?.(guildId);
        if (!guild) guild = await client.guilds.fetch(guildId);
        if (!guild) continue;

        const member = await guild.fetchMember(userId).catch(() => null);
        if (member) {
          sharedGuilds.push({
            id: guildId,
            name: guild.name || `Guild ${guildId}`,
          });
        }
      } catch {
      }

      if (i > 0) await delay(CHECK_DELAY_MS);
      await updateProgress(i + 1, totalGuilds, `Scanning guilds... (${i + 1}/${totalGuilds})`, sharedGuilds.length);
    }

    const count = sharedGuilds.length;
    const preview = sharedGuilds
      .slice(0, 20)
      .map((g, idx) => `${idx + 1}. ${g.name}`)
      .join('\n') || 'None';

    const embed = new EmbedBuilder()
      .setTitle(`Whois: ${userId}`)
      .setDescription(`Shared server lookup for <@${userId}>`)
      .addFields(
        { name: 'Shared servers', value: `${count} / ${totalGuilds}`, inline: true },
        {
          name: 'Server list',
          value: preview.length > 1024 ? `${preview.slice(0, 1021)}...` : preview,
          inline: false,
        },
      )
      .setColor(0x5865F2)
      .setTimestamp(new Date());

    await progressMsg.edit({
      content: `Whois complete for <@${userId}>.\n\`${progressBar(100)}\` 100%\nFound **${count}** shared server(s).`,
      embeds: [embed.toJSON()],
    }).catch(async () => {
      await message.reply({ embeds: [embed.toJSON()] }).catch(() => {});
    });
  },
};

export default command;
