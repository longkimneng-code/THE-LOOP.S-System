// ============================================================================
// Loops Finance V3 — REST API Server
// Complete accounting and financial management backend
// ============================================================================

const http = require('http');
const fs = require('fs');
const path = require('path');
const db = require('./db');
const stockIntegration = require('./stockIntegration');
const { saveBase64Image, UPLOADS_DIR } = require('../../../shared/uploads/uploadService');
require('dotenv').config();

const PORT = process.env.PORT || 3001;

function getUserAssignedStoreIds(user) {
  if (!user) return ['*'];
  if (user.role === 'OWNER' || user.role === 'SUPER_ADMIN') return ['*'];
  let list = user.assignedStoreIds || user.locations;
  if (!list && (user.assigned_store_ids_json || user.assigned_store_ids)) {
    try {
      const raw = user.assigned_store_ids_json || user.assigned_store_ids;
      list = typeof raw === 'string' ? JSON.parse(raw) : raw;
    } catch (e) {}
  }
  return Array.isArray(list) && list.length > 0 ? list : ['*'];
}

function getFinanceTenantContext(req) {
  const authHeader = req.headers['authorization'];
  let token = authHeader && authHeader.startsWith('Bearer ') ? authHeader.slice(7).trim() : null;
  if (!token) {
    try {
      const urlObj = new URL(req.url, `http://${req.headers.host || 'localhost'}`);
      token = urlObj.searchParams.get('token');
    } catch (e) {}
  }
  if (!token) {
    token = req.headers['x-session-token'] || null;
  }
  let explicitOrgId = req.headers['x-organization-id'] || req.headers['x-business-id'];
  let payload = null;
  
  // Try resolving from JWT token first
  if (token && token.split('.').length === 3) {
    try {
      const { verifyToken } = require('../../../shared/security/jwt');
      payload = verifyToken(token);
      if (payload) {
        explicitOrgId = payload.org || payload.organizationId || explicitOrgId;
      }
    } catch (e) {}
  }

  // Try resolving from SQLite theloops_enterprise.db
  try {
    const { getDatabase } = require('../../../shared/database/connection');
    const dbSync = getDatabase();

    let resolvedOrgId = explicitOrgId;
    let user = null;

    if (payload && payload.sub) {
      user = dbSync.prepare('SELECT * FROM users WHERE id = ?').get(payload.sub);
      if (user && user.organization_id) {
        resolvedOrgId = user.organization_id;
      }
    }

    if (!user && token) {
      const sessionRow = dbSync.prepare('SELECT * FROM sessions WHERE token = ? AND expires_at > ?').get(token, new Date().toISOString());
      if (sessionRow) {
        user = dbSync.prepare('SELECT * FROM users WHERE id = ?').get(sessionRow.user_id);
        if (user && user.organization_id) {
          resolvedOrgId = user.organization_id;
        }
      }
    }

    if (!resolvedOrgId) {
      // If no explicit org, pick the first registered business
      const firstOrg = dbSync.prepare('SELECT * FROM organizations LIMIT 1').get();
      if (firstOrg) {
        resolvedOrgId = firstOrg.id;
      }
    }

    if (resolvedOrgId) {
      const org = dbSync.prepare('SELECT * FROM organizations WHERE id = ?').get(resolvedOrgId);
      if (org) {
        const explicitRole = req.headers['x-user-role'] || req.headers['x-staff-role'];
        let assignedStoreIds = ['*'];
        if (user) {
          if (user.role === 'OWNER' || user.role === 'SUPER_ADMIN') {
            assignedStoreIds = ['*'];
          } else if (user.assigned_store_ids_json || user.assigned_store_ids) {
            try {
              const raw = user.assigned_store_ids_json || user.assigned_store_ids;
              const parsed = typeof raw === 'string' ? JSON.parse(raw) : raw;
              if (Array.isArray(parsed) && parsed.length > 0) assignedStoreIds = parsed;
            } catch (e) {}
          } else if (user.assignedStoreIds) {
            assignedStoreIds = Array.isArray(user.assignedStoreIds) ? user.assignedStoreIds : [user.assignedStoreIds];
          } else if (user.locations) {
            assignedStoreIds = Array.isArray(user.locations) ? user.locations : [user.locations];
          }
        }
        const effectiveUser = user 
          ? { ...user, fullName: user.full_name || user.fullName, organizationId: user.organization_id, assignedStoreIds, locations: assignedStoreIds } 
          : (explicitRole ? { role: explicitRole.toUpperCase(), fullName: 'Staff', assignedStoreIds: ['*'] } : null);

        return {
          orgId: org.id,
          user: effectiveUser,
          org: { ...org, ownerName: org.owner_name, ownerEmail: org.owner_email, exchangeRate: org.exchange_rate, taxRate: org.tax_rate },
          isDefaultOrg: false,
          token
        };
      }
    }
  } catch (e) {
    // Fall back to JSON if SQLite unavailable
  }

  // Fallback to pos_state.json
  try {
    const posStatePath = path.resolve(__dirname, '../../../The_Loop.s_POS/backend/data/pos_state.json');
    if (fs.existsSync(posStatePath)) {
      const posDb = JSON.parse(fs.readFileSync(posStatePath, 'utf8'));
      let user = null;
      let orgId = explicitOrgId;
      if (token) {
        const session = (posDb.sessions || []).find(s => s.token === token && new Date(s.expiresAt) > new Date());
        if (session) {
          user = (posDb.users || []).find(u => u.id === session.userId);
          if (user && user.organizationId) {
            orgId = user.organizationId;
          }
        }
      }
      if (!orgId && posDb.organizations && posDb.organizations.length > 0) {
        orgId = posDb.organizations[0].id;
      }
      if (orgId) {
        const org = (posDb.organizations || []).find(o => o.id === orgId);
        const explicitRole = req.headers['x-user-role'] || req.headers['x-staff-role'];
        let assignedStoreIds = ['*'];
        if (user) {
          if (user.role === 'OWNER' || user.role === 'SUPER_ADMIN') {
            assignedStoreIds = ['*'];
          } else {
            assignedStoreIds = user.assignedStoreIds || user.locations || ['*'];
          }
        }
        const effectiveUser = user 
          ? { ...user, assignedStoreIds, locations: assignedStoreIds }
          : (explicitRole ? { role: explicitRole.toUpperCase(), fullName: 'Staff', assignedStoreIds: ['*'] } : null);
        return {
          orgId: orgId,
          user: effectiveUser,
          org,
          isDefaultOrg: false,
          token
        };
      }
    }
  } catch (e) {}

  const fallbackRole = req.headers['x-user-role'] || req.headers['x-staff-role'];
  return { 
    orgId: 'org-6e9ed3cf', 
    user: fallbackRole ? { role: fallbackRole.toUpperCase(), fullName: 'Staff', assignedStoreIds: ['*'] } : null, 
    org: null, 
    isDefaultOrg: false, 
    token: null 
  };
}

function sendJson(res, statusCode, data) {
  res.writeHead(statusCode, {
    'Content-Type': 'application/json',
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization, x-organization-id, x-business-id, x-session-token, x-owner-mode'
  });
  res.end(JSON.stringify(data));
}

function parseJsonBody(req) {
  return new Promise((resolve, reject) => {
    let body = '';
    req.on('data', chunk => {
      body += chunk;
      if (body.length > 5 * 1024 * 1024) { // 5MB limit
        reject(new Error('Payload too large'));
      }
    });
    req.on('end', () => {
      try {
        resolve(body ? JSON.parse(body) : {});
      } catch (err) {
        reject(err);
      }
    });
    req.on('error', reject);
  });
}

