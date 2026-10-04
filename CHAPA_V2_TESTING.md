# Chapa V2 Sandbox Testing Guide

## Prerequisites

1. **Chapa Sandbox Account**: Create at https://developer.chapa.co
2. **Test Keys** (from Chapa Dashboard → Settings → API):
   - `CHAPA_SECRET_KEY` (format: `CHAPA_TEST_...`)
   - `NEXT_PUBLIC_CHAPA_PUBLIC_KEY` (format: `CHAPUBK_TEST_...`)
   - `CHAPA_WEBHOOK_SECRET` (from Settings → Webhooks)
3. **HTTPS Tunnel** for local development (ngrok/Cloudflare):
   ```bash
   ngrok http 3000
   # Set NGROK_URL=https://your-ngrok-url.ngrok.io in .env
   ```
4. **Database**: Neon PostgreSQL (configured via `DATABASE_URL`)

---

## Test 1: Payment Initialization Flow

### Step 1: Start Application
```bash
cd /home/johannes/Desktop/nalik-academy
npm run dev
```

### Step 2: Create Test Registration
```bash
curl -X POST http://localhost:3000/api/registrations \
  -H "Content-Type: application/json" \
  -d '{
    "fullName": "Test Student",
    "email": "test@example.com",
    "phone": "+251911223344",
    "age": 25,
    "courseId": "<COURSE_ID_FROM_DB>",
    "scheduleId": "<SCHEDULE_ID_FROM_DB>",
    "previousExperience": "Beginner",
    "motivation": "Learning"
  }'
```
**Expected**: Returns `referenceId` (e.g., `NA-2026-A1B2C3`)

### Step 3: Initialize Payment
```bash
curl -X POST http://localhost:3000/api/payments/chapa/init \
  -H "Content-Type: application/json" \
  -d '{"referenceId": "NA-2026-A1B2C3"}'
```

**Expected Response**:
```json
{
  "checkout_url": "https://checkout.chapa.global/payment/CHAPA_REF_123...",
  "merchantReference": "NA-2026-A1B2C3"
}
```

**Verify in DB**:
```sql
SELECT * FROM "Payment" WHERE "applicationId" = (SELECT id FROM "Application" WHERE "referenceId" = 'NA-2026-A1B2C3');
-- Should show: status=PENDING, merchantReference=NA-2026-A1B2C3, chapaReference=CHAPA_REF_123...
```

---

## Test 2: Chapa Checkout & Redirect Flow

### Step 1: Open Checkout URL
Open the `checkout_url` in browser:
- Complete test payment using Chapa sandbox test cards/phones
- **Test Phone**: `+251900000000` (Telebirr sandbox)
- **Test Card**: `4242 4242 4242 4242` (any future date, any CVV)

### Step 2: Observe Redirect
After payment, browser should redirect to:
```
https://your-domain.com/payment/complete?referenceId=NA-2026-A1B2C3&tx_ref=NA-2026-A1B2C3&chapa_reference=CHAPA_REF_123...
```

### Step 3: Verify Return Page Behavior
**Expected UI Sequence**:
1. "Verifying your payment" (spinner)
2. Immediate server-side verification call
3. "Payment Confirmed" with:
   - Payment slip download button
   - Course materials download links (if any)
   - "Go to Dashboard" button

---

## Test 3: Server-Side Verification (Webhook & API)

### Test 3a: Webhook Delivery
**Chapa Dashboard → Settings → Webhooks**:
- URL: `https://your-domain.com/api/payments/webhook`
- Secret: Same as `CHAPA_WEBHOOK_SECRET`
- Events: `payment.success`, `payment.failed`

**Trigger Test Webhook**:
```bash
curl -X POST https://your-domain.com/api/payments/webhook \
  -H "Content-Type: application/json" \
  -H "x-chapa-signature: $(echo -n '{"event":"payment.success","merchant_reference":"NA-2026-A1B2C3","chapa_reference":"CHAPA_REF_123","amount":"50000","currency":"ETB","status":"success"}' | openssl dgst -sha256 -hmac "$CHAPA_WEBHOOK_SECRET" | cut -d' ' -f2)" \
  -d '{"event":"payment.success","merchant_reference":"NA-2026-A1B2C3","chapa_reference":"CHAPA_REF_123","amount":"50000","currency":"ETB","status":"success"}'
```

**Expected**: Returns `{"received":true,"status":"SUCCESS"}`

**Verify DB**:
```sql
SELECT * FROM "Payment" WHERE "merchantReference" = 'NA-2026-A1B2C3';
-- status=SUCCESS, paidAt=timestamp, chapaReference=CHAPA_REF_123

SELECT * FROM "Application" WHERE "referenceId" = 'NA-2026-A1B2C3';
-- status=CONFIRMED, paidAt=timestamp
```

### Test 3b: Manual Verification API
```bash
curl "https://your-domain.com/api/payments/verify?referenceId=NA-2026-A1B2C3"
```

**Expected**:
```json
{
  "status": "SUCCESS",
  "registration": {
    "referenceId": "NA-2026-A1B2C3",
    "course": "Course Title",
    "courseId": "course-uuid",
    "paymentStatus": "SUCCESS",
    "registrationStatus": "CONFIRMED",
    ...
  }
}
```

---

## Test 4: Payment Slip / Receipt Download

### Step 1: Download Receipt
```bash
curl -L "https://your-domain.com/api/registrations/receipt?id=NA-2026-A1B2C3" \
  -o receipt.pdf
```

**Expected**: PDF file with:
- Nalik Academy branding
- Student name & registration ID
- Course title & schedule
- Amount paid, transaction references
- Payment date

