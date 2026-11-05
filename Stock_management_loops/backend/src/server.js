// The Loops System — Universal Retail Management Platform
// Backend REST API Server (Node.js HTTP + ACID In-Memory/JSON Persistence)
const http = require('http');
const fs = require('fs');
const path = require('path');
const { loadDb, saveDb, resetDb } = require('./db');

const PORT = process.env.PORT || 3000;

function getTenantContext(req) {
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
  
  // Try resolving from JWT token first
  if (token && token.split('.').length === 3) {
    try {
      const { verifyToken } = require('../../../shared/security/jwt');
      const payload = verifyToken(token);
      if (payload) {
        explicitOrgId = payload.org || explicitOrgId;
      }
    } catch (e) {}
  }

  // Try resolving from SQLite theloops_enterprise.db
  try {
    const { getDatabase } = require('../../../shared/database/connection');
    const dbSync = getDatabase();

    let resolvedOrgId = explicitOrgId;
    let user = null;

    if (token) {
      const sessionRow = dbSync.prepare('SELECT * FROM sessions WHERE token = ? AND expires_at > ?').get(token, new Date().toISOString());
      if (sessionRow) {
        user = dbSync.prepare('SELECT * FROM users WHERE id = ?').get(sessionRow.user_id);
        if (user && user.organization_id) {
          resolvedOrgId = user.organization_id;
        }
      }
    }

    if (!resolvedOrgId) {
      const firstOrg = dbSync.prepare('SELECT * FROM organizations LIMIT 1').get();
      if (firstOrg) {
        resolvedOrgId = firstOrg.id;
      }
    }

    if (resolvedOrgId) {
      const org = dbSync.prepare('SELECT * FROM organizations WHERE id = ?').get(resolvedOrgId);
      if (org) {
        return {
          orgId: org.id,
          user: user ? { ...user, fullName: user.full_name, organizationId: user.organization_id } : null,
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
        return {
          orgId: orgId,
          user,
          org,
          isDefaultOrg: false,
          token
        };
      }
    }
  } catch (e) {}

  return { orgId: 'org-6e9ed3cf', user: null, org: null, isDefaultOrg: false, token: null };
}

function syncWithEnterpriseDb(db, tenantOrgId) {
  try {
    const { getDatabase } = require('../../../shared/database/connection');
    const dbSql = getDatabase();
    const orgId = tenantOrgId || 'org-6e9ed3cf';

    const sqlProds = dbSql.prepare(`
      SELECT * FROM products WHERE organization_id = ? OR organization_id = 'org-6e9ed3cf'
    `).all(orgId);

    if (sqlProds && sqlProds.length > 0) {
      if (!db.products) db.products = [];
      if (!db.stockBalances) db.stockBalances = [];

      let hasNew = false;
      sqlProds.forEach(sp => {
        let existing = db.products.find(p => p.id === sp.id || p.code === sp.code);
        const variants = dbSql.prepare(`SELECT * FROM product_variants WHERE product_id = ?`).all(sp.id);
        const balances = dbSql.prepare(`SELECT * FROM stock_balances WHERE organization_id = ?`).all(sp.organization_id);

        const mappedVariants = variants.map(v => {
          const skuBalTotal = dbSql.prepare(`SELECT SUM(on_hand) as totalOnHand, SUM(reserved) as totalReserved, SUM(damaged) as totalDamaged FROM stock_balances WHERE sku = ?`).get(v.sku);
          const computedOnHand = (skuBalTotal && skuBalTotal.totalOnHand !== null) ? Number(skuBalTotal.totalOnHand) : (v.on_hand || 0);
          const computedReserved = (skuBalTotal && skuBalTotal.totalReserved !== null) ? Number(skuBalTotal.totalReserved) : (v.reserved || 0);
          const computedDamaged = (skuBalTotal && skuBalTotal.totalDamaged !== null) ? Number(skuBalTotal.totalDamaged) : (v.damaged || 0);

          return {
            sku: v.sku,
            title: v.title || 'Standard',
            barcode: v.barcode || '',
            costMinor: v.cost_minor || sp.cost_minor || 0,
            retailMinor: v.retail_minor || sp.retail_minor || 0,
            onHand: computedOnHand,
            reserved: computedReserved,
            damaged: computedDamaged,
            rop: v.rop || 5
          };
        });

        if (!existing) {
          existing = {
            id: sp.id,
            organizationId: sp.organization_id,
            code: sp.code,
            name: sp.name,
            category: sp.category || 'General',
            brand: sp.brand || '',
            stockUnit: sp.stock_unit || 'piece',
            imageUrl: sp.image_url || '',
            description: sp.description || '',
            costMinor: sp.cost_minor || 0,
            retailMinor: sp.retail_minor || 0,
            hasVariants: Boolean(sp.has_variants),
            variants: mappedVariants.length > 0 ? mappedVariants : [{
              sku: sp.code,
              title: 'Standard',
              barcode: '',
              costMinor: sp.cost_minor || 0,
              retailMinor: sp.retail_minor || 0,
              onHand: 0,
              reserved: 0,
              damaged: 0,
              rop: 5
            }]
          };
          db.products.push(existing);
          hasNew = true;
        } else {
          existing.costMinor = sp.cost_minor || existing.costMinor;
          existing.retailMinor = sp.retail_minor || existing.retailMinor;
          if (mappedVariants.length > 0) {
            existing.variants = mappedVariants;
          }
        }

        // Sync balances
        balances.forEach(b => {
          let bExist = db.stockBalances.find(sb => sb.sku === b.sku && sb.locationId === b.location_id);
          if (!bExist) {
            db.stockBalances.push({
              id: b.id,
              sku: b.sku,
              locationId: b.location_id,
              onHand: b.on_hand,
              reserved: b.reserved || 0,
              damaged: b.damaged || 0,
              rop: b.rop || 5
            });
            hasNew = true;
          } else {
            bExist.onHand = b.on_hand;
          }
        });
      });
      if (hasNew) {
        saveDb();
      }
    }
  } catch (e) {}
}

function ensureTenantLocation(db, tenant) {
  let locs = (db.locations || []).filter(l => l.organizationId === tenant.orgId);
  if (locs.length > 0) return locs;

  // Check SQLite first
  try {
    const { getDatabase } = require('../../../shared/database/connection');
    const dbSync = getDatabase();
    const sqliteLocs = dbSync.prepare('SELECT * FROM locations WHERE organization_id = ?').all(tenant.orgId);
    if (sqliteLocs.length > 0) {
      sqliteLocs.forEach(sl => {
        const newLoc = {
          id: sl.id,
          organizationId: tenant.orgId,
          name: sl.name,
          code: sl.code || 'ST-01',
          type: sl.type || 'STORE',
          address: sl.address || '',
          isDefault: !!sl.is_default,
          createdAt: sl.created_at || new Date().toISOString()
        };
        if (!db.locations) db.locations = [];
        if (!db.locations.some(l => l.id === newLoc.id)) {
          db.locations.push(newLoc);
        }
      });
      saveDb();
      return (db.locations || []).filter(l => l.organizationId === tenant.orgId);
    }
  } catch (e) {}

  const orgName = tenant.org?.name || 'Main Business';
  const posStatePath = path.resolve(__dirname, '../../../The_Loop.s_POS/backend/data/pos_state.json');
  if (fs.existsSync(posStatePath)) {
    try {
      const posDb = JSON.parse(fs.readFileSync(posStatePath, 'utf8'));
      const tenantStores = (posDb.locations || []).filter(l => l.organizationId === tenant.orgId);
      if (tenantStores.length > 0) {
        tenantStores.forEach(ts => {
          const newLoc = {
            id: ts.id,
            organizationId: tenant.orgId,
            name: ts.name,
            code: ts.code || 'ST-01',
            type: 'STORE',
            address: ts.address || '',
            isDefault: !!ts.isDefault,
            createdAt: ts.createdAt || new Date().toISOString()
          };
          if (!db.locations) db.locations = [];
          db.locations.push(newLoc);
        });
        saveDb();
        return (db.locations || []).filter(l => l.organizationId === tenant.orgId);
      }
    } catch (e) {}
  }
  const newLoc = {
    id: `loc-${tenant.orgId}`,
    organizationId: tenant.orgId,
    name: `${orgName} Warehouse`,
    code: 'WH-01',
    type: 'WAREHOUSE',
    address: tenant.org?.address || 'Main Branch',
    isDefault: true,
    createdAt: new Date().toISOString()
  };
  if (!db.locations) db.locations = [];
  db.locations.push(newLoc);
  saveDb();
  return [newLoc];
}

function sendJson(res, statusCode, data) {
  res.writeHead(statusCode, {
    'Content-Type': 'application/json',
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization, x-organization-id, x-business-id, x-session-token'
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

const FINANCE_API_BASE = process.env.FINANCE_API_URL || 'http://localhost:3001/api';

function requestFinance(endpoint, method = 'GET', data = null, token = null, orgId = null) {
  return new Promise((resolve) => {
    try {
      const targetUrl = new URL(`${FINANCE_API_BASE}${endpoint}`);
      const payload = data ? JSON.stringify(data) : null;
      const headers = {
        'Content-Type': 'application/json',
        'Accept': 'application/json'
      };
      if (token) {
        headers['Authorization'] = `Bearer ${token}`;
      }
      if (orgId) {
        headers['x-organization-id'] = orgId;
      }
      const options = {
        hostname: targetUrl.hostname,
        port: targetUrl.port || 3001,
        path: targetUrl.pathname + targetUrl.search,
        method: method,
        headers: headers,
        timeout: 3000
      };
      if (payload) {
        options.headers['Content-Length'] = Buffer.byteLength(payload);
      }
      const req = http.request(options, (res) => {
        let body = '';
        res.on('data', chunk => body += chunk);
        res.on('end', () => {
          try {
            const parsed = body ? JSON.parse(body) : {};
            if (res.statusCode >= 200 && res.statusCode < 300) {
              resolve({ ok: true, status: res.statusCode, data: parsed });
            } else {
              resolve({ ok: false, status: res.statusCode, error: parsed.error || `HTTP ${res.statusCode}` });
            }
          } catch (e) {
            resolve({ ok: false, status: res.statusCode, error: 'Invalid JSON response from Finance OS' });
          }
        });
      });
      req.on('error', (err) => resolve({ ok: false, status: 0, error: err.message }));
      req.on('timeout', () => { req.destroy(); resolve({ ok: false, status: 0, error: 'Timeout' }); });
      if (payload) req.write(payload);
      req.end();
    } catch (err) {
      resolve({ ok: false, status: 0, error: err.message });
    }
  });
}

const POS_API_BASE = process.env.POS_API_URL || 'http://localhost:3002/api';

function requestPos(endpoint, method = 'GET', data = null, token = null, orgId = null) {
  return new Promise((resolve) => {
    try {
      const targetUrl = new URL(`${POS_API_BASE}${endpoint}`);
      const payload = data ? JSON.stringify(data) : null;
      const headers = {
        'Content-Type': 'application/json',
        'Accept': 'application/json'
      };
      if (token) {
        headers['Authorization'] = `Bearer ${token}`;
      }
      if (orgId) {
        headers['x-organization-id'] = orgId;
      }
      const options = {
        hostname: targetUrl.hostname,
        port: targetUrl.port || 3002,
        path: targetUrl.pathname + targetUrl.search,
        method: method,
        headers: headers,
        timeout: 3000
      };
      if (payload) {
        options.headers['Content-Length'] = Buffer.byteLength(payload);
      }
      const req = http.request(options, (res) => {
        let body = '';
        res.on('data', chunk => body += chunk);
        res.on('end', () => {
          try {
            resolve({ ok: res.statusCode >= 200 && res.statusCode < 300, status: res.statusCode, data: body ? JSON.parse(body) : {} });
          } catch (e) {
            resolve({ ok: false, status: res.statusCode, error: 'Invalid JSON from POS' });
          }
        });
      });
      req.on('error', (err) => resolve({ ok: false, status: 0, error: err.message }));
      req.on('timeout', () => { req.destroy(); resolve({ ok: false, status: 0, error: 'Timeout' }); });
      if (payload) req.write(payload);
      req.end();
    } catch (err) {
      resolve({ ok: false, status: 0, error: err.message });
    }
  });
}

const server = http.createServer(async (req, res) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    res.writeHead(204, {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization, x-organization-id, x-business-id, x-session-token'
    });
    return res.end();
  }

  const url = new URL(req.url, `http://${req.headers.host}`);
  let pathname = url.pathname;
  if (pathname.startsWith('/api/stock/')) {
    pathname = '/api/' + pathname.slice('/api/stock/'.length);
  } else if (pathname === '/api/stock') {
    pathname = '/api';
  }
  const db = loadDb();

  try {
    // 1. Health check
    if (pathname === '/api/health' && req.method === 'GET') {
      return sendJson(res, 200, { status: 'healthy', platform: 'The Loops Retail API', version: '2.0.0' });
    }

    // 1b. Accounting Bridge Status & Sync (Loops Finance V3 on Port 3001)
    if (pathname === '/api/accounting-bridge/status' && req.method === 'GET') {
      const tenant = getTenantContext(req);
      const healthRes = await requestFinance('/health', 'GET', null, tenant.token, tenant.orgId);
      if (!healthRes.ok) {
        return sendJson(res, 200, {
          connected: false,
          service: 'Loops Finance V3 OS',
          port: 3001,
          message: healthRes.error || 'Loops Finance is not reachable on port 3001'
        });
      }

      const statusRes = await requestFinance('/integration/stock/status', 'GET', null, tenant.token, tenant.orgId);
      return sendJson(res, 200, {
        connected: true,
        service: 'Loops Finance V3 OS',
        port: 3001,
        status: healthRes.data?.status || 'UP',
        version: healthRes.data?.version || '3.0.0',
        timestamp: healthRes.data?.timestamp,
        bridgeInfo: statusRes.ok ? statusRes.data : null
      });
    }

    if (pathname === '/api/accounting-bridge/sync' && req.method === 'POST') {
      const tenant = getTenantContext(req);
      const syncRes = await requestFinance('/integration/stock/sync-all', 'POST', null, tenant.token, tenant.orgId);
      if (!syncRes.ok) {
        return sendJson(res, 400, {
          success: false,
          error: syncRes.error || 'Failed to trigger synchronization with Loops Finance'
        });
      }
      return sendJson(res, 200, {
        success: true,
        message: 'Successfully synchronized products and sales with Loops Finance General Ledger',
        details: syncRes.data
      });
    }

    // 2. Full State / Dashboard
    if (pathname === '/api/dashboard' && req.method === 'GET') {
      const tenant = getTenantContext(req);
      syncWithEnterpriseDb(db, tenant.orgId);
      const locs = ensureTenantLocation(db, tenant);
      const tenantLocIds = new Set(locs.map(l => l.id));
      const tenantProducts = (db.products || []).filter(p => !p.organizationId || p.organizationId === tenant.orgId || (tenant.orgId === 'org-6e9ed3cf' && (p.organizationId === 'org-160c29e2' || !p.organizationId)));

      const locationId = url.searchParams.get('locationId');
      let totalCogs = 0;
      let totalRetail = 0;
      let totalUnits = 0;
      let totalSkus = 0;
      let totalDamaged = 0;
      let alertVariants = [];

      tenantProducts.forEach(p => {
        p.variants.forEach(v => {
          totalSkus++;
          let onHand = v.onHand;
          let reserved = v.reserved || 0;
          let damaged = v.damaged || 0;
          let rop = v.rop || 5;

          if (locationId && locationId !== 'ALL') {
            const locBal = (db.stockBalances || []).find(b => b.sku === v.sku && b.locationId === locationId);
            onHand = locBal ? locBal.onHand : 0;
            reserved = locBal ? (locBal.reserved || 0) : 0;
            damaged = locBal ? (locBal.damaged || 0) : 0;
            rop = locBal ? (locBal.rop || v.rop || 5) : rop;
          }

          totalUnits += onHand;
          totalDamaged += damaged;
          const unitCost = (v.costMinor && v.costMinor > 0) ? v.costMinor : (p.costMinor && p.costMinor > 0 ? p.costMinor : 0);
          totalCogs += (onHand * unitCost);
          totalRetail += (onHand * (v.retailMinor || p.retailMinor || 0));
          if (onHand <= rop) {
            alertVariants.push({
              product: p,
              variant: { ...v, onHand, reserved, damaged, rop }
            });
          }
        });
      });

      // Compute sales revenue and units sold (support location filtering & tenant scoping)
      const salesForTenant = (db.sales || []).filter(s =>
        (s.organizationId || 'org-loops-001') === tenant.orgId || tenantLocIds.has(s.locationId)
      );
      const salesForLocation = (locationId && locationId !== 'ALL')
        ? salesForTenant.filter(s => s.locationId === locationId && s.status === 'COMPLETED')
        : salesForTenant.filter(s => s.status === 'COMPLETED');

      const totalSalesCents = salesForLocation.reduce((sum, s) => sum + s.totalMinor, 0);
      const totalUnitsSold = salesForLocation.reduce((sum, s) => {
        return sum + (s.items || []).reduce((itemSum, item) => itemSum + item.qty, 0);
      }, 0);

      const locationStats = locs.map(loc => {
        const locBals = (db.stockBalances || []).filter(b => b.locationId === loc.id);
        const totalUnits = locBals.reduce((sum, b) => sum + b.onHand, 0);
        const lowStockCount = locBals.filter(b => b.onHand <= b.rop && b.onHand > 0).length;
        const oosCount = locBals.filter(b => b.onHand === 0).length;
        const inStockCount = locBals.filter(b => b.onHand > b.rop).length;
        return {
          id: loc.id,
          name: loc.name,
          code: loc.code,
          type: loc.type,
          address: loc.address || '',
          isDefault: !!loc.isDefault,
          totalUnits,
          inStockCount,
          lowStockCount,
          oosCount
        };
      });

      let movements = (db.ledger || []).filter(m => (m.organizationId || 'org-loops-001') === tenant.orgId || tenantLocIds.has(m.locationId));
      if (locationId && locationId !== 'ALL') {
        movements = movements.filter(m => m.locationId === locationId);
      }

      return sendJson(res, 200, {
        scopeLocationId: locationId || 'ALL',
        totalCogs,
        totalRetail,
        totalUnits,
        totalSkus,
        totalProducts: tenantProducts.length,
        totalSalesCents,
        totalUnitsSold,
        totalDamaged,
        alertVariants,
        locationStats,
        recentMovements: movements.slice(0, 10),
        locations: locs,
        settings: tenant.isDefaultOrg ? (db.settings || {}) : {
          businessName: tenant.org?.name || 'Main Business',
          currency: tenant.org?.currency || 'USD',
          isOnboarded: true,
          taxRate: tenant.org?.taxRate || 0.1
        },
        isOnboarded: true
      });
    }

    // Store Registration & Onboarding (No login required)
    if (pathname === '/api/onboard' && req.method === 'POST') {
      const body = await parseJsonBody(req);
      if (!body.storeName || !body.businessName) {
        return sendJson(res, 400, { error: 'Business name and store name are required' });
      }

      const primaryLoc = {
        id: 'loc-1',
        name: body.storeName.trim(),
        code: (body.storeCode || 'STORE-01').trim().toUpperCase(),
        type: body.storeType || 'STORE',
        address: (body.storeAddress || '').trim(),
        isDefault: true
      };

      db.locations = [primaryLoc];
      db.settings = {
        businessName: body.businessName.trim(),
        ownerName: (body.ownerName || '').trim(),
        currency: body.currency || 'USD',
        taxRate: parseFloat(body.taxRate) || 0,
        skuPrefix: (body.skuPrefix || 'LP').trim().toUpperCase(),
        lowStockThresholdDefault: 5,
        isOnboarded: true
      };

      if (body.includeStarterCategories) {
        db.categories = [
          { id: 'cat-1', name: 'Electronics', slug: 'electronics' },
          { id: 'cat-2', name: 'Bags', slug: 'bags' },
          { id: 'cat-3', name: 'Cosmetics', slug: 'cosmetics' },
          { id: 'cat-4', name: 'Jewelry', slug: 'jewelry' },
          { id: 'cat-5', name: 'Stationery', slug: 'stationery' },
          { id: 'cat-6', name: 'Footwear', slug: 'footwear' },
          { id: 'cat-7', name: 'Clothing', slug: 'clothing' },
          { id: 'cat-8', name: 'Homeware', slug: 'homeware' }
        ];
      } else if (!db.categories) {
        db.categories = [];
      }

      db.products = [];
      db.sales = [];
      db.purchaseOrders = [];
      db.customers = [];
      db.suppliers = [];
      db.stockBalances = [];
      db.ledger = [];

      saveDb();
      return sendJson(res, 200, {
        success: true,
        message: `Store "${primaryLoc.name}" registered successfully!`,
        settings: db.settings,
        location: primaryLoc
      });
    }

    // 3. Products
    if (pathname === '/api/products' && req.method === 'GET') {
      const tenant = getTenantContext(req);
      syncWithEnterpriseDb(db, tenant.orgId);
      const prods = (db.products || []).filter(p => !p.organizationId || p.organizationId === tenant.orgId || (tenant.orgId === 'org-6e9ed3cf' && (p.organizationId === 'org-160c29e2' || !p.organizationId)));
      return sendJson(res, 200, prods);
    }

    if (pathname === '/api/products' && req.method === 'POST') {
      const tenant = getTenantContext(req);
      const locs = ensureTenantLocation(db, tenant);
      const body = await parseJsonBody(req);
      if (!body.code || !body.name) {
        return sendJson(res, 400, { error: 'Product code and name are required' });
      }
      if ((db.products || []).some(p => p.code === body.code && (p.organizationId || 'org-loops-001') === tenant.orgId)) {
        return sendJson(res, 400, { error: `Product code ${body.code} already exists` });
      }

      let generatedVariants = [];
      let barcodeCounter = 880200000000 + Math.floor(Math.random() * 800000);

      if (body.hasVariants && Array.isArray(body.variants) && body.variants.length > 0) {
        generatedVariants = body.variants.map((v, i) => ({
          sku: v.sku || `${body.code}-V${i+1}`,
          title: v.title || `Variant ${i+1}`,
          barcode: v.barcode || (barcodeCounter++).toString(),
          costMinor: v.costMinor !== undefined ? v.costMinor : (body.costMinor || 0),
          retailMinor: v.retailMinor !== undefined ? v.retailMinor : (body.retailMinor || 0),
          onHand: v.onHand || 0,
          reserved: 0,
          damaged: 0,
          rop: v.rop || 5
        }));
      } else {
        generatedVariants.push({
          sku: `${body.code}-STD`,
          title: 'Default Standard',
          barcode: (barcodeCounter++).toString(),
          costMinor: body.costMinor || 0,
          retailMinor: body.retailMinor || 0,
          onHand: 0,
          reserved: 0,
          damaged: 0,
          rop: 5
        });
      }

      const newProduct = {
        id: 'prod-' + Math.random().toString(36).substring(2, 9),
        organizationId: tenant.orgId,
        code: body.code,
        name: body.name,
        category: body.category || 'General',
        brand: body.brand || 'General',
        stockUnit: body.stockUnit || 'piece',
        imageUrl: body.imageUrl || '',
        description: body.description || '',
        costMinor: body.costMinor || 0,
        retailMinor: body.retailMinor || 0,
        hasVariants: body.hasVariants || false,
        variants: generatedVariants
      };

      db.products.push(newProduct);

      // Initialize stockBalances across this tenant's locations for newly created variants
      locs.forEach(loc => {
        generatedVariants.forEach(v => {
          if (!db.stockBalances) db.stockBalances = [];
          db.stockBalances.push({
            id: `bal-${loc.id}-${v.sku}`,
            sku: v.sku,
            locationId: loc.id,
            onHand: loc.isDefault ? (v.onHand || 0) : 0,
            reserved: 0,
            damaged: 0,
            rop: v.rop || 5
          });
        });
      });

      saveDb();
      // Auto-sync product updates to Loops Finance V3 (Port 3001) & The Loop.s POS (Port 3002)
      requestFinance('/integration/stock/sync-products', 'POST', null, tenant.token, tenant.orgId).catch(() => {});
      requestPos('/catalog/sync-product', 'POST', newProduct, tenant.token, tenant.orgId).catch(() => {});
      return sendJson(res, 201, newProduct);
    }

    // 3b. Update Existing Product (Editable Product)
    if (pathname.startsWith('/api/products/') && req.method === 'PUT') {
      const productId = pathname.split('/')[3];
      const product = db.products.find(p => p.id === productId);
      if (!product) return sendJson(res, 404, { error: 'Product not found' });

      const body = await parseJsonBody(req);

      // Verify code uniqueness if code changed
      if (body.code && body.code !== product.code) {
        if (db.products.some(p => p.id !== productId && p.code === body.code)) {
          return sendJson(res, 400, { error: `Product code ${body.code} is already in use by another product` });
        }
      }

      const prevCode = product.code;
      product.code = body.code || product.code;
      product.name = body.name !== undefined ? body.name : product.name;
      product.category = body.category || product.category;
      product.brand = body.brand || product.brand;
      product.stockUnit = body.stockUnit || product.stockUnit;
      product.imageUrl = body.imageUrl !== undefined ? body.imageUrl : product.imageUrl;
      product.description = body.description !== undefined ? body.description : product.description;
      product.costMinor = body.costMinor !== undefined ? body.costMinor : product.costMinor;
      product.retailMinor = body.retailMinor !== undefined ? body.retailMinor : product.retailMinor;
      product.hasVariants = body.hasVariants !== undefined ? body.hasVariants : product.hasVariants;

      // Update or replace variants
      if (Array.isArray(body.variants) && body.variants.length > 0) {
        let barcodeCounter = 880300000000 + Math.floor(Math.random() * 800000);
        const updatedVariants = body.variants.map((v, i) => {
          const existingVar = product.variants.find(ev => ev.sku === v.sku);
          const newOnHand = v.onHand !== undefined ? Number(v.onHand) : (existingVar ? existingVar.onHand : 0);
          return {
            sku: v.sku || `${product.code}-V${i+1}`,
            title: v.title || `Variant ${i+1}`,
            barcode: v.barcode || existingVar?.barcode || (barcodeCounter++).toString(),
            costMinor: v.costMinor !== undefined ? v.costMinor : product.costMinor,
            retailMinor: v.retailMinor !== undefined ? v.retailMinor : product.retailMinor,
            onHand: newOnHand,
            reserved: existingVar ? existingVar.reserved : 0,
            damaged: existingVar ? existingVar.damaged : 0,
            rop: v.rop || existingVar?.rop || 5
          };
        });
        product.variants = updatedVariants;

        // Ensure stock balances exist for updated variants within tenant locations
        const tenant = getTenantContext(req);
        const locs = ensureTenantLocation(db, tenant);
        locs.forEach(loc => {
          updatedVariants.forEach(v => {
            if (!db.stockBalances) db.stockBalances = [];
            let bal = db.stockBalances.find(b => b.sku === v.sku && b.locationId === loc.id);
            if (!bal) {
              bal = {
                id: `bal-${loc.id}-${v.sku}`,
                sku: v.sku,
                locationId: loc.id,
                onHand: loc.isDefault ? (v.onHand || 0) : 0,
                reserved: 0,
                damaged: 0,
                rop: v.rop || 5
              };
              db.stockBalances.push(bal);
            } else if (loc.isDefault && v.onHand !== undefined) {
              bal.onHand = Number(v.onHand);
            }
          });
        });
      }

      // Update references in ledger if code or name changed
      if (prevCode !== product.code || product.name !== body.name) {
        db.ledger.forEach(m => {
          if (m.productCode === prevCode) {
            m.productCode = product.code;
            m.productName = product.name;
          }
        });
      }

      // Atomically sync updated variants & stock balances to SQLite
      try {
        const { getDatabase } = require('../../../shared/database/connection');
        const sqlDb = getDatabase();
        const tenant = getTenantContext(req);
        const locs = ensureTenantLocation(db, tenant);
        const defaultLoc = locs.find(l => l.isDefault) || locs[0] || { id: 'loc-01' };
        
        (product.variants || []).forEach(v => {
          sqlDb.prepare(`
            UPDATE product_variants 
            SET on_hand = ?, cost_minor = ?, retail_minor = ? 
            WHERE sku = ?
          `).run(v.onHand, v.costMinor, v.retailMinor, v.sku);

          sqlDb.prepare(`
            INSERT INTO stock_balances (id, organization_id, location_id, sku, on_hand, reserved, damaged, rop, updated_at)
            VALUES (?, ?, ?, ?, ?, 0, 0, 5, datetime('now'))
            ON CONFLICT(id) DO UPDATE SET on_hand = excluded.on_hand, updated_at = datetime('now')
          `).run(`bal-${defaultLoc.id}-${v.sku}`, tenant.orgId, defaultLoc.id, v.sku, v.onHand);
        });

        sqlDb.prepare(`
          UPDATE products 
          SET name = ?, category = ?, brand = ?, stock_unit = ?, cost_minor = ?, retail_minor = ?, image_url = ?, description = ?
          WHERE id = ? OR code = ?
        `).run(product.name, product.category, product.brand, product.stockUnit, product.costMinor, product.retailMinor, product.imageUrl, product.description, product.id, product.code);
      } catch (sqlErr) {
        console.warn('[Products PUT] SQLite sync warning:', sqlErr.message);
      }

      saveDb();
      // Auto-sync product updates to Loops Finance V3 (Port 3001) & The Loop.s POS (Port 3002)
      const tenant = getTenantContext(req);
      requestFinance('/integration/stock/sync-products', 'POST', null, tenant.token, tenant.orgId).catch(() => {});
      requestPos('/catalog/sync-product', 'POST', product, tenant.token, tenant.orgId).catch(() => {});
      return sendJson(res, 200, product);
    }

    // 3c. Categories Management
    if (pathname === '/api/categories' && req.method === 'GET') {
      const tenant = getTenantContext(req);
      if (!db.categories) db.categories = [];
      // Read from SQLite if available
      try {
        const { getDatabase } = require('../../../shared/database/connection');
        const dbSync = getDatabase();
        const sqliteCats = dbSync.prepare('SELECT * FROM categories WHERE organization_id = ?').all(tenant.orgId);
        if (sqliteCats && sqliteCats.length > 0) {
          return sendJson(res, 200, sqliteCats.map(c => ({ id: c.id, name: c.name, slug: c.slug, organizationId: c.organization_id })));
        }
      } catch (e) {}
      const tenantCats = db.categories.filter(c => !c.organizationId || c.organizationId === tenant.orgId);
      return sendJson(res, 200, tenantCats);
    }

    if (pathname === '/api/categories' && req.method === 'POST') {
      const tenant = getTenantContext(req);
      const body = await parseJsonBody(req);
      const name = (body.name || '').trim();
      if (!name) return sendJson(res, 400, { error: 'Category name is required' });

      if (!db.categories) db.categories = [];
      let existing = db.categories.find(c => c.name.toLowerCase() === name.toLowerCase() && (c.organizationId === tenant.orgId || !c.organizationId));
      if (!existing) {
        existing = {
          id: 'cat-' + Math.random().toString(36).substring(2, 9),
          organizationId: tenant.orgId,
          name,
          slug: name.toLowerCase().replace(/\s+/g, '-')
        };
        db.categories.push(existing);
        saveDb();

        try {
          const { getDatabase } = require('../../../shared/database/connection');
          const dbSync = getDatabase();
          dbSync.prepare('INSERT OR REPLACE INTO categories (id, organization_id, name, slug, created_at) VALUES (?, ?, ?, ?, ?)').run(
            existing.id, tenant.orgId, existing.name, existing.slug, new Date().toISOString()
          );
        } catch (e) {}
      }
      return sendJson(res, 201, existing);
    }

    if (pathname.startsWith('/api/categories/') && req.method === 'DELETE') {
      const tenant = getTenantContext(req);
      const catIdOrName = decodeURIComponent(pathname.split('/')[3] || '').trim();
      if (!catIdOrName) return sendJson(res, 400, { error: 'Category identifier required' });

      // Find the category
      const cat = (db.categories || []).find(c => c.id === catIdOrName || c.name.toLowerCase() === catIdOrName.toLowerCase());
      const catName = cat ? cat.name : catIdOrName;

      // Check if products belong to this category
      const tenantProducts = (db.products || []).filter(p => (p.organizationId || 'org-loops-001') === tenant.orgId);
      const usedProducts = tenantProducts.filter(p => (p.category || '').toLowerCase() === catName.toLowerCase());
      if (usedProducts.length > 0) {
        return sendJson(res, 400, {
          error: `Cannot delete category "${catName}" because ${usedProducts.length} product(s) are currently assigned to it. Please reassign or delete the products first.`
        });
      }

      // Remove from memory
      if (db.categories) {
        db.categories = db.categories.filter(c => c.id !== catIdOrName && c.name.toLowerCase() !== catName.toLowerCase());
        saveDb();
      }

      // Remove from SQLite
      try {
        const { getDatabase } = require('../../../shared/database/connection');
        const dbSync = getDatabase();
        if (cat) {
          dbSync.prepare('DELETE FROM categories WHERE id = ? AND organization_id = ?').run(cat.id, tenant.orgId);
        }
        dbSync.prepare('DELETE FROM categories WHERE name = ? AND organization_id = ?').run(catName, tenant.orgId);
      } catch (e) {}

      return sendJson(res, 200, { ok: true, message: `Category "${catName}" deleted successfully.` });
    }

    // 4. Inventory Balances & Ledger
    if (pathname === '/api/inventory/balances' && req.method === 'GET') {
      const tenant = getTenantContext(req);
      const locs = ensureTenantLocation(db, tenant);
      const tenantProducts = (db.products || []).filter(p => (p.organizationId || 'org-loops-001') === tenant.orgId);
      const locationId = url.searchParams.get('locationId');
      let balances = [];

      tenantProducts.forEach(p => {
        p.variants.forEach(v => {
          locs.forEach(loc => {
            if (locationId && locationId !== 'ALL' && loc.id !== locationId) {
              return;
            }
            const bal = (db.stockBalances || []).find(b => b.sku === v.sku && b.locationId === loc.id) || {
              onHand: 0,
              reserved: 0,
              damaged: 0,
              rop: v.rop || 5
            };

            balances.push({
              id: bal.id || `bal-${loc.id}-${v.sku}`,
              locationId: loc.id,
              locationName: loc.name,
              locationCode: loc.code,
              productCode: p.code,
              productName: p.name,
              category: p.category,
              brand: p.brand,
              imageUrl: p.imageUrl,
              sku: v.sku,
              title: v.title,
              barcode: v.barcode,
              costMinor: v.costMinor,
              retailMinor: v.retailMinor,
              onHand: bal.onHand,
              reserved: bal.reserved || 0,
              available: bal.onHand - (bal.reserved || 0),
              damaged: bal.damaged || 0,
              rop: bal.rop || v.rop || 5,
              totalOnHandAllLocations: v.onHand
            });
          });
        });
      });
      return sendJson(res, 200, balances);
    }

    if (pathname === '/api/inventory/ledger' && req.method === 'GET') {
      const tenant = getTenantContext(req);
      const locs = ensureTenantLocation(db, tenant);
      const tenantLocIds = new Set(locs.map(l => l.id));
      const type = url.searchParams.get('type');
      let result = (db.ledger || []).filter(m => (m.organizationId || 'org-loops-001') === tenant.orgId || tenantLocIds.has(m.locationId));
      if (type && type !== 'ALL') {
        result = result.filter(m => m.type === type);
      }
      return sendJson(res, 200, result);
    }

    // Receive Stock In
    if (pathname === '/api/inventory/receive' && req.method === 'POST') {
      const body = await parseJsonBody(req);
      const { sku, qty, poNumber, unitCostMinor, notes, locationId } = body;

      let targetProd, targetVar;
      db.products.forEach(p => {
        p.variants.forEach(v => {
          if (v.sku === sku) { targetProd = p; targetVar = v; }
        });
      });

      if (!targetVar) {
        return sendJson(res, 404, { error: `SKU ${sku} not found` });
      }

      const receivedQty = parseInt(qty, 10);
      if (isNaN(receivedQty) || receivedQty <= 0) {
        return sendJson(res, 400, { error: 'Received quantity must be a positive number' });
      }

      const targetLocId = locationId || db.locations.find(l => l.isDefault)?.id || 'loc-1';
      let locBal = db.stockBalances.find(b => b.sku === sku && b.locationId === targetLocId);
      if (!locBal) {
        locBal = {
          id: `bal-${targetLocId}-${sku}`,
          sku,
          locationId: targetLocId,
          onHand: 0,
          reserved: 0,
          damaged: 0,
          rop: targetVar.rop || 5
        };
        db.stockBalances.push(locBal);
      }

      locBal.onHand += receivedQty;
      targetVar.onHand += receivedQty;

      const locName = db.locations.find(l => l.id === targetLocId)?.name || 'Default Store';
      const now = new Date().toISOString().replace('T', ' ').substring(0, 19);

      const movement = {
        id: 'mov-' + Math.random().toString(36).substring(2, 9),
        timestamp: now,
        type: 'RECEIVE_STOCK',
        sku: targetVar.sku,
        productCode: targetProd.code,
        productName: targetProd.name,
        variantTitle: targetVar.title,
        locationId: targetLocId,
        locationName: locName,
        delta: receivedQty,
        balanceAfter: locBal.onHand,
        unitCostMinor: unitCostMinor || targetVar.costMinor,
        referenceNo: poNumber || 'PO-MANUAL',
        staff: 'Receiving Dock',
        reason: notes || `Supplier delivery received at ${locName}.`
      };

      db.ledger.unshift(movement);
      saveDb();
      // Notify POS of updated stock on-hand
      const tenant = getTenantContext(req);
      requestPos('/catalog/sync-product', 'POST', targetProd, tenant.token, tenant.orgId).catch(() => {});
      return sendJson(res, 200, { success: true, movement, variant: targetVar, balance: locBal });
    }

    // ------------------------------------------------------------------------
    // INWARD PURCHASE & IMPORT BRIDGE FROM ACCOUNT SYSTEM (LOOPS FINANCE V3)
    // ------------------------------------------------------------------------
    if (pathname === '/api/inventory/import-purchase' && req.method === 'POST') {
      const tenant = getTenantContext(req);
      const locs = ensureTenantLocation(db, tenant);
      const body = await parseJsonBody(req);
      const { purchaseCode, supplierName, items = [], locationId, notes } = body;

      if (!items || items.length === 0) {
        return sendJson(res, 400, { error: 'No items provided in purchase receipt' });
      }

      const targetLocId = locationId || locs.find(l => l.isDefault)?.id || locs[0]?.id || 'loc-1';
      const locName = (locs.find(l => l.id === targetLocId) || locs[0])?.name || 'Default Store';
      const now = new Date().toISOString().replace('T', ' ').substring(0, 19);

      if (!db.receivedPurchases) db.receivedPurchases = [];
      const isAlreadyReceived = purchaseCode && db.receivedPurchases.some(r => 
        r.purchaseCode === purchaseCode && (r.organizationId === tenant.orgId || !r.organizationId)
      );

      let processedCount = 0;
      const affectedProducts = [];

      items.forEach(item => {
        const qty = parseInt(item.quantity, 10) || 1;
        const sku = item.skuCode || item.sku || `SKU-${Date.now()}`;
        const prodName = item.productName || item.name || 'Imported Product';
        const costMinor = Math.round((Number(item.unitLandedCost) || Number(item.unitBasePrice) || 0) * 100);
        const retailMinor = Math.round((Number(item.targetRetailPrice) || Number(item.retailPrice) || (costMinor * 2.2 / 100)) * 100);
        const imageUrl = item.imageUrl || '';
        const category = (item.category || '').trim() || 'General';

        // Auto-create category in Stock Management if it does not exist
        if (!db.categories) db.categories = [];
        let existingCat = db.categories.find(c => c.name.toLowerCase() === category.toLowerCase() && (c.organizationId === tenant.orgId || !c.organizationId));
        if (!existingCat) {
          existingCat = {
            id: 'cat-' + Math.random().toString(36).substring(2, 9),
            organizationId: tenant.orgId,
            name: category,
            slug: category.toLowerCase().replace(/\s+/g, '-')
          };
          db.categories.push(existingCat);
          try {
            const { getDatabase } = require('../../../shared/database/connection');
            const dbSync = getDatabase();
            dbSync.prepare('INSERT OR REPLACE INTO categories (id, organization_id, name, slug, created_at) VALUES (?, ?, ?, ?, ?)').run(
              existingCat.id, tenant.orgId, existingCat.name, existingCat.slug, new Date().toISOString()
            );
          } catch (e) {}
        }

        // Check if product exists by SKU or Code
        let targetProd, targetVar;
        db.products.forEach(p => {
          if ((p.organizationId || 'org-loops-001') === tenant.orgId) {
            p.variants.forEach(v => {
              if (v.sku === sku || p.code === sku) {
                targetProd = p;
                targetVar = v;
              }
            });
          }
        });

        if (targetVar) {
          // Update existing variant & product
          if (!isAlreadyReceived) {
            targetVar.onHand = (targetVar.onHand || 0) + qty;
          }
          targetVar.costMinor = costMinor || targetVar.costMinor;
          if (retailMinor > 0) targetVar.retailMinor = retailMinor;
          if (imageUrl) targetProd.imageUrl = imageUrl;
          if (category) targetProd.category = category;

          let locBal = (db.stockBalances || []).find(b => b.sku === targetVar.sku && b.locationId === targetLocId);
          if (!locBal) {
            locBal = {
              id: `bal-${targetLocId}-${targetVar.sku}`,
              sku: targetVar.sku,
              locationId: targetLocId,
              onHand: 0,
              reserved: 0,
              damaged: 0,
              rop: targetVar.rop || 5
            };
            db.stockBalances.push(locBal);
          }
          if (!isAlreadyReceived) {
            locBal.onHand += qty;

            // Ledger movement
            db.ledger.unshift({
              id: 'mov-' + Math.random().toString(36).substring(2, 9),
              timestamp: now,
              type: 'RECEIVE_STOCK',
              sku: targetVar.sku,
              productCode: targetProd.code,
              productName: targetProd.name,
              variantTitle: targetVar.title,
              locationId: targetLocId,
              locationName: locName,
              delta: qty,
              balanceAfter: locBal.onHand,
              unitCostMinor: costMinor,
              referenceNo: purchaseCode || 'GRN-IMPORT',
              staff: 'Finance Purchasing Bridge',
              reason: `Finalized import from ${supplierName || 'Account System'}.`
            });
          }

          affectedProducts.push(targetProd);
          processedCount++;
        } else {
          // Create new product in Stock Management
          const prodCode = item.skuCode || item.code || `IMP-${Math.floor(1000 + Math.random() * 9000)}`;
          const newVar = {
            sku: sku,
            title: item.variantName || 'Standard',
            barcode: item.barcode || (880300000000 + Math.floor(Math.random() * 800000)).toString(),
            costMinor: costMinor,
            retailMinor: retailMinor || (costMinor * 2),
            onHand: qty,
            reserved: 0,
            damaged: 0,
            rop: 5
          };

          const newProd = {
            id: 'prod-' + Math.random().toString(36).substring(2, 9),
            organizationId: tenant.orgId,
            code: prodCode,
            name: prodName,
            category: category,
            brand: supplierName || 'Import Brand',
            stockUnit: 'piece',
            imageUrl: imageUrl,
            description: item.description || `Imported via ${purchaseCode} from ${supplierName}`,
            costMinor: costMinor,
            retailMinor: retailMinor || (costMinor * 2),
            hasVariants: false,
            variants: [newVar]
          };

          db.products.unshift(newProd);

          if (!db.stockBalances) db.stockBalances = [];
          db.stockBalances.push({
            id: `bal-${targetLocId}-${newVar.sku}`,
            sku: newVar.sku,
            locationId: targetLocId,
            onHand: qty,
            reserved: 0,
            damaged: 0,
            rop: 5
          });

          db.ledger.unshift({
            id: 'mov-' + Math.random().toString(36).substring(2, 9),
            timestamp: now,
            type: 'RECEIVE_STOCK',
            sku: newVar.sku,
            productCode: newProd.code,
            productName: newProd.name,
            variantTitle: newVar.title,
            locationId: targetLocId,
            locationName: locName,
            delta: qty,
            balanceAfter: qty,
            unitCostMinor: costMinor,
            referenceNo: purchaseCode || 'GRN-IMPORT',
            staff: 'Finance Purchasing Bridge',
            reason: `Initial import from ${supplierName || 'Account System'}.`
          });

          affectedProducts.push(newProd);
          processedCount++;
        }
      });

      if (!isAlreadyReceived && purchaseCode) {
        db.receivedPurchases.push({ purchaseCode, organizationId: tenant.orgId, receivedAt: now });
      }

      saveDb();

      // Automatically sync newly received products to POS
      await Promise.all(affectedProducts.map(prod => requestPos('/catalog/sync-product', 'POST', prod, tenant.token, tenant.orgId).catch(() => {})));

      return sendJson(res, 200, {
        success: true,
        alreadyReceived: Boolean(isAlreadyReceived),
        message: isAlreadyReceived 
          ? `Purchase ${purchaseCode} was already received. Product costs and POS catalog refreshed without duplicate stock.`
          : `Successfully processed ${processedCount} imported item(s) into inventory`,
        purchaseCode,
        affectedProductsCount: affectedProducts.length
      });
    }

    // ------------------------------------------------------------------------
    // STOCK MANAGEMENT ROLES & PERMISSIONS
    // ------------------------------------------------------------------------
    if (pathname === '/api/roles' && req.method === 'GET') {
      return sendJson(res, 200, [
        {
          id: 'STOCK_ADMIN',
          name: 'Stock Administrator',
          description: 'Full stock system access, warehouses, adjustments & transfers',
          permissions: ['CREATE_PRODUCT', 'EDIT_PRODUCT', 'RECEIVE_GOODS', 'ADJUST_STOCK', 'APPROVE_ADJUSTMENT', 'TRANSFER_STOCK', 'MANAGE_LOCATIONS']
        },
        {
          id: 'STOCK_MANAGER',
          name: 'Stock Manager',
          description: 'Manage products, receive goods, create transfers & review reports',
          permissions: ['CREATE_PRODUCT', 'EDIT_PRODUCT', 'RECEIVE_GOODS', 'TRANSFER_STOCK', 'VIEW_REPORTS']
        },
        {
          id: 'INVENTORY_CLERK',
          name: 'Inventory Clerk',
          description: 'View products, receive goods & perform cycle stock counts',
          permissions: ['VIEW_PRODUCTS', 'RECEIVE_GOODS', 'STOCK_COUNT']
        },
        {
          id: 'WAREHOUSE_STAFF',
          name: 'Warehouse Staff',
          description: 'View assigned warehouse, pick, pack & receive deliveries',
          permissions: ['VIEW_ASSIGNED_LOCATION', 'RECEIVE_GOODS', 'PICK_PACK']
        },
        {
          id: 'STOCK_AUDITOR',
          name: 'Stock Auditor',
          description: 'Read-only access to inventory history, valuation & audit records',
          permissions: ['VIEW_PRODUCTS', 'VIEW_LEDGER', 'VIEW_VALUATION']
        }
      ]);
    }

    if (pathname === '/api/users' && req.method === 'GET') {
      if (!db.users) {
        db.users = [
          { id: 'usr-stk-1', fullName: 'Stock Supervisor', email: 'stockadmin@theloops.com', role: 'STOCK_ADMIN', locationId: 'loc-1' },
          { id: 'usr-stk-2', fullName: 'Dock Receiving Clerk', email: 'receiving@theloops.com', role: 'INVENTORY_CLERK', locationId: 'loc-1' }
        ];
        saveDb();
      }
      return sendJson(res, 200, db.users);
    }

    if (pathname === '/api/users' && req.method === 'POST') {
      const body = await parseJsonBody(req);
      if (!db.users) db.users = [];
      const newUser = {
        id: 'usr-stk-' + Date.now(),
        fullName: body.fullName || 'Stock Staff',
        email: body.email,
        role: body.role || 'INVENTORY_CLERK',
        locationId: body.locationId || 'loc-1'
      };
      db.users.push(newUser);
      saveDb();
      return sendJson(res, 201, newUser);
    }

    // Transfer Stock Between Locations (Fixed & ACID Validated)
    if (pathname === '/api/inventory/transfer' && req.method === 'POST') {
      const body = await parseJsonBody(req);
      const { sku, fromLocationId, toLocationId, qty } = body;

      if (!sku || !fromLocationId || !toLocationId || !qty) {
        return sendJson(res, 400, { error: 'SKU, source location, destination location, and quantity are required' });
      }

      if (fromLocationId === toLocationId) {
        return sendJson(res, 400, { error: 'Source and destination locations must be different' });
      }

      const transferQty = parseInt(qty, 10);
      if (isNaN(transferQty) || transferQty <= 0) {
        return sendJson(res, 400, { error: 'Transfer quantity must be greater than zero' });
      }

      let targetProd, targetVar;
      db.products.forEach(p => {
        p.variants.forEach(v => {
          if (v.sku === sku) { targetProd = p; targetVar = v; }
        });
      });

      if (!targetVar) return sendJson(res, 404, { error: `SKU ${sku} not found` });

      const fromName = db.locations.find(l => l.id === fromLocationId)?.name || 'Source Location';
      const toName = db.locations.find(l => l.id === toLocationId)?.name || 'Destination Location';

      let fromBal = db.stockBalances.find(b => b.sku === sku && b.locationId === fromLocationId);
      if (!fromBal) {
        fromBal = {
          id: `bal-${fromLocationId}-${sku}`,
          sku,
          locationId: fromLocationId,
          onHand: 0,
          reserved: 0,
          damaged: 0,
          rop: targetVar.rop || 5
        };
        db.stockBalances.push(fromBal);
      }

      if (fromBal.onHand < transferQty) {
        return sendJson(res, 400, {
          error: `Insufficient stock at ${fromName}: only ${fromBal.onHand} units available to transfer.`
        });
      }

      let toBal = db.stockBalances.find(b => b.sku === sku && b.locationId === toLocationId);
      if (!toBal) {
        toBal = {
          id: `bal-${toLocationId}-${sku}`,
          sku,
          locationId: toLocationId,
          onHand: 0,
          reserved: 0,
          damaged: 0,
          rop: targetVar.rop || 5
        };
        db.stockBalances.push(toBal);
      }

      // Decrement source location stock and increment destination location stock
      fromBal.onHand -= transferQty;
      toBal.onHand += transferQty;

      // Keep variant global total synced
      const allBalances = db.stockBalances.filter(b => b.sku === sku);
      targetVar.onHand = allBalances.reduce((sum, b) => sum + b.onHand, 0);

      const now = new Date().toISOString().replace('T', ' ').substring(0, 19);
      const transNum = 'TRF-' + Math.floor(1000 + Math.random() * 9000);

      db.ledger.unshift({
        id: 'mov-' + Math.random().toString(36).substring(2, 9),
        timestamp: now,
        type: 'STOCK_TRANSFER_OUT',
        sku: targetVar.sku,
        productCode: targetProd.code,
        productName: targetProd.name,
        variantTitle: targetVar.title,
        locationId: fromLocationId,
        locationName: fromName,
        delta: -transferQty,
        balanceAfter: fromBal.onHand,
        unitCostMinor: targetVar.costMinor,
        referenceNo: transNum,
        staff: 'Logistics Lead',
        reason: `Dispatched ${transferQty} units to ${toName}.`
      });

      db.ledger.unshift({
        id: 'mov-' + Math.random().toString(36).substring(2, 9),
        timestamp: now,
        type: 'STOCK_TRANSFER_IN',
        sku: targetVar.sku,
        productCode: targetProd.code,
        productName: targetProd.name,
        variantTitle: targetVar.title,
        locationId: toLocationId,
        locationName: toName,
        delta: transferQty,
        balanceAfter: toBal.onHand,
        unitCostMinor: targetVar.costMinor,
        referenceNo: transNum,
        staff: 'Logistics Lead',
        reason: `Received ${transferQty} units from ${fromName}.`
      });

      saveDb();

      // Mirror atomic transfer to SQLite stock_balances & stock_ledger
      try {
        const { getDatabase } = require('../../../shared/database/connection');
        const sqlDb = getDatabase();
        const tenant = getTenantContext(req);
        const orgId = tenant.orgId || 'org-6e9ed3cf';
        const uCost = (targetVar.costMinor && targetVar.costMinor > 0) ? targetVar.costMinor : (targetProd.costMinor || 0);

        sqlDb.prepare(`
          INSERT INTO stock_balances (id, organization_id, location_id, sku, on_hand, reserved, damaged, rop, updated_at)
          VALUES (?, ?, ?, ?, ?, 0, 0, 5, datetime('now'))
          ON CONFLICT(id) DO UPDATE SET on_hand = ?, updated_at = datetime('now')
        `).run(`bal-${fromLocationId}-${sku}`, orgId, fromLocationId, sku, fromBal.onHand, fromBal.onHand);

        sqlDb.prepare(`
          INSERT INTO stock_balances (id, organization_id, location_id, sku, on_hand, reserved, damaged, rop, updated_at)
          VALUES (?, ?, ?, ?, ?, 0, 0, 5, datetime('now'))
          ON CONFLICT(id) DO UPDATE SET on_hand = ?, updated_at = datetime('now')
        `).run(`bal-${toLocationId}-${sku}`, orgId, toLocationId, sku, toBal.onHand, toBal.onHand);

        sqlDb.prepare(`
          INSERT INTO stock_ledger (id, organization_id, timestamp, type, sku, product_code, product_name, variant_title, location_id, location_name, delta, balance_after, unit_cost_minor, reference_no, staff, reason)
          VALUES (?, ?, datetime('now'), 'STOCK_TRANSFER_OUT', ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'Logistics Lead', ?)
        `).run('mov-' + crypto.randomUUID().slice(0, 8), orgId, sku, targetProd.code, targetProd.name, targetVar.title, fromLocationId, fromName, -transferQty, fromBal.onHand, uCost, transNum, `Dispatched ${transferQty} units to ${toName}.`);

        sqlDb.prepare(`
          INSERT INTO stock_ledger (id, organization_id, timestamp, type, sku, product_code, product_name, variant_title, location_id, location_name, delta, balance_after, unit_cost_minor, reference_no, staff, reason)
          VALUES (?, ?, datetime('now'), 'STOCK_TRANSFER_IN', ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'Logistics Lead', ?)
        `).run('mov-' + crypto.randomUUID().slice(0, 8), orgId, sku, targetProd.code, targetProd.name, targetVar.title, toLocationId, toName, transferQty, toBal.onHand, uCost, transNum, `Received ${transferQty} units from ${fromName}.`);
      } catch (sqlErr) {
        console.warn('[StockTransfer] SQLite sync error:', sqlErr.message);
      }

      return sendJson(res, 200, {
        success: true,
        transferNumber: transNum,
        sku,
        qty: transferQty,
        fromLocation: { id: fromLocationId, name: fromName, remainingOnHand: fromBal.onHand },
        toLocation: { id: toLocationId, name: toName, newOnHand: toBal.onHand }
      });
    }

    // 5. Sales
    if (pathname === '/api/sales' && req.method === 'GET') {
      const tenant = getTenantContext(req);
      const locs = ensureTenantLocation(db, tenant);
      const tenantLocIds = new Set(locs.map(l => l.id));
      const sales = (db.sales || []).filter(s => (s.organizationId || 'org-loops-001') === tenant.orgId || tenantLocIds.has(s.locationId));
      return sendJson(res, 200, sales);
    }

    if (pathname === '/api/sales' && req.method === 'POST') {
      const body = await parseJsonBody(req);
      const { sku, qty, customerId, method, locationId } = body;

      let targetProd, targetVar;
      db.products.forEach(p => {
        p.variants.forEach(v => {
          if (v.sku === sku) { targetProd = p; targetVar = v; }
        });
      });

      if (!targetVar) return sendJson(res, 404, { error: `SKU ${sku} not found` });
      const saleQty = parseInt(qty, 10);
      if (isNaN(saleQty) || saleQty <= 0) {
        return sendJson(res, 400, { error: 'Sale quantity must be greater than zero' });
      }

      const defaultLoc = db.locations.find(l => l.isDefault)?.id || db.locations[0]?.id || 'loc-01';
      const targetLoc = db.locations.find(l => l.id === locationId);
      const saleLocId = targetLoc ? targetLoc.id : defaultLoc;
      const saleLocName = (targetLoc || db.locations.find(l => l.id === defaultLoc))?.name || 'Store';

      let locBal = db.stockBalances.find(b => b.sku === sku && b.locationId === saleLocId)
        || db.stockBalances.find(b => b.sku === sku);
      if (!locBal || locBal.onHand < saleQty) {
        return sendJson(res, 400, {
          error: `Insufficient stock at ${saleLocName}: only ${locBal ? locBal.onHand : 0} units physically available.`
        });
      }

      locBal.onHand -= saleQty;
      targetVar.onHand -= saleQty;

      const subtotal = targetVar.retailMinor * saleQty;
      const tax = Math.round(subtotal * 0.075);
      const total = subtotal + tax;
      const invNum = 'INV-' + (8800 + db.sales.length + 1);
      const now = new Date().toISOString().replace('T', ' ').substring(0, 19);

      const customerObj = (db.customers || []).find(c => c.id === customerId);
      const customerName = customerObj ? customerObj.name : 'Walk-in Retail Guest';

      const sale = {
        id: 'sale-' + Math.random().toString(36).substring(2, 9),
        saleNumber: invNum,
        customerId: customerId || 'WALK_IN',
        customerName: customerName,
        date: now,
        locationId: saleLocId,
        locationName: saleLocName,
        subtotalMinor: subtotal,
        discountMinor: 0,
        taxMinor: tax,
        totalMinor: total,
        method: method || 'CREDIT_CARD',
        status: 'COMPLETED',
        items: [
          { sku: targetVar.sku, title: targetVar.title, qty: saleQty, priceMinor: targetVar.retailMinor, costMinor: (targetVar.costMinor || targetProd.costMinor || 0) }
        ]
      };

      db.sales.unshift(sale);

      if (customerObj) {
        customerObj.orders += 1;
        customerObj.spendMinor += total;
      }

      const effectiveCost = (targetVar.costMinor && targetVar.costMinor > 0) ? targetVar.costMinor : (targetProd.costMinor || 0);

      db.ledger.unshift({
        id: 'mov-' + Math.random().toString(36).substring(2, 9),
        timestamp: now,
        type: 'SALE_OUT',
        sku: targetVar.sku,
        productCode: targetProd.code,
        productName: targetProd.name,
        variantTitle: targetVar.title,
        locationId: saleLocId,
        locationName: saleLocName,
        delta: -saleQty,
        balanceAfter: locBal.onHand,
        unitCostMinor: effectiveCost,
        referenceNo: invNum,
        staff: 'Register POS',
        reason: `Completed sale to ${customerName} at ${saleLocName}.`
      });

      saveDb();

      // Mirror atomic sale to SQLite stock_balances & stock_ledger
      try {
        const { getDatabase } = require('../../../shared/database/connection');
        const sqlDb = getDatabase();
        const tenant = getTenantContext(req);
        const orgId = tenant.orgId || 'org-6e9ed3cf';

        sqlDb.prepare(`
          INSERT INTO stock_balances (id, organization_id, location_id, sku, on_hand, reserved, damaged, rop, updated_at)
          VALUES (?, ?, ?, ?, ?, 0, 0, 5, datetime('now'))
          ON CONFLICT(id) DO UPDATE SET on_hand = ?, updated_at = datetime('now')
        `).run(`bal-${saleLocId}-${sku}`, orgId, saleLocId, sku, locBal.onHand, locBal.onHand);

        sqlDb.prepare(`
          INSERT INTO stock_ledger (id, organization_id, timestamp, type, sku, product_code, product_name, variant_title, location_id, location_name, delta, balance_after, unit_cost_minor, reference_no, staff, reason)
          VALUES (?, ?, datetime('now'), 'SALE_OUT', ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'Register POS', ?)
        `).run('mov-' + crypto.randomUUID().slice(0, 8), orgId, sku, targetProd.code, targetProd.name, targetVar.title, saleLocId, saleLocName, -saleQty, locBal.onHand, effectiveCost, invNum, `Completed sale to ${customerName} at ${saleLocName}.`);
      } catch (sqlErr) {
        console.warn('[SaleSync] SQLite sync error:', sqlErr.message);
      }

      // Asynchronously trigger auto-sync of sales to Loops Finance General Ledger (Port 3001)
      const tenant = getTenantContext(req);
      requestFinance('/integration/stock/sync-sales', 'POST', null, tenant.token, tenant.orgId).catch(() => {});
      return sendJson(res, 201, sale);
    }

    // Refund Sale
    if (pathname.startsWith('/api/sales/') && pathname.endsWith('/refund') && req.method === 'POST') {
      const parts = pathname.split('/');
      const saleId = parts[3];
      const sale = db.sales.find(s => s.id === saleId);
      if (!sale) return sendJson(res, 404, { error: 'Sale not found' });

      const refundLocId = sale.locationId || db.locations[0]?.id || 'loc-01';
      const refundLocName = db.locations.find(l => l.id === refundLocId)?.name || 'Flagship Storefront';

      sale.items.forEach(item => {
        db.products.forEach(p => {
          p.variants.forEach(v => {
            if (v.sku === item.sku) {
              v.onHand += item.qty;
              let locBal = db.stockBalances.find(b => b.sku === item.sku && b.locationId === refundLocId);
              if (locBal) {
                locBal.onHand += item.qty;
              }
              const now = new Date().toISOString().replace('T', ' ').substring(0, 19);
              db.ledger.unshift({
                id: 'mov-' + Math.random().toString(36).substring(2, 9),
                timestamp: now,
                type: 'CUSTOMER_RETURN',
                sku: v.sku,
                productCode: p.code,
                productName: p.name,
                variantTitle: v.title,
                locationId: refundLocId,
                locationName: refundLocName,
                delta: item.qty,
                balanceAfter: locBal ? locBal.onHand : v.onHand,
                unitCostMinor: v.costMinor,
                referenceNo: 'RET-' + sale.saleNumber,
                staff: 'Store Manager',
                reason: `Customer return restocked into ${refundLocName}.`
              });
            }
          });
        });
      });

      sale.status = 'REFUNDED';
      saveDb();
      return sendJson(res, 200, { success: true, sale });
    }

    // 6. Purchases & Suppliers
    if (pathname === '/api/purchases' && req.method === 'GET') {
      const tenant = getTenantContext(req);
      const locs = ensureTenantLocation(db, tenant);
      const tenantLocIds = new Set(locs.map(l => l.id));
      const pos = (db.purchaseOrders || []).filter(p => (p.organizationId || 'org-loops-001') === tenant.orgId || tenantLocIds.has(p.locationId));
      return sendJson(res, 200, pos);
    }

    if (pathname === '/api/suppliers' && req.method === 'GET') {
      const tenant = getTenantContext(req);
      const sups = tenant.isDefaultOrg
        ? (db.suppliers || [])
        : (db.suppliers || []).filter(s => (s.organizationId || 'org-loops-001') === tenant.orgId);
      return sendJson(res, 200, sups);
    }

    // 7. Customers
    if (pathname === '/api/customers' && req.method === 'GET') {
      const tenant = getTenantContext(req);
      const custs = tenant.isDefaultOrg
        ? (db.customers || [])
        : (db.customers || []).filter(c => (c.organizationId || 'org-loops-001') === tenant.orgId);
      return sendJson(res, 200, custs);
    }

    // 8. Locations
    if (pathname === '/api/locations' && req.method === 'GET') {
      const tenant = getTenantContext(req);
      const locs = ensureTenantLocation(db, tenant);
      return sendJson(res, 200, locs);
    }

    if (pathname === '/api/locations' && req.method === 'POST') {
      const tenant = getTenantContext(req);
      const body = await parseJsonBody(req);
      const name = (body.name || '').trim();
      const code = (body.code || '').trim().toUpperCase();
      const type = (body.type || 'STORE').trim().toUpperCase();
      const address = (body.address || '').trim();

      if (!name || !code) {
        return sendJson(res, 400, { error: 'Location name and code are required' });
      }

      if ((db.locations || []).some(l => l.code === code && (l.organizationId || 'org-loops-001') === tenant.orgId)) {
        return sendJson(res, 400, { error: `Location code ${code} is already in use by another store` });
      }

      const newLoc = {
        id: 'loc-' + Math.random().toString(36).substring(2, 9),
        organizationId: tenant.orgId,
        name,
        code,
        type,
        address,
        isDefault: false
      };

      db.locations.push(newLoc);

      // Initialize zero stock balances for all product variants for this new location
      if (!db.stockBalances) db.stockBalances = [];
      db.products.forEach(p => {
        p.variants.forEach(v => {
          db.stockBalances.push({
            id: `bal-${newLoc.id}-${v.sku}`,
            sku: v.sku,
            locationId: newLoc.id,
            onHand: 0,
            reserved: 0,
            damaged: 0,
            rop: v.rop || 5
          });
        });
      });

      saveDb();

      // Sync across ecosystem to SQLite and POS
      try {
        const { getDatabase } = require('../../../shared/database/connection');
        const dbSync = getDatabase();
        dbSync.prepare(`
          INSERT OR REPLACE INTO locations 
          (id, organization_id, code, name, type, address, is_default, is_active, created_at)
          VALUES (?, ?, ?, ?, ?, ?, 0, 1, ?)
        `).run(newLoc.id, tenant.orgId, newLoc.code, newLoc.name, newLoc.type, newLoc.address, new Date().toISOString());

        const regId = 'reg-' + newLoc.id.replace(/[^a-zA-Z0-9]/g, '').slice(-6) + '-01';
        dbSync.prepare(`
          INSERT OR REPLACE INTO registers
          (id, organization_id, location_id, register_code, name, status, created_at)
          VALUES (?, ?, ?, 'REG-01', ?, 'CLOSED', ?)
        `).run(regId, tenant.orgId, newLoc.id, `${newLoc.name} Register 01`, new Date().toISOString());

        // Sync to POS pos_state.json
        const posStateFile = path.resolve(__dirname, '../../../The_Loop.s_POS/backend/data/pos_state.json');
        if (fs.existsSync(posStateFile)) {
          const posState = JSON.parse(fs.readFileSync(posStateFile, 'utf8'));
          if (!posState.locations) posState.locations = [];
          if (!posState.registers) posState.registers = [];
          if (!posState.locations.some(l => l.id === newLoc.id)) {
            posState.locations.push({
              id: newLoc.id,
              organizationId: tenant.orgId,
              code: newLoc.code,
              name: newLoc.name,
              address: newLoc.address,
              type: newLoc.type,
              isActive: true,
              isDefault: false,
              createdAt: new Date().toISOString()
            });
          }
          if (!posState.registers.some(r => r.locationId === newLoc.id)) {
            posState.registers.push({
              id: regId,
              organizationId: tenant.orgId,
              locationId: newLoc.id,
              storeId: newLoc.id,
              registerCode: 'REG-01',
              name: `${newLoc.name} Register 01`,
              status: 'CLOSED',
              currentShiftId: null,
              currentCashierId: null
            });
          }
          fs.writeFileSync(posStateFile, JSON.stringify(posState, null, 2));
        }
      } catch (e) {
        console.warn('Cross-app location sync error:', e.message);
      }

      return sendJson(res, 201, newLoc);
    }

    if (pathname.startsWith('/api/locations/') && req.method === 'DELETE') {
      const locationId = pathname.split('/')[3];
      const locationIndex = db.locations.findIndex(l => l.id === locationId);
      if (locationIndex === -1) {
        return sendJson(res, 404, { error: 'Location not found' });
      }

      const targetLoc = db.locations[locationIndex];
      if (targetLoc.isDefault) {
        return sendJson(res, 400, { error: 'Cannot delete the primary default HQ store' });
      }

      if (db.locations.length <= 1) {
        return sendJson(res, 400, { error: 'At least one location must remain in the retail system' });
      }

      // Check remaining physical inventory on hand at this location
      const locBals = (db.stockBalances || []).filter(b => b.locationId === locationId && (b.onHand || 0) > 0);
      const totalUnitsOnHand = locBals.reduce((sum, b) => sum + (b.onHand || 0), 0);

      const transferToLocationId = url.searchParams.get('transferToLocationId');

      if (totalUnitsOnHand > 0) {
        if (!transferToLocationId) {
          return sendJson(res, 400, {
            error: `Cannot delete store "${targetLoc.name}": it still has ${totalUnitsOnHand} physical units in stock across ${locBals.length} SKUs. Every product must be out or transferred to another store before deletion.`,
            totalUnitsOnHand,
            remainingSkus: locBals.length
          });
        }

        const destLoc = db.locations.find(l => l.id === transferToLocationId);
        if (!destLoc || destLoc.id === locationId) {
          return sendJson(res, 400, { error: 'Invalid destination store selected for stock evacuation transfer' });
        }

        const now = new Date().toISOString().replace('T', ' ').substring(0, 19);
        const transNum = 'TRF-EVAC-' + Math.floor(1000 + Math.random() * 9000);

        // Evacuate all remaining stock to the destination location
        locBals.forEach(b => {
          const qty = b.onHand;
          let destBal = db.stockBalances.find(item => item.sku === b.sku && item.locationId === transferToLocationId);
          if (!destBal) {
            destBal = {
              id: `bal-${transferToLocationId}-${b.sku}`,
              sku: b.sku,
              locationId: transferToLocationId,
              onHand: 0,
              reserved: 0,
              damaged: 0,
              rop: b.rop || 5
            };
            db.stockBalances.push(destBal);
          }

          b.onHand = 0;
          destBal.onHand += qty;

          let targetProd, targetVar;
          db.products.forEach(p => {
            p.variants.forEach(v => {
              if (v.sku === b.sku) { targetProd = p; targetVar = v; }
            });
          });

          // Append audit ledger records
          db.ledger.unshift({
            id: 'mov-' + Math.random().toString(36).substring(2, 9),
            timestamp: now,
            type: 'STOCK_TRANSFER_OUT',
            sku: b.sku,
            productCode: targetProd?.code || '',
            productName: targetProd?.name || '',
            variantTitle: targetVar?.title || '',
            locationId: locationId,
            locationName: targetLoc.name,
            delta: -qty,
            balanceAfter: 0,
            unitCostMinor: targetVar?.costMinor || 0,
            referenceNo: transNum,
            staff: 'Store Decommission System',
            reason: `Store ${targetLoc.name} decommissioned. Remaining stock evacuated to ${destLoc.name}.`
          });

          db.ledger.unshift({
            id: 'mov-' + Math.random().toString(36).substring(2, 9),
            timestamp: now,
            type: 'STOCK_TRANSFER_IN',
            sku: b.sku,
            productCode: targetProd?.code || '',
            productName: targetProd?.name || '',
            variantTitle: targetVar?.title || '',
            locationId: transferToLocationId,
            locationName: destLoc.name,
            delta: qty,
            balanceAfter: destBal.onHand,
            unitCostMinor: targetVar?.costMinor || 0,
            referenceNo: transNum,
            staff: 'Store Decommission System',
            reason: `Received evacuated stock from decommissioned store ${targetLoc.name}.`
          });
        });
      }

      // Remove location and remove its zero-balance records
      db.locations.splice(locationIndex, 1);
      db.stockBalances = (db.stockBalances || []).filter(b => b.locationId !== locationId);

      saveDb();
      return sendJson(res, 200, {
        success: true,
        message: `Store "${targetLoc.name}" (${targetLoc.code}) deleted successfully.`,
        evacuatedUnits: totalUnitsOnHand,
        destinationStore: transferToLocationId ? db.locations.find(l => l.id === transferToLocationId)?.name : null
      });
    }

    // 9. Settings
    if (pathname === '/api/settings' && req.method === 'GET') {
      const tenant = getTenantContext(req);
      const locs = ensureTenantLocation(db, tenant);
      if (!tenant.isDefaultOrg && tenant.org) {
        return sendJson(res, 200, {
          settings: {
            businessName: tenant.org.name,
            storeName: locs[0]?.name || `${tenant.org.name} Flagship`,
            currency: tenant.org.currency || 'USD',
            exchangeRate: tenant.org.exchangeRate || 4000,
            taxRate: tenant.org.taxRate || 0.1,
            isOnboarded: true
          },
          attributes: db.attributes || [],
          categories: db.categories || [],
          isOnboarded: true,
          locations: locs
        });
      }
      return sendJson(res, 200, {
        settings: db.settings,
        attributes: db.attributes,
        categories: db.categories,
        isOnboarded: !!db.settings?.isOnboarded && (db.locations || []).length > 0
      });
    }

    // Reset DB to clean scratch state
    if (pathname === '/api/reset' && req.method === 'POST') {
      const reset = resetDb();
      return sendJson(res, 200, { success: true, message: 'Database reset to clean scratch state' });
    }

    // Static Asset Serving from frontend/dist (Production Build)
    if (!pathname.startsWith('/api')) {
      const fs = require('fs');
      const path = require('path');
      const DIST_DIR = path.join(__dirname, '..', '..', 'frontend', 'dist');
      let filePath = path.join(DIST_DIR, pathname === '/' ? 'index.html' : pathname);

      if (fs.existsSync(filePath) && fs.statSync(filePath).isFile()) {
        const ext = path.extname(filePath).toLowerCase();
        const mimeTypes = {
          '.html': 'text/html',
          '.js': 'text/javascript',
          '.css': 'text/css',
          '.json': 'application/json',
          '.png': 'image/png',
          '.jpg': 'image/jpeg',
          '.svg': 'image/svg+xml'
        };
        res.writeHead(200, { 'Content-Type': mimeTypes[ext] || 'application/octet-stream' });
        return fs.createReadStream(filePath).pipe(res);
      } else {
        // Fallback to dist/index.html for client-side routing
        const indexHtmlPath = path.join(DIST_DIR, 'index.html');
        if (fs.existsSync(indexHtmlPath)) {
          res.writeHead(200, { 'Content-Type': 'text/html' });
          return fs.createReadStream(indexHtmlPath).pipe(res);
        }
      }
    }

    // Not found
    return sendJson(res, 404, { error: 'Route not found' });
  } catch (err) {
    console.error('API Error:', err);
    return sendJson(res, 500, { error: 'Internal Server Error', details: err.message });
  }
});

server.listen(PORT, () => {
  console.log(`\n======================================================`);
  console.log(`  ∞ THE LOOPS BACKEND — REST API Running`);
  console.log(`  Live at: http://localhost:${PORT}`);
  console.log(`  Endpoints: /api/dashboard, /api/products, /api/inventory`);
  console.log(`======================================================\n`);
});
