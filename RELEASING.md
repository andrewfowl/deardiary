# Releasing DearDiary

The download channel is **the website**: the release pipeline publishes the
installer to a Cloudflare R2 bucket served at `https://dl.deardiary.app`, and
`website/download.html` links to it (stable URL + version/checksum from
`latest.json`). GitHub is used only for code and CI.

```
git tag v0.2.0 ──▶ release.yml
                    ├─ test + typecheck + dev-key guard
                    ├─ build NSIS installer on windows-latest (signed if AZURE_* set)
                    └─ publish to R2:
                         DearDiary-Setup-0.2.0.exe   (versioned)
                         DearDiary-Setup.exe         (stable URL)
                         latest.json                 (download page metadata)
                         latest.yml                  (future auto-update feed)
website/** on main ──▶ deploy-website.yml ──▶ Cloudflare Pages
```

## One-time setup

### 1. Rotate the license signing key  ← REQUIRED before the first real release

The repo ships a **development** keypair (`server/dev-keys/`) so the flow works
out of the box — which also means anyone with the repo can mint license keys
that dev builds accept. Rotation makes that key worthless: license keys are
only as good as the public key the shipped app trusts.

On a trusted machine:

```bash
node scripts/license-keygen.mjs prod-keys        # prod-keys/ is gitignored territory — do NOT commit
```

1. Paste `prod-keys/license-public.pem` into `LICENSE_PUBLIC_KEY_PEM` in
   `src/main/license.ts` and commit that (the public key is safe to publish).
2. Store `prod-keys/license-private.pem` in exactly two places: the licensing
   worker's secret (`npx wrangler secret put LICENSE_PRIVATE_KEY_PEM`) and a
   password manager. Then delete the local file.
3. Done. The committed dev key can stay for development — production builds no
   longer trust it, so it can't mint valid licenses for customers.

`release.yml` runs `scripts/check-license-key.mjs` and **fails the release**
if the app still trusts the dev key. For a pipeline dry-run before rotating,
set the repository *variable* `ALLOW_DEV_LICENSE_KEY=1` (and unset it after).

### 2. Cloudflare (hosting + downloads)

1. Create a **Pages project** named `deardiary`, custom domain `deardiary.app`.
2. Create an **R2 bucket** named `deardiary-downloads`; attach the custom
   domain `dl.deardiary.app`. Add a CORS rule allowing `GET` from
   `https://deardiary.app` (lets download.html read `latest.json`).
3. Create an API token with *Pages: Edit* + *R2: Edit*; add GitHub repo
   secrets `CLOUDFLARE_API_TOKEN` and `CLOUDFLARE_ACCOUNT_ID`.

Without these secrets both workflows still run — they just skip publishing
with a warning, and the installer stays available as a workflow artifact.

### 3. Code signing (Azure Trusted Signing)  ← strongly recommended

Unsigned installers trigger SmartScreen's "Windows protected your PC" on
most machines, which is fatal for conversion on a paid screen recorder.
**Azure Trusted Signing** is the cheapest CI-friendly fix (~$10/month, no
hardware token, short-lived certs managed by Azure):

1. In Azure: create a *Trusted Signing* account + identity validation
   (individual or org) + a certificate profile.
2. Create an Entra service principal with the *Trusted Signing Certificate
   Profile Signer* role.
3. Add repo secrets: `AZURE_TENANT_ID`, `AZURE_CLIENT_ID`,
   `AZURE_CLIENT_SECRET`, `AZURE_SIGNING_ENDPOINT` (e.g.
   `https://eus.codesigning.azure.net`), `AZURE_SIGNING_ACCOUNT`,
   `AZURE_SIGNING_PROFILE`.

`release.yml` signs automatically when these secrets exist and clearly labels
the build step "UNSIGNED" when they don't. SmartScreen reputation then accrues
per signed publisher — expect residual warnings for the first days/downloads.
(Alternatives: OV cert ≈$100+/yr with cloud signing, or EV ≈$300/yr for
instant reputation; both are more hassle in CI.)

### 4. Stripe (payments)

1. Two products: *Lifetime* ($49 one-time) and *Annual* ($19/yr recurring),
   each with a Payment Link whose success URL is
   `https://deardiary.app/activate.html?session_id={CHECKOUT_SESSION_ID}`.
2. Replace the two `buy.stripe.com/REPLACE_*` hrefs in `website/index.html`.
3. Deploy the licensing worker (`server/README.md`) with the **production**
   private key, and confirm `website/activate.html`'s `LICENSE_API` matches
   the worker URL.

## Every release

1. Bump `version` in `package.json`; commit to `main`.
2. `git tag v<version> && git push origin v<version>`.
3. Watch the **Release** workflow: tests → dev-key guard → Windows build →
   publish. Verify `https://deardiary.app/download.html` shows the new
   version and checksum.
4. **Smoke-test on a real Windows machine** (non-negotiable for the first few
   releases): install, complete onboarding, confirm capture + first timeline
   batch + license activation with a key from
   `node scripts/issue-license.mjs --key <prod private key>`.

## Known manual steps (acceptable for launch, automate later)

- **Annual renewal keys**: the worker issues a fresh key on `invoice.paid`
  but nothing emails it — send it manually from the Stripe dashboard, or add
  an email provider (e.g. Resend) to `server/worker.mjs`.
- **Auto-update**: `latest.yml` is already published to the download bucket,
  so wiring `electron-updater` (generic provider, `https://dl.deardiary.app`)
  is a small app-side change when ready.
- **Website deploys** run on pushes to `main` touching `website/**`; run the
  workflow manually for the first deploy.
