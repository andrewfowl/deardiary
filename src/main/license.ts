import { createPrivateKey, createPublicKey, sign, verify } from 'node:crypto'
import type { LicensePlan, LicenseStatus } from '../shared/types'

export const TRIAL_DAYS = 14
const DAY_MS = 24 * 60 * 60_000
const KEY_RE = /^DDRY-([A-Za-z0-9_-]+)\.([A-Za-z0-9_-]+)$/

/**
 * Public key used to verify license signatures. Keys are issued by the
 * licensing service (server/) or scripts/issue-license.mjs with the matching
 * private key. This is the DEVELOPMENT key — regenerate with
 * scripts/license-keygen.mjs and replace before a production release.
 */
export const LICENSE_PUBLIC_KEY_PEM = `-----BEGIN PUBLIC KEY-----
MCowBQYDK2VwAyEAtuoGV6oYIm8yK4sDeQjLB3D58ilbUw9IlofhyuyQsrg=
-----END PUBLIC KEY-----`

export interface LicensePayload {
  email: string
  plan: LicensePlan
  /** Issued at (epoch ms). */
  iat: number
  /** Expiry (epoch ms) — required for annual, null for lifetime. */
  exp: number | null
}

/** Sign a payload into a distributable `DDRY-…` key (used by tests/tools). */
export function createLicenseKey(payload: LicensePayload, privateKeyPem: string): string {
  const body = Buffer.from(JSON.stringify(payload)).toString('base64url')
  const sig = sign(null, Buffer.from(body, 'utf8'), createPrivateKey(privateKeyPem))
  return `DDRY-${body}.${sig.toString('base64url')}`
}

/** Verify a key's signature and shape. Returns null for anything invalid. */
export function parseLicenseKey(
  key: string,
  publicKeyPem: string = LICENSE_PUBLIC_KEY_PEM
): LicensePayload | null {
  const match = KEY_RE.exec(key.trim())
  if (!match) return null
  const [, body, sigB64] = match
  try {
    const ok = verify(
      null,
      Buffer.from(body, 'utf8'),
      createPublicKey(publicKeyPem),
      Buffer.from(sigB64, 'base64url')
    )
    if (!ok) return null
    const raw = JSON.parse(Buffer.from(body, 'base64url').toString('utf8')) as Record<
      string,
      unknown
    >
    if (typeof raw.email !== 'string' || raw.email.length === 0) return null
    if (raw.plan !== 'lifetime' && raw.plan !== 'annual') return null
    const exp = typeof raw.exp === 'number' ? raw.exp : null
    if (raw.plan === 'annual' && exp === null) return null
    return {
      email: raw.email,
      plan: raw.plan,
      iat: typeof raw.iat === 'number' ? raw.iat : 0,
      exp
    }
  } catch {
    return null
  }
}

/**
 * Resolve the current entitlement from the stored key + trial start.
 * An invalid stored key falls back to trial evaluation.
 */
export function evaluateLicense(
  storedKey: string | null,
  trialStartTs: number,
  now: number = Date.now(),
  publicKeyPem: string = LICENSE_PUBLIC_KEY_PEM
): LicenseStatus {
  const trialEndsAt = trialStartTs + TRIAL_DAYS * DAY_MS
  const trialDaysLeft = Math.max(0, Math.ceil((trialEndsAt - now) / DAY_MS))

  if (storedKey) {
    const payload = parseLicenseKey(storedKey, publicKeyPem)
    if (payload) {
      const active = payload.plan === 'lifetime' || (payload.exp !== null && now < payload.exp)
      return {
        state: active ? 'licensed' : 'license_expired',
        plan: payload.plan,
        email: payload.email,
        expiresAt: payload.exp,
        trialDaysLeft,
        trialEndsAt
      }
    }
  }

  return {
    state: now < trialEndsAt ? 'trial' : 'trial_expired',
    plan: null,
    email: null,
    expiresAt: null,
    trialDaysLeft,
    trialEndsAt
  }
}

/** Whether recording/analysis may run under this entitlement. */
export function isRecordingAllowed(status: LicenseStatus): boolean {
  return status.state === 'trial' || status.state === 'licensed'
}

/** Annual licenses show a renewal nudge in the last 14 days. */
export function needsRenewalSoon(status: LicenseStatus, now: number = Date.now()): boolean {
  return (
    status.state === 'licensed' &&
    status.plan === 'annual' &&
    status.expiresAt !== null &&
    status.expiresAt - now < TRIAL_DAYS * DAY_MS
  )
}
