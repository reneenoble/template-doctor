// In-memory configuration overrides applied at runtime via the secure setup function.
// These DO NOT persist across function host restarts. Intended for rapid operational tuning.
// Persisted configuration should move to a durable store (Key Vault / App Config) later.

export type ConfigOverrideMap = Record<string, string>;

export const configOverrides: ConfigOverrideMap = {};

export function setOverrides(partial: Record<string, unknown>): {
  applied: Record<string, string>;
  ignored: string[];
} {
  const applied: Record<string, string> = {};
  const ignored: string[] = [];
  for (const [k, v] of Object.entries(partial)) {
    if (v === undefined || v === null) {
      ignored.push(k);
      continue;
    }
    // Allow only string/number/boolean scalars; coerce to string for downstream simplicity.
    if (['string', 'number', 'boolean'].includes(typeof v)) {
      configOverrides[k] = String(v);
      applied[k] = configOverrides[k];
    } else {
      ignored.push(k);
    }
  }
  return { applied, ignored };
}

export function getMergedValue(key: string, fallback: string): string {
  return configOverrides[key] ?? fallback;
}

export function listOverrides(): ConfigOverrideMap {
  return { ...configOverrides };
}
