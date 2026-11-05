
function limitTwoDecimals(val) {
  if (val === '' || val === null || val === undefined) return '';
  const str = val.toString();
  if (str.includes('.')) {
    const [intPart, decPart] = str.split('.');
    return `${intPart}.${decPart.slice(0, 2)}`;
  }
  return str;
}
import React, { useState, useEffect } from 'react';
import { 
  Receipt, 
  Plus, 
  CreditCard, 
  Calendar, 
  Clock, 
  AlertCircle, 
  CheckCircle,
  Building,
  Tag,
  ArrowUpRight
} from 'lucide-react';
import { api, formatMoney } from '../api';

export default function BillsSuppliers({ mode, onShowToast }) {
  const [bills, setBills] = useState([]);
  const [expenses, setExpenses] = useState([]);
  const [recurringBills, setRecurringBills] = useState([]);
  const [loading, setLoading] = useState(true);

  // Modals
  const [isNewBillOpen, setIsNewBillOpen] = useState(false);
  const [isNewExpenseOpen, setIsNewExpenseOpen] = useState(false);
  const [payingBill, setPayingBill] = useState(null);
  const [payAmount, setPayAmount] = useState('');

  const [billForm, setBillForm] = useState({
    supplierName: '',
    billNumber: '',
    totalAmount: '',
    depositPaid: '',
    dueDate: ''
  });

  const [expenseForm, setExpenseForm] = useState({
    vendorPayee: '',
    category: 'Rent & Store Utilities',
    tier: 'OCCUPANCY_RENT',
    amount: '',
    notes: ''
  });

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      const [billsData, expData] = await Promise.all([
        api.getBills(),
        api.getExpenses()
      ]);
      setBills(billsData);
      setExpenses(expData.expenses);
      setRecurringBills(expData.recurringBills);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const handleCreateBill = async (e) => {
    e.preventDefault();
    try {
      await api.createBill(billForm);
      setIsNewBillOpen(false);
      setBillForm({ supplierName: '', billNumber: '', totalAmount: '', depositPaid: '', dueDate: '' });
      onShowToast('Supplier bill recorded in Accounts Payable!', 'success');
      loadData();
    } catch (err) {
      onShowToast(err.message, 'error');
    }
  };

  const handleCreateExpense = async (e) => {
    e.preventDefault();
    try {
      await api.createExpense(expenseForm);
      setIsNewExpenseOpen(false);
      setExpenseForm({ vendorPayee: '', category: 'Rent & Store Utilities', tier: 'OCCUPANCY_RENT', amount: '', notes: '' });
      onShowToast('Operating expense recorded & journal posted!', 'success');
      loadData();
    } catch (err) {
      onShowToast(err.message, 'error');
    }
  };

  const handlePayBill = async (e) => {
    e.preventDefault();
    try {
      await api.payBill(payingBill.id, payAmount);
      setPayingBill(null);
      setPayAmount('');
      onShowToast('Supplier payment issued and debited from Bank!', 'success');
      loadData();
    } catch (err) {
      onShowToast(err.message, 'error');
    }
  };

  const totalOwed = bills.reduce((sum, b) => sum + Number(b.balanceDue || 0), 0);
  const totalExpensesThisMonth = expenses.reduce((sum, e) => sum + Number(e.amount || 0), 0);

  return (
    <div className="space-y-6">
      
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-4 pb-4 border-b border-white/10">
        <div>
          <h2 className="text-xl font-bold text-white flex items-center gap-2">
            <Receipt className="w-5 h-5 text-[#F43F5E]" />
            Bills & Operating Expenses (Accounts Payable)
          </h2>
          <p className="text-xs text-slate-400 mt-1">
            Manage factory invoices, 30/70 supplier deposit schedules, store rent, marketing ads, and recurring bills.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => setIsNewExpenseOpen(true)}
            className="flex items-center gap-2 px-3.5 py-2 rounded-xl bg-white/10 hover:bg-white/15 text-white text-xs font-semibold border border-white/10 transition"
          >
            <Plus className="w-4 h-4 text-[#E5A93C]" />
            <span>Add Expense</span>
          </button>
          
          <button
            onClick={() => setIsNewBillOpen(true)}
            className="flex items-center gap-2 px-4 py-2 rounded-xl bg-[#F43F5E] hover:bg-[#e11d48] text-white text-xs font-bold transition shadow-lg shadow-[#F43F5E]/20"
          >
            <Plus className="w-4 h-4" />
            <span>Enter Supplier Bill</span>
          </button>
        </div>
      </div>

      {/* Metrics */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div className="glass-card p-4">
          <span className="text-[11px] text-slate-400 uppercase font-medium">Outstanding Bills to Pay (AP)</span>
          <div className="text-2xl font-bold text-rose-300 num-font mt-1">{formatMoney(totalOwed)}</div>
          <span className="text-xs text-slate-400 mt-1 block">Includes factory production balances</span>
        </div>

        <div className="glass-card p-4">
          <span className="text-[11px] text-slate-400 uppercase font-medium">Monthly Operating Expenses (OPEX)</span>
          <div className="text-2xl font-bold text-white num-font mt-1">{formatMoney(totalExpensesThisMonth)}</div>
          <span className="text-xs text-slate-400 mt-1 block">Rent, Meta ads, staff wages, utilities</span>
        </div>
      </div>

      {/* Supplier Bills Table */}
      <div className="glass-card overflow-hidden">
        <div className="p-4 border-b border-white/10 flex items-center justify-between">
          <div>
            <h3 className="text-sm font-bold text-white flex items-center gap-2">
              <Building className="w-4 h-4 text-[#F43F5E]" />
              Supplier Bills & 30/70 Production Advances
            </h3>
            <p className="text-xs text-slate-400">
              Tracks factory bills and deposit payment plans.
            </p>
          </div>
          <span className="text-xs text-slate-400 font-mono">{bills.length} Invoices</span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-xs text-left">
            <thead className="bg-[#111520] text-slate-400 border-b border-white/10 uppercase tracking-wider font-semibold">
              <tr>
                <th className="py-3 px-4">Supplier</th>
                <th className="py-3 px-3">Bill #</th>
                <th className="py-3 px-3">Due Date</th>
                <th className="py-3 px-3 text-right">Total Bill</th>
                <th className="py-3 px-3 text-right">Advance Paid</th>
                <th className="py-3 px-3 text-right text-rose-300 font-bold">Balance Due</th>
                <th className="py-3 px-3 text-center">Status</th>
                <th className="py-3 px-4 text-right">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/5">
              {bills.map((b) => (
                <tr key={b.id} className="hover:bg-white/5 transition">
                  <td className="py-3 px-4 font-bold text-white">
                    {b.supplierName}
                    {b.linkedPoNumber && (
                      <span className="block text-[10px] font-mono text-slate-400">Linked: {b.linkedPoNumber}</span>
                    )}
                  </td>
                  <td className="py-3 px-3 font-mono text-slate-300">{b.billNumber}</td>
                  <td className="py-3 px-3 font-mono text-slate-400">{b.dueDate}</td>
                  <td className="py-3 px-3 text-right num-font font-medium text-slate-300">
                    {formatMoney(b.totalAmount)}
                  </td>
                  <td className="py-3 px-3 text-right num-font text-slate-400">
                    {formatMoney(b.depositPaid)}
                  </td>
                  <td className="py-3 px-3 text-right num-font font-bold text-rose-300">
                    {formatMoney(b.balanceDue)}
                  </td>
                  <td className="py-3 px-3 text-center">
                    <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                      b.status === 'PAID'
                        ? 'bg-[#10B981]/20 text-[#10B981]'
                        : b.status === 'PARTIALLY_PAID'
                        ? 'bg-amber-500/20 text-amber-300'
                        : 'bg-rose-500/20 text-rose-300'
                    }`}>
                      {b.status}
                    </span>
                  </td>
                  <td className="py-3 px-4 text-right">
                    {b.balanceDue > 0 ? (
                      <button
                        onClick={() => {
                          setPayingBill(b);
                          setPayAmount(String(b.balanceDue));
                        }}
                        className="px-3 py-1 rounded bg-[#E5A93C] text-black font-bold text-xs hover:bg-[#F3C368] transition"
                      >
                        Pay Bill
                      </button>
                    ) : (
                      <span className="text-slate-500 font-mono text-[11px]">Settled</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Operating Expenses Table */}
      <div className="glass-card overflow-hidden">
        <div className="p-4 border-b border-white/10 flex items-center justify-between">
          <h3 className="text-sm font-bold text-white flex items-center gap-2">
            <Tag className="w-4 h-4 text-slate-400" />
            Operating Expenses (OPEX Ledger)
          </h3>
          <span className="text-xs text-slate-400 font-mono">{expenses.length} Records</span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-xs text-left">
            <thead className="bg-[#111520] text-slate-400 border-b border-white/10 uppercase tracking-wider font-semibold">
              <tr>
                <th className="py-3 px-4">Expense #</th>
                <th className="py-3 px-4">Payee</th>
                <th className="py-3 px-3">Category</th>
                <th className="py-3 px-3">Date</th>
                <th className="py-3 px-3">Payment Method</th>
                <th className="py-3 px-4 text-right font-bold">Amount</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/5">
              {expenses.map((exp) => (
                <tr key={exp.id} className="hover:bg-white/5 transition">
                  <td className="py-3 px-4 font-mono font-bold text-white">{exp.expenseNumber}</td>
                  <td className="py-3 px-4 text-slate-200 font-medium">{exp.vendorPayee}</td>
                  <td className="py-3 px-3">
                    <span className="px-2 py-0.5 rounded text-[10px] bg-white/5 text-slate-300">
                      {exp.category}
                    </span>
                  </td>
                  <td className="py-3 px-3 font-mono text-slate-400">{exp.expenseDate}</td>
                  <td className="py-3 px-3 text-slate-400">{exp.paymentMethod}</td>
                  <td className="py-3 px-4 text-right num-font font-bold text-white">
                    {formatMoney(exp.amount)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* MODAL: PAY BILL */}
      {payingBill && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="glass-card-elevated w-full max-w-md p-6 border border-white/20 animate-in fade-in">
            <h3 className="text-base font-bold text-white mb-1">Pay Supplier Bill</h3>
            <p className="text-xs text-slate-400 mb-4">
              Disburse payment to <strong className="text-white">{payingBill.supplierName}</strong> (Ref {payingBill.billNumber}).
            </p>

            <form onSubmit={handlePayBill} className="space-y-3.5 text-xs">
              <div>
                <label className="block text-slate-300 font-medium mb-1">Payment Amount ($ USD)</label>
                <input
                  type="number"
                  step="0.01"
                  required
                  value={payAmount}
                  onChange={(e) => setPayAmount(limitTwoDecimals(e.target.value))}
                  className="w-full bg-[#111520] border border-white/10 rounded-lg p-2.5 text-white num-font font-bold text-base"
                />
                <span className="text-[11px] text-slate-400 mt-1 block">
                  Remaining balance: {formatMoney(payingBill.balanceDue)}
                </span>
              </div>

              <div className="p-3 bg-white/5 rounded-xl border border-white/5 text-[11px] text-slate-300 space-y-1">
                <div className="font-bold text-white">Ledger Action:</div>
                <div>• Debit 2010 Accounts Payable: -${payAmount || '0'}</div>
                <div>• Credit 1020 Bank Operating Account: -${payAmount || '0'}</div>
              </div>

              <div className="flex justify-end gap-2.5 pt-4 border-t border-white/10">
                <button
                  type="button"
                  onClick={() => setPayingBill(null)}
                  className="px-4 py-2 rounded-lg bg-white/5 text-slate-300 hover:bg-white/10"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 rounded-lg bg-[#E5A93C] text-black font-bold hover:bg-[#F3C368]"
                >
                  Confirm & Disburse Payment
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL: ADD BILL */}
      {isNewBillOpen && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="glass-card-elevated w-full max-w-md p-6 border border-white/20 animate-in fade-in">
            <h3 className="text-base font-bold text-white mb-1">Enter Supplier Bill</h3>
            <p className="text-xs text-slate-400 mb-4">Record new vendor liability in Accounts Payable.</p>

            <form onSubmit={handleCreateBill} className="space-y-3.5 text-xs">
              <div>
                <label className="block text-slate-300 font-medium mb-1">Supplier / Factory Name</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Shenzhen Precision Manufacturing"
                  value={billForm.supplierName}
                  onChange={(e) => setBillForm({ ...billForm, supplierName: e.target.value })}
                  className="w-full bg-[#111520] border border-white/10 rounded-lg p-2.5 text-white"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-slate-300 font-medium mb-1">Bill / Invoice #</label>
                  <input
                    type="text"
                    required
                    placeholder="INV-9921"
                    value={billForm.billNumber}
                    onChange={(e) => setBillForm({ ...billForm, billNumber: e.target.value })}
                    className="w-full bg-[#111520] border border-white/10 rounded-lg p-2.5 text-white font-mono"
                  />
                </div>
                <div>
                  <label className="block text-slate-300 font-medium mb-1">Total Bill Amount ($)</label>
                  <input
                    type="number"
                    step="0.01"
                    required
                    placeholder="5000.00"
                    value={billForm.totalAmount}
                    onChange={(e) => setBillForm({ ...billForm, totalAmount: e.target.value })}
                    className="w-full bg-[#111520] border border-white/10 rounded-lg p-2.5 text-white num-font"
                  />
                </div>
              </div>

              <div>
                <label className="block text-slate-300 font-medium mb-1">Advance Deposit Paid ($)</label>
                <input
                  type="number"
                  step="0.01"
                  placeholder="e.g. 1500 (30% deposit)"
                  value={billForm.depositPaid}
                  onChange={(e) => setBillForm({ ...billForm, depositPaid: e.target.value })}
                  className="w-full bg-[#111520] border border-white/10 rounded-lg p-2.5 text-white num-font"
                />
              </div>

              <div className="flex justify-end gap-2.5 pt-4 border-t border-white/10">
                <button
                  type="button"
                  onClick={() => setIsNewBillOpen(false)}
                  className="px-4 py-2 rounded-lg bg-white/5 text-slate-300 hover:bg-white/10"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 rounded-lg bg-[#F43F5E] text-white font-bold hover:bg-[#e11d48]"
                >
                  Save Bill to AP
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL: ADD EXPENSE */}
      {isNewExpenseOpen && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="glass-card-elevated w-full max-w-md p-6 border border-white/20 animate-in fade-in">
            <h3 className="text-base font-bold text-white mb-1">Record Operating Expense</h3>
            <p className="text-xs text-slate-400 mb-4">Record retail store rent, ads, payroll, or consumables.</p>

            <form onSubmit={handleCreateExpense} className="space-y-3.5 text-xs">
              <div>
                <label className="block text-slate-300 font-medium mb-1">Payee / Vendor</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Commercial Plaza Rent, Meta Ads"
                  value={expenseForm.vendorPayee}
                  onChange={(e) => setExpenseForm({ ...expenseForm, vendorPayee: e.target.value })}
                  className="w-full bg-[#111520] border border-white/10 rounded-lg p-2.5 text-white"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-slate-300 font-medium mb-1">Expense Category</label>
                  <select
                    value={expenseForm.tier}
                    onChange={(e) => {
                      const tier = e.target.value;
                      let cat = 'Rent & Store Utilities';
                      if (tier === 'MARKETING_ADS') cat = 'Marketing and Advertising';
                      else if (tier === 'PAYROLL_WAGES') cat = 'Payroll & Staff Wages';
                      else if (tier === 'DIRECT_SELLING') cat = 'Direct Selling Costs';
                      setExpenseForm({ ...expenseForm, tier, category: cat });
                    }}
                    className="w-full bg-[#111520] border border-white/10 rounded-lg p-2.5 text-white"
                  >
                    <option value="OCCUPANCY_RENT">Rent & Store Utilities</option>
                    <option value="MARKETING_ADS">Marketing & Social Ads</option>
                    <option value="PAYROLL_WAGES">Staff Payroll & Wages</option>
                    <option value="DIRECT_SELLING">Packaging & Supplies</option>
                    <option value="ADMIN_SOFTWARE">SaaS & Administration</option>
                  </select>
                </div>

                <div>
                  <label className="block text-slate-300 font-medium mb-1">Amount ($ USD)</label>
                  <input
                    type="number"
                    step="0.01"
                    required
                    placeholder="3400.00"
                    value={expenseForm.amount}
                    onChange={(e) => setExpenseForm({ ...expenseForm, amount: limitTwoDecimals(e.target.value) })}
                    className="w-full bg-[#111520] border border-white/10 rounded-lg p-2.5 text-white num-font"
                  />
                </div>
              </div>

              <div className="flex justify-end gap-2.5 pt-4 border-t border-white/10">
                <button
                  type="button"
                  onClick={() => setIsNewExpenseOpen(false)}
                  className="px-4 py-2 rounded-lg bg-white/5 text-slate-300 hover:bg-white/10"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 rounded-lg bg-[#E5A93C] text-black font-bold hover:bg-[#F3C368]"
                >
                  Record Expense
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

    </div>
  );
}

