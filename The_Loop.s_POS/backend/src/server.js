// The Loop.s POS — High-Throughput REST API & Real-time Event Server
// Port 3002
const http = require('http');
const fs = require('fs');
const path = require('path');
const { attachRequestId, applySecurityHeaders, checkRateLimit, checkStoreScope } = require('../../../shared/security/middleware');
const { loadDb, saveDb, generateUuid } = require('./db');
const { 
  getOrganizationStatus,
  registerBusinessOrganization,
  loginUser,
  validateSession,
  logoutUser,
  requestPasswordReset,
  resetPasswordWithToken,
  verifyManagerOverride, 
  createUserAccount, 
  updateUser, 
  deleteUser, 
  revealUserPin,
  regenerateUserPin,
  updateUserPin,
  generateUniqueCompanyPin,
  generateUniqueCompanyCode,
  verifyCompanyCode,
  findOrganizationByCode,
  regenerateCompanyCode,
  getRegisteredOrganizations,
  getUsers, 
  getRoles, 
  createCustomRole, 
  updateCustomRole, 
  deleteCustomRole, 
  getAuditLogs,
  resolveUserPermissions,
  sanitizeUser
} = require('./auth');
const { calculateCartTotals, processCheckout, processRefund, parkCart, recallCart } = require('./orderEngine');
const { 
  openShift, 
  getShiftDetails, 
  getActiveShift,
  recordCashMovement, 
  closeShift, 
  getShiftHistory, 
  reopenShift, 
  getCashierPerformance, 
  getManagerShiftDashboard 
} = require('./shiftManager');
const {
  saveUnpaidOrder,
  getSavedOrders,
  resumeSavedOrder,
  cancelSavedOrder,
  updateSavedOrderCustomer
} = require('./savedOrderEngine');
const { checkTriadHealth, syncCatalogFromStock, processOutboxRelay } = require('./syncEngine');
const { generateThermalReceipt } = require('./receiptEngine');
const {
  getStores,
  getStoreById,
  createStore,
  updateStore,
  getStoreRegisters,
  createStoreRegister,
  canUserAccessStore,
  verifyStoreAndRoleAccess
} = require('./storeManager');
const { saveBase64Image, UPLOADS_DIR } = require('../../../shared/uploads/uploadService');
const { generateExcelBuffer, generateWordBuffer, generatePrintablePdfHtml } = require('../../../shared/export/exportEngine');
const {
  calculateEligibleRevenue,
  getOrCreateMonthlyPlan,
  syncMonthlyAllocations,
  getMonthlyDashboardData,
  recordExpenseWithCapitalProtection,
  processCapitalRepayment,
  dismissCapitalBorrowing,
  recordLoopShareTransaction,
  executeMonthEndClosing,
  recordFinancialTransaction,
  recordImportHistory,
  getImportHistoryList,
  recordExportAudit
} = require('../../../shared/financial/financialAllocationEngine');
const { getDatabase } = require('../../../shared/database/connection');

const PORT = process.env.PORT || 3002;

function getRequestUser(req) {
  const explicitOrgId = req.headers['x-organization-id'] || req.headers['x-business-id'];
  const token = getAuthToken(req);
  if (token) {
    const session = validateSession(token);
    if (session && session.ok && session.user) {
      if (explicitOrgId) session.user.organizationId = explicitOrgId;
      return session.user;
    }
  }
  // Internal service gateway call fallback only when accompanied by internal gateway header or loopback context
  if (explicitOrgId && (req.headers['x-gateway'] || req.socket.remoteAddress === '127.0.0.1' || req.socket.remoteAddress === '::1')) {
    return { organizationId: explicitOrgId, role: 'OWNER' };
  }
  return null;
}

// List of connected SSE clients
const sseClients = new Set();

function broadcastSse(eventType, data) {
  const message = `event: ${eventType}\ndata: ${JSON.stringify(data)}\n\n`;
  for (const client of sseClients) {
    try {
      client.write(message);
    } catch (e) {
      sseClients.delete(client);
    }
  }
}

function sendJson(res, statusCode, data) {
  res.writeHead(statusCode, {
    'Content-Type': 'application/json',
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization, x-user-id, x-organization-id, x-business-id, x-session-token'
  });
  res.end(JSON.stringify(data));
}

function parseJsonBody(req) {
  return new Promise((resolve, reject) => {
    let body = '';
    req.on('data', chunk => body += chunk);
    req.on('end', () => {
      try {
        resolve(body ? JSON.parse(body) : {});
      } catch (e) {
        reject(e);
      }
    });
    req.on('error', reject);
  });
}

// Background worker to relay outbox every 4 seconds
setInterval(async () => {
  try {
    const result = await processOutboxRelay();
    if (result.processedCount > 0) {
      broadcastSse('OUTBOX_PROCESSED', result);
    }
  } catch (e) {
    // Silent background handling
  }
}, 4000);

function getAuthToken(req) {
  const authHeader = req.headers['authorization'];
  if (authHeader && authHeader.startsWith('Bearer ')) {
    return authHeader.substring(7).trim();
  }
  return req.headers['x-session-token'] || null;
}

function requireAuth(req, res) {
  const token = getAuthToken(req);
  if (!token) {
    sendJson(res, 401, { error: 'Authentication required. Please sign in.', code: 'UNAUTHORIZED' });
    return null;
  }
  const result = validateSession(token);
  if (!result.ok) {
    sendJson(res, 401, { error: result.error || 'Invalid session. Please sign in again.', code: 'INVALID_SESSION' });
    return null;
  }
  return result.user;
}

