/**
 * Parse a request body as JSON. Returns null when the body is missing or not
 * valid JSON so callers can answer 400 instead of crashing with a 500.
 */
export async function readJson(request: Request): Promise<unknown | null> {
  try {
    return await request.json();
  } catch {
    return null;
  }
}

/** True when the error is a Prisma error with the given code. */
export function isPrismaError(error: unknown, code: string): boolean {
  if (typeof error !== "object" || error === null) return false;
  const e = error as { code?: unknown };
  return typeof e.code === "string" && e.code === code;
}

/** True when Prisma reports the record was not found (P2025). */
export function isNotFoundError(error: unknown): boolean {
  return isPrismaError(error, "P2025");
}

/** True when Prisma reports a unique constraint violation (P2002). */
export function isUniqueConstraintError(error: unknown): boolean {
  return isPrismaError(error, "P2002");
}