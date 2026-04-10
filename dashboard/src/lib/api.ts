import { GlitchTip } from './glitchtip';

const API_BASE = '/api';

const responseCache = new Map<string, { data: unknown; ts: number }>();
const CACHE_TTL = 30_000;

function getCached<T>(key: string): T | undefined {
  const entry = responseCache.get(key);
  if (entry && Date.now() - entry.ts < CACHE_TTL) return entry.data as T;
  if (entry) responseCache.delete(key);
  return undefined;
}

function setCache(key: string, data: unknown): void {
  responseCache.set(key, { data, ts: Date.now() });
  if (responseCache.size > 100) {
    const now = Date.now();
    for (const [k, v] of responseCache) {
      if (now - v.ts > CACHE_TTL) responseCache.delete(k);
    }
  }
}

export function invalidateCache(pathPrefix?: string): void {
  if (!pathPrefix) {
    responseCache.clear();
    return;
  }
  for (const key of responseCache.keys()) {
    if (key.startsWith(pathPrefix)) responseCache.delete(key);
  }
}

export class ApiError extends Error {
  status: number;
  details?: string[];

  constructor(message: string, status: number, details?: string[]) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.details = details;
  }
}

async function request<T>(path: string, options: RequestInit = {}): Promise<T> {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(options.headers as Record<string, string>),
  };

  const res = await fetch(`${API_BASE}${path}`, {
    ...options,
    headers,
    credentials: 'include',
  });

  if (!res.ok) {
    const body = (await res.json().catch(() => ({ error: res.statusText }))) as {
      error?: string;
      details?: string[];
      [key: string]: unknown;
    };
    const details = Array.isArray(body.details) ? body.details : undefined;
    const error = new ApiError(body.error || `HTTP ${res.status}`, res.status, details);

    if (res.status !== 401 && res.status !== 403) {
      GlitchTip.captureException(error, {
        tags: { api_path: path, status: res.status },
        contexts: { response: { status: res.status, body } },
      });
    }

    throw error;
  }

  return res.json() as Promise<T>;
}

export const api = {
  get: <T>(path: string, { skipCache = false }: { skipCache?: boolean } = {}) => {
    if (!skipCache) {
      const cached = getCached<T>(path);
      if (cached !== undefined) return Promise.resolve(cached);
    }
    return request<T>(path).then((data) => {
      setCache(path, data);
      return data;
    });
  },
  post: <T>(path: string, body?: unknown) =>
    request<T>(path, { method: 'POST', body: body ? JSON.stringify(body) : undefined }),
  patch: <T>(path: string, body: unknown) =>
    request<T>(path, { method: 'PATCH', body: JSON.stringify(body) }).then((data) => {
      const base = path.replace(/\/[^/]+$/, '');
      invalidateCache(base);
      return data;
    }),
  delete: <T>(path: string) =>
    request<T>(path, { method: 'DELETE' }).then((data) => {
      const base = path.replace(/\/[^/]+$/, '');
      invalidateCache(base);
      return data;
    }),
};

export interface BotInfo {
  id: string | null;
  username: string | null;
  avatar: string | null;
  guilds: number;
  uptime: number;
  readyAt: string | null;
  memoryMB: number;
}

export interface GuildSummary {
  id: string;
  name: string;
  icon: string | null;
  botPresent?: boolean;
}

export interface GuildDetail extends GuildSummary {
  ownerId: string | null;
  channels: Array<{ id: string; name: string; type: number; parent_id: string | null; position: number }>;
  roles: Array<{ id: string; name: string; color: number; position: number }>;
  emojis: Array<{ id: string; name: string; animated: boolean; url?: string | null }>;
}

export interface HealthInfo {
  status: string;
  uptime: number;
  readyAt: string | null;
  online: boolean;
}

export interface ProcessInfo {
  cpu: number;
  memoryMB: number;
  memoryTotalMB: number;
  rssMB: number;
  uptime: number;
  pid: number;
  nodeVersion: string;
}