const server = http.createServer(async (req, res) => {
  // CORS Preflight
  if (req.method === 'OPTIONS') {
    res.writeHead(204, {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization, x-organization-id, x-business-id, x-session-token, x-owner-mode'
    });
    return res.end();
  }

  const url = new URL(req.url, `http://${req.headers.host || 'localhost'}`);
  let pathname = url.pathname;
  if (pathname.startsWith('/api/finance/')) {
    pathname = '/api/' + pathname.slice('/api/finance/'.length);
  } else if (pathname === '/api/finance') {
    pathname = '/api';
  }

  try {
    // ------------------------------------------------------------------------
    // 1. HEALTH & SYSTEM
    // ------------------------------------------------------------------------
    if (pathname === '/api/internal/reload-store' && req.method === 'POST') {
      try {
        db.reloadDb();
        return sendJson(res, 200, { ok: true, reloaded: true });
      } catch (e) {
        return sendJson(res, 500, { ok: false, error: e.message });
      }
    }

    if (pathname === '/api/health' && req.method === 'GET') {
      return sendJson(res, 200, {
        status: 'UP',
        service: 'Loops Finance V3 OS',
        version: '3.0.0',
        timestamp: new Date().toISOString()
      });
    }

function checkStaffPermission(tenant, requiredPermission = null, actionName = 'action') {
  if (!tenant || !tenant.user) return true; // Local default mode without staff restrictions
  const user = tenant.user;
  const role = user.role;
  if (role === 'OWNER' || role === 'SUPER_ADMIN' || role === 'ADMIN' || role === 'FINANCE_ADMIN' || role === 'MANAGING_DIRECTOR') return true;

  if (requiredPermission === 'MANAGE_CAPITAL') {
    throw new Error(`Unauthorized: Only Business Owners, Directors, and Administrators have permission to ${actionName}. Normal accounting or cashier staff cannot manage equity or inject capital.`);
  }

  if (role === 'CASHIER') {
    throw new Error(`Unauthorized: Cashier staff account is not permitted to perform "${actionName}".`);
  }

  if (role === 'PURCHASE_CLERK' && ['POST_JOURNAL', 'FINALIZE_LANDED_COST', 'UPDATE_SETTINGS', 'DELETE_ACCOUNT', 'MANAGE_CAPITAL'].includes(requiredPermission)) {
    throw new Error(`Unauthorized: Purchase Clerk cannot perform "${actionName}".`);
  }

  if (role === 'FINANCE_AUDITOR' && ['POST_JOURNAL', 'FINALIZE_LANDED_COST', 'UPDATE_SETTINGS', 'CREATE_BILL', 'PAY_BILL', 'DELETE_ACCOUNT', 'MANAGE_CAPITAL'].includes(requiredPermission)) {
    throw new Error(`Unauthorized: Auditor is read-only and cannot perform "${actionName}".`);
  }

  if (role === 'ACCOUNTANT' && requiredPermission === 'MANAGE_CAPITAL') {
    throw new Error(`Unauthorized: Normal Accountant staff account cannot add investors or inject capital. Contact business owner.`);
  }

  return true;
}

    // ------------------------------------------------------------------------
    // STATIC SERVING: PRODUCT IMAGES & UPLOADS
    // ------------------------------------------------------------------------
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

    // ------------------------------------------------------------------------
    // IMAGE UPLOAD ENDPOINT (JPG, PNG, WEBP)
    // ------------------------------------------------------------------------
    if (pathname === '/api/upload' && req.method === 'POST') {
      const body = await parseJsonBody(req);
      const imageData = body.image || body.file || body.data;
      if (!imageData) {
        return sendJson(res, 400, { ok: false, error: 'No image data provided. Please provide image base64 or data URI.' });
      }
      const result = saveBase64Image(imageData, body.filename || 'import-product');
      if (!result.ok) return sendJson(res, 400, result);
      return sendJson(res, 201, result);
    }

    // ------------------------------------------------------------------------
    // 2. EXECUTIVE DASHBOARD & HOME STATS
    // ------------------------------------------------------------------------
    if (pathname === '/api/dashboard' && req.method === 'GET') {
      const tenant = getFinanceTenantContext(req);
      const data = db.getExecutiveDashboardData(tenant.orgId);
      return sendJson(res, 200, data);
    }

    // ------------------------------------------------------------------------
    // 3. BUSINESS & SETTINGS
    // ------------------------------------------------------------------------
    if (pathname === '/api/business' && req.method === 'GET') {
      const tenant = getFinanceTenantContext(req);
      const defaultInfo = db.getBusinessInfo();
      if (!tenant.isDefaultOrg && tenant.org) {
        const org = tenant.org;
        return sendJson(res, 200, {
          business: {
            ...defaultInfo.business,
            id: tenant.orgId,
            name: org.name || defaultInfo.business.name,
            legalName: org.name || defaultInfo.business.legalName,
            baseCurrency: org.currency || defaultInfo.business.baseCurrency,
            country: org.country || defaultInfo.business.country,
            address: org.address || defaultInfo.business.address,
            ownerName: org.ownerName || defaultInfo.business.ownerName,
            ownerEmail: org.ownerEmail || defaultInfo.business.ownerEmail
          },
          settings: {
            ...defaultInfo.settings,
            exchangeRateKhr: org.exchangeRate || 4000,
            taxRatePct: (org.taxRate || 0.1) * 100
          }
        });
      }
      return sendJson(res, 200, defaultInfo);
    }

    if (pathname === '/api/settings' && req.method === 'GET') {
      const defaultInfo = db.getBusinessInfo();
      return sendJson(res, 200, defaultInfo.settings || {});
    }

    if (pathname === '/api/settings' && req.method === 'PUT') {
      const tenant = getFinanceTenantContext(req);
      checkStaffPermission(tenant, 'UPDATE_SETTINGS', 'Update settings');
      const body = await parseJsonBody(req);
      const updated = db.updateBusinessSettings(body);
      return sendJson(res, 200, updated);
    }

    // ------------------------------------------------------------------------
    // 4. CHART OF ACCOUNTS (All 65 Standard Accounts + CRUD)
    // ------------------------------------------------------------------------
    if ((pathname === '/api/accounts' || pathname === '/api/chart-of-accounts') && req.method === 'GET') {
      const tenant = getFinanceTenantContext(req);
      const accList = db.getAccounts(tenant.orgId);
      if (pathname === '/api/chart-of-accounts') {
        return sendJson(res, 200, { accounts: accList, total: accList.length });
      }
      return sendJson(res, 200, accList);
    }

    if ((pathname === '/api/accounts' || pathname === '/api/chart-of-accounts') && req.method === 'POST') {
      const tenant = getFinanceTenantContext(req);
      checkStaffPermission(tenant, 'MANAGE_COA', 'Create account');
      const body = await parseJsonBody(req);
      const newAcc = db.createAccount({ ...body, organizationId: tenant.orgId });
      return sendJson(res, 201, newAcc);
    }

    const accountParamMatch = pathname.match(/^\/api\/(?:accounts|chart-of-accounts)\/([a-zA-Z0-9_-]+)$/);
    if (accountParamMatch && req.method === 'PUT') {
      const tenant = getFinanceTenantContext(req);
      checkStaffPermission(tenant, 'MANAGE_COA', 'Update account');
      const code = accountParamMatch[1];
      const body = await parseJsonBody(req);
      const updated = db.updateAccount(code, body, tenant.orgId);
      return sendJson(res, 200, updated);
    }

    if (accountParamMatch && req.method === 'DELETE') {
      const tenant = getFinanceTenantContext(req);
      checkStaffPermission(tenant, 'DELETE_ACCOUNT', 'Delete account');
      const code = accountParamMatch[1];
      const result = db.deleteAccount(code, tenant.orgId);
      return sendJson(res, 200, result);
    }

    // ------------------------------------------------------------------------
    // 4b. CASH & BANK TRANSFERS
    // ------------------------------------------------------------------------
    if (pathname === '/api/transfers' && req.method === 'POST') {
      const tenant = getFinanceTenantContext(req);
      checkStaffPermission(tenant, 'POST_JOURNAL', 'Cash transfer');
      const body = await parseJsonBody(req);
      const result = db.createCashTransfer({ ...body, organizationId: tenant.orgId });
      return sendJson(res, 201, result);
    }

    // ------------------------------------------------------------------------
    // 5. CAPITAL & EQUITY MANAGEMENT
    // ------------------------------------------------------------------------
    if ((pathname === '/api/capital' || pathname === '/api/capital/overview') && req.method === 'GET') {
      const tenant = getFinanceTenantContext(req);
      return sendJson(res, 200, db.getCapitalOverview(tenant.orgId));
    }

    if (pathname === '/api/capital/partners' && req.method === 'POST') {
      const tenant = getFinanceTenantContext(req);
      checkStaffPermission(tenant, 'MANAGE_CAPITAL', 'add an equity partner / investor');
      const body = await parseJsonBody(req);
      const partner = db.addCapitalPartner({ ...body, organizationId: tenant.orgId }, tenant.user);
      return sendJson(res, 201, partner);
    }

    if (pathname.startsWith('/api/capital/partners/') && (req.method === 'PUT' || req.method === 'PATCH')) {
      const tenant = getFinanceTenantContext(req);
      checkStaffPermission(tenant, 'MANAGE_CAPITAL', 'update an equity partner / investor');
      const partnerId = pathname.split('/')[4];
      const body = await parseJsonBody(req);
      const updated = db.updateCapitalPartner(partnerId, body, tenant.orgId, tenant.user);
      return sendJson(res, 200, updated);
    }

    if (pathname.startsWith('/api/capital/partners/') && req.method === 'DELETE') {
      const tenant = getFinanceTenantContext(req);
      checkStaffPermission(tenant, 'MANAGE_CAPITAL', 'delete an equity partner / investor');
      const partnerId = pathname.split('/')[4];
      const result = db.deleteCapitalPartner(partnerId, tenant.orgId, tenant.user);
      return sendJson(res, 200, result);
    }

    if ((pathname === '/api/capital/transaction' || pathname === '/api/capital/transactions' || pathname === '/api/settings/capital') && req.method === 'POST') {
      const tenant = getFinanceTenantContext(req);
      checkStaffPermission(tenant, 'MANAGE_CAPITAL', 'record capital transactions');
      const body = await parseJsonBody(req);
      const tx = db.addCapitalTransaction({ ...body, organizationId: tenant.orgId });
      return sendJson(res, 201, tx);
    }

    // ------------------------------------------------------------------------
    // 6. STARTUP BUDGET & CAPEX / OPEX TRACKER
    // ------------------------------------------------------------------------
    if (pathname === '/api/budget' && req.method === 'GET') {
      return sendJson(res, 200, db.getStartupBudgetSummary());
    }

    if (pathname === '/api/budget/prefill' && req.method === 'POST') {
      const summary = db.prefillStartupBudget();
      return sendJson(res, 200, summary);
    }

    if (pathname === '/api/budget/item' && req.method === 'POST') {
      const tenant = getFinanceTenantContext(req);
      const body = await parseJsonBody(req);
      const item = db.addStartupBudgetItem({ ...body, organizationId: tenant.orgId });
      return sendJson(res, 201, item);
    }

    const budgetItemMatch = pathname.match(/^\/api\/budget\/item\/([a-zA-Z0-9_-]+)$/);
    if (budgetItemMatch && req.method === 'PUT') {
      const id = budgetItemMatch[1];
      const body = await parseJsonBody(req);
      const updated = db.updateStartupBudgetItem(id, body);
      if (!updated) return sendJson(res, 404, { error: 'Budget item not found' });
      return sendJson(res, 200, updated);
    }

    if (budgetItemMatch && req.method === 'DELETE') {
      const id = budgetItemMatch[1];
      const ok = db.deleteStartupBudgetItem(id);
      return sendJson(res, 200, { ok });
    }

    // ------------------------------------------------------------------------
    // 7. IMPORT PRODUCTS & LANDED COST ENGINE
    // ------------------------------------------------------------------------
    // 6. IMPORTS & LANDED COST (SHIPMENTS)
    // ------------------------------------------------------------------------
    if (pathname === '/api/shipments' && req.method === 'GET') {
      const tenant = getFinanceTenantContext(req);
      const list = db.getShipmentsList();
      const filtered = list.filter(s => 
        !s.organizationId ||
        s.organizationId === tenant.orgId ||
        (tenant.orgId === 'org-6e9ed3cf' && s.organizationId === 'org-160c29e2') ||
        (tenant.orgId === 'org-160c29e2' && s.organizationId === 'org-6e9ed3cf')
      );
      return sendJson(res, 200, filtered);
    }

    if (pathname === '/api/shipments' && req.method === 'POST') {
      const tenant = getFinanceTenantContext(req);
      const body = await parseJsonBody(req);
      const shipmentData = {
        ...(body.shipment || {}),
        organizationId: tenant.orgId
      };
      const created = db.createShipment(shipmentData, body.items, body.overheads);
      return sendJson(res, 201, created);
    }

    // Match /api/shipments/:id
    const shipmentMatch = pathname.match(/^\/api\/shipments\/([a-zA-Z0-9_-]+)$/);
    if (shipmentMatch && req.method === 'GET') {
      const id = shipmentMatch[1];
      const details = db.getShipmentDetails(id);
      if (!details) return sendJson(res, 404, { error: 'Shipment not found' });
      return sendJson(res, 200, details);
    }

    if (shipmentMatch && req.method === 'PUT') {
      const tenant = getFinanceTenantContext(req);
      const id = shipmentMatch[1];
      const body = await parseJsonBody(req);
      const shipmentData = {
        ...(body.shipment || body),
        organizationId: tenant.orgId
      };
      const updated = db.updateShipment(id, shipmentData, body.items, body.overheads);
      return sendJson(res, 200, updated);
    }

    if (shipmentMatch && req.method === 'DELETE') {
      const tenant = getFinanceTenantContext(req);
      const id = shipmentMatch[1];
      const result = db.deleteShipment(id);
      return sendJson(res, 200, result);
    }

    // Match /api/shipments/:id/overheads
    const overheadMatch = pathname.match(/^\/api\/shipments\/([a-zA-Z0-9_-]+)\/overheads$/);
    if (overheadMatch && req.method === 'POST') {
      const id = overheadMatch[1];
      const body = await parseJsonBody(req);
      const updated = db.addShipmentOverhead(id, body);
      return sendJson(res, 201, updated);
    }

    // Match /api/shipments/:id/overheads/:overheadId (PUT, DELETE)
    const singleOverheadMatch = pathname.match(/^\/api\/shipments\/([a-zA-Z0-9_-]+)\/overheads\/([a-zA-Z0-9_-]+)$/);
    if (singleOverheadMatch && req.method === 'PUT') {
      const [, shipmentId, overheadId] = singleOverheadMatch;
      const body = await parseJsonBody(req);
      const updated = db.updateShipmentOverhead(shipmentId, overheadId, body);
      return sendJson(res, 200, updated);
    }

    if (singleOverheadMatch && req.method === 'DELETE') {
      const [, shipmentId, overheadId] = singleOverheadMatch;
      const updated = db.deleteShipmentOverhead(shipmentId, overheadId);
      return sendJson(res, 200, updated);
    }

    // Match /api/shipments/:id/finalize
    const finalizeMatch = pathname.match(/^\/api\/shipments\/([a-zA-Z0-9_-]+)\/finalize$/);
    if (finalizeMatch && req.method === 'POST') {
      const id = finalizeMatch[1];
      const tenant = getFinanceTenantContext(req);
      checkStaffPermission(tenant, 'FINALIZE_LANDED_COST', 'Finalize landed cost');
      const finalized = db.finalizeShipmentLandedCost(id, tenant.orgId);
      const nowIso = new Date().toISOString();

      // 1. Push directly into Stock Management (Port 3000) and POS Catalog (Port 3002)
      try {
        const { pushImportToStockAndPos } = require('../../../shared/inventory/stockSyncBridge');
        pushImportToStockAndPos({
          importRef: finalized.shipment.shipmentCode,
          supplierName: finalized.shipment.supplierName,
          purchaseDate: finalized.shipment.purchaseDate || finalized.shipment.createdAt || nowIso,
          receivedDate: nowIso,
          items: (finalized.items || []).map(it => ({
            productName: it.productName,
            skuCode: it.skuCode,
            category: it.category || 'Imported Goods',
            barcode: it.barcode,
            quantity: it.quantity,
            unitCost: it.unit_base_price_base,
            unitLandedCost: it.unit_landed_cost || it.unit_base_price_base,
            targetRetailPrice: it.target_retail_price || (it.unit_landed_cost * 2),
            imageUrl: it.imageUrl || ''
          })),
          organizationId: tenant.orgId,
          performedByName: tenant.user?.fullName || 'Finance Import'
        });
      } catch (bridgeErr) {
        console.warn('pushImportToStockAndPos error in finalize:', bridgeErr.message);
      }

      // 2. Also register into import_history table in SQLite
      try {
        const { recordImportHistory } = require('../../../shared/financial/financialAllocationEngine');
        recordImportHistory({
          organizationId: tenant.orgId,
          importDate: nowIso,
          purchaseDate: finalized.shipment.purchaseDate || finalized.shipment.createdAt || nowIso,
          receivedDate: nowIso,
          supplierName: finalized.shipment.supplierName,
          items: finalized.items,
          shippingCost: 0,
          additionalCharges: 0,
          importSource: 'LANDED_COST',
          notes: finalized.shipment.notes || `Shipment ${finalized.shipment.shipmentCode} finalized from Landed Cost`,
          performedById: tenant.user?.id,
          performedByName: tenant.user?.fullName || 'Finance Staff'
        });
      } catch (histErr) {
        console.warn('recordImportHistory error in finalize:', histErr.message);
      }

      // Automatic Stock Receiving & Product Creation Bridge to Stock Management Loops (Port 3000)
      const importPayload = {
        purchaseCode: finalized.shipment.shipmentCode,
        supplierName: finalized.shipment.supplierName,
        status: 'COMPLETED',
        notes: finalized.shipment.notes,
        items: (finalized.items || []).map(it => ({
          productName: it.productName,
          skuCode: it.skuCode,
          variantName: it.variantName || 'Standard',
          quantity: it.quantity,
          unitBasePrice: it.unit_base_price_base,
          unitLandedCost: it.unit_landed_cost,
          targetRetailPrice: it.target_retail_price || (it.unit_landed_cost * 2),
          imageUrl: it.imageUrl || '',
          category: it.category || 'Imported Goods'
        }))
      };

      await stockIntegration.requestStockLoops('/inventory/import-purchase', 'POST', importPayload, tenant.token, tenant.orgId).catch(() => {});
      return sendJson(res, 200, finalized);
    }

    // Match /api/shipments/:id/status
    const statusMatch = pathname.match(/^\/api\/shipments\/([a-zA-Z0-9_-]+)\/status$/);
    if (statusMatch && req.method === 'PUT') {
      const id = statusMatch[1];
      const body = await parseJsonBody(req);
      const updated = db.updateShipmentStatus(id, body.status);

      if (body.status === 'COMPLETED' || body.status === 'RECEIVED') {
        const detailed = db.getShipmentDetails(id);
        const importPayload = {
          purchaseCode: detailed.shipment.shipmentCode,
          supplierName: detailed.shipment.supplierName,
          status: body.status,
          notes: detailed.shipment.notes,
          items: (detailed.items || []).map(it => ({
            productName: it.productName,
            skuCode: it.skuCode,
            variantName: it.variantName || 'Standard',
            quantity: it.quantity,
            unitBasePrice: it.unit_base_price_base,
            unitLandedCost: it.unit_landed_cost || it.unit_base_price_base,
            targetRetailPrice: it.target_retail_price || (it.unit_base_price_base * 2.2),
            imageUrl: it.imageUrl || '',
            category: it.category || 'Imported Goods'
          }))
        };
        const tenant = getFinanceTenantContext(req);
        stockIntegration.requestStockLoops('/inventory/import-purchase', 'POST', importPayload, tenant.token, tenant.orgId).catch(() => {});
      }
      return sendJson(res, 200, updated);
    }

    // ------------------------------------------------------------------------
    // FINANCE & PURCHASING ROLES & PERMISSIONS
    // ------------------------------------------------------------------------
    if (pathname === '/api/roles' && req.method === 'GET') {
      return sendJson(res, 200, [
        {
          id: 'FINANCE_ADMIN',
          name: 'Finance Administrator',
          description: 'Full accounting, landed cost, purchase approval & company financial settings',
          permissions: ['ALL_FINANCE', 'APPROVE_PURCHASE', 'POST_JOURNAL', 'FINALIZE_LANDED_COST', 'CLOSE_PERIOD']
        },
        {
          id: 'PURCHASE_MANAGER',
          name: 'Purchase / Import Manager',
          description: 'Create purchase orders, manage suppliers, upload photos & submit for approval',
          permissions: ['CREATE_PURCHASE', 'MANAGE_SUPPLIERS', 'UPLOAD_DOCUMENTS', 'FINALIZE_LANDED_COST']
        },
        {
          id: 'PURCHASE_CLERK',
          name: 'Purchase Clerk',
          description: 'Draft purchase orders, enter item details & track shipments',
          permissions: ['CREATE_PURCHASE_DRAFT', 'VIEW_SUPPLIERS']
        },
        {
          id: 'ACCOUNTANT',
          name: 'Certified Accountant',
          description: 'General Ledger, AP/AR, balanced journals, tax & financial statements',
          permissions: ['POST_JOURNAL', 'VIEW_REPORTS', 'MANAGE_BILLS', 'MANAGE_INVOICES']
        },
        {
          id: 'FINANCE_AUDITOR',
          name: 'Financial Auditor',
          description: 'Read-only financial access, review purchase history & ledger audits',
          permissions: ['VIEW_REPORTS', 'VIEW_JOURNAL', 'VIEW_PURCHASES']
        }
      ]);
    }

    if (pathname === '/api/users' && req.method === 'GET') {
      const state = db.getDb ? db.getDb() : {};
      if (!state.users) {
        state.users = [
          { id: 'usr-fin-01', fullName: 'Finance Director', email: 'cfo@theloops.com', role: 'FINANCE_ADMIN', active: true },
          { id: 'usr-fin-02', fullName: 'Elena Rostova', email: 'elena@theloops.com', role: 'PURCHASE_MANAGER', active: true }
        ];
      }
      return sendJson(res, 200, state.users);
    }

    if (pathname === '/api/users' && req.method === 'POST') {
      const body = await parseJsonBody(req);
      const state = db.getDb ? db.getDb() : {};
      if (!state.users) state.users = [];
      const newUser = {
        id: body.id || `usr-fin-${Date.now()}`,
        fullName: body.fullName || 'Staff Member',
        email: body.email,
        role: body.role || 'PURCHASE_CLERK',
        active: body.active !== false
      };
      state.users.push(newUser);
      return sendJson(res, 201, newUser);
    }

    // ------------------------------------------------------------------------
    // 9. SHIPPING CATEGORIES (MULTI-TENANT RELATIONAL CRUD)
    // ------------------------------------------------------------------------
    if (pathname === '/api/shipping-categories' && req.method === 'GET') {
      const tenant = getFinanceTenantContext(req);
      const { getDatabase } = require('../../../shared/database/connection');
      const dbSync = getDatabase();

      // Ensure table exists
      dbSync.exec(`
        CREATE TABLE IF NOT EXISTS shipping_categories (
            id TEXT PRIMARY KEY,
            organization_id TEXT NOT NULL,
            name TEXT NOT NULL,
            description TEXT DEFAULT '',
            shipping_method TEXT DEFAULT 'Air Cargo',
            status TEXT DEFAULT 'ACTIVE',
            created_by TEXT DEFAULT 'Owner',
            created_at TEXT NOT NULL,
            updated_at TEXT NOT NULL,
            UNIQUE(organization_id, name)
        );
        CREATE INDEX IF NOT EXISTS idx_shipcat_org ON shipping_categories(organization_id);
      `);

      // Ensure initial defaults if empty for this organization
      const count = dbSync.prepare('SELECT COUNT(*) as c FROM shipping_categories WHERE organization_id = ?').get(tenant.orgId);
      if (!count || count.c === 0) {
        const defaultCats = [
          { name: 'Air Shipping', method: 'Air Cargo', desc: 'Fast international air courier & freight' },
          { name: 'Sea Shipping', method: 'Ocean Freight', desc: 'Full container (FCL) & consolidated (LCL) sea shipment' },
          { name: 'Land Shipping', method: 'Cross-Border Truck', desc: 'Regional overland trucking & drayage' },
          { name: 'Express Shipping', method: 'Express Courier', desc: 'DHL / FedEx / expedited air parcel' },
          { name: 'Local Transportation', method: 'Local Van / Truck', desc: 'Port to warehouse and local distribution' },
          { name: 'Supplier Delivery', method: 'Vendor Direct', desc: 'Factory direct drop-ship to store' }
        ];
        const now = new Date().toISOString();
        const insertStmt = dbSync.prepare(`
          INSERT OR IGNORE INTO shipping_categories 
          (id, organization_id, name, description, shipping_method, status, created_by, created_at, updated_at) 
          VALUES (?, ?, ?, ?, ?, 'ACTIVE', 'Owner', ?, ?)
        `);
        defaultCats.forEach((dc, idx) => {
          insertStmt.run(`shipcat-${tenant.orgId}-${idx + 1}`, tenant.orgId, dc.name, dc.desc, dc.method, now, now);
        });
      }

      const rows = dbSync.prepare('SELECT * FROM shipping_categories WHERE organization_id = ? ORDER BY created_at ASC').all(tenant.orgId);
      return sendJson(res, 200, rows.map(r => ({
        id: r.id,
        organizationId: r.organization_id,
        name: r.name,
        description: r.description,
        shippingMethod: r.shipping_method,
        status: r.status,
        createdBy: r.created_by,
        createdAt: r.created_at,
        updatedAt: r.updated_at
      })));
    }

    if (pathname === '/api/shipping-categories' && req.method === 'POST') {
      const tenant = getFinanceTenantContext(req);
      const body = await parseJsonBody(req);
      const name = (body.name || '').trim();
      if (!name) return sendJson(res, 400, { error: 'Category name is required' });

      const { getDatabase } = require('../../../shared/database/connection');
      const dbSync = getDatabase();

      const existing = dbSync.prepare('SELECT id FROM shipping_categories WHERE organization_id = ? AND LOWER(name) = LOWER(?)').get(tenant.orgId, name);
      if (existing) {
        return sendJson(res, 400, { error: `A shipping category named "${name}" already exists for this business.` });
      }

      const id = `shipcat-${Date.now().toString(36)}-${Math.random().toString(36).substring(2, 6)}`;
      const now = new Date().toISOString();
      const desc = (body.description || '').trim();
      const method = (body.shippingMethod || body.shipping_method || 'Air Shipping').trim();
      const status = body.status === 'INACTIVE' ? 'INACTIVE' : 'ACTIVE';
      const createdBy = tenant.user?.fullName || 'Business Owner';

      dbSync.prepare(`
        INSERT INTO shipping_categories 
        (id, organization_id, name, description, shipping_method, status, created_by, created_at, updated_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
      `).run(id, tenant.orgId, name, desc, method, status, createdBy, now, now);

      return sendJson(res, 201, {
        id,
        organizationId: tenant.orgId,
        name,
        description: desc,
        shippingMethod: method,
        status,
        createdBy,
        createdAt: now,
        updatedAt: now
      });
    }

    if (pathname.startsWith('/api/shipping-categories/') && req.method === 'PUT') {
      const tenant = getFinanceTenantContext(req);
      const catId = pathname.split('/')[3];
      const body = await parseJsonBody(req);

      const { getDatabase } = require('../../../shared/database/connection');
      const dbSync = getDatabase();

      const existing = dbSync.prepare('SELECT * FROM shipping_categories WHERE id = ? AND organization_id = ?').get(catId, tenant.orgId);
      if (!existing) return sendJson(res, 404, { error: 'Shipping category not found' });

      const name = body.name !== undefined ? (body.name || '').trim() : existing.name;
      if (!name) return sendJson(res, 400, { error: 'Category name cannot be empty' });

      // If renaming, ensure uniqueness
      if (name.toLowerCase() !== existing.name.toLowerCase()) {
        const dup = dbSync.prepare('SELECT id FROM shipping_categories WHERE organization_id = ? AND LOWER(name) = LOWER(?) AND id != ?').get(tenant.orgId, name, catId);
        if (dup) return sendJson(res, 400, { error: `Another category named "${name}" already exists.` });
      }

      const desc = body.description !== undefined ? body.description.trim() : existing.description;
      const method = body.shippingMethod !== undefined ? body.shippingMethod.trim() : (body.shipping_method !== undefined ? body.shipping_method.trim() : existing.shipping_method);
      const status = body.status !== undefined ? (body.status === 'INACTIVE' ? 'INACTIVE' : 'ACTIVE') : existing.status;
      const now = new Date().toISOString();

      dbSync.prepare(`
        UPDATE shipping_categories 
        SET name = ?, description = ?, shipping_method = ?, status = ?, updated_at = ?
        WHERE id = ? AND organization_id = ?
      `).run(name, desc, method, status, now, catId, tenant.orgId);

      return sendJson(res, 200, {
        id: catId,
        organizationId: tenant.orgId,
        name,
        description: desc,
        shippingMethod: method,
        status,
        createdBy: existing.created_by,
        createdAt: existing.created_at,
        updatedAt: now
      });
    }

    if (pathname.startsWith('/api/shipping-categories/') && req.method === 'DELETE') {
      const tenant = getFinanceTenantContext(req);
      const catId = pathname.split('/')[3];

      const { getDatabase } = require('../../../shared/database/connection');
      const dbSync = getDatabase();

      const existing = dbSync.prepare('SELECT * FROM shipping_categories WHERE id = ? AND organization_id = ?').get(catId, tenant.orgId);
      if (!existing) return sendJson(res, 404, { error: 'Shipping category not found' });

      // Check if referenced in shipments or overheads
      try {
        const refShip = dbSync.prepare('SELECT COUNT(*) as c FROM shipments WHERE shipping_category_id = ?').get(catId);
        if (refShip && refShip.c > 0) {
          return sendJson(res, 400, {
            error: `Cannot delete "${existing.name}" because ${refShip.c} shipment(s) reference it. You may set its status to INACTIVE instead.`
          });
        }
      } catch (e) {}

      dbSync.prepare('DELETE FROM shipping_categories WHERE id = ? AND organization_id = ?').run(catId, tenant.orgId);
      return sendJson(res, 200, { ok: true, message: `Shipping category "${existing.name}" deleted successfully.` });
    }

    // ------------------------------------------------------------------------
    // 9b. PRODUCT CATEGORIES (FINANCE MASTER — MULTI-TENANT CRUD)
    // ------------------------------------------------------------------------
    if (pathname === '/api/categories' && req.method === 'GET') {
      const tenant = getFinanceTenantContext(req);
      const { getDatabase } = require('../../../shared/database/connection');
      const dbSync = getDatabase();

      // Ensure table exists
      dbSync.exec(`
        CREATE TABLE IF NOT EXISTS finance_product_categories (
          id TEXT PRIMARY KEY,
          organization_id TEXT NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
          name TEXT NOT NULL,
          description TEXT DEFAULT '',
          created_at TEXT NOT NULL,
          UNIQUE(organization_id, name)
        );
        CREATE INDEX IF NOT EXISTS idx_fin_prod_cat_org ON finance_product_categories(organization_id);
      `);

      const count = dbSync.prepare('SELECT COUNT(*) as c FROM finance_product_categories WHERE organization_id = ?').get(tenant.orgId);
      if (!count || count.c === 0) {
        const defaults = [
          { name: 'Apparel', desc: 'Clothing, outerwear, textiles' },
          { name: 'Electronics', desc: 'Devices, accessories, gadgets' },
          { name: 'Accessories', desc: 'Watches, bags, jewelry, lifestyle' },
          { name: 'Footwear', desc: 'Shoes, boots, sneakers' },
          { name: 'Beauty & Health', desc: 'Cosmetics, skincare, fragrance' },
          { name: 'Home & Living', desc: 'Decor, kitchen, artisan homeware' }
        ];
        const now = new Date().toISOString();
        const ins = dbSync.prepare('INSERT OR IGNORE INTO finance_product_categories (id, organization_id, name, description, created_at) VALUES (?, ?, ?, ?, ?)');
        defaults.forEach((d, idx) => {
          ins.run(`fcat-${tenant.orgId}-${idx + 1}`, tenant.orgId, d.name, d.desc, now);
        });
      }

      const rows = dbSync.prepare('SELECT * FROM finance_product_categories WHERE organization_id = ? ORDER BY name ASC').all(tenant.orgId);
      return sendJson(res, 200, rows.map(r => ({
        id: r.id,
        organizationId: r.organization_id,
        name: r.name,
        description: r.description,
        createdAt: r.created_at
      })));
    }

    if (pathname === '/api/categories' && req.method === 'POST') {
      const tenant = getFinanceTenantContext(req);
      const body = await parseJsonBody(req);
      const name = (body.name || '').trim();
      if (!name) return sendJson(res, 400, { error: 'Category name is required' });

      const { getDatabase } = require('../../../shared/database/connection');
      const dbSync = getDatabase();

      const existing = dbSync.prepare('SELECT id FROM finance_product_categories WHERE organization_id = ? AND LOWER(name) = LOWER(?)').get(tenant.orgId, name);
      if (existing) {
        return sendJson(res, 400, { error: `Product category "${name}" already exists in Finance.` });
      }

      const id = `fcat-${Date.now().toString(36)}-${Math.random().toString(36).substring(2, 6)}`;
      const now = new Date().toISOString();
      const desc = (body.description || '').trim();

      dbSync.prepare('INSERT INTO finance_product_categories (id, organization_id, name, description, created_at) VALUES (?, ?, ?, ?, ?)').run(
        id, tenant.orgId, name, desc, now
      );

      return sendJson(res, 201, {
        id,
        organizationId: tenant.orgId,
        name,
        description: desc,
        createdAt: now
      });
    }

    if (pathname.startsWith('/api/categories/') && req.method === 'DELETE') {
      const tenant = getFinanceTenantContext(req);
      const catId = pathname.split('/')[3];

      const { getDatabase } = require('../../../shared/database/connection');
      const dbSync = getDatabase();

      const existing = dbSync.prepare('SELECT * FROM finance_product_categories WHERE id = ? AND organization_id = ?').get(catId, tenant.orgId);
      if (!existing) return sendJson(res, 404, { error: 'Category not found' });

      // Check if any shipment items in memory or sqlite reference this category
      try {
        const inDbItems = (db.shipments || []).flatMap(s => s.items || []).filter(i => (i.category && i.category.toLowerCase() === existing.name.toLowerCase()) || i.categoryId === catId);
        if (inDbItems.length > 0) {
          return sendJson(res, 400, {
            error: `Cannot delete category "${existing.name}" because it is currently assigned to ${inDbItems.length} imported shipment item(s).`
          });
        }
        const refShipItem = dbSync.prepare('SELECT COUNT(*) as c FROM shipment_items WHERE organization_id = ? AND (LOWER(category) = LOWER(?) OR category = ?)').get(tenant.orgId, existing.name, catId);
        if (refShipItem && refShipItem.c > 0) {
          return sendJson(res, 400, {
            error: `Cannot delete category "${existing.name}" because ${refShipItem.c} imported shipment item(s) reference it.`
          });
        }
      } catch (e) {}

      dbSync.prepare('DELETE FROM finance_product_categories WHERE id = ? AND organization_id = ?').run(catId, tenant.orgId);
      return sendJson(res, 200, { ok: true, message: `Category "${existing.name}" deleted successfully.` });
    }

    // ------------------------------------------------------------------------
    // 8. BILLS & SUPPLIERS (ACCOUNTS PAYABLE & ADVANCES)
    // ------------------------------------------------------------------------
    if ((pathname === '/api/bills' || pathname === '/api/supplier-bills') && req.method === 'GET') {
      const tenant = getFinanceTenantContext(req);
      const bills = db.getSupplierBills();
      if (!tenant.isDefaultOrg) {
        return sendJson(res, 200, bills.filter(b => b.organizationId === tenant.orgId || (!b.organizationId && !tenant.orgId)));
      }
      return sendJson(res, 200, bills);
    }

    if ((pathname === '/api/bills' || pathname === '/api/supplier-bills') && req.method === 'POST') {
      const tenant = getFinanceTenantContext(req);
      checkStaffPermission(tenant, 'CREATE_BILL', 'Record supplier bill');
      const body = await parseJsonBody(req);
      const bill = db.createSupplierBill({ ...body, organizationId: tenant.orgId });
      return sendJson(res, 201, bill);
    }

    // Match /api/bills/:id/pay or /api/supplier-bills/:id/pay
    const payBillMatch = pathname.match(/^\/api\/(?:bills|supplier-bills)\/([a-zA-Z0-9_-]+)\/pay$/);
    if (payBillMatch && req.method === 'POST') {
      const tenant = getFinanceTenantContext(req);
      checkStaffPermission(tenant, 'PAY_BILL', 'Pay supplier bill');
      const id = payBillMatch[1];
      const body = await parseJsonBody(req);
      const updated = db.paySupplierBill(id, body.amount, tenant.orgId);
      return sendJson(res, 200, updated);
    }

    // ------------------------------------------------------------------------
    // 9. OPERATING EXPENSES (OPEX)
    // ------------------------------------------------------------------------
    if (pathname === '/api/expenses' && req.method === 'GET') {
      const tenant = getFinanceTenantContext(req);
      const { expenses, recurringBills } = db.getExpenses(tenant?.orgId);
      const allowedStores = getUserAssignedStoreIds(tenant.user);

      let filteredExp = expenses.filter(e => e.organizationId === tenant.orgId || (!e.organizationId && !tenant.orgId));
      let filteredRec = recurringBills.filter(r => r.organizationId === tenant.orgId || (!r.organizationId && !tenant.orgId));

      if (!allowedStores.includes('*')) {
        filteredExp = filteredExp.filter(e => {
          const sId = e.storeId || e.locationId;
          return sId ? allowedStores.includes(sId) : true;
        });
        filteredRec = filteredRec.filter(r => {
          const sId = r.storeId || r.locationId;
          return sId ? allowedStores.includes(sId) : true;
        });
      }

      return sendJson(res, 200, { expenses: filteredExp, recurringBills: filteredRec });
    }

    if (pathname === '/api/expenses' && req.method === 'POST') {
      const tenant = getFinanceTenantContext(req);
      checkStaffPermission(tenant, 'POST_JOURNAL', 'Record expense');
      const body = await parseJsonBody(req);
      const allowedStores = getUserAssignedStoreIds(tenant.user);
      if (body.storeId && !allowedStores.includes('*') && !allowedStores.includes(body.storeId)) {
        return sendJson(res, 403, { ok: false, error: `Access denied: You are not authorized to record expenses for store '${body.storeId}'.` });
      }
      const exp = db.createExpense({ ...body, organizationId: tenant.orgId });
      return sendJson(res, 201, exp);
    }

    // ------------------------------------------------------------------------
    // 10. SALES & CUSTOMERS (RECEIVABLES & POS SYNC)
    // ------------------------------------------------------------------------
    if (pathname === '/api/invoices' && req.method === 'GET') {
      const tenant = getFinanceTenantContext(req);
      const invoices = db.getInvoices();
      if (!tenant.isDefaultOrg) {
        return sendJson(res, 200, invoices.filter(i => i.organizationId === tenant.orgId || (!i.organizationId && !tenant.orgId)));
      }
      return sendJson(res, 200, invoices);
    }

    if (pathname === '/api/invoices' && req.method === 'POST') {
      const tenant = getFinanceTenantContext(req);
      const body = await parseJsonBody(req);
      const invoice = db.createInvoice({ ...body, organizationId: tenant.orgId });
      return sendJson(res, 201, invoice);
    }

    // ------------------------------------------------------------------------
    // 11. GENERAL LEDGER & BALANCED JOURNALS
    // ------------------------------------------------------------------------
    if ((pathname === '/api/ledger' || pathname === '/api/journals' || pathname === '/api/journal' || pathname === '/api/journal-entries') && req.method === 'GET') {
      const tenant = getFinanceTenantContext(req);
      const entries = db.getJournalEntries({
        orgId: tenant.isDefaultOrg ? null : tenant.orgId,
        startDate: url.searchParams.get('startDate') || undefined,
        endDate: url.searchParams.get('endDate') || undefined,
        storeId: url.searchParams.get('storeId') || undefined
      });
      return sendJson(res, 200, entries);
    }

    // Match /api/ledger/:code or /api/ledger/account/:code
    const accountLedgerMatch = pathname.match(/^\/api\/ledger\/(?:account\/)?([0-9]{4})$/);
    if (accountLedgerMatch && req.method === 'GET') {
      const tenant = getFinanceTenantContext(req);
      const code = accountLedgerMatch[1];
      const ledger = db.getAccountLedger(code, tenant.orgId, {
        startDate: url.searchParams.get('startDate') || undefined,
        endDate: url.searchParams.get('endDate') || undefined,
        storeId: url.searchParams.get('storeId') || undefined
      });
      return sendJson(res, 200, ledger);
    }

    if ((pathname === '/api/ledger/journal' || pathname === '/api/journals') && req.method === 'POST') {
      const tenant = getFinanceTenantContext(req);
      checkStaffPermission(tenant, 'POST_JOURNAL', 'Post journal entry');
      const body = await parseJsonBody(req);
      const entry = db.postJournalEntry({ ...body, organizationId: tenant.orgId });
      return sendJson(res, 201, entry);
    }

    // Match /api/ledger/:id/reverse or /api/journals/:id/reverse
    const reverseMatch = pathname.match(/^\/api\/(?:ledger|journals)\/([a-zA-Z0-9_-]+)\/reverse$/);
    if (reverseMatch && req.method === 'POST') {
      const tenant = getFinanceTenantContext(req);
      checkStaffPermission(tenant, 'POST_JOURNAL', 'Reverse journal entry');
      const id = reverseMatch[1];
      const body = await parseJsonBody(req);
      const result = db.reverseJournalEntry(id, body.reason, tenant.orgId);
      return sendJson(res, 200, result);
    }

    // ------------------------------------------------------------------------
    // 12. FINANCIAL REPORTS & STATEMENTS
    // ------------------------------------------------------------------------
    if (pathname === '/api/reports/period-financials' && req.method === 'GET') {
      const tenant = getFinanceTenantContext(req);
      const startDate = url.searchParams.get('startDate') || undefined;
      const endDate = url.searchParams.get('endDate') || undefined;
      const storeId = url.searchParams.get('storeId') || undefined;
      const compare = url.searchParams.get('compare') === 'true';

      const allowedStores = getUserAssignedStoreIds(tenant.user);
      if (storeId && storeId !== 'ALL' && !allowedStores.includes('*') && !allowedStores.includes(storeId)) {
        return sendJson(res, 403, { ok: false, error: `Access denied: You are not authorized to view financial data for store '${storeId}'.` });
      }

      const periodData = db.getPeriodFinancials(tenant.orgId, { 
        startDate, 
        endDate, 
        storeId, 
        compare,
        allowedStoreIds: allowedStores
      });
      return sendJson(res, 200, periodData);
    }

    if (pathname === '/api/stores' && req.method === 'GET') {
      const tenant = getFinanceTenantContext(req);
      let stores = db.getStores(tenant.orgId);
      const allowedStores = getUserAssignedStoreIds(tenant.user);
      if (!allowedStores.includes('*')) {
        stores = stores.filter(s => allowedStores.includes(s.id));
      }
      return sendJson(res, 200, stores);
    }

    if (pathname === '/api/reports/pnl' && req.method === 'GET') {
      const tenant = getFinanceTenantContext(req);
      const storeId = url.searchParams.get('storeId') || undefined;
      const allowedStores = getUserAssignedStoreIds(tenant.user);
      if (storeId && storeId !== 'ALL' && !allowedStores.includes('*') && !allowedStores.includes(storeId)) {
        return sendJson(res, 403, { ok: false, error: `Access denied: You are not authorized to view P&L for store '${storeId}'.` });
      }
      const effectiveStore = (storeId && storeId !== 'ALL') ? storeId : (!allowedStores.includes('*') && allowedStores.length === 1 ? allowedStores[0] : undefined);
      const dash = db.getExecutiveDashboardData(tenant.orgId, {
        startDate: url.searchParams.get('startDate') || undefined,
        endDate: url.searchParams.get('endDate') || undefined,
        storeId: effectiveStore
      });
      return sendJson(res, 200, dash.pnl);
    }

    if (pathname === '/api/reports/balance-sheet' && req.method === 'GET') {
      const tenant = getFinanceTenantContext(req);
      const storeId = url.searchParams.get('storeId') || undefined;
      const allowedStores = getUserAssignedStoreIds(tenant.user);
      if (storeId && storeId !== 'ALL' && !allowedStores.includes('*') && !allowedStores.includes(storeId)) {
        return sendJson(res, 403, { ok: false, error: `Access denied: You are not authorized to view balance sheet for store '${storeId}'.` });
      }
      const effectiveStore = (storeId && storeId !== 'ALL') ? storeId : (!allowedStores.includes('*') && allowedStores.length === 1 ? allowedStores[0] : undefined);
      const bs = db.getBalanceSheet(tenant.orgId, {
        endDate: url.searchParams.get('endDate') || undefined,
        asOfDate: url.searchParams.get('asOfDate') || url.searchParams.get('endDate') || undefined,
        storeId: effectiveStore
      });
      return sendJson(res, 200, bs);
    }

    if (pathname === '/api/reports/trial-balance' && req.method === 'GET') {
      const tenant = getFinanceTenantContext(req);
      const storeId = url.searchParams.get('storeId') || undefined;
      const allowedStores = getUserAssignedStoreIds(tenant.user);
      if (storeId && storeId !== 'ALL' && !allowedStores.includes('*') && !allowedStores.includes(storeId)) {
        return sendJson(res, 403, { ok: false, error: `Access denied: You are not authorized to view trial balance for store '${storeId}'.` });
      }
      const effectiveStore = (storeId && storeId !== 'ALL') ? storeId : (!allowedStores.includes('*') && allowedStores.length === 1 ? allowedStores[0] : undefined);
      const tb = db.getTrialBalance(tenant.orgId, {
        startDate: url.searchParams.get('startDate') || undefined,
        endDate: url.searchParams.get('endDate') || undefined,
        storeId: effectiveStore
      });
      return sendJson(res, 200, tb);
    }

    if (pathname === '/api/reports/cash-flow' && req.method === 'GET') {
      const tenant = getFinanceTenantContext(req);
      const storeId = url.searchParams.get('storeId') || undefined;
      const allowedStores = getUserAssignedStoreIds(tenant.user);
      if (storeId && storeId !== 'ALL' && !allowedStores.includes('*') && !allowedStores.includes(storeId)) {
        return sendJson(res, 403, { ok: false, error: `Access denied: You are not authorized to view cash flow for store '${storeId}'.` });
      }
      const effectiveStore = (storeId && storeId !== 'ALL') ? storeId : (!allowedStores.includes('*') && allowedStores.length === 1 ? allowedStores[0] : undefined);
      const cf = db.getCashFlowStatement(tenant.orgId, {
        startDate: url.searchParams.get('startDate') || undefined,
        endDate: url.searchParams.get('endDate') || undefined,
        storeId: effectiveStore
      });
      return sendJson(res, 200, cf);
    }

    if (pathname === '/api/reports/inventory-valuation' && req.method === 'GET') {
      const tenant = getFinanceTenantContext(req);
      const storeId = url.searchParams.get('storeId') || undefined;
      const allowedStores = getUserAssignedStoreIds(tenant.user);
      if (storeId && storeId !== 'ALL' && !allowedStores.includes('*') && !allowedStores.includes(storeId)) {
        return sendJson(res, 403, { ok: false, error: `Access denied: You are not authorized to view inventory valuation for store '${storeId}'.` });
      }
      const effectiveStore = (storeId && storeId !== 'ALL') ? storeId : (!allowedStores.includes('*') && allowedStores.length === 1 ? allowedStores[0] : undefined);
      const iv = db.getInventoryValuationReport(tenant.orgId, {
        endDate: url.searchParams.get('endDate') || undefined,
        asOfDate: url.searchParams.get('asOfDate') || url.searchParams.get('endDate') || undefined,
        storeId: effectiveStore
      });
      return sendJson(res, 200, iv);
    }

    if ((pathname === '/api/reports/ap' || pathname === '/api/reports/accounts-payable') && req.method === 'GET') {
      const tenant = getFinanceTenantContext(req);
      const storeId = url.searchParams.get('storeId') || undefined;
      const allowedStores = getUserAssignedStoreIds(tenant.user);
      if (storeId && storeId !== 'ALL' && !allowedStores.includes('*') && !allowedStores.includes(storeId)) {
        return sendJson(res, 403, { ok: false, error: `Access denied: You are not authorized to view AP report for store '${storeId}'.` });
      }
      const effectiveStore = (storeId && storeId !== 'ALL') ? storeId : (!allowedStores.includes('*') && allowedStores.length === 1 ? allowedStores[0] : undefined);
      const ap = db.getAccountsPayableReport(tenant.orgId, {
        endDate: url.searchParams.get('endDate') || undefined,
        asOfDate: url.searchParams.get('asOfDate') || url.searchParams.get('endDate') || undefined,
        storeId: effectiveStore
      });
      return sendJson(res, 200, ap);
    }

    if ((pathname === '/api/reports/ar' || pathname === '/api/reports/accounts-receivable') && req.method === 'GET') {
      const tenant = getFinanceTenantContext(req);
      const ar = db.getAccountsReceivableReport(tenant.orgId, {
        endDate: url.searchParams.get('endDate') || undefined,
        asOfDate: url.searchParams.get('asOfDate') || url.searchParams.get('endDate') || undefined,
        storeId: url.searchParams.get('storeId') || undefined
      });
      return sendJson(res, 200, ar);
    }

    // ------------------------------------------------------------------------
    // 13. STOCK MANAGEMENT LOOPS LIVE INTEGRATION (PORT 3000)
    // ------------------------------------------------------------------------
    if (pathname === '/api/integration/stock/status' && req.method === 'GET') {
      const tenant = getFinanceTenantContext(req);
      const status = await stockIntegration.getStockLoopsStatus(tenant);
      return sendJson(res, 200, status);
    }

    if (pathname === '/api/integration/stock/sync-products' && req.method === 'POST') {
      const tenant = getFinanceTenantContext(req);
      const result = await stockIntegration.syncProductsFromStock(tenant);
      return sendJson(res, 200, result);
    }

    if (pathname === '/api/integration/stock/sync-sales' && req.method === 'POST') {
      const tenant = getFinanceTenantContext(req);
      const result = await stockIntegration.syncSalesFromStock(tenant);
      return sendJson(res, 200, result);
    }

    if (pathname === '/api/integration/stock/push-landed-costs' && req.method === 'POST') {
      const tenant = getFinanceTenantContext(req);
      const body = await parseJsonBody(req).catch(() => ({}));
      const result = await stockIntegration.pushLandedCostsToStock(body.shipmentId || null, tenant);
      return sendJson(res, 200, result);
    }

    if (pathname === '/api/integration/stock/sync-all' && req.method === 'POST') {
      const tenant = getFinanceTenantContext(req);
      const result = await stockIntegration.runFullSync(tenant);
      return sendJson(res, 200, result);
    }

    // =========================================================================
    // MONTHLY REVENUE ALLOCATION & BUDGETS (FINANCE ENGINE)
    // =========================================================================
    if (pathname === '/api/allocations/monthly' && req.method === 'GET') {
      const tenant = getFinanceTenantContext(req);
      const month = url.searchParams.get('month') || new Date().toISOString().slice(0, 7);
      const { getOrCreateMonthlyPlan } = require('../../../shared/financial/financialAllocationEngine');
      const data = getOrCreateMonthlyPlan(tenant.orgId, month);
      return sendJson(res, 200, { ok: true, ...data });
    }

    if (pathname === '/api/allocations/plan' && req.method === 'POST') {
      const tenant = getFinanceTenantContext(req);
      const body = await parseJsonBody(req);
      const month = body.periodMonth || new Date().toISOString().slice(0, 7);
      const { syncMonthlyAllocations } = require('../../../shared/financial/financialAllocationEngine');
      const { getDatabase } = require('../../../shared/database/connection');
      const dbSql = getDatabase();

      const existingPlan = dbSql.prepare(`
        SELECT additional_reinvestment_percent FROM monthly_revenue_allocations
        WHERE organization_id = ? AND period_month = ?
      `).get(tenant.orgId, month);

      const oldPercent = existingPlan ? Number(existingPlan.additional_reinvestment_percent || 0.0) : 0.0;
      const newPercent = body.additionalReinvestmentPercent !== undefined && body.additionalReinvestmentPercent !== null
        ? Math.max(0, Math.min(100, Number(body.additionalReinvestmentPercent)))
        : oldPercent;

      dbSql.prepare(`
        UPDATE monthly_revenue_allocations
        SET categories_config_json = ?, additional_reinvestment_percent = ?, updated_at = ?
        WHERE organization_id = ? AND period_month = ?
      `).run(JSON.stringify(body.categories || []), newPercent, new Date().toISOString(), tenant.orgId, month);

      if (existingPlan && oldPercent !== newPercent) {
        try {
          dbSql.prepare(`
            INSERT INTO audit_logs (id, organization_id, user_id, user_name, action, details, timestamp)
            VALUES (?, ?, ?, ?, ?, ?, ?)
          `).run(
            `aud-${require('crypto').randomUUID()}`,
            tenant.orgId,
            tenant.user?.id || 'usr-owner',
            tenant.user?.fullName || 'Business Owner',
            'REINVESTMENT_PERCENTAGE_CHANGED',
            `Changed additional inventory reinvestment percentage from ${oldPercent}% to ${newPercent}% for month ${month}`,
            new Date().toISOString()
          );
        } catch (e) {}
      }

      const refreshed = syncMonthlyAllocations(tenant.orgId, month);
      return sendJson(res, 200, { ok: true, ...refreshed });
    }

    if (pathname === '/api/expenses/with-protection' && req.method === 'POST') {
      const tenant = getFinanceTenantContext(req);
      const body = await parseJsonBody(req);
      const { recordExpenseWithCapitalProtection } = require('../../../shared/financial/financialAllocationEngine');
      const result = recordExpenseWithCapitalProtection({
        organizationId: tenant.orgId,
        periodMonth: body.periodMonth,
        categoryId: body.categoryId || 'OPERATING_EXPENSES',
        expenseCategory: body.expenseCategory,
        amount: body.amount,
        description: body.description,
        paymentDate: body.paymentDate,
        invoiceRef: body.invoiceRef,
        supplierName: body.supplierName,
        performedBy: body.performedBy || 'Accountant',
        allowCapitalBorrowing: body.allowCapitalBorrowing !== false
      });
      if (!result.ok) return sendJson(res, 400, result);
      return sendJson(res, 201, result);
    }

    if (pathname === '/api/capital/repay' && req.method === 'POST') {
      const tenant = getFinanceTenantContext(req);
      const body = await parseJsonBody(req);
      const { processCapitalRepayment } = require('../../../shared/financial/financialAllocationEngine');
      const result = processCapitalRepayment({
        organizationId: tenant.orgId,
        borrowingId: body.borrowingId,
        amount: body.amount,
        sourceCategoryId: body.sourceCategoryId || 'OPERATING_EXPENSES',
        performedBy: body.performedBy || 'Accountant',
        notes: body.notes
      });
      if (!result.ok) return sendJson(res, 400, result);
      return sendJson(res, 200, result);
    }

    if ((pathname === '/api/capital/dismiss' || pathname === '/api/finance/capital/borrowing/dismiss' || pathname === '/api/capital/borrowing/dismiss') && req.method === 'POST') {
      const tenant = getFinanceTenantContext(req);
      const body = await parseJsonBody(req);
      const { dismissCapitalBorrowing } = require('../../../shared/financial/financialAllocationEngine');
      const result = dismissCapitalBorrowing({
        organizationId: tenant.orgId,
        borrowingId: body.borrowingId,
        performedBy: body.performedBy || 'Accountant',
        reason: body.reason || 'Decision not to pay'
      });
      if (!result.ok) return sendJson(res, 400, result);
      return sendJson(res, 200, result);
    }

    if (pathname === '/api/capital/borrowings' && req.method === 'GET') {
      const tenant = getFinanceTenantContext(req);
      const { getDatabase } = require('../../../shared/database/connection');
      const dbSql = getDatabase();
      const rows = dbSql.prepare('SELECT * FROM capital_borrowings WHERE organization_id = ? ORDER BY date DESC').all(tenant.orgId);
      return sendJson(res, 200, { ok: true, borrowings: rows });
    }

    if (pathname === '/api/loop-share/ledger' && req.method === 'GET') {
      const tenant = getFinanceTenantContext(req);
      const { getDatabase } = require('../../../shared/database/connection');
      const dbSql = getDatabase();
      const rows = dbSql.prepare('SELECT * FROM loop_share_ledger WHERE organization_id = ? OR organization_id IS NULL ORDER BY date DESC, created_at DESC').all(tenant.orgId);
      const netShare = dbSql.prepare(`
        SELECT 
          COALESCE(SUM(CASE WHEN transaction_type IN ('ALLOCATION', 'ADJUSTMENT_ADD') THEN amount ELSE 0 END), 0) -
          COALESCE(SUM(CASE WHEN transaction_type IN ('DISTRIBUTION', 'WITHDRAWAL', 'PAYMENT', 'ADJUSTMENT_SUB') THEN amount ELSE 0 END), 0) as balance
        FROM loop_share_ledger
        WHERE organization_id = ? OR organization_id IS NULL
      `).get(tenant.orgId);
      const balance = Math.max(0, netShare?.balance || 0);
      return sendJson(res, 200, { ok: true, balance, transactions: rows });
    }

    if (pathname === '/api/loop-share/transaction' && req.method === 'POST') {
      const tenant = getFinanceTenantContext(req);
      const body = await parseJsonBody(req);
      const { recordLoopShareTransaction } = require('../../../shared/financial/financialAllocationEngine');
      const result = recordLoopShareTransaction({
        organizationId: tenant.orgId,
        periodMonth: body.periodMonth,
        transactionType: body.transactionType || 'DISTRIBUTION',
        amount: body.amount,
        recipientName: body.recipientName,
        description: body.description,
        authorizedBy: 'Business Owner'
      });
      if (!result.ok) return sendJson(res, 400, result);
      return sendJson(res, 201, result);
    }

    if (pathname === '/api/closing/execute' && req.method === 'POST') {
      const tenant = getFinanceTenantContext(req);
      const body = await parseJsonBody(req);
      const { executeMonthEndClosing } = require('../../../shared/financial/financialAllocationEngine');
      const result = executeMonthEndClosing({
        organizationId: tenant.orgId,
        periodMonth: body.periodMonth,
        closedBy: body.closedBy || 'Business Owner',
        salaryCarryForwardDecision: body.salaryCarryForwardDecision || 'CARRY_FORWARD',
        manualSalaryAmount: body.manualSalaryAmount || 0.0
      });
      if (!result.ok) return sendJson(res, 400, result);
      return sendJson(res, 200, result);
    }

    if (pathname === '/api/closing/history' && req.method === 'GET') {
      const tenant = getFinanceTenantContext(req);
      const { getDatabase } = require('../../../shared/database/connection');
      const dbSql = getDatabase();
      const rows = dbSql.prepare('SELECT * FROM monthly_closing_snapshots WHERE organization_id = ? ORDER BY period_month DESC').all(tenant.orgId);
      return sendJson(res, 200, {
        ok: true,
        snapshots: rows.map(r => ({ ...r, data: JSON.parse(r.snapshot_data_json || '{}') }))
      });
    }

    if (pathname === '/api/transactions/financial' && req.method === 'GET') {
      const tenant = getFinanceTenantContext(req);
      const { getDatabase } = require('../../../shared/database/connection');
      const dbSql = getDatabase();
      const rows = dbSql.prepare('SELECT * FROM financial_transactions WHERE organization_id = ? ORDER BY date DESC LIMIT 100').all(tenant.orgId);
      return sendJson(res, 200, { ok: true, transactions: rows });
    }

    // 404 for unhandled routes
    return sendJson(res, 404, { error: `Endpoint ${pathname} not found` });

  } catch (error) {
    console.error(`[Server Error] ${req.method} ${pathname}:`, error);
    const statusCode = error.message && error.message.startsWith('Unauthorized') ? 403 : 400;
    return sendJson(res, statusCode, { error: error.message || 'Internal server error' });
  }
});

// Start database and HTTP server
db.initDatabase().then(() => {
  server.listen(PORT, () => {
    console.log(`[Loops Finance V3] Backend listening on http://localhost:${PORT}`);
  });
}).catch(err => {
  console.error('[Startup Error]:', err);
});

