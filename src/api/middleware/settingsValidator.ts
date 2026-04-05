import {
  RSS_DEFAULT_POLL_INTERVAL_MINUTES,
  RSS_MAX_FEEDS_PER_GUILD,
  RSS_MAX_ITEMS_PER_POLL,
  RSS_MIN_POLL_INTERVAL_MINUTES,
} from '../../utils/rssDefaults';

const SNOWFLAKE_RE = /^\d{17,20}$/;
const MAX_STRING_LENGTH = 2000;
const MAX_ARRAY_LENGTH = 100;
const MAX_OBJECT_DEPTH = 5;
const CUSTOM_COMMAND_MAX_PER_GUILD = 5;
const CUSTOM_COMMAND_NAME_RE = /^[a-z0-9_-]{1,32}$/;
const CUSTOM_COMMAND_COLOR_RE = /^#?[0-9a-fA-F]{6}$/;
const CUSTOM_COMMAND_PERMISSION_VALUES = new Set([
  'Administrator',
  'ManageGuild',
  'ManageRoles',
  'ManageChannels',
  'ManageMessages',
  'KickMembers',
  'BanMembers',
  'ModerateMembers',
]);
const CUSTOM_COMMAND_ACTION_VALUES = new Set(['reply', 'toggleRole']);

const DANGEROUS_KEYS = new Set(['__proto__', 'constructor', 'prototype']);

function deepSanitize(value: unknown, depth = 0): unknown {
  if (depth > MAX_OBJECT_DEPTH) return undefined;

  if (value === null || value === undefined) return value;

  if (typeof value === 'string') {
    if (value.length > MAX_STRING_LENGTH) return value.slice(0, MAX_STRING_LENGTH);
    return value;
  }

  if (typeof value === 'number' || typeof value === 'boolean') return value;

  if (Array.isArray(value)) {
    if (value.length > MAX_ARRAY_LENGTH) {
      value = value.slice(0, MAX_ARRAY_LENGTH);
    }
    return (value as unknown[]).map((item: unknown) => deepSanitize(item, depth + 1)).filter((v: unknown) => v !== undefined);
  }

  if (typeof value === 'object') {
    const clean: Record<string, unknown> = {};
    for (const key of Object.keys(value as Record<string, unknown>)) {
      if (DANGEROUS_KEYS.has(key)) continue;
      if (key.startsWith('$')) continue;

      const sanitized = deepSanitize((value as Record<string, unknown>)[key], depth + 1);
      if (sanitized !== undefined) {
        clean[key] = sanitized;
      }
    }
    return clean;
  }

  return undefined;
}

function isSnowflake(v: unknown): v is string {
  return typeof v === 'string' && SNOWFLAKE_RE.test(v);
}

function isSnowflakeOrNull(v: unknown): boolean {
  return v === null || v === '' || isSnowflake(v);
}

function isSnowflakeArray(v: unknown, maxLen = 50): boolean {
  if (!Array.isArray(v)) return false;
  if (v.length > maxLen) return false;
  return v.every(isSnowflake);
}

function isBoundedString(v: unknown, maxLen = 200): v is string {
  return typeof v === 'string' && v.length <= maxLen;
}

function isBoundedInt(v: unknown, min: number, max: number): v is number {
  return typeof v === 'number' && Number.isInteger(v) && v >= min && v <= max;
}

function isHttpUrl(v: unknown): v is string {
  if (typeof v !== 'string' || v.trim().length === 0) return false;
  try {
    const parsed = new URL(v.trim());
    return parsed.protocol === 'http:' || parsed.protocol === 'https:';
  } catch {
    return false;
  }
}

function validateStarboardEntry(value: unknown): true | string {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) return 'starboard must be an object';
  const sb = value as Record<string, unknown>;
  if (sb.enabled !== undefined && typeof sb.enabled !== 'boolean') return 'starboard.enabled must be boolean';
  if (sb.channelId !== undefined && !isSnowflakeOrNull(sb.channelId)) return 'starboard.channelId must be a valid channel ID';
  if (sb.threshold !== undefined && !isBoundedInt(sb.threshold, 1, 100)) return 'starboard.threshold must be 1-100';
  if (sb.emoji !== undefined && !isBoundedString(sb.emoji, 64)) return 'starboard.emoji must be under 64 characters';
  if (sb.selfStarEnabled !== undefined && typeof sb.selfStarEnabled !== 'boolean') return 'starboard.selfStarEnabled must be boolean';
  if (sb.ignoreBots !== undefined && typeof sb.ignoreBots !== 'boolean') return 'starboard.ignoreBots must be boolean';
  if (sb.ignoredChannels !== undefined && !isSnowflakeArray(sb.ignoredChannels, 50)) return 'starboard.ignoredChannels must be channel IDs';
  if (sb.ignoredRoles !== undefined && !isSnowflakeArray(sb.ignoredRoles, 50)) return 'starboard.ignoredRoles must be role IDs';
  return true;
}