export interface UserInfo {
  id: string;
  username: string;
  avatar: string | null;
  isOwner: boolean;
}

export interface LogEntry {
  level: string;
  tag: string;
  message: string;
  timestamp: number;
}

export interface LogsResponse {
  entries: LogEntry[];
  total: number;
}

export interface KeywordEntry {
  pattern: string;
  isRegex: boolean;
  label: string | null;
  addedBy: string | null;
}

export interface KeywordWarnings {
  enabled: boolean;
  action: 'delete' | 'warn' | 'delete+warn';
  keywords: KeywordEntry[];
}

export interface HoneypotEntry {
  channelId: string;
  action: 'ban' | 'kick' | 'timeout' | 'role';
  enabled: boolean;
  banDeleteDays: number;
  timeoutHours: number;
  roleId: string | null;
}

export interface WelcomeCard {
  preset: string | null;
  bgColor1: string | null;
  bgColor2: string | null;
  bgColor3: string | null;
  accentColor: string | null;
  textColor: string | null;
  subtextColor: string | null;
  countColor: string | null;
  greetingText: string | null;
  subtitle: string | null;
  showMemberCount: boolean;
  bgImageURL: string | null;
}

export interface WelcomeEmbed {
  enabled: boolean;
  title: string | null;
  description: string | null;
  color: string | null;
  footer: string | null;
  thumbnail: boolean;
}

export interface WelcomeDM {
  enabled: boolean;
  message: string | null;
  imageEnabled: boolean;
}

export interface WelcomeMessage {
  enabled: boolean;
  type: 'none' | 'preset' | 'custom';
  channelId: string | null;
  message: string | null;
  preset: string | null;
  imageEnabled: boolean;
  card: WelcomeCard;
  embed: WelcomeEmbed;
  dm: WelcomeDM;
  showRole: boolean;
  trigger: 'join' | 'role';
  triggerRoleId: string | null;
}

export interface ReactionRoleEntry {
  emoji: string;
  roleId: string;
  removeRoleId?: string | null;
}

export interface ReactionRole {
  messageId: string;
  channelId: string;
  roles: ReactionRoleEntry[];
}

export interface Moderation {
  muteRoleId: string | null;
  logChannelId: string | null;
  autoMute: boolean;
  autoMuteThreshold: number;
  muteMethod: 'auto' | 'timeout' | 'mute_role';
}

export type CustomCommandPermission =
  | 'Administrator'
  | 'ManageGuild'
  | 'ManageRoles'
  | 'ManageChannels'
  | 'ManageMessages'
  | 'KickMembers'
  | 'BanMembers'
  | 'ModerateMembers';

export type CustomCommandActionType = 'reply' | 'toggleRole';

export interface CustomCommand {
  name: string;
  response: string;
  embed: boolean;
  color: string | null;
  title: string | null;
  enabled: boolean;
  actionType: CustomCommandActionType;
  targetRoleId: string | null;
  requiredRoleIds: string[];
  requiredPermission: CustomCommandPermission | null;
  allowedChannelIds: string[];
  cooldownSeconds: number;
  deleteTrigger: boolean;
}

export interface AutomodSpam {
  maxMessages: number;
  timeWindow: number;
  timeoutDuration: number;
  violationThreshold: number;
}

export interface AutomodRaid {
  userThreshold: number;
  timeWindow: number;
}

export type AutomodLevel = 'off' | 'minimal' | 'medium' | 'high';

export interface Automod {
  level: AutomodLevel;
  antiSpam: boolean;
  antiLink: boolean;
  antiReactionSpam: boolean;
  ghostPing: boolean;
  maxMentions: number;
  maxLines: number;
  spam: AutomodSpam;
  raid: AutomodRaid;
  allowedDomains: string[];
  exemptRoles: string[];
  exemptChannels: string[];
}

