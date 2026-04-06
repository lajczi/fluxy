jest.mock('../../dashboard/src/lib/glitchtip', () => ({
  GlitchTip: {
    captureException: jest.fn(),
  },
}));

const { normalizeSettings } = require('../../dashboard/src/lib/api');

describe('normalizeSettings welcomeMessage', () => {
  test('preserves triggerRoleId for role-triggered welcomes', () => {
    const result = normalizeSettings({
      guildId: 'g1',
      welcomeMessage: {
        enabled: true,
        trigger: 'role',
        triggerRoleId: 'verified-role',
      } as any,
    });

    expect(result.welcomeMessage.trigger).toBe('role');
    expect(result.welcomeMessage.triggerRoleId).toBe('verified-role');
  });
});
