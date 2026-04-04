import {
  buildCustomCommandsSavePayload,
  createCustomCommandDraft,
  CUSTOM_COMMAND_MAX_COUNT,
} from '../../dashboard/src/lib/customCommands';
import type { CustomCommand } from '../../dashboard/src/lib/api';

function makeCommand(overrides: Partial<CustomCommand> = {}): CustomCommand {
  return {
    ...createCustomCommandDraft(),
    name: 'status',
    response: 'Server status is healthy.',
    ...overrides,
  };
}

describe('buildCustomCommandsSavePayload', () => {
  test('normalizes advanced command fields and returns valid payload', () => {
    const result = buildCustomCommandsSavePayload([
      makeCommand({
        name: ' Status-Check ',
        response: ' Hello {user} ',
        embed: true,
        color: '5865f2',
        title: '  Ops Status  ',
        requiredRoleIds: ['12345678901234567', '12345678901234567', 'bad-id'],
        allowedChannelIds: ['22345678901234567', '22345678901234567', 'oops'],
        requiredPermission: 'ManageGuild',
        cooldownSeconds: 9.7,
        deleteTrigger: true,
      }),
    ]);

    expect(result.ok).toBe(true);
    if (!result.ok) return;

    expect(result.payload).toHaveLength(1);
    expect(result.payload[0]).toMatchObject({
      name: 'status-check',
      response: 'Hello {user}',
      embed: true,
      color: '#5865f2',
      title: 'Ops Status',
      requiredRoleIds: ['12345678901234567'],
      allowedChannelIds: ['22345678901234567'],
      requiredPermission: 'ManageGuild',
      cooldownSeconds: 9,
      deleteTrigger: true,
    });
  });

  test('rejects payloads with more than max custom commands', () => {
    const commands = Array.from({ length: CUSTOM_COMMAND_MAX_COUNT + 1 }, (_, idx) =>
      makeCommand({ name: `cmd_${idx + 1}` }),
    );

    const result = buildCustomCommandsSavePayload(commands);
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error).toContain('up to');
  });

  test('rejects duplicate command names after normalization', () => {
    const result = buildCustomCommandsSavePayload([
      makeCommand({ name: 'status' }),
      makeCommand({ name: ' Status ' }),
    ]);

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error).toContain('Duplicate custom command name');
  });

  test('rejects invalid command names', () => {
    const result = buildCustomCommandsSavePayload([
      makeCommand({ name: 'status check' }),
    ]);

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error).toContain('Command names must be');
  });

  test('normalizes toggleRole action command and injects default response if missing', () => {
    const result = buildCustomCommandsSavePayload([
      makeCommand({
        name: 'perms',
        response: '   ',
        actionType: 'toggleRole',
        targetRoleId: '32345678901234567',
      }),
    ]);

    expect(result.ok).toBe(true);
    if (!result.ok) return;

    expect(result.payload[0]).toMatchObject({
      actionType: 'toggleRole',
      targetRoleId: '32345678901234567',
    });
    expect(result.payload[0].response).toContain('{target}');
  });

  test('rejects toggleRole action command without target role', () => {
    const result = buildCustomCommandsSavePayload([
      makeCommand({
        name: 'perms',
        actionType: 'toggleRole',
        targetRoleId: null,
      }),
    ]);

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error).toContain('needs a role target');
  });
});
