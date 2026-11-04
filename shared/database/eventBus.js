// ============================================================================
// THE LOOPS UNIVERSAL RETAIL SUITE — TRANSACTIONAL INTEGRATION EVENT BUS
// Provides at-least-once guaranteed delivery, idempotency key deduplication,
// and automatic inter-app workflow synchronization between POS, Stock, and Finance.
// ============================================================================

const crypto = require('crypto');
const { getDatabase } = require('./connection');

/**
 * Publish an integration event within the caller's transaction or standalone
 */
function publishIntegrationEvent({
  organizationId,
  sourceApp,
  sourceId,
  destApp,
  eventType,
  idempotencyKey,
  payload
}) {
  const db = getDatabase();
  const id = `evt-${Date.now()}-${crypto.randomBytes(4).toString('hex')}`;
  const key = idempotencyKey || `${sourceApp}-${eventType}-${sourceId}`;
  const now = new Date().toISOString();

  const stmt = db.prepare(`
    INSERT INTO integration_events (
      id, organization_id, source_app, source_id, dest_app, event_type,
      idempotency_key, payload_json, status, retry_count, created_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'PENDING', 0, ?)
    ON CONFLICT(idempotency_key) DO NOTHING
  `);

  stmt.run(
    id,
    organizationId,
    sourceApp,
    sourceId,
    destApp,
    eventType,
    key,
    JSON.stringify(payload || {}),
    now
  );

  return { id, idempotencyKey: key };
}

/**
 * Process pending integration events with transactional boundary and idempotency
 */
