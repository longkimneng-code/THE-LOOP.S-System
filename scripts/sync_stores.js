const fs = require('fs');
const path = require('path');
const { getDatabase } = require('../shared/database/connection');
const dbSql = getDatabase();

const ROOT_DIR = path.resolve(__dirname, '..');
const stockPath = path.join(ROOT_DIR, 'Stock_management_loops/backend/data/store.json');
const posPath = path.join(ROOT_DIR, 'The_Loop.s_POS/backend/data/pos_state.json');

const stockData = JSON.parse(fs.readFileSync(stockPath, 'utf8'));
const posData = JSON.parse(fs.readFileSync(posPath, 'utf8'));

const beyondVerStores = [
  {
    id: 'loc-01',
    organizationId: 'org-6e9ed3cf',
    code: 'MAIN',
    name: 'BeyondVER Main Branch',
    type: 'STORE',
    address: 'Phnom Penh, Cambodia',
    phone: '',
    managerId: null,
    managerName: 'Unassigned',
    isActive: true,
    isDefault: true,
    createdAt: '2026-11-04T08:00:00.000Z'
  },
  {
    id: 'loc-zprdw9b',
    organizationId: 'org-6e9ed3cf',
    code: 'SSW',
    name: 'BEYONDSISOWAT',
    type: 'STORE',
    address: 'sisowat',
    phone: '',
    managerId: null,
    managerName: 'Unassigned',
    isActive: true,
    isDefault: false,
    createdAt: '2026-11-04T08:00:00.000Z'
  }
];

const beyondVerRegisters = [
  {
    id: 'reg-loc01-01',
    organizationId: 'org-6e9ed3cf',
    locationId: 'loc-01',
    storeId: 'loc-01',
    registerCode: 'REG-01',
    name: 'BeyondVER Main Branch Register 01',
    status: 'CLOSED',
    currentShiftId: null,
    currentCashierId: null
  },
  {
    id: 'reg-ssw-01',
    organizationId: 'org-6e9ed3cf',
    locationId: 'loc-zprdw9b',
    storeId: 'loc-zprdw9b',
    registerCode: 'REG-01',
    name: 'BEYONDSISOWAT Register 01',
    status: 'CLOSED',
    currentShiftId: null,
    currentCashierId: null
  }
];

// Update Stock store.json
if (!stockData.locations) stockData.locations = [];
beyondVerStores.forEach(s => {
  const idx = stockData.locations.findIndex(l => l.id === s.id || (l.code === s.code && l.organizationId === s.organizationId));
  if (idx >= 0) {
    stockData.locations[idx] = { ...stockData.locations[idx], ...s };
  } else {
    stockData.locations.push(s);
  }
});
fs.writeFileSync(stockPath, JSON.stringify(stockData, null, 2), 'utf8');

// Update POS pos_state.json
if (!posData.locations) posData.locations = [];
if (!posData.registers) posData.registers = [];
beyondVerStores.forEach(s => {
  const idx = posData.locations.findIndex(l => l.id === s.id || (l.code === s.code && l.organizationId === s.organizationId));
  if (idx >= 0) {
    posData.locations[idx] = { ...posData.locations[idx], ...s };
  } else {
    posData.locations.push(s);
  }
});
beyondVerRegisters.forEach(r => {
  const idx = posData.registers.findIndex(reg => reg.id === r.id);
  if (idx >= 0) {
    posData.registers[idx] = { ...posData.registers[idx], ...r };
  } else {
    posData.registers.push(r);
  }
});
fs.writeFileSync(posPath, JSON.stringify(posData, null, 2), 'utf8');

// Update SQLite
const insLoc = dbSql.prepare(`
  INSERT OR REPLACE INTO locations 
  (id, organization_id, code, name, type, address, phone, manager_id, manager_name, is_default, is_active, created_at)
  VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
`);
beyondVerStores.forEach(l => {
  insLoc.run(
    l.id, l.organizationId, l.code, l.name, l.type || 'STORE',
    l.address || '', l.phone || '', l.managerId || null, l.managerName || '',
    l.isDefault ? 1 : 0, l.isActive !== false ? 1 : 0, l.createdAt || new Date().toISOString()
  );
});

const insReg = dbSql.prepare(`
  INSERT OR REPLACE INTO registers
  (id, organization_id, location_id, register_code, name, status, current_shift_id, current_cashier_id, created_at)
  VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
`);
beyondVerRegisters.forEach(r => {
  insReg.run(
    r.id, r.organizationId, r.locationId,
    r.registerCode, r.name, r.status,
    r.currentShiftId || null, r.currentCashierId || null, new Date().toISOString()
  );
});

console.log('Successfully synchronized both branches for BeyondVER:');
console.log(beyondVerStores.map(s => ` - ${s.name} (${s.code})`).join('\n'));
