// Manually issue a signed DearDiary license key (e.g. for support, comps,
// or testing). The same signing logic runs in server/worker.mjs.
//
//   node scripts/issue-license.mjs --email you@example.com --plan lifetime
//   node scripts/issue-license.mjs --email you@example.com --plan annual [--days 366]
//   node scripts/issue-license.mjs ... --key path/to/license-private.pem
//
// Defaults to the DEVELOPMENT key in server/dev-keys/ — use --key with your
// production private key for real customers.
import { createPrivateKey, sign } from 'node:crypto'
import { readFileSync } from 'node:fs'

function arg(name, fallback = undefined) {
  const i = process.argv.indexOf(`--${name}`)
  return i > -1 ? process.argv[i + 1] : fallback
}

const email = arg('email')
const plan = arg('plan')
const days = Number(arg('days', '366'))
const keyPath = arg('key', 'server/dev-keys/license-private.pem')

if (!email || !['lifetime', 'annual'].includes(plan)) {
  console.error(
    'Usage: node scripts/issue-license.mjs --email <email> --plan <lifetime|annual> [--days 366] [--key <private.pem>]'
  )
  process.exit(1)
}

const payload = {
  email,
  plan,
  iat: Date.now(),
  exp: plan === 'annual' ? Date.now() + days * 24 * 60 * 60_000 : null
}

const privateKey = createPrivateKey(readFileSync(keyPath, 'utf8'))
const body = Buffer.from(JSON.stringify(payload)).toString('base64url')
const sig = sign(null, Buffer.from(body, 'utf8'), privateKey).toString('base64url')
const key = `DDRY-${body}.${sig}`

console.log(`\nLicense for ${email} (${plan}${plan === 'annual' ? `, ${days} days` : ''}):\n`)
console.log(key)
console.log()