const server = http.createServer(async (req, res) => {
  attachRequestId(req, res);
  applySecurityHeaders(res);

  // CORS Preflight
  if (req.method === 'OPTIONS') {
    res.writeHead(204, {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization, x-user-id, x-organization-id, x-business-id, x-session-token, x-request-id'
    });
    return res.end();
  }

  const parsedUrl = new URL(req.url, `http://${req.headers.host || 'localhost:3002'}`);
  let pathname = parsedUrl.pathname;
  if (pathname.startsWith('/api/pos/')) {
    pathname = '/api/' + pathname.slice('/api/pos/'.length);
  } else if (pathname === '/api/pos') {
    pathname = '/api';
  }
  const searchParams = parsedUrl.searchParams;

  try {
    // Health Check
    if (pathname === '/health' || pathname === '/api/health') {
      return sendJson(res, 200, {
        status: 'ok',
        service: 'The Loop.s POS Server',
        port: PORT,
        version: '2.0.0',
        timestamp: new Date().toISOString()
      });
    }

    // Static Uploads Serving (Images, Documents)
    if (pathname.startsWith('/uploads/') && req.method === 'GET') {
      const filename = path.basename(pathname);
      const filePath = path.join(UPLOADS_DIR, filename);
      if (fs.existsSync(filePath)) {
        const ext = path.extname(filename).toLowerCase();
        const mimeTypes = {
          '.jpg': 'image/jpeg',
          '.jpeg': 'image/jpeg',
          '.png': 'image/png',
          '.webp': 'image/webp'
        };
        const contentType = mimeTypes[ext] || 'application/octet-stream';
        res.writeHead(200, {
          'Content-Type': contentType,
          'Cache-Control': 'public, max-age=86400',
          'Access-Control-Allow-Origin': '*'
        });
        fs.createReadStream(filePath).pipe(res);
        return;
      }
      return sendJson(res, 404, { error: 'Uploaded file not found' });
    }

    // Server-Sent Events (SSE) Stream
    if (pathname === '/api/events/stream') {
      res.writeHead(200, {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        'Connection': 'keep-alive',
        'Access-Control-Allow-Origin': '*'
      });
      res.write(': connected\n\n');
      sseClients.add(res);

      req.on('close', () => {
        sseClients.delete(res);
      });
      return;
    }

    // 1. Triad Health & Status
    if (pathname === '/api/status' && req.method === 'GET') {
      const status = await checkTriadHealth();
      return sendJson(res, 200, status);
    }

    // 2. Private Authentication & Identity Subsystem
    if (pathname === '/api/auth/status' && req.method === 'GET') {
      const currentUser = getRequestUser(req);
      const reqOrg = searchParams.get('organizationId') || searchParams.get('businessId') || req.headers['x-organization-id'] || currentUser?.organizationId;
      return sendJson(res, 200, getOrganizationStatus(reqOrg));
    }

    if (pathname === '/api/auth/organizations' && req.method === 'GET') {
      const currentUser = getRequestUser(req);
      const code = searchParams.get('code') || searchParams.get('companyCode');
      return sendJson(res, 200, getRegisteredOrganizations(currentUser, code));
    }

    if (pathname === '/api/auth/verify-company-code' && req.method === 'POST') {
      const body = await parseJsonBody(req);
      const clientIp = req.socket.remoteAddress || '127.0.0.1';
      const result = verifyCompanyCode(body.companyCode, clientIp);
      const statusCode = result.ok ? 200 : (result.code === 'LOCKOUT' ? 429 : 400);
      return sendJson(res, statusCode, result);
    }

    if (pathname === '/api/auth/company-code' && req.method === 'GET') {
      const currentUser = getRequestUser(req);
      if (!currentUser) return sendJson(res, 401, { ok: false, error: 'Authentication required' });
      const org = findOrganizationByCode(currentUser.organizationId);
      if (!org) return sendJson(res, 404, { ok: false, error: 'Organization not found' });
      return sendJson(res, 200, { ok: true, companyCode: org.companyCode, organizationId: org.id });
    }

    if (pathname === '/api/auth/company-code/regenerate' && req.method === 'POST') {
      const currentUser = getRequestUser(req);
      if (!currentUser) return sendJson(res, 401, { ok: false, error: 'Authentication required' });
      try {
        const result = regenerateCompanyCode(currentUser.organizationId, currentUser);
        return sendJson(res, 200, result);
      } catch (err) {
        return sendJson(res, 403, { ok: false, error: err.message });
      }
    }

    if (pathname === '/api/auth/register-business' && req.method === 'POST') {
      const body = await parseJsonBody(req);
      const result = registerBusinessOrganization(body);
      if (!result.ok) return sendJson(res, 400, result);
      broadcastSse('ORGANIZATION_REGISTERED', result.organization);
      return sendJson(res, 201, result);
    }

    if (pathname === '/api/auth/login' && req.method === 'POST') {
      if (!checkRateLimit(req, res, 30, 60000)) return;
      const body = await parseJsonBody(req);
      const clientIp = req.socket.remoteAddress || '127.0.0.1';
      const result = loginUser({ ...body, clientIp });
      if (!result.ok) return sendJson(res, 401, result);
      return sendJson(res, 200, result);
    }

    if (pathname === '/api/auth/refresh' && req.method === 'POST') {
      const body = await parseJsonBody(req);
      try {
        const { rotateRefreshToken } = require('../../../shared/security/tokenService');
        const tokenPair = rotateRefreshToken(body.refreshToken);
        return sendJson(res, 200, { ok: true, ...tokenPair });
      } catch (err) {
        return sendJson(res, 401, { ok: false, error: err.message });
      }
    }

    if (pathname === '/api/auth/me' && req.method === 'GET') {
      const token = getAuthToken(req);
      const result = validateSession(token);
      if (!result.ok) return sendJson(res, 401, result);
      return sendJson(res, 200, result);
    }

    if (pathname === '/api/auth/logout' && req.method === 'POST') {
      const token = getAuthToken(req);
      logoutUser(token);
      return sendJson(res, 200, { ok: true, message: 'Signed out successfully' });
    }

    if (pathname === '/api/auth/forgot-password' && req.method === 'POST') {
      const body = await parseJsonBody(req);
      const result = requestPasswordReset(body.email);
      return sendJson(res, 200, result);
    }

    if (pathname === '/api/auth/reset-password' && req.method === 'POST') {
      const body = await parseJsonBody(req);
      const result = resetPasswordWithToken(body.resetToken, body.newPassword);
      if (!result.ok) return sendJson(res, 400, result);
      return sendJson(res, 200, result);
    }

    if (pathname === '/api/auth/pin' && req.method === 'POST') {
      const body = await parseJsonBody(req);
      const clientIp = req.socket.remoteAddress || '127.0.0.1';
      const authResult = loginUser({
        pin: body.pin,
        companyCode: body.companyCode,
        organizationId: body.organizationId,
        storeId: body.storeId,
        app: body.app || 'POS',
        clientIp
      });
      if (!authResult.ok) return sendJson(res, 401, authResult);
      return sendJson(res, 200, authResult);
    }

    if (pathname === '/api/auth/manager-override' && req.method === 'POST') {
      const body = await parseJsonBody(req);
      const result = verifyManagerOverride(body.pin);
      if (!result.ok) return sendJson(res, 403, result);
      return sendJson(res, 200, result);
    }

    // 2b. Centralized User & Access Management (Tenant Scoped)
    if (pathname === '/api/users/generate-pin' && req.method === 'GET') {
      const currentUser = getRequestUser(req);
      if (!currentUser) return sendJson(res, 401, { ok: false, error: 'Authentication required' });
      const orgId = searchParams.get('organizationId') || currentUser.organizationId || 'org-loops-001';
      const pin = generateUniqueCompanyPin(orgId);
      return sendJson(res, 200, { ok: true, pin });
    }

    if (pathname === '/api/users' && req.method === 'GET') {
      const currentUser = getRequestUser(req);
      if (!currentUser) return sendJson(res, 401, { ok: false, error: 'Authentication required' });
      const orgId = currentUser.organizationId || 'org-loops-001';
      return sendJson(res, 200, getUsers({ organizationId: orgId }));
    }

    if (pathname === '/api/users' && req.method === 'POST') {
      const currentUser = getRequestUser(req);
      if (!currentUser) return sendJson(res, 401, { ok: false, error: 'Authentication required' });
      if (currentUser.role !== 'OWNER' && currentUser.role !== 'SUPER_ADMIN' && !currentUser.permissions?.manageEmployees) {
        return sendJson(res, 403, { ok: false, error: 'Permission denied: Only business owners or authorized administrators can create staff accounts.' });
      }
      const body = await parseJsonBody(req);
      const orgId = currentUser.organizationId || 'org-loops-001';
      const result = createUserAccount({
        ...body,
        organizationId: orgId,
        performedBy: currentUser.fullName
      });
      if (!result.ok) return sendJson(res, 400, result);
      broadcastSse('USER_CREATED', result.user);
      return sendJson(res, 201, result);
    }

    if (pathname.endsWith('/reveal-pin') && req.method === 'POST') {
      const userId = pathname.split('/')[3];
      const currentUser = getRequestUser(req);
      if (!currentUser) return sendJson(res, 401, { ok: false, error: 'Authentication required' });
      const result = revealUserPin(userId, currentUser);
      if (!result.ok) return sendJson(res, result.forbidden ? 403 : 400, result);
      return sendJson(res, 200, result);
    }

    if (pathname.endsWith('/regenerate-pin') && req.method === 'POST') {
      const userId = pathname.split('/')[3];
      const currentUser = getRequestUser(req);
      if (!currentUser) return sendJson(res, 401, { ok: false, error: 'Authentication required' });
      const result = regenerateUserPin(userId, currentUser);
      if (!result.ok) return sendJson(res, result.forbidden ? 403 : 400, result);
      broadcastSse('USER_UPDATED', { userId });
      return sendJson(res, 200, result);
    }

    if (pathname.endsWith('/pin') && req.method === 'PUT') {
      const userId = pathname.split('/')[3];
      const currentUser = getRequestUser(req);
      if (!currentUser) return sendJson(res, 401, { ok: false, error: 'Authentication required' });
      const body = await parseJsonBody(req);
      const result = updateUserPin(userId, body.pin, currentUser);
      if (!result.ok) return sendJson(res, result.forbidden ? 403 : 400, result);
      broadcastSse('USER_UPDATED', { userId });
      return sendJson(res, 200, result);
    }

    if (pathname.startsWith('/api/users/') && req.method === 'PUT') {
      const userId = pathname.split('/')[3];
      const currentUser = getRequestUser(req);
      if (!currentUser) return sendJson(res, 401, { ok: false, error: 'Authentication required' });
      const body = await parseJsonBody(req);
      const result = updateUser(userId, body, currentUser.fullName, currentUser.organizationId, currentUser.id, currentUser.role);
      if (!result.ok) return sendJson(res, result.forbidden ? 403 : 400, result);
      broadcastSse('USER_UPDATED', result.user);
      return sendJson(res, 200, result);
    }

    if (pathname.startsWith('/api/users/') && req.method === 'DELETE') {
      const userId = pathname.split('/')[3];
      const currentUser = getRequestUser(req);
      if (!currentUser) return sendJson(res, 401, { ok: false, error: 'Authentication required' });
      const result = deleteUser(userId, currentUser.fullName, currentUser.organizationId, currentUser.id);
      if (!result.ok) return sendJson(res, result.forbidden ? 403 : 400, result);
      broadcastSse('USER_DELETED', { userId });
      return sendJson(res, 200, result);
    }

    if (pathname.endsWith('/reset-pin') && req.method === 'POST') {
      const userId = pathname.split('/')[3];
      const currentUser = getRequestUser(req);
      if (!currentUser) return sendJson(res, 401, { ok: false, error: 'Authentication required' });
      const body = await parseJsonBody(req);
      const result = updateUser(userId, { pin: body.newPin }, currentUser.fullName, currentUser.organizationId);
      if (!result.ok) return sendJson(res, result.forbidden ? 403 : 400, result);
      return sendJson(res, 200, { ok: true, message: 'Cashier PIN reset successfully' });
    }

    // 2c. Custom Roles & Permissions
    if (pathname === '/api/roles' && req.method === 'GET') {
      return sendJson(res, 200, getRoles());
    }

    if (pathname === '/api/roles' && req.method === 'POST') {
      const body = await parseJsonBody(req);
      const result = createCustomRole(body);
      if (!result.ok) return sendJson(res, 400, result);
      broadcastSse('ROLE_CREATED', result.role);
      return sendJson(res, 201, result);
    }

    if (pathname.startsWith('/api/roles/') && req.method === 'PUT') {
      const roleId = pathname.split('/')[3];
      const body = await parseJsonBody(req);
      const result = updateCustomRole(roleId, body, body.updatedBy);
      if (!result.ok) return sendJson(res, 400, result);
      broadcastSse('ROLE_UPDATED', result.role);
      return sendJson(res, 200, result);
    }

    if (pathname.startsWith('/api/roles/') && req.method === 'DELETE') {
      const roleId = pathname.split('/')[3];
      const result = deleteCustomRole(roleId, 'Administrator');
      if (!result.ok) return sendJson(res, 400, result);
      broadcastSse('ROLE_DELETED', { roleId });
      return sendJson(res, 200, result);
    }

    // 2d. Audit Trail (Tenant Scoped)
    if (pathname === '/api/audit/logs' && req.method === 'GET') {
      const currentUser = getRequestUser(req);
      const orgId = currentUser?.organizationId || 'org-loops-001';
      const limit = parseInt(searchParams.get('limit') || '100', 10);
      return sendJson(res, 200, getAuditLogs(limit, orgId));
    }

    // 2e. Multi-Store & Branch Location Management (Section 15)
    if (pathname === '/api/stores' && req.method === 'GET') {
      const currentUser = getRequestUser(req);
      const dbState = loadDb();
      const targetOrg = currentUser?.organizationId || dbState.organization?.id || 'org-6e9ed3cf';
      const stores = getStores({ organizationId: targetOrg, user: currentUser });
      return sendJson(res, 200, stores);
    }

    if (pathname === '/api/stores' && req.method === 'POST') {
      const currentUser = getRequestUser(req);
      if (currentUser && currentUser.role !== 'OWNER' && currentUser.role !== 'SUPER_ADMIN' && !currentUser.permissions?.changeSystemSettings) {
        return sendJson(res, 403, { ok: false, error: 'Only business owners or authorized administrators can create new stores.' });
      }
      const body = await parseJsonBody(req);
      const result = createStore({
        ...body,
        organizationId: currentUser?.organizationId,
        performedBy: currentUser?.fullName || 'Administrator'
      });
      if (!result.ok) return sendJson(res, 400, result);
      broadcastSse('STORE_CREATED', result.store);
      return sendJson(res, 201, result);
    }

    if (pathname.startsWith('/api/stores/') && pathname.endsWith('/registers') && req.method === 'GET') {
      const storeId = pathname.split('/')[3];
      const currentUser = getRequestUser(req);
      if (currentUser && !canUserAccessStore(currentUser, storeId)) {
        return sendJson(res, 403, { ok: false, error: `Access denied: You are not authorized to view registers for store '${storeId}'.` });
      }
      const registers = getStoreRegisters(storeId, currentUser?.organizationId);
      return sendJson(res, 200, registers);
    }

    if (pathname.startsWith('/api/stores/') && pathname.endsWith('/registers') && req.method === 'POST') {
      const storeId = pathname.split('/')[3];
      const currentUser = getRequestUser(req);
      if (currentUser && !canUserAccessStore(currentUser, storeId)) {
        return sendJson(res, 403, { ok: false, error: `Access denied: You are not authorized to add registers to store '${storeId}'.` });
      }
      if (currentUser && currentUser.role !== 'OWNER' && currentUser.role !== 'SUPER_ADMIN' && !currentUser.permissions?.changeSystemSettings) {
        return sendJson(res, 403, { ok: false, error: 'Only owners or authorized managers can add registers to a store.' });
      }
      const body = await parseJsonBody(req);
      const result = createStoreRegister({
        storeId,
        registerCode: body.registerCode,
        name: body.name,
        performedBy: currentUser?.fullName || 'Administrator'
      });
      if (!result.ok) return sendJson(res, 400, result);
      broadcastSse('REGISTER_CREATED', result.register);
      return sendJson(res, 201, result);
    }

    if (pathname.startsWith('/api/stores/') && req.method === 'PUT') {
      const storeId = pathname.split('/')[3];
      const currentUser = getRequestUser(req);
      if (currentUser && !canUserAccessStore(currentUser, storeId)) {
        return sendJson(res, 403, { ok: false, error: 'Permission denied: Cannot edit store details belonging to another business.' });
      }
      if (currentUser && currentUser.role !== 'OWNER' && currentUser.role !== 'SUPER_ADMIN' && !currentUser.permissions?.changeSystemSettings) {
        return sendJson(res, 403, { ok: false, error: 'Permission denied: Cannot edit store details.' });
      }
      const body = await parseJsonBody(req);
      const result = updateStore(storeId, body, currentUser?.fullName || 'Administrator', currentUser?.organizationId);
      if (!result.ok) return sendJson(res, result.forbidden ? 403 : 400, result);
      broadcastSse('STORE_UPDATED', result.store);
      return sendJson(res, 200, result);
    }

    // 2f. Store Headquarters (HQ) Management
    if (pathname === '/api/stores/hq' && req.method === 'GET') {
      const currentUser = getRequestUser(req);
      const dbState = loadDb();
      const orgId = currentUser?.organizationId || dbState.organization?.id || 'org-6e9ed3cf';
      const { getCurrentHq } = require('../../../shared/store/hqManager');
      const result = getCurrentHq(orgId);
      return sendJson(res, 200, result);
    }

    if (pathname === '/api/stores/switch-hq' && req.method === 'POST') {
      const currentUser = getRequestUser(req);
      if (!currentUser) return sendJson(res, 401, { ok: false, error: 'Authentication required' });
      const body = await parseJsonBody(req);
      const { switchHq } = require('../../../shared/store/hqManager');
      const result = switchHq({
        organizationId: currentUser.organizationId,
        targetStoreId: body.targetStoreId || body.storeId,
        user: currentUser
      });
      if (!result.ok) return sendJson(res, result.code || 400, result);
      broadcastSse('STORE_HQ_CHANGED', result);
      return sendJson(res, 200, result);
    }

    // 2g. Ecosystem Store Data Reset (Admin Backoffice -> Ecosystem)
    if (pathname === '/api/ecosystem/reset-store-data/history' && req.method === 'GET') {
      const currentUser = getRequestUser(req);
      if (!currentUser) return sendJson(res, 401, { ok: false, error: 'Authentication required' });
      const storeId = searchParams.get('storeId') || null;
      const { getResetHistory } = require('../../../shared/store/storeResetEngine');
      const history = getResetHistory(currentUser.organizationId, storeId);
      return sendJson(res, 200, { ok: true, history });
    }

    if (pathname === '/api/ecosystem/reset-store-data' && req.method === 'POST') {
      const currentUser = getRequestUser(req);
      if (!currentUser) return sendJson(res, 401, { ok: false, error: 'Authentication required' });
      const body = await parseJsonBody(req);
      const { resetStoreData } = require('../../../shared/store/storeResetEngine');
      const result = await resetStoreData({ ...body, user: currentUser });
      if (!result.ok) return sendJson(res, result.code || 400, result);
      broadcastSse('STORE_DATA_RESET', result);
      return sendJson(res, 200, result);
    }

    // 3. Product Catalog (Tenant Scoped & Store-Location Stock Aware)
    if ((pathname === '/api/catalog' || pathname === '/api/catalog/products') && req.method === 'GET') {
      const currentUser = getRequestUser(req);
      const db = loadDb();
      const defaultOrgId = db.organization?.id || 'org-6e9ed3cf';
      const orgId = currentUser?.organizationId || searchParams.get('organizationId') || defaultOrgId;
      const storeId = searchParams.get('storeId') || searchParams.get('locationId') || 'loc-01';
      if (currentUser && storeId && !canUserAccessStore(currentUser, storeId)) {
        return sendJson(res, 403, { ok: false, error: `Access Denied: You are not authorized to access catalog for store "${storeId}".` });
      }
      try {
        await syncCatalogFromStock();
      } catch (e) {
        // Continue with local cached catalog
      }
      const refreshedDb = loadDb();
      const org = (refreshedDb.organizations || []).find(o => o.id === orgId) || (refreshedDb.organization?.id === orgId ? refreshedDb.organization : { id: orgId, name: 'Business Catalog' });
      const locations = (refreshedDb.locations || []).filter(l => (l.organizationId || defaultOrgId) === orgId || l.organizationId === 'org-loops-001' || !l.organizationId);
      const baseProducts = (refreshedDb.products || []).filter(p => (p.organizationId || defaultOrgId) === orgId || p.organizationId === 'org-loops-001' || !p.organizationId);

      let sqlDb = null;
      try {
        const { getDatabase } = require('../../../shared/database/connection');
        sqlDb = getDatabase();
      } catch (e) {}

      const products = baseProducts.map(prod => {
        const variants = (prod.variants || []).map(v => {
          let locOnHand = v.onHand || 0;
          if (sqlDb) {
            try {
              const balRow = sqlDb.prepare('SELECT on_hand, reserved FROM stock_balances WHERE sku = ? AND location_id = ?').get(v.sku, storeId);
              if (balRow) {
                locOnHand = Number(balRow.on_hand) || 0;
              } else {
                locOnHand = 0;
              }
            } catch (err) {}
          }
          const available = Math.max(0, locOnHand - (v.reserved || 0));
          return {
            ...v,
            storeId,
            onHand: locOnHand,
            available
          };
        });

        const totalAvailable = variants.reduce((s, vr) => s + (vr.available || 0), 0);
        return {
          ...prod,
          storeId,
          variants,
          available: totalAvailable
        };
      });

      return sendJson(res, 200, {
        organization: org,
        selectedStoreId: storeId,
        locations: locations.length > 0 ? locations : refreshedDb.locations,
        products: products.length > 0 ? products : refreshedDb.products
      });
    }

    if (pathname === '/api/catalog/sync' && req.method === 'POST') {
      const result = await syncCatalogFromStock();
      broadcastSse('CATALOG_UPDATED', result);
      return sendJson(res, 200, result);
    }

    if (pathname === '/api/catalog/sync-product' && req.method === 'POST') {
      const currentUser = getRequestUser(req);
      const orgId = currentUser?.organizationId || 'org-loops-001';
      const prod = await parseJsonBody(req);
      const db = loadDb();
      const existingIdx = db.products.findIndex(p => 
        (p.id === prod.id || (prod.code && p.code === prod.code && p.code !== 'SKU')) &&
        (p.organizationId || 'org-loops-001') === orgId
      );

      const formattedProd = {
        id: prod.id || 'prod-' + generateUuid().slice(0, 8),
        organizationId: prod.organizationId || orgId,
        code: prod.code || 'SKU-' + Date.now().toString().slice(-4),
        name: prod.name,
        category: prod.category || 'General',
        categorySlug: (prod.category || 'general').toLowerCase().replace(/\s+/g, '-'),
        basePrice: prod.retailMinor ? prod.retailMinor / 100 : (prod.basePrice || 25.00),
        barcode: prod.code || '',
        image: prod.imageUrl || '📦',
        imageUrl: prod.imageUrl || '',
        variants: (prod.variants || []).map(v => ({
          sku: v.sku,
          title: v.title || v.sku,
          price: (v.retailMinor ? v.retailMinor / 100 : v.price) || (prod.retailMinor ? prod.retailMinor / 100 : (prod.basePrice || 25.00)),
          barcode: v.barcode || v.sku,
          onHand: v.onHand || 0,
          reserved: v.reserved || 0,
          available: (v.onHand || 0) - (v.reserved || 0)
        }))
      };

      if (existingIdx >= 0) {
        db.products[existingIdx] = formattedProd;
      } else {
        db.products.unshift(formattedProd);
      }

      saveDb();
      broadcastSse('CATALOG_UPDATED', formattedProd);
      return sendJson(res, 200, { ok: true, product: formattedProd });
    }

    // 3b. Currency Management (USD & KHR)
    if (pathname === '/api/currency' && req.method === 'GET') {
      const currentUser = getRequestUser(req);
      const orgId = currentUser?.organizationId || 'org-loops-001';
      const db = loadDb();
      const org = (db.organizations || []).find(o => o.id === orgId) || db.organization || {};
      if (!org.exchangeRate) {
        org.exchangeRate = 4000;
        org.rateHistory = [
          { rate: 4000, effectiveDate: new Date().toISOString(), updatedBy: 'System Baseline' }
        ];
        saveDb();
      }
      return sendJson(res, 200, {
        baseCurrency: 'USD',
        secondaryCurrency: 'KHR',
        symbolUsd: '$',
        symbolKhr: '៛',
        exchangeRate: org.exchangeRate || 4000,
        rateHistory: org.rateHistory || []
      });
    }

    if (pathname === '/api/currency/rate' && req.method === 'POST') {
      const currentUser = getRequestUser(req);
      const orgId = currentUser?.organizationId || 'org-loops-001';
      const body = await parseJsonBody(req);
      const newRate = Number(body.exchangeRate || body.rate);
      if (isNaN(newRate) || newRate <= 0) {
        return sendJson(res, 400, { error: 'Exchange rate must be a positive number' });
      }

      const db = loadDb();
      const org = (db.organizations || []).find(o => o.id === orgId) || db.organization || {};
      org.exchangeRate = newRate;
      if (!org.rateHistory) org.rateHistory = [];
      org.rateHistory.unshift({
        rate: newRate,
        effectiveDate: new Date().toISOString(),
        updatedBy: currentUser?.fullName || body.updatedBy || 'Administrator'
      });
      saveDb();

      broadcastSse('CURRENCY_UPDATED', { exchangeRate: newRate, organizationId: orgId });
      return sendJson(res, 200, { ok: true, exchangeRate: newRate });
    }

    // 4. Cart & Orders
    if (pathname === '/api/orders/calculate' && req.method === 'POST') {
      const body = await parseJsonBody(req);
      const currentUser = getRequestUser(req);
      const orgId = currentUser?.organizationId || 'org-loops-001';
      const db = loadDb();
      const org = (db.organizations || []).find(o => o.id === orgId) || db.organization || {};
      const taxRate = org.taxRate || 0.10;
      const totals = calculateCartTotals(body.items || [], body.orderDiscountPct || 0, taxRate);
      return sendJson(res, 200, totals);
    }

    if (pathname === '/api/orders/checkout' && req.method === 'POST') {
      const body = await parseJsonBody(req);

      // Backend permission check
      if (body.cashierUserId) {
        const db = loadDb();
        const user = db.users.find(u => u.id === body.cashierUserId);
        if (user) {
          const perms = resolveUserPermissions(user);
          if (!perms.makeSales) {
            return sendJson(res, 403, { ok: false, error: 'Permission denied: This user is not authorized to execute sales transactions' });
          }
        }
      }

      const checkoutResult = processCheckout(body);
      if (!checkoutResult.ok) {
        const statusCode = checkoutResult.error && checkoutResult.error.toLowerCase().includes('shift required') ? 403 : 400;
        return sendJson(res, statusCode, checkoutResult);
      }

      const db = loadDb();
      const org = (db.organizations || []).find(o => o.id === (checkoutResult.order.organizationId || 'org-loops-001')) || db.organization;
      const receipt = generateThermalReceipt(
        checkoutResult.order,
        checkoutResult.lines,
        checkoutResult.payments,
        { name: org.name }
      );

      broadcastSse('ORDER_COMPLETED', {
        order: checkoutResult.order,
        outboxEventId: checkoutResult.outboxEventId
      });

      return sendJson(res, 201, {
        ...checkoutResult,
        receipt
      });
    }

    if (pathname === '/api/orders' && req.method === 'GET') {
      const currentUser = getRequestUser(req);
      const orgId = currentUser?.organizationId || 'org-loops-001';
      const db = loadDb();
      const filtered = (db.orders || []).filter(o => (o.organizationId || 'org-loops-001') === orgId);
      return sendJson(res, 200, filtered.slice(0, 50));
    }

    // 4b. Mandatory Dedicated Sales History & Analytics API (Section 15.10)
    if (pathname === '/api/orders/history' && req.method === 'GET') {
      const db = loadDb();
      const currentUser = getRequestUser(req);

      // Section 15.12 Test 15: Cross-organization data isolation rejection
      const reqOrg = searchParams.get('organizationId') || searchParams.get('businessId') || req.headers['x-organization-id'];
      if (currentUser && reqOrg && currentUser.organizationId && currentUser.organizationId !== reqOrg) {
        return sendJson(res, 403, { ok: false, error: "Access forbidden: Cannot access another business organization's private records." });
      }

      // Section 15.10 & 15.12 Tests 7 & 14: Store authorization check
      const storeId = searchParams.get('storeId') || 'ALL';
      if (storeId !== 'ALL' && currentUser && !canUserAccessStore(currentUser, storeId)) {
        return sendJson(res, 403, { ok: false, error: `Access denied: You are not authorized to view reports for store '${storeId}'.` });
      }

      const q = (searchParams.get('search') || '').trim().toLowerCase();
      const dateRange = searchParams.get('dateRange') || 'ALL'; // TODAY, YESTERDAY, 7DAYS, ALL
      const cashierId = searchParams.get('cashierId') || 'ALL';
      const status = searchParams.get('status') || 'ALL';
      const paymentMethod = searchParams.get('paymentMethod') || 'ALL';
      const currency = searchParams.get('currency') || 'ALL';

      const now = new Date();
      const todayStr = now.toISOString().split('T')[0];
      const yesterday = new Date(Date.now() - 86400000).toISOString().split('T')[0];
      const sevenDaysAgo = new Date(Date.now() - 7 * 86400000).toISOString().split('T')[0];

      const orgWithOrders = (db.organizations || []).slice().reverse().find(o => (db.orders || []).some(ord => ord.organizationId === o.id));
      const userOrg = currentUser?.organizationId ||
        searchParams.get('organizationId') ||
        req.headers['x-organization-id'] ||
        db.organization?.id ||
        (orgWithOrders ? orgWithOrders.id : 'org-6e9ed3cf');

      let filtered = (db.orders || []).filter(ord => {
        // Multi-tenant organization isolation
        const ordOrg = ord.organizationId || ord.businessId || 'org-loops-001';
        if (ordOrg !== userOrg) {
          return false;
        }

        // Store location isolation
        if (storeId !== 'ALL') {
          if (ord.storeId !== storeId && ord.locationId !== storeId) return false;
        } else if (currentUser && currentUser.role !== 'OWNER' && currentUser.role !== 'SUPER_ADMIN') {
          const ordStore = ord.storeId || ord.locationId || 'loc-1';
          if (!canUserAccessStore(currentUser, ordStore)) return false;
        }

        // Date filter
        const ordDate = (ord.createdAt || '').split('T')[0];
        if (dateRange === 'TODAY' && ordDate !== todayStr) return false;
        if (dateRange === 'YESTERDAY' && ordDate !== yesterday) return false;
        if (dateRange === '7DAYS' && ordDate < sevenDaysAgo) return false;

        // Cashier filter
        if (cashierId !== 'ALL' && ord.cashierUserId !== cashierId && ord.cashierName !== cashierId) return false;

        // Status filter
        if (status !== 'ALL' && ord.status !== status) return false;

        // Payment method & Currency filter
        const orderPayments = (db.payments || []).filter(p => p.orderId === ord.id);
        if (paymentMethod !== 'ALL') {
          const hasMethod = orderPayments.some(p => p.method === paymentMethod || p.currencyCode === paymentMethod);
          if (!hasMethod) return false;
        }

        if (currency !== 'ALL') {
          const hasCurr = orderPayments.some(p => p.currencyCode === currency);
          if (!hasCurr && ord.currencyCode !== currency) return false;
        }

        // Search text
        if (q) {
          const orderMatch = (ord.orderNumber || '').toLowerCase().includes(q) ||
            (ord.id || '').toLowerCase().includes(q) ||
            (ord.customerName || '').toLowerCase().includes(q);

          if (orderMatch) return true;

          // Check lines for matching product name, sku, or barcode
          const lines = (db.orderLines || []).filter(l => l.orderId === ord.id);
          const lineMatch = lines.some(l => 
            (l.itemTitle || '').toLowerCase().includes(q) ||
            (l.variantSku || '').toLowerCase().includes(q)
          );
          if (lineMatch) return true;

          return false;
        }

        return true;
      });

      // Compute Summary Metrics
      const totalSalesUsd = filtered.reduce((s, o) => s + (o.status !== 'CANCELLED' ? (Number(o.totalAmount) || 0) : 0), 0);
      const totalSalesKhr = filtered.reduce((s, o) => s + (o.status !== 'CANCELLED' ? (Number(o.khrTotal) || 0) : 0), 0);
      const completedCount = filtered.filter(o => o.status === 'COMPLETED').length;
      const refundedCount = filtered.filter(o => o.status === 'REFUNDED' || o.status === 'PARTIALLY_REFUNDED').length;
      const refundTotalUsd = (db.refunds || []).filter(r => (r.organizationId || 'org-loops-001') === userOrg).reduce((s, r) => s + (Number(r.totalRefund || r.refundTotal) || 0), 0);

      // Attach lines and payments
      const detailedOrders = filtered.slice(0, 100).map(ord => ({
        ...ord,
        lines: (db.orderLines || []).filter(l => l.orderId === ord.id),
        payments: (db.payments || []).filter(p => p.orderId === ord.id),
        refunds: (db.refunds || []).filter(r => r.originalOrderId === ord.id)
      }));

      return sendJson(res, 200, {
        metrics: {
          totalCount: filtered.length,
          completedCount,
          refundedCount,
          totalSalesUsd: Number(totalSalesUsd.toFixed(2)),
          totalSalesKhr: Math.round(totalSalesKhr),
          refundTotalUsd: Number(refundTotalUsd.toFixed(2)),
          avgTicketUsd: filtered.length > 0 ? Number((totalSalesUsd / filtered.length).toFixed(2)) : 0
        },
        orders: detailedOrders
      });
    }

    // 4c. POS Telemetry Dashboard API
    if (pathname === '/api/dashboard/stats' && req.method === 'GET') {
      const db = loadDb();
      const currentUser = getRequestUser(req);
      const orgWithOrders = (db.organizations || []).slice().reverse().find(o => (db.orders || []).some(ord => ord.organizationId === o.id));
      const orgId = currentUser?.organizationId || 
        req.headers['x-organization-id'] || 
        (orgWithOrders ? orgWithOrders.id : 'org-6e9ed3cf');
      const org = (db.organizations || []).find(o => o.id === orgId) || db.organization || {};

      const orgOrders = (db.orders || []).filter(o => (o.organizationId || 'org-loops-001') === orgId);
      const activeShift = (db.shifts || []).find(s => s.status === 'ACTIVE' && (s.organizationId || s.businessId || 'org-loops-001') === orgId);
      const activeShiftId = activeShift?.id;

      const now = new Date();
      const year = now.getFullYear();
      const month = String(now.getMonth() + 1).padStart(2, '0');
      const day = String(now.getDate()).padStart(2, '0');
      const localTodayStr = `${year}-${month}-${day}`;
      const utcTodayStr = now.toISOString().split('T')[0];

      const todayOrders = orgOrders.filter(o => {
        // Active shift orders are always counted for live session telemetry
        if (activeShiftId && o.shiftId === activeShiftId) return true;

        const d = new Date(o.createdAt);
        const orderLocalDate = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
        const orderUtcDate = (o.createdAt || '').split('T')[0];
        if (orderLocalDate === localTodayStr || orderUtcDate === utcTodayStr) return true;

        return (now.getTime() - d.getTime()) <= 24 * 3600 * 1000;
      });

      const todaySalesUsd = todayOrders.reduce((sum, o) => sum + (o.status !== 'CANCELLED' ? Number(o.totalAmount || 0) : 0), 0);
      const todaySalesKhr = todayOrders.reduce((sum, o) => sum + (o.status !== 'CANCELLED' ? Number(o.khrTotal || 0) : 0), 0);
      const discountsTotal = todayOrders.reduce((sum, o) => sum + Number(o.discountTotal || 0), 0);
      
      const allTodayPayments = (db.payments || []).filter(p => {
        const ord = todayOrders.find(o => o.id === p.orderId);
        return !!ord;
      });

      const cashSalesUsd = allTodayPayments.filter(p => p.method === 'CASH' && p.currencyCode === 'USD').reduce((s, p) => s + Number(p.amount || 0), 0);
      const cashSalesKhr = allTodayPayments.filter(p => p.method === 'CASH' && p.currencyCode === 'KHR').reduce((s, p) => s + Number(p.amountKhr || 0), 0);
      const khqrSalesUsd = allTodayPayments.filter(p => p.method === 'QR_KHQR').reduce((s, p) => s + Number(p.amount || 0), 0);

      const totalGrossSalesUsd = orgOrders.reduce((sum, o) => sum + (o.status !== 'CANCELLED' ? Number(o.totalAmount || 0) : 0), 0);
      const totalGrossSalesKhr = orgOrders.reduce((sum, o) => sum + (o.status !== 'CANCELLED' ? Number(o.khrTotal || 0) : 0), 0);

      // Low stock / out of stock items for this business
      const lowStockProducts = [];
      (db.products || []).filter(p => (p.organizationId || 'org-loops-001') === orgId).forEach(p => {
        (p.variants || []).forEach(v => {
          if ((v.onHand || 0) <= 5) {
            lowStockProducts.push({
              id: p.id,
              name: p.name,
              sku: v.sku,
              title: v.title,
              onHand: v.onHand || 0,
              isOut: (v.onHand || 0) <= 0
            });
          }
        });
      });

      // Product Sales Breakdown: compute items sold today and total volume
      const productSalesMap = {};
      const todayOrderIds = new Set(todayOrders.map(o => o.id));
      const allOrgOrderIds = new Set(orgOrders.map(o => o.id));

      (db.orderLines || []).forEach(line => {
        if (allOrgOrderIds.has(line.orderId)) {
          const key = line.variantSku || line.productId || line.itemTitle;
          if (!productSalesMap[key]) {
            productSalesMap[key] = {
              sku: line.variantSku || '',
              name: line.itemTitle || 'Retail Item',
              todayQuantity: 0,
              totalQuantity: 0,
              todayRevenue: 0,
              totalRevenue: 0,
              unitPrice: Number(line.unitPrice) || 0
            };
          }
          const qty = Number(line.quantity) || 1;
          const lineTotal = Number(line.lineTotal) || (line.unitPrice * qty);

          productSalesMap[key].totalQuantity += qty;
          productSalesMap[key].totalRevenue += lineTotal;

          if (todayOrderIds.has(line.orderId)) {
            productSalesMap[key].todayQuantity += qty;
            productSalesMap[key].todayRevenue += lineTotal;
          }
        }
      });

      const todayProductsSold = Object.values(productSalesMap)
        .filter(p => p.todayQuantity > 0)
        .sort((a, b) => b.todayQuantity - a.todayQuantity);

      const topProductsAllTime = Object.values(productSalesMap)
        .sort((a, b) => b.totalQuantity - a.totalQuantity);

      const recentOrdersList = orgOrders.slice().reverse().slice(0, 10).map(o => {
        const orderLines = (db.orderLines || []).filter(l => l.orderId === o.id);
        const orderPayments = (db.payments || []).filter(p => p.orderId === o.id);
        const orderRefunds = (db.refunds || []).filter(r => r.originalOrderId === o.id);
        return {
          ...o,
          lines: orderLines,
          payments: orderPayments,
          refunds: orderRefunds,
          linesCount: orderLines.length,
          itemSummary: orderLines.map(l => `${l.itemTitle || l.variantSku} ×${l.quantity || 1}`).join(', ')
        };
      });

      return sendJson(res, 200, {
        kpi: {
          todaySalesUsd: Number(todaySalesUsd.toFixed(2)),
          todaySalesKhr: Math.round(todaySalesKhr),
          transactionCount: todayOrders.length,
          discountsTotal: Number(discountsTotal.toFixed(2)),
          cashSalesUsd: Number(cashSalesUsd.toFixed(2)),
          cashSalesKhr: Math.round(cashSalesKhr),
          khqrSalesUsd: Number(khqrSalesUsd.toFixed(2)),
          totalGrossSalesUsd: Number(totalGrossSalesUsd.toFixed(2)),
          totalGrossSalesKhr: Math.round(totalGrossSalesKhr),
          totalTransactionCount: orgOrders.length,
          exchangeRate: org.exchangeRate || 4000
        },
        shift: {
          hasActiveShift: !!activeShift,
          shiftNumber: activeShift?.shiftNumber || 'None',
          cashierName: activeShift?.cashierName || 'No Cashier Logged',
          openedAt: activeShift?.openedAt || null,
          expectedCash: activeShift?.expectedCash || 0
        },
        recentOrders: recentOrdersList,
        todayProductsSold,
        topProductsAllTime,
        lowStockAlerts: lowStockProducts.slice(0, 8)
      });
    }

    if (pathname.startsWith('/api/orders/') && pathname.endsWith('/receipt') && req.method === 'GET') {
      const parts = pathname.split('/');
      const orderNumber = parts[3];
      const currentUser = getRequestUser(req);
      const db = loadDb();
      const order = db.orders.find(o => o.orderNumber === orderNumber || o.id === orderNumber);
      if (!order) return sendJson(res, 404, { error: 'Order not found' });

      // Cross-tenant protection
      if (currentUser && currentUser.organizationId && (order.organizationId || 'org-loops-001') !== currentUser.organizationId) {
        return sendJson(res, 403, { ok: false, error: "Access forbidden: Cannot access orders belonging to another business organization." });
      }

      const org = (db.organizations || []).find(o => o.id === (order.organizationId || 'org-loops-001')) || db.organization;
      const lines = db.orderLines.filter(l => l.orderId === order.id);
      const payments = db.payments.filter(p => p.orderId === order.id);
      const receipt = generateThermalReceipt(order, lines, payments, { name: org.name });

      return sendJson(res, 200, { ok: true, order, lines, payments, receipt });
    }

    if (pathname.startsWith('/api/orders/') && !pathname.startsWith('/api/orders/saved') && !pathname.startsWith('/api/orders/history') && !pathname.startsWith('/api/orders/parked') && req.method === 'GET') {
      const orderNumber = pathname.replace('/api/orders/', '');
      const currentUser = getRequestUser(req);
      const db = loadDb();
      const order = db.orders.find(o => o.orderNumber === orderNumber || o.id === orderNumber);
      if (!order) return sendJson(res, 404, { error: 'Order not found' });

      // Cross-tenant protection
      if (currentUser && currentUser.organizationId && (order.organizationId || 'org-loops-001') !== currentUser.organizationId) {
        return sendJson(res, 403, { ok: false, error: "Access forbidden: Cannot access orders belonging to another business organization." });
      }

      const org = (db.organizations || []).find(o => o.id === (order.organizationId || 'org-loops-001')) || db.organization;
      const lines = db.orderLines.filter(l => l.orderId === order.id);
      const payments = db.payments.filter(p => p.orderId === order.id);
      const receipt = generateThermalReceipt(order, lines, payments, { name: org.name });

      return sendJson(res, 200, { order, lines, payments, receipt });
    }

    if (pathname === '/api/orders/refund' && req.method === 'POST') {
      const body = await parseJsonBody(req);

      // Backend permission check
      if (body.processedByUserId) {
        const db = loadDb();
        const user = db.users.find(u => u.id === body.processedByUserId);
        if (user) {
          const perms = resolveUserPermissions(user);
          if (!perms.refundTransactions && !body.managerApproved) {
            return sendJson(res, 403, { ok: false, error: 'Permission denied: Cashier cannot perform refunds without manager authorization' });
          }
        }
      }

      const refundResult = processRefund(body);
      if (!refundResult.ok) return sendJson(res, 400, refundResult);
      broadcastSse('REFUND_COMPLETED', refundResult.refund);
      return sendJson(res, 201, refundResult);
    }

    // 5. Park & Recall Cart
    if (pathname === '/api/orders/park' && req.method === 'POST') {
      const body = await parseJsonBody(req);
      const result = parkCart(body);
      return sendJson(res, 200, result);
    }

    if (pathname === '/api/orders/parked' && req.method === 'GET') {
      const db = loadDb();
      return sendJson(res, 200, db.parkedCarts || []);
    }

    if (pathname === '/api/orders/recall' && req.method === 'POST') {
      const body = await parseJsonBody(req);
      const result = recallCart(body.parkedId);
      if (!result.ok) return sendJson(res, 404, result);
      return sendJson(res, 200, result);
    }

    // 6. Registers & Shift Management (Section 13)
    if (pathname === '/api/shifts/current' && req.method === 'GET') {
      const currentUser = getRequestUser(req);
      const registerId = searchParams.get('registerId') || null;
      const cashierId = searchParams.get('cashierId') || currentUser?.id || null;
      const storeId = searchParams.get('storeId') || null;
      const orgId = currentUser?.organizationId || searchParams.get('organizationId') || null;
      const result = getActiveShift(registerId, cashierId, orgId, storeId);
      return sendJson(res, 200, result);
    }

    if (pathname === '/api/shifts/open' && req.method === 'POST') {
      const currentUser = getRequestUser(req);
      const body = await parseJsonBody(req);
      if (!body.cashierUserId && currentUser?.id) {
        body.cashierUserId = currentUser.id;
      }
      const result = openShift(body, currentUser);
      if (!result.ok) {
        const statusCode = result.code || ((result.error && (result.error.includes('Access Denied') || result.error.includes('not authorized'))) ? 403 : 400);
        return sendJson(res, statusCode, result);
      }
      broadcastSse('SHIFT_OPENED', result.shift);
      return sendJson(res, 201, result);
    }

    if (pathname === '/api/shifts/cash-movement' && req.method === 'POST') {
      const body = await parseJsonBody(req);
      const result = recordCashMovement(body);
      if (!result.ok) return sendJson(res, 400, result);
      broadcastSse('CASH_MOVEMENT', result.movement);
      return sendJson(res, 201, result);
    }

    if (pathname === '/api/shifts/close' && req.method === 'POST') {
      const currentUser = getRequestUser(req);
      const body = await parseJsonBody(req);
      if (!body.closedByUserId && currentUser?.id) {
        body.closedByUserId = currentUser.id;
      }
      const result = closeShift(body, currentUser);
      if (!result.ok) {
        const statusCode = result.code || ((result.error && (result.error.includes('Access Denied') || result.error.includes('not authorized'))) ? 403 : 400);
        return sendJson(res, statusCode, result);
      }
      broadcastSse('SHIFT_CLOSED', result.zReport);
      return sendJson(res, 200, result);
    }

    if (pathname === '/api/shifts/history' && req.method === 'GET') {
      const currentUser = getRequestUser(req);
      const storeId = searchParams.get('storeId') || 'ALL';
      if (storeId !== 'ALL' && currentUser && !canUserAccessStore(currentUser, storeId)) {
        return sendJson(res, 403, { ok: false, error: `Access denied: You are not authorized to view shifts for store '${storeId}'.` });
      }

      const cashierId = searchParams.get('cashierId') || 'ALL';
      const registerId = searchParams.get('registerId') || 'ALL';
      const status = searchParams.get('status') || 'ALL';
      const dateRange = searchParams.get('dateRange') || 'ALL';
      const hasDiscrepancy = searchParams.get('hasDiscrepancy') || 'ALL';
      const search = searchParams.get('search') || '';

      const history = getShiftHistory({
        cashierId,
        registerId,
        storeId,
        status,
        dateRange,
        hasDiscrepancy,
        search,
        user: currentUser,
        organizationId: currentUser?.organizationId
      });
      return sendJson(res, 200, { ok: true, shifts: history });
    }

    if (pathname === '/api/shifts/manager/dashboard' && req.method === 'GET') {
      const currentUser = getRequestUser(req);
      const dbState = loadDb();
      const targetOrg = currentUser?.organizationId || dbState.organization?.id || 'org-6e9ed3cf';
      const dashboard = getManagerShiftDashboard(targetOrg);
      return sendJson(res, 200, dashboard);
    }

    if (pathname.startsWith('/api/shifts/') && pathname.endsWith('/reopen') && req.method === 'POST') {
      const shiftId = pathname.split('/')[3];
      const body = await parseJsonBody(req);
      const result = reopenShift({ shiftId, managerUserId: body.managerUserId, reason: body.reason });
      if (!result.ok) return sendJson(res, 400, result);
      broadcastSse('SHIFT_REOPENED', result.shift);
      return sendJson(res, 200, result);
    }

    if (pathname.startsWith('/api/shifts/') && req.method === 'GET') {
      const shiftId = pathname.split('/')[3];
      const details = getShiftDetails(shiftId);
      if (!details) return sendJson(res, 404, { ok: false, error: 'Shift not found' });
      return sendJson(res, 200, { ok: true, ...details });
    }

    // 6b. Individual Cashier Sales History (Section 13.6)
    if (pathname.startsWith('/api/cashiers/') && pathname.endsWith('/performance') && req.method === 'GET') {
      const cashierId = pathname.split('/')[3];
      const dateRange = searchParams.get('dateRange') || 'ALL';
      const result = getCashierPerformance({ cashierId, dateRange });
      if (!result.ok) return sendJson(res, 400, result);
      return sendJson(res, 200, result);
    }

    // 6c. Saved Orders & Unpaid Orders (Hold Orders) (Section 14)
    if (pathname === '/api/orders/save' && req.method === 'POST') {
      const body = await parseJsonBody(req);
      const result = saveUnpaidOrder(body);
      if (!result.ok) return sendJson(res, 400, result);
      broadcastSse('ORDER_HELD', result.savedOrder);
      return sendJson(res, 201, result);
    }

    if (pathname === '/api/orders/saved' && req.method === 'GET') {
      const currentUser = getRequestUser(req);
      const search = searchParams.get('search') || '';
      const cashierId = searchParams.get('cashierId') || 'ALL';
      const shiftId = searchParams.get('shiftId') || 'ALL';
      const status = searchParams.get('status') || 'ALL';
      const dateRange = searchParams.get('dateRange') || 'ALL';

      const orders = getSavedOrders({
        search,
        cashierId,
        shiftId,
        status,
        dateRange,
        organizationId: currentUser?.organizationId,
        user: currentUser
      });
      return sendJson(res, 200, { ok: true, savedOrders: orders });
    }

    if (pathname.startsWith('/api/orders/saved/') && pathname.endsWith('/resume') && req.method === 'POST') {
      const savedOrderId = pathname.split('/')[4];
      const result = resumeSavedOrder({ savedOrderId });
      if (!result.ok) return sendJson(res, 400, result);
      return sendJson(res, 200, result);
    }

    if (pathname.startsWith('/api/orders/saved/') && pathname.endsWith('/cancel') && req.method === 'POST') {
      const savedOrderId = pathname.split('/')[4];
      const body = await parseJsonBody(req);
      const result = cancelSavedOrder({
        savedOrderId,
        cancelledByUserId: body.cancelledByUserId,
        reason: body.reason
      });
      if (!result.ok) return sendJson(res, 400, result);
      broadcastSse('HELD_ORDER_CANCELLED', result.savedOrder);
      return sendJson(res, 200, result);
    }

    if (pathname.startsWith('/api/orders/saved/') && pathname.endsWith('/customer') && req.method === 'PATCH') {
      const savedOrderId = pathname.split('/')[4];
      const body = await parseJsonBody(req);
      const result = updateSavedOrderCustomer({
        savedOrderId,
        customerName: body.customerName,
        customerPhone: body.customerPhone,
        orderNote: body.orderNote,
        updatedByUserId: body.updatedByUserId
      });
      if (!result.ok) return sendJson(res, 400, result);
      return sendJson(res, 200, result);
    }

    if (pathname.startsWith('/api/orders/saved/') && req.method === 'GET') {
      const savedOrderId = pathname.split('/')[4];
      const db = loadDb();
      const order = (db.savedOrders || []).find(o => o.id === savedOrderId);
      if (!order) return sendJson(res, 404, { ok: false, error: 'Saved order not found' });
      return sendJson(res, 200, { ok: true, savedOrder: order });
    }

    // 7. Device Connector & Hardware Management
    if (pathname === '/api/devices' && req.method === 'GET') {
      const db = loadDb();
      if (!db.hardware) {
        db.hardware = {
          printer: {
            enabled: true,
            name: 'Epson TM-T88VI (Thermal USB/ESC-POS)',
            type: 'USB_ESCPOS',
            paperWidth: '80mm',
            autoPrint: true,
            copies: 1,
            storeHeader: 'The Loops Flagship Store\n124 Sisowath Quay, Phnom Penh\nTel: +855 23 998 881',
            status: 'ONLINE'
          },
          scanner: {
            enabled: true,
            name: 'Honeywell Voyager 1400g 2D (USB HID)',
            type: 'USB_HID',
            beepOnScan: true,
            status: 'ONLINE'
          },
          cashDrawer: {
            enabled: true,
            name: 'APG Series 100 Cash Drawer (RJ12 via Printer)',
            kickOnCash: true,
            pulseDurationMs: 200,
            status: 'ONLINE'
          },
          customerDisplay: {
            enabled: true,
            name: 'VFD 2x20 Pole Display (Virtual/Web)',
            dualCurrency: true,
            status: 'ONLINE'
          }
        };
        saveDb();
      }
      return sendJson(res, 200, db.hardware);
    }

    if (pathname === '/api/devices/config' && req.method === 'POST') {
      const body = await parseJsonBody(req);
      const db = loadDb();
      db.hardware = { ...(db.hardware || {}), ...body };
      saveDb();
      broadcastSse('HARDWARE_CONFIG_UPDATED', db.hardware);
      return sendJson(res, 200, { ok: true, hardware: db.hardware });
    }

    if (pathname === '/api/devices/printer/test' && req.method === 'POST') {
      const db = loadDb();
      const testSlip = [
        '========================================',
        '        THE LOOPS RETAIL OS             ',
        '      HARDWARE DIAGNOSTIC TEST          ',
        '========================================',
        `Date/Time : ${new Date().toLocaleString()}`,
        `Printer   : ${db.hardware?.printer?.name || 'Standard Thermal 80mm'}`,
        `Encoding  : ESC/POS (UTF-8 Compatible)  `,
        `Status    : PASSED / PRINTER ONLINE     `,
        '----------------------------------------',
        'Test Barcode: ||||||||||||||||||||||||| ',
        '              *880199201928*            ',
        '----------------------------------------',
        'Thank you for testing The Loops POS.    ',
        '========================================\n\n\n'
      ].join('\n');

      return sendJson(res, 200, {
        ok: true,
        message: 'Test receipt dispatched to hardware printer queue',
        testSlip,
        escPosCommandHex: '1b40' + Buffer.from(testSlip).toString('hex') + '1d5600'
      });
    }

    if (pathname === '/api/devices/drawer/test' && req.method === 'POST') {
      return sendJson(res, 200, {
        ok: true,
        message: 'Cash drawer trigger pulse sent (ESC/POS: 1B 70 00 19 FA)',
        pulseCode: '1b700019fa'
      });
    }

    // 8. Manual Outbox Relay Trigger
    if (pathname === '/api/sync/relay' && req.method === 'POST') {
      const result = await processOutboxRelay();
      return sendJson(res, 200, result);
    }

    // 9. Inbound Event Webhook (Consumes events from Stock or Finance)
    if (pathname === '/api/inbox/events' && req.method === 'POST') {
      const event = await parseJsonBody(req);
      const db = loadDb();
      db.inbox.push({
        id: event.id || event.eventId,
        type: event.eventType,
        receivedAt: new Date().toISOString()
      });
      saveDb();
      return sendJson(res, 200, { ok: true, status: 'acknowledged' });
    }

    // =========================================================================
    // FEATURE 1 & 2: SECURE FILE UPLOAD & PRODUCT IMAGE STORAGE
    // =========================================================================
    if (pathname === '/api/upload' && req.method === 'POST') {
      const currentUser = getRequestUser(req);
      const body = await parseJsonBody(req);
      const imageData = body.image || body.file || body.data;
      if (!imageData) {
        return sendJson(res, 400, { ok: false, error: 'No image data provided. Please provide image base64 or data URI.' });
      }
      const result = saveBase64Image(imageData, body.filename || 'product');
      if (!result.ok) return sendJson(res, 400, result);
      return sendJson(res, 201, result);
    }

    // =========================================================================
    // FEATURE 1: IMPORT HISTORY MANAGEMENT (Monthly Archiving & Filters)
    // =========================================================================
    if (pathname === '/api/imports' && req.method === 'GET') {
      const currentUser = getRequestUser(req);
      const targetOrg = currentUser?.organizationId || searchParams.get('organizationId') || 'org-loops-001';
      const monthPeriod = searchParams.get('month') || null;
      const yearPeriod = searchParams.get('year') || null;
      const status = searchParams.get('status') || null;
      const search = searchParams.get('search') || null;
      const onlyArchived = searchParams.get('onlyArchived') === 'true';
      const limit = parseInt(searchParams.get('limit') || '100', 10);

      const list = getImportHistoryList({
        organizationId: targetOrg,
        monthPeriod,
        yearPeriod,
        search,
        status,
        onlyArchived,
        limit
      });
      return sendJson(res, 200, { ok: true, imports: list });
    }

    if (pathname === '/api/imports' && req.method === 'POST') {
      const currentUser = getRequestUser(req);
      if (currentUser && currentUser.role !== 'OWNER' && currentUser.role !== 'SUPER_ADMIN' && !currentUser.permissions?.importData && !currentUser.permissions?.importProducts && !currentUser.permissions?.manageImportRecords) {
        return sendJson(res, 403, { ok: false, error: 'Permission denied: You do not have permission to import business or inventory data.' });
      }
      const body = await parseJsonBody(req);
      const targetOrg = currentUser?.organizationId || body.organizationId || 'org-loops-001';

      const result = recordImportHistory({
        organizationId: targetOrg,
        importDate: body.importDate,
        purchaseDate: body.purchaseDate || body.orderDate,
        receivedDate: body.receivedDate || body.finalizedDate,
        supplierId: body.supplierId,
        supplierName: body.supplierName,
        items: body.items,
        shippingCost: body.shippingCost,
        additionalCharges: body.additionalCharges,
        importSource: body.importSource || 'MANUAL',
        documents: body.documents,
        notes: body.notes,
        isArchived: body.isArchived,
        performedById: currentUser?.id,
        performedByName: currentUser?.fullName || body.performedByName || 'Administrator'
      });

      broadcastSse('IMPORT_CREATED', result);
      broadcastSse('CATALOG_UPDATED', { source: 'IMPORT' });
      return sendJson(res, 201, result);
    }

    if (pathname.startsWith('/api/imports/') && req.method === 'GET') {
      const importId = pathname.split('/')[3];
      const dbSql = getDatabase();
      const row = dbSql.prepare('SELECT * FROM import_history WHERE id = ?').get(importId);
      if (!row) return sendJson(res, 404, { ok: false, error: 'Import record not found' });
      return sendJson(res, 200, {
        ok: true,
        import: {
          ...row,
          items: JSON.parse(row.items_json || '[]'),
          documents: JSON.parse(row.documents_json || '[]')
        }
      });
    }

    // =========================================================================
    // FEATURE 3-7: MONTHLY REVENUE ALLOCATION & BUDGETS
    // =========================================================================
    if ((pathname === '/api/allocations/monthly' || pathname === '/api/finance/allocations/monthly') && req.method === 'GET') {
      const currentUser = getRequestUser(req);
      const targetOrg = currentUser?.organizationId || searchParams.get('organizationId') || 'org-loops-001';
      const month = searchParams.get('month') || new Date().toISOString().slice(0, 7);
      
      // Initialize or sync live
      const data = getOrCreateMonthlyPlan(targetOrg, month, currentUser?.fullName || 'Business Owner');
      return sendJson(res, 200, { ok: true, ...data });
    }

    if ((pathname === '/api/allocations/plan' || pathname === '/api/finance/allocations/plan') && req.method === 'POST') {
      const currentUser = getRequestUser(req);
      if (currentUser && currentUser.role !== 'OWNER' && currentUser.role !== 'SUPER_ADMIN' && !currentUser.permissions?.manageRevenueAllocation) {
        return sendJson(res, 403, { ok: false, error: 'Permission denied: Only business owners can update revenue allocation plans.' });
      }
      const body = await parseJsonBody(req);
      const targetOrg = currentUser?.organizationId || body.organizationId || 'org-loops-001';
      const month = body.periodMonth || new Date().toISOString().slice(0, 7);

      const dbSql = getDatabase();
      const existingPlan = dbSql.prepare(`
        SELECT additional_reinvestment_percent FROM monthly_revenue_allocations
        WHERE organization_id = ? AND period_month = ?
      `).get(targetOrg, month);

      const oldPercent = existingPlan ? Number(existingPlan.additional_reinvestment_percent || 0.0) : 0.0;
      const newPercent = body.additionalReinvestmentPercent !== undefined && body.additionalReinvestmentPercent !== null
        ? Math.max(0, Math.min(100, Number(body.additionalReinvestmentPercent)))
        : oldPercent;

      dbSql.prepare(`
        UPDATE monthly_revenue_allocations
        SET categories_config_json = ?, additional_reinvestment_percent = ?, updated_at = ?
        WHERE organization_id = ? AND period_month = ?
      `).run(JSON.stringify(body.categories || []), newPercent, new Date().toISOString(), targetOrg, month);

      // Audit log per Section 9
      if (existingPlan && oldPercent !== newPercent) {
        try {
          dbSql.prepare(`
            INSERT INTO audit_logs (id, organization_id, user_id, user_name, action, details, timestamp)
            VALUES (?, ?, ?, ?, ?, ?, ?)
          `).run(
            `aud-${crypto.randomUUID()}`,
            targetOrg,
            currentUser?.id || 'usr-owner',
            currentUser?.fullName || 'Business Owner',
            'REINVESTMENT_PERCENTAGE_CHANGED',
            `Changed additional inventory reinvestment percentage from ${oldPercent}% to ${newPercent}% for month ${month}`,
            new Date().toISOString()
          );
        } catch (e) {}
      }

      const refreshed = syncMonthlyAllocations(targetOrg, month);
      broadcastSse('ALLOCATION_PLAN_UPDATED', refreshed);
      return sendJson(res, 200, { ok: true, ...refreshed });
    }

    // Capital-protected expense recording
    if ((pathname === '/api/finance/expenses/with-protection' || pathname === '/api/expenses/with-protection') && req.method === 'POST') {
      const currentUser = getRequestUser(req);
      const body = await parseJsonBody(req);
      const targetOrg = currentUser?.organizationId || body.organizationId || 'org-loops-001';

      const result = recordExpenseWithCapitalProtection({
        organizationId: targetOrg,
        periodMonth: body.periodMonth,
        categoryId: body.categoryId || 'OPERATING_EXPENSES',
        expenseCategory: body.expenseCategory,
        amount: body.amount,
        description: body.description,
        paymentDate: body.paymentDate,
        invoiceRef: body.invoiceRef,
        supplierName: body.supplierName,
        performedBy: currentUser?.fullName || body.performedBy || 'Administrator',
        allowCapitalBorrowing: body.allowCapitalBorrowing !== false
      });

      if (!result.ok) return sendJson(res, 400, result);
      broadcastSse('EXPENSE_RECORDED', result);
      return sendJson(res, 201, result);
    }

    // Capital Repayment
    if ((pathname === '/api/finance/capital/repay' || pathname === '/api/capital/repay') && req.method === 'POST') {
      const currentUser = getRequestUser(req);
      if (currentUser && currentUser.role !== 'OWNER' && currentUser.role !== 'SUPER_ADMIN' && !currentUser.permissions?.repayCapital && !currentUser.permissions?.manageCapital) {
        return sendJson(res, 403, { ok: false, error: 'Permission denied: You do not have permission to execute capital repayments.' });
      }
      const body = await parseJsonBody(req);
      const targetOrg = currentUser?.organizationId || body.organizationId || 'org-loops-001';

      const result = processCapitalRepayment({
        organizationId: targetOrg,
        borrowingId: body.borrowingId,
        amount: body.amount,
        sourceCategoryId: body.sourceCategoryId || 'OPERATING_EXPENSES',
        performedBy: currentUser?.fullName || 'Administrator',
        notes: body.notes
      });

      if (!result.ok) return sendJson(res, 400, result);
      broadcastSse('CAPITAL_REPAID', result);
      return sendJson(res, 200, result);
    }

    // Capital Borrowing Dismissal (Decide Not to Pay)
    if ((pathname === '/api/finance/capital/borrowing/dismiss' || pathname === '/api/capital/dismiss' || pathname === '/api/capital/borrowing/dismiss') && req.method === 'POST') {
      const currentUser = getRequestUser(req);
      if (currentUser && currentUser.role !== 'OWNER' && currentUser.role !== 'SUPER_ADMIN' && !currentUser.permissions?.manageCapital) {
        return sendJson(res, 403, { ok: false, error: 'Permission denied: Only authorized administrators can dismiss capital borrowings.' });
      }
      const body = await parseJsonBody(req);
      const targetOrg = currentUser?.organizationId || body.organizationId || 'org-loops-001';

      const result = dismissCapitalBorrowing({
        organizationId: targetOrg,
        borrowingId: body.borrowingId,
        performedBy: currentUser?.fullName || 'Administrator',
        reason: body.reason || 'Decision not to pay'
      });

      if (!result.ok) return sendJson(res, 400, result);
      broadcastSse('CAPITAL_BORROWING_DISMISSED', result);
      return sendJson(res, 200, result);
    }

    if ((pathname === '/api/finance/capital/inject' || pathname === '/api/capital/inject') && req.method === 'POST') {
      const currentUser = getRequestUser(req);
      if (currentUser && currentUser.role !== 'OWNER' && currentUser.role !== 'SUPER_ADMIN' && !currentUser.permissions?.injectCapital) {
        return sendJson(res, 403, { ok: false, error: 'Permission denied: You do not have permission to inject business capital.' });
      }
      const body = await parseJsonBody(req);
      const targetOrg = currentUser?.organizationId || body.organizationId || 'org-loops-001';

      const { injectCapital } = require('../../../shared/financial/financialAllocationEngine');
      const result = injectCapital({
        organizationId: targetOrg,
        amount: body.amount,
        storeId: body.storeId,
        storeName: body.storeName,
        performedBy: currentUser?.fullName || 'Owner',
        notes: body.notes
      });

      if (!result.ok) return sendJson(res, 400, result);
      broadcastSse('CAPITAL_INJECTED', result);
      return sendJson(res, 200, result);
    }

    if ((pathname === '/api/finance/capital/withdraw' || pathname === '/api/capital/withdraw') && req.method === 'POST') {
      const currentUser = getRequestUser(req);
      if (currentUser && currentUser.role !== 'OWNER' && currentUser.role !== 'SUPER_ADMIN' && !currentUser.permissions?.withdrawCapital) {
        return sendJson(res, 403, { ok: false, error: 'Permission denied: You do not have permission to withdraw business capital.' });
      }
      const body = await parseJsonBody(req);
      const targetOrg = currentUser?.organizationId || body.organizationId || 'org-loops-001';

      const { withdrawCapital } = require('../../../shared/financial/financialAllocationEngine');
      const result = withdrawCapital({
        organizationId: targetOrg,
        amount: body.amount,
        storeId: body.storeId,
        storeName: body.storeName,
        performedBy: currentUser?.fullName || 'Owner',
        notes: body.notes
      });

      if (!result.ok) return sendJson(res, 400, result);
      broadcastSse('CAPITAL_WITHDRAWN', result);
      return sendJson(res, 200, result);
    }

    if ((pathname === '/api/finance/capital/borrowings' || pathname === '/api/capital/borrowings') && req.method === 'GET') {
      const currentUser = getRequestUser(req);
      const targetOrg = currentUser?.organizationId || 'org-loops-001';
      const dbSql = getDatabase();
      const rows = dbSql.prepare(`
        SELECT * FROM capital_borrowings
        WHERE organization_id = ?
        ORDER BY date DESC
      `).all(targetOrg);
      return sendJson(res, 200, { ok: true, borrowings: rows });
    }

    if ((pathname === '/api/finance/capital/partners' || pathname === '/api/capital/partners') && req.method === 'GET') {
      const currentUser = getRequestUser(req);
      const targetOrg = currentUser?.organizationId || 'org-6e9ed3cf';
      const dbSql = getDatabase();
      const rows = dbSql.prepare(`
        SELECT id, organization_id, partner_name as partnerName, partner_role as partnerRole, 
               ownership_percentage as ownershipPercentage, total_invested as totalInvested, 
               total_withdrawn as totalWithdrawn, current_equity as currentEquity, notes, created_at as createdAt
        FROM capital_accounts
        WHERE organization_id = ? OR organization_id = 'org-6e9ed3cf'
        ORDER BY created_at ASC
      `).all(targetOrg);
      return sendJson(res, 200, { ok: true, partners: rows, accounts: rows });
    }

    // =========================================================================
    // FEATURE 8: CONFIDENTIAL LOOP SHARE MANAGEMENT
    // =========================================================================
    if ((pathname === '/api/finance/loop-share/ledger' || pathname === '/api/loop-share/ledger') && req.method === 'GET') {
      const currentUser = getRequestUser(req);
      if (currentUser && currentUser.role !== 'OWNER' && currentUser.role !== 'SUPER_ADMIN' && !currentUser.permissions?.viewLoopShare) {
        return sendJson(res, 403, { ok: false, error: 'Permission denied: Loop Share is confidential to business owners.' });
      }
      const targetOrg = currentUser?.organizationId || 'org-6e9ed3cf';
      const dbSql = getDatabase();
      const rows = dbSql.prepare(`
        SELECT * FROM loop_share_ledger
        WHERE organization_id = ? OR organization_id = 'org-6e9ed3cf' OR organization_id IS NULL
        ORDER BY date DESC, created_at DESC
      `).all(targetOrg);

      const netShare = dbSql.prepare(`
        SELECT 
          COALESCE(SUM(CASE WHEN transaction_type IN ('ALLOCATION', 'ADJUSTMENT_ADD') THEN amount ELSE 0 END), 0) -
          COALESCE(SUM(CASE WHEN transaction_type IN ('DISTRIBUTION', 'WITHDRAWAL', 'PAYMENT', 'ADJUSTMENT_SUB') THEN amount ELSE 0 END), 0) as balance
        FROM loop_share_ledger
        WHERE organization_id = ? OR organization_id = 'org-6e9ed3cf' OR organization_id IS NULL
      `).get(targetOrg);
      const balance = Math.max(0, netShare?.balance || 0);

      return sendJson(res, 200, { ok: true, balance, transactions: rows });
    }

    if ((pathname === '/api/finance/loop-share/transaction' || pathname === '/api/loop-share/transaction') && req.method === 'POST') {
      const currentUser = getRequestUser(req);
      if (currentUser && currentUser.role !== 'OWNER' && currentUser.role !== 'SUPER_ADMIN' && !currentUser.permissions?.manageLoopShare) {
        return sendJson(res, 403, { ok: false, error: 'Permission denied: Only business owners can manage Loop Share.' });
      }
      const body = await parseJsonBody(req);
      const targetOrg = currentUser?.organizationId || body.organizationId || 'org-loops-001';

      const result = recordLoopShareTransaction({
        organizationId: targetOrg,
        periodMonth: body.periodMonth,
        transactionType: body.transactionType || 'DISTRIBUTION',
        amount: body.amount,
        recipientName: body.recipientName,
        description: body.description,
        authorizedBy: currentUser?.fullName || 'Business Owner'
      });

      if (!result.ok) return sendJson(res, 400, result);
      broadcastSse('LOOP_SHARE_UPDATED', result);
      return sendJson(res, 201, result);
    }

    // =========================================================================
    // FEATURE 10: AUTOMATIC MONTH-END CLOSING & SNAPSHOTS
    // =========================================================================
    if ((pathname === '/api/finance/closing/execute' || pathname === '/api/closing/execute') && req.method === 'POST') {
      const currentUser = getRequestUser(req);
      if (currentUser && currentUser.role !== 'OWNER' && currentUser.role !== 'SUPER_ADMIN' && !currentUser.permissions?.manageMonthEndClosing) {
        return sendJson(res, 403, { ok: false, error: 'Permission denied: Only business owners can finalize month-end closing.' });
      }
      const body = await parseJsonBody(req);
      const targetOrg = currentUser?.organizationId || body.organizationId || 'org-loops-001';
      const month = body.periodMonth || new Date().toISOString().slice(0, 7);

      const result = executeMonthEndClosing({
        organizationId: targetOrg,
        periodMonth: month,
        closedBy: currentUser?.fullName || 'Business Owner',
        salaryCarryForwardDecision: body.salaryCarryForwardDecision || 'CARRY_FORWARD',
        manualSalaryAmount: body.manualSalaryAmount || 0.0
      });

      if (!result.ok) return sendJson(res, 400, result);
      broadcastSse('MONTH_CLOSED', result);
      return sendJson(res, 200, result);
    }

    if ((pathname === '/api/finance/closing/history' || pathname === '/api/closing/history') && req.method === 'GET') {
      const currentUser = getRequestUser(req);
      const targetOrg = currentUser?.organizationId || 'org-loops-001';
      const dbSql = getDatabase();
      const rows = dbSql.prepare(`
        SELECT * FROM monthly_closing_snapshots
        WHERE organization_id = ?
        ORDER BY period_month DESC
      `).all(targetOrg);

      return sendJson(res, 200, {
        ok: true,
        snapshots: rows.map(r => ({
          ...r,
          data: JSON.parse(r.snapshot_data_json || '{}')
        }))
      });
    }

    // Central Financial Transactions Audit Ledger
    if ((pathname === '/api/finance/transactions' || pathname === '/api/transactions/financial') && req.method === 'GET') {
      const currentUser = getRequestUser(req);
      const targetOrg = currentUser?.organizationId || 'org-loops-001';
      const dbSql = getDatabase();
      const limit = parseInt(searchParams.get('limit') || '100', 10);
      const rows = dbSql.prepare(`
        SELECT * FROM financial_transactions
        WHERE organization_id = ?
        ORDER BY date DESC, created_at DESC LIMIT ?
      `).all(targetOrg, limit);

      return sendJson(res, 200, { ok: true, transactions: rows });
    }

    // =========================================================================
    // FEATURE 14: MULTI-FORMAT REPORT EXPORT ENGINE (Excel, Word, PDF)
    // =========================================================================
    if (pathname === '/api/reports/export' && req.method === 'GET') {
      const currentUser = getRequestUser(req);
      const targetOrg = currentUser?.organizationId || searchParams.get('organizationId') || 'org-loops-001';
      const reportType = searchParams.get('reportType') || 'FINANCIAL_ALLOCATION';
      const format = (searchParams.get('format') || 'xlsx').toLowerCase();
      const month = searchParams.get('month') || new Date().toISOString().slice(0, 7);

      // Enforce confidential Loop Share export permission
      if (reportType === 'LOOP_SHARE' && currentUser && currentUser.role !== 'OWNER' && currentUser.role !== 'SUPER_ADMIN' && !currentUser.permissions?.exportLoopShareReports) {
        return sendJson(res, 403, { ok: false, error: 'Permission denied: Cannot export confidential Loop Share reports.' });
      }

      // Record audit log
      recordExportAudit({
        organizationId: targetOrg,
        reportType,
        fileFormat: format.toUpperCase(),
        userId: currentUser?.id,
        userName: currentUser?.fullName || 'Administrator',
        periodOrDateRange: month
      });

      let exportPayload = {
        title: 'Report',
        period: month,
        columns: [],
        rows: [],
        totals: null,
        summaryCards: []
      };

      if (reportType === 'IMPORT_HISTORY') {
        const imports = getImportHistoryList({ organizationId: targetOrg, monthPeriod: month });
        exportPayload = {
          title: 'Product & Inventory Import History',
          period: month,
          columns: [
            { header: 'Reference', key: 'import_ref' },
            { header: 'Date', key: 'import_date' },
            { header: 'Supplier', key: 'supplier_name' },
            { header: 'Items Count', key: 'product_count' },
            { header: 'Total Qty', key: 'total_quantity' },
            { header: 'Total Value ($)', key: 'total_import_value' },
            { header: 'Status', key: 'status' },
            { header: 'Received By', key: 'performed_by_name' }
          ],
          rows: imports.map(i => ({
            import_ref: i.import_ref,
            import_date: i.import_date?.slice(0, 10),
            supplier_name: i.supplier_name || 'N/A',
            product_count: i.product_count,
            total_quantity: i.total_quantity,
            total_import_value: `$${Number(i.total_import_value || 0).toFixed(2)}`,
            status: i.status,
            performed_by_name: i.performed_by_name
          })),
          summaryCards: [
            { label: 'Total Imports', value: imports.length },
            { label: 'Total Units', value: imports.reduce((s, x) => s + (x.total_quantity || 0), 0) },
            { label: 'Total Landed Value', value: `$${imports.reduce((s, x) => s + (x.total_import_value || 0), 0).toFixed(2)}` }
          ]
        };
      } else if (reportType === 'FINANCIAL_ALLOCATION' || reportType === 'MONTHLY_BUDGET') {
        const dashboard = getMonthlyDashboardData(targetOrg, month);
        exportPayload = {
          title: `Monthly Revenue Allocation & Budgets (${month})`,
          period: month,
          columns: [
            { header: 'Budget Category', key: 'category_name' },
            { header: 'Alloc Type', key: 'allocation_type' },
            { header: 'Rule', key: 'allocation_value' },
            { header: 'Allocated ($)', key: 'allocated_amount' },
            { header: 'Carry-Forward ($)', key: 'opening_carry_forward' },
            { header: 'Available ($)', key: 'available_budget' },
            { header: 'Spent ($)', key: 'spent_amount' },
            { header: 'Borrowed ($)', key: 'borrowed_from_capital' },
            { header: 'Remaining ($)', key: 'remaining_balance' }
          ],
          rows: (dashboard.budgets || []).map(b => ({
            category_name: b.category_name,
            allocation_type: b.allocation_type,
            allocation_value: b.allocation_type === 'PERCENT' ? `${b.allocation_value}%` : `$${b.allocation_value}`,
            allocated_amount: `$${Number(b.allocated_amount || 0).toFixed(2)}`,
            opening_carry_forward: `$${Number(b.opening_carry_forward || 0).toFixed(2)}`,
            available_budget: `$${Number(b.available_budget || 0).toFixed(2)}`,
            spent_amount: `$${Number(b.spent_amount || 0).toFixed(2)}`,
            borrowed_from_capital: `$${Number(b.borrowed_from_capital || 0).toFixed(2)}`,
            remaining_balance: `$${Number(b.remaining_balance || 0).toFixed(2)}`
          })),
          totals: {
            category_name: 'TOTALS',
            allocation_type: '—',
            allocation_value: '—',
            allocated_amount: `$${(dashboard.budgets || []).reduce((s, b) => s + (Number(b.allocated_amount) || 0), 0).toFixed(2)}`,
            opening_carry_forward: `$${(dashboard.budgets || []).reduce((s, b) => s + (Number(b.opening_carry_forward) || 0), 0).toFixed(2)}`,
            available_budget: `$${(dashboard.budgets || []).reduce((s, b) => s + (Number(b.available_budget) || 0), 0).toFixed(2)}`,
            spent_amount: `$${(dashboard.budgets || []).reduce((s, b) => s + (Number(b.spent_amount) || 0), 0).toFixed(2)}`,
            borrowed_from_capital: `$${(dashboard.budgets || []).reduce((s, b) => s + (Number(b.borrowed_from_capital) || 0), 0).toFixed(2)}`,
            remaining_balance: `$${(dashboard.budgets || []).reduce((s, b) => s + (Number(b.remaining_balance) || 0), 0).toFixed(2)}`
          },
          summaryCards: [
            { label: 'Total Sales (Gross)', value: `$${(dashboard.revenue?.totalSales || 0).toFixed(2)}` },
            { label: 'Eligible Realized Revenue', value: `$${(dashboard.revenue?.eligibleRevenue || 0).toFixed(2)}` },
            { label: 'Business Capital Reserve', value: `$${(dashboard.capital?.balance || 0).toFixed(2)}` },
            { label: 'Outstanding Capital Borrowed', value: `$${(dashboard.capital?.outstandingRepayment || 0).toFixed(2)}` }
          ]
        };
      } else if (reportType === 'LOOP_SHARE') {
        const dbSql = getDatabase();
        const txs = dbSql.prepare('SELECT * FROM loop_share_ledger WHERE organization_id = ? ORDER BY date DESC').all(targetOrg);
        exportPayload = {
          title: 'Confidential Loop Share Ledger',
          period: month,
          columns: [
            { header: 'Reference', key: 'reference' },
            { header: 'Date', key: 'date' },
            { header: 'Type', key: 'transaction_type' },
            { header: 'Amount ($)', key: 'amount' },
            { header: 'Pool Balance After ($)', key: 'balance_after' },
            { header: 'Recipient / Beneficiary', key: 'recipient_name' },
            { header: 'Authorized By', key: 'authorized_by' }
          ],
          rows: txs.map(t => ({
            reference: t.reference,
            date: t.date?.slice(0, 10),
            transaction_type: t.transaction_type,
            amount: `$${Number(t.amount || 0).toFixed(2)}`,
            balance_after: `$${Number(t.balance_after || 0).toFixed(2)}`,
            recipient_name: t.recipient_name || 'Founder Pool',
            authorized_by: t.authorized_by
          })),
          summaryCards: [
            { label: 'Current Pool Balance', value: `$${(txs[0]?.balance_after || 0).toFixed(2)}` },
            { label: 'Total Transactions', value: txs.length }
          ]
        };
      }

      if (format === 'xlsx') {
        const buffer = generateExcelBuffer(exportPayload);
        res.writeHead(200, {
          'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
          'Content-Disposition': `attachment; filename="${reportType.toLowerCase()}_${month}.xlsx"`,
          'Content-Length': buffer.length
        });
        return res.end(buffer);
      } else if (format === 'docx') {
        const buffer = generateWordBuffer(exportPayload);
        res.writeHead(200, {
          'Content-Type': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
          'Content-Disposition': `attachment; filename="${reportType.toLowerCase()}_${month}.docx"`,
          'Content-Length': buffer.length
        });
        return res.end(buffer);
      } else {
        // PDF / Printable view
        const html = generatePrintablePdfHtml({
          ...exportPayload,
          businessName: 'The Loops Private Cloud'
        });
        res.writeHead(200, {
          'Content-Type': 'text/html; charset=utf-8'
        });
        return res.end(html);
      }
    }

    // 404 Route
    sendJson(res, 404, { error: `Endpoint ${pathname} not found on The Loop.s POS Server` });
  } catch (err) {
    console.error('[POS SERVER ERROR]', err);
    sendJson(res, 500, { error: 'Internal server error: ' + err.message });
  }
});

server.listen(PORT, () => {
  console.log(`================================================================`);
  console.log(`🏬 The Loop.s POS Server running on http://localhost:${PORT}`);
  console.log(`📡 Triad Sync: Stock (Port 3000) & Loops Finance (Port 3001)`);
  console.log(`================================================================`);
});
