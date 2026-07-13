// Generates a fresh Ed25519 license keypair.
//
//   node scripts/license-keygen.mjs [outputDir]
//
// After generating a PRODUCTION keypair:
//   1. Paste the public key into LICENSE_PUBLIC_KEY_PEM (src/main/license.ts).
//   2. Store the private key in your licensing service secrets
//      (server/ — LICENSE_PRIVATE_KEY_PEM). NEVER commit it.
import { generateKeyPairSync } from 'node:crypto'
import { mkdirSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'

const outDir = process.argv[2] ?? 'license-keys'
mkdirSync(outDir, { recursive: true })

const { publicKey, privateKey } = generateKeyPairSync('ed25519')
const pub = publicKey.export({ type: 'spki', format: 'pem' }).toString()
const priv = privateKey.export({ type: 'pkcs8', format: 'pem' }).toString()

writeFileSync(join(outDir, 'license-public.pem'), pub)
writeFileSync(join(outDir, 'license-private.pem'), priv, { mode: 0o600 })

console.log(`Wrote ${outDir}/license-public.pem and ${outDir}/license-private.pem\n`)
console.log('Public key (paste into src/main/license.ts):\n')
console.log(pub)
