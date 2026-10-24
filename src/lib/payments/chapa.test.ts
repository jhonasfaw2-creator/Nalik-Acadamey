import assert from "node:assert/strict";
import { createHmac } from "node:crypto";
import test from "node:test";
import type { Prisma } from "@prisma/client";
import { createPaymentReturnToken, verifyPaymentReturnToken } from "./returnToken";
import {
  chapaAmountMatches,
  createWebhookDedupKey,
  generateMerchantReference,
  getChapaMode,
  normalizeChapaStatus,
  normalizeEthiopianPhone,
  parseChapaAmount,
  parseVerifiedChapaPayment,
  pickChapaReferenceFromPayments,
  reconcileVerifiedPayment,
  toChapaMinorUnits,
  verifyChapaWebhookSignature,
} from "./chapa";

test("verifies the documented raw-body HMAC-SHA256 webhook signature", () => {
  process.env.CHAPA_WEBHOOK_SECRET = "test-webhook-secret";
  const rawBody = Buffer.from('{"event":"payment.success","amount":"100"}');
  const signature = createHmac("sha256", process.env.CHAPA_WEBHOOK_SECRET)
    .update(rawBody)
    .digest("hex");

  assert.equal(verifyChapaWebhookSignature(rawBody, signature), true);
  assert.equal(verifyChapaWebhookSignature(rawBody, signature.toUpperCase()), true);
  // A newline pasted into the hosting environment must not break HMAC.
  process.env.CHAPA_WEBHOOK_SECRET = "test-webhook-secret\n";
  assert.equal(verifyChapaWebhookSignature(rawBody, signature), true);
  process.env.CHAPA_WEBHOOK_SECRET = "test-webhook-secret";
  assert.equal(verifyChapaWebhookSignature(Buffer.from(`${rawBody.toString()} `), signature), false);
  assert.equal(verifyChapaWebhookSignature(rawBody, null), false);
});

test("maps documented Chapa payment statuses and rejects unknown ones", () => {
  assert.equal(normalizeChapaStatus("success"), "SUCCESS");
  assert.equal(normalizeChapaStatus("SUCCESS"), "SUCCESS");
  assert.equal(normalizeChapaStatus("pending"), "PENDING");
  assert.equal(normalizeChapaStatus("failed"), "FAILED");
  assert.equal(normalizeChapaStatus("cancelled"), "CANCELLED");
  assert.equal(normalizeChapaStatus("incomplete"), "INCOMPLETE");
  assert.equal(normalizeChapaStatus("blocked"), "BLOCKED");
  assert.equal(normalizeChapaStatus("auth_needed"), "AUTH_NEEDED");
  assert.equal(normalizeChapaStatus("something_new"), "INVALID");
});

test("matches net amounts or gross amounts that include the service fee", () => {
  assert.equal(chapaAmountMatches(10_000, 288, 10_000), true);
  assert.equal(chapaAmountMatches(10_288, 288, 10_000), true);
  assert.equal(chapaAmountMatches(10_288, null, 10_000), false);
  assert.equal(chapaAmountMatches(10_288, 288, 9_999), false);

  const grossSuccess = parseVerifiedChapaPayment(
    {
      status: "success",
      data: {
        chapa_reference: "HCIqXYMVLmnw",
        merchant_reference: "NA1234567890abcdef",
        amount: "10288",
        service_fee: "288",
        currency: "ETB",
        status: "SUCCESS",
      },
    },
    { merchantReference: "NA1234567890abcdef", amount: 10_000, currency: "ETB" },
  );
  assert.equal(grossSuccess?.status, "SUCCESS");
  assert.equal(grossSuccess?.serviceFee, 288);
});

test("parses integer cents from JSON numbers and numeric strings", () => {
  assert.equal(parseChapaAmount(10_000), 10_000);
  assert.equal(parseChapaAmount("10000"), 10_000);
  assert.equal(parseChapaAmount(" 10000 "), 10_000);
  assert.equal(parseChapaAmount("10000.00"), 10_000);
  assert.equal(parseChapaAmount("10000.50"), null);
  assert.equal(parseChapaAmount(100.5), null);
  assert.equal(parseChapaAmount(-1), null);
  assert.equal(parseChapaAmount("abc"), null);
  assert.equal(parseChapaAmount(null), null);
});

