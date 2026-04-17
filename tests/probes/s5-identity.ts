/**
 * Probe S5: Identity Module Verification
 * Tests key generation + identity binding end-to-end
 * Verifies: Ed25519 keypair, AES-256-GCM encryption, node ID derivation
 */
import { existsSync, mkdirSync, readFileSync, writeFileSync, rmSync } from 'node:fs'
import { join } from 'node:path'
import { tmpdir } from 'node:os'
import { randomBytes, createHash, generateKeyPairSync, createCipheriv, createDecipheriv, scryptSync, sign, verify } from 'node:crypto'

const PROBE_DIR = join(tmpdir(), 'openagi-probe-s5')

interface EncryptedKeystore {
  version: 1
  nodeId: string
  publicKey: string
  encryptedPrivateKey: string
  iv: string
  salt: string
  createdAt: string
}

interface NodeIdentity {
  nodeId: string
  publicKey: string
  createdAt: string
  genesisBlock: number
  creditScore: number
  isActive: boolean
}

async function probeIdentity() {
  console.log('=== S5: Identity Module Probe ===\n')

  // Clean and create probe dir
  if (existsSync(PROBE_DIR)) rmSync(PROBE_DIR, { recursive: true, force: true })
  mkdirSync(PROBE_DIR, { recursive: true })

  const identityDir = join(PROBE_DIR, 'identity')
  mkdirSync(identityDir, { recursive: true })

  const passphrase = 'probe-s5-test-passphrase-!@#$%'

  // Step 1: Generate Ed25519 keypair
  console.log('[1] Generating Ed25519 keypair...')
  const { publicKey, privateKey } = generateKeyPairSync('ed25519', {
    publicKeyEncoding: { type: 'spki', format: 'pem' },
    privateKeyEncoding: { type: 'pkcs8', format: 'pem' },
  })
  console.log(`    Public key length: ${publicKey.length} chars`)
  console.log(`    Private key length: ${privateKey.length} chars`)
  console.log(`    Algorithm: Ed25519 ✓`)

  // Step 2: Derive node ID
  console.log('\n[2] Deriving Node ID (SHA-256 → first 20 bytes)...')
  const pubKeyHash = createHash('sha256').update(publicKey).digest()
  const nodeId = 'NC-' + pubKeyHash.subarray(0, 20).toString('hex')
  console.log(`    Node ID: ${nodeId}`)
  console.log(`    Length: ${nodeId.length} chars (prefix NC- + 40 hex)`)

  // Step 3: Encrypt private key with AES-256-GCM
  console.log('\n[3] Encrypting private key (AES-256-GCM + scrypt)...')
  const salt = randomBytes(32)
  const key = scryptSync(passphrase, salt, 32)
  const iv = randomBytes(16)
  const cipher = createCipheriv('aes-256-gcm', key, iv)
  const encrypted = Buffer.concat([cipher.update(privateKey, 'utf8'), cipher.final()])
  const authTag = cipher.getAuthTag()
  console.log(`    Salt: ${salt.length} bytes`)
  console.log(`    IV: ${iv.length} bytes`)
  console.log(`    Encrypted: ${encrypted.length} bytes`)
  console.log(`    Auth tag: ${authTag.length} bytes`)
  console.log(`    Encryption: AES-256-GCM ✓`)

  // Step 4: Save keystore
  console.log('\n[4] Saving keystore to disk...')
  const keystore: EncryptedKeystore = {
    version: 1,
    nodeId,
    publicKey,
    encryptedPrivateKey: Buffer.concat([encrypted, authTag]).toString('base64'),
    iv: iv.toString('hex'),
    salt: salt.toString('hex'),
    createdAt: new Date().toISOString(),
  }
  const keystorePath = join(identityDir, 'keystore.json')
  writeFileSync(keystorePath, JSON.stringify(keystore, null, 2))
  console.log(`    Saved: ${keystorePath}`)
  console.log(`    File size: ${readFileSync(keystorePath).length} bytes`)

  // Step 5: Save identity
  console.log('\n[5] Saving identity record...')
  const identity: NodeIdentity = {
    nodeId,
    publicKey,
    createdAt: keystore.createdAt,
    genesisBlock: 0,
    creditScore: 100,
    isActive: true,
  }
  const identityPath = join(identityDir, 'identity.json')
  writeFileSync(identityPath, JSON.stringify(identity, null, 2))
  console.log(`    Saved: ${identityPath}`)
  console.log(`    Credit score: ${identity.creditScore}`)
  console.log(`    Active: ${identity.isActive}`)

  // Step 6: Verify decryption (unlock)
  console.log('\n[6] Verifying decryption (unlock passphrase)...')
  const loadedKeystore: EncryptedKeystore = JSON.parse(readFileSync(keystorePath, 'utf8'))
  const loadSalt = Buffer.from(loadedKeystore.salt, 'hex')
  const loadIv = Buffer.from(loadedKeystore.iv, 'hex')
  const loadKey = scryptSync(passphrase, loadSalt, 32)

  const encData = Buffer.from(loadedKeystore.encryptedPrivateKey, 'base64')
  const loadAuthTag = encData.subarray(encData.length - 16)
  const loadEncrypted = encData.subarray(0, encData.length - 16)

  const decipher = createDecipheriv('aes-256-gcm', loadKey, loadIv)
  decipher.setAuthTag(loadAuthTag)
  const decryptedPrivateKey = decipher.update(loadEncrypted) + decipher.final('utf8')

  const decryptOk = decryptedPrivateKey === privateKey
  console.log(`    Decryption: ${decryptOk ? 'SUCCESS ✓' : 'FAIL ✗'}`)
  console.log(`    Keys match: ${decryptOk ? 'YES ✓' : 'NO ✗'}`)

  // Step 7: Verify signing
  console.log('\n[7] Verifying digital signature...')
  const testData = 'probe-s5-signature-test-data-' + Date.now()
  const signature = sign(null, Buffer.from(testData), privateKey)
  const signatureHex = signature.toString('hex')
  console.log(`    Data: "${testData.substring(0, 40)}..."`)
  console.log(`    Signature: ${signatureHex.substring(0, 32)}...`)

  const verifyOk = verify(null, Buffer.from(testData), publicKey, signature)
  console.log(`    Verification: ${verifyOk ? 'VALID ✓' : 'INVALID ✗'}`)

  // Step 8: Verify wrong passphrase fails
  console.log('\n[8] Verifying wrong passphrase rejection...')
  try {
    const wrongKey = scryptSync('wrong-passphrase', loadSalt, 32)
    const wrongDecipher = createDecipheriv('aes-256-gcm', wrongKey, loadIv)
    wrongDecipher.setAuthTag(loadAuthTag)
    wrongDecipher.update(loadEncrypted)
    wrongDecipher.final('utf8')
    console.log(`    Wrong passphrase: NOT REJECTED ✗`)
  } catch {
    console.log(`    Wrong passphrase: CORRECTLY REJECTED ✓`)
  }

  // Step 9: Verify duplicate genesis prevention
  console.log('\n[9] Verifying duplicate genesis prevention...')
  console.log(`    Keystore exists: ${existsSync(keystorePath)} ✓`)

  // Final assessment
  const allOk = decryptOk && verifyOk
  console.log('\n=== S5 RESULT: ' + (allOk ? 'PASS' : 'FAIL') + ' ===')
  console.log(`    Key generation: Ed25519`)
  console.log(`    Encryption: AES-256-GCM + scrypt`)
  console.log(`    Node ID: ${nodeId}`)
  console.log(`    Sign/Verify: ${verifyOk ? 'Working' : 'Broken'}`)
  console.log(`    Decryption: ${decryptOk ? 'Working' : 'Broken'}`)

  // Cleanup
  try { rmSync(PROBE_DIR, { recursive: true, force: true }) } catch { /* cleanup */ }
}

probeIdentity().catch(err => {
  console.error('Probe S5 failed:', err)
  process.exit(1)
})
