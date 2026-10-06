CREATE TYPE "PaymentStatus" AS ENUM (
    'PENDING',
    'SUCCESS',
    'FAILED',
    'CANCELLED',
    'INCOMPLETE',
    'BLOCKED',
    'AUTH_NEEDED',
    'INVALID'
);

CREATE TABLE "Payment" (
    "id" TEXT NOT NULL,
    "registrationId" TEXT NOT NULL,
    "merchantReference" TEXT NOT NULL,
    "chapaReference" TEXT,
    "amount" INTEGER NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'ETB',
    "status" "PaymentStatus" NOT NULL DEFAULT 'PENDING',
    "checkoutUrl" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "verifiedAt" TIMESTAMP(3),

    CONSTRAINT "Payment_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "PaymentWebhookEvent" (
    "id" TEXT NOT NULL,
    "dedupKey" TEXT NOT NULL,
    "event" TEXT NOT NULL,
    "chapaReference" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PaymentWebhookEvent_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "Payment_merchantReference_key" ON "Payment"("merchantReference");
CREATE UNIQUE INDEX "Payment_chapaReference_key" ON "Payment"("chapaReference");
CREATE INDEX "Payment_registrationId_createdAt_idx" ON "Payment"("registrationId", "createdAt");
CREATE INDEX "Payment_status_idx" ON "Payment"("status");
CREATE UNIQUE INDEX "PaymentWebhookEvent_dedupKey_key" ON "PaymentWebhookEvent"("dedupKey");

ALTER TABLE "Payment"
ADD CONSTRAINT "Payment_registrationId_fkey"
FOREIGN KEY ("registrationId") REFERENCES "Registration"("id")
ON DELETE CASCADE ON UPDATE CASCADE;
