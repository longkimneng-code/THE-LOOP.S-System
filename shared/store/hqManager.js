// The Loops Universal Suite — Store Headquarters (HQ) Engine
// Atomic HQ designation switching, audit logging, and dynamic central branch resolution

const fs = require('fs');
const path = require('path');
const { getDatabase } = require('../database/connection');

function initHqSchema() {
  const db = getDatabase();
  try {
    db.exec(`ALTER TABLE locations ADD COLUMN is_hq INTEGER DEFAULT 0;`);
  } catch (e) {}

  try {
    db.exec(`ALTER TABLE organizations ADD COLUMN hq_store_id TEXT;`);
  } catch (e) {}

  db.exec(`
    CREATE TABLE IF NOT EXISTS hq_audit_logs (
      id TEXT PRIMARY KEY,
      organization_id TEXT NOT NULL,
      previous_hq_id TEXT,
      previous_hq_name TEXT,
      new_hq_id TEXT NOT NULL,
      new_hq_name TEXT NOT NULL,
      changed_by_user_id TEXT NOT NULL,
      changed_by_name TEXT NOT NULL,
      created_at TEXT NOT NULL
    );
    CREATE INDEX IF NOT EXISTS idx_hq_audit_org ON hq_audit_logs(organization_id);
  `);

  // Ensure default store is marked as HQ if none is marked
  try {
    const orgs = db.prepare('SELECT id FROM organizations').all();
    orgs.forEach(o => {
      const activeHq = db.prepare('SELECT id FROM locations WHERE organization_id = ? AND is_hq = 1 LIMIT 1').get(o.id);
      if (!activeHq) {
        const defaultLoc = db.prepare('SELECT id FROM locations WHERE organization_id = ? AND is_default = 1 LIMIT 1').get(o.id)
          || db.prepare('SELECT id FROM locations WHERE organization_id = ? LIMIT 1').get(o.id);
        if (defaultLoc) {
          db.prepare('UPDATE locations SET is_hq = 1, is_default = 1 WHERE id = ?').run(defaultLoc.id);
          db.prepare('UPDATE organizations SET hq_store_id = ? WHERE id = ?').run(defaultLoc.id, o.id);
        }
      }
    });
  } catch (e) {}
}

function getCurrentHq(organizationId) {
  initHqSchema();
  const db = getDatabase();

  const hq = db.prepare(`
    SELECT * FROM locations 
    WHERE organization_id = ? AND (is_hq = 1 OR is_default = 1) 
    ORDER BY is_hq DESC, is_default DESC 
    LIMIT 1
  `).get(organizationId);

  const branches = db.prepare(`
    SELECT id, code, name, type, address, phone, is_default, is_hq, is_active, created_at
    FROM locations
    WHERE organization_id = ?
    ORDER BY is_hq DESC, is_default DESC, name ASC
  `).all(organizationId);

  const history = db.prepare(`
    SELECT * FROM hq_audit_logs
    WHERE organization_id = ?
    ORDER BY created_at DESC
    LIMIT 15
  `).all(organizationId);

  return {
    ok: true,
    currentHq: hq || branches[0] || null,
    branches,
    history
  };
}

