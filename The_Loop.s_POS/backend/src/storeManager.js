// The Loop.s POS — Multi-Store & Branch Location Management Engine (Section 15)
// Multi-location architecture, store-level registers, employees, shifts, and access controls
const { loadDb, saveDb, generateUuid } = require('./db');

function canUserAccessStore(user, storeId) {
  if (!user || !storeId) return false;
  const db = loadDb();
  const store = (db.locations || []).find(s => s.id === storeId);
  if (!store) return false;

  // Strict tenant isolation: store must belong to the user's organization!
  const userOrg = user.organizationId || 'org-loops-001';
  const storeOrg = store.organizationId || 'org-loops-001';
  if (userOrg !== storeOrg) {
    return false;
  }

  // OWNER and SUPER_ADMIN always have business-wide access to all stores
  if (user.role === 'OWNER' || user.role === 'SUPER_ADMIN') return true;
  
  const assigned = user.assignedStoreIds || user.locations || [];
  if (assigned.includes('*')) return true;
  return assigned.includes(storeId);
}

function verifyStoreAndRoleAccess(user, requiredPermission, storeId) {
  if (!user) {
    return { allowed: false, error: 'Authentication required' };
  }

  // 1. Role-based permission check (WHAT the user can do)
  if (requiredPermission) {
    const isOwner = user.role === 'OWNER' || user.role === 'SUPER_ADMIN';
    const hasPerm = isOwner || (user.permissions && user.permissions[requiredPermission] === true);
    if (!hasPerm) {
      return { 
        allowed: false, 
        error: `Permission denied: role '${user.role}' lacks '${requiredPermission}' permission.` 
      };
    }
  }

  // 2. Store-based permission check (WHERE the user can do it)
  if (storeId) {
    if (!canUserAccessStore(user, storeId)) {
      return { 
        allowed: false, 
        error: `Access denied: User is not authorized to access store location '${storeId}'.` 
      };
    }
  }

  return { allowed: true };
}

function ensureStoresSynced(targetOrg) {
  const db = loadDb();
  let changed = false;

  // 1. Sync from SQLite
  try {
    const { getDatabase } = require('../../../shared/database/connection');
    const dbSql = getDatabase();
    const rows = targetOrg
      ? dbSql.prepare('SELECT * FROM locations WHERE organization_id = ?').all(targetOrg)
      : dbSql.prepare('SELECT * FROM locations').all();

    if (rows && rows.length > 0) {
      if (!db.locations) db.locations = [];
      rows.forEach(r => {
        let loc = db.locations.find(l => l.id === r.id);
        if (!loc) {
          loc = {
            id: r.id,
            organizationId: r.organization_id,
            code: r.code,
            name: r.name,
            type: r.type || 'STORE',
            address: r.address || '',
            phone: r.phone || '',
            managerId: r.manager_id || null,
            managerName: r.manager_name || '',
            isActive: r.is_active !== 0,
            isDefault: r.is_default !== 0,
            createdAt: r.created_at || new Date().toISOString()
          };
          db.locations.push(loc);
          changed = true;
        }

        // Ensure default register exists
        if (!db.registers) db.registers = [];
        if (!db.registers.some(reg => reg.locationId === loc.id || reg.storeId === loc.id)) {
          const regId = 'reg-' + loc.id.replace(/[^a-zA-Z0-9]/g, '').slice(-6) + '-01';
          db.registers.push({
            id: regId,
            organizationId: loc.organizationId,
            locationId: loc.id,
            storeId: loc.id,
            registerCode: 'REG-01',
            name: `${loc.name} Register 01`,
            status: 'CLOSED',
            currentShiftId: null,
            currentCashierId: null
          });
          changed = true;
        }
      });
    }
  } catch (e) {}

  if (changed) {
    saveDb();
  }
}

