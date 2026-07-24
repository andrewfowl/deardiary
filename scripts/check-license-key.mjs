// Release guard: refuses to proceed while the app still trusts the
// DEVELOPMENT license public key committed in server/dev-keys/. Anyone with
// this repository can sign licenses for that key, so shipping a build that
// trusts it would let anyone mint valid licenses.
//
// Fix: node scripts/license-keygen.mjs prod-keys, paste the new public key
// into LICENSE_PUBLIC_KEY_PEM (src/main/license.ts), and store the private
// key only in your licensing worker's secrets. See RELEASING.md.
//
// Override for pipeline dry-runs only: ALLOW_DEV_LICENSE_KEY=1
import { readFileSync, existsSync } from 'node:fs'

const normalize = (pem) => pem.replace(/\s+/g, '')

const licenseTs = readFileSync('src/main/license.ts', 'utf8')
const embedded = /-----BEGIN PUBLIC KEY-----[\s\S]*?-----END PUBLIC KEY-----/.exec(licenseTs)
if (!embedded) {
  console.error('check-license-key: could not find LICENSE_PUBLIC_KEY_PEM in src/main/license.ts')
  process.exit(1)
}

const devKeyPath = 'server/dev-keys/license-public.pem'
if (!existsSync(devKeyPath)) {
  console.log('check-license-key: no dev key present; OK')
  process.exit(0)
}

if (normalize(embedded[0]) === normalize(readFileSync(devKeyPath, 'utf8'))) {
  if (process.env.ALLOW_DEV_LICENSE_KEY === '1') {
    console.warn(
      'check-license-key: WARNING — releasing with the DEVELOPMENT license key (ALLOW_DEV_LICENSE_KEY=1). Do not distribute this build to customers.'
    )
    process.exit(0)
  }
  console.error(
    'check-license-key: REFUSING TO RELEASE.\n' +
      'The app still trusts the development license key from server/dev-keys/ —\n' +
      'anyone with this repository could mint valid licenses for this build.\n' +
      'Rotate keys first (see RELEASING.md → "Rotate the license signing key"),\n' +
      'or set the repository variable ALLOW_DEV_LICENSE_KEY=1 for a pipeline dry-run.'
  )
  process.exit(1)
}

console.log('check-license-key: production key detected; OK')
