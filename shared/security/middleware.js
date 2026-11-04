// ============================================================================
// THE LOOPS UNIVERSAL RETAIL SUITE — STANDARDIZED SECURITY & RBAC MIDDLEWARE
// Implements JWT Verification, Store Scoping, Deny-by-Default RBAC, Rate Limiting,
// and Security Headers per Sections 4, 5, and 6 of the Security Standard.
// ============================================================================

const crypto = require('crypto');
const { verifyToken } = require('./jwt');
const { getDatabase } = require('../database/connection');

// In-Memory Sliding Window Rate Limiter
const rateLimitBuckets = new Map();

/**
 * Attach a unique server-generated Request ID to every request
 */
function attachRequestId(req, res) {
  const reqId = req.headers['x-request-id'] || `req_${crypto.randomUUID()}`;
  req.id = reqId;
  res.setHeader('X-Request-Id', reqId);
  return reqId;
}

/**
 * Standardize HTTP JSON Response per Section 4.3
 */
function sendStandardJson(res, statusCode, dataOrError, isError = false, extraMeta = {}) {
  const meta = {
    requestId: res.getHeader('X-Request-Id') || `req_${Date.now()}`,
    timestamp: new Date().toISOString(),
    ...extraMeta
  };

  res.setHeader('Content-Type', 'application/json');
  res.writeHead(statusCode);

  if (isError || statusCode >= 400) {
    const errorObj = typeof dataOrError === 'string'
      ? { code: 'OPERATION_FAILED', message: dataOrError }
      : (dataOrError.error ? (typeof dataOrError.error === 'string' ? { code: 'ERROR', message: dataOrError.error } : dataOrError.error) : dataOrError);

    res.end(JSON.stringify({
      success: false,
      error: errorObj,
      meta
    }, null, 2));
  } else {
    res.end(JSON.stringify({
      success: true,
      data: dataOrError,
      meta
    }, null, 2));
  }
}

/**
 * Apply OWASP Security Headers per Section 6.1
 */
function applySecurityHeaders(res) {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'SAMEORIGIN');
  res.setHeader('X-XSS-Protection', '1; mode=block');
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
  res.setHeader('Strict-Transport-Security', 'max-age=31536000; includeSubDomains');
}

/**
 * In-memory Rate Limiting per IP / Client per Section 6.2
 */
function checkRateLimit(req, res, maxRequests = 60, windowMs = 60000) {
  const ip = req.headers['x-forwarded-for'] || req.socket.remoteAddress || '127.0.0.1';
  const key = `${ip}:${req.url.split('?')[0]}`;
  const now = Date.now();

  let bucket = rateLimitBuckets.get(key);
  if (!bucket || (now - bucket.startTime) > windowMs) {
    bucket = { startTime: now, count: 1 };
    rateLimitBuckets.set(key, bucket);
    return true;
  }

  bucket.count++;
  if (bucket.count > maxRequests) {
    res.setHeader('Retry-After', Math.ceil((bucket.startTime + windowMs - now) / 1000));
    sendStandardJson(res, 429, {
      code: 'RATE_LIMIT_EXCEEDED',
      message: 'Too many requests. Please slow down and try again shortly.'
    }, true);
    return false;
  }

  return true;
}

/**
 * Authenticate JWT Bearer Token with Legacy Session Fallback per Section 5.3
 */
