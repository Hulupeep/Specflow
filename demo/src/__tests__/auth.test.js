// Unit tests - These pass in BOTH safe and trap states!
// This demonstrates that unit tests validate implementation works,
// not that it meets spec requirements.

// Mock localStorage for tests (so trap state tests can pass)
const mockStorage = new Map()
global.localStorage = {
  getItem: (key) => mockStorage.get(key) || null,
  setItem: (key, value) => mockStorage.set(key, value),
  removeItem: (key) => mockStorage.delete(key),
  clear: () => mockStorage.clear()
}

const auth = require('../auth')

describe('Authentication', () => {
  beforeEach(() => {
    // Clear storage
    mockStorage.clear()
    // Clear require cache to get fresh module
    jest.resetModules()
  })

  it('creates session and returns session ID', async () => {
    const sessionId = await auth.createSession('user123')

    // ✅ This test passes in both states (safe and trap)
    expect(sessionId).toBeDefined()
    expect(sessionId).toMatch(/^sess_/)
  })

  it('retrieves session by ID', async () => {
    const sessionId = await auth.createSession('user456')
    const userId = await auth.getSession(sessionId)

    // ✅ This test passes in both states
    expect(userId).toBe('user456')
  })

  it('returns null for non-existent session', async () => {
    const userId = await auth.getSession('sess_nonexistent')

    // ✅ This test passes in both states
    expect(userId).toBeNull()
  })

  it('deletes session', async () => {
    const sessionId = await auth.createSession('user789')
    await auth.deleteSession(sessionId)
    const userId = await auth.getSession(sessionId)

    // ✅ This test passes in both states
    expect(userId).toBeNull()
  })
})
