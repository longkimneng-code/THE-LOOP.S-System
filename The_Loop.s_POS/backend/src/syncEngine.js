// The Loop.s POS — Transactional Outbox Relay & Triad Event Synchronization
const http = require('http');
const { loadDb, saveDb } = require('./db');

const STOCK_API_URL = process.env.STOCK_API_URL || 'http://localhost:3000/api';
const FINANCE_API_URL = process.env.FINANCE_API_URL || 'http://localhost:3001/api';

function httpRequest(urlStr, method = 'GET', data = null, timeoutMs = 2500) {
  return new Promise((resolve) => {
    try {
      const url = new URL(urlStr);
      const payload = data ? JSON.stringify(data) : null;
      const options = {
        hostname: url.hostname,
        port: url.port,
        path: url.pathname + url.search,
        method,
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json'
        },
        timeout: timeoutMs
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
            resolve({ ok: res.statusCode >= 200 && res.statusCode < 300, status: res.statusCode, data: parsed });
          } catch (e) {
            resolve({ ok: false, status: res.statusCode, error: 'JSON parse error' });
          }
        });
      });

      req.on('error', (err) => resolve({ ok: false, status: 0, error: err.message }));
      req.on('timeout', () => {
        req.destroy();
        resolve({ ok: false, status: 0, error: 'Request timeout' });
      });

      if (payload) req.write(payload);
      req.end();
    } catch (err) {
      resolve({ ok: false, status: 0, error: err.message });
    }
  });
}

// 1. Check Triad Network Health
async function checkTriadHealth() {
  const stockRes = await httpRequest(`${STOCK_API_URL}/health`);
  const financeRes = await httpRequest(`${FINANCE_API_URL}/health`);
  const db = loadDb();

  const pendingEvents = db.outbox.filter(e => e.status === 'PENDING').length;
  const publishedEvents = db.outbox.filter(e => e.status === 'PUBLISHED').length;

  return {
    pos: { online: true, port: 3002 },
    stock: {
      online: stockRes.ok,
      port: 3000,
      url: STOCK_API_URL,
      message: stockRes.ok ? 'Connected' : (stockRes.error || 'Offline')
    },
    finance: {
      online: financeRes.ok,
      port: 3001,
      url: FINANCE_API_URL,
      message: financeRes.ok ? 'Connected' : (financeRes.error || 'Offline')
    },
    syncStatus: {
      pendingOutboxCount: pendingEvents,
      publishedCount: publishedEvents,
      totalOrders: db.orders.length
    }
  };
}

// 2. Fetch Latest Products from Stock Management
async function syncCatalogFromStock() {
  const res = await httpRequest(`${STOCK_API_URL}/products`);
  if (!res.ok) {
    return { ok: false, error: 'Could not reach Stock Management on port 3000' };
  }

  const remoteProducts = Array.isArray(res.data) ? res.data : [];
  if (remoteProducts.length === 0) {
    return { ok: true, message: 'No new products returned', updatedCount: 0 };
  }

  const db = loadDb();
  let updatedCount = 0;

  remoteProducts.forEach(remote => {
    const existing = db.products.find(p => p.id === remote.id || p.code === remote.code);
    if (existing) {
      existing.name = remote.name || existing.name;
      existing.category = remote.category || existing.category;
      existing.imageUrl = remote.imageUrl || existing.imageUrl || '';
      existing.image = remote.imageUrl || existing.image || '📦';
      existing.basePrice = remote.retailMinor ? remote.retailMinor / 100 : (remote.basePrice || existing.basePrice || 25.00);
      if (remote.variants && remote.variants.length > 0) {
        existing.variants = remote.variants.map(v => ({
          sku: v.sku,
          title: v.title || v.sku,
          price: (v.retailMinor ? v.retailMinor / 100 : v.price) || existing.basePrice,
          barcode: v.barcode || v.sku,
          onHand: v.onHand || 0,
          reserved: v.reserved || 0,
          available: (v.onHand || 0) - (v.reserved || 0)
        }));
      }
      updatedCount++;
    } else {
      const bPrice = remote.retailMinor ? remote.retailMinor / 100 : (remote.basePrice || 25.00);
      db.products.push({
        id: remote.id,
        code: remote.code || `PROD-${Date.now().toString().slice(-4)}`,
        name: remote.name,
        category: remote.category || 'General',
        categorySlug: (remote.category || 'general').toLowerCase().replace(/\s+/g, '-'),
        basePrice: bPrice,
        barcode: remote.code,
        image: remote.imageUrl || '📦',
        imageUrl: remote.imageUrl || '',
        variants: (remote.variants || []).map(v => ({
          sku: v.sku,
          title: v.title || v.sku,
          price: (v.retailMinor ? v.retailMinor / 100 : v.price) || bPrice,
          barcode: v.barcode || v.sku,
          onHand: v.onHand || 0,
          reserved: v.reserved || 0,
          available: (v.onHand || 0) - (v.reserved || 0)
        }))
      });
      updatedCount++;
    }
  });

  saveDb();
  return { ok: true, updatedCount, totalProducts: db.products.length };
}

