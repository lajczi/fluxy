import { EmbedBuilder } from '@erinjs/core';
import * as memberCounter from './memberCounter';
import { retrySend } from './retrySend';

export default async function sendGoodbye(member: any, guild: any, settings: any, _client: any): Promise<void> {
  const gm = settings.goodbyeMessage;
  if (!gm?.enabled || !gm.channelId) return;

  let goodbyeChannel: any;
  try {
    const channelsMap = guild.channels?.cache || guild.channels;
    goodbyeChannel = channelsMap?.get(gm.channelId)
      ?? await guild.channels.fetch(gm.channelId).catch(() => null);
  } catch {
    goodbyeChannel = null;
  }
  if (!goodbyeChannel) return;

  const user = member.user;
  const memberCount = memberCounter.get(guild.id) ?? 0;

  const replaceVars = (text: string) => text
    .replace(/\\n/g, '\n')
    .replace(/\{user\}/gi, `<@${member.id}>`)
    .replace(/\{username\}/gi, user?.username || 'Unknown')
    .replace(/\{server\}/gi, guild.name)
    .replace(/\{count\}/gi, String(memberCount || 0));

  const sendOpts: any = {};

  if (gm.message) {
    sendOpts.content = replaceVars(gm.message);
  } else {
    sendOpts.content = `**${user?.username || 'Someone'}** has left **${guild.name}**.`;
  }

  if (gm.embed?.enabled) {
    const embConf = gm.embed;
    const embed = new EmbedBuilder();
    if (embConf.title) embed.setTitle(replaceVars(embConf.title));
    if (embConf.description) embed.setDescription(replaceVars(embConf.description));
    if (embConf.color) embed.setColor(parseInt(embConf.color.replace('#', ''), 16));
    if (embConf.footer) embed.setFooter({ text: replaceVars(embConf.footer) });
    embed.setTimestamp(new Date());
    sendOpts.embeds = [embed];
  }

  if (sendOpts.content || sendOpts.embeds) {
    try {
      await retrySend(goodbyeChannel, sendOpts, 'goodbye');
    } catch (err: any) {
      console.error(`[goodbye] Failed to send goodbye in ${guild.name}: ${err.message}`);
    }
  }
}
