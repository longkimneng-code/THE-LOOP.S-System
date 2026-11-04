import React from 'react';
import Icon from './Icon';

export default function ExportModal({ isOpen, onClose, onExportExcel, onExportPDF, onExportWord, onExportCSV }) {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 bg-studio-950/80 backdrop-blur-md flex items-center justify-center p-3 sm:p-4 animate-in fade-in duration-150">
      <div className="glass-panel-elevated w-full max-w-2xl max-h-[92vh] rounded-2xl overflow-hidden flex flex-col border border-white/15 shadow-2xl">
        <div className="p-4 sm:p-6 border-b border-white/10 flex items-center justify-between bg-studio-900/60">
          <div>
            <div className="flex items-center space-x-2">
              <span className="px-2 py-0.5 rounded font-mono text-[10px] bg-gold-500/20 text-gold-400 border border-gold-500/30 font-bold uppercase">
                Universal Data Portability
              </span>
            </div>
            <h3 className="font-display font-extrabold text-lg sm:text-xl text-white mt-1">Export Retail Inventory & Valuation</h3>
            <p className="text-xs text-studio-400 mt-0.5">Download live inventory files, valuation spreadsheets, or formal audit documents.</p>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-lg bg-white/5 hover:bg-white/10 text-studio-400 hover:text-white flex items-center justify-center border border-white/10 transition-colors"
            aria-label="Close modal"
          >
            <Icon name="close" size={14} />
          </button>
        </div>

        <div className="p-4 sm:p-6 space-y-4 text-xs overflow-y-auto">
          {/* Excel .xlsx */}
          <div className="p-4 rounded-xl bg-studio-900/80 border border-white/10 hover:border-emerald-500/50 transition-all flex flex-col sm:flex-row sm:items-center justify-between gap-3 group shadow-sm">
            <div className="space-y-1">
              <div className="flex items-center space-x-2">
                <div className="w-7 h-7 rounded-lg bg-emerald-500/10 text-emerald-400 flex items-center justify-center">
                  <Icon name="catalog" size={15} />
                </div>
                <h4 className="font-display font-bold text-sm text-white group-hover:text-emerald-400 transition-colors">
                  Microsoft Excel Workbook (.xlsx)
                </h4>
                <span className="px-1.5 py-0.5 text-[9px] font-mono bg-emerald-500/20 text-emerald-400 rounded">
                  Multi-Sheet
                </span>
              </div>
              <p className="text-xs text-studio-400 max-w-md">
                Multi-sheet workbook with Master Inventory, SKU Barcodes, Location Balances, and Historical Movement Ledger.
              </p>
            </div>
            <button
              onClick={onExportExcel}
              className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white font-mono text-xs font-semibold rounded-xl shadow-md transition-all flex items-center justify-center space-x-1.5 whitespace-nowrap active:scale-95"
            >
              <Icon name="export" size={13} />
              <span>Download .xlsx</span>
            </button>
          </div>

          {/* PDF Report */}
          <div className="p-4 rounded-xl bg-studio-900/80 border border-white/10 hover:border-gold-500/50 transition-all flex flex-col sm:flex-row sm:items-center justify-between gap-3 group shadow-sm">
            <div className="space-y-1">
              <div className="flex items-center space-x-2">
                <div className="w-7 h-7 rounded-lg bg-gold-500/10 text-gold-400 flex items-center justify-center">
                  <Icon name="reports" size={15} />
                </div>
                <h4 className="font-display font-bold text-sm text-white group-hover:text-gold-400 transition-colors">
                  Executive PDF Stock Report (.pdf)
                </h4>
                <span className="px-1.5 py-0.5 text-[9px] font-mono bg-gold-500/20 text-gold-400 rounded">
                  Audit Ready
                </span>
              </div>
              <p className="text-xs text-studio-400 max-w-md">
                Formal retail inventory valuation report with executive KPIs, color-coded status badges, and official accounting sign-off lines.
              </p>
            </div>
            <button
              onClick={onExportPDF}
              className="px-4 py-2 bg-gold-500 hover:bg-gold-400 text-studio-950 font-mono text-xs font-bold rounded-xl shadow-md transition-all whitespace-nowrap text-center active:scale-95 flex items-center justify-center space-x-1.5"
            >
              <Icon name="export" size={13} />
              <span>Download .pdf</span>
            </button>
          </div>

          {/* Word Document */}
          <div className="p-4 rounded-xl bg-studio-900/80 border border-white/10 hover:border-indigo-500/50 transition-all flex flex-col sm:flex-row sm:items-center justify-between gap-3 group shadow-sm">
            <div className="space-y-1">
              <div className="flex items-center space-x-2">
                <div className="w-7 h-7 rounded-lg bg-indigo-500/10 text-indigo-400 flex items-center justify-center">
                  <Icon name="sales" size={15} />
                </div>
                <h4 className="font-display font-bold text-sm text-white group-hover:text-indigo-400 transition-colors">
                  Word Document Stock File (.doc)
                </h4>
                <span className="px-1.5 py-0.5 text-[9px] font-mono bg-indigo-500/20 text-indigo-400 rounded">
                  Fully Editable
                </span>
              </div>
              <p className="text-xs text-studio-400 max-w-md">
                Downloadable Microsoft Word compatible document with structured inventory tables, specifications, and valuation summaries.
              </p>
            </div>
            <button
              onClick={onExportWord}
              className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white font-mono text-xs font-semibold rounded-xl shadow-md transition-all flex items-center justify-center space-x-1.5 whitespace-nowrap active:scale-95"
            >
              <Icon name="export" size={13} />
              <span>Download .doc</span>
            </button>
          </div>

          {/* Universal CSV */}
          <div className="p-4 rounded-xl bg-studio-900/80 border border-white/10 hover:border-purple-500/50 transition-all flex flex-col sm:flex-row sm:items-center justify-between gap-3 group shadow-sm">
            <div className="space-y-1">
              <div className="flex items-center space-x-2">
                <div className="w-7 h-7 rounded-lg bg-purple-500/10 text-purple-400 flex items-center justify-center">
                  <Icon name="inventory" size={15} />
                </div>
                <h4 className="font-display font-bold text-sm text-white group-hover:text-purple-400 transition-colors">
                  Universal Excel CSV (.csv)
                </h4>
                <span className="px-1.5 py-0.5 text-[9px] font-mono bg-purple-500/20 text-purple-400 rounded">
                  UTF-8 BOM
                </span>
              </div>
              <p className="text-xs text-studio-400 max-w-md">
                Lightweight comma-separated file with UTF-8 BOM encoding for seamless import into Excel, Google Sheets, or POS systems.
              </p>
            </div>
            <button
              onClick={onExportCSV}
              className="px-4 py-2 bg-studio-800 hover:bg-studio-700 text-white border border-white/10 font-mono text-xs font-semibold rounded-xl transition-all whitespace-nowrap text-center active:scale-95 flex items-center justify-center space-x-1.5"
            >
              <Icon name="export" size={13} />
              <span>Download .csv</span>
            </button>
          </div>
        </div>

        <div className="p-4 border-t border-white/10 bg-studio-900/60 flex items-center justify-between">
          <span className="text-[11px] font-mono text-studio-400">All exports generated in real-time from active ledger state.</span>
          <button
            onClick={onClose}
            className="px-4 py-2 bg-studio-800 hover:bg-studio-700 text-xs font-semibold text-white rounded-xl transition-all"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}