export interface GoodbyeEmbed {
  enabled: boolean;
  title: string | null;
  description: string | null;
  color: string | null;
  footer: string | null;
}

export interface GoodbyeMessage {
  enabled: boolean;
  channelId: string | null;
  message: string | null;
  embed: GoodbyeEmbed;
}

export interface LogChannelOverrides {
  member: string | null;
  voice: string | null;
  message: string | null;
  role: string | null;
  channel: string | null;
  reaction: string | null;
  server: string | null;
}

export interface Verification {
  enabled: boolean;
  categoryId: string | null;
  verifiedRoleId: string | null;
  panelChannelId: string | null;
  panelMessageId: string | null;
  logChannelId: string | null;
  maxAttempts: number;
}

export type RssSourceType = 'rss' | 'rsshub';

export interface RssFeed {
  id: string;
  name: string | null;
  sourceType: RssSourceType;
  url: string | null;
  route: string | null;
  channelId: string;
  mentionRoleId: string | null;
  webhookId: string | null;
  webhookToken: string | null;
  webhookName: string | null;
  enabled: boolean;
  maxItemsPerPoll: number;
  includeSummary: boolean;
  includeImage: boolean;
  format: 'embed' | 'text';
}

export interface RssSettings {
  enabled: boolean;
  pollIntervalMinutes: number;
  feeds: RssFeed[];
}

export interface Starboard {
  enabled: boolean;
  channelId: string | null;
  threshold: number;
  emoji: string;
  selfStarEnabled: boolean;
  ignoreBots: boolean;
  ignoredChannels: string[];
  ignoredRoles: string[];
}

export interface GuildSettings {
  guildId: string;
  prefixes: string[];
  welcomeMessage: WelcomeMessage;
  reactionRoles: ReactionRole[];
  moderation: Moderation;
  automod: Automod;
  logChannelId: string | null;
  muteRoleId: string | null;
  prefix: string | null;
  autoroleId: string | null;
  raidDisableAutorole: boolean;
  staffChannelId: string | null;
  staffRoleId: string | null;
  staffInboxChannelId: string | null;
  keywordWarnings: KeywordWarnings;
  honeypotChannels: HoneypotEntry[];
  honeypotAlertRoleId: string | null;
  serverLogChannelId: string | null;
  logChannelOverrides: LogChannelOverrides;
  disabledLogEvents: string[];
  blacklistedChannels: string[];
  ticketCategoryId: string | null;
  ticketSupportRoleId: string | null;
  ticketSupportRoleIds: string[];
  ticketLogChannelId: string | null;
  ticketMaxOpen: number;
  ticketOpenMessage: string | null;
  ticketSetupChannelId: string | null;
  ticketSetupMessageId: string | null;
  ticketEmoji: string;
  customCommands: CustomCommand[];
  reactionRoleDMEnabled: boolean;
  goodbyeMessage: GoodbyeMessage;
  lockdownRoles: string[];
  lockdownAllowedRoles: string[];
  lockdownAllowedUsers: string[];
  slowmodeAllowedRoles: string[];
  commandAllowedRoles: string[];
  disabledCommands: string[];
  verification: Verification;
  rss: RssSettings;
  starboards: Starboard[];
  starboard: Starboard;
}

