import en from '../locales/en.json';

const LOCALES = {
  en,
} as const;

type LocaleKey = keyof typeof LOCALES;
type Vars = Record<string, string | number | boolean | null | undefined>;

export function listLocales(): LocaleKey[] {
  return Object.keys(LOCALES) as LocaleKey[];
}

export function normalizeLocale(input: unknown): LocaleKey {
  const raw = typeof input === 'string' ? input.trim().toLowerCase() : '';
  if (raw && (raw in LOCALES)) return raw as LocaleKey;
  return 'en';
}

function getByPath(obj: unknown, key: string): unknown {
  const parts = key.split('.');
  let cur: any = obj;
  for (const p of parts) {
    if (!cur || typeof cur !== 'object') return undefined;
    cur = cur[p];
  }
  return cur;
}

function interpolate(template: string, vars?: Vars): string {
  if (!vars) return template;
  return template.replace(/\{([a-zA-Z0-9_]+)\}/g, (_, k: string) => {
    const v = vars[k];
    return v === null || v === undefined ? `{${k}}` : String(v);
  });
}

export function t(locale: unknown, key: string, vars?: Vars): string {
  const loc = normalizeLocale(locale);
  const fromLocale = getByPath(LOCALES[loc], key);
  const fallback = fromLocale === undefined ? getByPath(LOCALES.en, key) : fromLocale;
  const str = typeof fallback === 'string' ? fallback : key;
  return interpolate(str, vars);
}

