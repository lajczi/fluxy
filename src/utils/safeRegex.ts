const MAX_PATTERN_LENGTH = 200;

const DANGEROUS_PATTERNS = [
  /\(.+[+*]\)\s*[+*]/, // (x+)+ or (x*)* etc.
  /\(.+\{.+\}\)\s*[+*{]/, // (x{2,})+
  /\(.+[+*]\)\s*\{/, // (x+){2,}
  /(\.\*){2,}/, // consecutive .* patterns
  /\([^)]*\|[^)]*\)[+*]/, // alternation inside quantified group: (a|a)+
];

export function isSafeRegex(pattern: string): { safe: boolean; reason?: string } {
  if (pattern.length > MAX_PATTERN_LENGTH) {
    return { safe: false, reason: `Pattern too long (max ${MAX_PATTERN_LENGTH} characters).` };
  }

  for (const dangerous of DANGEROUS_PATTERNS) {
    if (dangerous.test(pattern)) {
      return { safe: false, reason: 'Pattern contains nested quantifiers that could cause performance issues.' };
    }
  }

  const quantifiers = (pattern.match(/[+*?]|\{[\d,]+\}/g) || []).length;
  if (quantifiers > 10) {
    return { safe: false, reason: 'Pattern has too many quantifiers.' };
  }

  return { safe: true };
}