function validateRssFeedEntry(value: unknown): true | string {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    return 'rss.feeds entries must be objects';
  }

  const feed = value as Record<string, unknown>;

  if (feed.id !== undefined && !isBoundedString(feed.id, 128)) {
    return 'rss.feeds[].id must be under 128 characters';
  }

  if (feed.name !== undefined && feed.name !== null && !isBoundedString(feed.name, 120)) {
    return 'rss.feeds[].name must be under 120 characters';
  }

  if (feed.sourceType !== undefined && feed.sourceType !== 'rss' && feed.sourceType !== 'rsshub') {
    return 'rss.feeds[].sourceType must be either rss or rsshub';
  }

  const sourceType = (feed.sourceType === 'rsshub' ? 'rsshub' : 'rss') as 'rss' | 'rsshub';
  if (sourceType === 'rss') {
    if (!isHttpUrl(feed.url)) {
      return 'rss.feeds[].url must be a valid http(s) URL';
    }
  } else {
    if (!isBoundedString(feed.route, 500) || !(feed.route as string).startsWith('/')) {
      return 'rss.feeds[].route must start with / for rsshub sources';
    }
  }

  if (!isSnowflake(feed.channelId)) {
    return 'rss.feeds[].channelId must be a valid channel ID';
  }

  if (feed.mentionRoleId !== undefined && !isSnowflakeOrNull(feed.mentionRoleId)) {
    return 'rss.feeds[].mentionRoleId must be a valid role ID';
  }

  if (feed.webhookId !== undefined && !isSnowflakeOrNull(feed.webhookId)) {
    return 'rss.feeds[].webhookId must be a valid webhook ID';
  }

  if (feed.webhookToken !== undefined && feed.webhookToken !== null && !isBoundedString(feed.webhookToken, 300)) {
    return 'rss.feeds[].webhookToken must be under 300 characters';
  }

  if (feed.webhookName !== undefined && feed.webhookName !== null && !isBoundedString(feed.webhookName, 80)) {
    return 'rss.feeds[].webhookName must be under 80 characters';
  }

  if (feed.enabled !== undefined && typeof feed.enabled !== 'boolean') {
    return 'rss.feeds[].enabled must be boolean';
  }

  if (feed.maxItemsPerPoll !== undefined && !isBoundedInt(feed.maxItemsPerPoll, 1, RSS_MAX_ITEMS_PER_POLL)) {
    return `rss.feeds[].maxItemsPerPoll must be between 1 and ${RSS_MAX_ITEMS_PER_POLL}`;
  }

  if (feed.includeSummary !== undefined && typeof feed.includeSummary !== 'boolean') {
    return 'rss.feeds[].includeSummary must be boolean';
  }

  if (feed.includeImage !== undefined && typeof feed.includeImage !== 'boolean') {
    return 'rss.feeds[].includeImage must be boolean';
  }

  if (feed.format !== undefined && feed.format !== 'embed' && feed.format !== 'text') {
    return 'rss.feeds[].format must be embed or text';
  }

  return true;
}

interface ValidationResult {
  valid: boolean;
  errors: string[];
  sanitized: Record<string, unknown>;
}

