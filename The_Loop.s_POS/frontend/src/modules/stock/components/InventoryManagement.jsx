import React, { useState } from 'react';
import Icon from './Icon';

export default function InventoryManagement({
  balances = [],
  ledger = [],
  onOpenReceiveModal,
  onOpenTransferModal,
  onOpenExportModal,
  onQuickReceive
}) {
  const [subtab, setSubtab] = useState('balances');
  const [searchQuery, setSearchQuery] = useState('');
  const [ledgerTypeFilter, setLedgerTypeFilter] = useState('ALL');

  const filteredBalances = (balances || []).filter((b) => {
    const q = searchQuery.toLowerCase();
    return (
      (b.sku && b.sku.toLowerCase().includes(q)) ||
      (b.productName && b.productName.toLowerCase().includes(q)) ||
      (b.locationName && b.locationName.toLowerCase().includes(q)) ||
      (b.barcode && b.barcode.includes(q))
    );
  });

  const filteredLedger = (ledger || []).filter((m) => {
    return ledgerTypeFilter === 'ALL' || m.type === ledgerTypeFilter;
  });

  return (
    <section className="space-y-6 animate-in fade-in duration-200">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-2 border-b border-white/5">
        <div>
          <h2 className="text-2xl font-display font-extrabold text-white flex items-center space-x-2">
            <Icon name="inventory" size={22} className="text-gold-400" />
            <span>Universal Inventory Hub</span>
          </h2>
          <p className="text-xs text-studio-400 mt-0.5">
            Append-only movement ledger, stock balance by location node, count adjustments, and transfers.
          </p>
        </div>
        <div className="flex items-center space-x-2.5">
          <button
            onClick={onOpenReceiveModal}
            className="bg-gold-500 hover:bg-gold-400 text-studio-950 font-bold px-3.5 py-2 rounded-xl text-xs transition-all shadow-md shadow-gold-500/20 flex items-center space-x-1.5 active:scale-95"
          >
            <Icon name="receive" size={14} />
            <span>Receive Inflow</span>
          </button>
          <button
            onClick={onOpenTransferModal}
            className="bg-studio-900 hover:bg-studio-800 text-white font-medium px-3.5 py-2 rounded-xl text-xs border border-white/10 transition-all flex items-center space-x-1.5 active:scale-95 shadow-sm"
          >
            <Icon name="transfer" size={14} className="text-gold-400" />
            <span>Inter-Store Transfer</span>
          </button>
        </div>
      </div>

      {/* Subtabs */}
      <div className="flex items-center space-x-2 border-b border-white/10 pb-2 text-xs">
        <button
          onClick={() => setSubtab('balances')}
          className={`px-3.5 py-1.5 rounded-lg transition-all flex items-center space-x-2 font-medium ${
            subtab === 'balances'
              ? 'bg-gold-500 text-studio-950 font-bold shadow-sm'
              : 'text-studio-400 hover:text-white'
          }`}
        >
          <Icon name="catalog" size={14} />
          <span>Stock Balances by Location</span>
        </button>
        <button
          onClick={() => setSubtab('ledger')}
          className={`px-3.5 py-1.5 rounded-lg transition-all flex items-center space-x-2 font-medium ${
            subtab === 'ledger'
              ? 'bg-gold-500 text-studio-950 font-bold shadow-sm'
              : 'text-studio-400 hover:text-white'
          }`}
        >
          <Icon name="inventory" size={14} />
          <span>Append-Only Movement Ledger</span>
        </button>
      </div>

      {/* Subtab 1: Stock Balances */}
      {subtab === 'balances' && (
        <div className="glass-panel rounded-2xl overflow-hidden border border-white/10 shadow-lg">
          <div className="p-3.5 border-b border-white/10 flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 bg-studio-900/60">
            <div className="relative w-full sm:w-80">
              <input
                type="text"
                placeholder="Filter by SKU, Product or Location..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="bg-studio-900 border border-white/10 rounded-lg pl-8 pr-3 py-1.5 text-xs text-white focus:outline-none focus:border-gold-500 w-full shadow-sm"
              />
              <span className="absolute left-2.5 top-2 text-studio-400 pointer-events-none">
                <Icon name="search" size={13} />
              </span>
            </div>
            <span className="text-[11px] font-mono text-studio-400">
              Formula: <strong className="text-white">Available Stock = On-Hand − Reserved</strong>
            </span>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs font-mono">
              <thead className="bg-studio-900/90 text-[10px] uppercase text-studio-400 border-b border-white/10">
                <tr>
                  <th className="py-3 px-4">SKU / Barcode</th>
                  <th className="py-3 px-4">Product & Variant</th>
                  <th className="py-3 px-4">Location Node</th>
                  <th className="py-3 px-4 text-right">On Hand</th>
                  <th className="py-3 px-4 text-right">Reserved</th>
                  <th className="py-3 px-4 text-right">Available</th>
                  <th className="py-3 px-4 text-right">Damaged</th>
                  <th className="py-3 px-4 text-center">Status</th>
                  <th className="py-3 px-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5 text-[11px]">
                {filteredBalances.length === 0 ? (
                  <tr>
                    <td colSpan="9" className="py-12 text-center text-studio-400">
                      No inventory balance records found.
                    </td>
                  </tr>
                ) : (
                  filteredBalances.map((b) => {
                    const available = (b.onHand || 0) - (b.reserved || 0);
                    const isOos = (b.onHand || 0) === 0;
                    const isLow = (b.onHand || 0) <= (b.rop || 5) && !isOos;

                    const statusBadge = isOos ? (
                      <span className="px-2 py-0.5 rounded text-[10px] bg-crimson-500/20 text-crimson-400 font-bold border border-crimson-500/30">
                        OOS
                      </span>
                    ) : isLow ? (
                      <span className="px-2 py-0.5 rounded text-[10px] bg-gold-500/20 text-gold-400 font-bold border border-gold-500/30">
                        LOW STOCK
                      </span>
                    ) : (
                      <span className="px-2 py-0.5 rounded text-[10px] bg-emerald-500/20 text-emerald-400 font-bold border border-emerald-500/30">
                        HEALTHY
                      </span>
                    );

                    return (
                      <tr key={b.id || `${b.sku}-${b.locationId}`} className="hover:bg-studio-900/40 transition-colors">
                        <td className="py-3 px-4 font-bold text-gold-400">
                          {b.sku}
                          <br />
                          <span className="text-[9px] text-studio-400">{b.barcode || ''}</span>
                        </td>
                        <td className="py-3 px-4">
                          <span className="font-bold text-white block">{b.productName}</span>
                          <span className="text-studio-400 text-[10px]">{b.title}</span>
                        </td>
                        <td className="py-3 px-4 text-studio-300">
                          <span className="px-1.5 py-0.5 rounded bg-white/5 border border-white/10 text-[10px]">
                            {b.locationName}
                          </span>
                        </td>
                        <td className="py-3 px-4 text-right font-bold text-white">{b.onHand}</td>
                        <td className="py-3 px-4 text-right text-studio-400">{b.reserved || 0}</td>
                        <td className="py-3 px-4 text-right font-bold text-emerald-400">{available}</td>
                        <td className="py-3 px-4 text-right text-crimson-400">{b.damaged || 0}</td>
                        <td className="py-3 px-4 text-center">{statusBadge}</td>
                        <td className="py-3 px-4 text-right">
                          <button
                            onClick={() => onQuickReceive(b.sku)}
                            className="px-2.5 py-1 bg-studio-800 hover:bg-gold-500 hover:text-studio-950 text-white rounded-lg text-[10px] transition-all flex items-center space-x-1 ml-auto"
                          >
                            <Icon name="plus" size={10} />
                            <span>Receive</span>
                          </button>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Subtab 2: Append-Only Ledger */}
      {subtab === 'ledger' && (
        <div className="glass-panel rounded-2xl overflow-hidden border border-white/10 shadow-lg">
          <div className="p-3.5 border-b border-white/10 flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-studio-900/60">
            <div className="flex items-center space-x-2">
              <span className="text-xs font-mono text-studio-400">Filter Event:</span>
              <select
                value={ledgerTypeFilter}
                onChange={(e) => setLedgerTypeFilter(e.target.value)}
                className="bg-studio-900 border border-white/10 rounded-lg px-2.5 py-1 text-xs text-white focus:outline-none focus:border-gold-500 font-mono cursor-pointer"
              >
                <option value="ALL">All Event Types</option>
                <option value="OPENING_STOCK">OPENING_STOCK</option>
                <option value="RECEIVE_STOCK">RECEIVE_STOCK</option>
                <option value="SALE_OUT">SALE_OUT</option>
                <option value="CUSTOMER_RETURN">CUSTOMER_RETURN</option>
                <option value="STOCK_TRANSFER_IN">STOCK_TRANSFER_IN</option>
                <option value="STOCK_TRANSFER_OUT">STOCK_TRANSFER_OUT</option>
                <option value="STOCK_ADJUSTMENT">STOCK_ADJUSTMENT</option>
              </select>
            </div>
            <span className="text-[11px] font-mono text-studio-400">
              Immutable Append-Only Audit Trail
            </span>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs font-mono">
              <thead className="bg-studio-900/90 text-[10px] uppercase text-studio-400 border-b border-white/10">
                <tr>
                  <th className="py-3 px-4">Timestamp</th>
                  <th className="py-3 px-4">Event Type</th>
                  <th className="py-3 px-4">SKU / Item</th>
                  <th className="py-3 px-4">Location Node</th>
                  <th className="py-3 px-4 text-right">Delta (Change)</th>
                  <th className="py-3 px-4 text-right">Balance After</th>
                  <th className="py-3 px-4">Reference / Reason</th>
                  <th className="py-3 px-4">Operator</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5 text-[11px]">
                {filteredLedger.length === 0 ? (
                  <tr>
                    <td colSpan="8" className="py-12 text-center text-studio-400">
                      No stock movements recorded in the ledger yet.
                    </td>
                  </tr>
                ) : (
                  filteredLedger.map((m) => (
                    <tr key={m.id} className="hover:bg-studio-900/40 transition-colors">
                      <td className="py-3 px-4 text-studio-400 whitespace-nowrap">{m.timestamp}</td>
                      <td className="py-3 px-4">
                        <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-white/5 text-gold-400 border border-white/10">
                          {m.type}
                        </span>
                      </td>
                      <td className="py-3 px-4">
                        <span className="font-bold text-white block">{m.sku}</span>
                        <span className="text-[10px] text-studio-400">{m.productName || m.variantTitle}</span>
                      </td>
                      <td className="py-3 px-4 text-studio-300">{m.locationName}</td>
                      <td className={`py-3 px-4 text-right font-bold ${m.delta > 0 ? 'text-emerald-400' : 'text-crimson-400'}`}>
                        {m.delta > 0 ? `+${m.delta}` : m.delta}
                      </td>
                      <td className="py-3 px-4 text-right font-bold text-white">{m.balanceAfter}</td>
                      <td className="py-3 px-4">
                        <span className="text-white font-medium block">{m.referenceNo || 'N/A'}</span>
                        <span className="text-[10px] text-studio-400">{m.reason || ''}</span>
                      </td>
                      <td className="py-3 px-4 text-studio-400 text-[10px]">{m.staff || 'System'}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </section>
  );
}
