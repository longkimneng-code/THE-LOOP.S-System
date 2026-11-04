import React, { useState, useEffect } from 'react';
import { 
  X, 
  ShoppingBag, 
  Receipt, 
  Tag, 
  Ship, 
  Coins, 
  FileText,
  DollarSign,
  Lock,
  ShieldAlert
} from 'lucide-react';
import { api, formatMoney } from '../api';
import ConfirmModal from './ConfirmModal';

export default function GlobalNewModal({ isOpen, onClose, mode, onShowToast, onRefresh, currentUser }) {
  const [activeTab, setActiveTab] = useState('sale');

  // Role check
  const storedUser = (() => {
    try {
      return JSON.parse(localStorage.getItem('loops_auth_user') || '{}');
    } catch (e) {
      return {};
    }
  })();
  const userRole = (
    currentUser?.role ||
    storedUser?.role ||
    localStorage.getItem('loops_finance_role') ||
    localStorage.getItem('loops_stock_role') ||
    'OWNER'
  ).toUpperCase();

  const canManageCapital = ['OWNER', 'ADMIN', 'SUPER_ADMIN', 'FINANCE_ADMIN', 'MANAGING_DIRECTOR'].includes(userRole);

  // Form states
  const [saleForm, setSaleForm] = useState({ customerName: '', subtotal: '', landedCogs: '' });
  const [billForm, setBillForm] = useState({ supplierName: '', billNumber: '', totalAmount: '', depositPaid: '' });
  const [expenseForm, setExpenseForm] = useState({ vendorPayee: '', category: 'Rent & Store Utilities', amount: '' });
  const [capitalForm, setCapitalForm] = useState({ capitalAccountId: '', partnerName: '', type: 'CAPITAL_INJECTION', amount: '' });
  const [partners, setPartners] = useState([]);

  // Confirmation Modal State
  const [confirmConfig, setConfirmConfig] = useState({
    isOpen: false,
    title: '',
    subtitle: '',
    variant: 'primary',
    details: [],
    confirmText: 'Confirm',
    onConfirm: null,
    isLoading: false
  });

  useEffect(() => {
    if (isOpen) {
      api.getCapital().then(res => {
        setPartners(res.accounts || []);
      }).catch(() => {});
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const handleSaleSubmit = async (e) => {
    e.preventDefault();
    try {
      await api.createInvoice({
        customerName: saleForm.customerName,
        subtotal: Number(saleForm.subtotal),
        landedCogsAmount: Number(saleForm.landedCogs),
        isPaid: true
      });
      onShowToast('Sale recorded successfully!', 'success');
      onRefresh();
      onClose();
    } catch (err) {
      onShowToast(err.message, 'error');
    }
  };

  const handleBillSubmit = async (e) => {
    e.preventDefault();
    try {
      await api.createBill({
        supplierName: billForm.supplierName,
        billNumber: billForm.billNumber,
        totalAmount: Number(billForm.totalAmount),
        depositPaid: Number(billForm.depositPaid) || 0
      });
      onShowToast('Supplier bill recorded in AP!', 'success');
      onRefresh();
      onClose();
    } catch (err) {
      onShowToast(err.message, 'error');
    }
  };

  const handleExpenseSubmit = async (e) => {
    e.preventDefault();
    try {
      await api.createExpense({
        vendorPayee: expenseForm.vendorPayee,
        category: expenseForm.category,
        amount: Number(expenseForm.amount)
      });
      onShowToast('Expense recorded & posted to ledger!', 'success');
      onRefresh();
      onClose();
    } catch (err) {
      onShowToast(err.message, 'error');
    }
  };

  const handleCapitalSubmit = (e) => {
    e.preventDefault();
    if (!canManageCapital) {
      onShowToast('Access denied: Only Business Owners and Executive Directors can record capital transactions.', 'error');
      return;
    }
    if (!capitalForm.capitalAccountId) {
      onShowToast('Please select a partner/investor from the list.', 'error');
      return;
    }
    const numAmount = Number(capitalForm.amount);
    if (!numAmount || numAmount <= 0) {
      onShowToast('Please enter a valid amount greater than $0.00.', 'error');
      return;
    }

    const selectedPartner = partners.find(p => p.id === capitalForm.capitalAccountId);
    const partnerName = selectedPartner ? selectedPartner.partnerName : capitalForm.partnerName;
    const partnerRole = selectedPartner ? selectedPartner.partnerRole : 'Partner';

    const typeLabels = {
      CAPITAL_INJECTION: 'Capital Injection (Money in to equity)',
      OWNER_DRAWING: 'Owner Drawing (Money out by founder)',
      DIVIDEND_PAYOUT: 'Dividend Payout (Profit distribution)'
    };

    setConfirmConfig({
      isOpen: true,
      title: 'Confirm Capital Entry',
      subtitle: 'Post this capital transaction into the General Equity Ledger?',
      variant: capitalForm.type === 'CAPITAL_INJECTION' ? 'success' : 'warning',
      details: [
        { label: 'Investor / Partner', value: `${partnerName} (${partnerRole})` },
        { label: 'Transaction Type', value: typeLabels[capitalForm.type] || capitalForm.type },
        { label: 'Amount', value: formatMoney(numAmount), highlight: true }
      ],
      confirmText: 'Confirm & Post',
      onConfirm: async () => {
        setConfirmConfig(prev => ({ ...prev, isLoading: true }));
        try {
          await api.addCapitalTransaction({
            capitalAccountId: capitalForm.capitalAccountId,
            partnerName: partnerName,
            type: capitalForm.type,
            amount: numAmount
          });
          setConfirmConfig({ isOpen: false, details: [] });
          onShowToast('Capital entry recorded in Equity ledger!', 'success');
          onRefresh();
          onClose();
        } catch (err) {
          onShowToast(err.message, 'error');
          setConfirmConfig(prev => ({ ...prev, isLoading: false }));
        }
      }
    });
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="glass-card-elevated w-full max-w-lg p-6 border border-white/20 animate-in fade-in">
        
        {/* Header */}
        <div className="flex items-center justify-between pb-4 border-b border-white/10">
          <div>
            <h3 className="text-base font-bold text-white flex items-center gap-2">
              <span className="w-2.5 h-2.5 rounded-full bg-[#E5A93C]" />
              Quick Action (+ New Transaction)
            </h3>
            <p className="text-xs text-slate-400">
              Record money in/out or create a document with instant balanced ledger posting.
            </p>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded-lg text-slate-400 hover:text-white hover:bg-white/10"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Quick Nav Pills */}
        <div className="flex flex-wrap gap-1.5 py-3 border-b border-white/5 text-xs">
          {[
            { id: 'sale', label: 'Record Sale', icon: ShoppingBag },
            { id: 'bill', label: 'Supplier Bill', icon: Receipt },
            { id: 'expense', label: 'Expense', icon: Tag },
            { id: 'capital', label: 'Capital In / Out', icon: Coins }
          ].map((tab) => {
            const Icon = tab.icon;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg font-semibold transition ${
                  activeTab === tab.id
                    ? 'bg-[#E5A93C] text-black font-bold'
                    : 'bg-white/5 text-slate-300 hover:bg-white/10'
                }`}
              >
                <Icon className="w-3.5 h-3.5" />
                {tab.label}
              </button>
            );
          })}
        </div>

        {/* Form Body */}
        <div className="pt-4 text-xs">
          {activeTab === 'sale' && (
            <form onSubmit={handleSaleSubmit} className="space-y-3">
              <div>
                <label className="block text-slate-300 mb-1">Customer / Channel</label>
                <input
                  type="text"
                  required
                  placeholder="POS Register Sale"
                  value={saleForm.customerName}
                  onChange={(e) => setSaleForm({ ...saleForm, customerName: e.target.value })}
                  className="w-full bg-[#111520] border border-white/10 rounded-lg p-2.5 text-white"
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-slate-300 mb-1">Sale Revenue ($)</label>
                  <input
                    type="number"
                    step="0.01"
                    required
                    placeholder="250.00"
                    value={saleForm.subtotal}
                    onChange={(e) => setSaleForm({ ...saleForm, subtotal: e.target.value })}
                    className="w-full bg-[#111520] border border-white/10 rounded-lg p-2.5 text-white num-font"
                  />
                </div>
                <div>
                  <label className="block text-slate-300 mb-1">Landed COGS ($)</label>
                  <input
                    type="number"
                    step="0.01"
                    required
                    placeholder="110.00"
                    value={saleForm.landedCogs}
                    onChange={(e) => setSaleForm({ ...saleForm, landedCogs: e.target.value })}
                    className="w-full bg-[#111520] border border-white/10 rounded-lg p-2.5 text-white num-font"
                  />
                </div>
              </div>
              <div className="flex justify-end gap-2 pt-3">
                <button type="submit" className="px-4 py-2 rounded-lg bg-[#E5A93C] text-black font-bold">
                  Save Sale & Post COGS
                </button>
              </div>
            </form>
          )}

          {activeTab === 'bill' && (
            <form onSubmit={handleBillSubmit} className="space-y-3">
              <div>
                <label className="block text-slate-300 mb-1">Supplier Name</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Hong Kong Precision"
                  value={billForm.supplierName}
                  onChange={(e) => setBillForm({ ...billForm, supplierName: e.target.value })}
                  className="w-full bg-[#111520] border border-white/10 rounded-lg p-2.5 text-white"
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-slate-300 mb-1">Bill #</label>
                  <input
                    type="text"
                    required
                    placeholder="INV-5521"
                    value={billForm.billNumber}
                    onChange={(e) => setBillForm({ ...billForm, billNumber: e.target.value })}
                    className="w-full bg-[#111520] border border-white/10 rounded-lg p-2.5 text-white font-mono"
                  />
                </div>
                <div>
                  <label className="block text-slate-300 mb-1">Total Bill ($)</label>
                  <input
                    type="number"
                    step="0.01"
                    required
                    placeholder="3000.00"
                    value={billForm.totalAmount}
                    onChange={(e) => setBillForm({ ...billForm, totalAmount: e.target.value })}
                    className="w-full bg-[#111520] border border-white/10 rounded-lg p-2.5 text-white num-font"
                  />
                </div>
              </div>
              <div className="flex justify-end gap-2 pt-3">
                <button type="submit" className="px-4 py-2 rounded-lg bg-[#F43F5E] text-white font-bold">
                  Save Bill to Accounts Payable
                </button>
              </div>
            </form>
          )}

          {activeTab === 'expense' && (
            <form onSubmit={handleExpenseSubmit} className="space-y-3">
              <div>
                <label className="block text-slate-300 mb-1">Payee</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Meta Ads, Retail Mall Rent"
                  value={expenseForm.vendorPayee}
                  onChange={(e) => setExpenseForm({ ...expenseForm, vendorPayee: e.target.value })}
                  className="w-full bg-[#111520] border border-white/10 rounded-lg p-2.5 text-white"
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-slate-300 mb-1">Category</label>
                  <select
                    value={expenseForm.category}
                    onChange={(e) => setExpenseForm({ ...expenseForm, category: e.target.value })}
                    className="w-full bg-[#111520] border border-white/10 rounded-lg p-2.5 text-white"
                  >
                    <option value="Rent & Store Utilities">Rent & Utilities</option>
                    <option value="Marketing and Advertising">Marketing Ads</option>
                    <option value="Payroll & Staff Wages">Staff Payroll</option>
                    <option value="Direct Selling Costs">Packaging & Consumables</option>
                    <option value="Administration & Software">SaaS Software</option>
                  </select>
                </div>
                <div>
                  <label className="block text-slate-300 mb-1">Amount ($)</label>
                  <input
                    type="number"
                    step="0.01"
                    required
                    placeholder="450.00"
                    value={expenseForm.amount}
                    onChange={(e) => setExpenseForm({ ...expenseForm, amount: e.target.value })}
                    className="w-full bg-[#111520] border border-white/10 rounded-lg p-2.5 text-white num-font"
                  />
                </div>
              </div>
              <div className="flex justify-end gap-2 pt-3">
                <button type="submit" className="px-4 py-2 rounded-lg bg-[#E5A93C] text-black font-bold">
                  Post Expense
                </button>
              </div>
            </form>
          )}

          {activeTab === 'capital' && (
            <div>
              {!canManageCapital && (
                <div className="p-3 bg-amber-500/10 border border-amber-500/20 rounded-xl text-amber-300 text-xs flex items-center gap-2 mb-3">
                  <ShieldAlert className="w-4 h-4 flex-shrink-0" />
                  <span>
                    Capital management is restricted to Executive and Owner roles. Current role: <strong className="font-mono">{userRole}</strong>.
                  </span>
                </div>
              )}

              <form onSubmit={handleCapitalSubmit} className="space-y-3">
                <div>
                  <label className="block text-slate-300 mb-1">
                    Select Investor / Partner <span className="text-rose-400">*</span>
                  </label>
                  <select
                    required
                    value={capitalForm.capitalAccountId}
                    onChange={(e) => {
                      const selected = partners.find(p => p.id === e.target.value);
                      setCapitalForm({
                        ...capitalForm,
                        capitalAccountId: e.target.value,
                        partnerName: selected ? selected.partnerName : ''
                      });
                    }}
                    className="w-full bg-[#111520] border border-white/10 rounded-lg p-2.5 text-white"
                  >
                    <option value="">-- Select Registered Investor / Partner --</option>
                    {partners.map(p => (
                      <option key={p.id} value={p.id}>
                        {p.partnerName} — {p.partnerRole || 'Partner'} ({p.ownershipPercentage}% Equity)
                      </option>
                    ))}
                  </select>
                  {partners.length === 0 && (
                    <p className="text-[11px] text-amber-400 mt-1">
                      No investors found. Please register an investor in Accounting & Settings first.
                    </p>
                  )}
                </div>

                <div>
                  <label className="block text-slate-300 mb-1">Transaction Type</label>
                  <select
                    value={capitalForm.type}
                    onChange={(e) => setCapitalForm({ ...capitalForm, type: e.target.value })}
                    className="w-full bg-[#111520] border border-white/10 rounded-lg p-2.5 text-white"
                  >
                    <option value="CAPITAL_INJECTION">Capital Injection (Money in to equity)</option>
                    <option value="OWNER_DRAWING">Owner Drawing (Money out by founder)</option>
                    <option value="DIVIDEND_PAYOUT">Dividend Payout (Profit distribution)</option>
                  </select>
                </div>
                <div>
                  <label className="block text-slate-300 mb-1">
                    Amount ($) <span className="text-rose-400">*</span>
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    min="0.01"
                    required
                    placeholder="0.00"
                    value={capitalForm.amount}
                    onChange={(e) => setCapitalForm({ ...capitalForm, amount: e.target.value })}
                    className="w-full bg-[#111520] border border-white/10 rounded-lg p-2.5 text-white num-font"
                  />
                </div>
                <div className="flex justify-end gap-2 pt-3">
                  <button
                    type="submit"
                    disabled={!canManageCapital}
                    className={`px-4 py-2 rounded-lg font-bold ${
                      canManageCapital
                        ? 'bg-[#E5A93C] text-black hover:bg-[#F3C368]'
                        : 'bg-slate-700 text-slate-400 cursor-not-allowed opacity-60'
                    }`}
                  >
                    Post to Equity
                  </button>
                </div>
              </form>
            </div>
          )}
        </div>

      </div>

      {/* CONFIRMATION MODAL */}
      <ConfirmModal
        isOpen={confirmConfig.isOpen}
        title={confirmConfig.title}
        subtitle={confirmConfig.subtitle}
        details={confirmConfig.details}
        confirmText={confirmConfig.confirmText}
        variant={confirmConfig.variant}
        isLoading={confirmConfig.isLoading}
        onConfirm={confirmConfig.onConfirm}
        onCancel={() => setConfirmConfig({ isOpen: false, details: [] })}
      />
    </div>
  );
}

