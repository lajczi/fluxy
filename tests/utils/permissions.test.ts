jest.mock('@erinjs/core', () => ({
  PermissionFlags: {
    Administrator: 0x8n,
    BanMembers: 0x4n,
    KickMembers: 0x2n,
    ManageGuild: 0x20n,
    ManageMessages: 0x2000n,
  },
}));

import {
  hasPermission,
  hasAnyPermission,
  hasAllPermissions,
  isAdministrator,
  canModerate,
  canManageRole,
  getPermissionList,
} from '../../src/utils/permissions';

function makeMember(id: string, permBigInt: bigint, overrides: Record<string, any> = {}) {
  return {
    id,
    permissions: {
      has: (flag: bigint) => (permBigInt & flag) === flag,
    },
    roles: null as any,
    guild: null as any,
    ...overrides,
  };
}

function makeRoles(roleIds: string[] = []) {
  return { roleIds };
}

describe('hasPermission', () => {
  test('returns true when member has the permission', () => {
    const member = makeMember('1', 0x4n);
    expect(hasPermission(member, 'BanMembers')).toBe(true);
  });

  test('returns false when member lacks the permission', () => {
    const member = makeMember('1', 0x2n);
    expect(hasPermission(member, 'BanMembers')).toBe(false);
  });

  test('returns false for null member', () => {
    expect(hasPermission(null, 'BanMembers')).toBe(false);
  });

  test('returns false for null permissions', () => {
    expect(hasPermission({ id: '1' } as any, 'BanMembers')).toBe(false);
  });

  test('returns false and warns for unknown permission flag', () => {
    const spy = jest.spyOn(console, 'warn').mockImplementation(() => {});
    const member = makeMember('1', 0x4n);
    expect(hasPermission(member, 'FakePermission')).toBe(false);
    expect(spy).toHaveBeenCalledWith('Unknown permission flag: FakePermission');
    spy.mockRestore();
  });
});

describe('hasAnyPermission', () => {
  test('returns true if member has at least one of the permissions', () => {
    const member = makeMember('1', 0x4n);
    expect(hasAnyPermission(member, ['KickMembers', 'BanMembers'])).toBe(true);
  });

  test('returns false if member has none of the permissions', () => {
    const member = makeMember('1', 0x20n);
    expect(hasAnyPermission(member, ['KickMembers', 'BanMembers'])).toBe(false);
  });

  test('returns false for null member', () => {
    expect(hasAnyPermission(null, ['BanMembers'])).toBe(false);
  });
});

describe('hasAllPermissions', () => {
  test('returns true if member has all permissions', () => {
    const member = makeMember('1', 0x4n | 0x2n);
    expect(hasAllPermissions(member, ['KickMembers', 'BanMembers'])).toBe(true);
  });

  test('returns false if member is missing one permission', () => {
    const member = makeMember('1', 0x4n);
    expect(hasAllPermissions(member, ['KickMembers', 'BanMembers'])).toBe(false);
  });
});

describe('isAdministrator', () => {
  test('returns true for a member with Administrator flag', () => {
    const member = makeMember('1', 0x8n);
    expect(isAdministrator(member)).toBe(true);
  });

  test('returns false for a member without Administrator flag', () => {
    const member = makeMember('1', 0x4n);
    expect(isAdministrator(member)).toBe(false);
  });
});

function makeGuild(ownerId: string, roleMap: Record<string, number> = {}) {
  return {
    ownerId,
    roles: {
      get: jest.fn((roleId: string) =>
        roleMap[roleId] !== undefined ? { id: roleId, position: roleMap[roleId] } : undefined,
      ),
    },
  };
}

