// THE LOOPS UNIVERSAL RETAIL SUITE - INVENTORY & STOCK SYNCHRONIZATION BRIDGE
// Automatically provisions products, barcodes, SKUs, inventory balances, and ledger entries
// across Stock Loops (Port 3000), POS (Port 3002), and the SQLite Enterprise Database.

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { getDatabase } = require('../database/connection');

const ROOT_DIR = path.resolve(__dirname, '..', '..');
const STOCK_STATE_FILE = path.join(ROOT_DIR, 'Stock_management_loops', 'backend', 'data', 'store.json');
const POS_STATE_FILE = path.join(ROOT_DIR, 'The_Loop.s_POS', 'backend', 'data', 'pos_state.json');

/**
 * Generate a clean, branded SKU code: e.g. BV-AUD-4821 or BV-SLK-1092
 */
function generateAutoSku(category = '', name = '') {
  const seed = (category || name || 'GEN').replace(/[^a-zA-Z0-9]/g, '').slice(0, 3).toUpperCase() || 'ITM';
  const rand = Math.floor(1000 + Math.random() * 9000);
  return `BV-${seed}-${rand}`;
}

/**
 * Generate a valid 12-digit retail barcode string: 880XXXXXXXXX
 */
function generateAutoBarcode() {
  const rand9 = Math.floor(100000000 + Math.random() * 900000000);
  return `880${rand9}`;
}

/**
 * Synchronize imported/received items directly into Stock Management & POS
 */