test("only accepts verified Chapa data matching the local payment", () => {
  const expected = {
    merchantReference: "NA_merchant_reference",
    amount: 1250,
    currency: "ETB",
  };
  const response = {
    status: "success",
    data: {
      chapa_reference: "CHAPA-REF-1",
      merchant_reference: expected.merchantReference,
      amount: "1250",
      service_fee: "37",
      currency: "ETB",
      status: "success",
    },
  };

  const verified = parseVerifiedChapaPayment(response, expected);
  assert.equal(verified?.status, "SUCCESS");
  assert.equal(verified?.amount, 1250);
  assert.equal(verified?.serviceFee, 37);
  assert.equal(
    parseVerifiedChapaPayment(
      { ...response, data: { ...response.data, amount: "1251" } },
      expected,
    ),
    null,
  );
  assert.equal(
    parseVerifiedChapaPayment(
      { ...response, data: { ...response.data, currency: "USD" } },
      expected,
    ),
    null,
  );
  assert.equal(
    parseVerifiedChapaPayment(
      { ...response, data: { ...response.data, merchant_reference: "other" } },
      expected,
    ),
    null,
  );
  assert.equal(
    parseVerifiedChapaPayment(
      { ...response, data: { ...response.data, chapa_reference: "CHAPA-REF-2" } },
      expected,
    )?.chapaReference,
    "CHAPA-REF-2",
  );
  assert.equal(
    parseVerifiedChapaPayment(
      { ...response, data: { ...response.data, status: "mystery" } },
      expected,
    ),
    null,
  );
});

test("verifies by merchant reference when the Chapa reference is not stored yet", () => {
  const response = {
    status: "success",
    data: {
      chapa_reference: "CH0Vn2VASWCi",
      merchant_reference: "NA1234567890abcdef",
      amount: 10_000,
      currency: "ETB",
      status: "PENDING",
    },
  };

  const verified = parseVerifiedChapaPayment(response, {
    merchantReference: "NA1234567890abcdef",
    amount: 10_000,
    currency: "ETB",
  });
  assert.equal(verified?.chapaReference, "CH0Vn2VASWCi");
  assert.equal(verified?.status, "PENDING");
  assert.equal(verified?.serviceFee, null);
});

test("accepts a pending verification without a Chapa reference but not a success", () => {
  const pending = {
    status: "success",
    data: {
      chapa_reference: null,
      merchant_reference: "NA1234567890abcdef",
      amount: 10_000,
      service_fee: 0,
      currency: "ETB",
      status: "PENDING",
    },
  };

  const verified = parseVerifiedChapaPayment(pending, {
    merchantReference: "NA1234567890abcdef",
    amount: 10_000,
    currency: "ETB",
  });
  assert.equal(verified?.status, "PENDING");
  assert.equal(verified?.chapaReference, null);
  assert.equal(verified?.serviceFee, 0);
  assert.equal(
    parseVerifiedChapaPayment(
      { ...pending, data: { ...pending.data, status: "SUCCESS" } },
      {
        merchantReference: "NA1234567890abcdef",
        amount: 10_000,
        currency: "ETB",
      },
    ),
    null,
  );
});

test("resolves the real Chapa reference from the payments list by merchant reference", () => {
  const list = {
    status: "success",
    data: {
      items: [
        { merchant_reference: "NAother", chapa_reference: "HCother" },
        { merchant_reference: "NA1234567890abcdef", chapa_reference: "HCIqXYMVLmnw" },
      ],
    },
  };

  assert.equal(pickChapaReferenceFromPayments(list, "NA1234567890abcdef"), "HCIqXYMVLmnw");
  assert.equal(pickChapaReferenceFromPayments(list, "NAmissing"), null);
  assert.equal(pickChapaReferenceFromPayments({ status: "success", data: {} }, "NA1234567890abcdef"), null);
  assert.equal(
    pickChapaReferenceFromPayments(
      { status: "success", data: { items: [{ merchant_reference: "NA1234567890abcdef" }] } },
      "NA1234567890abcdef",
    ),
    null,
  );
});

