/**
 * Swarm P2P Communication Layer
 *
 * Phase 2: Multi-node Trinity network with peer discovery,
 * encrypted knowledge exchange, and federal defense
 *
 * Transport: WebSocket mesh with signed messages
 * Discovery: DHT-based peer discovery + bootstrap nodes
 */
import { EventEmitter } from 'node:events'
import { existsSync, readFileSync, writeFileSync, mkdirSync } from 'node:fs'
import { join } from 'node:path'
import { createHash, randomBytes, createCipheriv, createDecipheriv } from 'node:crypto'
import { secureId } from '../utils/secure-id'

// ─── Types ────────────────────────────────────────────────────────────────────

export interface SwarmPeer {
  nodeId: string
  address: string
  port: number
  publicKey: string
  creditScore: number
  capabilities: string[]
  lastSeen: string
  status: 'connected' | 'disconnected' | 'banned'
  latencyMs: number
}

export interface SwarmMessage {
  id: string
  type: 'ping' | 'pong' | 'discover' | 'knowledge_offer' | 'knowledge_request'
    | 'knowledge_transfer' | 'debt_clearing' | 'vote' | 'defense_alert' | 'heartbeat'
  fromNodeId: string
  toNodeId: string | '*'
  payload: any
  signature: string
  timestamp: string
  encrypted: boolean
}

export interface SwarmConfig {
  /** Port to listen on */
  listenPort: number
  /** Maximum number of peers */
  maxPeers: number
  /** Bootstrap nodes for initial discovery */
  bootstrapNodes: Array<{ address: string; port: number }>
  /** Heartbeat interval in ms */
  heartbeatIntervalMs: number
  /** Peer timeout before disconnect in ms */
  peerTimeoutMs: number
  /** Whether to accept incoming connections */
  acceptIncoming: boolean
  /** Encryption key for P2P messages (derived from node key) */
  encryptionEnabled: boolean
}

export interface SwarmStats {
  connectedPeers: number
  totalPeersKnown: number
  messagesSent: number
  messagesReceived: number
  bytesTransferred: number
  uptime: number
  knowledgeExchanges: number
}

// ─── Swarm Manager ────────────────────────────────────────────────────────────

export class SwarmManager extends EventEmitter {
  private dataDir: string
  private config: SwarmConfig
  private peers: Map<string, SwarmPeer> = new Map()
  private stats: SwarmStats
  private nodeId: string
  private startedAt: number | null = null
  private heartbeatTimer: ReturnType<typeof setInterval> | null = null
  private isRunning = false

  // Placeholder for actual WebSocket server/clients
  private connections: Map<string, any> = new Map()

  constructor(dataDir: string, nodeId: string, config?: Partial<SwarmConfig>) {
    super()
    this.dataDir = join(dataDir, 'swarm')
    if (!existsSync(this.dataDir)) mkdirSync(this.dataDir, { recursive: true })

    this.nodeId = nodeId
    this.config = {
      listenPort: 19900,
      maxPeers: 50,
      bootstrapNodes: [],
      heartbeatIntervalMs: 30000,
      peerTimeoutMs: 90000,
      acceptIncoming: true,
      encryptionEnabled: true,
      ...config,
    }

    this.stats = {
      connectedPeers: 0,
      totalPeersKnown: 0,
      messagesSent: 0,
      messagesReceived: 0,
      bytesTransferred: 0,
      uptime: 0,
      knowledgeExchanges: 0,
    }

    this.loadPeers()
  }

  // ─── Lifecycle ────────────────────────────────────────────────────────────

  async start(): Promise<void> {
    if (this.isRunning) return

    this.isRunning = true
    this.startedAt = Date.now()

    // Start heartbeat
    this.heartbeatTimer = setInterval(() => this.heartbeat(), this.config.heartbeatIntervalMs)

    // Attempt to connect to bootstrap nodes
    for (const node of this.config.bootstrapNodes) {
      await this.connectToPeer(node.address, node.port)
    }

    this.emit('started', { nodeId: this.nodeId, port: this.config.listenPort })
  }

  async stop(): Promise<void> {
    if (!this.isRunning) return

    this.isRunning = false
    if (this.heartbeatTimer) {
      clearInterval(this.heartbeatTimer)
      this.heartbeatTimer = null
    }

    // Disconnect all peers
    for (const [peerId] of this.connections) {
      this.disconnectPeer(peerId)
    }

    this.savePeers()
    this.emit('stopped')
  }

  // ─── Peer Management ──────────────────────────────────────────────────────

