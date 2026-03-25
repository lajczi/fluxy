export function isPermDenied(error: any): boolean {
  if (!error) return false;
  return (
    error?.code === 50013 ||
    error?.statusCode === 403 ||
    /permissions?/i.test(error?.message || '')
  );
}

export const PERM_MESSAGES = {
  kick: "I don't have permission to kick this user. They may have a higher role than me, or I may lack the **Kick Members** permission in this server. Ask an admin to check the bot's role and permissions.",
  ban: "I don't have permission to ban this user. They may have a higher role than me, or I may lack the **Ban Members** permission in this server. Ask an admin to check the bot's role and permissions.",
  unban: "I don't have permission to unban users in this server. Ask an admin to grant the bot the **Ban Members** permission.",
  timeout: "I don't have permission to timeout this user. They may have a higher role than me, or I may lack the **Moderate Members** permission. Ask an admin to check the bot's role and permissions.",
  mute: "I don't have permission to mute this user. They may have a higher role than me, or I may lack the **Moderate Members** permission. Ask an admin to check the bot's role and permissions.",
  unmute: "I don't have permission to unmute this user. They may have a higher role than me, or I may lack the **Moderate Members** permission. Ask an admin to check the bot's role and permissions.",
  clear: "I don't have permission to delete messages in this channel. Ask an admin to grant the bot **Manage Messages** and **Read Message History** in this channel.",
} as const;

// please properly configure fluxys permissions dickweed