async function processPendingEvents() {
  const db = getDatabase();
  const pendingStmt = db.prepare(`
    SELECT * FROM integration_events
    WHERE status = 'PENDING'
    ORDER BY created_at ASC
    LIMIT 50
  `);

  const events = pendingStmt.all();
  if (!events || events.length === 0) return { processed: 0 };

  let processedCount = 0;

  for (const event of events) {
    const payload = JSON.parse(event.payload_json || '{}');
    const orgId = event.organization_id;

    try {
      db.exec('BEGIN TRANSACTION;');

      if (event.event_type === 'SALE_COMPLETED' || event.event_type === 'POS_SALE_COMPLETED') {
        // 1. Synchronize to Stock Management: Deduct inventory balance & record movement
        const items = payload.items || [];
        const locationId = payload.storeId || payload.locationId || 'loc-1';

        for (const item of items) {
          const sku = item.sku || item.variantSku;
          const qty = Number(item.quantity || item.qty || 1);
          if (!sku) continue;

          // Deduct from stock_balances
          const updateBal = db.prepare(`
            UPDATE stock_balances
            SET on_hand = MAX(0, on_hand - ?),
                updated_at = ?
            WHERE organization_id = ? AND location_id = ? AND sku = ?
          `);
          const res = updateBal.run(qty, new Date().toISOString(), orgId, locationId, sku);

          // If no balance row existed, create with 0 on hand
          if (res.changes === 0) {
            db.prepare(`
              INSERT INTO stock_balances (
                id, organization_id, location_id, sku, on_hand, reserved, damaged, rop, updated_at
              ) VALUES (?, ?, ?, ?, 0, 0, 0, 5, ?)
              ON CONFLICT(location_id, sku) DO NOTHING
            `).run(`bal-${locationId}-${sku}`, orgId, locationId, sku, new Date().toISOString());
          }

          // Record stock_ledger entry
          db.prepare(`
            INSERT INTO stock_ledger (
              id, organization_id, location_id, sku, type, qty_change, unit_cost_minor,
              reference_type, reference_id, notes, created_at
            ) VALUES (?, ?, ?, ?, 'SALE_OUT', ?, ?, 'POS_ORDER', ?, ?, ?)
          `).run(
            `mov-${Date.now()}-${crypto.randomBytes(3).toString('hex')}`,
            orgId,
            locationId,
            sku,
            -qty,
            Math.round(Number(item.costMinor || item.unitCost || 0)),
            event.source_id,
            `POS checkout receipt #${payload.receiptNumber || payload.orderNumber || ''}`,
            new Date().toISOString()
          );
        }

        // 2. Synchronize to Finance / Account System: Auto-post sales journal entry & invoice
        const totalMinor = Number(payload.totalMinor || Math.round((payload.total || payload.totalAmount || 0) * 100));
        const costMinor = Math.round(Number(payload.costMinor || totalMinor * 0.45)); // standard landed COGS or actual

        if (totalMinor > 0) {
          // Record sales invoice in invoices table
          db.prepare(`
            INSERT INTO invoices (
              id, organization_id, invoice_number, customer_id, customer_name,
              amount_minor, paid_amount_minor, status, issue_date, due_date, created_at
            ) VALUES (?, ?, ?, ?, ?, ?, ?, 'PAID', ?, ?, ?)
            ON CONFLICT(organization_id, invoice_number) DO NOTHING
          `).run(
            `inv-${event.source_id}`,
            orgId,
            `INV-${payload.receiptNumber || payload.orderNumber || event.source_id.slice(-6)}`,
            payload.customerId || null,
            payload.customerName || 'Walk-in Customer',
            totalMinor,
            totalMinor,
            payload.createdAt || new Date().toISOString(),
            payload.createdAt || new Date().toISOString(),
            new Date().toISOString()
          );

          // Post balanced journal entry: Debit Cash 1010, Credit Sales 4010, Debit COGS 5010, Credit Inventory 1200
          const journalId = `je-pos-${event.source_id}`;
          const lines = [
            { accountCode: '1010', debitMinor: totalMinor, creditMinor: 0, desc: 'Cash from POS sale' },
            { accountCode: '4010', debitMinor: 0, creditMinor: totalMinor, desc: 'Retail sales revenue' }
          ];

          if (costMinor > 0) {
            lines.push({ accountCode: '5010', debitMinor: costMinor, creditMinor: 0, desc: 'Landed cost of goods sold' });
            lines.push({ accountCode: '1200', debitMinor: 0, creditMinor: costMinor, desc: 'Inventory asset reduction' });
          }

          db.prepare(`
            INSERT INTO journal_entries (
              id, organization_id, entry_number, date, memo, total_debit_minor, total_credit_minor,
              status, lines_json, source_type, source_id, created_at
            ) VALUES (?, ?, ?, ?, ?, ?, ?, 'POSTED', ?, 'POS_SALE', ?, ?)
            ON CONFLICT(id) DO NOTHING
          `).run(
            journalId,
            orgId,
            `JE-POS-${event.source_id.slice(-6)}`,
            payload.createdAt || new Date().toISOString().slice(0, 10),
            `Automated sales revenue posting for POS order #${payload.receiptNumber || payload.orderNumber}`,
            totalMinor + costMinor,
            totalMinor + costMinor,
            JSON.stringify(lines),
            event.source_id,
            new Date().toISOString()
          );
        }
      } else if (event.event_type === 'GOODS_RECEIVED' || event.event_type === 'PURCHASE_RECEIPT_FINALIZED') {
        // Stock Inflow from Finance Shipment
        const items = payload.items || [];
        const locationId = payload.locationId || payload.destinationWarehouseId || 'loc-1';

        for (const item of items) {
          const sku = item.sku;
          const qty = Number(item.qty || item.quantity || 0);
          if (!sku || qty <= 0) continue;

          // Increase stock_balances
          db.prepare(`
            INSERT INTO stock_balances (
              id, organization_id, location_id, sku, on_hand, reserved, damaged, rop, updated_at
            ) VALUES (?, ?, ?, ?, ?, 0, 0, 5, ?)
            ON CONFLICT(location_id, sku) DO UPDATE SET
              on_hand = on_hand + excluded.on_hand,
              updated_at = excluded.updated_at
          `).run(
            `bal-${locationId}-${sku}`,
            orgId,
            locationId,
            sku,
            qty,
            new Date().toISOString()
          );

          // Stock Ledger Movement
          db.prepare(`
            INSERT INTO stock_ledger (
              id, organization_id, location_id, sku, type, qty_change, unit_cost_minor,
              reference_type, reference_id, notes, created_at
            ) VALUES (?, ?, ?, ?, 'RECEIVE_STOCK', ?, ?, 'SHIPMENT', ?, ?, ?)
          `).run(
            `mov-${Date.now()}-${crypto.randomBytes(3).toString('hex')}`,
            orgId,
            locationId,
            sku,
            qty,
            Math.round(Number(item.finalUnitLandedCost || item.costMinor || 0) * 100),
            event.source_id,
            `Goods received from shipment #${payload.shipmentCode || payload.shipmentNumber}`,
            new Date().toISOString()
          );
        }
      }

      // Mark event as PROCESSED
      db.prepare(`
        UPDATE integration_events
        SET status = 'PROCESSED',
            processed_at = ?,
            error_message = NULL
        WHERE id = ?
      `).run(new Date().toISOString(), event.id);

      db.exec('COMMIT;');
      processedCount++;
    } catch (err) {
      db.exec('ROLLBACK;');
      console.error(`[EventBus] Error processing event ${event.id}:`, err);

      // Increment retry_count and log error
      db.prepare(`
        UPDATE integration_events
        SET retry_count = retry_count + 1,
            status = CASE WHEN retry_count >= 5 THEN 'FAILED' ELSE 'PENDING' END,
            error_message = ?
        WHERE id = ?
      `).run(err.message, event.id);
    }
  }

  return { processed: processedCount };
}

module.exports = {
  publishIntegrationEvent,
  processPendingEvents
};

