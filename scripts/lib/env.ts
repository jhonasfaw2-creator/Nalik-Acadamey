import { readFileSync } from "node:fs";

/**
 * Loads .env the way Next does (which a bare script does not), handling quotes
 * and inline comments.
 *
 * CHAPA_* keys are ALWAYS taken from the file: Next never overrides an
 * environment variable that already exists, so a stale CHAPA_* value exported
 * in the shell silently shadows the real config (and Chapa then answers 401).
 * The substitution is logged so that hazard is visible.
 */
export function loadEnv(path = ".env"): void {
  const fromFile = new Map<string, string>();
  for (const line of readFileSync(path, "utf8").split("\n")) {
    const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*?)\s*$/);
    if (!m) continue;
    let v = m[2].trim();
    if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) {
      v = v.slice(1, -1);
    } else {
      v = v.split(/\s+#/)[0].trim();
    }
    fromFile.set(m[1], v);
  }
  for (const [key, value] of fromFile) {
    const inherited = process.env[key];
    if (key.startsWith("CHAPA_")) {
      if (inherited && inherited !== value) {
        console.warn(`! ${key}: overriding inherited value (${inherited.slice(0, 14)}…) with the .env value`);
      }
      process.env[key] = value;
    } else if (!(key in process.env)) {
      process.env[key] = value;
    }
  }
}

/**
 * Hard safety gate for scripts that talk to the REAL api.chapa.co: never run
 * with a live key, since that would move real money.
 *   test formats: CHASECK_TEST-…  |  CHAPA_TEST_PRI…
 *   live formats: CHASECK_LIVE-…  |  CHAPA_LIVE_PRI…
 */
export function requireTestSecretKey(): string {
  const key = process.env.CHAPA_SECRET_KEY || "";
  if (!/test/i.test(key) || /live/i.test(key)) {
    throw new Error(
      "CHAPA_SECRET_KEY must be a TEST-mode key (e.g. CHASECK_TEST-… / CHAPA_TEST_PRI…). Found: " +
        (key ? `${key.slice(0, 14)}… (${key.length} chars)` : "(unset)")
    );
  }
  return key;
}
