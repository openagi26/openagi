/**
 * OpenAGI Identity Module
 *
 * Genesis Sequence: Local offline key generation → Node ID derivation → Credit binding
 * Implements Section 3 of OpenAGI v6.0 Spec
 */
import { randomBytes, createHash, generateKeyPairSync, createCipheriv, createDecipheriv, scryptSync, sign } from 'node:crypto'
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'

// ─── Types ────────────────────────────────────────────────────────────────────

export interface NodeIdentity {
  /** Globally unique node ID (derived from public key hash) */
  nodeId: string
  /** Public key in PEM format */
  publicKey: string
  /** Creation timestamp */
  createdAt: string
  /** Genesis block reference */
  genesisBlock: number
  /** Credit score (initial = 100) */
  creditScore: number
  /** Whether this node is active */
  isActive: boolean
}

interface EncryptedKeystore {
  version: 1
  nodeId: string
  publicKey: string
  encryptedPrivateKey: string
  iv: string
  salt: string
  createdAt: string
}

// ─── Identity Manager ─────────────────────────────────────────────────────────

export class IdentityManager {
  private dataDir: string
  private identity: NodeIdentity | null = null
  private privateKey: string | null = null

  constructor(dataDir: string) {
    this.dataDir = join(dataDir, 'identity')
    if (!existsSync(this.dataDir)) {
      mkdirSync(this.dataDir, { recursive: true })
    }
  }

  /**
   * Genesis Sequence Step 1: Generate keypair offline
   * Uses Ed25519 for fast, secure asymmetric crypto
   */
  generateGenesis(passphrase: string): NodeIdentity {
    if (this.hasGenesis()) throw new Error('Identity already exists — genesis cannot be repeated')
    // Generate Ed25519 keypair
    const { publicKey, privateKey } = generateKeyPairSync('ed25519', {
      publicKeyEncoding: { type: 'spki', format: 'pem' },
      privateKeyEncoding: { type: 'pkcs8', format: 'pem' },
    })

    // Derive node ID from public key hash (SHA-256 → first 20 bytes → hex)
    const pubKeyHash = createHash('sha256').update(publicKey).digest()
    const nodeId = 'NC-' + pubKeyHash.subarray(0, 20).toString('hex')

    // Encrypt private key with passphrase using AES-256-GCM
    const salt = randomBytes(32)
    const key = scryptSync(passphrase, salt, 32)
    const iv = randomBytes(16)
    const cipher = createCipheriv('aes-256-gcm', key, iv)
    const encrypted = Buffer.concat([cipher.update(privateKey, 'utf8'), cipher.final()])
    const authTag = cipher.getAuthTag()

    // Store encrypted keystore
    const keystore: EncryptedKeystore = {
      version: 1,
      nodeId,
      publicKey,
      encryptedPrivateKey: Buffer.concat([encrypted, authTag]).toString('base64'),
      iv: iv.toString('hex'),
      salt: salt.toString('hex'),
      createdAt: new Date().toISOString(),
    }
    writeFileSync(join(this.dataDir, 'keystore.json'), JSON.stringify(keystore, null, 2))

    // Create identity record
    this.identity = {
      nodeId,
      publicKey,
      createdAt: keystore.createdAt,
      genesisBlock: 0,
      creditScore: 100,
      isActive: true,
    }
    writeFileSync(join(this.dataDir, 'identity.json'), JSON.stringify(this.identity, null, 2))

    return this.identity
  }

  /**
   * Unlock private key for signing operations (kept in memory only)
   */
  unlock(passphrase: string): boolean {
    const keystorePath = join(this.dataDir, 'keystore.json')
    if (!existsSync(keystorePath)) return false

    try {
      const keystore: EncryptedKeystore = JSON.parse(readFileSync(keystorePath, 'utf8'))
      const salt = Buffer.from(keystore.salt, 'hex')
      const iv = Buffer.from(keystore.iv, 'hex')
      const key = scryptSync(passphrase, salt, 32)

      const encryptedData = Buffer.from(keystore.encryptedPrivateKey, 'base64')
      const authTag = encryptedData.subarray(encryptedData.length - 16)
      const encrypted = encryptedData.subarray(0, encryptedData.length - 16)

      const decipher = createDecipheriv('aes-256-gcm', key, iv)
      decipher.setAuthTag(authTag)
      this.privateKey = decipher.update(encrypted) + decipher.final('utf8')
      return true
    } catch {
      this.privateKey = null
      return false
    }
  }

  /**
   * Lock private key (clear from memory)
   */
  lock(): void {
    this.privateKey = null
  }

  /**
   * Sign data with private key (requires unlock)
   */
  sign(data: string): string | null {
    if (!this.privateKey) return null
     const signature = sign(null, Buffer.from(data), this.privateKey)
    return signature.toString('hex')
  }

  /**
   * Get current identity (load from disk if needed)
   */
  getIdentity(): NodeIdentity | null {
    if (this.identity) return this.identity

    const identityPath = join(this.dataDir, 'identity.json')
    if (!existsSync(identityPath)) return null

    this.identity = JSON.parse(readFileSync(identityPath, 'utf8'))
    return this.identity
  }

  /**
   * Update credit score
   */
  updateCredit(delta: number): void {
    if (!this.identity) return
    this.identity.creditScore = Math.max(0, Math.min(1000, this.identity.creditScore + delta))
    writeFileSync(join(this.dataDir, 'identity.json'), JSON.stringify(this.identity, null, 2))
  }

  /**
   * Check if genesis has been completed
   */
  hasGenesis(): boolean {
    return existsSync(join(this.dataDir, 'keystore.json'))
  }

  /**
   * Check if private key is currently unlocked
   */
  isUnlocked(): boolean {
    return this.privateKey !== null
  }

  /**
   * Digital death - deactivate node (credit = 0 → bankrupt)
   */
  deactivate(): void {
    if (!this.identity) return
    this.identity.isActive = false
    this.identity.creditScore = 0
    writeFileSync(join(this.dataDir, 'identity.json'), JSON.stringify(this.identity, null, 2))
  }
}
