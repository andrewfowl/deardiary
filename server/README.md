# DearDiary licensing service

A small Cloudflare Worker that issues license keys when Stripe checkouts
complete. Keys are **Ed25519-signed and verified offline by the app** — this
service is only involved at purchase time, never at app runtime.

## How the whole flow works

```
 website pricing card ──▶ Stripe Payment Link (lifetime: one-time $49,
        │                                     annual: $19/yr subscription)
        │ success redirect: https://deardiary.app/activate.html?session_id={CHECKOUT_SESSION_ID}
        ▼
 Stripe webhook checkout.session.completed
        ▼
 worker.mjs verifies the webhook signature, signs a license key
 (lifetime: no expiry / annual: +366 days), stores it in KV
        ▼
 activate.html polls GET /license?session_id=… and shows the key
        ▼
 customer pastes the key into DearDiary → Settings → License
 (verified locally against the public key embedded in the app)
```

Annual renewals: on `invoice.paid` (billing_reason `subscription_cycle`) a
fresh key is issued and stored under the subscription ID. Email the new key to
the customer from your Stripe receipt flow, or extend the worker with an email
provider.

## Setup

1. **Generate a production keypair** (do NOT use `dev-keys/` for production):

   ```bash
   node ../scripts/license-keygen.mjs prod-keys
   ```

   Paste the public key into `LICENSE_PUBLIC_KEY_PEM` in
   `src/main/license.ts` and rebuild the app.

2. **Stripe**: create two products —
   - *DearDiary Lifetime*: one-time price (e.g. $49), Payment Link with
     success URL `https://deardiary.app/activate.html?session_id={CHECKOUT_SESSION_ID}`
   - *DearDiary Annual*: recurring yearly price (e.g. $19/yr), same success URL

   Add a webhook endpoint pointing at
   `https://<your-worker>/stripe/webhook` subscribed to
   `checkout.session.completed` and `invoice.paid`; note its `whsec_…` secret.

3. **Deploy the worker**:

   ```bash
   cp wrangler.toml.example wrangler.toml   # fill in KV namespace id + origin
   npx wrangler kv namespace create LICENSES
   npx wrangler secret put STRIPE_WEBHOOK_SECRET
   npx wrangler secret put LICENSE_PRIVATE_KEY_PEM   # paste prod-keys/license-private.pem
   npx wrangler deploy
   ```

4. Point the **Buy** buttons in `website/index.html` at your Stripe Payment
   Links, and set the worker URL in `website/activate.html`.

## Manual issuance (support, comps, refund replacements)

```bash
node ../scripts/issue-license.mjs --email customer@example.com --plan lifetime --key prod-keys/license-private.pem
```

## dev-keys/

`dev-keys/` contains a development keypair matching the public key currently
embedded in the app, so the end-to-end flow works out of the box. Anyone with
this repo can sign keys the dev build accepts — **replace both halves before
selling anything.**