function pushImportToStockAndPos({
  importRef,
  supplierName = 'Import Supplier',
  purchaseDate = null,
  receivedDate = null,
  items = [],
  organizationId = 'org-6e9ed3cf',
  locationId = null,
  notes = '',
  performedByName = 'Purchasing System'
}) {
  const dbSql = getDatabase();
  const nowIso = new Date().toISOString();
  const dateStr = nowIso.replace('T', ' ').substring(0, 19);

  // 1. Read Stock Management store.json
  let stockData = { products: [], stockBalances: [], ledger: [], receivedPurchases: [], categories: [], locations: [] };
  if (fs.existsSync(STOCK_STATE_FILE)) {
    try {
      stockData = JSON.parse(fs.readFileSync(STOCK_STATE_FILE, 'utf8'));
    } catch (e) {
      console.warn('[StockSyncBridge] Could not parse stock store.json:', e.message);
    }
  }

  // 2. Read POS pos_state.json
  let posData = { products: [], inventory: [], locations: [], organization: {} };
  if (fs.existsSync(POS_STATE_FILE)) {
    try {
      posData = JSON.parse(fs.readFileSync(POS_STATE_FILE, 'utf8'));
    } catch (e) {
      console.warn('[StockSyncBridge] Could not parse pos_state.json:', e.message);
    }
  }

  const targetOrg = organizationId || stockData.organizationId || posData.organization?.id || 'org-6e9ed3cf';
  
  // Resolve default location
  let targetLocId = locationId;
  if (!targetLocId) {
    const defaultStockLoc = (stockData.locations || []).find(l => l.isDefault && (l.organizationId === targetOrg || !l.organizationId));
    targetLocId = defaultStockLoc ? defaultStockLoc.id : ((stockData.locations || [])[0]?.id || 'loc-01');
  }
  const locName = (stockData.locations || []).find(l => l.id === targetLocId)?.name || 'BeyondVER Main Branch';

  if (!stockData.products) stockData.products = [];
  if (!stockData.stockBalances) stockData.stockBalances = [];
  if (!stockData.ledger) stockData.ledger = [];
  if (!stockData.receivedPurchases) stockData.receivedPurchases = [];
  if (!stockData.categories) stockData.categories = [];
  if (!posData.products) posData.products = [];
  if (!posData.inventory) posData.inventory = [];

  const processedItems = [];

  for (let idx = 0; idx < items.length; idx++) {
    const raw = items[idx];
    const name = (raw.productName || raw.name || `Imported Item ${idx + 1}`).trim();
    const category = (raw.category || 'General').trim();
    const sku = (raw.skuCode || raw.sku || generateAutoSku(category, name)).trim();
    const barcode = (raw.barcode || generateAutoBarcode()).trim();
    const qty = Math.max(1, parseInt(raw.quantity, 10) || 1);
    
    // Landed cost or buy price
    const unitLanded = Number(raw.unitLandedCost) || Number(raw.unitCost) || Number(raw.unitBasePrice) || 0.0;
    const costMinor = Math.round(unitLanded * 100);
    
    // Retail price: either targetRetailPrice or 1.5x - 2.0x landed cost
    let retailPrice = Number(raw.targetRetailPrice) || Number(raw.retailPrice) || 0.0;
    if (retailPrice <= 0) {
      retailPrice = unitLanded > 0 ? Math.round((unitLanded * 1.5) * 100) / 100 : 25.00;
    }
    const retailMinor = Math.round(retailPrice * 100);
    const imageUrl = raw.imageUrl || raw.image || '';

    // A. Ensure Category in Stock Management
    let catObj = stockData.categories.find(c => c.name && c.name.toLowerCase() === category.toLowerCase() && (c.organizationId === targetOrg || !c.organizationId));
    if (!catObj) {
      catObj = {
        id: 'cat-' + crypto.randomUUID().slice(0, 8),
        organizationId: targetOrg,
        name: category,
        slug: category.toLowerCase().replace(/[^a-z0-9]/g, '-')
      };
      stockData.categories.push(catObj);
    }

    // B. Update / Insert in Stock Management products
    let stockProd = stockData.products.find(p => 
      (p.organizationId === targetOrg || !p.organizationId) && 
      (p.code === sku || (p.variants || []).some(v => v.sku === sku))
    );

    if (stockProd) {
      stockProd.category = category;
      stockProd.costMinor = costMinor;
      stockProd.retailMinor = retailMinor;
      if (imageUrl) stockProd.imageUrl = imageUrl;
      
      let variant = (stockProd.variants || []).find(v => v.sku === sku);
      if (variant) {
        variant.onHand = (variant.onHand || 0) + qty;
        variant.costMinor = costMinor;
        variant.retailMinor = retailMinor;
        if (!variant.barcode) variant.barcode = barcode;
      } else {
        variant = {
          sku: sku,
          title: raw.variantName || 'Standard',
          barcode: barcode,
          costMinor: costMinor,
          retailMinor: retailMinor,
          onHand: qty,
          reserved: 0,
          damaged: 0,
          rop: 5
        };
        stockProd.variants.push(variant);
      }
    } else {
      const prodId = 'prod-' + crypto.randomUUID().slice(0, 8);
      stockProd = {
        id: prodId,
        organizationId: targetOrg,
        code: sku,
        name: name,
        category: category,
        brand: supplierName,
        stockUnit: 'piece',
        imageUrl: imageUrl,
        description: `Imported via ${importRef} from ${supplierName}`,
        costMinor: costMinor,
        retailMinor: retailMinor,
        hasVariants: false,
        variants: [
          {
            sku: sku,
            title: raw.variantName || 'Standard',
            barcode: barcode,
            costMinor: costMinor,
            retailMinor: retailMinor,
            onHand: qty,
            reserved: 0,
            damaged: 0,
            rop: 5
          }
        ]
      };
      stockData.products.push(stockProd);
    }

    // C. Update stockBalances in Stock Management
    let bal = stockData.stockBalances.find(b => b.sku === sku && b.locationId === targetLocId);
    if (bal) {
      bal.onHand = (bal.onHand || 0) + qty;
    } else {
      bal = {
        id: `bal-${targetLocId}-${sku}`,
        sku: sku,
        locationId: targetLocId,
        onHand: qty,
        reserved: 0,
        damaged: 0,
        rop: 5
      };
      stockData.stockBalances.push(bal);
    }

    // D. Prepend Ledger Movement in Stock Management
    stockData.ledger.unshift({
      id: 'mov-' + crypto.randomUUID().slice(0, 8),
      timestamp: dateStr,
      type: 'RECEIVE_STOCK',
      sku: sku,
      productCode: stockProd.code,
      productName: stockProd.name,
      variantTitle: 'Standard',
      locationId: targetLocId,
      locationName: locName,
      delta: qty,
      balanceAfter: bal.onHand,
      unitCostMinor: costMinor,
      referenceNo: importRef || 'IMP-RECEIPT',
      staff: performedByName || 'Purchasing Engine',
      reason: `Finalized import received from ${supplierName}.`
    });

    // E. Update POS pos_state.json
    let posProd = posData.products.find(p => (p.organizationId === targetOrg || !p.organizationId) && (p.code === sku || p.id === stockProd.id));
    if (posProd) {
      posProd.name = name;
      posProd.category = category;
      posProd.basePrice = retailPrice;
      if (imageUrl) posProd.imageUrl = imageUrl;
      if (imageUrl) posProd.image = imageUrl;
      let posVar = (posProd.variants || []).find(v => v.sku === sku);
      if (posVar) {
        posVar.price = retailPrice;
        posVar.onHand = (posVar.onHand || 0) + qty;
      }
    } else {
      posProd = {
        id: stockProd.id,
        organizationId: targetOrg,
        code: sku,
        name: name,
        category: category,
        categorySlug: category.toLowerCase().replace(/[^a-z0-9]/g, '-'),
        basePrice: retailPrice,
        barcode: barcode,
        image: imageUrl || '📦',
        imageUrl: imageUrl,
        variants: [
          {
            sku: sku,
            title: 'Standard',
            price: retailPrice,
            barcode: barcode,
            onHand: qty
          }
        ]
      };
      posData.products.push(posProd);
    }

    // POS inventory array
    let posInv = posData.inventory.find(i => i.sku === sku && (i.locationId === targetLocId || !i.locationId));
    if (posInv) {
      posInv.quantity = (posInv.quantity || 0) + qty;
    } else {
      posData.inventory.push({
        id: `inv-${targetLocId}-${sku}`,
        organizationId: targetOrg,
        locationId: targetLocId,
        sku: sku,
        quantity: qty,
        unitCost: unitLanded,
        retailPrice: retailPrice,
        lastRestocked: nowIso
      });
    }

    // F. Persist into SQLite Database
    try {
      dbSql.prepare(`
        INSERT OR REPLACE INTO products (
          id, organization_id, code, name, category, brand, stock_unit,
          image_url, description, cost_minor, retail_minor, has_variants, is_active, created_at, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1, ?, ?)
      `).run(
        stockProd.id, targetOrg, sku, name, category, supplierName, 'piece',
        imageUrl, `Imported via ${importRef}`, costMinor, retailMinor, 0, nowIso, nowIso
      );

      const varId = 'var-' + sku.replace(/[^a-zA-Z0-9]/g, '');
      dbSql.prepare(`
        INSERT OR REPLACE INTO product_variants (
          id, organization_id, product_id, sku, title, barcode,
          cost_minor, retail_minor, on_hand, reserved, damaged, rop, created_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `).run(
        varId, targetOrg, stockProd.id, sku, 'Standard', barcode,
        costMinor, retailMinor, bal.onHand, 0, 0, 5, nowIso
      );

      dbSql.prepare(`
        INSERT OR REPLACE INTO stock_balances (
          id, organization_id, location_id, sku, on_hand, reserved, damaged, rop, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
      `).run(
        `bal-${targetLocId}-${sku}`, targetOrg, targetLocId, sku,
        bal.onHand, 0, 0, 5, nowIso
      );

      dbSql.prepare(`
        INSERT INTO stock_ledger (
          id, organization_id, timestamp, type, sku, product_code, product_name,
          variant_title, location_id, location_name, delta, balance_after,
          unit_cost_minor, reference_no, staff, reason
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `).run(
        'mov-' + crypto.randomUUID().slice(0, 8), targetOrg, dateStr,
        'RECEIVE_STOCK', sku, stockProd.code, stockProd.name,
        'Standard', targetLocId, locName, qty, bal.onHand,
        costMinor, importRef, performedByName, `Finalized import received from ${supplierName}.`
      );
    } catch (sqlErr) {
      console.warn('[StockSyncBridge] SQLite sync error for item ' + sku + ':', sqlErr.message);
    }

    processedItems.push({
      sku,
      barcode,
      name,
      category,
      quantity: qty,
      unitLandedCost: unitLanded,
      retailPrice,
      totalOnHand: bal.onHand
    });
  }

  // 3. Save Stock Management store.json
  if (importRef) {
    stockData.receivedPurchases.push({
      purchaseCode: importRef,
      organizationId: targetOrg,
      supplierName,
      receivedAt: receivedDate || nowIso
    });
  }

  try {
    fs.writeFileSync(STOCK_STATE_FILE, JSON.stringify(stockData, null, 2), 'utf8');
  } catch (err) {
    console.error('[StockSyncBridge] Failed to write Stock store.json:', err.message);
  }

  // 4. Save POS pos_state.json
  try {
    fs.writeFileSync(POS_STATE_FILE, JSON.stringify(posData, null, 2), 'utf8');
  } catch (err) {
    console.error('[StockSyncBridge] Failed to write POS pos_state.json:', err.message);
  }

  return {
    success: true,
    importRef,
    targetLocId,
    processedItemsCount: processedItems.length,
    processedItems
  };
}

module.exports = {
  generateAutoSku,
  generateAutoBarcode,
  pushImportToStockAndPos
};