test("derives the Chapa environment from the documented key prefixes", () => {
  const original = process.env.CHAPA_SECRET_KEY;
  try {
    process.env.CHAPA_SECRET_KEY = "CHAPA_TEST_example";
    assert.equal(getChapaMode(), "test");
    process.env.CHAPA_SECRET_KEY = "CHAPA_LIVE_example";
    assert.equal(getChapaMode(), "live");
    process.env.CHAPA_SECRET_KEY = "unprefixed";
    assert.throws(() => getChapaMode(), /TEST or LIVE secret key/);
  } finally {
    if (original === undefined) delete process.env.CHAPA_SECRET_KEY;
    else process.env.CHAPA_SECRET_KEY = original;
  }
});

test("signs expiring return tokens so a checkout return does not need a cookie", () => {
  const original = process.env.SESSION_SECRET;
  process.env.SESSION_SECRET = "test-session-secret";
  try {
    const now = Date.now();
    const paymentId = "cmvm4qwo70003jp07771ijurz";
    const token = createPaymentReturnToken(paymentId, now);
    assert.ok(token);
    assert.equal(verifyPaymentReturnToken(token, now), paymentId);
    assert.equal(verifyPaymentReturnToken(`${token}x`, now), null);
    assert.equal(verifyPaymentReturnToken(token, now + 25 * 60 * 60 * 1000), null);

    process.env.SESSION_SECRET = "different-secret";
    assert.equal(verifyPaymentReturnToken(token, now), null);

    delete process.env.SESSION_SECRET;
    assert.equal(createPaymentReturnToken(paymentId, now), null);
  } finally {
    if (original === undefined) delete process.env.SESSION_SECRET;
    else process.env.SESSION_SECRET = original;
  }
});

test("normalizes Ethiopian phone numbers into international format", () => {
  assert.equal(normalizeEthiopianPhone("0912 345 678"), "+251912345678");
  assert.equal(normalizeEthiopianPhone("251912345678"), "+251912345678");
  assert.equal(normalizeEthiopianPhone("+251 912 345 678"), "+251912345678");
  assert.equal(normalizeEthiopianPhone("12345"), null);
});

test("converts whole Birr course prices to Chapa's minor units", () => {
  assert.equal(toChapaMinorUnits(100), 10_000);
  assert.equal(toChapaMinorUnits(1), null);
  assert.equal(toChapaMinorUnits(1.5), null);
  assert.equal(toChapaMinorUnits(21_474_836), 2_147_483_600);
  assert.equal(toChapaMinorUnits(21_474_837), null);
  assert.equal(toChapaMinorUnits(Number.MAX_SAFE_INTEGER), null);
});

test("generates unique merchant references within Chapa's 20-character limit", () => {
  const references = new Set(Array.from({ length: 100 }, generateMerchantReference));
  assert.equal(references.size, 100);
  for (const reference of references) {
    assert.match(reference, /^NA[a-f0-9]{18}$/);
    assert.ok(reference.length <= 20);
  }
});

test("deduplicates identical webhook deliveries deterministically", () => {
  const event = {
    event: "payment.success",
    chapaReference: "CHAPA-REF-1",
    status: "success",
    updatedAt: "2026-10-06T12:00:00Z",
    rawBody: Buffer.from('{"event":"payment.success"}'),
  };

  assert.equal(createWebhookDedupKey(event), createWebhookDedupKey(event));
  assert.notEqual(
    createWebhookDedupKey(event),
    createWebhookDedupKey({ ...event, updatedAt: "2026-10-06T12:00:01Z" }),
  );
});

interface FakePayment {
  id: string;
  status: string;
  chapaReference: string | null;
  amount: number;
  currency: string;
  registration: { id: string; scheduleId: string | null; status: string };
}

function makePayment(overrides: Partial<FakePayment> = {}): FakePayment {
  return {
    id: "pay_1",
    status: "PENDING",
    chapaReference: null,
    amount: 10_000,
    currency: "ETB",
    registration: { id: "reg_1", scheduleId: "sch_1", status: "PENDING" },
    ...overrides,
  };
}