const fieldValidators: Record<string, (value: unknown) => true | string> = {
  language(v) {
    if (typeof v !== 'string') return 'language must be a string';
    const code = v.trim();
    if (!/^[a-z]{2,3}(-[a-z0-9]{2,8})?$/i.test(code) || code.length > 20) return 'language must be a valid locale code';
    return true;
  },

  prefixes(v) {
    if (!Array.isArray(v)) return 'prefixes must be an array';
    if (v.length > 10) return 'Maximum 10 prefixes allowed';
    if (!v.every(p => typeof p === 'string' && p.length > 0 && p.length <= 10)) {
      return 'Each prefix must be a string between 1-10 characters';
    }
    return true;
  },

  prefix(v) {
    if (typeof v !== 'string') return 'prefix must be a string';
    if (v.length < 1 || v.length > 10) return 'prefix must be 1-10 characters';
    return true;
  },

  logChannelId(v) {
    if (!isSnowflakeOrNull(v)) return 'logChannelId must be a valid channel ID';
    return true;
  },

  serverLogChannelId(v) {
    if (!isSnowflakeOrNull(v)) return 'serverLogChannelId must be a valid channel ID';
    return true;
  },

  muteRoleId(v) {
    if (!isSnowflakeOrNull(v)) return 'muteRoleId must be a valid role ID';
    return true;
  },

  autoroleId(v) {
    if (!isSnowflakeOrNull(v)) return 'autoroleId must be a valid role ID';
    return true;
  },

  staffChannelId(v) {
    if (!isSnowflakeOrNull(v)) return 'staffChannelId must be a valid channel ID';
    return true;
  },

  staffRoleId(v) {
    if (!isSnowflakeOrNull(v)) return 'staffRoleId must be a valid role ID';
    return true;
  },

  staffInboxChannelId(v) {
    if (!isSnowflakeOrNull(v)) return 'staffInboxChannelId must be a valid channel ID';
    return true;
  },

  honeypotAlertRoleId(v) {
    if (!isSnowflakeOrNull(v)) return 'honeypotAlertRoleId must be a valid role ID';
    return true;
  },

  ticketCategoryId(v) {
    if (!isSnowflakeOrNull(v)) return 'ticketCategoryId must be a valid ID';
    return true;
  },

  ticketSupportRoleId(v) {
    if (!isSnowflakeOrNull(v)) return 'ticketSupportRoleId must be a valid role ID';
    return true;
  },

  ticketLogChannelId(v) {
    if (!isSnowflakeOrNull(v)) return 'ticketLogChannelId must be a valid channel ID';
    return true;
  },

  ticketSetupChannelId(v) {
    if (!isSnowflakeOrNull(v)) return 'ticketSetupChannelId must be a valid channel ID';
    return true;
  },

  ticketSetupMessageId(v) {
    if (!isSnowflakeOrNull(v)) return 'ticketSetupMessageId must be a valid message ID';
    return true;
  },

  ticketMaxOpen(v) {
    if (!isBoundedInt(v, 1, 50)) return 'ticketMaxOpen must be 1-50';
    return true;
  },

  ticketOpenMessage(v) {
    if (v !== null && !isBoundedString(v, 1000)) return 'ticketOpenMessage must be under 1000 characters';
    return true;
  },

  ticketEmoji(v) {
    if (!isBoundedString(v, 64)) return 'ticketEmoji must be under 64 characters';
    return true;
  },

  ticketSupportRoleIds(v) {
    if (!isSnowflakeArray(v, 25)) return 'ticketSupportRoleIds must be an array of up to 25 role IDs';
    return true;
  },

  blacklistedChannels(v) {
    if (!isSnowflakeArray(v, 50)) return 'blacklistedChannels must be an array of channel IDs';
    return true;
  },

  honeypotChannels(v) {
    if (!isSnowflakeArray(v, 20)) return 'honeypotChannels must be an array of channel IDs';
    return true;
  },

  lockdownRoles(v) {
    if (!isSnowflakeArray(v, 50)) return 'lockdownRoles must be an array of role IDs';
    return true;
  },

  lockdownAllowedRoles(v) {
    if (!isSnowflakeArray(v, 50)) return 'lockdownAllowedRoles must be an array of role IDs';
    return true;
  },

  lockdownAllowedUsers(v) {
    if (!isSnowflakeArray(v, 50)) return 'lockdownAllowedUsers must be an array of user IDs';
    return true;
  },

  slowmodeAllowedRoles(v) {
    if (!isSnowflakeArray(v, 50)) return 'slowmodeAllowedRoles must be an array of role IDs';
    return true;
  },

  commandAllowedRoles(v) {
    if (!isSnowflakeArray(v, 50)) return 'commandAllowedRoles must be an array of role IDs';
    return true;
  },

  disabledCommands(v) {
    if (!Array.isArray(v)) return 'disabledCommands must be an array';
    if (v.length > 100) return 'Maximum 100 disabled commands';
    if (!v.every(c => typeof c === 'string' && c.length <= 50)) {
      return 'Each command name must be under 50 characters';
    }
    return true;
  },

  globalBanEnabled(v) {
    if (typeof v !== 'boolean') return 'globalBanEnabled must be a boolean';
    return true;
  },

  globalBanAutoApply(v) {
    if (typeof v !== 'boolean') return 'globalBanAutoApply must be a boolean';
    return true;
  },

  automodEnabled(v) {
    if (typeof v !== 'boolean') return 'automodEnabled must be a boolean';
    return true;
  },

  raidDisableAutorole(v) {
    if (typeof v !== 'boolean') return 'raidDisableAutorole must be a boolean';
    return true;
  },

  reactionRoleDMEnabled(v) {
    if (typeof v !== 'boolean') return 'reactionRoleDMEnabled must be a boolean';
    return true;
  },

  onboardingComplete(v) {
    if (typeof v !== 'boolean') return 'onboardingComplete must be a boolean';
    return true;
  },

  onboardingStep(v) {
    if (!isBoundedInt(v, 0, 20)) return 'onboardingStep must be 0-20';
    return true;
  },

  starboard(v) {
    return validateStarboardEntry(v);
  },

  starboards(v) {
    if (!Array.isArray(v)) return 'starboards must be an array';
    if (v.length > 3) return 'Cannot have more than 3 starboards';
    for (const entry of v) {
      const res = validateStarboardEntry(entry);
      if (res !== true) return res;
    }
    return true;
  },

  welcomeMessage(v) {
    if (typeof v !== 'object' || v === null || Array.isArray(v)) return 'welcomeMessage must be an object';
    const wm = v as Record<string, unknown>;
    if (wm.enabled !== undefined && typeof wm.enabled !== 'boolean') return 'welcomeMessage.enabled must be boolean';
    if (wm.channelId !== undefined && !isSnowflakeOrNull(wm.channelId)) return 'welcomeMessage.channelId must be a channel ID';
    if (wm.message !== undefined && !isBoundedString(wm.message, 2000)) return 'welcomeMessage.message must be under 2000 characters';
    if (wm.embed !== undefined && typeof wm.embed !== 'object') return 'welcomeMessage.embed must be an object';
    if (wm.dmEnabled !== undefined && typeof wm.dmEnabled !== 'boolean') return 'welcomeMessage.dmEnabled must be boolean';
    if (wm.dmMessage !== undefined && !isBoundedString(wm.dmMessage, 2000)) return 'welcomeMessage.dmMessage must be under 2000 characters';
    return true;
  },

  goodbyeMessage(v) {
    if (typeof v !== 'object' || v === null || Array.isArray(v)) return 'goodbyeMessage must be an object';
    const gm = v as Record<string, unknown>;
    if (gm.enabled !== undefined && typeof gm.enabled !== 'boolean') return 'goodbyeMessage.enabled must be boolean';
    if (gm.channelId !== undefined && !isSnowflakeOrNull(gm.channelId)) return 'goodbyeMessage.channelId must be a channel ID';
    if (gm.message !== undefined && !isBoundedString(gm.message, 2000)) return 'goodbyeMessage.message must be under 2000 characters';
    if (gm.embed !== undefined && typeof gm.embed !== 'object') return 'goodbyeMessage.embed must be an object';
    return true;
  },

  moderation(v) {
    if (typeof v !== 'object' || v === null || Array.isArray(v)) return 'moderation must be an object';
    return true;  // deep-sanitized, Mongoose schema validates shape
  },

  automod(v) {
    if (typeof v !== 'object' || v === null || Array.isArray(v)) return 'automod must be an object';
    return true;
  },

  antiLink(v) {
    if (typeof v !== 'object' || v === null || Array.isArray(v)) return 'antiLink must be an object';
    return true;
  },

  antiSpam(v) {
    if (typeof v !== 'object' || v === null || Array.isArray(v)) return 'antiSpam must be an object';
    return true;
  },

  antiGhostPing(v) {
    if (typeof v !== 'object' || v === null || Array.isArray(v)) return 'antiGhostPing must be an object';
    return true;
  },

  verification(v) {
    if (typeof v !== 'object' || v === null || Array.isArray(v)) return 'verification must be an object';
    return true;
  },

  rss(v) {
    if (typeof v !== 'object' || v === null || Array.isArray(v)) return 'rss must be an object';
    const rss = v as Record<string, unknown>;

    if (rss.enabled !== undefined && typeof rss.enabled !== 'boolean') {
      return 'rss.enabled must be boolean';
    }

    if (
      rss.pollIntervalMinutes !== undefined &&
      !isBoundedInt(rss.pollIntervalMinutes, RSS_MIN_POLL_INTERVAL_MINUTES, 1440)
    ) {
      return `rss.pollIntervalMinutes must be between ${RSS_MIN_POLL_INTERVAL_MINUTES} and 1440`;
    }

    if (rss.feeds !== undefined) {
      if (!Array.isArray(rss.feeds)) return 'rss.feeds must be an array';
      if (rss.feeds.length > RSS_MAX_FEEDS_PER_GUILD) {
        return `rss.feeds can contain at most ${RSS_MAX_FEEDS_PER_GUILD} feeds`;
      }

      for (const entry of rss.feeds) {
        const feedRes = validateRssFeedEntry(entry);
        if (feedRes !== true) return feedRes;
      }
    }

    if (rss.pollIntervalMinutes === undefined && rss.feeds !== undefined && rss.enabled === true) {
      if (!isBoundedInt(RSS_DEFAULT_POLL_INTERVAL_MINUTES, RSS_MIN_POLL_INTERVAL_MINUTES, 1440)) {
        return 'rss.pollIntervalMinutes default is invalid';
      }
    }

    return true;
  },

  reactionRoles(v) {
    if (!Array.isArray(v)) return 'reactionRoles must be an array';
    if (v.length > 50) return 'Maximum 50 reaction role panels';
    return true;
  },

  customCommands(v) {
    if (!Array.isArray(v)) return 'customCommands must be an array';
    if (v.length > CUSTOM_COMMAND_MAX_PER_GUILD) {
      return `Maximum ${CUSTOM_COMMAND_MAX_PER_GUILD} custom commands`;
    }

    const names = new Set<string>();

    for (const cmd of v) {
      if (typeof cmd !== 'object' || cmd === null) return 'Each custom command must be an object';
      const c = cmd as Record<string, unknown>;

      if (typeof c.name !== 'string' || !CUSTOM_COMMAND_NAME_RE.test(c.name.trim().toLowerCase())) {
        return 'Custom command name must be 1-32 chars and use a-z, 0-9, - or _';
      }

      const normalizedName = c.name.trim().toLowerCase();
      if (names.has(normalizedName)) {
        return 'Custom command names must be unique';
      }
      names.add(normalizedName);

      if (typeof c.response !== 'string' || c.response.trim().length === 0) {
        return 'Custom command response must be a non-empty string';
      }

      if (c.response.length > 2000) return 'Custom command response must be under 2000 characters';

      if (c.embed !== undefined && typeof c.embed !== 'boolean') {
        return 'customCommands[].embed must be boolean';
      }

      if (c.color !== undefined && c.color !== null) {
        if (typeof c.color !== 'string' || !CUSTOM_COMMAND_COLOR_RE.test(c.color)) {
          return 'customCommands[].color must be a valid 6-digit hex color';
        }
      }

      if (c.title !== undefined && c.title !== null && !isBoundedString(c.title, 256)) {
        return 'customCommands[].title must be under 256 characters';
      }

      if (c.enabled !== undefined && typeof c.enabled !== 'boolean') {
        return 'customCommands[].enabled must be boolean';
      }

      const actionType = typeof c.actionType === 'string' ? c.actionType : 'reply';
      if (c.actionType !== undefined && !CUSTOM_COMMAND_ACTION_VALUES.has(actionType)) {
        return 'customCommands[].actionType is invalid';
      }

      if (c.targetRoleId !== undefined && !isSnowflakeOrNull(c.targetRoleId)) {
        return 'customCommands[].targetRoleId must be a valid role ID';
      }

      if (actionType === 'toggleRole' && !isSnowflake(c.targetRoleId)) {
        return 'customCommands[].targetRoleId is required for toggleRole action';
      }

      if (c.requiredRoleIds !== undefined && !isSnowflakeArray(c.requiredRoleIds, 10)) {
        return 'customCommands[].requiredRoleIds must be an array of up to 10 role IDs';
      }

      if (c.allowedChannelIds !== undefined && !isSnowflakeArray(c.allowedChannelIds, 25)) {
        return 'customCommands[].allowedChannelIds must be an array of up to 25 channel IDs';
      }

      if (c.requiredPermission !== undefined && c.requiredPermission !== null) {
        if (typeof c.requiredPermission !== 'string' || !CUSTOM_COMMAND_PERMISSION_VALUES.has(c.requiredPermission)) {
          return 'customCommands[].requiredPermission is invalid';
        }
      }

      if (c.cooldownSeconds !== undefined && !isBoundedInt(c.cooldownSeconds, 0, 3600)) {
        return 'customCommands[].cooldownSeconds must be between 0 and 3600';
      }

      if (c.deleteTrigger !== undefined && typeof c.deleteTrigger !== 'boolean') {
        return 'customCommands[].deleteTrigger must be boolean';
      }
    }
    return true;
  },

  keywordWarnings(v) {
    if (typeof v !== 'object' || v === null || Array.isArray(v)) {
      return 'keywordWarnings must be an object';
    }

    const kw = v as Record<string, unknown>;

    if (kw.enabled !== undefined && typeof kw.enabled !== 'boolean') {
      return 'keywordWarnings.enabled must be boolean';
    }

    if (
      kw.action !== undefined &&
      kw.action !== 'delete' &&
      kw.action !== 'warn' &&
      kw.action !== 'delete+warn'
    ) {
      return 'keywordWarnings.action must be delete, warn, or delete+warn';
    }

    if (kw.keywords !== undefined) {
      if (!Array.isArray(kw.keywords)) return 'keywordWarnings.keywords must be an array';
      if (kw.keywords.length > 50) return 'Maximum 50 keyword warnings';

      for (const entry of kw.keywords) {
        if (typeof entry !== 'object' || entry === null || Array.isArray(entry)) {
          return 'Each keyword warning must be an object';
        }

        const keyword = entry as Record<string, unknown>;

        if (!isBoundedString(keyword.pattern, 200) || (keyword.pattern as string).trim().length === 0) {
          return 'keywordWarnings.keywords[].pattern must be a non-empty string under 200 characters';
        }

        if (keyword.isRegex !== undefined && typeof keyword.isRegex !== 'boolean') {
          return 'keywordWarnings.keywords[].isRegex must be boolean';
        }

        if (keyword.label !== undefined && keyword.label !== null && !isBoundedString(keyword.label, 100)) {
          return 'keywordWarnings.keywords[].label must be under 100 characters';
        }

        if (keyword.addedBy !== undefined && keyword.addedBy !== null && !isBoundedString(keyword.addedBy, 64)) {
          return 'keywordWarnings.keywords[].addedBy must be under 64 characters';
        }
      }
    }

    return true;
  },

  logChannelOverrides(v) {
    if (typeof v !== 'object' || v === null || Array.isArray(v)) return 'logChannelOverrides must be an object';
    const overrides = v as Record<string, unknown>;
    for (const [key, val] of Object.entries(overrides)) {
      if (key.length > 50) return 'logChannelOverrides key too long';
      if (!isSnowflakeOrNull(val)) return `logChannelOverrides.${key} must be a valid channel ID`;
    }
    return true;
  },

  disabledLogEvents(v) {
    if (!Array.isArray(v)) return 'disabledLogEvents must be an array';
    if (v.length > 50) return 'Maximum 50 disabled log events';
    if (!v.every(e => typeof e === 'string' && e.length <= 50)) return 'Each event name must be under 50 characters';
    return true;
  },
};

export function validateSettingsUpdate(raw: Record<string, unknown>): ValidationResult {
  const errors: string[] = [];
  const sanitized: Record<string, unknown> = {};

  for (const [key, rawValue] of Object.entries(raw)) {
    const value = deepSanitize(rawValue);

    const validator = fieldValidators[key];
    if (validator) {
      const result = validator(value);
      if (result !== true) {
        errors.push(result);
        continue;
      }
    }

    sanitized[key] = value;
  }

  return {
    valid: errors.length === 0,
    errors,
    sanitized,
  };
}
