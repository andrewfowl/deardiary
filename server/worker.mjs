/**
 * DearDiary licensing service — Cloudflare Worker.
 *
 * Issues Ed25519-signed license keys when Stripe checkouts complete, and lets
 * the website's activation page retrieve the key afterwards. License keys are
 * verified OFFLINE by the app; this service is only involved at purchase time.
 *
 * Routes:
 *   POST /stripe/webhook      Stripe webhook (checkout.session.completed,
 *                             invoice.paid for annual renewals)
 *   GET  /license?session_id= Retrieve the key for a completed checkout
 *                             (used by website/activate.html)
 *   GET  /health              Liveness probe
 *
 * Required bindings/secrets (see wrangler.toml.example):
 *   LICENSES                  KV namespace
 *   STRIPE_WEBHOOK_SECRET     whsec_… from the Stripe webhook endpoint
 *   LICENSE_PRIVATE_KEY_PEM   Ed25519 PKCS8 private key (from
 *                             scripts/license-keygen.mjs). Must match
 *                             LICENSE_PUBLIC_KEY_PEM embedded in the app.
 *   ALLOWED_ORIGIN            Website origin for CORS, e.g. https://deardiary.app
 */

const ANNUAL_DAYS = 366

export default {
  async fetch(request, env) {
    const url = new URL(request.url)
    if (url.pathname === '/health') return json({ ok: true })
    if (url.pathname === '/stripe/webhook' && request.method === 'POST') {
      return handleStripeWebhook(request, env)
    }
    if (url.pathname === '/license' && request.method === 'GET') {
      return handleGetLicense(url, env)
    }
    if (request.method === 'OPTIONS') return cors(new Response(null, { status: 204 }), env)
    return json({ error: 'not found' }, 404)
  }
}

// --- Stripe webhook ---

async function handleStripeWebhook(request, env) {
  const payload = await request.text()
  const signature = request.headers.get('stripe-signature') ?? ''
  if (!(await verifyStripeSignature(payload, signature, env.STRIPE_WEBHOOK_SECRET))) {
    return json({ error: 'bad signature' }, 400)
  }

  const event = JSON.parse(payload)

  if (event.type === 'checkout.session.completed') {
    const session = event.data.object
    const email = session.customer_details?.email ?? session.customer_email
    if (!email) return json({ error: 'no email on session' }, 400)

    // One-time payments are lifetime licenses; subscriptions are annual.
    const plan = session.mode === 'subscription' ? 'annual' : 'lifetime'
    const key = await issueKey(env, email, plan)

    const record = JSON.stringify({ key, email, plan, issuedAt: Date.now() })
    await env.LICENSES.put(`session:${session.id}`, record)
    if (session.subscription) {
      await env.LICENSES.put(`sub:${session.subscription}`, record)
    }
    return json({ received: true })
  }

  if (event.type === 'invoice.paid') {
    // Annual renewal: issue a fresh key valid for another year. The customer
    // retrieves it from their receipt link / support; the old key simply
    // expires on its original date.
    const invoice = event.data.object
    if (invoice.billing_reason === 'subscription_cycle' && invoice.subscription) {
      const email = invoice.customer_email
      if (email) {
        const key = await issueKey(env, email, 'annual')
        await env.LICENSES.put(
          `sub:${invoice.subscription}`,
          JSON.stringify({ key, email, plan: 'annual', issuedAt: Date.now() })
        )
      }
    }
    return json({ received: true })
  }

  return json({ received: true, ignored: event.type })
}

/** Stripe signature scheme: HMAC-SHA256 over `${t}.${payload}` with the endpoint secret. */
async function verifyStripeSignature(payload, header, secret) {
  const parts = Object.fromEntries(
    header.split(',').map((kv) => {
      const i = kv.indexOf('=')
      return [kv.slice(0, i), kv.slice(i + 1)]
    })
  )
  const timestamp = parts.t
  const expected = parts.v1
  if (!timestamp || !expected || !secret) return false
  // Reject events older than 5 minutes (replay protection).
  if (Math.abs(Date.now() / 1000 - Number(timestamp)) > 300) return false

  const keyMaterial = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign']
  )
  const mac = await crypto.subtle.sign(
    'HMAC',
    keyMaterial,
    new TextEncoder().encode(`${timestamp}.${payload}`)
  )
  const hex = [...new Uint8Array(mac)].map((b) => b.toString(16).padStart(2, '0')).join('')
  return timingSafeEqual(hex, expected)
}

function timingSafeEqual(a, b) {
  if (a.length !== b.length) return false
  let diff = 0
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i)
  return diff === 0
}

// --- key retrieval (website/activate.html) ---

async function handleGetLicense(url, env) {
  const sessionId = url.searchParams.get('session_id') ?? ''
  if (!/^cs_[a-zA-Z0-9_]+$/.test(sessionId)) {
    return cors(json({ error: 'invalid session id' }, 400), env)
  }
  const record = await env.LICENSES.get(`session:${sessionId}`)
  if (!record) {
    // Webhook may lag checkout completion by a few seconds; the page retries.
    return cors(json({ pending: true }, 404), env)
  }
  const { key, email, plan } = JSON.parse(record)
  return cors(json({ key, email, plan }), env)
}

// --- license signing (mirrors scripts/issue-license.mjs) ---

async function issueKey(env, email, plan) {
  const payload = {
    email,
    plan,
    iat: Date.now(),
    exp: plan === 'annual' ? Date.now() + ANNUAL_DAYS * 24 * 60 * 60_000 : null
  }
  const body = base64url(new TextEncoder().encode(JSON.stringify(payload)))
  const privateKey = await crypto.subtle.importKey(
    'pkcs8',
    pemToDer(env.LICENSE_PRIVATE_KEY_PEM),
    { name: 'Ed25519' },
    false,
    ['sign']
  )
  const sig = await crypto.subtle.sign('Ed25519', privateKey, new TextEncoder().encode(body))
  return `DDRY-${body}.${base64url(new Uint8Array(sig))}`
}

function pemToDer(pem) {
  const b64 = pem.replace(/-----[^-]+-----/g, '').replace(/\s+/g, '')
  const bin = atob(b64)
  const bytes = new Uint8Array(bin.length)
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i)
  return bytes.buffer
}

function base64url(bytes) {
  let bin = ''
  for (const b of bytes) bin += String.fromCharCode(b)
  return btoa(bin).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
}

// --- helpers ---

function json(obj, status = 200) {
  return new Response(JSON.stringify(obj), {
    status,
    headers: { 'content-type': 'application/json' }
  })
}

function cors(response, env) {
  const headers = new Headers(response.headers)
  headers.set('access-control-allow-origin', env.ALLOWED_ORIGIN ?? '*')
  headers.set('access-control-allow-methods', 'GET, OPTIONS')
  return new Response(response.body, { status: response.status, headers })
}
