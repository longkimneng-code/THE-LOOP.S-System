import React, { useState, useEffect } from 'react';
import { 
  Users, 
  Plus, 
  ArrowDownRight, 
  Clock, 
  DollarSign, 
  CheckCircle, 
  FileText,
  CreditCard,
  Building
} from 'lucide-react';
import { api, formatMoney } from '../api';

export default function SalesCustomers({ mode, onShowToast }) {
  const [invoices, setInvoices] = useState([]);
  const [loading, setLoading] = useState(true);
  const [isNewSaleOpen, setIsNewSaleOpen] = useState(false);
  const [saleForm, setSaleForm] = useState({
    customerName: '',
    subtotal: '',
    discountAmount: '0',
    landedCogsAmount: '',
    channel: 'RETAIL_POS',
    isPaid: true
  });

  useEffect(() => {
    loadInvoices();
  }, []);

  const loadInvoices = async () => {
    try {
      const data = await api.getInvoices();
      setInvoices(data);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const handleCreateSale = async (e) => {
    e.preventDefault();
    try {
      await api.createInvoice({
        customerName: saleForm.customerName,
        subtotal: Number(saleForm.subtotal),
        discountAmount: Number(saleForm.discountAmount),
        landedCogsAmount: Number(saleForm.landedCogsAmount),
        channel: saleForm.channel,
        isPaid: saleForm.isPaid
      });
      setIsNewSaleOpen(false);
      setSaleForm({
        customerName: '',
        subtotal: '',
        discountAmount: '0',
        landedCogsAmount: '',
        channel: 'RETAIL_POS',
        isPaid: true
      });
      onShowToast('Sale recorded & landed COGS journal posted!', 'success');
      loadInvoices();
    } catch (err) {
      onShowToast(err.message, 'error');
    }
  };

  const totalSales = invoices.reduce((sum, inv) => sum + Number(inv.totalAmount || 0), 0);
  const totalCogs = invoices.reduce((sum, inv) => sum + Number(inv.landedCogsAmount || 0), 0);
  const totalGrossProfit = totalSales - totalCogs;

  return (
    <div className="space-y-6">
      
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-4 pb-4 border-b border-white/10">
        <div>
          <h2 className="text-xl font-bold text-white flex items-center gap-2">
            <Users className="w-5 h-5 text-[#38BDF8]" />
            Sales & Customers (Accounts Receivable)
          </h2>
          <p className="text-xs text-slate-400 mt-1">
            Tracks customer sales orders, POS receipts, customer deposits (Account 2080), and automatic landed COGS derecognition.
          </p>
        </div>

        <button
          onClick={() => setIsNewSaleOpen(true)}
          className="flex items-center gap-2 px-4 py-2 rounded-xl bg-[#38BDF8] hover:bg-[#0ea5e9] text-black text-xs font-bold transition shadow-lg shadow-[#38BDF8]/20"
        >
          <Plus className="w-4 h-4" />
          <span>Record Sale / Invoice</span>
        </button>
      </div>

      {/* 3 Metrics */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="glass-card p-4">
          <span className="text-[11px] text-slate-400 uppercase font-medium">Total Billed Sales</span>
          <div className="text-2xl font-bold text-white num-font mt-1">{formatMoney(totalSales)}</div>
        </div>

        <div className="glass-card p-4">
          <span className="text-[11px] text-slate-400 uppercase font-medium">Landed COGS of Sold Items</span>
          <div className="text-2xl font-bold text-rose-300 num-font mt-1">-{formatMoney(totalCogs)}</div>
        </div>

        <div className="glass-card p-4">
          <span className="text-[11px] text-slate-400 uppercase font-medium">Realized Gross Profit</span>
          <div className="text-2xl font-bold text-[#10B981] num-font mt-1">{formatMoney(totalGrossProfit)}</div>
        </div>
      </div>

      {/* Invoices Table */}
      <div className="glass-card overflow-hidden">
        <div className="p-4 border-b border-white/10 flex items-center justify-between">
          <h3 className="text-sm font-bold text-white flex items-center gap-2">
            <FileText className="w-4 h-4 text-slate-400" />
            Customer Sales & Invoices
          </h3>
          <span className="text-xs text-slate-400 font-mono">{invoices.length} Records</span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-xs text-left">
            <thead className="bg-[#111520] text-slate-400 border-b border-white/10 uppercase tracking-wider font-semibold">
              <tr>
                <th className="py-3 px-4">Invoice #</th>
                <th className="py-3 px-4">Customer</th>
                <th className="py-3 px-3">Date</th>
                <th className="py-3 px-3">Channel</th>
                <th className="py-3 px-3 text-right">Revenue</th>
                <th className="py-3 px-3 text-right">Landed Cost</th>
                <th className="py-3 px-3 text-right">Gross Profit</th>
                <th className="py-3 px-4 text-center">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/5">
              {invoices.map((inv) => {
                const profit = inv.totalAmount - (inv.landedCogsAmount || 0);
                return (
                  <tr key={inv.id} className="hover:bg-white/5 transition">
                    <td className="py-3 px-4 font-mono font-bold text-white">{inv.invoiceNumber}</td>
                    <td className="py-3 px-4 text-slate-200 font-medium">{inv.customerName}</td>
                    <td className="py-3 px-3 text-slate-400 font-mono">{inv.invoiceDate}</td>
                    <td className="py-3 px-3">
                      <span className="px-2 py-0.5 rounded text-[10px] font-mono bg-white/5 text-slate-300">
                        {inv.channel}
                      </span>
                    </td>
                    <td className="py-3 px-3 text-right num-font font-bold text-white">
                      {formatMoney(inv.totalAmount)}
                    </td>
                    <td className="py-3 px-3 text-right num-font text-slate-400">
                      -{formatMoney(inv.landedCogsAmount || 0)}
                    </td>
                    <td className="py-3 px-3 text-right num-font font-bold text-[#10B981]">
                      +{formatMoney(profit)}
                    </td>
                    <td className="py-3 px-4 text-center">
                      <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                        inv.status === 'PAID'
                          ? 'bg-[#10B981]/20 text-[#10B981]'
                          : 'bg-amber-500/20 text-amber-300'
                      }`}>
                        {inv.status}
                      </span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* MODAL: RECORD SALE */}
      {isNewSaleOpen && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="glass-card-elevated w-full max-w-md p-6 border border-white/20 animate-in fade-in">
            <h3 className="text-base font-bold text-white mb-1">Record New Customer Sale</h3>
            <p className="text-xs text-slate-400 mb-4">
              Posts revenue and relieves inventory asset using weighted-average landed cost.
            </p>

            <form onSubmit={handleCreateSale} className="space-y-3.5 text-xs">
              <div>
                <label className="block text-slate-300 font-medium mb-1">Customer Name</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Retail Walk-in Customer"
                  value={saleForm.customerName}
                  onChange={(e) => setSaleForm({ ...saleForm, customerName: e.target.value })}
                  className="w-full bg-[#111520] border border-white/10 rounded-lg p-2.5 text-white"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-slate-300 font-medium mb-1">Subtotal ($)</label>
                  <input
                    type="number"
                    step="0.01"
                    required
                    placeholder="280.00"
                    value={saleForm.subtotal}
                    onChange={(e) => setSaleForm({ ...saleForm, subtotal: e.target.value })}
                    className="w-full bg-[#111520] border border-white/10 rounded-lg p-2.5 text-white num-font"
                  />
                </div>
                <div>
                  <label className="block text-slate-300 font-medium mb-1">Landed COGS ($)</label>
                  <input
                    type="number"
                    step="0.01"
                    required
                    placeholder="117.70"
                    value={saleForm.landedCogsAmount}
                    onChange={(e) => setSaleForm({ ...saleForm, landedCogsAmount: e.target.value })}
                    className="w-full bg-[#111520] border border-white/10 rounded-lg p-2.5 text-white num-font"
                  />
                </div>
              </div>

              <div>
                <label className="block text-slate-300 font-medium mb-1">Sales Channel</label>
                <select
                  value={saleForm.channel}
                  onChange={(e) => setSaleForm({ ...saleForm, channel: e.target.value })}
                  className="w-full bg-[#111520] border border-white/10 rounded-lg p-2.5 text-white"
                >
                  <option value="RETAIL_POS">Store POS Terminal</option>
                  <option value="ONLINE_STORE">Online / E-Commerce</option>
                  <option value="WHOLESALE">B2B Wholesale Consignment</option>
                </select>
              </div>

              <div className="flex items-center gap-2 pt-2">
                <input
                  type="checkbox"
                  id="isPaid"
                  checked={saleForm.isPaid}
                  onChange={(e) => setSaleForm({ ...saleForm, isPaid: e.target.checked })}
                  className="rounded border-white/20 bg-slate-800 text-[#E5A93C]"
                />
                <label htmlFor="isPaid" className="text-slate-300 font-medium">
                  Payment collected immediately (Cash / Card at POS)
                </label>
              </div>

              <div className="flex justify-end gap-2.5 pt-4 border-t border-white/10">
                <button
                  type="button"
                  onClick={() => setIsNewSaleOpen(false)}
                  className="px-4 py-2 rounded-lg bg-white/5 text-slate-300 hover:bg-white/10"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 rounded-lg bg-[#38BDF8] text-black font-bold hover:bg-[#0ea5e9]"
                >
                  Record Sale & Post Journal
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

    </div>
  );
}

