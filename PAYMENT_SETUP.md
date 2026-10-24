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

After deploying the Telegram webhook route, run:

```sh
npm run telegram:webhook:set
```

## Review flow

1. The application creates a pending registration and its payment record.
2. The student transfers the displayed amount and uploads a JPG, PNG, or WebP
   receipt.
3. The receipt is stored privately and the admin receives the student's name,
   course, amount, reference, and Approve/Reject buttons in Telegram.
4. Approval marks the payment successful, confirms enrollment, and reserves the
   schedule seat in one database transaction. Rejection leaves enrollment
   pending so the student can submit a replacement receipt.

The payment table stores ETB amounts in minor units (100 units per Birr). The
older hosted-checkout columns and migrations are retained for historical data;
the application no longer calls or exposes the hosted-checkout provider.

## Local checks

```sh
npm run typecheck
npm run build
```
