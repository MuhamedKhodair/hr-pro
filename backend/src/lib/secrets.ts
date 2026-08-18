const KNOWN_WEAK = new Set([
  'change-me-to-a-random-secret',
  'change-me-to-another-random-secret',
  'dev-secret',
  'dev-refresh-secret',
  'changeme',
  'secret',
  'password',
]);

export function isWeakSecret(value: string | undefined): boolean {
  if (!value) return true;
  const trimmed = value.trim();
  if (trimmed.length < 32) return true;
  const lowered = trimmed.toLowerCase();
  if (KNOWN_WEAK.has(lowered)) return true;
  const distinct = new Set(trimmed).size;
  if (distinct < 8) return true;
  return false;
}

export function checkSecretConfig(): string[] {
  const problems: string[] = [];
  if (isWeakSecret(process.env.JWT_SECRET)) {
    problems.push('JWT_SECRET must be a random value of at least 32 characters (and not a known placeholder)');
  }
  if (isWeakSecret(process.env.JWT_REFRESH_SECRET)) {
    problems.push('JWT_REFRESH_SECRET must be a random value of at least 32 characters (and not a known placeholder)');
  }
  return problems;
}