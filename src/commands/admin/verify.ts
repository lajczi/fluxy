import type { Command } from '../../types';
import GuildSettings from '../../models/GuildSettings';
import settingsCache from '../../utils/settingsCache';
import isNetworkError from '../../utils/isNetworkError';
import { generateCaptcha } from '../../utils/captchaCard';
import { EmbedBuilder, PermissionFlags } from '@fluxerjs/core';

export const verificationSessions = new Map<string, {
  userId: string;
  code: string;
  attempts: number;
  maxAttempts: number;
  panelChannelId: string;
  panelMessageId: string;
  timeout: ReturnType<typeof setTimeout>;
}>();

function embedReply(message: any, description: string, title?: string): Promise<any> {
  const embed = new EmbedBuilder().setDescription(description).setColor(0x5865F2);
  if (title) embed.setTitle(title);
  return message.reply({ embeds: [embed] });
}

async function save(settings: any, guildId: string): Promise<void> {
  settings.markModified('verification');
  await settings.save();
  settingsCache.invalidate(guildId);
}


async function setupVerification(message: any, args: string[], guild: any, settings: any, client: any, prefix: string): Promise<any> {
  const verification = settings.verification;
  const botId = client.user?.id;
  const everyoneRoleId = guild.id;

  let verifiedRoleId = verification.verifiedRoleId;
  if (!verifiedRoleId) {
    try {
      const role = await guild.createRole({
        name: 'Verified',
        color: 0x2ecc71,
        mentionable: false,
      });
      verifiedRoleId = role.id;
      verification.verifiedRoleId = verifiedRoleId;
    } catch (err: any) {
      return embedReply(message, `Failed to create Verified role: ${err.message}`);
    }
  }

  let categoryId = verification.categoryId;
  if (!categoryId) {
    try {
      const category = await guild.createChannel({
        type: 4,
        name: 'Verification',
        permission_overwrites: [
          { id: everyoneRoleId, type: 0, allow: '0', deny: String(PermissionFlags.ViewChannel) },
          ...(botId ? [{ id: botId, type: 1, allow: String(PermissionFlags.ViewChannel | PermissionFlags.SendMessages | PermissionFlags.ManageChannels | PermissionFlags.ManageMessages | PermissionFlags.EmbedLinks | PermissionFlags.AttachFiles | PermissionFlags.ReadMessageHistory | PermissionFlags.AddReactions), deny: '0' }] : []),
        ],
      });
      categoryId = category.id;
      verification.categoryId = categoryId;
    } catch (err: any) {
      return embedReply(message, `Failed to create Verification category: ${err.message}`);
    }
  }

  let panelChannelId = verification.panelChannelId;
  if (!panelChannelId) {
    try {
      const panelChannel = await guild.createChannel({
        type: 0,
        name: 'verify-here',
        parent_id: categoryId,
        topic: 'React with ✅ to begin the verification process.',
        permission_overwrites: [
          { id: everyoneRoleId, type: 0, allow: String(PermissionFlags.ViewChannel | PermissionFlags.ReadMessageHistory | PermissionFlags.AddReactions), deny: String(PermissionFlags.SendMessages) },
          ...(botId ? [{ id: botId, type: 1, allow: String(PermissionFlags.ViewChannel | PermissionFlags.SendMessages | PermissionFlags.ManageMessages | PermissionFlags.EmbedLinks | PermissionFlags.AttachFiles | PermissionFlags.ReadMessageHistory | PermissionFlags.AddReactions), deny: '0' }] : []),
          { id: verifiedRoleId, type: 0, allow: '0', deny: String(PermissionFlags.ViewChannel) },
        ],
      });
      panelChannelId = panelChannel.id;
      verification.panelChannelId = panelChannelId;
    } catch (err: any) {
      return embedReply(message, `Failed to create verify-here channel: ${err.message}`);
    }
  }

  try {
    const panelEmbed = new EmbedBuilder()
      .setTitle('🔒 Server Verification')
      .setDescription(
        '**Welcome!** This server requires manual verification to help fight bot abuse.\n\n' +
        'React with ✅ below to begin the verification process.\n\n' +
        'You will be given a private channel with a captcha image - simply type the 6 letters shown to verify yourself.'
      )
      .setColor(0x5865F2)
      .setFooter({ text: 'Verification is quick and easy!' })
      .setTimestamp(new Date());

    const channel = guild.channels?.get?.(panelChannelId) || await client.channels.fetch(panelChannelId);
    const panelMessage = await channel.send({ embeds: [panelEmbed] });
    await panelMessage.react('✅');

    verification.panelMessageId = panelMessage.id;
  } catch (err: any) {
    return embedReply(message, `Failed to post verification panel: ${err.message}`);
  }

  verification.enabled = true;
  await save(settings, guild.id);

  const statusEmbed = new EmbedBuilder()
    .setTitle('✅ Verification Setup Complete')
    .setDescription(
      `**Category:** Verification\n` +
      `**Panel Channel:** <#${panelChannelId}>\n` +
      `**Verified Role:** <@&${verifiedRoleId}>\n\n` +
      `Users can now react with ✅ in <#${panelChannelId}> to begin verification.\n\n` +
      `> **Important:** Make sure to deny \`@everyone\` the \`View Channel\` permission on your other channels, ` +
      `and allow the **Verified** role to see them. This ensures unverified users can only see the verification channel.`
    )
    .setColor(0x2ecc71)
    .setTimestamp(new Date());

  return message.reply({ embeds: [statusEmbed] });
}

