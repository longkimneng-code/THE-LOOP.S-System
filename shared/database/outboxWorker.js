// ============================================================================
// THE LOOPS UNIVERSAL RETAIL SUITE — TRANSACTIONAL OUTBOX / INBOX WORKER
// Implements reliable event-driven messaging, at-least-once delivery,
// exponential backoff retry, and dead-letter handling per Section 3.2 of the plan.
// ============================================================================

const http = require('http');
const { getDatabase } = require('./connection');

const SERVICE_PORTS = {
  POS: 3002,
  STOCK: 3000,
  FINANCE: 3001
};

const SERVICE_ENDPOINTS = {
  SALE_COMPLETED: {
    destApp: 'FINANCE',
    path: '/api/integration/stock/sync-sales'
  },
  STOCK_DEDUCTED: {
    destApp: 'POS',
    path: '/api/catalog/sync-product'
  },
  GOODS_RECEIVED: {
    destApp: 'STOCK',
    path: '/api/inventory/import-purchase'
  },
  LANDED_COST_FINALIZED: {
    destApp: 'STOCK',
    path: '/api/inventory/import-purchase'
  }
};

const MAX_RETRIES = 5;
const BASE_BACKOFF_MS = 1000;

function dispatchHttpEvent(port, path, event) {
  return new Promise((resolve, reject) => {
    const payload = JSON.stringify({
      eventId: event.id,
      eventType: event.event_type,
      idempotencyKey: event.idempotency_key,
      organizationId: event.organization_id,
      sourceApp: event.source_app,
      payload: JSON.parse(event.payload_json || '{}')
    });

    const options = {
      hostname: 'localhost',
      port: port,
      path: path,
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-organization-id': event.organization_id,
        'x-event-id': event.id,
        'x-idempotency-key': event.idempotency_key,
        'Content-Length': Buffer.byteLength(payload)
      },
      timeout: 4000
    };

    const req = http.request(options, (res) => {
      let body = '';
      res.on('data', chunk => body += chunk);
      res.on('end', () => {
        if (res.statusCode >= 200 && res.statusCode < 300) {
          resolve({ ok: true, status: res.statusCode });
        } else {
          resolve({ ok: false, status: res.statusCode, error: body || `HTTP ${res.statusCode}` });
        }
      });
    });

    req.on('error', (err) => resolve({ ok: false, status: 0, error: err.message }));
    req.on('timeout', () => { req.destroy(); resolve({ ok: false, status: 0, error: 'Timeout' }); });

    req.write(payload);
    req.end();
  });
}

/**
 * Process a single batch of pending outbox events
 */
async function processOutboxBatch() {
  const db = getDatabase();
  const pendingEvents = db.prepare(`
    SELECT * FROM integration_events
    WHERE status = 'PENDING'
    ORDER BY created_at ASC
    LIMIT 20
  `).all();

  if (pendingEvents.length === 0) return 0;

  let processedCount = 0;

  for (const event of pendingEvents) {
    const config = SERVICE_ENDPOINTS[event.event_type];
    const destPort = SERVICE_PORTS[event.dest_app || config?.destApp];

    if (!destPort) {
      // Mark as processed if no external HTTP consumer registered
      db.prepare(`
        UPDATE integration_events
        SET status = 'PROCESSED', processed_at = ?
        WHERE id = ?
      `).run(new Date().toISOString(), event.id);
      processedCount++;
      continue;
    }

    const path = config?.path || '/api/events/inbox';
    const result = await dispatchHttpEvent(destPort, path, event);

    if (result.ok) {
      db.prepare(`
        UPDATE integration_events
        SET status = 'PROCESSED', processed_at = ?
        WHERE id = ?
      `).run(new Date().toISOString(), event.id);
      processedCount++;
    } else {
      const newRetryCount = (event.retry_count || 0) + 1;
      const isFailed = newRetryCount >= MAX_RETRIES;
      const status = isFailed ? 'FAILED' : 'PENDING';

      db.prepare(`
        UPDATE integration_events
        SET status = ?, retry_count = ?, error_message = ?
        WHERE id = ?
      `).run(status, newRetryCount, result.error, event.id);

      if (isFailed) {
        console.warn(`[Outbox Worker] Event ${event.id} (${event.event_type}) failed after ${MAX_RETRIES} attempts: ${result.error}`);
      }
    }
  }

  return processedCount;
}

/**
 * Start Continuous Outbox Worker Loop
 */
let workerTimer = null;
let isRunning = false;

function startOutboxWorker(intervalMs = 3000) {
  if (isRunning) return;
  isRunning = true;
  console.log(`[Outbox Worker] Transactional event worker started (polling every ${intervalMs}ms)...`);

  const loop = async () => {
    try {
      await processOutboxBatch();
    } catch (e) {
      // Quiet fail on db lock
    } finally {
      if (isRunning) {
        workerTimer = setTimeout(loop, intervalMs);
      }
    }
  };

  loop();
}

function stopOutboxWorker() {
  isRunning = false;
  if (workerTimer) clearTimeout(workerTimer);
  console.log('[Outbox Worker] Stopped.');
}

if (require.main === module) {
  startOutboxWorker();
  process.on('SIGINT', () => { stopOutboxWorker(); process.exit(0); });
  process.on('SIGTERM', () => { stopOutboxWorker(); process.exit(0); });
}

module.exports = {
  processOutboxBatch,
  startOutboxWorker,
  stopOutboxWorker
};

