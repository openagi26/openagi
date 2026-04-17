/**
 * New.B Testnet Blockchain Layer
 *
 * Phase 3: Local blockchain for New.B token with block mining,
 * transaction verification, and cross-node consensus
 *
 * This is a lightweight custom chain (not EVM-based) designed for:
 * - New.B token transfers between nodes
 * - Evidence hash anchoring (H4 level)
 * - Playbook ownership NFTs
 * - PoO result commitments
 */
import { createHash, createHmac } from 'node:crypto'
import { existsSync, readFileSync, writeFileSync, mkdirSync } from 'node:fs'
import { join } from 'node:path'
import { secureId } from '../utils/secure-id'

// ─── Types ────────────────────────────────────────────────────────────────────

export interface Block {
  index: number
  timestamp: string
  transactions: Transaction[]
  previousHash: string
  hash: string
  nonce: number
  miner: string
  difficulty: number
}

export interface Transaction {
  id: string
  type: 'transfer' | 'stake' | 'unstake' | 'evidence_anchor' | 'playbook_register'
    | 'poo_commit' | 'genesis' | 'mining_reward' | 'dividend'
  from: string
  to: string
  amount: number
  data?: string
  fee: number
  signature: string
  timestamp: string
  /** Block index where this was included (-1 if pending) */
  blockIndex: number
}

export interface ChainState {
  height: number
  totalTransactions: number
  totalBlocks: number
  difficulty: number
  pendingTransactions: number
  lastBlockHash: string
  lastBlockTime: string
  totalSupply: number
}

export interface BlockchainConfig {
  /** Block time target in ms */
  blockTimeMs: number
  /** Initial mining difficulty (leading zeros in hash) */
  initialDifficulty: number
  /** Maximum transactions per block */
  maxTransactionsPerBlock: number
  /** Minimum transaction fee */
  minFee: number
  /** Block reward (in New.B) */
  blockReward: number
  /** Difficulty adjustment interval (blocks) */
  difficultyAdjustmentInterval: number
}

// ─── Blockchain ───────────────────────────────────────────────────────────────

export class NewBBlockchain {
  private dataDir: string
  private chain: Block[] = []
  private pendingTransactions: Transaction[] = []
  private config: BlockchainConfig
  private balances: Map<string, number> = new Map()

  constructor(dataDir: string, config?: Partial<BlockchainConfig>) {
    this.dataDir = join(dataDir, 'blockchain')
    if (!existsSync(this.dataDir)) mkdirSync(this.dataDir, { recursive: true })

    this.config = {
      blockTimeMs: 10000,
      initialDifficulty: 2,
      maxTransactionsPerBlock: 50,
      minFee: 0.001,
      blockReward: 1,
      difficultyAdjustmentInterval: 10,
      ...config,
    }

    this.loadChain()
  }

  /**
   * Initialize the genesis block
   */
  initGenesis(creatorNodeId: string, initialSupply: number): Block {
    if (this.chain.length > 0) throw new Error('Chain already initialized')

    const genesisTx: Transaction = {
      id: `TX-GENESIS-${Date.now()}`,
      type: 'genesis',
      from: 'SYSTEM',
      to: creatorNodeId,
      amount: initialSupply,
      fee: 0,
      signature: 'genesis',
      timestamp: new Date().toISOString(),
      blockIndex: 0,
    }

    const genesisBlock: Block = {
      index: 0,
      timestamp: new Date().toISOString(),
      transactions: [genesisTx],
      previousHash: '0'.repeat(64),
      hash: '',
      nonce: 0,
      miner: creatorNodeId,
      difficulty: this.config.initialDifficulty,
    }

    genesisBlock.hash = this.calculateBlockHash(genesisBlock)
    this.chain.push(genesisBlock)
    this.balances.set(creatorNodeId, initialSupply)

    this.saveChain()
    return genesisBlock
  }

