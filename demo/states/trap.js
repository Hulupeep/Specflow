// ❌ VIOLATES AUTH-001
// LLM suggested this "optimization" for better performance

// Note: This code will crash in Node.js (no localStorage)
// That's intentional - it demonstrates the production failure

function generateId() {
  return 'sess_' + Math.random().toString(36).substr(2, 9)
}

async function createSession(userId) {
  const sessionId = generateId()

  // ❌ VIOLATES AUTH-001
  // LLM reasoning: "localStorage is 10x faster than Redis for local development!"
  // Problem: Breaks in production (service workers, disabled localStorage)
  // This is the trap - tests will pass but requirement is violated

  localStorage.setItem(`session:${sessionId}`, JSON.stringify({
    userId,
    expiresAt: Date.now() + 86400000  // Manual TTL (fragile)
  }))

  return sessionId
}

async function getSession(sessionId) {
  // ❌ VIOLATES AUTH-001
  const data = localStorage.getItem(`session:${sessionId}`)
  if (!data) return null

  const parsed = JSON.parse(data)

  // Manual expiry check (can be bypassed, security issue)
  if (Date.now() > parsed.expiresAt) {
    localStorage.removeItem(`session:${sessionId}`)
    return null
  }

  return parsed.userId
}

async function deleteSession(sessionId) {
  // ❌ VIOLATES AUTH-001
  localStorage.removeItem(`session:${sessionId}`)
}

module.exports = {
  createSession,
  getSession,
  deleteSession
}
