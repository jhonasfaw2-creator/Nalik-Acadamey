# Chapa API v2 payment setup

This integration accepts Chapa TEST (`CHAPA_TEST_...`) and LIVE
(`CHAPA_LIVE_...`) secret keys and derives the expected webhook mode from the
key prefix. Validate the complete flow with TEST credentials before switching
the deployed key to LIVE.

## Before deploying

1. **Rotate the Chapa secret key and webhook secret.** The original TEST
   credentials were temporarily placed in `.env.example` during setup. That file
   has been restored to placeholders, but rotate both values before using them
   again.
2. Create or select an **isolated Neon test branch/database**. Do not apply this
   migration to the production database for preview testing.
3. Add these Vercel **Preview** environment variables:
   - `DATABASE_URL`: pooled connection string for the isolated test database.
   - `CHAPA_SECRET_KEY`: newly rotated `CHAPA_TEST_...` (or `CHAPA_LIVE_...`)
     secret key. The prefix determines the environment the app enforces.
   - `CHAPA_WEBHOOK_SECRET`: the webhook signing secret configured in Chapa for
     the same environment as the key.
   - `NEXT_PUBLIC_APP_URL`: the exact HTTPS URL of the deployment. The server
     sends `<origin>/checkout/return` as the hosted-checkout `return_url`.
   - Existing app settings required by the deployment, including `SESSION_SECRET`.
4. Apply the migration to the isolated test database using its **direct,
   unpooled** Neon connection string:

   ```sh
   DATABASE_URL='<direct test database URL>' npx prisma migrate deploy
   DATABASE_URL='<direct test database URL>' npm run db:verify
   ```

   Keep the direct URL in your local secret store or terminal environment; do
   not commit it. The application deployment should use the pooled `DATABASE_URL`.
5. Deploy the code to a Vercel environment. In Chapa's dashboard for the same
   mode as `CHAPA_SECRET_KEY`, configure:
   - Return URL: `https://<host>/checkout/return`
   - Webhook URL: `https://<host>/api/payments/webhook` (the
     `/api/webhooks/chapa` handler is re-exported there)
   - Signature authentication with the same secret as `CHAPA_WEBHOOK_SECRET`.

   The server also sends the documented `return_url` field at initialization
   when `NEXT_PUBLIC_APP_URL` is an HTTPS origin.

## Run the application checks

```sh
npm run typecheck
npm run test:payments
npm run build
```

Then submit a registration on the deployment and complete checkout with Chapa's
documented payment details for the configured mode. Verify all of the following:

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

A real end-to-end payment still requires a human to complete Chapa's hosted
checkout; code checks alone cannot prove production fulfillment.

## Payment endpoints

- `POST /api/registrations` — create pending registration and payment.
- `POST /api/payments/initialize` — initialize hosted checkout and set the
  HttpOnly payment-session cookie.
- `POST /api/payments/verify` — verify a payment server-side after return.
- `POST /api/payments/retry` — create or reuse an eligible pending retry attempt.
- `POST /api/webhooks/chapa` — verify the raw-body `x-chapa-signature`, reverify
  with Chapa, then update payment and enrollment idempotently.
- `POST /api/payments/webhook` — canonical alias that re-exports the same handler.

Chapa API v2 calls:

- `POST https://api.chapa.global/v2/payments/hosted`
- `GET https://api.chapa.global/v2/payments/{reference}/verify`
- `GET https://api.chapa.global/v2/payments?limit=50` (resolves the Chapa
  reference by merchant reference after completion)

## Reference and amount handling

- The `merchant_reference` is created before checkout and is the durable key.
- The trailing segment of `checkout_url` is a checkout-session reference, not
  the payment reference Chapa accepts after completion. The app stores the real
  `chapa_reference` returned by verification or the webhook.
- If verification by merchant reference is rejected after completion, the app
  resolves `chapa_reference` from the newest-first payment list and verifies
  with that reference.
- Verification reports the initialized amount (net). Webhooks and the payment
  list may report the gross amount with `service_fee`; both `amount` and
  `amount - service_fee` are accepted against the stored amount.

Keep `CHAPA_SECRET_KEY` and `CHAPA_WEBHOOK_SECRET` server-side. Do not put real
credentials in `.env.example`, client code, or source control.