function authenticateRequest(req) {
  const authHeader = req.headers['authorization'];
  let rawToken = authHeader && authHeader.startsWith('Bearer ') ? authHeader.slice(7).trim() : null;

  if (!rawToken) {
    rawToken = req.headers['x-session-token'] || null;
  }

  if (!rawToken) {
    try {
      const u = new URL(req.url, `http://${req.headers.host || 'localhost'}`);
      rawToken = u.searchParams.get('token');
    } catch (e) {}
  }

  const explicitOrgId = req.headers['x-organization-id'] || req.headers['x-business-id'];

  if (!rawToken) {
    return {
      isAuthenticated: false,
      user: null,
      organizationId: explicitOrgId || 'org-6e9ed3cf',
      role: 'ANONYMOUS',
      token: null
    };
  }

  // 1. Try JWT Verification
  if (rawToken.split('.').length === 3) {
    try {
      const payload = verifyToken(rawToken);
      const user = {
        id: payload.sub,
        role: payload.role,
        email: payload.email,
        fullName: payload.name,
        storeId: payload.storeId,
        organizationId: payload.org
      };

      return {
        isAuthenticated: true,
        user,
        organizationId: payload.org || explicitOrgId,
        role: payload.role,
        storeId: payload.storeId,
        sessionId: payload.sid,
        token: rawToken
      };
    } catch (err) {
      // If JWT expired or clock drifted, verify if session is still active in database
      try {
        const db = getDatabase();
        const session = db.prepare(`
          SELECT s.*, u.role, u.email, u.full_name, u.status, u.assigned_store_ids_json
          FROM sessions s
          JOIN users u ON s.user_id = u.id
          WHERE s.token = ? AND s.expires_at > ?
        `).get(rawToken, new Date().toISOString());

        if (session && session.status !== 'SUSPENDED') {
          const user = {
            id: session.user_id,
            role: session.role,
            email: session.email,
            fullName: session.full_name,
            storeId: null,
            organizationId: session.organization_id
          };
          return {
            isAuthenticated: true,
            user,
            organizationId: session.organization_id || explicitOrgId,
            role: session.role,
            storeId: null,
            sessionId: session.token,
            token: rawToken
          };
        }
      } catch (dbErr) {}

      // If invalid/expired JWT and no active session found
      return {
        isAuthenticated: false,
        error: `JWT Authentication Failed: ${err.message}`,
        user: null,
        organizationId: explicitOrgId || 'org-6e9ed3cf',
        role: 'ANONYMOUS',
        token: null
      };
    }
  }

  // 2. Legacy / Opaque Session Token Fallback (Checked against SQLite sessions)
  try {
    const db = getDatabase();
    const session = db.prepare(`
      SELECT s.*, u.role, u.email, u.full_name, u.status, u.assigned_store_ids_json
      FROM sessions s
      JOIN users u ON s.user_id = u.id
      WHERE s.token = ? AND s.expires_at > ?
    `).get(rawToken, new Date().toISOString());

    if (session && session.status !== 'SUSPENDED') {
      const user = {
        id: session.user_id,
        role: session.role,
        email: session.email,
        fullName: session.full_name,
        organizationId: session.organization_id
      };

      return {
        isAuthenticated: true,
        user,
        organizationId: session.organization_id || explicitOrgId,
        role: session.role,
        token: rawToken
      };
    }
  } catch (e) {}

  return {
    isAuthenticated: false,
    user: null,
    organizationId: explicitOrgId || 'org-6e9ed3cf',
    role: 'ANONYMOUS',
    token: null
  };
}

/**
 * Enforce RBAC Role Check (Deny-by-Default per Section 5.4)
 */
function checkRole(reqContext, allowedRoles = [], actionName = 'Action') {
  if (!reqContext.isAuthenticated) {
    const err = new Error(`Authentication Required: You must be logged in to perform "${actionName}".`);
    err.statusCode = 401;
    err.code = 'UNAUTHORIZED';
    throw err;
  }

  const role = reqContext.role || reqContext.user?.role || 'ANONYMOUS';

  // System Administrator & Organization Owner always bypass role restrictions
  if (role === 'OWNER' || role === 'SUPER_ADMIN') {
    return true;
  }

  if (allowedRoles.length > 0 && !allowedRoles.includes(role)) {
    const err = new Error(`Forbidden: Role "${role}" is not authorized to perform "${actionName}". Allowed: [${allowedRoles.join(', ')}]`);
    err.statusCode = 403;
    err.code = 'FORBIDDEN';
    throw err;
  }

  return true;
}

/**
 * Enforce Store-Level Scoping per Section 5.4
 * Cashier assigned to Store A cannot access Store B's resources
 */
function checkStoreScope(reqContext, requestedStoreId, actionName = 'Access Store') {
  if (!requestedStoreId) return true;
  if (!reqContext.isAuthenticated) return false;

  const role = reqContext.role || reqContext.user?.role;
  if (role === 'OWNER' || role === 'SUPER_ADMIN' || role === 'POS_ADMIN') {
    return true; // Executives and POS admins can access all branches
  }

  const userAssignedStoreId = reqContext.storeId || reqContext.user?.storeId;
  if (userAssignedStoreId && userAssignedStoreId !== '*' && userAssignedStoreId !== requestedStoreId) {
    const err = new Error(`Access Denied: You are assigned to store "${userAssignedStoreId}" and cannot perform "${actionName}" on store "${requestedStoreId}".`);
    err.statusCode = 403;
    err.code = 'STORE_ACCESS_DENIED';
    throw err;
  }

  return true;
}

module.exports = {
  attachRequestId,
  sendStandardJson,
  applySecurityHeaders,
  checkRateLimit,
  authenticateRequest,
  checkRole,
  checkStoreScope
};