  async connectToPeer(address: string, port: number): Promise<boolean> {
    if (this.connections.size >= this.config.maxPeers) return false

    try {
      // In production, this would create a WebSocket connection
      // For Phase 2 MVP, we simulate the connection
      const peerId = createHash('sha256').update(`${address}:${port}`).digest('hex').substring(0, 40)

      const peer: SwarmPeer = {
        nodeId: `NC-${peerId}`,
        address,
        port,
        publicKey: '',
        creditScore: 100,
        capabilities: [],
        lastSeen: new Date().toISOString(),
        status: 'connected',
        latencyMs: 0,
      }

      this.peers.set(peer.nodeId, peer)
      this.connections.set(peer.nodeId, { address, port })
      this.stats.connectedPeers = this.connections.size
      this.stats.totalPeersKnown = this.peers.size

      this.emit('peer-connected', peer)
      this.savePeers()
      return true
    } catch {
      return false
    }
  }

  disconnectPeer(peerId: string): void {
    const peer = this.peers.get(peerId)
    if (peer) {
      peer.status = 'disconnected'
    }
    this.connections.delete(peerId)
    this.stats.connectedPeers = this.connections.size
    this.emit('peer-disconnected', { peerId })
  }

  /**
   * Ban a peer (federal defense — consensus-driven)
   */
  banPeer(peerId: string, reason: string): void {
    const peer = this.peers.get(peerId)
    if (peer) {
      peer.status = 'banned'
      peer.creditScore = 0
    }
    this.connections.delete(peerId)
    this.stats.connectedPeers = this.connections.size
    this.savePeers()
    this.emit('peer-banned', { peerId, reason })
  }

  // ─── Messaging ────────────────────────────────────────────────────────────

  /**
   * Send a signed message to a peer or broadcast
   */
  sendMessage(type: SwarmMessage['type'], toNodeId: string | '*', payload: any): SwarmMessage {
    const message: SwarmMessage = {
      id: secureId('MSG'),
      type,
      fromNodeId: this.nodeId,
      toNodeId,
      payload,
      signature: this.signMessage(payload),
      timestamp: new Date().toISOString(),
      encrypted: this.config.encryptionEnabled,
    }

    if (toNodeId === '*') {
      // Broadcast to all connected peers
      for (const [peerId] of this.connections) {
        this.deliverMessage(peerId, message)
      }
    } else {
      this.deliverMessage(toNodeId, message)
    }

    this.stats.messagesSent++
    this.stats.bytesTransferred += JSON.stringify(message).length
    this.emit('message-sent', message)
    return message
  }

  private deliverMessage(peerId: string, message: SwarmMessage): void {
    // In production: send over WebSocket
    // For Phase 2 MVP: emit event for local testing
    this.emit('message-delivered', { peerId, message })
  }

  /**
   * Handle incoming message
   */
  handleMessage(message: SwarmMessage): void {
    this.stats.messagesReceived++
    this.stats.bytesTransferred += JSON.stringify(message).length

    // Update peer last seen
    const peer = this.peers.get(message.fromNodeId)
    if (peer) {
      peer.lastSeen = new Date().toISOString()
    }

    switch (message.type) {
      case 'ping':
        this.sendMessage('pong', message.fromNodeId, { replyTo: message.id })
        break
      case 'discover':
        this.handleDiscovery(message)
        break
      case 'knowledge_offer':
        this.emit('knowledge-offer', message.payload)
        break
      case 'knowledge_request':
        this.emit('knowledge-request', message.payload)
        break
      case 'debt_clearing':
        this.emit('debt-clearing', message.payload)
        break
      case 'defense_alert':
        this.handleDefenseAlert(message)
        break
      case 'vote':
        this.emit('vote', message.payload)
        break
      default:
        break
    }

    this.emit('message-received', message)
  }

  // ─── Discovery ────────────────────────────────────────────────────────────

  private handleDiscovery(message: SwarmMessage): void {
    // Share our known peers with the requester
    const knownPeers = Array.from(this.peers.values())
      .filter((p) => p.status === 'connected')
      .map((p) => ({ nodeId: p.nodeId, address: p.address, port: p.port }))
      .slice(0, 20)

    this.sendMessage('discover', message.fromNodeId, { peers: knownPeers })
  }

  /**
   * Broadcast discovery request to find new peers
   */
  discoverPeers(): void {
    this.sendMessage('discover', '*', { requestFrom: this.nodeId })
  }

  // ─── Federal Defense ──────────────────────────────────────────────────────

