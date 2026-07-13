import { describe, expect, it } from 'vitest'
import { generateKeyPairSync } from 'node:crypto'
import {
  createLicenseKey,
  evaluateLicense,
  isRecordingAllowed,
  needsRenewalSoon,
  parseLicenseKey,
  TRIAL_DAYS,
  type LicensePayload
} from '../src/main/license'

const DAY_MS = 24 * 60 * 60_000
const NOW = Date.parse('2026-07-13T12:00:00Z')

function keypair(): { pub: string; priv: string } {
  const { publicKey, privateKey } = generateKeyPairSync('ed25519')
  return {
    pub: publicKey.export({ type: 'spki', format: 'pem' }).toString(),
    priv: privateKey.export({ type: 'pkcs8', format: 'pem' }).toString()
  }
}

function lifetime(priv: string): string {
  const payload: LicensePayload = { email: 'a@b.com', plan: 'lifetime', iat: NOW, exp: null }
  return createLicenseKey(payload, priv)
}

function annual(priv: string, exp: number): string {
  const payload: LicensePayload = { email: 'a@b.com', plan: 'annual', iat: NOW, exp }
  return createLicenseKey(payload, priv)
}

describe('license keys', () => {
  it('round-trips a signed lifetime key', () => {
    const { pub, priv } = keypair()
    const parsed = parseLicenseKey(lifetime(priv), pub)
    expect(parsed).not.toBeNull()
    expect(parsed!.plan).toBe('lifetime')
    expect(parsed!.email).toBe('a@b.com')
    expect(parsed!.exp).toBeNull()
  })

  it('rejects keys signed with a different private key', () => {
    const { priv } = keypair()
    const { pub: otherPub } = keypair()
    expect(parseLicenseKey(lifetime(priv), otherPub)).toBeNull()
  })

  it('rejects tampered payloads', () => {
    const { pub, priv } = keypair()
    const key = lifetime(priv)
    const [prefix, sig] = key.split('.')
    const tamperedPayload = Buffer.from(
      JSON.stringify({ email: 'evil@x.com', plan: 'lifetime', iat: NOW, exp: null })
    ).toString('base64url')
    expect(parseLicenseKey(`DDRY-${tamperedPayload}.${sig}`, pub)).toBeNull()
    expect(prefix.startsWith('DDRY-')).toBe(true)
  })

  it('rejects malformed keys', () => {
    const { pub } = keypair()
    expect(parseLicenseKey('', pub)).toBeNull()
    expect(parseLicenseKey('DDRY-abc', pub)).toBeNull()
    expect(parseLicenseKey('not-a-key.at-all', pub)).toBeNull()
  })

  it('rejects annual keys without an expiry', () => {
    const { pub, priv } = keypair()
    const key = createLicenseKey(
      { email: 'a@b.com', plan: 'annual', iat: NOW, exp: null } as LicensePayload,
      priv
    )
    expect(parseLicenseKey(key, pub)).toBeNull()
  })
})

describe('evaluateLicense', () => {
  it('reports an active trial with correct days left', () => {
    const trialStart = NOW - 3 * DAY_MS
    const status = evaluateLicense(null, trialStart, NOW)
    expect(status.state).toBe('trial')
    expect(status.trialDaysLeft).toBe(TRIAL_DAYS - 3)
    expect(isRecordingAllowed(status)).toBe(true)
  })

  it('expires the trial after TRIAL_DAYS', () => {
    const trialStart = NOW - (TRIAL_DAYS + 1) * DAY_MS
    const status = evaluateLicense(null, trialStart, NOW)
    expect(status.state).toBe('trial_expired')
    expect(status.trialDaysLeft).toBe(0)
    expect(isRecordingAllowed(status)).toBe(false)
  })

  it('licenses a valid lifetime key forever', () => {
    const { pub, priv } = keypair()
    const status = evaluateLicense(lifetime(priv), NOW - 100 * DAY_MS, NOW, pub)
    expect(status.state).toBe('licensed')
    expect(status.plan).toBe('lifetime')
    expect(isRecordingAllowed(status)).toBe(true)
  })

  it('licenses an annual key until its expiry, then expires it', () => {
    const { pub, priv } = keypair()
    const key = annual(priv, NOW + 30 * DAY_MS)
    expect(evaluateLicense(key, 0, NOW, pub).state).toBe('licensed')
    expect(evaluateLicense(key, 0, NOW + 31 * DAY_MS, pub).state).toBe('license_expired')
  })

  it('falls back to trial evaluation when the stored key is garbage', () => {
    const status = evaluateLicense('DDRY-garbage.key', NOW - DAY_MS, NOW)
    expect(status.state).toBe('trial')
  })
})

describe('needsRenewalSoon', () => {
  it('flags annual licenses inside the renewal window only', () => {
    const { pub, priv } = keypair()
    const soon = evaluateLicense(annual(priv, NOW + 5 * DAY_MS), 0, NOW, pub)
    const later = evaluateLicense(annual(priv, NOW + 60 * DAY_MS), 0, NOW, pub)
    const life = evaluateLicense(lifetime(priv), 0, NOW, pub)
    expect(needsRenewalSoon(soon, NOW)).toBe(true)
    expect(needsRenewalSoon(later, NOW)).toBe(false)
    expect(needsRenewalSoon(life, NOW)).toBe(false)
  })
})
