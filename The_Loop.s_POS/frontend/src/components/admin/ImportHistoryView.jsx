import React, { useState, useEffect } from 'react';
import { usePos } from '../../context/PosContext';
import { 
  Ship, 
  Calendar, 
  Search, 
  Filter, 
  Download, 
  FileSpreadsheet, 
  FileText, 
  Printer, 
  Eye, 
  CheckCircle2, 
  Clock, 
  X, 
  Truck, 
  Layers, 
  User, 
  ChevronRight,
  Package,
  Barcode,
  Tag
} from 'lucide-react';

export default function ImportHistoryView({ isEmbedded = false }) {
  const { authToken, currentUser, playBeep } = usePos();

  const [imports, setImports] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedMonth, setSelectedMonth] = useState(() => new Date().toISOString().slice(0, 7));
  const [statusFilter, setStatusFilter] = useState('ALL');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedImport, setSelectedImport] = useState(null);
  const [barcodeModalItem, setBarcodeModalItem] = useState(null);
  const [labelQuantity, setLabelQuantity] = useState(1);
  const [toast, setToast] = useState('');

  const showToast = (msg) => {
    setToast(msg);
    playBeep(1200, 'sine', 0.1);
    setTimeout(() => setToast(''), 3500);
  };

  const fetchImports = async () => {
    setLoading(true);
    try {
      const token = authToken || (typeof window !== 'undefined' ? localStorage.getItem('loops_auth_token') : null);
      const url = `/api/imports?month=${selectedMonth}&status=${statusFilter}&onlyArchived=true`;
      const res = await fetch(url, {
        headers: token ? { Authorization: `Bearer ${token}` } : {}
      });
      if (res.ok) {
        const data = await res.json();
        setImports(data.imports || []);
      }
    } catch (e) {
      console.warn('Failed to load import history:', e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchImports();
  }, [selectedMonth, statusFilter]);

  const filteredImports = imports.filter(imp => {
    if (!searchQuery.trim()) return true;
    const q = searchQuery.toLowerCase();
    const matchRef = imp.import_ref?.toLowerCase().includes(q);
    const matchSup = imp.supplier_name?.toLowerCase().includes(q);
    const matchUser = imp.performed_by_name?.toLowerCase().includes(q);
    const matchItem = (imp.items || []).some(it => 
      it.productName?.toLowerCase().includes(q) || 
      it.sku?.toLowerCase().includes(q) || 
      it.skuCode?.toLowerCase().includes(q) ||
      it.category?.toLowerCase().includes(q)
    );
    return matchRef || matchSup || matchUser || matchItem;
  });

  const totalValueSum = filteredImports.reduce((s, x) => s + (Number(x.total_import_value) || 0), 0);
  const totalUnitsSum = filteredImports.reduce((s, x) => s + (Number(x.total_quantity) || 0), 0);

  const handleExport = (format) => {
    const token = authToken || (typeof window !== 'undefined' ? localStorage.getItem('loops_auth_token') : null);
    const exportUrl = `/api/reports/export?reportType=IMPORT_HISTORY&format=${format}&month=${selectedMonth}${token ? `&token=${token}` : ''}`;
    window.open(exportUrl, '_blank');
  };

  const handlePrintBarcodes = (items) => {
    setBarcodeModalItem(items);
    setLabelQuantity(1);
  };

  return (
    <div className={`flex-1 overflow-y-auto ${isEmbedded ? 'p-2' : 'p-4 sm:p-6'} bg-obsidian-950 text-slate-100 font-sans select-none space-y-6`}>
      
      {/* Toast Alert */}
      {toast && (
        <div className="fixed top-5 right-5 z-50 p-3 bg-emerald-500 text-obsidian-950 rounded-xl shadow-xl font-bold text-xs flex items-center space-x-2 animate-in slide-in-from-top-2">
          <CheckCircle2 className="w-4 h-4" />
          <span>{toast}</span>
        </div>
      )}

      {/* Top Banner & Export Actions */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-obsidian-800">
        <div>
          <div className="flex items-center space-x-2">
            <h1 className="text-lg font-bold text-slate-100 font-display uppercase tracking-wider flex items-center gap-2">
              <Ship className="w-5 h-5 text-brass-400" />
              Import History Archive
            </h1>
            <span className="text-[10px] bg-brass-500/20 text-brass-400 font-mono px-2 py-0.5 rounded border border-brass-500/30 font-bold uppercase">
              Historical Records
            </span>
          </div>
          <p className="text-xs text-slate-400 mt-0.5">
            Permanent monthly historical view of finalized imports, unit landed costs, and supplier deliveries.
          </p>
        </div>

        <div className="flex items-center space-x-2">
          {/* Export Dropdown Group */}
          <div className="flex items-center bg-obsidian-900 border border-obsidian-850 rounded-xl overflow-hidden p-0.5 shadow-sm">
            <button
              onClick={() => handleExport('xlsx')}
              className="px-2.5 py-1.5 hover:bg-emerald-500/20 text-emerald-400 text-xs font-mono flex items-center space-x-1 transition"
              title="Export to Excel (.xlsx)"
            >
              <FileSpreadsheet className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Excel</span>
            </button>
            <span className="text-obsidian-750">|</span>
            <button
              onClick={() => handleExport('docx')}
              className="px-2.5 py-1.5 hover:bg-sky-500/20 text-sky-400 text-xs font-mono flex items-center space-x-1 transition"
              title="Export to Word (.docx)"
            >
              <FileText className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Word</span>
            </button>
            <span className="text-obsidian-750">|</span>
            <button
              onClick={() => handleExport('pdf')}
              className="px-2.5 py-1.5 hover:bg-rose-500/20 text-rose-400 text-xs font-mono flex items-center space-x-1 transition"
              title="Print / Save PDF"
            >
              <Printer className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Print / PDF</span>
            </button>
          </div>
        </div>
      </div>

      {/* Metrics Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
        <div className="p-4 rounded-xl bg-obsidian-900 border border-obsidian-800 space-y-1">
          <div className="text-[11px] font-mono text-slate-400 uppercase tracking-wider flex items-center space-x-1.5">
            <Ship className="w-3.5 h-3.5 text-brass-400" />
            <span>Archived Imports</span>
          </div>
          <div className="text-2xl font-black font-display text-slate-100">
            {filteredImports.length}
          </div>
        </div>

        <div className="p-4 rounded-xl bg-obsidian-900 border border-obsidian-800 space-y-1">
          <div className="text-[11px] font-mono text-slate-400 uppercase tracking-wider flex items-center space-x-1.5">
            <Package className="w-3.5 h-3.5 text-sky-400" />
            <span>Imported Units</span>
          </div>
          <div className="text-2xl font-black font-display text-sky-400">
            {totalUnitsSum.toLocaleString()}
          </div>
        </div>

        <div className="p-4 rounded-xl bg-obsidian-900 border border-obsidian-800 space-y-1">
          <div className="text-[11px] font-mono text-slate-400 uppercase tracking-wider flex items-center space-x-1.5">
            <Layers className="w-3.5 h-3.5 text-emerald-400" />
            <span>Total Landed Value</span>
          </div>
          <div className="text-2xl font-black font-display text-emerald-400">
            ${totalValueSum.toFixed(2)}
          </div>
        </div>

        <div className="p-4 rounded-xl bg-obsidian-900 border border-obsidian-800 space-y-1">
          <div className="text-[11px] font-mono text-slate-400 uppercase tracking-wider flex items-center space-x-1.5">
            <Calendar className="w-3.5 h-3.5 text-amber-400" />
            <span>Archive Period</span>
          </div>
          <div className="text-lg font-bold font-mono text-amber-400">
            {selectedMonth}
          </div>
        </div>
      </div>

      {/* Filter & Search Toolbar */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 p-3 rounded-xl bg-obsidian-900 border border-obsidian-800">
        <div className="flex items-center space-x-2 flex-1 max-w-md">
          <Search className="w-4 h-4 text-slate-500 shrink-0" />
          <input
            type="text"
            placeholder="Search reference #, supplier, product, or employee..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full bg-transparent text-xs text-slate-200 placeholder-slate-500 focus:outline-none"
          />
          {searchQuery && (
            <button onClick={() => setSearchQuery('')} className="text-slate-500 hover:text-slate-300">
              <X className="w-3.5 h-3.5" />
            </button>
          )}
        </div>

        <div className="flex items-center space-x-2 shrink-0">
          {/* Month Selector */}
          <div className="flex items-center space-x-1.5 bg-obsidian-950 px-2.5 py-1.5 rounded-lg border border-obsidian-750 text-xs font-mono">
            <Calendar className="w-3.5 h-3.5 text-brass-400" />
            <input
              type="month"
              value={selectedMonth}
              onChange={(e) => setSelectedMonth(e.target.value)}
              className="bg-transparent text-slate-200 focus:outline-none"
            />
          </div>

          {/* Status Filter */}
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="bg-obsidian-950 text-slate-200 px-2.5 py-1.5 rounded-lg border border-obsidian-750 text-xs font-mono focus:outline-none"
          >
            <option value="ALL">All Statuses</option>
            <option value="COMPLETED">Completed</option>
            <option value="FINALIZED">Finalized</option>
            <option value="PENDING">Pending</option>
          </select>
        </div>
      </div>

      {/* Imports Table View */}
      <div className="rounded-2xl border border-obsidian-800 bg-obsidian-900/60 overflow-hidden shadow-xl">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-obsidian-900 text-slate-400 font-mono uppercase text-[10px] tracking-wider border-b border-obsidian-800">
              <tr>
                <th className="py-3 px-4">Import Ref #</th>
                <th className="py-3 px-4">Date Bought</th>
                <th className="py-3 px-4">Date Received</th>
                <th className="py-3 px-4">Supplier</th>
                <th className="py-3 px-4">Items & Categories</th>
                <th className="py-3 px-4 text-right">Total Qty</th>
                <th className="py-3 px-4 text-right">Landed Cost Value</th>
                <th className="py-3 px-4 text-center">Status</th>
                <th className="py-3 px-4">Received By</th>
                <th className="py-3 px-4 text-right">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-obsidian-800/60">
              {loading ? (
                <tr>
                  <td colSpan="10" className="text-center py-10 text-slate-500 font-mono">
                    Loading historical import records...
                  </td>
                </tr>
              ) : filteredImports.length === 0 ? (
                <tr>
                  <td colSpan="10" className="text-center py-12 text-slate-500">
                    <Ship className="w-8 h-8 mx-auto mb-2 text-slate-600 opacity-50" />
                    <p className="font-semibold text-slate-400">No finalized historical records found for {selectedMonth}</p>
                    <p className="text-[11px] text-slate-500 mt-1">
                      Active and current-month shipments remain in Landed Cost until month-end closing, when they are sealed into history.
                    </p>
                  </td>
                </tr>
              ) : (
                filteredImports.map(imp => {
                  const itemsList = imp.items || [];
                  const firstCategory = itemsList[0]?.category || 'General';
                  const boughtTime = imp.purchaseDate || imp.import_date;
                  const receivedTime = imp.receivedDate || imp.import_date;

                  return (
                    <tr key={imp.id} className="hover:bg-obsidian-800/50 transition-colors">
                      <td className="py-3.5 px-4 font-mono font-bold text-brass-400">
                        {imp.import_ref}
                      </td>
                      <td className="py-3.5 px-4 font-mono text-slate-300 whitespace-nowrap">
                        <div className="text-xs font-semibold">{new Date(boughtTime).toLocaleDateString()}</div>
                        <div className="text-[10px] text-slate-500">{new Date(boughtTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</div>
                      </td>
                      <td className="py-3.5 px-4 font-mono text-emerald-400 whitespace-nowrap">
                        <div className="text-xs font-semibold">{new Date(receivedTime).toLocaleDateString()}</div>
                        <div className="text-[10px] text-emerald-500/80">{new Date(receivedTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</div>
                      </td>
                      <td className="py-3.5 px-4 font-semibold text-slate-200">
                        {imp.supplier_name || 'Standard Import'}
                      </td>
                      <td className="py-3.5 px-4 min-w-[160px]">
                        <div className="flex items-center gap-1.5 whitespace-nowrap">
                          <span className="inline-flex items-center px-2 py-0.5 rounded-md bg-brass-500/15 text-brass-400 font-bold border border-brass-500/30 text-[10px] font-mono">
                            {imp.product_count || itemsList.length || 1} Products
                          </span>
                          {firstCategory && (
                            <span className="inline-flex items-center px-2 py-0.5 rounded-md bg-sky-500/15 text-sky-400 text-[10px] border border-sky-500/30 font-medium">
                              {firstCategory}
                            </span>
                          )}
                        </div>
                        {itemsList.length > 0 && (
                          <div className="text-[11px] text-slate-400 truncate max-w-[200px] mt-1" title={itemsList.map(i => i.productName || i.name).join(', ')}>
                            {itemsList.map(i => i.productName || i.name).slice(0, 2).join(', ')}
                            {itemsList.length > 2 ? ` +${itemsList.length - 2} more` : ''}
                          </div>
                        )}
                      </td>
                      <td className="py-3.5 px-4 text-right font-mono font-bold text-sky-400">
                        {imp.total_quantity?.toLocaleString()}
                      </td>
                      <td className="py-3.5 px-4 text-right font-mono font-black text-emerald-400 text-sm">
                        ${Number(imp.total_import_value || 0).toFixed(2)}
                      </td>
                      <td className="py-3.5 px-4 text-center">
                        <span className="px-2.5 py-0.5 rounded-full text-[10px] font-mono font-bold uppercase bg-emerald-500/10 text-emerald-400 border border-emerald-500/30">
                          {imp.status || 'COMPLETED'}
                        </span>
                      </td>
                      <td className="py-3.5 px-4 text-slate-300 font-medium">
                        <div className="flex items-center space-x-1.5">
                          <User className="w-3 h-3 text-slate-500" />
                          <span>{imp.performed_by_name || 'Administrator'}</span>
                        </div>
                      </td>
                      <td className="py-3.5 px-4 text-right">
                        <button
                          onClick={() => setSelectedImport(imp)}
                          className="px-3 py-1.5 rounded-lg bg-obsidian-800 hover:bg-obsidian-750 text-slate-200 border border-obsidian-700 text-xs font-bold transition hover:border-brass-500/50"
                        >
                          Details
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

      {/* IMPORT RECORD DETAILS MODAL */}
      {selectedImport && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-obsidian-950/80 backdrop-blur-sm p-4">
          <div className="w-full max-w-3xl bg-obsidian-900 border border-obsidian-750 rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh] animate-in zoom-in-95">
            {/* Header */}
            <div className="p-4 border-b border-obsidian-800 flex items-center justify-between bg-obsidian-950/60">
              <div className="flex items-center space-x-3">
                <div className="p-2 rounded-xl bg-brass-500/10 text-brass-400 border border-brass-500/20">
                  <Ship className="w-5 h-5" />
                </div>
                <div>
                  <h2 className="text-sm font-bold text-slate-100 font-mono">
                    {selectedImport.import_ref}
                  </h2>
                  <div className="text-[11px] text-slate-400 flex items-center gap-3 mt-0.5">
                    <span>Bought: <strong className="text-slate-200">{new Date(selectedImport.purchaseDate || selectedImport.import_date).toLocaleString()}</strong></span>
                    <span>•</span>
                    <span>Received: <strong className="text-emerald-400">{new Date(selectedImport.receivedDate || selectedImport.import_date).toLocaleString()}</strong></span>
                  </div>
                </div>
              </div>

              <div className="flex items-center space-x-2">
                <button
                  onClick={() => handlePrintBarcodes(selectedImport.items || [])}
                  className="flex items-center space-x-1.5 px-3 py-1.5 rounded-xl bg-amber-500/20 text-amber-300 border border-amber-500/40 hover:bg-amber-500/30 text-xs font-bold transition"
                  title="Print barcode labels for all items"
                >
                  <Barcode className="w-3.5 h-3.5" />
                  <span>Print Barcodes</span>
                </button>
                <button 
                  onClick={() => setSelectedImport(null)} 
                  className="p-1.5 rounded-lg hover:bg-obsidian-800 text-slate-400 hover:text-white transition"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            </div>

            {/* Content Area */}
            <div className="p-6 space-y-6 overflow-y-auto">
              {/* Summary Metrics */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                <div className="p-3 rounded-xl bg-obsidian-950 border border-obsidian-800">
                  <div className="text-[10px] font-mono text-slate-400 uppercase">Supplier</div>
                  <div className="text-sm font-bold text-slate-200 mt-0.5">{selectedImport.supplier_name || 'Unassigned'}</div>
                </div>
                <div className="p-3 rounded-xl bg-obsidian-950 border border-obsidian-800">
                  <div className="text-[10px] font-mono text-slate-400 uppercase">Received By</div>
                  <div className="text-sm font-bold text-slate-200 mt-0.5">{selectedImport.performed_by_name}</div>
                </div>
                <div className="p-3 rounded-xl bg-obsidian-950 border border-obsidian-800">
                  <div className="text-[10px] font-mono text-slate-400 uppercase">Total Units</div>
                  <div className="text-sm font-bold text-sky-400 font-mono mt-0.5">{selectedImport.total_quantity?.toLocaleString()}</div>
                </div>
                <div className="p-3 rounded-xl bg-obsidian-950 border border-obsidian-800">
                  <div className="text-[10px] font-mono text-slate-400 uppercase">Total Landed Cost</div>
                  <div className="text-sm font-black text-emerald-400 font-mono mt-0.5">${Number(selectedImport.total_import_value || 0).toFixed(2)}</div>
                </div>
              </div>

              {/* Items Breakdown with Pictures */}
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <h3 className="text-xs font-bold text-slate-300 font-mono uppercase tracking-wider">
                    Imported Products & Barcodes ({selectedImport.items?.length || 0})
                  </h3>
                  <span className="text-[11px] text-slate-400">Stock & POS Synchronized</span>
                </div>

                <div className="space-y-2.5 max-h-80 overflow-y-auto pr-1">
                  {(selectedImport.items || []).map((it, idx) => (
                    <div key={idx} className="p-3.5 rounded-xl bg-obsidian-950 border border-obsidian-800 flex items-center justify-between gap-3 hover:border-obsidian-700 transition">
                      <div className="flex items-center space-x-3.5">
                        <div className="w-12 h-12 rounded-xl bg-obsidian-900 border border-obsidian-750 overflow-hidden flex items-center justify-center shrink-0">
                          {it.imageUrl ? (
                            <img src={it.imageUrl} alt={it.productName} className="w-full h-full object-cover" />
                          ) : (
                            <Package className="w-6 h-6 text-slate-600" />
                          )}
                        </div>
                        <div>
                          <div className="font-bold text-xs text-slate-200">{it.productName}</div>
                          <div className="flex items-center gap-2 mt-0.5">
                            <span className="text-[10px] font-mono text-brass-400">SKU: {it.sku || it.skuCode || 'N/A'}</span>
                            {it.barcode && (
                              <span className="text-[10px] font-mono text-sky-400">Barcode: {it.barcode}</span>
                            )}
                            {it.category && (
                              <span className="px-1.5 py-0.2 rounded bg-white/5 text-[9px] text-slate-400">
                                {it.category}
                              </span>
                            )}
                          </div>
                        </div>
                      </div>

                      <div className="flex items-center space-x-5 text-right font-mono">
                        <div>
                          <div className="text-[10px] text-slate-500 uppercase">Qty</div>
                          <div className="text-xs font-bold text-slate-200">{it.quantity}</div>
                        </div>
                        <div>
                          <div className="text-[10px] text-slate-500 uppercase">Unit Landed</div>
                          <div className="text-xs font-bold text-slate-200">${Number(it.unitLandedCost || it.unitCost || 0).toFixed(2)}</div>
                        </div>
                        <div>
                          <div className="text-[10px] text-slate-500 uppercase">Total</div>
                          <div className="text-xs font-bold text-emerald-400">${Number(it.totalCost || (it.quantity * (it.unitLandedCost || it.unitCost || 0))).toFixed(2)}</div>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {selectedImport.notes && (
                <div className="p-3 rounded-xl bg-obsidian-950 border border-obsidian-800 text-xs text-slate-400">
                  <span className="font-bold text-slate-300">Notes: </span>
                  {selectedImport.notes}
                </div>
              )}
            </div>

            {/* Footer */}
            <div className="p-4 border-t border-obsidian-800 bg-obsidian-950/60 flex items-center justify-between">
              <span className="text-[10px] font-mono text-slate-500">
                Sealed Historical Audit Record • Landed Cost Verified
              </span>
              <button
                onClick={() => setSelectedImport(null)}
                className="px-4 py-2 rounded-xl bg-obsidian-800 hover:bg-obsidian-750 text-slate-200 text-xs font-bold transition"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* BARCODE LABEL PRINT MODAL */}
      {barcodeModalItem && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-obsidian-950/85 backdrop-blur-sm p-4">
          <div className="w-full max-w-xl bg-obsidian-900 border border-obsidian-750 rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
            <div className="p-4 border-b border-obsidian-800 flex items-center justify-between bg-obsidian-950/60">
              <div className="flex items-center space-x-2">
                <Barcode className="w-5 h-5 text-brass-400" />
                <h2 className="text-sm font-bold text-slate-100 uppercase tracking-wider font-display">
                  Print Product Barcode Labels
                </h2>
              </div>
              <button onClick={() => setBarcodeModalItem(null)} className="text-slate-400 hover:text-white">
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="p-6 space-y-4 overflow-y-auto">
              <div className="p-3 rounded-xl bg-obsidian-950 border border-obsidian-800 flex items-center justify-between">
                <div>
                  <div className="text-xs font-bold text-slate-200">Print Quantity Per Product</div>
                  <div className="text-[11px] text-slate-400">Standard 50mm x 30mm thermal retail stickers</div>
                </div>
                <div className="flex items-center space-x-2">
                  <input
                    type="number"
                    min="1"
                    max="100"
                    value={labelQuantity}
                    onChange={(e) => setLabelQuantity(Math.max(1, parseInt(e.target.value, 10) || 1))}
                    className="w-16 px-2 py-1 rounded-lg bg-obsidian-900 border border-obsidian-750 text-slate-200 text-center font-mono text-xs"
                  />
                  <span className="text-xs text-slate-400 font-mono">copies</span>
                </div>
              </div>

              {/* Label Preview Sheet */}
              <div className="border border-obsidian-800 rounded-xl p-4 bg-white text-black space-y-4 max-h-72 overflow-y-auto">
                {(barcodeModalItem || []).map((it, idx) => (
                  <div key={idx} className="p-3 border-2 border-dashed border-gray-300 rounded-lg flex flex-col items-center text-center font-sans space-y-1 bg-white">
                    <div className="text-[10px] font-black tracking-wider uppercase text-gray-800">
                      BEYONDVER RETAIL
                    </div>
                    <div className="text-xs font-bold text-black max-w-xs truncate">
                      {it.productName}
                    </div>
                    {/* Simulated SVG Barcode */}
                    <div className="py-1">
                      <svg className="w-48 h-10" viewBox="0 0 100 24" preserveAspectRatio="none">
                        <rect x="0" y="0" width="2" height="24" fill="#000" />
                        <rect x="3" y="0" width="1" height="24" fill="#000" />
                        <rect x="6" y="0" width="3" height="24" fill="#000" />
                        <rect x="11" y="0" width="1" height="24" fill="#000" />
                        <rect x="14" y="0" width="2" height="24" fill="#000" />
                        <rect x="18" y="0" width="3" height="24" fill="#000" />
                        <rect x="23" y="0" width="1" height="24" fill="#000" />
                        <rect x="26" y="0" width="2" height="24" fill="#000" />
                        <rect x="30" y="0" width="1" height="24" fill="#000" />
                        <rect x="33" y="0" width="3" height="24" fill="#000" />
                        <rect x="38" y="0" width="2" height="24" fill="#000" />
                        <rect x="42" y="0" width="1" height="24" fill="#000" />
                        <rect x="45" y="0" width="3" height="24" fill="#000" />
                        <rect x="50" y="0" width="2" height="24" fill="#000" />
                        <rect x="54" y="0" width="1" height="24" fill="#000" />
                        <rect x="57" y="0" width="3" height="24" fill="#000" />
                        <rect x="62" y="0" width="2" height="24" fill="#000" />
                        <rect x="66" y="0" width="1" height="24" fill="#000" />
                        <rect x="69" y="0" width="3" height="24" fill="#000" />
                        <rect x="74" y="0" width="2" height="24" fill="#000" />
                        <rect x="78" y="0" width="1" height="24" fill="#000" />
                        <rect x="81" y="0" width="3" height="24" fill="#000" />
                        <rect x="86" y="0" width="2" height="24" fill="#000" />
                        <rect x="90" y="0" width="1" height="24" fill="#000" />
                        <rect x="93" y="0" width="3" height="24" fill="#000" />
                        <rect x="98" y="0" width="2" height="24" fill="#000" />
                      </svg>
                      <div className="font-mono text-[10px] tracking-widest text-black">
                        {it.barcode || '880392817263'}
                      </div>
                    </div>
                    <div className="flex items-center justify-between w-full px-2 text-[10px] font-mono text-gray-700">
                      <span>SKU: {it.sku || it.skuCode}</span>
                      <span className="font-bold text-black text-xs">${Number(it.targetRetailPrice || 25).toFixed(2)}</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div className="p-4 border-t border-obsidian-800 bg-obsidian-950/60 flex items-center justify-between">
              <button
                onClick={() => setBarcodeModalItem(null)}
                className="px-4 py-2 rounded-xl bg-obsidian-800 hover:bg-obsidian-750 text-slate-200 text-xs font-bold transition"
              >
                Cancel
              </button>
              <button
                onClick={() => {
                  window.print();
                  showToast('Sent to printer!');
                }}
                className="px-4 py-2 rounded-xl bg-brass-500 hover:bg-brass-400 text-obsidian-950 text-xs font-bold transition shadow-md shadow-brass-500/20 flex items-center space-x-1.5"
              >
                <Printer className="w-4 h-4" />
                <span>Print Labels Now</span>
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
