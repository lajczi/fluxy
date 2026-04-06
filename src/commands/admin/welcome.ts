import type { Command } from '../../types';
import GuildSettings from '../../models/GuildSettings';
import settingsCache from '../../utils/settingsCache';
import isNetworkError from '../../utils/isNetworkError';
import { generateWelcomeCard, PRESETS } from '../../utils/welcomeCard';
import * as bgImageCache from '../../utils/bgImageCache';
import * as memberCounter from '../../utils/memberCounter';
import { EmbedBuilder } from '@erinjs/core';

const HEX_RE = /^#[0-9a-f]{6}$/i;

function strLen(str: string): number {
  return [...str].length;
}

async function save(settings: any, guildId: string): Promise<void> {
  settings.markModified('welcomeMessage');
  await settings.save();
  settingsCache.invalidate(guildId);
}

function replaceVars(text: string, userId: string, guildName: string, count: number, roleName: string | null, username?: string): string {
  return text
    .replace(/\\n/g, '\n')
    .replace(/\{user\}/gi,   `<@${userId}>`)
    .replace(/\{username\}/gi, username || 'Unknown')
    .replace(/\{server\}/gi, guildName)
    .replace(/\{count\}/gi,  String(count || 0))
    .replace(/\{role\}/gi,   roleName || 'None');
}

function embedReply(message: any, description: string, title?: string): Promise<any> {
  const embed = new EmbedBuilder().setDescription(description).setColor(0x5865F2);
  if (title) embed.setTitle(title);
  return message.reply({ embeds: [embed] });
}

