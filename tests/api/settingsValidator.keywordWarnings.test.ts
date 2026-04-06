import { validateSettingsUpdate } from '../../src/api/middleware/settingsValidator';

describe('validateSettingsUpdate keywordWarnings validation', () => {
  test('accepts valid keywordWarnings object payload', () => {
    const result = validateSettingsUpdate({
      keywordWarnings: {
        enabled: true,
        action: 'delete',
        keywords: [{ pattern: 'six seven', isRegex: false, label: null, addedBy: null }],
      },
    });

    expect(result.valid).toBe(true);
    expect(result.errors).toEqual([]);
  });

  test('accepts enabled keyword warnings without keywords', () => {
    const result = validateSettingsUpdate({
      keywordWarnings: {
        enabled: true,
        action: 'warn',
        keywords: [],
      },
    });

    expect(result.valid).toBe(true);
    expect(result.errors).toEqual([]);
  });

  test('rejects non-object keywordWarnings payload', () => {
    const result = validateSettingsUpdate({
      keywordWarnings: [],
    });

    expect(result.valid).toBe(false);
    expect(result.errors).toContain('keywordWarnings must be an object');
  });

  test('rejects invalid keyword warning entry shape', () => {
    const result = validateSettingsUpdate({
      keywordWarnings: {
        enabled: true,
        action: 'delete+warn',
        keywords: [{ pattern: '', isRegex: 'nope' }],
      },
    });

    expect(result.valid).toBe(false);
    expect(result.errors[0]).toContain('keywordWarnings.keywords[].pattern');
  });
});
