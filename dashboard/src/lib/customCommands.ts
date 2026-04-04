import type { CustomCommand, CustomCommandActionType, CustomCommandPermission } from './api';

export const CUSTOM_COMMAND_MAX_COUNT = 5;
export const CUSTOM_COMMAND_MAX_RESPONSE_LENGTH = 2000;
export const CUSTOM_COMMAND_MAX_COOLDOWN_SECONDS = 3600;
export const CUSTOM_COMMAND_MAX_ROLE_GATES = 10;
export const CUSTOM_COMMAND_MAX_CHANNEL_GATES = 25;

const CUSTOM_COMMAND_NAME_RE = /^[a-z0-9_-]{1,32}$/;
const CUSTOM_COMMAND_COLOR_RE = /^#?[0-9a-fA-F]{6}$/;
const SNOWFLAKE_RE = /^\d{17,20}$/;

export const CUSTOM_COMMAND_PERMISSION_OPTIONS: Array<{
  value: CustomCommandPermission;
  label: string;
  description: string;
}> = [
  { value: 'ManageGuild', label: 'Manage Server', description: 'Requires Manage Server permission' },
  { value: 'ManageRoles', label: 'Manage Roles', description: 'Requires Manage Roles permission' },
  { value: 'ManageChannels', label: 'Manage Channels', description: 'Requires Manage Channels permission' },
  { value: 'ManageMessages', label: 'Manage Messages', description: 'Requires Manage Messages permission' },
  { value: 'ModerateMembers', label: 'Moderate Members', description: 'Requires Moderate Members permission' },
  { value: 'KickMembers', label: 'Kick Members', description: 'Requires Kick Members permission' },
  { value: 'BanMembers', label: 'Ban Members', description: 'Requires Ban Members permission' },
  { value: 'Administrator', label: 'Administrator', description: 'Requires Administrator permission' },
];

export const CUSTOM_COMMAND_ACTION_OPTIONS: Array<{
  value: CustomCommandActionType;
  label: string;
  description: string;
}> = [
  {
    value: 'reply',
    label: 'Reply Message',
    description: 'Sends a configurable text/embed response.',
  },
  {
    value: 'toggleRole',
    label: 'Toggle Role On Mentioned User',
    description: 'Expects a mentioned user and adds/removes the configured role.',
  },
];

const CUSTOM_COMMAND_PERMISSION_SET = new Set<CustomCommandPermission>(
  CUSTOM_COMMAND_PERMISSION_OPTIONS.map(option => option.value),
);

const CUSTOM_COMMAND_ACTION_SET = new Set<CustomCommandActionType>(
  CUSTOM_COMMAND_ACTION_OPTIONS.map(option => option.value),
);

function unique<T>(items: T[]): T[] {
  return Array.from(new Set(items));
}

function normalizeSnowflakeArray(values: unknown, maxItems: number): string[] {
  if (!Array.isArray(values)) return [];
  const cleaned = values
    .filter((value): value is string => typeof value === 'string')
    .map(value => value.trim())
    .filter(value => SNOWFLAKE_RE.test(value));

  return unique(cleaned).slice(0, maxItems);
}

function normalizeColor(color: unknown): string | null {
  if (typeof color !== 'string') return null;
  const trimmed = color.trim();
  if (!trimmed) return null;
  if (!CUSTOM_COMMAND_COLOR_RE.test(trimmed)) return null;
  return trimmed.startsWith('#') ? trimmed : `#${trimmed}`;
}

function normalizeSnowflake(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  const trimmed = value.trim();
  return SNOWFLAKE_RE.test(trimmed) ? trimmed : null;
}

function normalizePermission(value: unknown): CustomCommandPermission | null {
  if (typeof value !== 'string') return null;
  const candidate = value as CustomCommandPermission;
  return CUSTOM_COMMAND_PERMISSION_SET.has(candidate) ? candidate : null;
}

function normalizeActionType(value: unknown): CustomCommandActionType {
  if (typeof value !== 'string') return 'reply';
  const candidate = value as CustomCommandActionType;
  return CUSTOM_COMMAND_ACTION_SET.has(candidate) ? candidate : 'reply';
}

