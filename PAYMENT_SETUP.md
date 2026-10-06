# Chapa API v2 TEST setup

This integration is restricted to Chapa TEST-mode credentials. It intentionally
rejects LIVE keys until the TEST flow has been validated and a separate live-mode
change is prepared.

## Before deploying

1. **Rotate the TEST secret key and webhook secret in Chapa.** The original TEST
   credentials were temporarily placed in `.env.example` during setup. That file
   has been restored to placeholders, but rotate both values before using them
   again.
2. Create or select an **isolated Neon test branch/database**. Do not apply this
   migration to the production database for preview testing.
3. Add these Vercel **Preview** environment variables:
   - `DATABASE_URL`: pooled connection string for the isolated test database.
   - `CHAPA_SECRET_KEY`: newly rotated `CHAPA_TEST_...` secret key.
   - `CHAPA_WEBHOOK_SECRET`: the webhook signing secret configured in Chapa.
   - `NEXT_PUBLIC_APP_URL`: the exact HTTPS URL of the preview deployment.
   - Existing app settings required by the deployment, including `SESSION_SECRET`.
4. Apply the migration to the isolated test database using its **direct,
   unpooled** Neon connection string:

   ```sh
   DATABASE_URL='<direct test database URL>' npx prisma migrate deploy
   DATABASE_URL='<direct test database URL>' npm run db:verify
   ```

   Keep the direct URL in your local secret store or terminal environment; do
   not commit it. The application deployment should use the pooled `DATABASE_URL`.
5. Deploy the code to a Vercel Preview environment. In Chapa's **Test** dashboard,
   configure:
   - Return URL: `https://<preview-host>/checkout/return`
   - Webhook URL: `https://<preview-host>/api/webhooks/chapa`
   - Signature authentication with the same secret as `CHAPA_WEBHOOK_SECRET`.

   Return/callback fields are not added to the initialize request because the v2
   Hosted Payments documentation does not specify those request fields.

## Run the application checks

```sh
npm run typecheck
npm run test:payments
npm run build
```

Then submit a registration on the Preview deployment and complete checkout with
Chapa's documented TEST payment details. Verify all of the following:

- A pending registration and payment are created.
- The student is redirected to Chapa hosted checkout.
- Chapa's signed webhook reaches `/api/webhooks/chapa`; duplicate delivery does
  not create another enrollment.
- Chapa verification matches the stored merchant reference, Chapa reference,
  amount, and currency.
- Only verified success changes the registration to `CONFIRMED` and increments
  the schedule enrollment once.
- The return page and registration lookup show confirmation/download access only
  after the server records verified success.
- Failed, cancelled, incomplete, pending, and invalid payments do not confirm the
  registration.

The direct Chapa TEST checkout and v2 verification have succeeded, but the
application webhook/registration flow has not yet been exercised on a Preview
deployment.

## Payment endpoints

- `POST /api/registrations` — create pending registration and payment.
- `POST /api/payments/initialize` — initialize hosted checkout and set the
  HttpOnly payment-session cookie.
- `POST /api/payments/verify` — verify a payment server-side after return.
- `POST /api/payments/retry` — create or reuse an eligible pending retry attempt.
- `POST /api/webhooks/chapa` — verify the raw-body `x-chapa-signature`, reverify
  with Chapa, then update payment and enrollment idempotently.

Chapa API v2 calls:

- `POST https://api.chapa.global/v2/payments/hosted`
- `GET https://api.chapa.global/v2/payments/{reference}/verify`

Keep `CHAPA_SECRET_KEY` and `CHAPA_WEBHOOK_SECRET` server-side. Do not put real
credentials in `.env.example`, client code, or source control.