// 3. Process Transactional Outbox Relay
async function processOutboxRelay() {
  const db = loadDb();
  const pendingEvents = db.outbox.filter(e => e.status === 'PENDING');

  if (pendingEvents.length === 0) {
    return { processedCount: 0, pendingCount: 0 };
  }

  let processedCount = 0;

  for (const event of pendingEvents) {
    try {
      event.attemptCount = (event.attemptCount || 0) + 1;

      if (event.attemptCount > 3) {
        event.status = 'DEAD_LETTER';
        event.lastError = event.lastError || 'Max retries reached (3 attempts)';
        processedCount++;
        continue;
      }

      if (event.eventType === 'ORDER_COMPLETED') {
        const payload = event.payload;

        // 3a. Dispatches to Stock Management (/api/sales)
        let stockOk = true;
        for (const item of payload.items) {
          const stockRes = await httpRequest(`${STOCK_API_URL}/sales`, 'POST', {
            sku: item.sku,
            qty: item.quantity,
            customerId: payload.customerName || 'WALK_IN',
            method: payload.payments?.[0]?.method || 'CASH',
            locationId: event.locationId || 'loc-1'
          });
          if (!stockRes.ok && stockRes.status !== 404) {
            stockOk = false;
          }
        }

        // 3b. Dispatches to Loops Finance (/api/invoices)
        const financeRes = await httpRequest(`${FINANCE_API_URL}/invoices`, 'POST', {
          invoiceNumber: payload.orderNumber,
          customerName: payload.customerName || 'The Loops POS Customer',
          invoiceDate: payload.timestamp ? payload.timestamp.split('T')[0] : new Date().toISOString().split('T')[0],
          subtotal: payload.subtotal,
          discountAmount: payload.discountTotal || 0,
          landedCogsAmount: Number((payload.totalAmount * 0.40).toFixed(2)), // 40% default landed COGS estimate
          channel: 'RETAIL_POS',
          isPaid: true,
          notes: `POS Register ${event.registerId} Sale (#${payload.orderNumber})`
        });

        // Mark as published if either dispatched successfully or acknowledged
        if (financeRes.ok || stockOk) {
          event.status = 'PUBLISHED';
          event.publishedAt = new Date().toISOString();
          processedCount++;
        } else {
          event.lastError = `Stock: ${stockOk ? 'OK' : 'Error'}, Finance: ${financeRes.error || 'Error'}`;
        }

      } else if (event.eventType === 'SHIFT_CLOSED') {
        // Dispatches Z-Report reconciliation to Loops Finance
        const zReport = event.payload;
        if (zReport.cashOverShort !== 0) {
          // Post Cash Over and Short entry
          await httpRequest(`${FINANCE_API_URL}/expenses`, 'POST', {
            category: 'Operating Expense',
            accountCode: '6095',
            description: `POS Shift Close Cash ${zReport.cashOverShort > 0 ? 'Over' : 'Short'} (${zReport.registerCode})`,
            amount: Math.abs(zReport.cashOverShort),
            paymentMethod: 'CASH',
            status: 'PAID'
          });
        }
        event.status = 'PUBLISHED';
        event.publishedAt = new Date().toISOString();
        processedCount++;

      } else if (event.eventType === 'USER_CREATED') {
        // User sync broadcast
        event.status = 'PUBLISHED';
        event.publishedAt = new Date().toISOString();
        processedCount++;

      } else {
        event.status = 'PUBLISHED';
        event.publishedAt = new Date().toISOString();
        processedCount++;
      }
    } catch (err) {
      event.lastError = err.message;
    }
  }

  saveDb();
  return {
    processedCount,
    remainingPending: db.outbox.filter(e => e.status === 'PENDING').length
  };
}

module.exports = {
  checkTriadHealth,
  syncCatalogFromStock,
  processOutboxRelay
};