function getStores({ organizationId, user } = {}) {
  const targetOrg = organizationId || user?.organizationId;
  ensureStoresSynced(targetOrg);

  const db = loadDb();
  let stores = db.locations || [];

  // Filter by tenant organization
  if (targetOrg) {
    stores = stores.filter(s => (s.organizationId || 'org-loops-001') === targetOrg);
  } else {
    // Unauthenticated requests must NEVER leak other business tenants' stores
    stores = stores.filter(s => (s.organizationId || 'org-loops-001') === 'org-loops-001');
  }

  // Filter by user store assignment if user is provided and not OWNER
  if (user && user.role !== 'OWNER' && user.role !== 'SUPER_ADMIN') {
    const assigned = user.assignedStoreIds || user.locations || [];
    if (!assigned.includes('*')) {
      stores = stores.filter(s => assigned.includes(s.id));
    }
  }

  // Enrich with live telemetry: registers count, active shifts, manager name
  return stores.map(s => {
    const storeRegisters = (db.registers || []).filter(r => r.locationId === s.id || r.storeId === s.id);
    const activeShifts = (db.shifts || []).filter(sh => (sh.storeId === s.id || sh.locationId === s.id) && sh.status === 'ACTIVE');
    const manager = s.managerId ? (db.users || []).find(u => u.id === s.managerId) : null;

    return {
      ...s,
      registerCount: storeRegisters.length,
      activeShiftCount: activeShifts.length,
      managerName: manager ? manager.fullName : (s.managerName || 'Unassigned')
    };
  });
}

function getStoreById(storeId, organizationId = null) {
  const db = loadDb();
  const store = (db.locations || []).find(s => s.id === storeId) || null;
  if (!store) return null;
  if (organizationId && (store.organizationId || 'org-loops-001') !== organizationId) {
    return null;
  }
  return store;
}

function createStore({
  name,
  code,
  address,
  phone,
  managerId,
  organizationId,
  performedBy = 'Administrator'
}) {
  const db = loadDb();
  const cleanName = String(name || '').trim();
  const cleanCode = String(code || '').trim().toUpperCase();

  if (!cleanName) {
    return { ok: false, error: 'Store name is required' };
  }

  const orgId = organizationId || db.organization?.id || 'org-loops-001';

  // Check code uniqueness within organization
  if (cleanCode && (db.locations || []).some(s => s.code === cleanCode && (s.organizationId || 'org-loops-001') === orgId)) {
    return { ok: false, error: `Store with code "${cleanCode}" already exists` };
  }

  const storeId = 'store-' + generateUuid().slice(0, 8);
  const manager = managerId ? (db.users || []).find(u => u.id === managerId) : null;

  const newStore = {
    id: storeId,
    organizationId: orgId,
    code: cleanCode || `ST-${(db.locations?.length || 0) + 1}`,
    name: cleanName,
    address: address || '',
    phone: phone || '',
    managerId: managerId || null,
    managerName: manager ? manager.fullName : '',
    isActive: true,
    isDefault: !db.locations || db.locations.length === 0,
    createdAt: new Date().toISOString()
  };

  if (!db.locations) db.locations = [];
  db.locations.push(newStore);

  // Automatically create initial front register (Section 15.8)
  const registerId = 'reg-' + storeId.slice(-6) + '-01';
  const initialRegister = {
    id: registerId,
    organizationId: orgId,
    locationId: storeId,
    storeId: storeId,
    registerCode: 'REG-01',
    name: `${cleanName} Register 01`,
    status: 'CLOSED',
    currentShiftId: null,
    currentCashierId: null
  };

  if (!db.registers) db.registers = [];
  db.registers.push(initialRegister);

  // Record audit trail
  db.auditLog.unshift({
    id: generateUuid(),
    action: 'STORE_CREATED',
    organizationId: orgId,
    performedBy,
    details: `Created new store branch "${cleanName}" (${newStore.code}) with default register REG-01`,
    timestamp: new Date().toISOString()
  });

  saveDb();

  // Cross-app sync to SQLite and Stock Management
  try {
    const { getDatabase } = require('../../../shared/database/connection');
    const dbSql = getDatabase();
    dbSql.prepare(`
      INSERT OR REPLACE INTO locations 
      (id, organization_id, code, name, type, address, phone, manager_id, manager_name, is_default, is_active, created_at)
      VALUES (?, ?, ?, ?, 'STORE', ?, ?, ?, ?, ?, 1, ?)
    `).run(
      newStore.id, newStore.organizationId, newStore.code, newStore.name,
      newStore.address || '', newStore.phone || '', newStore.managerId || null, newStore.managerName || '',
      newStore.isDefault ? 1 : 0, newStore.createdAt
    );

    dbSql.prepare(`
      INSERT OR REPLACE INTO registers
      (id, organization_id, location_id, register_code, name, status, current_shift_id, current_cashier_id, created_at)
      VALUES (?, ?, ?, 'REG-01', ?, 'CLOSED', NULL, NULL, ?)
    `).run(
      initialRegister.id, initialRegister.organizationId, initialRegister.locationId,
      initialRegister.name, newStore.createdAt
    );

    // Sync to Stock Management
    const fs = require('fs');
    const path = require('path');
    const stockPath = path.resolve(__dirname, '../../../Stock_management_loops/backend/data/store.json');
    if (fs.existsSync(stockPath)) {
      const stockData = JSON.parse(fs.readFileSync(stockPath, 'utf8'));
      if (!stockData.locations) stockData.locations = [];
      if (!stockData.locations.some(l => l.id === newStore.id)) {
        stockData.locations.push({
          id: newStore.id,
          organizationId: newStore.organizationId,
          name: newStore.name,
          code: newStore.code,
          type: 'STORE',
          address: newStore.address,
          isDefault: newStore.isDefault
        });
        fs.writeFileSync(stockPath, JSON.stringify(stockData, null, 2));
      }
    }
  } catch (e) {
    console.warn('Cross-app store sync warning:', e.message);
  }

  return {
    ok: true,
    store: newStore,
    register: initialRegister
  };
}

