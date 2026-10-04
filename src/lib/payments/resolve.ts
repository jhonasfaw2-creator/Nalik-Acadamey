import { prisma } from "@/lib/prisma";
import { findTransactions, ChapaApiError } from "@/lib/payments/chapa";

// ── Chapa reference resolution ────────────────────────────────────────────
//
// `/v2/payments/{reference}/verify` resolves *Chapa* references only. Handing it
// a merchant_reference is a guaranteed 404, so a payment is only ever verifiable
// once we know its Chapa reference.
//
// New payments capture it from `checkout_url` at initialization. Payments
// created before that existed — and any payment whose init row was lost — have a
// null `chapaReference`, and this module repairs them: the list endpoint is
// queried by merchant reference, the Chapa reference is read off the result, and
// it is persisted so every later call is a direct hit.
//
// Every settlement path (public verify, cookie status, webhook, admin verify and
// the bulk reconcile) goes through here, so a lost reference is a recoverable
// slowdown rather than a permanently stuck payment.

export interface ResolvablePayment {
  id: string;
  merchantReference: string | null;
  chapaReference: string | null;
}

export interface ResolvedReference {
  /** Chapa reference to verify against, or null when it cannot be determined. */
  reference: string | null;
  /** True when this call had to look the reference up and store it. */
  recovered: boolean;
  /** True when Chapa could not be reached — retry later rather than giving up. */
  providerUnavailable: boolean;
}

/**
 * Returns the Chapa reference for a payment, recovering and persisting it from
 * the transaction list when it is missing.
 *
 * Never throws. A Chapa 404 means "no such transaction", which is a definitive
 * answer and resolves to a null reference — only a transport failure or a 5xx
 * is reported as `providerUnavailable`, so a caller never tells a student to
 * keep retrying against an answer that will never change.
 */
export async function resolveChapaReference(
  payment: ResolvablePayment
): Promise<ResolvedReference> {
  const known = payment.chapaReference?.trim();
  if (known) return { reference: known, recovered: false, providerUnavailable: false };

  const merchantReference = payment.merchantReference?.trim();
  if (!merchantReference) {
    return { reference: null, recovered: false, providerUnavailable: false };
  }

  let matches;
  try {
    matches = await findTransactions(merchantReference);
  } catch (error) {
    // 404/400 = Chapa has no record of this reference. Anything else (no
    // response, timeout, 5xx) is worth retrying later.
    const definitive =
      error instanceof ChapaApiError &&
      (error.httpStatus === 404 || error.httpStatus === 400);
    if (!definitive) {
      console.warn("[resolve-chapa-reference] Chapa lookup failed", {
        referenceIdLength: merchantReference.length,
        httpStatus: error instanceof ChapaApiError ? error.httpStatus : undefined,
      });
    }
    return { reference: null, recovered: false, providerUnavailable: !definitive };
  }

  // The list endpoint filters loosely and only indexes *completed* transactions,
  // so only an exact merchant match is trusted. Chapa allows a customer to retry
  // a payment several times under one reference, which yields more than one row;
  // the most recently updated one is the attempt that actually settled, and the
  // duplicate is logged because a customer charged twice needs a human.
  const exact = matches.filter(
    (match) => match.merchant_reference?.trim() === merchantReference
  );
  const completed = exact.filter((match) =>
    ["success", "completed", "successful"].includes((match.status ?? "").toLowerCase())
  );
  const ranked = (completed.length ? completed : exact)
    .filter((match) => Boolean(match.chapa_reference?.trim()))
    .sort((a, b) => (b.updated_at ?? "").localeCompare(a.updated_at ?? ""));

  const reference = ranked[0]?.chapa_reference?.trim();
  if (!reference) {
    return { reference: null, recovered: false, providerUnavailable: false };
  }

  if (ranked.length > 1) {
    console.warn("[resolve-chapa-reference] Multiple completed transactions share this reference", {
      references: ranked.map((match) => match.chapa_reference),
      using: reference,
    });
  }
  try {
    await prisma.payment.update({
      where: { id: payment.id },
      data: { chapaReference: reference },
    });
  } catch {
    // A lost race or a deleted row must not fail the verification that follows —
    // the reference is still correct for this request.
  }

  return { reference, recovered: true, providerUnavailable: false };
}