const subcommands: Record<string, (message: any, args: string[], guild: any, settings: any, client: any, prefix: string) => Promise<any>> = {

  async status(message, args, guild, settings, _client, _prefix) {
    const wm   = settings.welcomeMessage;
    const card = wm.card || {};
    const emb  = wm.embed || {};
    const dm   = wm.dm || {};

    const ch      = wm.channelId    ? `<#${wm.channelId}>` : 'Not set';
    const enabled = wm.enabled      ? 'Yes' : 'No';
    const image   = wm.imageEnabled !== false ? 'Yes' : 'No';
    const msg     = wm.message      || 'Default';

    const trigger = wm.trigger === 'role' ? 'Role assigned' : 'Member join';

    const statusEmbed = new EmbedBuilder()
      .setTitle('Welcome Configuration')
      .setColor(0x5865F2)
      .setDescription(
        `Enabled: **${enabled}** | Channel: ${ch}\n` +
        `Trigger: **${trigger}** | Image card: **${image}** | Show role: **${wm.showRole ? 'Yes' : 'No'}**\n` +
        `Text: ${msg}`
      )
      .addFields(
        {
          name: 'Card',
          value:
            `Preset: **${card.preset || 'default'}**\n` +
            `Accent: ${card.accentColor || 'default'} | Text: ${card.textColor || 'default'}\n` +
            `Greeting: "${card.greetingText || 'WELCOME'}"\n` +
            `Background image: ${card.bgImageURL ? 'Set' : 'None'}`,
        },
        {
          name: 'Embed',
          value: `${emb.enabled ? 'Enabled' : 'Disabled'}${emb.title ? ` | Title: ${emb.title}` : ''}`,
          inline: true,
        },
        {
          name: 'DM',
          value: `${dm.enabled ? 'Enabled' : 'Disabled'} | Image: ${dm.imageEnabled ? 'Yes' : 'No'}`,
          inline: true,
        },
      )
      .setFooter({ text: 'Use !welcome test to preview' })
      .setTimestamp(new Date());

    return message.reply({ embeds: [statusEmbed] });
  },

  async channel(message, args, guild, settings, client, prefix) {
    const val = args[0];
    if (!val) return embedReply(message, `Usage: \`${prefix}welcome channel <#channel>\` or \`${prefix}welcome channel clear\``);

    const wm = settings.welcomeMessage;

    if (val.toLowerCase() === 'clear') {
      wm.channelId = null;
      wm.enabled = false;
      await save(settings, guild.id);
      return embedReply(message, 'Welcome channel cleared and welcome messages disabled.');
    }

    const channelId = val.match(/^<#(\d{17,19})>$/)?.[1] ?? (/^\d{17,19}$/.test(val) ? val : null);
    if (!channelId) return embedReply(message, 'Please mention a valid channel or provide a channel ID.');

    wm.channelId = channelId;
    wm.enabled = true;
    await save(settings, guild.id);
    return embedReply(message, `Welcome channel set to <#${channelId}> and welcome messages **enabled**.`);
  },

  async on(message, args, guild, settings, client, prefix) {
    const wm = settings.welcomeMessage;
    if (!wm.channelId) return embedReply(message, `Set a welcome channel first: \`${prefix}welcome channel <#channel>\``);
    wm.enabled = true;
    await save(settings, guild.id);
    return embedReply(message, 'Welcome messages **enabled**.');
  },

  async off(message, args, guild, settings, _client, _prefix) {
    settings.welcomeMessage.enabled = false;
    await save(settings, guild.id);
    return embedReply(message, 'Welcome messages **disabled**.');
  },

  async image(message, args, guild, settings, client, prefix) {
    const val = args[0]?.toLowerCase();
    if (val !== 'on' && val !== 'off') return embedReply(message, `Usage: \`${prefix}welcome image on\` or \`${prefix}welcome image off\``);
    settings.welcomeMessage.imageEnabled = val === 'on';
    await save(settings, guild.id);
    return embedReply(message, `Welcome card image **${val === 'on' ? 'enabled' : 'disabled'}**.`);
  },

  async message(message, args, guild, settings, client, prefix) {
    const val = args.join(' ').trim();
    if (!val) return embedReply(message, `Usage: \`${prefix}welcome message <text>\` or \`${prefix}welcome message clear\`\nVariables: \`{user}\` \`{server}\` \`{count}\` \`{role}\``);

    const wm = settings.welcomeMessage;

    if (val.toLowerCase() === 'clear') {
      wm.message = null;
      await save(settings, guild.id);
      return embedReply(message, 'Custom welcome text cleared.');
    }

    if (strLen(val) > 500) return embedReply(message, 'Welcome message is too long (max 500 characters).');

    wm.message = val;
    await save(settings, guild.id);
    return embedReply(message, `Welcome text set to:\n>>> ${val}`);
  },

  async card(message, args, guild, settings, client, prefix) {
    const sub = args[0]?.toLowerCase();
    const wm = settings.welcomeMessage;
    if (!wm.card) wm.card = {};
    const card = wm.card;

    if (sub === 'preset') {
      const name = args[1]?.toLowerCase();
      if (!name) {
        const names = Object.keys(PRESETS).filter((n: string) => n !== 'default');
        return embedReply(message, `Available presets: ${names.map((n: string) => `\`${n}\``).join(', ')}\nUsage: \`!welcome card preset <name>\` or \`!welcome card preset clear\``);
      }
      if (name === 'clear') {
        card.preset = null;
        await save(settings, guild.id);
        return embedReply(message, 'Card preset cleared. Using default theme.');
      }
      if (!(PRESETS as any)[name]) {
        const names = Object.keys(PRESETS).filter((n: string) => n !== 'default');
        return embedReply(message, `Invalid preset. Choose from: ${names.map((n: string) => `\`${n}\``).join(', ')}`);
      }
      card.preset = name;
      await save(settings, guild.id);
      return embedReply(message, `Card preset set to **${name}**. Use \`!welcome test\` to preview.`);
    }

    if (sub === 'color') {
      const hex = args[1];
      if (!hex || !HEX_RE.test(hex)) return embedReply(message, `Provide a valid hex color. Example: \`${prefix}welcome card color #ff6b00\``);
      card.accentColor = hex;
      await save(settings, guild.id);
      return embedReply(message, `Card accent color set to **${hex}**.`);
    }

    if (sub === 'bgcolor') {
      const colors = args.slice(1).filter((a: string) => HEX_RE.test(a));
      if (colors.length === 0) return embedReply(message, `Provide 1-3 hex colors for the gradient.\nExample: \`${prefix}welcome card bgcolor #1a1a2e #16213e #0f3460\``);
      card.bgColor1 = colors[0];
      card.bgColor2 = colors[1] || colors[0];
      card.bgColor3 = colors[2] || colors[1] || colors[0];
      await save(settings, guild.id);
      return embedReply(message, `Card background gradient set to **${colors.join(' → ')}**.`);
    }

    if (sub === 'textcolor') {
      const hex = args[1];
      if (!hex || !HEX_RE.test(hex)) return embedReply(message, `Provide a valid hex color. Example: \`${prefix}welcome card textcolor #f5f5f5\``);
      card.textColor = hex;
      await save(settings, guild.id);
      return embedReply(message, `Card text color set to **${hex}**.`);
    }

    if (sub === 'greeting') {
      const text = args.slice(1).join(' ').trim();
      if (!text) return embedReply(message, `Usage: \`${prefix}welcome card greeting <text>\` or \`${prefix}welcome card greeting clear\``);
      if (text.toLowerCase() === 'clear') {
        card.greetingText = null;
        await save(settings, guild.id);
        return embedReply(message, 'Greeting text reset to "WELCOME".');
      }
      if (strLen(text) > 30) return embedReply(message, 'Greeting text is too long (max 30 characters).');
      card.greetingText = text;
      await save(settings, guild.id);
      return embedReply(message, `Card greeting text set to **${text.toUpperCase()}**.`);
    }

    if (sub === 'subtitle') {
      const text = args.slice(1).join(' ').trim();
      if (!text) return embedReply(message, `Usage: \`${prefix}welcome card subtitle <text>\` or \`${prefix}welcome card subtitle clear\``);
      if (text.toLowerCase() === 'clear') {
        card.subtitle = null;
        await save(settings, guild.id);
        return embedReply(message, 'Subtitle text reset to default.');
      }
      if (strLen(text) > 50) return embedReply(message, 'Subtitle text is too long (max 50 characters).');
      card.subtitle = text;
      await save(settings, guild.id);
      return embedReply(message, `Card subtitle set to **${text}**.`);
    }

    if (sub === 'membercount') {
      const val = args[1]?.toLowerCase();
      if (val !== 'on' && val !== 'off') return embedReply(message, `Usage: \`${prefix}welcome card membercount on\` or \`${prefix}welcome card membercount off\``);
      card.showMemberCount = val === 'on';
      await save(settings, guild.id);
      return embedReply(message, `Member count on card **${val === 'on' ? 'enabled' : 'disabled'}**.`);
    }

    if (sub === 'countcolor') {
      const hex = args[1];
      if (!hex || !HEX_RE.test(hex)) return embedReply(message, `Provide a valid hex color. Example: \`${prefix}welcome card countcolor #9999bb\``);
      card.countColor = hex;
      await save(settings, guild.id);
      return embedReply(message, `Card member count color set to **${hex}**.`);
    }

    if (sub === 'subtextcolor') {
      const hex = args[1];
      if (!hex || !HEX_RE.test(hex)) return embedReply(message, `Provide a valid hex color. Example: \`${prefix}welcome card subtextcolor #aabbcc\``);
      card.subtextColor = hex;
      await save(settings, guild.id);
      return embedReply(message, `Card subtitle color set to **${hex}**.`);
    }

    if (sub === 'background') {
      const url = args[1];
      if (!url) return embedReply(message, `Usage: \`${prefix}welcome card background <url>\` or \`${prefix}welcome card background clear\``);
      if (url.toLowerCase() === 'clear') {
        if (card.bgImageURL) bgImageCache.remove(card.bgImageURL);
        card.bgImageURL = null;
        await save(settings, guild.id);
        return embedReply(message, 'Custom background image removed.');
      }
      if (!/^https?:\/\/.+/i.test(url)) return embedReply(message, 'Please provide a valid image URL (must start with `http://` or `https://`).');
      try {
        await bgImageCache.download(url);
      } catch (err: any) {
        return embedReply(message, `Failed to download image: ${err.message}`);
      }
      card.bgImageURL = url;
      await save(settings, guild.id);
      return embedReply(message, `Custom background image set. Use \`${prefix}welcome test\` to preview.`);
    }

    if (sub === 'reset') {
      if (card.bgImageURL) bgImageCache.remove(card.bgImageURL);
      settings.welcomeMessage.card = {};
      await save(settings, guild.id);
      return embedReply(message, 'All card customization has been reset to defaults.');
    }

    return embedReply(message,
      `\`${prefix}welcome card preset <name>\` - apply a theme (dark, light, ocean, sunset, midnight, forest)\n` +
      `\`${prefix}welcome card color <hex>\` - set accent color\n` +
      `\`${prefix}welcome card bgcolor <hex> [hex] [hex]\` - set gradient colors\n` +
      `\`${prefix}welcome card textcolor <hex>\` - set username text color\n` +
      `\`${prefix}welcome card subtextcolor <hex>\` - set subtitle text color\n` +
      `\`${prefix}welcome card countcolor <hex>\` - set member count text color\n` +
      `\`${prefix}welcome card greeting <text>\` - replace "WELCOME" text on card (emoji supported 🎉)\n` +
      `\`${prefix}welcome card subtitle <text>\` - set subtitle text (max 50 chars)\n` +
      `\`${prefix}welcome card membercount on/off\` - toggle member count on card\n` +
      `\`${prefix}welcome card background <url>\` - set a custom background image\n` +
      `\`${prefix}welcome card reset\` - reset all card settings to defaults`,
      'Card Customization'
    );
  },

  async dm(message, args, guild, settings, client, prefix) {
    const sub = args[0]?.toLowerCase();
    const wm = settings.welcomeMessage;
    if (!wm.dm) wm.dm = {};

    if (sub === 'on' || sub === 'off') {
      wm.dm.enabled = sub === 'on';
      await save(settings, guild.id);
      return embedReply(message, `DM welcome messages **${sub === 'on' ? 'enabled' : 'disabled'}**.`);
    }

    if (sub === 'message') {
      const val = args.slice(1).join(' ').trim();
      if (!val) return embedReply(message, `Usage: \`${prefix}welcome dm message <text>\` or \`${prefix}welcome dm message clear\`\nVariables: \`{user}\` \`{server}\` \`{count}\` \`{role}\``);
      if (val.toLowerCase() === 'clear') {
        wm.dm.message = null;
        await save(settings, guild.id);
        return embedReply(message, 'Custom DM welcome text cleared.');
      }
      if (strLen(val) > 500) return embedReply(message, 'DM message is too long (max 500 characters).');
      wm.dm.message = val;
      await save(settings, guild.id);
      return embedReply(message, `DM welcome text set to:\n>>> ${val}`);
    }

    if (sub === 'image') {
      const val = args[1]?.toLowerCase();
      if (val !== 'on' && val !== 'off') return embedReply(message, `Usage: \`${prefix}welcome dm image on\` or \`${prefix}welcome dm image off\``);
      wm.dm.imageEnabled = val === 'on';
      await save(settings, guild.id);
      return embedReply(message, `DM welcome card image **${val === 'on' ? 'enabled' : 'disabled'}**.`);
    }

    return embedReply(message,
      `\`${prefix}welcome dm on/off\` - enable or disable DM welcomes\n` +
      `\`${prefix}welcome dm message <text>\` - set DM text ({user} {server} {count} {role})\n` +
      `\`${prefix}welcome dm image on/off\` - include card image in DM`,
      'DM Welcome'
    );
  },

  async embed(message, args, guild, settings, client, prefix) {
    const sub = args[0]?.toLowerCase();
    const wm = settings.welcomeMessage;
    if (!wm.embed) wm.embed = {};
    const emb = wm.embed;

    if (sub === 'on' || sub === 'off') {
      emb.enabled = sub === 'on';
      await save(settings, guild.id);
      return embedReply(message, `Welcome embed **${sub === 'on' ? 'enabled' : 'disabled'}**.`);
    }

    if (sub === 'title') {
      const val = args.slice(1).join(' ').trim();
      if (!val) return embedReply(message, `Usage: \`${prefix}welcome embed title <text>\` or \`${prefix}welcome embed title clear\``);
      if (val.toLowerCase() === 'clear') {
        emb.title = null;
        await save(settings, guild.id);
        return embedReply(message, 'Embed title cleared.');
      }
      if (strLen(val) > 256) return embedReply(message, 'Title is too long (max 256 characters).');
      emb.title = val;
      await save(settings, guild.id);
      return embedReply(message, `Embed title set to: **${val}**`);
    }

    if (sub === 'description') {
      const val = args.slice(1).join(' ').trim();
      if (!val) return embedReply(message, `Usage: \`${prefix}welcome embed description <text>\` or \`${prefix}welcome embed description clear\``);
      if (val.toLowerCase() === 'clear') {
        emb.description = null;
        await save(settings, guild.id);
        return embedReply(message, 'Embed description cleared.');
      }
      if (strLen(val) > 2048) return embedReply(message, 'Description is too long (max 2048 characters).');
      emb.description = val;
      await save(settings, guild.id);
      return embedReply(message, 'Embed description set.');
    }

    if (sub === 'color') {
      const hex = args[1];
      if (!hex || !HEX_RE.test(hex)) return embedReply(message, `Provide a valid hex color. Example: \`${prefix}welcome embed color #5865F2\``);
      emb.color = hex;
      await save(settings, guild.id);
      return embedReply(message, `Embed color set to **${hex}**.`);
    }

    if (sub === 'footer') {
      const val = args.slice(1).join(' ').trim();
      if (!val) return embedReply(message, `Usage: \`${prefix}welcome embed footer <text>\` or \`${prefix}welcome embed footer clear\``);
      if (val.toLowerCase() === 'clear') {
        emb.footer = null;
        await save(settings, guild.id);
        return embedReply(message, 'Embed footer cleared.');
      }
      if (strLen(val) > 256) return embedReply(message, 'Footer is too long (max 256 characters).');
      emb.footer = val;
      await save(settings, guild.id);
      return embedReply(message, `Embed footer set to: ${val}`);
    }

    if (sub === 'thumbnail') {
      const val = args[1]?.toLowerCase();
      if (val !== 'on' && val !== 'off') return embedReply(message, `Usage: \`${prefix}welcome embed thumbnail on\` or \`${prefix}welcome embed thumbnail off\``);
      emb.thumbnail = val === 'on';
      await save(settings, guild.id);
      return embedReply(message, `Embed thumbnail **${val === 'on' ? 'enabled' : 'disabled'}**.`);
    }

    if (sub === 'clear') {
      settings.welcomeMessage.embed = { enabled: false };
      await save(settings, guild.id);
      return embedReply(message, 'All embed settings cleared.');
    }

    return embedReply(message,
      `\`${prefix}welcome embed on/off\` - toggle embed\n` +
      `\`${prefix}welcome embed title <text>\` - set title ({user} {server} {count} {role})\n` +
      `\`${prefix}welcome embed description <text>\` - set description\n` +
      `\`${prefix}welcome embed color <hex>\` - set color\n` +
      `\`${prefix}welcome embed footer <text>\` - set footer\n` +
      `\`${prefix}welcome embed thumbnail on/off\` - show server icon\n` +
      `\`${prefix}welcome embed clear\` - reset embed settings`,
      'Embed Customization'
    );
  },

  async role(message, args, guild, settings, client, prefix) {
    const val = args[0]?.toLowerCase();
    if (val !== 'on' && val !== 'off') {
      return embedReply(message, `Usage: \`${prefix}welcome role on\` or \`${prefix}welcome role off\`\nWhen enabled, the auto-role name shows on the card and in the \`{role}\` variable.`);
    }
    settings.welcomeMessage.showRole = val === 'on';
    await save(settings, guild.id);
    return embedReply(message, `Role display on welcome **${val === 'on' ? 'enabled' : 'disabled'}**.`);
  },

  async trigger(message, args, guild, settings, client, prefix) {
    const val = args[0]?.toLowerCase();
    const wm = settings.welcomeMessage;

    if (!val) {
      let current = 'Member join';
      if (wm.trigger === 'role') {
        const rid = wm.triggerRoleId || settings.autoroleId;
        const rName = rid ? (guild.roles?.get?.(rid)?.name ?? rid) : 'none';
        current = `Role assigned (${rName})`;
      }
      return embedReply(message, `Current welcome trigger: **${current}**\nUsage: \`${prefix}welcome trigger join\` or \`${prefix}welcome trigger role <@role>\``);
    }

    if (val !== 'join' && val !== 'role') {
      return embedReply(message, `Usage: \`${prefix}welcome trigger join\` or \`${prefix}welcome trigger role <@role>\``);
    }

    if (val === 'role') {
      const roleArg = args[1];
      let roleId: string | null = null;

      if (roleArg) {
        const roleMention = roleArg.match(/^<@&(\d{17,19})>$/);
        if (roleMention) {
          roleId = roleMention[1];
        } else if (/^\d{17,19}$/.test(roleArg)) {
          roleId = roleArg;
        }
        if (roleId) {
          const role = guild.roles?.get?.(roleId);
          if (!role) {
            try { await guild.fetchRole(roleId); } catch {
              return embedReply(message, 'That role does not exist in this server.');
            }
          }
        }
      }

      if (!roleId && !settings.autoroleId) {
        return embedReply(message, `Please specify a role: \`${prefix}welcome trigger role <@role>\`\nOr set an autorole first with \`${prefix}autorole set @Role\`.`);
      }

      wm.trigger = 'role';
      wm.triggerRoleId = roleId;
      await save(settings, guild.id);

      const effectiveId = roleId || settings.autoroleId;
      const roleName = effectiveId ? (guild.roles?.get?.(effectiveId)?.name ?? effectiveId) : 'unknown';
      return embedReply(message, `Welcome trigger set to **role assignment** (${roleId ? `<@&${roleId}>` : `autorole: **${roleName}**`}).`);
    }

    wm.trigger = val;
    await save(settings, guild.id);
    return embedReply(message, `Welcome trigger set to **member join**.`);
  },

  async goodbye(message, args, guild, settings, client, _prefix) {
    const goodbyeCommand = (await import('./goodbye')).default;
    return goodbyeCommand.execute(message, args, client);
  },

  async test(message, args, guild, settings, client, prefix) {
    const wm   = settings.welcomeMessage;
    const user = message.author;
    const count = memberCounter.get(guild.id) ?? 0;
    const avatarURL = (user as any).displayAvatarURL?.({ size: 256, format: 'png' })
      ?? (user as any).avatarURL
      ?? '/assets/default-avatar.png';

    let roleName: string | null = null;
    if (wm.showRole) {
      const rid = wm.triggerRoleId || settings.autoroleId;
      if (rid) {
        const role = guild.roles?.get?.(rid);
        roleName = role?.name || null;
      }
    }

    const sendOpts: any = {};

    if (wm.imageEnabled !== false) {
      try {
        const buffer = await generateWelcomeCard({
          username:    (message as any).member?.displayName || (user as any).globalName || (user as any).username || 'New Member',
          avatarURL,
          serverName:  guild.name,
          memberCount: typeof count === 'number' ? count : 0,
          card:        wm.card || {},
          roleName,
        });
        sendOpts.files = [{ name: 'welcome.png', data: buffer }];
      } catch (err: any) {
        console.error(`[welcome] Card generation failed: ${err.message}`);
        return embedReply(message, 'Failed to generate the welcome card image. Check the console for details.');
      }
    }

    if (wm.message) {
      sendOpts.content = replaceVars(wm.message, user.id, guild.name, count, roleName);
    } else {
      sendOpts.content = `Welcome to **${guild.name}**, <@${user.id}>!`;
    }

    if (wm.embed?.enabled) {
      const embConf = wm.embed;
      const embed = new EmbedBuilder();
      if (embConf.title) embed.setTitle(replaceVars(embConf.title, user.id, guild.name, count, roleName));
      if (embConf.description) embed.setDescription(replaceVars(embConf.description, user.id, guild.name, count, roleName));
      if (embConf.color) embed.setColor(parseInt(embConf.color.replace('#', ''), 16));
      if (embConf.footer) embed.setFooter({ text: replaceVars(embConf.footer, user.id, guild.name, count, roleName) });
      if (embConf.thumbnail) {
        const iconURL = guild.iconURL?.({ size: 256 }) || null;
        if (iconURL) embed.setThumbnail(iconURL);
      }
      embed.setTimestamp(new Date());
      sendOpts.embeds = [embed];
    }

    const channelNote = wm.channelId
      ? `This is a preview. Real welcome messages will be sent to <#${wm.channelId}>.`
      : `This is a preview. Set a welcome channel with \`${prefix}welcome channel <#channel>\` for messages to send automatically.`;
    await embedReply(message, channelNote);
    await (message as any).channel.send(sendOpts);
  },

  async testdm(message, args, guild, settings, _client, _prefix) {
    const wm   = settings.welcomeMessage;
    const dm   = wm.dm || {};
    const user = message.author;
    const count = memberCounter.get(guild.id) ?? 0;
    const avatarURL = (user as any).displayAvatarURL?.({ size: 256, format: 'png' })
      ?? (user as any).avatarURL
      ?? '/assets/default-avatar.png';

    let roleName: string | null = null;
    if (wm.showRole && settings.autoroleId) {
      const role = guild.roles?.get?.(settings.autoroleId);
      roleName = role?.name || null;
    }

    const dmOpts: any = {};

    if (dm.message) {
      dmOpts.content = replaceVars(dm.message, user.id, guild.name, count, roleName);
    } else if (wm.message) {
      dmOpts.content = replaceVars(wm.message, user.id, guild.name, count, roleName);
    } else {
      dmOpts.content = `Welcome to **${guild.name}**!`;
    }

    if (dm.imageEnabled !== false && wm.imageEnabled !== false) {
      try {
        const buffer = await generateWelcomeCard({
          username:    (message as any).member?.displayName || (user as any).globalName || (user as any).username || 'New Member',
          avatarURL,
          serverName:  guild.name,
          memberCount: typeof count === 'number' ? count : 0,
          card:        wm.card || {},
          roleName,
        });
        dmOpts.files = [{ name: 'welcome.png', data: buffer }];
      } catch (err: any) {
        console.error(`[welcome] Card generation failed: ${err.message}`);
      }
    }

    try {
      await (user as any).send(dmOpts);
      await embedReply(message, 'DM preview sent! Check your DMs.');
    } catch {
      await embedReply(message, 'Could not send you a DM. Make sure your DMs are open.');
    }
  },
};


