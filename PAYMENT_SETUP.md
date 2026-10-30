# Registration payments

Nalik Academy currently collects course payments by bank transfer or Telebirr.
Students submit an application, receive payment instructions and an application
reference, then upload a receipt for review. A registration is not enrolled
until an admin approves the receipt.

## Required environment variables

- `BLOB_READ_WRITE_TOKEN` — private storage for uploaded receipts.
- `TELEGRAM_BOT_TOKEN` — sends new proof notifications and handles review
  buttons.
- `TELEGRAM_CHAT_ID` — the admin chat allowed to approve or reject proofs.
- `TELEGRAM_WEBHOOK_SECRET` — authenticates Telegram callback requests.
- `APP_URL` or `NEXT_PUBLIC_APP_URL` — public HTTPS app URL used for the admin
  link in Telegram notifications.
- `CRON_SECRET` — Bearer token Vercel Cron sends to the expiration endpoint.
  Required in production; without it the endpoint refuses to run.

After deploying the Telegram webhook route, run:

```sh
npm run telegram:webhook:set
```

## Review flow

1. The application creates a pending registration and its payment record.
2. The student transfers the displayed amount and uploads a JPG, PNG, or WebP
   receipt.
3. The receipt is stored privately and sent as a Telegram photo with the
   student's name, course, amount, reference, and Approve/Reject buttons. If
   Telegram cannot accept the image, a text notification is sent instead and
   the original remains available in the admin dashboard.
4. Approval marks the payment successful, confirms enrollment, and reserves the
   schedule seat in one database transaction. Rejection leaves enrollment
   pending so the student can submit a replacement receipt.

The payment table stores ETB amounts in minor units (100 units per Birr). The
older hosted-checkout columns and migrations are retained for historical data;
the application no longer calls or exposes the hosted-checkout provider.

## 24-hour payment-proof deadline

Public registrations record `proofDeadlineAt` (creation time + 24 hours, stored
in UTC). The deadline is shown on the payment step and on the registration-check
page, which also lets a student return with their reference ID, confirm the
phone number on the registration, and upload the bank-transfer screenshot
without registering again.

`vercel.json` schedules `/api/cron/expire-registrations` every 15 minutes. The
job marks overdue registrations with `status = EXPIRED` and `expiredAt`, and
`GET /api/admin/registrations` sweeps once more before listing, so expiration
does not depend on a student visiting the site. Expired rows are removed from
the active admin list but kept in the database (soft expiration).

- Only `PENDING` registrations with `paymentProofStatus = NOT_SUBMITTED` expire;
  submitted proofs (pending review) and verified payments never expire.
- The proof upload re-checks the deadline inside its database update, so a
  screenshot that arrives after the cutoff is rejected even during a sweep.
- Manual admin enrolments have no `proofDeadlineAt` and never expire.
- Vercel plan limits may cap the cron frequency; adjust the schedule in
  `vercel.json` if deployment rejects the every-15-minutes expression.

## Local checks

```sh
npm run typecheck
npm run build
```