function switchHq({ organizationId, targetStoreId, user }) {
  if (!user) {
    return { ok: false, code: 401, error: 'Authentication required' };
  }

  // 1. Strict Permission Check: Only Store Owner or users with dedicated store.hq.change permission
  const isOwner = user.role === 'OWNER' || user.role === 'SUPER_ADMIN';
  const hasPerm = isOwner || Boolean(user.permissions?.['store.hq.change']);
  if (!hasPerm) {
    return {
      ok: false,
      code: 403,
      error: "Permission denied: Only the Store Owner or users with 'store.hq.change' permission can designate Headquarters."
    };
  }

  initHqSchema();
  const db = getDatabase();

  const orgId = organizationId || user.organizationId;
  if (!orgId) {
    return { ok: false, code: 400, error: 'Organization ID is required' };
  }

  // 2. Validate target branch belongs to this company
  const targetStore = db.prepare('SELECT * FROM locations WHERE id = ? AND organization_id = ?').get(targetStoreId, orgId);
  if (!targetStore) {
    return { ok: false, code: 404, error: 'Target branch not found or does not belong to your company.' };
  }

  // 3. Identify current HQ
  const currentHq = db.prepare(`
    SELECT * FROM locations 
    WHERE organization_id = ? AND (is_hq = 1 OR is_default = 1) 
    ORDER BY is_hq DESC, is_default DESC 
    LIMIT 1
  `).get(orgId);

  if (currentHq && currentHq.id === targetStoreId && currentHq.is_hq === 1) {
    return {
      ok: false,
      code: 400,
      error: `Branch "${targetStore.name}" (${targetStore.code}) is already the active Headquarters.`
    };
  }

  // 4. Atomic Database Switch
  const logId = 'hqa-' + Date.now().toString(36) + '-' + Math.random().toString(36).slice(2, 7);
  const now = new Date().toISOString();

  db.exec('BEGIN TRANSACTION;');
  try {
    // Clear previous HQ
    db.prepare('UPDATE locations SET is_hq = 0, is_default = 0 WHERE organization_id = ?').run(orgId);
    // Designate new HQ
    db.prepare('UPDATE locations SET is_hq = 1, is_default = 1 WHERE id = ? AND organization_id = ?').run(targetStoreId, orgId);
    // Update company central HQ reference
    db.prepare('UPDATE organizations SET hq_store_id = ? WHERE id = ?').run(targetStoreId, orgId);

    // Record permanent audit log
    db.prepare(`
      INSERT INTO hq_audit_logs (
        id, organization_id, previous_hq_id, previous_hq_name,
        new_hq_id, new_hq_name, changed_by_user_id, changed_by_name, created_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      logId,
      orgId,
      currentHq?.id || null,
      currentHq?.name || 'Unassigned',
      targetStore.id,
      targetStore.name,
      user.id,
      user.fullName || user.email || 'Store Owner',
      now
    );

    db.exec('COMMIT;');
  } catch (err) {
    db.exec('ROLLBACK;');
    return { ok: false, code: 500, error: 'Failed to switch Headquarters atomically: ' + err.message };
  }

  // 5. Synchronize JSON state files for offline and sub-service compatibility
  syncHqToJsonStates(orgId, targetStoreId);

  return {
    ok: true,
    message: `Headquarters successfully switched to "${targetStore.name}" (${targetStore.code}).`,
    previousHq: currentHq ? { id: currentHq.id, name: currentHq.name, code: currentHq.code } : null,
    newHq: { id: targetStore.id, name: targetStore.name, code: targetStore.code }
  };
}

function syncHqToJsonStates(orgId, newHqId) {
  // Sync to POS state
  const posPath = path.resolve(__dirname, '../../The_Loop.s_POS/backend/data/pos_state.json');
  if (fs.existsSync(posPath)) {
    try {
      const posState = JSON.parse(fs.readFileSync(posPath, 'utf8'));
      if (posState.locations) {
        posState.locations.forEach(l => {
          if ((l.organizationId || 'org-loops-001') === orgId) {
            l.isHq = (l.id === newHqId);
            l.isDefault = (l.id === newHqId);
          }
        });
      }
      if (posState.organization && (posState.organization.id === orgId)) {
        posState.organization.hqStoreId = newHqId;
      }
      fs.writeFileSync(posPath, JSON.stringify(posState, null, 2), 'utf8');
    } catch (e) {}
  }

  // Sync to Stock state
  const stockPath = path.resolve(__dirname, '../../Stock_management_loops/backend/data/store.json');
  if (fs.existsSync(stockPath)) {
    try {
      const stockState = JSON.parse(fs.readFileSync(stockPath, 'utf8'));
      if (stockState.locations) {
        stockState.locations.forEach(l => {
          if ((l.organizationId || 'org-loops-001') === orgId) {
            l.isHq = (l.id === newHqId);
            l.isDefault = (l.id === newHqId);
          }
        });
      }
      fs.writeFileSync(stockPath, JSON.stringify(stockState, null, 2), 'utf8');
    } catch (e) {}
  }
}

module.exports = {
  initHqSchema,
  getCurrentHq,
  switchHq
};