async function postPanel(message: any, args: string[], guild: any, settings: any, client: any, prefix: string): Promise<any> {
  const verification = settings.verification;

  const channelArg = args[0];
  let channelId = verification.panelChannelId;

  if (channelArg) {
    const parsed = channelArg.match(/^<#(\d{17,19})>$/)?.[1] ?? (/^\d{17,19}$/.test(channelArg) ? channelArg : null);
    if (parsed) channelId = parsed;
  }

  if (!channelId) {
    return embedReply(message, `Please specify a channel or run \`${prefix}verify setup\` first.`);
  }

  try {
    const panelEmbed = new EmbedBuilder()
      .setTitle('🔒 Server Verification')
      .setDescription(
        '**Welcome!** This server requires manual verification to help fight bot abuse.\n\n' +
        'React with ✅ below to begin the verification process.\n\n' +
        'You will be given a private channel with a captcha image - simply type the 6 letters shown to verify yourself.'
      )
      .setColor(0x5865F2)
      .setFooter({ text: 'Verification is quick and easy!' })
      .setTimestamp(new Date());

    const channel = guild.channels?.get?.(channelId) || await client.channels.fetch(channelId);
    const panelMsg = await channel.send({ embeds: [panelEmbed] });
    await panelMsg.react('✅');

    verification.panelChannelId = channelId;
    verification.panelMessageId = panelMsg.id;
    await save(settings, guild.id);

    return embedReply(message, `Verification panel posted in <#${channelId}>.`);
  } catch (err: any) {
    return embedReply(message, `Failed to post panel: ${err.message}`);
  }
}

async function setRole(message: any, args: string[], guild: any, settings: any, _client: any, prefix: string): Promise<any> {
  const roleArg = args[0];
  if (!roleArg) return embedReply(message, `Usage: \`${prefix}verify role <@role>\``);

  const roleId = roleArg.match(/^<@&(\d{17,19})>$/)?.[1] ?? (/^\d{17,19}$/.test(roleArg) ? roleArg : null);
  if (!roleId) return embedReply(message, 'Please mention a valid role or provide a role ID.');

  settings.verification.verifiedRoleId = roleId;
  await save(settings, guild.id);
  return embedReply(message, `Verified role set to <@&${roleId}>.`);
}

async function setCategory(message: any, args: string[], guild: any, settings: any, _client: any, prefix: string): Promise<any> {
  const catArg = args[0];
  if (!catArg) return embedReply(message, `Usage: \`${prefix}verify category <categoryId>\``);

  const catId = /^\d{17,19}$/.test(catArg) ? catArg : null;
  if (!catId) return embedReply(message, 'Please provide a valid category ID.');

  settings.verification.categoryId = catId;
  await save(settings, guild.id);
  return embedReply(message, `Verification category set to \`${catId}\`.`);
}

async function setLog(message: any, args: string[], guild: any, settings: any, _client: any, prefix: string): Promise<any> {
  const channelArg = args[0];
  if (!channelArg) return embedReply(message, `Usage: \`${prefix}verify log <#channel>\` or \`${prefix}verify log clear\``);

  if (channelArg.toLowerCase() === 'clear') {
    settings.verification.logChannelId = null;
    await save(settings, guild.id);
    return embedReply(message, 'Verification log channel cleared.');
  }

  const channelId = channelArg.match(/^<#(\d{17,19})>$/)?.[1] ?? (/^\d{17,19}$/.test(channelArg) ? channelArg : null);
  if (!channelId) return embedReply(message, 'Please mention a valid channel or provide a channel ID.');

  settings.verification.logChannelId = channelId;
  await save(settings, guild.id);
  return embedReply(message, `Verification log channel set to <#${channelId}>.`);
}

async function showStatus(message: any, args: string[], guild: any, settings: any, _client: any, _prefix: string): Promise<any> {
  const v = settings.verification;

  const statusEmbed = new EmbedBuilder()
    .setTitle('Verification Configuration')
    .setColor(0x5865F2)
    .setDescription(
      `**Enabled:** ${v.enabled ? 'Yes' : 'No'}\n` +
      `**Verified Role:** ${v.verifiedRoleId ? `<@&${v.verifiedRoleId}>` : 'Not set'}\n` +
      `**Category:** ${v.categoryId || 'Not set'}\n` +
      `**Panel Channel:** ${v.panelChannelId ? `<#${v.panelChannelId}>` : 'Not set'}\n` +
      `**Log Channel:** ${v.logChannelId ? `<#${v.logChannelId}>` : 'Not set'}\n` +
      `**Max Attempts:** ${v.maxAttempts || 2}`
    )
    .setTimestamp(new Date());

  return message.reply({ embeds: [statusEmbed] });
}

async function resetVerification(message: any, args: string[], guild: any, settings: any, _client: any, _prefix: string): Promise<any> {
  settings.verification = {
    enabled: false,
    categoryId: null,
    verifiedRoleId: null,
    panelChannelId: null,
    panelMessageId: null,
    logChannelId: null,
    maxAttempts: 2,
  };
  await save(settings, guild.id);
  return embedReply(message, 'Verification settings have been reset. Channels and roles created during setup were **not** deleted - remove them manually if needed.');
}

async function testVerification(message: any, args: string[], guild: any, settings: any, client: any, prefix: string): Promise<any> {
  const verification = settings.verification;

  if (!verification.categoryId) {
    return embedReply(message, `Run \`${prefix}verify setup\` first to create the verification category.`);
  }

  const userId = message.author.id;
  const botId = client.user?.id;
  const everyoneRoleId = guild.id;

  let channel: any;
  try {
    const username = (message as any).member?.displayName || (message.author as any).username || 'user';
    const safeName = username.toLowerCase().replace(/[^a-z0-9]/g, '').slice(0, 16) || 'user';

    channel = await guild.createChannel({
      type: 0,
      name: `verify-${safeName}`,
      parent_id: verification.categoryId,
      permission_overwrites: [
        { id: everyoneRoleId, type: 0, allow: '0', deny: String(PermissionFlags.ViewChannel) },
        { id: userId, type: 1, allow: String(PermissionFlags.ViewChannel | PermissionFlags.SendMessages | PermissionFlags.ReadMessageHistory), deny: '0' },
        ...(botId ? [{ id: botId, type: 1, allow: String(PermissionFlags.ViewChannel | PermissionFlags.SendMessages | PermissionFlags.ManageChannels | PermissionFlags.ManageMessages | PermissionFlags.EmbedLinks | PermissionFlags.AttachFiles | PermissionFlags.ReadMessageHistory), deny: '0' }] : []),
      ],
    });
  } catch (err: any) {
    return embedReply(message, `Failed to create test verification channel: ${err.message}`);
  }

  try {
    const { code, image } = await generateCaptcha();
    const maxAttempts = verification.maxAttempts || 2;

    const captchaEmbed = new EmbedBuilder()
      .setTitle('🔒 Verification Required')
      .setDescription(
        `Welcome, <@${userId}>!\n\n` +
        `Please type the **6 letters** shown in the image above to verify yourself.\n\n` +
        `You have **${maxAttempts}** attempt(s). The code is **not** case-sensitive.\n` +
        `This channel will expire in **60 seconds**.`
      )
      .setColor(0x5865F2)
            .setTimestamp(new Date());

    await channel.send({
      embeds: [captchaEmbed],
      files: [{ name: 'captcha.png', data: image }],
    });

    const timeout = setTimeout(async () => {
      verificationSessions.delete(channel.id);
      try {
        await channel.delete();
      } catch { }
    }, 60_000);

    verificationSessions.set(channel.id, {
      userId,
      code,
      attempts: 0,
      maxAttempts,
      panelChannelId: verification.panelChannelId || '',
      panelMessageId: verification.panelMessageId || '',
      timeout,
    });

    return embedReply(message, `Test verification channel created: <#${channel.id}>`);
  } catch (err: any) {
    try { await channel.delete(); } catch { }
    return embedReply(message, `Failed to generate captcha: ${err.message}`);
  }
}


function showHelp(message: any, prefix: string): Promise<any> {
  return embedReply(message,
    `\`${prefix}verify setup\` - auto-create category, channel, role, and panel\n` +
    `\`${prefix}verify panel [#channel]\` - (re-)post the verification panel\n` +
    `\`${prefix}verify role <@role>\` - set the verified role\n` +
    `\`${prefix}verify category <id>\` - set the verification category\n` +
    `\`${prefix}verify log <#channel>\` - set a log channel\n` +
    `\`${prefix}verify status\` - show current configuration\n` +
    `\`${prefix}verify reset\` - disable and clear settings\n` +
    `\`${prefix}verify test\` - open a test verification channel for yourself`,
    'Manual Verification System'
  );
}


const subcommands: Record<string, (message: any, args: string[], guild: any, settings: any, client: any, prefix: string) => Promise<any>> = {
  setup: setupVerification,
  panel: postPanel,
  role: setRole,
  category: setCategory,
  log: setLog,
  status: showStatus,
  reset: resetVerification,
  test: testVerification,
};


const command: Command = {
  name: 'verify',
  description: [
    'Set up manual captcha verification for your server.',
    '',
    '**Subcommands:**',
    '`setup` - auto-create category, channel, role, and panel',
    '`panel [#channel]` - (re-)post the verification panel embed',
    '`role <@role>` - set the verified role',
    '`category <id>` - set the verification category',
    '`log <#channel>` - set a verification log channel',
    '`status` - show current verification config',
    '`reset` - disable and clear settings',
    '`test` - test verification with a temp channel',
  ].join('\n'),
  usage: '<subcommand> [options]',
  category: 'admin',
  permissions: ['ManageGuild'],
  cooldown: 5,

  async execute(message, args, client, prefix = '!') {
    let guild = (message as any).guild;
    if (!guild && (message as any).guildId) guild = await client.guilds.fetch((message as any).guildId);
    if (!guild) return void await embedReply(message, 'This command can only be used in a server.');

    const sub = args[0]?.toLowerCase();

    if (!sub || !subcommands[sub]) {
      return showHelp(message, prefix);
    }

    try {
      const settings: any = await GuildSettings.getOrCreate(guild.id);
      if (!settings.verification) settings.verification = {};
      await subcommands[sub](message, args.slice(1), guild, settings, client, prefix);
    } catch (error: any) {
      const guildName = guild?.name || 'Unknown Server';
      if (isNetworkError(error)) {
        console.warn(`[${guildName}] Fluxer API unreachable during !verify (ECONNRESET)`);
      } else {
        console.error(`[${guildName}] Error in !verify: ${error.message || error}`);
        embedReply(message, 'An error occurred while updating verification settings.').catch(() => { });
      }
    }
  },
};

export default command;