### Step 2: Verify Unpaid Receipt Blocked
Create unpaid registration, then:
```bash
curl -L "https://your-domain.com/api/registrations/receipt?id=NA-2026-UNPAID"
```
**Expected**: `409 { "error": "This registration is not paid yet." }`

---

## Test 5: Course Materials Access

### Step 1: Add Test Course Materials (Admin)
```sql
INSERT INTO "CourseMaterial" (id, "courseId", title, "fileUrl", "fileType", "sortOrder")
VALUES 
  (gen_random_uuid(), '<COURSE_ID>', 'Lecture 1 - Introduction', 'https://example.com/lecture1.pdf', 'pdf', 1),
  (gen_random_uuid(), '<COURSE_ID>', 'Project Files', 'https://example.com/project.zip', 'zip', 2);
```

### Step 2: Access Materials (Paid Registration)
```bash
curl "https://your-domain.com/api/courses/<COURSE_ID>/materials?registrationId=NA-2026-A1B2C3"
```

**Expected**:
```json
{
  "materials": [
    {"id": "...", "title": "Lecture 1 - Introduction", "fileUrl": "https://example.com/lecture1.pdf", "fileType": "pdf"},
    {"id": "...", "title": "Project Files", "fileUrl": "https://example.com/project.zip", "fileType": "zip"}
  ]
}
```

### Step 3: Verify Unpaid Access Blocked
```bash
curl "https://your-domain.com/api/courses/<COURSE_ID>/materials?registrationId=NA-2026-UNPAID"
```
**Expected**: `409 { "error": "Course materials are only available for paid registrations." }`

---

## Test 6: Admin Dashboard Real-Time Updates

### Step 1: Open Admin Dashboard
Navigate to `/admin` and login.

### Step 2: Check Registrations List
Before payment: Status = `PENDING_PAYMENT`, Payment = `PENDING`

### Step 3: Complete Payment (via Chapa or Webhook)
After webhook/verify:
- Status updates to `CONFIRMED`
- Payment shows `SUCCESS` with transaction refs
- `enrolled` count increments on Schedule

### Step 4: Verify No Stale Data
Refresh admin page → new registrant appears instantly with correct status.

---

## Test 7: Edge Cases

### 7a: Abandoned Checkout → Retry
1. Start payment, close Chapa tab before paying
2. Click "Pay Now" again on registration page
3. **Expected**: New checkout session with `merchantReference` = `NA-2026-A1B2C3-2`

### 7b: Duplicate Payment Prevention
1. Complete payment
2. Try to initialize again for same registration
3. **Expected**: `409 { "error": "This registration is already paid.", "alreadyPaid": true }`

### 7c: Amount Mismatch Protection
Manually set wrong amount in DB, then trigger webhook:
```sql
UPDATE "Payment" SET amount = 1000 WHERE "merchantReference" = 'NA-2026-A1B2C3';
```
Trigger webhook with correct amount (50000)
**Expected**: Payment stays `PENDING`, `mismatch: "amount"` logged

### 7d: No Redirect Recovery
1. Configure Chapa dashboard Redirect URL to a non-existent page
2. Complete payment
3. Visit `/registration?id=NA-2026-A1B2C3` → click "I have paid — check my payment"
4. **Expected**: Triggers `/api/payments/verify`, updates status, shows success

---

## Test 8: Production Deployment Checklist

- [ ] `NEXT_PUBLIC_APP_URL` = production domain (e.g., `https://nalik-acadamey.vercel.app`)
- [ ] Chapa Dashboard Redirect URL = `https://nalik-acadamey.vercel.app/payment/complete`
- [ ] Chapa Dashboard Webhook URL = `https://nalik-acadamey.vercel.app/api/payments/webhook`
- [ ] `CHAPA_SECRET_KEY` = Live key (`CHAPA_LIVE_...`)
- [ ] `NEXT_PUBLIC_CHAPA_PUBLIC_KEY` = Live key (`CHAPUBK_LIVE_...`)
- [ ] `CHAPA_WEBHOOK_SECRET` = Live webhook secret
- [ ] `NGROK_URL` removed (production only)
- [ ] SSL/HTTPS enforced on all endpoints
- [ ] Rate limits appropriate for production traffic

---

## Debugging Commands

```bash
# Check recent payments
psql $DATABASE_URL -c "SELECT * FROM \"Payment\" ORDER BY \"createdAt\" DESC LIMIT 10;"

# Check webhook logs
vercel logs --follow  # or check platform logs

# Test verify endpoint directly
curl "https://your-domain.com/api/payments/verify?referenceId=NA-2026-A1B2C3"

# Check Chapa transaction list
curl -H "Authorization: Bearer $CHAPA_SECRET_KEY" \
  "https://api.chapa.global/v2/payments?reference=NA-2026-A1B2C3"
```

---

## Expected Test Results Summary

| Test | Success Criteria |
|------|------------------|
| Init | Returns `checkout_url` + `merchantReference`, DB row created PENDING |
| Checkout | Redirects to `/payment/complete` with `tx_ref` & `chapa_reference` |
| Return Page | Shows "Verifying" → "Payment Confirmed" with download buttons |
| Webhook | Updates Payment to SUCCESS, Application to CONFIRMED |
| Verify API | Returns SUCCESS with courseId for materials |
| Receipt | PDF downloads with correct details |
| Materials | Only accessible for paid registrations |
| Admin | Shows CONFIRMED instantly after webhook/verify |
| Retry | New merchantReference suffix (-2, -3) on abandoned checkout |
| Mismatch | Amount/currency mismatch blocks SUCCESS, logs for review |