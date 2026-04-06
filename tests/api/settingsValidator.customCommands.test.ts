import { validateSettingsUpdate } from '../../src/api/middleware/settingsValidator';

function makeCommand(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    name: 'status_check',
    response: 'Server status is green.',
    embed: true,
    color: '#44aa88',
    title: 'Status',
    enabled: true,
    actionType: 'reply',
    targetRoleId: null,
    requiredRoleIds: ['12345678901234567'],
    requiredPermission: 'ManageGuild',
    allowedChannelIds: ['22345678901234567'],
    cooldownSeconds: 30,
    deleteTrigger: false,
    ...overrides,
  };
}

describe('validateSettingsUpdate customCommands validation', () => {
  test('accepts valid advanced custom command payload', () => {
    const result = validateSettingsUpdate({
      customCommands: [makeCommand()],
    });

    expect(result.valid).toBe(true);
    expect(result.errors).toEqual([]);
  });

  test('rejects more than five custom commands', () => {
    const commands = Array.from({ length: 6 }, (_, idx) => makeCommand({ name: `cmd_${idx + 1}` }));

    const result = validateSettingsUpdate({
      customCommands: commands,
    });

    expect(result.valid).toBe(false);
    expect(result.errors).toContain('Maximum 5 custom commands');
  });

  test('rejects invalid required permission value', () => {
    const result = validateSettingsUpdate({
      customCommands: [makeCommand({ requiredPermission: 'ViewAuditLog' })],
    });

    expect(result.valid).toBe(false);
    expect(result.errors).toContain('customCommands[].requiredPermission is invalid');
  });

  test('rejects duplicate command names after normalization', () => {
    const result = validateSettingsUpdate({
      customCommands: [makeCommand({ name: 'status' }), makeCommand({ name: ' Status ' })],
    });

    expect(result.valid).toBe(false);
    expect(result.errors).toContain('Custom command names must be unique');
  });

  test('accepts toggleRole action command with target role', () => {
    const result = validateSettingsUpdate({
      customCommands: [
        makeCommand({
          name: 'perms',
          actionType: 'toggleRole',
          targetRoleId: '32345678901234567',
        }),
      ],
    });

    expect(result.valid).toBe(true);
    expect(result.errors).toEqual([]);
  });

  test('rejects toggleRole action command without target role', () => {
    const result = validateSettingsUpdate({
      customCommands: [
        makeCommand({
          name: 'perms',
          actionType: 'toggleRole',
          targetRoleId: null,
        }),
      ],
    });

    expect(result.valid).toBe(false);
    expect(result.errors).toContain('customCommands[].targetRoleId is required for toggleRole action');
  });
});
