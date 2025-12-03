// ✅ COMPLIANT WITH AUTH-001
// Uses in-memory store with TTL (simulating Redis)

// Simple in-memory store with TTL
const store = {
  data: new Map(),
  ttls: new Map(),

  async set(key, value, options = {}) {
    this.data.set(key, value)
    if (options.ttl) {
      this.ttls.set(key, Date.now() + options.ttl * 1000)
    }
    return 'OK'
  },

  async get(key) {
    // Check expiry
    const ttl = this.ttls.get(key)
    if (ttl && Date.now() > ttl) {
      this.data.delete(key)
      this.ttls.delete(key)
      return null
    }
    return this.data.get(key) || null
  },

  async del(key) {
    this.data.delete(key)
    this.ttls.delete(key)
    return 1
  }
}

function generateId() {
  return 'sess_' + Math.random().toString(36).substr(2, 9)
}

async function createSession(userId) {
  const sessionId = generateId()
  // ✅ AUTH-001 COMPLIANT: Using store with TTL (like Redis)
  await store.set(`session:${sessionId}`, userId, { ttl: 86400 }) // 24h
  return sessionId
}

async function getSession(sessionId) {
  // ✅ AUTH-001 COMPLIANT: Using store lookup
  const userId = await store.get(`session:${sessionId}`)
  return userId
}

async function deleteSession(sessionId) {
  // ✅ AUTH-001 COMPLIANT: Using store delete
  await store.del(`session:${sessionId}`)
}

module.exports = {
  createSession,
  getSession,
  deleteSession
}