function createFakeTx(
  payment: FakePayment,
  options: {
    conflictingChapaReferenceOwner?: string;
    claimCount?: number;
    seatCount?: number;
  } = {},
) {
  const calls = {
    paymentUpdates: [] as Record<string, unknown>[],
    registrationClaims: 0,
    seatIncrements: 0,
  };

  const tx = {
    payment: {
      findUnique: async (args: { where: { id?: string; chapaReference?: string } }) => {
        if (args.where.id) return payment;
        if (args.where.chapaReference && options.conflictingChapaReferenceOwner) {
          return { id: options.conflictingChapaReferenceOwner };
        }
        return null;
      },
      update: async ({ data }: { data: Record<string, unknown> }) => {
        calls.paymentUpdates.push(data);
        Object.assign(payment, data);
        return payment;
      },
    },
    registration: {
      updateMany: async () => {
        calls.registrationClaims += 1;
        return { count: options.claimCount ?? 1 };
      },
    },
    schedule: {
      findUnique: async () => ({ maxSeats: 10 }),
      updateMany: async () => {
        calls.seatIncrements += 1;
        return { count: options.seatCount ?? 1 };
      },
    },
  };

  return { tx: tx as unknown as Prisma.TransactionClient, calls };
}

function verifiedPayment(status: "SUCCESS" | "PENDING" | "FAILED") {
  return {
    chapaReference: "CH0Vn2VASWCi",
    merchantReference: "NA1234567890abcdef",
    amount: 10_000,
    serviceFee: 300,
    currency: "ETB",
    status,
  };
}

test("only verified success confirms a registration and claims one seat", async () => {
  const success = createFakeTx(makePayment());
  assert.equal(
    await reconcileVerifiedPayment(success.tx, "pay_1", "CH0Vn2VASWCi", verifiedPayment("SUCCESS")),
    "SUCCESS",
  );
  assert.equal(success.calls.registrationClaims, 1);
  assert.equal(success.calls.seatIncrements, 1);
  assert.equal(success.calls.paymentUpdates[0].status, "SUCCESS");

  const pending = createFakeTx(makePayment());
  assert.equal(
    await reconcileVerifiedPayment(pending.tx, "pay_1", "CH0Vn2VASWCi", verifiedPayment("PENDING")),
    "PENDING",
  );
  assert.equal(pending.calls.registrationClaims, 0);
  assert.equal(pending.calls.seatIncrements, 0);

  const failed = createFakeTx(makePayment());
  assert.equal(
    await reconcileVerifiedPayment(failed.tx, "pay_1", "CH0Vn2VASWCi", verifiedPayment("FAILED")),
    "FAILED",
  );
  assert.equal(failed.calls.registrationClaims, 0);
  assert.equal(failed.calls.seatIncrements, 0);
});

test("never marks an unverified or mismatched transaction successful", async () => {
  const unverified = createFakeTx(makePayment());
  assert.equal(await reconcileVerifiedPayment(unverified.tx, "pay_1", "CH0Vn2VASWCi", null), "INVALID");
  assert.equal(unverified.calls.registrationClaims, 0);
  assert.equal(unverified.calls.seatIncrements, 0);

  const conflict = createFakeTx(makePayment(), {
    conflictingChapaReferenceOwner: "pay_other",
  });
  assert.equal(
    await reconcileVerifiedPayment(conflict.tx, "pay_1", "CH0Vn2VASWCi", verifiedPayment("SUCCESS")),
    "INVALID",
  );
  assert.equal(conflict.calls.registrationClaims, 0);
});

test("a verified success is not downgraded by a stale notification", async () => {
  const paid = makePayment({ status: "SUCCESS", chapaReference: "CH0Vn2VASWCi" });
  const stale = createFakeTx(paid);

  assert.equal(
    await reconcileVerifiedPayment(stale.tx, "pay_1", "CH0Vn2VASWCi", verifiedPayment("PENDING")),
    "SUCCESS",
  );
  assert.equal(stale.calls.paymentUpdates.length, 0);
  assert.equal(stale.calls.registrationClaims, 0);
});

test("a pending verification keeps the stored reference and never confirms", async () => {
  const pending = createFakeTx(makePayment({ chapaReference: "TESTL92828549Y" }));

  assert.equal(
    await reconcileVerifiedPayment(pending.tx, "pay_1", "TESTL92828549Y", {
      ...verifiedPayment("PENDING"),
      chapaReference: null,
    }),
    "PENDING",
  );
  assert.equal(pending.calls.paymentUpdates[0].status, "PENDING");
  assert.equal("chapaReference" in pending.calls.paymentUpdates[0], false);
  assert.equal(pending.calls.registrationClaims, 0);
});