function updateStore(storeId, updates, performedBy = 'Administrator', callerOrgId = null) {
  const db = loadDb();
  const store = (db.locations || []).find(s => s.id === storeId);
  if (!store) {
    return { ok: false, error: `Store #${storeId} not found` };
  }

  if (callerOrgId && (store.organizationId || 'org-loops-001') !== callerOrgId) {
    return { ok: false, forbidden: true, error: 'Access forbidden: Cannot modify stores belonging to another business organization.' };
  }

  if (updates.name) store.name = updates.name.trim();
  if (updates.code) store.code = updates.code.trim().toUpperCase();
  if (updates.address !== undefined) store.address = updates.address.trim();
  if (updates.phone !== undefined) store.phone = updates.phone.trim();
  if (updates.isActive !== undefined) store.isActive = !!updates.isActive;

  if (updates.managerId !== undefined) {
    store.managerId = updates.managerId || null;
    const manager = updates.managerId ? (db.users || []).find(u => u.id === updates.managerId) : null;
    store.managerName = manager ? manager.fullName : '';
  }

  store.updatedAt = new Date().toISOString();

  db.auditLog.unshift({
    id: generateUuid(),
    action: 'STORE_UPDATED',
    organizationId: store.organizationId,
    performedBy,
    details: `Updated store "${store.name}" (${store.id})`,
    timestamp: new Date().toISOString()
  });

  saveDb();
  return { ok: true, store };
}

function getStoreRegisters(storeId, organizationId = null) {
  const db = loadDb();
  const store = (db.locations || []).find(s => s.id === storeId);
  if (!store) return [];
  if (organizationId && (store.organizationId || 'org-loops-001') !== organizationId) {
    return [];
  }
  return (db.registers || []).filter(r => r.locationId === storeId || r.storeId === storeId);
}

function createStoreRegister({
  storeId,
  registerCode,
  name,
  performedBy = 'Administrator'
}) {
  const db = loadDb();
  const store = (db.locations || []).find(s => s.id === storeId);
  if (!store) {
    return { ok: false, error: `Store #${storeId} not found` };
  }

  const cleanCode = String(registerCode || 'REG-' + Date.now().toString().slice(-2)).trim().toUpperCase();
  const regId = 'reg-' + storeId.slice(-4) + '-' + generateUuid().slice(0, 4);

  const newRegister = {
    id: regId,
    organizationId: store.organizationId || db.organization?.id || 'org-loops-001',
    locationId: storeId,
    storeId: storeId,
    registerCode: cleanCode,
    name: name || `${store.name} Register ${cleanCode}`,
    status: 'CLOSED',
    currentShiftId: null,
    currentCashierId: null
  };

  if (!db.registers) db.registers = [];
  db.registers.push(newRegister);

  db.auditLog.unshift({
    id: generateUuid(),
    action: 'REGISTER_CREATED',
    organizationId: newRegister.organizationId,
    performedBy,
    details: `Created register "${cleanCode}" for store "${store.name}"`,
    timestamp: new Date().toISOString()
  });

  saveDb();
  return { ok: true, register: newRegister };
}

module.exports = {
  canUserAccessStore,
  verifyStoreAndRoleAccess,
  getStores,
  getStoreById,
  createStore,
  updateStore,
  getStoreRegisters,
  createStoreRegister
};