  private handleDefenseAlert(message: SwarmMessage): void {
    const { targetNodeId, reason, evidenceHash } = message.payload
    this.emit('defense-alert', { targetNodeId, reason, evidenceHash, reporter: message.fromNodeId })

    // Auto-ban if consensus threshold reached (simplified for Phase 2)
    // In production, this would require votes from >50% of connected peers
  }

  /**
   * Report a malicious node to the network
   */
  reportMaliciousNode(targetNodeId: string, reason: string, evidence: string): void {
    const evidenceHash = createHash('sha256').update(evidence).digest('hex')
    this.sendMessage('defense_alert', '*', { targetNodeId, reason, evidenceHash })
  }

  /**
   * Initiate federated debt clearing across the swarm
   */
  broadcastDebtClearing(debtItems: Array<{ id: string; description: string; bounty: number }>): void {
    this.sendMessage('debt_clearing', '*', {
      debts: debtItems,
      nodeId: this.nodeId,
      timestamp: new Date().toISOString(),
    })
  }

  // ─── Knowledge Exchange ───────────────────────────────────────────────────

  /**
   * Offer knowledge/playbook to the network
   */
  offerKnowledge(listing: { title: string; price: number; evidenceLevel: string; tags: string[] }): void {
    this.sendMessage('knowledge_offer', '*', {
      ...listing,
      sellerId: this.nodeId,
    })
    this.stats.knowledgeExchanges++
  }

  /**
   * Request knowledge from the network
   */
  requestKnowledge(query: { tags: string[]; maxPrice: number }): void {
    this.sendMessage('knowledge_request', '*', {
      ...query,
      buyerId: this.nodeId,
    })
  }

  // ─── Heartbeat ────────────────────────────────────────────────────────────

  private heartbeat(): void {
    const now = Date.now()

    // Ping all connected peers
    for (const [peerId, peer] of this.peers) {
      if (peer.status !== 'connected') continue

      const lastSeenMs = now - new Date(peer.lastSeen).getTime()
      if (lastSeenMs > this.config.peerTimeoutMs) {
        this.disconnectPeer(peerId)
        continue
      }

      this.sendMessage('heartbeat', peerId, { timestamp: now })
    }

    this.stats.uptime = this.startedAt ? (now - this.startedAt) : 0
  }

  // ─── Encryption ───────────────────────────────────────────────────────────

  private signMessage(payload: any): string {
    return createHash('sha256').update(JSON.stringify(payload) + this.nodeId).digest('hex')
  }

  encryptPayload(data: string, peerPublicKey: string): string {
    // Symmetric encryption with shared secret (simplified for MVP)
    const key = createHash('sha256').update(peerPublicKey + this.nodeId).digest()
    const iv = randomBytes(16)
    const cipher = createCipheriv('aes-256-cbc', key, iv)
    const encrypted = Buffer.concat([cipher.update(data, 'utf8'), cipher.final()])
    return iv.toString('hex') + ':' + encrypted.toString('hex')
  }

  decryptPayload(encrypted: string, peerPublicKey: string): string {
    const [ivHex, dataHex] = encrypted.split(':')
    const key = createHash('sha256').update(peerPublicKey + this.nodeId).digest()
    const decipher = createDecipheriv('aes-256-cbc', key, Buffer.from(ivHex, 'hex'))
    return decipher.update(Buffer.from(dataHex, 'hex')) + decipher.final('utf8')
  }

  // ─── Queries ──────────────────────────────────────────────────────────────

  getPeers(filter?: { status?: SwarmPeer['status'] }): SwarmPeer[] {
    let all = Array.from(this.peers.values())
    if (filter?.status) all = all.filter((p) => p.status === filter.status)
    return all
  }

  getStats(): SwarmStats { return { ...this.stats } }
  getConfig(): SwarmConfig { return { ...this.config } }
  getIsRunning(): boolean { return this.isRunning }

  updateConfig(partial: Partial<SwarmConfig>): void {
    Object.assign(this.config, partial)
  }

  // ─── Persistence ──────────────────────────────────────────────────────────

  private savePeers(): void {
    writeFileSync(join(this.dataDir, 'peers.json'), JSON.stringify(Object.fromEntries(this.peers), null, 2))
  }

  private loadPeers(): void {
    const path = join(this.dataDir, 'peers.json')
    if (existsSync(path)) {
      this.peers = new Map(Object.entries(JSON.parse(readFileSync(path, 'utf8'))))
      this.stats.totalPeersKnown = this.peers.size
    }
  }
}