function showHelp(message: any, prefix = '!') {
  return embedReply(message,
    `\`${prefix}welcome status\` - show current configuration\n` +
    `\`${prefix}welcome channel <#channel>\` - set welcome channel\n` +
    `\`${prefix}welcome on/off\` - enable or disable\n` +
    `\`${prefix}welcome image on/off\` - toggle the card image\n` +
    `\`${prefix}welcome message <text>\` - set custom text ({user} {server} {count} {role})\n` +
    `\`${prefix}welcome card\` - customize card appearance (preset, colors, background, greeting)\n` +
    `\`${prefix}welcome embed\` - configure a welcome embed\n` +
    `\`${prefix}welcome dm\` - configure DM welcoming\n` +
    `\`${prefix}welcome role on/off\` - show auto-role on card\n` +
    `\`${prefix}welcome trigger join/role\` - trigger on member join or role assignment\n` +
    `\`${prefix}welcome goodbye\` - configure goodbye messages (or use \`${prefix}goodbye\`)\n` +
    `\`${prefix}welcome test\` - preview the welcome card\n` +
    `\`${prefix}welcome test dm\` - preview the DM welcome message`,
    'Welcome System'
  );
}

const command: Command = {
  name: 'welcome',
  description: [
    'Configure the welcome message system for your server. Run `!welcome` with no arguments for the full guide.',
    '',
    '**Subcommands:**',
    '`status` - show current welcome configuration',
    '`channel <#channel>` - set the welcome channel',
    '`on/off` - enable or disable welcome messages',
    '`image on/off` - toggle the welcome card image',
    '`message <text>` - set custom welcome text ({user} {server} {count} {role})',
    '`card preset <name>` - apply a theme (dark, light, ocean, sunset, midnight, forest)',
    '`card color/bgcolor/textcolor <hex>` - customize card colors',
    '`card greeting <text>` - replace "WELCOME" text on the card (emoji supported)',
    '`card background <url>` - set a custom background image',
    '`embed on/off` - toggle a welcome embed (title, description, color, footer, thumbnail)',
    '`dm on/off` - toggle DM welcome messages',
    '`role on/off` - show auto-role name on the card',
    '`trigger join/role` - trigger on member join or role assignment',
    '`test` - preview the welcome output',
  ].join('\n'),
  usage: '<subcommand> [options]',
  category: 'admin',
  permissions: ['ManageGuild'],
  cooldown: 3,

  async execute(message, args, client, prefix = '!') {
    let guild = (message as any).guild;
    if (!guild && (message as any).guildId) guild = await client.guilds.fetch((message as any).guildId);
    if (!guild) return void await embedReply(message, 'This command can only be used in a server.');

    let sub = args[0]?.toLowerCase();

    if (sub === 'test' && args[1]?.toLowerCase() === 'dm') {
      sub = 'testdm';
    }

    if (!sub || !subcommands[sub]) {
      return showHelp(message, prefix);
    }

    try {
      const settings: any = await GuildSettings.getOrCreate(guild.id);
      if (!settings.welcomeMessage) settings.welcomeMessage = {};
      await subcommands[sub](message, sub === 'testdm' ? args.slice(2) : args.slice(1), guild, settings, client, prefix);
    } catch (error: any) {
      const guildName = guild?.name || 'Unknown Server';
      if (isNetworkError(error)) {
        console.warn(`[${guildName}] Fluxer API unreachable during !welcome (ECONNRESET)`);
      } else {
        console.error(`[${guildName}] Error in !welcome: ${error.message || error}`);
        embedReply(message, 'An error occurred while updating welcome settings.').catch(() => {});
      }
    }
  }
};

export default command;
