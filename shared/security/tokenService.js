// ============================================================================
// THE LOOPS UNIVERSAL RETAIL SUITE — SECURE TOKEN LIFECYCLE SERVICE
// Implements Access Token + Rotating Refresh Token per Section 5 of Security Plan
// Enforces token reuse detection, server-side revocation, and multi-tenant scoping.
// ============================================================================

const crypto = require('crypto');
const { signToken, verifyToken } = require('./jwt');
const { getDatabase } = require('../database/connection');

const ACCESS_TOKEN_TTL_SECONDS = 5 * 60; // 5 Minutes short-lived access token
const REFRESH_TOKEN_TTL_MS = 7 * 24 * 3600 * 1000; // 7 Days durable rotating refresh token lifespan

function hashRefreshToken(token) {
  return crypto.createHash('sha256').update(token).digest('hex');
}

/**
 * Generate a new Access Token (JWT) and Refresh Token (Opaque)
 */
function generateTokenPair(user, organizationId = null, storeId = null) {
  const orgId = organizationId || user.organizationId || user.organization_id || 'org-loops-001';
  const sessionId = `sess_${crypto.randomUUID()}`;
  const rawRefreshToken = `loops_ref_${user.id}_${crypto.randomBytes(32).toString('hex')}`;
  const refreshTokenHash = hashRefreshToken(rawRefreshToken);
  const now = new Date();
  const refreshExpiresAt = new Date(now.getTime() + REFRESH_TOKEN_TTL_MS).toISOString();

  // JWT Access Token
  const accessToken = signToken({
    sub: user.id,
    sid: sessionId,
    org: orgId,
    role: user.role,
    storeId: storeId || user.storeId || user.assigned_store_id || null,
    email: user.email,
    name: user.fullName || user.full_name
  }, {
    expiresInSeconds: ACCESS_TOKEN_TTL_SECONDS
  });

  // Persist session to SQLite
  try {
    const db = getDatabase();
    // Ensure table columns exist
    try {
      db.prepare(`
        CREATE TABLE IF NOT EXISTS sessions_v2 (
          id TEXT PRIMARY KEY,
          user_id TEXT NOT NULL,
          organization_id TEXT NOT NULL,
          refresh_token_hash TEXT NOT NULL,
          is_revoked INTEGER DEFAULT 0,
          created_at TEXT NOT NULL,
          expires_at TEXT NOT NULL
        )
      `).run();
    } catch (e) {}

    db.prepare(`
      INSERT OR REPLACE INTO sessions_v2 (id, user_id, organization_id, refresh_token_hash, is_revoked, created_at, expires_at)
      VALUES (?, ?, ?, ?, 0, ?, ?)
    `).run(sessionId, user.id, orgId, refreshTokenHash, now.toISOString(), refreshExpiresAt);

    // Also populate legacy sessions table for backward compatibility
    db.prepare(`
      INSERT OR REPLACE INTO sessions (token, user_id, organization_id, created_at, expires_at)
      VALUES (?, ?, ?, ?, ?)
    `).run(accessToken, user.id, orgId, now.toISOString(), refreshExpiresAt);
  } catch (e) {
    // Non-fatal if DB is temporarily busy
  }

  return {
    accessToken,
    refreshToken: rawRefreshToken,
    tokenType: 'Bearer',
    expiresIn: ACCESS_TOKEN_TTL_SECONDS,
    sessionId,
    user: {
      id: user.id,
      email: user.email,
      fullName: user.fullName || user.full_name,
      role: user.role,
      organizationId: orgId
    }
  };
}

/**
 * Rotate Refresh Token & Issue New Access Token with Reuse Detection
 */
function rotateRefreshToken(rawRefreshToken) {
  if (!rawRefreshToken || typeof rawRefreshToken !== 'string') {
    throw new Error('Refresh token is required');
  }

  const tokenHash = hashRefreshToken(rawRefreshToken);
  const db = getDatabase();

  const session = db.prepare(`
    SELECT * FROM sessions_v2 WHERE refresh_token_hash = ?
  `).get(tokenHash);

  if (!session) {
    throw new Error('Invalid or non-existent refresh token');
  }

  // Reuse Detection: If already revoked, compromise suspected!
  if (session.is_revoked === 1) {
    // Revoke all sessions for this user across the board
    db.prepare('UPDATE sessions_v2 SET is_revoked = 1 WHERE user_id = ?').run(session.user_id);
    throw new Error('Security Breach Alert: Refresh token reuse detected. All active sessions have been invalidated.');
  }

  // Natural expiration check
  if (new Date(session.expires_at) <= new Date()) {
    throw new Error('Refresh token has expired. Please sign in again.');
  }

  // Fetch current user
  let user = db.prepare('SELECT * FROM users WHERE id = ?').get(session.user_id);
  if (!user) {
    try {
      const posStatePath = require('path').join(__dirname, '../../The_Loop.s_POS/backend/data/pos_state.json');
      if (require('fs').existsSync(posStatePath)) {
        const posState = JSON.parse(require('fs').readFileSync(posStatePath, 'utf8'));
        const memUser = (posState.users || []).find(u => u.id === session.user_id);
        if (memUser) {
          user = {
            id: memUser.id,
            organization_id: memUser.organizationId || session.organization_id,
            email: memUser.email,
            full_name: memUser.fullName,
            role: memUser.role,
            active: memUser.active !== false ? 1 : 0,
            status: memUser.status || 'ACTIVE'
          };
          // Also persist back to SQLite users for referential integrity
          try {
            db.prepare(`
              INSERT OR REPLACE INTO users (id, organization_id, email, password_hash, role, full_name, status, active, created_at)
              VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
            `).run(
              memUser.id,
              memUser.organizationId || session.organization_id || 'org-loops-001',
              memUser.email || `${memUser.id}@theloops.com`,
              memUser.passwordHash || 'placeholder',
              memUser.role || 'CASHIER',
              memUser.fullName || memUser.id,
              memUser.status || 'ACTIVE',
              memUser.active !== false ? 1 : 0,
              new Date().toISOString()
            );
          } catch (e) {}
        }
      }
    } catch (e) {}
  }
  if (!user || user.active === 0 || user.status === 'SUSPENDED') {
    throw new Error('User account is inactive or suspended');
  }

  // Revoke old session
  db.prepare('UPDATE sessions_v2 SET is_revoked = 1 WHERE id = ?').run(session.id);

  // Issue brand-new pair
  return generateTokenPair(user, session.organization_id);
}

/**
 * Revoke a specific session
 */
function revokeSession(tokenOrSessionId) {
  try {
    const db = getDatabase();
    db.prepare('UPDATE sessions_v2 SET is_revoked = 1 WHERE id = ?').run(tokenOrSessionId);
    db.prepare('DELETE FROM sessions WHERE token = ?').run(tokenOrSessionId);
    return { ok: true };
  } catch (e) {
    return { ok: false, error: e.message };
  }
}

/**
 * Revoke all sessions for a user
 */
function revokeAllUserSessions(userId) {
  try {
    const db = getDatabase();
    db.prepare('UPDATE sessions_v2 SET is_revoked = 1 WHERE user_id = ?').run(userId);
    db.prepare('DELETE FROM sessions WHERE user_id = ?').run(userId);
    return { ok: true };
  } catch (e) {
    return { ok: false, error: e.message };
  }
}

module.exports = {
  generateTokenPair,
  rotateRefreshToken,
  revokeSession,
  revokeAllUserSessions,
  ACCESS_TOKEN_TTL_SECONDS
};

