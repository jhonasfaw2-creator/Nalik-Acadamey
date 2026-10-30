-- Payment-proof deadline for bank-transfer registrations (24 hours) and soft expiration.
ALTER TABLE "Registration" ADD COLUMN "proofDeadlineAt" TIMESTAMP(3);
ALTER TABLE "Registration" ADD COLUMN "expiredAt" TIMESTAMP(3);

CREATE INDEX "Registration_status_proofDeadlineAt_idx" ON "Registration"("status", "proofDeadlineAt");