  /**
   * Create and queue a transaction
   */
  createTransaction(params: {
    type: Transaction['type']
    from: string
    to: string
    amount: number
    data?: string
    fee?: number
    signature?: string
  }): Transaction | { error: string } {
    const fee = params.fee ?? this.config.minFee
    if (fee < this.config.minFee) {
      return { error: `Minimum fee is ${this.config.minFee} New.B` }
    }

    if (params.type !== 'genesis' && params.type !== 'mining_reward') {
      const balance = this.getBalance(params.from)
      if (balance < params.amount + fee) {
        return { error: `Insufficient balance: ${balance} < ${params.amount + fee}` }
      }
    }

    const tx: Transaction = {
      id: secureId('TX'),
      ...params,
      fee,
      signature: params.signature ?? this.signTransaction(params),
      timestamp: new Date().toISOString(),
      blockIndex: -1,
    }

    this.pendingTransactions.push(tx)
    return tx
  }

  /**
   * Mine a new block with pending transactions
   */
  mineBlock(minerNodeId: string): Block | null {
    if (this.pendingTransactions.length === 0) return null

    // Select transactions for block
    const txsForBlock = this.pendingTransactions
      .sort((a, b) => b.fee - a.fee)
      .slice(0, this.config.maxTransactionsPerBlock)

    // Add mining reward
    const rewardTx: Transaction = {
      id: `TX-REWARD-${Date.now()}`,
      type: 'mining_reward',
      from: 'SYSTEM',
      to: minerNodeId,
      amount: this.config.blockReward,
      fee: 0,
      signature: 'mining-reward',
      timestamp: new Date().toISOString(),
      blockIndex: this.chain.length,
    }

    const allTxs = [...txsForBlock, rewardTx]
    const previousBlock = this.chain[this.chain.length - 1]
    const blockIndex = this.chain.length

    // Set block indices BEFORE hashing so validation can reproduce the hash
    for (const tx of allTxs) {
      tx.blockIndex = blockIndex
    }

    const block: Block = {
      index: blockIndex,
      timestamp: new Date().toISOString(),
      transactions: allTxs,
      previousHash: previousBlock.hash,
      hash: '',
      nonce: 0,
      miner: minerNodeId,
      difficulty: this.getCurrentDifficulty(),
    }

    // Proof of Work — find nonce that produces hash with N leading zeros
    block.hash = this.proofOfWork(block)

    // Apply transactions to balance state
    for (const tx of allTxs) {
      this.applyTransaction(tx)
    }

    // Remove mined transactions from pending
    const minedIds = new Set(txsForBlock.map((t) => t.id))
    this.pendingTransactions = this.pendingTransactions.filter((t) => !minedIds.has(t.id))

    this.chain.push(block)
    this.saveChain()
    return block
  }

  /**
   * Anchor evidence hash on-chain (creates H4-level evidence)
   */
  anchorEvidence(nodeId: string, evidenceHash: string, description: string): Transaction | { error: string } {
    return this.createTransaction({
      type: 'evidence_anchor',
      from: nodeId,
      to: 'EVIDENCE',
      amount: 0,
      data: JSON.stringify({ evidenceHash, description }),
      fee: this.config.minFee,
    })
  }

  /**
   * Register a Playbook on-chain (NFT-like ownership)
   */
  registerPlaybook(nodeId: string, playbookId: string, playbookHash: string): Transaction | { error: string } {
    return this.createTransaction({
      type: 'playbook_register',
      from: nodeId,
      to: 'PLAYBOOK_REGISTRY',
      amount: 0,
      data: JSON.stringify({ playbookId, playbookHash }),
      fee: this.config.minFee,
    })
  }

  /**
   * Commit a PoO result on-chain
   */
  commitPoOResult(nodeId: string, taskId: string, score: number, evidenceHash: string): Transaction | { error: string } {
    return this.createTransaction({
      type: 'poo_commit',
      from: nodeId,
      to: 'POO_ORACLE',
      amount: 0,
      data: JSON.stringify({ taskId, score, evidenceHash }),
      fee: this.config.minFee,
    })
  }

  // ─── Validation ───────────────────────────────────────────────────────────

