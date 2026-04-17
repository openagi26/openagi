/**
 * Secure ID Generator
 *
 * Replaces Math.random() with crypto.randomBytes() for
 * cryptographically secure, collision-resistant identifiers.
 *
 * Fix for S1 audit finding H-04:
 *   Math.random() is not cryptographically secure and can produce
 *   collisions under high-frequency generation. Using crypto.randomBytes
 *   ensures unique, unpredictable IDs suitable for financial transactions.
 */
import { randomBytes } from 'node:crypto'

/**
 * Generate a cryptographically secure random hex suffix
 * @param bytes Number of random bytes (default 6 = 12 hex chars)
 */
export function secureRandomHex(bytes: number = 6): string {
  return randomBytes(bytes).toString('hex')
}

/**
 * Generate a prefixed secure ID
 * Format: PREFIX-timestamp-randomhex
 */
export function secureId(prefix: string, hexBytes: number = 4): string {
  return `${prefix}-${Date.now()}-${secureRandomHex(hexBytes)}`
}
