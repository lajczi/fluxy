type DurationUnit = 's' | 'm' | 'h' | 'd' | 'w';

const multipliers: Record<DurationUnit, number> = {
  s: 1000,
  m: 60 * 1000,
  h: 60 * 60 * 1000,
  d: 24 * 60 * 60 * 1000,
  w: 7 * 24 * 60 * 60 * 1000,
};

export default function parseDuration(str: string | null | undefined): number | null {
  if (!str || typeof str !== 'string') return null;
  
  const match = str.trim().match(/^(\d+)(s|m|h|d|w)$/);
  if (!match) return null;
  
  const [, amount, unit] = match;
  return parseInt(amount, 10) * multipliers[unit as DurationUnit];
}