describe('canModerate', () => {
  test('returns false when moderator targets themselves', () => {
    const member = makeMember('123', 0x8n);
    const result = canModerate(member, member);
    expect(result.canModerate).toBe(false);
    expect(result.reason).toMatch(/yourself/i);
  });

  test('returns false when target is the guild owner', () => {
    const guild = makeGuild('999');
    const mod = makeMember('1', 0x8n, { guild });
    const target = makeMember('999', 0x0n, { guild });
    const result = canModerate(mod, target);
    expect(result.canModerate).toBe(false);
    expect(result.reason).toMatch(/server owner/i);
  });

  test('returns true when moderator has a higher role position', () => {
    const guild = makeGuild('0', { role_high: 10, role_low: 5 });
    const mod = makeMember('1', 0x4n, { guild, roles: makeRoles(['role_high']) });
    const target = makeMember('2', 0x0n, { guild, roles: makeRoles(['role_low']) });
    const result = canModerate(mod, target);
    expect(result.canModerate).toBe(true);
    expect(result.reason).toBeNull();
  });

  test('returns false when moderator has equal role position to target', () => {
    const guild = makeGuild('0', { role_same: 5 });
    const mod = makeMember('1', 0x4n, { guild, roles: makeRoles(['role_same']) });
    const target = makeMember('2', 0x0n, { guild, roles: makeRoles(['role_same']) });
    const result = canModerate(mod, target);
    expect(result.canModerate).toBe(false);
    expect(result.reason).toMatch(/equal or higher/i);
  });

  test('returns false when target has a higher role position', () => {
    const guild = makeGuild('0', { role_high: 10, role_low: 3 });
    const mod = makeMember('1', 0x4n, { guild, roles: makeRoles(['role_low']) });
    const target = makeMember('2', 0x0n, { guild, roles: makeRoles(['role_high']) });
    const result = canModerate(mod, target);
    expect(result.canModerate).toBe(false);
    expect(result.reason).toMatch(/equal or higher/i);
  });

  test('uses highest position when member has multiple roles', () => {
    const guild = makeGuild('0', { r1: 3, r2: 8, r3: 1 });
    const mod = makeMember('1', 0x4n, { guild, roles: makeRoles(['r1', 'r2', 'r3']) });
    const target = makeMember('2', 0x0n, { guild, roles: makeRoles(['r1']) });
    const result = canModerate(mod, target);
    expect(result.canModerate).toBe(true);
  });

  test('skips hierarchy check when roles array is empty (both positions = 0)', () => {
    const guild = makeGuild('0', {});
    const mod = makeMember('1', 0x4n, { guild, roles: makeRoles([]) });
    const target = makeMember('2', 0x0n, { guild, roles: makeRoles([]) });
    const result = canModerate(mod, target);
    expect(result.canModerate).toBe(true);
  });

  test('skips hierarchy check when guild is absent', () => {
    const mod = makeMember('1', 0x4n, { guild: null, roles: makeRoles([]) });
    const target = makeMember('2', 0x0n, { guild: null, roles: makeRoles([]) });
    const result = canModerate(mod, target);
    expect(result.canModerate).toBe(true);
  });
});

describe('canManageRole', () => {
  test('returns allowed:false when member, role, or guild is missing', () => {
    expect(canManageRole(null as any, {} as any, {} as any).allowed).toBe(false);
    expect(canManageRole({} as any, null as any, {} as any).allowed).toBe(false);
    expect(canManageRole({} as any, {} as any, null as any).allowed).toBe(false);
  });

  test('guild owner bypasses hierarchy', () => {
    const guild = makeGuild('owner1', { role_high: 100 });
    const member = makeMember('owner1', 0x0n, { guild, roles: makeRoles([]) });
    const targetRole = { name: 'SuperAdmin', position: 100 };
    const result = canManageRole(member, targetRole as any, guild as any);
    expect(result.allowed).toBe(true);
  });

  test('allows when member highest role is above target role', () => {
    const guild = makeGuild('0', { role_high: 10, role_low: 3 });
    const member = makeMember('1', 0x0n, { guild, roles: makeRoles(['role_high']) });
    const targetRole = { name: 'LowRole', position: 3 };
    const result = canManageRole(member, targetRole as any, guild as any);
    expect(result.allowed).toBe(true);
  });

  test('blocks when member highest role equals target role position', () => {
    const guild = makeGuild('0', { role_same: 5 });
    const member = makeMember('1', 0x0n, { guild, roles: makeRoles(['role_same']) });
    const targetRole = { name: 'SameRole', position: 5 };
    const result = canManageRole(member, targetRole as any, guild as any);
    expect(result.allowed).toBe(false);
    expect(result.reason).toMatch(/SameRole/);
  });

  test('blocks when member highest role is below target role', () => {
    const guild = makeGuild('0', { role_low: 2 });
    const member = makeMember('1', 0x0n, { guild, roles: makeRoles(['role_low']) });
    const targetRole = { name: 'HighRole', position: 10 };
    const result = canManageRole(member, targetRole as any, guild as any);
    expect(result.allowed).toBe(false);
    expect(result.reason).toMatch(/HighRole/);
  });

  test('blocks when member has no roles (position 0) and target has position > 0', () => {
    const guild = makeGuild('0', {});
    const member = makeMember('1', 0x0n, { guild, roles: makeRoles([]) });
    const targetRole = { name: 'AnyRole', position: 1 };
    const result = canManageRole(member, targetRole as any, guild as any);
    expect(result.allowed).toBe(false);
  });

  test('uses highest of multiple roles for comparison', () => {
    const guild = makeGuild('0', { r1: 2, r2: 8, r3: 4 });
    const member = makeMember('1', 0x0n, { guild, roles: makeRoles(['r1', 'r2', 'r3']) });
    const targetRole = { name: 'Mid', position: 6 };
    const result = canManageRole(member, targetRole as any, guild as any);
    expect(result.allowed).toBe(true);
  });
});

describe('getPermissionList', () => {
  test('returns an array of strings', () => {
    const list = getPermissionList();
    expect(Array.isArray(list)).toBe(true);
    expect(list.every((p) => typeof p === 'string')).toBe(true);
  });

  test('includes known permissions from the mock', () => {
    const list = getPermissionList();
    expect(list).toContain('Administrator');
    expect(list).toContain('BanMembers');
  });
});