  /**
   * Validate the entire chain integrity
   */
  validateChain(): { valid: boolean; errors: string[] } {
    const errors: string[] = []

    for (let i = 1; i < this.chain.length; i++) {
      const block = this.chain[i]
      const previousBlock = this.chain[i - 1]

      // Check previous hash link
      if (block.previousHash !== previousBlock.hash) {
        errors.push(`Block ${i}: previousHash mismatch`)
      }

      // Verify block hash
      const calculatedHash = this.calculateBlockHash(block)
      if (block.hash !== calculatedHash) {
        errors.push(`Block ${i}: hash mismatch (tampered?)`)
      }

      // Verify proof of work
      const prefix = '0'.repeat(block.difficulty)
      if (!block.hash.startsWith(prefix)) {
        errors.push(`Block ${i}: proof of work invalid`)
      }
    }

    return { valid: errors.length === 0, errors }
  }

  // ─── Queries ──────────────────────────────────────────────────────────────

  getBalance(nodeId: string): number {
    return this.balances.get(nodeId) ?? 0
  }

  getBlock(index: number): Block | undefined {
    return this.chain[index]
  }

  getLatestBlock(): Block | undefined {
    return this.chain[this.chain.length - 1]
  }

  getChainState(): ChainState {
    const latest = this.getLatestBlock()
    return {
      height: this.chain.length,
      totalTransactions: this.chain.reduce((sum, b) => sum + b.transactions.length, 0),
      totalBlocks: this.chain.length,
      difficulty: this.getCurrentDifficulty(),
      pendingTransactions: this.pendingTransactions.length,
      lastBlockHash: latest?.hash ?? '',
      lastBlockTime: latest?.timestamp ?? '',
      totalSupply: Array.from(this.balances.values()).reduce((a, b) => a + b, 0),
    }
  }

  getTransactionHistory(nodeId: string, limit: number = 50): Transaction[] {
    const txs: Transaction[] = []
    for (const block of this.chain) {
      for (const tx of block.transactions) {
        if (tx.from === nodeId || tx.to === nodeId) {
          txs.push(tx)
        }
      }
    }
    return txs.slice(-limit)
  }

  getPendingTransactions(): Transaction[] {
    return [...this.pendingTransactions]
  }

  isInitialized(): boolean {
    return this.chain.length > 0
  }

  // ─── Internal ─────────────────────────────────────────────────────────────

  private applyTransaction(tx: Transaction): void {
    if (tx.from !== 'SYSTEM') {
      const fromBalance = this.balances.get(tx.from) ?? 0
      this.balances.set(tx.from, fromBalance - tx.amount - tx.fee)
    }
    if (tx.to !== 'EVIDENCE' && tx.to !== 'PLAYBOOK_REGISTRY' && tx.to !== 'POO_ORACLE') {
      const toBalance = this.balances.get(tx.to) ?? 0
      this.balances.set(tx.to, toBalance + tx.amount)
    }
  }

  private proofOfWork(block: Block): string {
    const prefix = '0'.repeat(block.difficulty)
    let nonce = 0
    let hash = ''

    // Safety limit to prevent infinite loops
    const maxNonce = 1_000_000
    while (nonce < maxNonce) {
      block.nonce = nonce
      hash = this.calculateBlockHash(block)
      if (hash.startsWith(prefix)) return hash
      nonce++
    }

    // If we hit max nonce, accept whatever hash we have
    return hash
  }

  private calculateBlockHash(block: Block): string {
    const data = `${block.index}${block.timestamp}${JSON.stringify(block.transactions)}${block.previousHash}${block.nonce}`
    return createHash('sha256').update(data).digest('hex')
  }

  private signTransaction(params: any): string {
    return createHash('sha256').update(JSON.stringify(params)).digest('hex')
  }

  private getCurrentDifficulty(): number {
    if (this.chain.length < this.config.difficultyAdjustmentInterval) {
      return this.config.initialDifficulty
    }

    const lastAdjustmentBlock = this.chain[this.chain.length - this.config.difficultyAdjustmentInterval]
    const latestBlock = this.chain[this.chain.length - 1]

    const expectedTime = this.config.blockTimeMs * this.config.difficultyAdjustmentInterval
    const actualTime = new Date(latestBlock.timestamp).getTime() - new Date(lastAdjustmentBlock.timestamp).getTime()

    const currentDifficulty = latestBlock.difficulty

    if (actualTime < expectedTime / 2) return currentDifficulty + 1
    if (actualTime > expectedTime * 2) return Math.max(1, currentDifficulty - 1)
    return currentDifficulty
  }