function clampInt(value: unknown, min: number, max: number): number {
  if (typeof value !== 'number' || !Number.isFinite(value)) return min;
  const normalized = Math.floor(value);
  return Math.min(max, Math.max(min, normalized));
}

export function createCustomCommandDraft(): CustomCommand {
  return {
    name: '',
    response: '',
    embed: false,
    color: null,
    title: null,
    enabled: true,
    actionType: 'reply',
    targetRoleId: null,
    requiredRoleIds: [],
    requiredPermission: null,
    allowedChannelIds: [],
    cooldownSeconds: 0,
    deleteTrigger: false,
  };
}

export function buildCustomCommandsSavePayload(commands: CustomCommand[]):
  | { ok: true; payload: CustomCommand[] }
  | { ok: false; error: string } {
  if (!Array.isArray(commands)) {
    return { ok: false, error: 'Custom commands payload is invalid.' };
  }

  if (commands.length > CUSTOM_COMMAND_MAX_COUNT) {
    return { ok: false, error: `You can only save up to ${CUSTOM_COMMAND_MAX_COUNT} custom commands.` };
  }

  const normalized: CustomCommand[] = commands.map((command) => {
    const actionType = normalizeActionType(command.actionType);
    const embed = !!command.embed;
    const title = typeof command.title === 'string' ? command.title.trim() : '';
    const normalizedResponse = command.response.trim();
    const response = normalizedResponse.length > 0
      ? normalizedResponse
      : actionType === 'toggleRole'
        ? '{target}: role {role} was {action}.'
        : '';

    return {
      name: command.name.trim().toLowerCase(),
      response,
      embed,
      color: embed ? normalizeColor(command.color) : null,
      title: embed ? (title.length > 0 ? title.slice(0, 256) : null) : null,
      enabled: command.enabled !== false,
      actionType,
      targetRoleId: actionType === 'toggleRole' ? normalizeSnowflake(command.targetRoleId) : null,
      requiredRoleIds: normalizeSnowflakeArray(command.requiredRoleIds, CUSTOM_COMMAND_MAX_ROLE_GATES),
      requiredPermission: normalizePermission(command.requiredPermission),
      allowedChannelIds: normalizeSnowflakeArray(command.allowedChannelIds, CUSTOM_COMMAND_MAX_CHANNEL_GATES),
      cooldownSeconds: clampInt(command.cooldownSeconds, 0, CUSTOM_COMMAND_MAX_COOLDOWN_SECONDS),
      deleteTrigger: !!command.deleteTrigger,
    };
  });

  const seenNames = new Set<string>();

  for (const command of normalized) {
    if (!CUSTOM_COMMAND_NAME_RE.test(command.name)) {
      return {
        ok: false,
        error: 'Command names must be 1-32 characters using lowercase letters, numbers, hyphens, or underscores.',
      };
    }

    if (seenNames.has(command.name)) {
      return { ok: false, error: `Duplicate custom command name: ${command.name}` };
    }
    seenNames.add(command.name);

    if (!command.response) {
      return { ok: false, error: `Command ${command.name} needs a response message.` };
    }

    if (command.actionType === 'toggleRole' && !command.targetRoleId) {
      return { ok: false, error: `Command ${command.name} needs a role target for toggle action.` };
    }

    if (command.response.length > CUSTOM_COMMAND_MAX_RESPONSE_LENGTH) {
      return {
        ok: false,
        error: `Command ${command.name} response is too long (${command.response.length}/${CUSTOM_COMMAND_MAX_RESPONSE_LENGTH}).`,
      };
    }

    if (command.embed && command.color !== null && !CUSTOM_COMMAND_COLOR_RE.test(command.color)) {
      return {
        ok: false,
        error: `Command ${command.name} has an invalid embed color. Use a 6-digit hex color.`,
      };
    }

    if (command.embed && command.title !== null && command.title.length > 256) {
      return { ok: false, error: `Command ${command.name} embed title must be 256 characters or less.` };
    }
  }

  return { ok: true, payload: normalized };
}
