import assert from "node:assert/strict";
import { createHmac } from "node:crypto";
import test from "node:test";
import {
  createWebhookDedupKey,
  generateMerchantReference,
  normalizeChapaStatus,
  normalizeEthiopianPhone,
  parseVerifiedChapaPayment,
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
  assert.equal(verifyChapaWebhookSignature(Buffer.from(`${rawBody.toString()} `), signature), false);
  assert.equal(verifyChapaWebhookSignature(rawBody, signature.toUpperCase()), false);
  assert.equal(verifyChapaWebhookSignature(rawBody, null), false);
});

test("maps documented Chapa payment statuses and rejects unknown ones", () => {
  assert.equal(normalizeChapaStatus("success"), "SUCCESS");
  assert.equal(normalizeChapaStatus("pending"), "PENDING");
  assert.equal(normalizeChapaStatus("failed"), "FAILED");
  assert.equal(normalizeChapaStatus("cancelled"), "CANCELLED");
  assert.equal(normalizeChapaStatus("incomplete"), "INCOMPLETE");
  assert.equal(normalizeChapaStatus("blocked"), "BLOCKED");
  assert.equal(normalizeChapaStatus("auth_needed"), "AUTH_NEEDED");
  assert.equal(normalizeChapaStatus("something_new"), "INVALID");
});

test("only accepts verified Chapa data matching the local payment", () => {
  const expected = {
    chapaReference: "CHAPA-REF-1",
    merchantReference: "NA_merchant_reference",
    amount: 1250,
    currency: "ETB",
  };
  const response = {
    status: "success",
    data: {
      chapa_reference: expected.chapaReference,
      merchant_reference: expected.merchantReference,
      amount: "1250",
      currency: "ETB",
      status: "success",
    },
  };

  assert.equal(parseVerifiedChapaPayment(response, expected)?.status, "SUCCESS");
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
      { ...response, data: { ...response.data, status: "mystery" } },
      expected,
    ),
    null,
  );
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