  // ─── Integrity (C-04) ─────────────────────────────────────────────────────

  /** Flag set when HMAC verification fails on load */
  tamperDetected = false

  /**
   * Verify HMAC integrity of chain.json and balances.json.
   * Returns { valid: true } on success, or { valid: false, reason } on failure.
   */
  verifyIntegrity(): { valid: boolean; reason?: string } {
    const key = this.getHmacKey()
    if (!key) return { valid: false, reason: 'chain not initialized — no HMAC key' }

    for (const name of ['chain', 'balances'] as const) {
      const dataPath = join(this.dataDir, `${name}.json`)
      const hmacPath = join(this.dataDir, `${name}.hmac`)

      if (!existsSync(dataPath)) return { valid: false, reason: `${name}.json not found` }
      if (!existsSync(hmacPath)) return { valid: false, reason: `${name}.hmac not found` }

      const content = readFileSync(dataPath, 'utf8')
      const stored = readFileSync(hmacPath, 'utf8').trim()
      const computed = this.computeHmac(content, key)
      if (computed !== stored) return { valid: false, reason: `${name}.json HMAC mismatch — possible tampering` }
    }

    return { valid: true }
  }

  // ─── Persistence ──────────────────────────────────────────────────────────

  private getHmacKey(): string | null {
    if (this.chain.length === 0) return null
    return this.chain[0].miner // genesis block miner ID
  }

  private computeHmac(content: string, key: string): string {
    return createHmac('sha256', key).update(content).digest('hex')
  }

  private saveChain(): void {
    const key = this.getHmacKey()

    const chainContent = JSON.stringify(this.chain, null, 2)
    writeFileSync(join(this.dataDir, 'chain.json'), chainContent)

    const balancesContent = JSON.stringify(Object.fromEntries(this.balances), null, 2)
    writeFileSync(join(this.dataDir, 'balances.json'), balancesContent)

    writeFileSync(join(this.dataDir, 'pending.json'), JSON.stringify(this.pendingTransactions, null, 2))

    // Write companion HMAC files (C-04 integrity)
    if (key) {
      writeFileSync(join(this.dataDir, 'chain.hmac'), this.computeHmac(chainContent, key))
      writeFileSync(join(this.dataDir, 'balances.hmac'), this.computeHmac(balancesContent, key))
    }
  }

  private loadChain(): void {
    const chainPath = join(this.dataDir, 'chain.json')
    if (existsSync(chainPath)) {
      this.chain = JSON.parse(readFileSync(chainPath, 'utf8'))
    }
    const balancesPath = join(this.dataDir, 'balances.json')
    if (existsSync(balancesPath)) {
      this.balances = new Map(Object.entries(JSON.parse(readFileSync(balancesPath, 'utf8'))))
    }
    const pendingPath = join(this.dataDir, 'pending.json')
    if (existsSync(pendingPath)) {
      this.pendingTransactions = JSON.parse(readFileSync(pendingPath, 'utf8'))
    }

    // Verify HMAC integrity on load (C-04 — graceful degradation)
    this.tamperDetected = false
    const key = this.getHmacKey()
    if (!key) return // chain not initialized yet — nothing to verify

    for (const name of ['chain', 'balances'] as const) {
      const dataPath = join(this.dataDir, `${name}.json`)
      const hmacPath = join(this.dataDir, `${name}.hmac`)

      if (!existsSync(dataPath)) continue
      if (!existsSync(hmacPath)) {
        console.warn(`[C-04] ${name}.hmac missing — cannot verify ${name}.json integrity`)
        this.tamperDetected = true
        continue
      }

      const content = readFileSync(dataPath, 'utf8')
      const stored = readFileSync(hmacPath, 'utf8').trim()
      const computed = this.computeHmac(content, key)
      if (computed !== stored) {
        console.warn(`[C-04] HMAC mismatch on ${name}.json — possible tampering detected`)
        this.tamperDetected = true
      }
    }
  }
}
