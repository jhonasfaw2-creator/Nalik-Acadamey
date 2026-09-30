// ── Registration reference IDs ──────────────────────────────────────
// Shared by the public registration route and the admin manual-enrollment
// route so every registration gets the same unguessable ID format.

const REF_ID_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"; // no 0/O/1/I

// Reference IDs are how a student looks up their registration, so they must
// not be guessable. 6 chars from a 32-char alphabet ≈ 1B combinations.
export function generateReferenceId(): string {
  const year = new Date().getFullYear();
  const random = Array.from({ length: 6 }, () =>
    REF_ID_ALPHABET[crypto.getRandomValues(new Uint8Array(1))[0] % REF_ID_ALPHABET.length]
  ).join("");
  return `NA-${year}-${random}`;
}

/** Generate a reference ID that does not collide with an existing one. */
export async function generateUniqueReferenceId(
  exists: (id: string) => Promise<boolean>
): Promise<string> {
  let referenceId = generateReferenceId();
  for (let attempts = 0; attempts < 5 && (await exists(referenceId)); attempts++) {
    referenceId = generateReferenceId();
  }
  return referenceId;
}