export function normalizeSettings(s: Partial<GuildSettings> & { guildId: string }): GuildSettings {
  const wm = (s.welcomeMessage ?? {}) as Partial<WelcomeMessage>;
  const am = (s.automod ?? {}) as Partial<Automod>;
  const mod = (s.moderation ?? {}) as Partial<Moderation>;
  const kw = (s.keywordWarnings ?? {}) as Partial<KeywordWarnings>;
  const gm = (s.goodbyeMessage ?? {}) as Partial<GoodbyeMessage>;
  const rss = ((s as any).rss ?? {}) as Partial<RssSettings>;
  const normalizeBoard = (raw: any): Starboard => ({
    enabled: !!raw?.enabled,
    channelId: raw?.channelId ?? null,
    threshold: typeof raw?.threshold === 'number' ? raw.threshold : 3,
    emoji: typeof raw?.emoji === 'string' ? raw.emoji : '⭐',
    selfStarEnabled: !!raw?.selfStarEnabled,
    ignoreBots: raw?.ignoreBots === false ? false : true,
    ignoredChannels: Array.isArray(raw?.ignoredChannels) ? raw.ignoredChannels : [],
    ignoredRoles: Array.isArray(raw?.ignoredRoles) ? raw.ignoredRoles : [],
  });

  const rawBoards = Array.isArray((s as any).starboards) ? (s as any).starboards : [];
  const boards = rawBoards.map(normalizeBoard).slice(0, 3);
  const primaryBoard = boards[0] ?? normalizeBoard((s as any).starboard ?? {});
  const starboards = boards.length > 0 ? boards : [primaryBoard];
  const rssFeeds = Array.isArray(rss.feeds) ? rss.feeds : [];
  const rawCustomCommands = Array.isArray(s.customCommands) ? s.customCommands : [];

  const normalizedRssFeeds: RssFeed[] = rssFeeds.slice(0, 5).map((feed: any, idx: number) => ({
    id: typeof feed?.id === 'string' && feed.id.trim().length > 0 ? feed.id : `feed-${idx + 1}`,
    name: typeof feed?.name === 'string' && feed.name.trim().length > 0 ? feed.name.trim() : null,
    sourceType: feed?.sourceType === 'rsshub' ? 'rsshub' : 'rss',
    url: typeof feed?.url === 'string' ? feed.url : null,
    route: typeof feed?.route === 'string' ? feed.route : null,
    channelId: typeof feed?.channelId === 'string' ? feed.channelId : '',
    mentionRoleId: typeof feed?.mentionRoleId === 'string' ? feed.mentionRoleId : null,
    webhookId: typeof feed?.webhookId === 'string' ? feed.webhookId : null,
    webhookToken: typeof feed?.webhookToken === 'string' ? feed.webhookToken : null,
    webhookName: typeof feed?.webhookName === 'string' ? feed.webhookName : null,
    enabled: feed?.enabled !== false,
    maxItemsPerPoll:
      typeof feed?.maxItemsPerPoll === 'number' ? Math.max(1, Math.min(10, Math.floor(feed.maxItemsPerPoll))) : 3,
    includeSummary: feed?.includeSummary !== false,
    includeImage: feed?.includeImage !== false,
    format: feed?.format === 'text' ? 'text' : 'embed',
  }));

  const normalizedCustomCommands: CustomCommand[] = rawCustomCommands.slice(0, 5).map((cmd: any) => ({
    name: typeof cmd?.name === 'string' ? cmd.name.trim().toLowerCase() : '',
    response: typeof cmd?.response === 'string' ? cmd.response : '',
    embed: !!cmd?.embed,
    color: typeof cmd?.color === 'string' ? cmd.color : null,
    title: typeof cmd?.title === 'string' ? cmd.title : null,
    enabled: cmd?.enabled !== false,
    actionType: cmd?.actionType === 'toggleRole' ? 'toggleRole' : 'reply',
    targetRoleId: typeof cmd?.targetRoleId === 'string' ? cmd.targetRoleId : null,
    requiredRoleIds: Array.isArray(cmd?.requiredRoleIds)
      ? cmd.requiredRoleIds.filter((id: unknown) => typeof id === 'string')
      : [],
    requiredPermission: typeof cmd?.requiredPermission === 'string' ? cmd.requiredPermission : null,
    allowedChannelIds: Array.isArray(cmd?.allowedChannelIds)
      ? cmd.allowedChannelIds.filter((id: unknown) => typeof id === 'string')
      : [],
    cooldownSeconds:
      typeof cmd?.cooldownSeconds === 'number' ? Math.max(0, Math.min(3600, Math.floor(cmd.cooldownSeconds))) : 0,
    deleteTrigger: !!cmd?.deleteTrigger,
  }));

  return {
    guildId: s.guildId,
    prefixes: s.prefixes ?? [],
    prefix: s.prefix ?? null,
    logChannelId: s.logChannelId ?? null,
    muteRoleId: s.muteRoleId ?? null,
    autoroleId: s.autoroleId ?? null,
    raidDisableAutorole: s.raidDisableAutorole ?? false,
    staffChannelId: s.staffChannelId ?? null,
    staffRoleId: s.staffRoleId ?? null,
    staffInboxChannelId: s.staffInboxChannelId ?? null,
    serverLogChannelId: s.serverLogChannelId ?? null,
    logChannelOverrides: {
      member: (s as any).logChannelOverrides?.member ?? null,
      voice: (s as any).logChannelOverrides?.voice ?? null,
      message: (s as any).logChannelOverrides?.message ?? null,
      role: (s as any).logChannelOverrides?.role ?? null,
      channel: (s as any).logChannelOverrides?.channel ?? null,
      reaction: (s as any).logChannelOverrides?.reaction ?? null,
      server: (s as any).logChannelOverrides?.server ?? null,
    },
    disabledLogEvents: s.disabledLogEvents ?? [],
    blacklistedChannels: s.blacklistedChannels ?? [],
    honeypotChannels: s.honeypotChannels ?? [],
    honeypotAlertRoleId: s.honeypotAlertRoleId ?? null,
    reactionRoles: s.reactionRoles ?? [],
    reactionRoleDMEnabled: s.reactionRoleDMEnabled ?? false,
    customCommands: normalizedCustomCommands,
    goodbyeMessage: {
      enabled: gm.enabled ?? false,
      channelId: gm.channelId ?? null,
      message: gm.message ?? null,
      embed: {
        enabled: gm.embed?.enabled ?? false,
        title: gm.embed?.title ?? null,
        description: gm.embed?.description ?? null,
        color: gm.embed?.color ?? null,
        footer: gm.embed?.footer ?? null,
      },
    },

    lockdownRoles: s.lockdownRoles ?? [],
    lockdownAllowedRoles: s.lockdownAllowedRoles ?? [],
    lockdownAllowedUsers: s.lockdownAllowedUsers ?? [],
    slowmodeAllowedRoles: s.slowmodeAllowedRoles ?? [],
    commandAllowedRoles: s.commandAllowedRoles ?? [],
    disabledCommands: (s as any).disabledCommands ?? [],
    ticketCategoryId: s.ticketCategoryId ?? null,
    ticketSupportRoleId: s.ticketSupportRoleId ?? null,
    ticketSupportRoleIds: s.ticketSupportRoleIds ?? [],
    ticketLogChannelId: s.ticketLogChannelId ?? null,
    ticketMaxOpen: s.ticketMaxOpen ?? 3,
    ticketOpenMessage: s.ticketOpenMessage ?? null,
    ticketSetupChannelId: s.ticketSetupChannelId ?? null,
    ticketSetupMessageId: s.ticketSetupMessageId ?? null,
    ticketEmoji: s.ticketEmoji ?? '🎫',

    welcomeMessage: {
      enabled: wm.enabled ?? false,
      type: wm.type ?? 'none',
      channelId: wm.channelId ?? null,
      message: wm.message ?? null,
      preset: wm.preset ?? null,
      imageEnabled: wm.imageEnabled ?? false,
      showRole: wm.showRole ?? false,
      trigger: wm.trigger ?? 'join',
      triggerRoleId: wm.triggerRoleId ?? null,
      card: {
        preset: wm.card?.preset ?? null,
        bgColor1: wm.card?.bgColor1 ?? null,
        bgColor2: wm.card?.bgColor2 ?? null,
        bgColor3: wm.card?.bgColor3 ?? null,
        accentColor: wm.card?.accentColor ?? null,
        textColor: wm.card?.textColor ?? null,
        subtextColor: wm.card?.subtextColor ?? null,
        countColor: wm.card?.countColor ?? null,
        greetingText: wm.card?.greetingText ?? null,
        subtitle: wm.card?.subtitle ?? null,
        showMemberCount: wm.card?.showMemberCount ?? true,
        bgImageURL: wm.card?.bgImageURL ?? null,
      },
      embed: {
        enabled: wm.embed?.enabled ?? false,
        title: wm.embed?.title ?? null,
        description: wm.embed?.description ?? null,
        color: wm.embed?.color ?? null,
        footer: wm.embed?.footer ?? null,
        thumbnail: wm.embed?.thumbnail ?? false,
      },
      dm: {
        enabled: wm.dm?.enabled ?? false,
        message: wm.dm?.message ?? null,
        imageEnabled: wm.dm?.imageEnabled ?? false,
      },
    },

    automod: {
      level: am.level ?? 'off',
      antiSpam: am.antiSpam ?? false,
      antiLink: am.antiLink ?? false,
      antiReactionSpam: am.antiReactionSpam ?? false,
      ghostPing: am.ghostPing ?? false,
      maxMentions: am.maxMentions ?? 0,
      maxLines: am.maxLines ?? 0,
      allowedDomains: am.allowedDomains ?? [],
      exemptRoles: am.exemptRoles ?? [],
      exemptChannels: am.exemptChannels ?? [],
      spam: {
        maxMessages: am.spam?.maxMessages ?? 5,
        timeWindow: am.spam?.timeWindow ?? 5,
        timeoutDuration: am.spam?.timeoutDuration ?? 10,
        violationThreshold: am.spam?.violationThreshold ?? 3,
      },
      raid: {
        userThreshold: (am as any).raid?.userThreshold ?? 5,
        timeWindow: (am as any).raid?.timeWindow ?? 10,
      },
    },

    moderation: {
      muteRoleId: mod.muteRoleId ?? null,
      logChannelId: mod.logChannelId ?? null,
      autoMute: mod.autoMute ?? false,
      autoMuteThreshold: mod.autoMuteThreshold ?? 3,
      muteMethod: (mod.muteMethod as any) ?? 'auto',
    },

    keywordWarnings: {
      enabled: kw.enabled ?? false,
      action: kw.action ?? 'delete',
      keywords: kw.keywords ?? [],
    },

    verification: {
      enabled: (s as any).verification?.enabled ?? false,
      categoryId: (s as any).verification?.categoryId ?? null,
      verifiedRoleId: (s as any).verification?.verifiedRoleId ?? null,
      panelChannelId: (s as any).verification?.panelChannelId ?? null,
      panelMessageId: (s as any).verification?.panelMessageId ?? null,
      logChannelId: (s as any).verification?.logChannelId ?? null,
      maxAttempts: (s as any).verification?.maxAttempts ?? 2,
    },

    rss: {
      enabled: rss.enabled ?? false,
      pollIntervalMinutes:
        typeof rss.pollIntervalMinutes === 'number'
          ? Math.max(10, Math.min(1440, Math.floor(rss.pollIntervalMinutes)))
          : 15,
      feeds: normalizedRssFeeds,
    },

    starboards,
    starboard: primaryBoard,
  };
}

export interface DailyStat {
  date: string;
  count: number;
}

export interface TopCommand {
  command: string;
  count: number;
}

export interface TopGuild {
  guildId: string;
  name: string;
  count: number;
}

export interface StatsTotals {
  totalCommands: number;
  totalModActions: number;
}

export interface ModerationLogEntry {
  _id: string;
  guildId: string;
  userId: string;
  targetId: string;
  action: string;
  reason: string;
  duration: number | null;
  metadata: Record<string, unknown>;
  timestamp: string;
  caseNumber?: number;
}

export interface ModerationLogsResponse {
  logs: ModerationLogEntry[];
  total: number;
}
