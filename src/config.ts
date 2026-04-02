import dotenv from 'dotenv';
import type { BotConfig } from './types';
import {
  RSS_DEFAULT_POLL_INTERVAL_MINUTES,
  RSS_MAX_FEEDS_PER_GUILD,
  RSS_MIN_POLL_INTERVAL_MINUTES,
} from './utils/rssDefaults';

dotenv.config();

const config: BotConfig = {
  token: process.env.TOKEN || '',
  prefix: process.env.PREFIX || '!',
  ownerId: process.env.OWNER_ID || null,
  mongoUri: process.env.MONGO_URI || '',
  logLevel: process.env.LOG_LEVEL || 'info',
  cooldown: {
    default: parseInt(process.env.COOLDOWN_DEFAULT || '3000', 10),
  },
  automod: {
    maxMessages: parseInt(process.env.AUTOMOD_MAX_MESSAGES || '5', 10),
    timeWindow: parseInt(process.env.AUTOMOD_TIME_WINDOW || '5', 10),
    muteDuration: parseInt(process.env.AUTOMOD_MUTE_DURATION || '10', 10),
  },
  api: {
    enabled: process.env.API_ENABLED === 'true',
    port: parseInt(process.env.API_PORT || '4000', 10),
    adminToken: process.env.API_ADMIN_TOKEN || null,
    dashboardUrl: process.env.DASHBOARD_URL || null,
  },
  fluxerOAuth: {
    clientId: process.env.FLUXER_OAUTH_CLIENT_ID || null,
    clientSecret: process.env.FLUXER_OAUTH_CLIENT_SECRET || null,
    redirectUri: process.env.FLUXER_OAUTH_REDIRECT_URI || null,
  },
  rss: {
    enabled: process.env.RSS_ENABLED !== 'false',
    defaultPollIntervalMinutes: parseInt(process.env.RSS_DEFAULT_POLL_INTERVAL_MINUTES || String(RSS_DEFAULT_POLL_INTERVAL_MINUTES), 10),
    minPollIntervalMinutes: parseInt(process.env.RSS_MIN_POLL_INTERVAL_MINUTES || String(RSS_MIN_POLL_INTERVAL_MINUTES), 10),
    maxFeedsPerGuild: parseInt(process.env.RSS_MAX_FEEDS_PER_GUILD || String(RSS_MAX_FEEDS_PER_GUILD), 10),
    fetchTimeoutMs: parseInt(process.env.RSS_FETCH_TIMEOUT_MS || '10000', 10),
    maxBodyBytes: parseInt(process.env.RSS_MAX_BODY_BYTES || String(1024 * 1024), 10),
    maxConcurrentFetches: parseInt(process.env.RSS_MAX_CONCURRENT_FETCHES || '8', 10),
    rsshubBaseUrl: process.env.RSSHUB_BASE_URL || 'https://rsshub.app',
    rsshubAccessKey: process.env.RSSHUB_ACCESS_KEY || null,
  },
  glitchtip: {
    dsn: process.env.GLITCHTIP_DSN || null,
    environment: process.env.GLITCHTIP_ENVIRONMENT || process.env.NODE_ENV || 'production',
  },
  validate(): boolean {
    const required: [string, string][] = [
      ['TOKEN', this.token],
      ['MONGO_URI', this.mongoUri],
    ];

    let valid = true;
    for (const [name, value] of required) {
      if (!value) {
        console.error(`Missing required environment variable: ${name}`);
        valid = false;
      }
    }

    return valid;
  },
};

export default config;
