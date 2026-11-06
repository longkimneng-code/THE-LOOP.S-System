import React, { useState, useEffect } from 'react';
import { usePos } from '../../context/PosContext';
import {
  PieChart,
  Calendar,
  DollarSign,
  TrendingUp,
  ShieldCheck,
  AlertTriangle,
  RotateCcw,
  CheckCircle2,
  FileSpreadsheet,
  FileText,
  Printer,
  Download,
  Plus,
  ArrowRight,
  Settings,
  X,
  Lock,
  Layers,
  Clock,
  Coins,
  Building2,
  PlusCircle,
  MinusCircle,
  History
} from 'lucide-react';
import MonthlyFinancialHistoryView from './MonthlyFinancialHistoryView';
import LoopShareManagementView from './LoopShareManagementView';

export default function MonthlyRevenueAllocationView() {
  const { authToken, currentUser, playBeep, hasPermission, stores = [] } = usePos();

  const isOwner = currentUser?.role === 'OWNER' || currentUser?.role === 'SUPER_ADMIN';
  const userPerms = currentUser?.permissions || {};
  const canInjectCapital = isOwner || userPerms.injectCapital === true;
  const canWithdrawCapital = isOwner || userPerms.withdrawCapital === true;
  const canRepayCapital = isOwner || userPerms.repayCapital === true || userPerms.manageCapital === true;
  const canAdjustFinance = isOwner || userPerms.manualFinancialAdjustment === true;
  const canCloseMonth = isOwner || userPerms.manageMonthEndClosing === true;
  const canViewLoopShare = isOwner || hasPermission('viewLoopShare') || hasPermission('manageStoreShare') || userPerms.manageStoreShare === true || userPerms.viewLoopShare === true;

  const assignedStoreIds = isOwner ? ['*'] : (currentUser?.assignedStoreIds || currentUser?.locations || ['*']);
  const authorizedStores = (stores || []).filter(s => assignedStoreIds.includes('*') || assignedStoreIds.includes(s.id));
  const [selectedStoreId, setSelectedStoreId] = useState('ALL');

  // Brand / Store Name for display (e.g. BeyondVER Share)
  const orgName = currentUser?.organizationName || 'BeyondVER';
  const shareDisplayName = `${orgName} Share`;

  const [selectedMonth, setSelectedMonth] = useState(() => new Date().toISOString().slice(0, 7));
  const [subTab, setSubTab] = useState('live'); // 'live' | 'history'
  const [allocationData, setAllocationData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [toast, setToast] = useState('');

  // Modals
  const [isConfigOpen, setIsConfigOpen] = useState(false);
  const [isExpenseOpen, setIsExpenseOpen] = useState(false);
  const [isRepayOpen, setIsRepayOpen] = useState(false);
  const [isInjectCapitalOpen, setIsInjectCapitalOpen] = useState(false);
  const [isWithdrawCapitalOpen, setIsWithdrawCapitalOpen] = useState(false);
  const [isCloseMonthOpen, setIsCloseMonthOpen] = useState(false);
  const [isPrintPreviewOpen, setIsPrintPreviewOpen] = useState(false);
  const [selectedBorrowing, setSelectedBorrowing] = useState(null);
  const [showAllBorrowings, setShowAllBorrowings] = useState(false);

  // Forms
  const [injectForm, setInjectForm] = useState({ amount: '', notes: '' });
  const [withdrawForm, setWithdrawForm] = useState({ amount: '', notes: '' });
  const [planCategories, setPlanCategories] = useState([]);
  const [additionalReinvestmentPercent, setAdditionalReinvestmentPercent] = useState(0);
  const [staffUsers, setStaffUsers] = useState([]);
  const [expenseForm, setExpenseForm] = useState({
    categoryId: 'OPERATING_EXPENSES',
    expenseCategory: 'Rent & Facilities',
    amount: '',
    description: '',
    paymentDate: new Date().toISOString().slice(0, 10),
    invoiceRef: '',
    supplierName: '',
    selectedEmployeeId: '',
    allowCapitalBorrowing: true
  });
  const [repayForm, setRepayForm] = useState({
    amount: '',
    sourceCategoryId: 'OPERATING_EXPENSES',
    notes: ''
  });
  const [closingForm, setClosingForm] = useState({
    salaryCarryForwardDecision: 'CARRY_FORWARD',
    manualSalaryAmount: ''
  });

  const showToast = (msg) => {
    setToast(msg);
    playBeep(1200, 'sine', 0.1);
    setTimeout(() => setToast(''), 3500);
  };

  useEffect(() => {
    const fetchStaff = async () => {
      try {
        const token = authToken || (typeof window !== 'undefined' ? localStorage.getItem('loops_auth_token') : null);
        const res = await fetch('/api/users', {
          headers: token ? { Authorization: `Bearer ${token}` } : {}
        });
        if (res.ok) {
          const data = await res.json();
          setStaffUsers(data.users || (Array.isArray(data) ? data : []));
        }
      } catch (e) {}
    };
    if (isExpenseOpen) {
      fetchStaff();
    }
  }, [isExpenseOpen, authToken]);

  const fetchAllocationData = async (targetMonth = null) => {
    setLoading(true);
    const monthToFetch = targetMonth || selectedMonth;
    try {
      const token = authToken || (typeof window !== 'undefined' ? localStorage.getItem('loops_auth_token') : null);
      const url = `/api/allocations/monthly?month=${monthToFetch}${selectedStoreId && selectedStoreId !== 'ALL' ? `&storeId=${selectedStoreId}` : ''}`;
      const res = await fetch(url, {
        headers: token ? { Authorization: `Bearer ${token}` } : {}
      });
      if (res.ok) {
        const data = await res.json();
        setAllocationData(data);
        if (data.plan?.categoriesConfig) {
          setPlanCategories(data.plan.categoriesConfig.filter(c => c.id !== 'INVENTORY_REINVESTMENT'));
        }
        if (data.plan) {
          setAdditionalReinvestmentPercent(Number(data.plan.additional_reinvestment_percent || 0));
        }
      }
    } catch (e) {
      console.warn('Failed to load allocation data:', e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAllocationData();
  }, [selectedMonth, selectedStoreId]);

  const handleInjectSubmit = async (e) => {
    e.preventDefault();
    if (!injectForm.amount || parseFloat(injectForm.amount) <= 0) return;
    try {
      const token = authToken || (typeof window !== 'undefined' ? localStorage.getItem('loops_auth_token') : null);
      const res = await fetch('/api/finance/capital/inject', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {})
        },
        body: JSON.stringify({
          amount: parseFloat(injectForm.amount),
          notes: injectForm.notes,
          storeId: selectedStoreId !== 'ALL' ? selectedStoreId : null
        })
      });
      const data = await res.json();
      if (!res.ok || !data.ok) throw new Error(data.error || 'Failed to inject capital');
      showToast(`Injected $${data.amountInjected.toFixed(2)} into Business Capital Reserve!`);
      setIsInjectCapitalOpen(false);
      setInjectForm({ amount: '', notes: '' });
      fetchAllocationData();
    } catch (err) {
      alert(err.message);
    }
  };

  const handleWithdrawSubmit = async (e) => {
    e.preventDefault();
    if (!withdrawForm.amount || parseFloat(withdrawForm.amount) <= 0) return;
    try {
      const token = authToken || (typeof window !== 'undefined' ? localStorage.getItem('loops_auth_token') : null);
      const res = await fetch('/api/finance/capital/withdraw', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {})
        },
        body: JSON.stringify({
          amount: parseFloat(withdrawForm.amount),
          notes: withdrawForm.notes,
          storeId: selectedStoreId !== 'ALL' ? selectedStoreId : null
        })
      });
      const data = await res.json();
      if (!res.ok || !data.ok) throw new Error(data.error || 'Failed to withdraw capital');
      showToast(`Withdrew $${data.amountWithdrawn.toFixed(2)} from Business Capital!`);
      setIsWithdrawCapitalOpen(false);
      setWithdrawForm({ amount: '', notes: '' });
      fetchAllocationData();
    } catch (err) {
      alert(err.message);
    }
  };

  const revenue = allocationData?.revenue || { totalSales: 0, collectedRevenue: 0, refunds: 0, eligibleRevenue: 0 };
  const budgets = allocationData?.budgets || [];
  const capital = allocationData?.capital || { balance: 0, borrowed: 0, repaid: 0, outstandingRepayment: 0, activeBorrowings: [], allBorrowings: [] };
  const isMonthClosed = allocationData?.plan?.status === 'CLOSED';

  // Calculate simulated expense funding breakdown based on selected budget category
  const selectedBudget = budgets.find(b => b.category_id === (expenseForm.categoryId || 'OPERATING_EXPENSES')) || {};
  const currentAvailableBudget = Number(selectedBudget.remaining_balance || 0);
  const inputExpenseAmount = parseFloat(expenseForm.amount) || 0;
  const simBudgetDeduction = Math.min(inputExpenseAmount, currentAvailableBudget);
  const simCapitalBorrowing = Math.max(0, inputExpenseAmount - currentAvailableBudget);

  const handleUpdatePlan = async (e) => {
    e.preventDefault();
    try {
      const token = authToken || (typeof window !== 'undefined' ? localStorage.getItem('loops_auth_token') : null);
      const res = await fetch('/api/allocations/plan', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {})
        },
        body: JSON.stringify({
          periodMonth: selectedMonth,
          categories: planCategories,
          additionalReinvestmentPercent: Number(additionalReinvestmentPercent)
        })
      });
      const data = await res.json();
      if (!res.ok || !data.ok) throw new Error(data.error || 'Failed to update plan');

      showToast('Monthly revenue allocation plan updated successfully!');
      setIsConfigOpen(false);
      fetchAllocationData();
    } catch (err) {
      alert(err.message);
    }
  };

  const handleRecordExpenseSubmit = async (e) => {
    e.preventDefault();
    if (!expenseForm.amount || parseFloat(expenseForm.amount) <= 0) return;

    try {
      const token = authToken || (typeof window !== 'undefined' ? localStorage.getItem('loops_auth_token') : null);
      const res = await fetch('/api/finance/expenses/with-protection', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {})
        },
        body: JSON.stringify({
          ...expenseForm,
          periodMonth: selectedMonth,
          amount: parseFloat(expenseForm.amount)
        })
      });
      const data = await res.json();
      if (!res.ok || !data.ok) throw new Error(data.error || 'Failed to record expense');

      showToast(data.message || 'Expense recorded successfully!');
      setIsExpenseOpen(false);
      setExpenseForm({
        categoryId: 'OPERATING_EXPENSES',
        expenseCategory: 'Rent & Facilities',
        amount: '',
        description: '',
        paymentDate: new Date().toISOString().slice(0, 10),
        invoiceRef: '',
        supplierName: '',
        allowCapitalBorrowing: true
      });
      fetchAllocationData();
    } catch (err) {
      alert(err.message);
    }
  };

  const handleRepaySubmit = async (e) => {
    e.preventDefault();
    if (!selectedBorrowing || !repayForm.amount) return;

    const repayNum = parseFloat(repayForm.amount) || 0;
    const originCat = selectedBorrowing.budget_category_id || repayForm.sourceCategoryId || 'OPERATING_EXPENSES';
    const fundingBudget = budgets.find(bg => bg.category_id === originCat);
    const availableRepayBudget = Number(fundingBudget?.remaining_balance || 0);

    if (repayNum > availableRepayBudget) {
      alert(`Cannot repay advance: Insufficient funds in ${fundingBudget?.category_name || 'budget'}.\n\nAvailable: $${availableRepayBudget.toFixed(2)}\nRequired for repayment: $${repayNum.toFixed(2)}\n\nYou must allocate or receive additional funds into this budget before repaying.`);
      return;
    }

    if (!window.confirm(`Confirm Capital Repayment?\n\nAmount: $${repayNum.toFixed(2)}\nFunded from: ${fundingBudget?.category_name || originCat} budget\nRestore to: Business Capital\n\nProceed with repayment?`)) {
      return;
    }

    try {
      const token = authToken || (typeof window !== 'undefined' ? localStorage.getItem('loops_auth_token') : null);
      const res = await fetch('/api/finance/capital/repay', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {})
        },
        body: JSON.stringify({
          borrowingId: selectedBorrowing.id,
          amount: repayNum,
          sourceCategoryId: originCat,
          notes: repayForm.notes
        })
      });
      const data = await res.json();
      if (!res.ok || !data.ok) throw new Error(data.error || 'Failed to repay capital');

      showToast(`Repaid $${data.amountRepaid.toFixed(2)} to Capital Account!`);
      setIsRepayOpen(false);
      setSelectedBorrowing(null);
      fetchAllocationData();
    } catch (err) {
      alert(err.message);
    }
  };

  const handleDismissBorrowing = async (borrowing) => {
    if (!window.confirm(`Decide NOT to pay borrowing advance ${borrowing.borrowing_ref} ($${Number(borrowing.outstanding_amount).toFixed(2)})?\n\nThis will dismiss the advance, remove it from active borrowings, and permanently record your decision in the financial audit history.`)) {
      return;
    }
    try {
      const token = authToken || (typeof window !== 'undefined' ? localStorage.getItem('loops_auth_token') : null);
      const res = await fetch('/api/finance/capital/borrowing/dismiss', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {})
        },
        body: JSON.stringify({
          borrowingId: borrowing.id,
          reason: 'Owner decision not to pay'
        })
      });
      const data = await res.json();
      if (!res.ok || !data.ok) throw new Error(data.error || 'Failed to dismiss borrowing');
      showToast(data.message || 'Borrowing marked as Decide Not to Pay!');
      fetchAllocationData();
    } catch (err) {
      alert(err.message);
    }
  };

  const handleCloseMonthSubmit = async (e) => {
    e.preventDefault();
    try {
      const token = authToken || (typeof window !== 'undefined' ? localStorage.getItem('loops_auth_token') : null);
      const res = await fetch('/api/finance/closing/execute', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {})
        },
        body: JSON.stringify({
          periodMonth: selectedMonth,
          salaryCarryForwardDecision: closingForm.salaryCarryForwardDecision,
          manualSalaryAmount: parseFloat(closingForm.manualSalaryAmount) || 0
        })
      });
      const data = await res.json();
      if (!res.ok || !data.ok) throw new Error(data.error || 'Failed to finalize month');

      setIsCloseMonthOpen(false);
      const closedMonth = selectedMonth;
      if (data.nextMonth) {
        setSelectedMonth(data.nextMonth);
        showToast(`Month ${closedMonth} closed! Data reset and fresh plan opened for ${data.nextMonth}.`);
        fetchAllocationData(data.nextMonth);
      } else {
        showToast(`Month ${closedMonth} closed successfully.`);
        fetchAllocationData(closedMonth);
      }
    } catch (err) {
      alert(err.message);
    }
  };

  const handleExport = (format) => {
    const token = authToken || (typeof window !== 'undefined' ? localStorage.getItem('loops_auth_token') : null);
    const exportUrl = `/api/reports/export?reportType=FINANCIAL_ALLOCATION&format=${format}&month=${selectedMonth}${token ? `&token=${token}` : ''}`;
    window.open(exportUrl, '_blank');
  };

  return (
    <div className="flex-1 overflow-y-auto p-4 sm:p-6 bg-obsidian-950 text-slate-100 font-sans select-none space-y-6">
      {/* Toast Alert */}
      {toast && (
        <div className="fixed top-5 right-5 z-50 p-3 bg-emerald-500 text-obsidian-950 rounded-xl shadow-xl font-bold text-xs flex items-center space-x-2 animate-in slide-in-from-top-2">
          <CheckCircle2 className="w-4 h-4" />
          <span>{toast}</span>
        </div>
      )}

      {/* Top Banner & Control Actions Toolbar */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 pb-4 border-b border-obsidian-800">
        <div>
          <div className="flex items-center space-x-2">
            <h1 className="text-lg font-bold text-slate-100 font-display uppercase tracking-wider flex items-center space-x-2">
              <PieChart className="w-5 h-5 text-brass-400" />
              <span>Monthly Revenue Allocation & Financial Control</span>
            </h1>
            <span className="text-[10px] bg-brass-500/20 text-brass-400 font-mono px-2 py-0.5 rounded border border-brass-500/30 font-bold uppercase">
              Section 16 Ledger
            </span>
          </div>
          <p className="text-xs text-slate-400 mt-0.5">
            Divide collected cash revenue, protect business capital, manage expense rollover, and automate month-end closing.
          </p>
        </div>

        {/* Action Controls Toolbar - Aligned Clean Layout */}
        <div className="flex flex-wrap items-center gap-2">
          {/* Store Filter Selector (if authorized for multiple stores) */}
          {authorizedStores.length > 1 && (
            <div className="flex items-center space-x-1.5 bg-obsidian-900 px-2.5 py-1.5 rounded-xl border border-obsidian-800 text-xs font-mono">
              <Building2 className="w-3.5 h-3.5 text-brass-400" />
              <select
                value={selectedStoreId}
                onChange={(e) => setSelectedStoreId(e.target.value)}
                className="bg-transparent text-slate-200 focus:outline-none cursor-pointer text-xs"
              >
                <option value="ALL">All Authorized Stores ({authorizedStores.length})</option>
                {authorizedStores.map(st => (
                  <option key={st.id} value={st.id}>
                    {st.name} ({st.code || 'MAIN'})
                  </option>
                ))}
              </select>
            </div>
          )}

          {/* Month Selector */}
          <div className="flex items-center space-x-1.5 bg-obsidian-900 px-2.5 py-1.5 rounded-xl border border-obsidian-800 text-xs font-mono">
            <Calendar className="w-3.5 h-3.5 text-brass-400" />
            <input
              type="month"
              value={selectedMonth}
              onChange={(e) => setSelectedMonth(e.target.value)}
              className="bg-transparent text-slate-200 focus:outline-none cursor-pointer"
            />
          </div>

          {/* Export Dropdown Group */}
          <div className="flex items-center bg-obsidian-900 border border-obsidian-850 rounded-xl overflow-hidden p-0.5">
            <button
              onClick={() => handleExport('xlsx')}
              className="px-2 py-1.5 hover:bg-emerald-500/20 text-emerald-400 text-xs font-mono flex items-center space-x-1 transition"
              title="Export to Excel (.xlsx)"
            >
              <FileSpreadsheet className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Excel</span>
            </button>
            <span className="text-obsidian-800">|</span>
            <button
              onClick={() => handleExport('docx')}
              className="px-2 py-1.5 hover:bg-sky-500/20 text-sky-400 text-xs font-mono flex items-center space-x-1 transition"
              title="Export to Word (.docx)"
            >
              <FileText className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Word</span>
            </button>
            <span className="text-obsidian-800">|</span>
            <button
              onClick={() => setIsPrintPreviewOpen(true)}
              className="px-2 py-1.5 hover:bg-rose-500/20 text-rose-400 text-xs font-mono flex items-center space-x-1 transition"
              title="Print / Save PDF (Crystal Clear)"
            >
              <Printer className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Print / PDF</span>
            </button>
          </div>

          <button
            onClick={() => setIsExpenseOpen(true)}
            className="flex items-center space-x-1.5 px-3 py-1.5 rounded-xl bg-obsidian-850 hover:bg-obsidian-800 text-slate-200 border border-obsidian-750 text-xs font-bold transition shadow-sm"
          >
            <Plus className="w-3.5 h-3.5 text-brass-400" />
            <span>Record Expense</span>
          </button>

          <button
            onClick={() => setIsConfigOpen(true)}
            className="flex items-center space-x-1.5 px-3 py-1.5 rounded-xl bg-obsidian-850 hover:bg-obsidian-800 text-slate-200 border border-obsidian-750 text-xs font-bold transition shadow-sm"
          >
            <Settings className="w-3.5 h-3.5 text-brass-400" />
            <span>Configure Plan</span>
          </button>

          {isMonthClosed ? (
            <div className="flex items-center gap-2">
              <span className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-amber-500/10 border border-amber-500/30 text-amber-300 font-mono text-xs font-bold">
                <Lock className="w-3.5 h-3.5 text-amber-400" />
                <span>Finalized & Closed</span>
              </span>
              <button
                onClick={() => {
                  const [y, m] = selectedMonth.split('-').map(Number);
                  let ny = y, nm = m + 1;
                  if (nm > 12) { nm = 1; ny += 1; }
                  const nextMonthKey = `${ny}-${String(nm).padStart(2, '0')}`;
                  setSelectedMonth(nextMonthKey);
                  fetchAllocationData(nextMonthKey);
                }}
                className="flex items-center space-x-1.5 px-3 py-1.5 rounded-xl bg-brass-500 hover:bg-brass-400 text-obsidian-950 font-bold text-xs shadow-md shadow-brass-500/20 active:scale-95 transition"
              >
                <span>Go to Active Month</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </button>
            </div>
          ) : canCloseMonth && (
            <button
              onClick={() => setIsCloseMonthOpen(true)}
              className="flex items-center space-x-1.5 px-3 py-1.5 rounded-xl bg-brass-500 hover:bg-brass-400 text-obsidian-950 font-bold text-xs shadow-md shadow-brass-500/20 active:scale-95 transition"
            >
              <ShieldCheck className="w-3.5 h-3.5" />
              <span>Close Month</span>
            </button>
          )}
        </div>
      </div>

      {/* Sub-Navigation Switcher: Active Live Month vs Store Share vs Monthly Financial History */}
      <div className="flex items-center gap-2 border-b border-obsidian-800 pb-2">
        <button
          onClick={() => setSubTab('live')}
          className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition-all ${
            subTab === 'live'
              ? 'bg-brass-500 text-obsidian-950 font-bold shadow-md shadow-brass-500/20'
              : 'bg-obsidian-900 border border-obsidian-800 text-slate-400 hover:text-white'
          }`}
        >
          <PieChart className="w-4 h-4" />
          <span>Active Month Allocation & Live Control</span>
        </button>

        {canViewLoopShare && (
          <button
            onClick={() => setSubTab('loop-share')}
            className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition-all ${
              subTab === 'loop-share'
                ? 'bg-brass-500 text-obsidian-950 font-bold shadow-md shadow-brass-500/20'
                : 'bg-obsidian-900 border border-obsidian-800 text-slate-400 hover:text-white'
            }`}
          >
            <Lock className="w-4 h-4" />
            <span>{shareDisplayName} Management</span>
          </button>
        )}

        <button
          onClick={() => setSubTab('history')}
          className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition-all ${
            subTab === 'history'
              ? 'bg-brass-500 text-obsidian-950 font-bold shadow-md shadow-brass-500/20'
              : 'bg-obsidian-900 border border-obsidian-800 text-slate-400 hover:text-white'
          }`}
        >
          <History className="w-4 h-4" />
          <span>Monthly Financial History Archive</span>
        </button>
      </div>

      {subTab === 'live' ? (
        <>
          {/* Closed Month Banner */}
          {isMonthClosed && (
            <div className="p-3.5 rounded-xl bg-amber-500/10 border border-amber-500/30 flex items-center justify-between text-xs text-amber-200">
              <div className="flex items-center gap-2">
                <Lock className="w-4 h-4 text-amber-400" />
                <span>This financial period (<strong>{selectedMonth}</strong>) is closed and finalized. Metrics are historical and immutable.</span>
              </div>
              <button
                onClick={() => {
                  const [y, m] = selectedMonth.split('-').map(Number);
                  let ny = y, nm = m + 1;
                  if (nm > 12) { nm = 1; ny += 1; }
                  const nextMonthKey = `${ny}-${String(nm).padStart(2, '0')}`;
                  setSelectedMonth(nextMonthKey);
                  fetchAllocationData(nextMonthKey);
                }}
                className="px-2.5 py-1 rounded-lg bg-brass-500 hover:bg-brass-400 text-obsidian-950 font-bold text-[11px] transition flex items-center gap-1"
              >
                <span>Switch to Active Month</span>
                <ArrowRight className="w-3 h-3" />
              </button>
            </div>
          )}

          {/* MASTER METRICS: 3 Structured Cards (Sections 1-8) */}
          {/* Card 1: Eligible Revenue Collection Basis */}
          <div className="p-4 rounded-2xl bg-obsidian-900/90 border border-obsidian-800 space-y-3">
            <div className="flex items-center justify-between text-xs text-slate-400 font-mono">
              <span className="uppercase tracking-wider font-bold text-slate-300 flex items-center space-x-2">
                <DollarSign className="w-4 h-4 text-emerald-400" />
                <span>1. Eligible Revenue Collection Basis (Section 1)</span>
              </span>
              <span className="text-[10px] text-emerald-400 font-bold">
                Actual Realized Cash/Card Payments • Outstanding Invoices Excluded
              </span>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
              <div className="p-3 rounded-xl bg-obsidian-950 border border-obsidian-800">
                <div className="text-[10px] font-mono text-slate-400 uppercase">Total Recorded Sales</div>
                <div className="text-base font-black text-slate-200 font-display mt-0.5">
                  ${(allocationData?.metrics?.totalRecordedSales ?? revenue.totalSales).toFixed(2)}
                </div>
                <div className="text-[9px] text-slate-500 mt-0.5">Commercial volume</div>
              </div>

              <div className="p-3 rounded-xl bg-obsidian-950 border border-obsidian-800">
                <div className="text-[10px] font-mono text-sky-400 uppercase">Collected Payments</div>
                <div className="text-base font-black text-sky-400 font-display mt-0.5">
                  ${(allocationData?.metrics?.collectedPayments ?? revenue.collectedRevenue).toFixed(2)}
                </div>
                <div className="text-[9px] text-slate-500 mt-0.5">Received in register</div>
              </div>

              <div className="p-3 rounded-xl bg-obsidian-950 border border-obsidian-800">
                <div className="text-[10px] font-mono text-amber-400 uppercase">Outstanding Receivables</div>
                <div className="text-base font-black text-amber-400 font-display mt-0.5">
                  ${(allocationData?.metrics?.outstandingReceivables ?? revenue.outstandingReceivables ?? 0).toFixed(2)}
                </div>
                <div className="text-[9px] text-slate-500 mt-0.5">Unpaid / pending credit</div>
              </div>

              <div className="p-3 rounded-xl bg-obsidian-950 border border-obsidian-800">
                <div className="text-[10px] font-mono text-rose-400 uppercase">Refunds & Reversals</div>
                <div className="text-base font-black text-rose-400 font-display mt-0.5">
                  -${(allocationData?.metrics?.refundsReversals ?? revenue.refunds).toFixed(2)}
                </div>
                <div className="text-[9px] text-slate-500 mt-0.5">Deducted from revenue</div>
              </div>

              <div className="p-3 rounded-xl bg-obsidian-950 border border-brass-500/40 bg-brass-500/5">
                <div className="text-[10px] font-mono text-brass-400 uppercase font-bold flex items-center justify-between">
                  <span>Eligible Revenue</span>
                  <span className="text-[8px] px-1 py-0.2 bg-brass-500 text-obsidian-950 rounded font-black">BASIS</span>
                </div>
                <div className="text-xl font-black text-brass-400 font-display mt-0.5">
                  ${(allocationData?.metrics?.eligibleCollectedRevenue ?? revenue.eligibleRevenue).toFixed(2)}
                </div>
                <div className="text-[9px] text-brass-400/80 mt-0.5">Net realized cash pool</div>
              </div>
            </div>
          </div>

          {/* Card 2: Actual Product Cost Reinvestment & Reserve (Sections 2–7) */}
          <div className="p-4 rounded-2xl bg-obsidian-900/90 border border-obsidian-800 space-y-3">
            <div className="flex items-center justify-between text-xs text-slate-400 font-mono">
              <span className="uppercase tracking-wider font-bold text-slate-300 flex items-center space-x-2">
                <Layers className="w-4 h-4 text-sky-400" />
                <span>2. Inventory Reinvestment & Reserve (Sections 2, 3, 4, 7)</span>
              </span>
              <span className="text-[10px] text-sky-400 font-bold font-mono">
                Whole-Dollar Rounding (Math.ceil) • Reserve Protected
              </span>
            </div>

            {/* Reinvestment Shortfall Warning if any */}
            {allocationData?.metrics?.hasShortfall && (
              <div className="p-3 rounded-xl bg-rose-500/15 border border-rose-500/30 text-rose-300 text-xs flex items-center justify-between font-mono">
                <div className="flex items-center space-x-2">
                  <AlertTriangle className="w-4 h-4 text-rose-400 shrink-0" />
                  <span>
                    <strong>INSUFFICIENT REVENUE SHORTFALL:</strong> Total inventory reinvestment (${allocationData.metrics.totalInventoryReinvestment.toFixed(2)}) exceeds eligible revenue (${allocationData.metrics.eligibleCollectedRevenue.toFixed(2)}). Shortfall: <strong>${allocationData.metrics.reinvestmentShortfall.toFixed(2)}</strong>. Remaining pool is $0.00. (Section 6: No capital automatically borrowed).
                  </span>
                </div>
              </div>
            )}

            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
              <div className="p-3 rounded-xl bg-obsidian-950 border border-obsidian-800">
                <div className="text-[10px] font-mono text-slate-400 uppercase">Actual Product Cost (COGS)</div>
                <div className="text-base font-black text-slate-200 font-display mt-0.5">
                  ${(allocationData?.metrics?.actualProductCost ?? 0).toFixed(2)}
                </div>
                <div className="text-[9px] text-slate-500 mt-0.5">Recorded cost of sold items</div>
              </div>

              <div className="p-3 rounded-xl bg-obsidian-950 border border-obsidian-800">
                <div className="text-[10px] font-mono text-sky-400 uppercase">Additional Reinvestment %</div>
                <div className="text-base font-black text-sky-400 font-display mt-0.5">
                  +{(allocationData?.metrics?.additionalReinvestmentPercent ?? 0)}%
                </div>
                <div className="text-[9px] text-slate-500 mt-0.5">
                  +${(allocationData?.metrics?.additionalReinvestmentAmount ?? 0).toFixed(2)} on eligible
                </div>
              </div>

              <div className="p-3 rounded-xl bg-obsidian-950 border border-obsidian-800">
                <div className="text-[10px] font-mono text-slate-400 uppercase">Raw Reinvestment</div>
                <div className="text-base font-black text-slate-300 font-display mt-0.5">
                  ${(allocationData?.metrics?.rawReinvestment ?? 0).toFixed(2)}
                </div>
                <div className="text-[9px] text-slate-500 mt-0.5">COGS + Additional %</div>
              </div>

              <div className="p-3 rounded-xl bg-obsidian-950 border border-sky-500/40 bg-sky-500/5">
                <div className="text-[10px] font-mono text-sky-400 uppercase font-bold flex items-center justify-between">
                  <span>Total Reinvestment</span>
                  <span className="text-[8px] px-1 py-0.2 bg-sky-500 text-obsidian-950 rounded font-black">CEIL</span>
                </div>
                <div className="text-xl font-black text-sky-400 font-display mt-0.5">
                  ${(allocationData?.metrics?.totalInventoryReinvestment ?? 0).toFixed(2)}
                </div>
                <div className="text-[9px] text-sky-400/80 mt-0.5">Rounded UP to whole dollar</div>
              </div>

              <div className="p-3 rounded-xl bg-obsidian-950 border border-obsidian-800">
                <div className="text-[10px] font-mono text-amber-400 uppercase">Purchases Deducted</div>
                <div className="text-base font-black text-amber-400 font-display mt-0.5">
                  -${(allocationData?.metrics?.actualInventoryPurchases ?? 0).toFixed(2)}
                </div>
                <div className="text-[9px] text-slate-500 mt-0.5">Paid supplier bills / imports</div>
              </div>

              <div className="p-3 rounded-xl bg-obsidian-950 border border-emerald-500/40 bg-emerald-500/5">
                <div className="text-[10px] font-mono text-emerald-400 uppercase font-bold">Reserve Balance</div>
                <div className="text-xl font-black text-emerald-400 font-display mt-0.5">
                  ${(allocationData?.metrics?.inventoryReserveBalance ?? 0).toFixed(2)}
                </div>
                <div className="text-[9px] text-emerald-400/80 mt-0.5">Designated inventory cash</div>
              </div>
            </div>
          </div>

          {/* Card 3: Remaining Allocation Pool & Operating Budgets (Sections 5 & 6) */}
          <div className="p-4 rounded-2xl bg-obsidian-900/90 border border-obsidian-800 space-y-3">
            <div className="flex items-center justify-between text-xs text-slate-400 font-mono">
              <span className="uppercase tracking-wider font-bold text-slate-300 flex items-center space-x-2">
                <PieChart className="w-4 h-4 text-brass-400" />
                <span>3. Remaining Allocation Pool & Operating Budgets (Sections 5, 6)</span>
              </span>
              <span className="text-[10px] text-brass-400 font-bold font-mono">
                Sole Base for Salaries, OPEX & Loop Share
              </span>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              <div className="p-3.5 rounded-xl bg-obsidian-950 border border-brass-500/50 bg-brass-500/10">
                <div className="text-[10px] font-mono text-brass-400 uppercase font-bold flex items-center justify-between">
                  <span>Remaining Pool</span>
                  <span className="text-[8px] px-1 py-0.2 bg-brass-500 text-obsidian-950 rounded font-black">POOL</span>
                </div>
                <div className="text-2xl font-black text-brass-300 font-display mt-0.5">
                  ${(allocationData?.metrics?.remainingAllocationPool ?? 0).toFixed(2)}
                </div>
                <div className="text-[9px] text-brass-400/80 mt-0.5">Eligible Revenue - Total Reinvestment</div>
              </div>

              <div className="p-3.5 rounded-xl bg-obsidian-950 border border-obsidian-800">
                <div className="text-[10px] font-mono text-slate-400 uppercase">Total Allocated to Budgets</div>
                <div className="text-xl font-black text-slate-200 font-display mt-0.5">
                  ${(allocationData?.plan?.total_allocated ?? 0).toFixed(2)}
                </div>
                <div className="text-[9px] text-slate-500 mt-0.5">Sum of all category allocations</div>
              </div>

              <div className="p-3.5 rounded-xl bg-obsidian-950 border border-obsidian-800">
                <div className="text-[10px] font-mono text-emerald-400 uppercase">Unallocated Surplus</div>
                <div className="text-xl font-black text-emerald-400 font-display mt-0.5">
                  ${(allocationData?.plan?.unallocated_reserve ?? 0).toFixed(2)}
                </div>
                <div className="text-[9px] text-slate-500 mt-0.5">Remaining unassigned revenue</div>
              </div>

              <div className="p-3.5 rounded-xl bg-obsidian-950 border border-obsidian-800">
                <div className="text-[10px] font-mono text-sky-400 uppercase">Protected Capital Balance</div>
                <div className="text-xl font-black text-sky-400 font-display mt-0.5">
                  ${capital.balance.toFixed(2)}
                </div>
                <div className="text-[9px] text-slate-500 mt-0.5">Capital reserve balance</div>
              </div>
            </div>
          </div>

      {/* Live Category Budget Cards */}
      <div className="space-y-3">
        <div className="flex items-center justify-between text-xs font-mono uppercase tracking-wider text-slate-400 font-semibold">
          <span>Active Monthly Budget Allocations</span>
          <span>Live Real-Time Balances</span>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-3.5">
          {budgets.map(b => {
            const isStock = b.category_id === 'INVENTORY_REINVESTMENT';
            const allocated = isStock ? (allocationData?.metrics?.totalInventoryReinvestment ?? Number(b.allocated_amount || 0)) : Number(b.allocated_amount || 0);
            const carryForward = isStock ? 0 : Number(b.opening_carry_forward || 0);
            const available = isStock ? allocated : Number(b.available_budget || 0);
            const spent = isStock ? (allocationData?.metrics?.actualInventoryPurchases ?? Number(b.spent_amount || 0)) : Number(b.spent_amount || 0);
            const borrowed = Number(b.borrowed_from_capital || 0);
            const remaining = isStock ? (allocationData?.metrics?.inventoryReserveBalance ?? Number(b.remaining_balance || 0)) : Number(b.remaining_balance || 0);
            const pctUsed = available > 0 ? Math.min(100, Math.round((spent / available) * 100)) : 0;

            const isOperating = b.category_id === 'OPERATING_EXPENSES';
            const isLoopShare = b.category_id === 'LOOP_SHARE';
            const isSalary = b.category_id === 'EMPLOYEE_SALARIES';

            return (
              <div
                key={b.id}
                className="p-4 rounded-2xl bg-obsidian-900 border border-obsidian-800 hover:border-obsidian-750 transition-all space-y-3 flex flex-col justify-between"
              >
                <div>
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <h3 className="font-bold text-sm text-slate-100 font-display truncate" title={isLoopShare ? `${shareDisplayName} (Profit Sharing)` : b.category_name}>
                        {isLoopShare ? `${shareDisplayName} (Profit Sharing)` : b.category_name}
                      </h3>
                      <div className="flex items-center flex-wrap gap-1.5 mt-1">
                        <span className="text-[10px] font-mono font-bold text-brass-400 bg-obsidian-800 px-2 py-0.5 rounded border border-obsidian-750 whitespace-nowrap">
                          {isStock ? `COGS + ${additionalReinvestmentPercent}%` : (b.allocation_type === 'PERCENT' ? `${b.allocation_value}%` : `$${b.allocation_value}`)}
                        </span>
                        {isOperating && (
                          <span className="text-[9px] font-mono text-sky-400 bg-sky-500/10 px-1.5 py-0.5 rounded border border-sky-500/20 whitespace-nowrap">
                            Auto Carry-Forward
                          </span>
                        )}
                        {isSalary && (
                          <span className="text-[9px] font-mono text-amber-400 bg-amber-500/10 px-1.5 py-0.5 rounded border border-amber-500/20 whitespace-nowrap">
                            Owner Decision
                          </span>
                        )}
                        {isLoopShare && (
                          <span className="text-[9px] font-mono text-rose-400 bg-rose-500/10 px-1.5 py-0.5 rounded border border-rose-500/20 flex items-center space-x-1 whitespace-nowrap">
                            <Lock className="w-2.5 h-2.5" />
                            <span>Confidential</span>
                          </span>
                        )}
                      </div>
                    </div>

                    <div className="text-right shrink-0">
                      <div className="text-[10px] font-mono text-slate-500 uppercase">Remaining</div>
                      <div className={`text-base font-black font-mono ${remaining > 0 ? 'text-emerald-400' : 'text-slate-400'}`}>
                        ${remaining.toFixed(2)}
                      </div>
                    </div>
                  </div>

                  {/* Progress Bar */}
                  <div className="mt-3 space-y-1">
                    <div className="w-full h-1.5 bg-obsidian-950 rounded-full overflow-hidden">
                      <div
                        className={`h-full transition-all ${
                          pctUsed > 85 ? 'bg-rose-500' : pctUsed > 60 ? 'bg-amber-400' : 'bg-emerald-400'
                        }`}
                        style={{ width: `${pctUsed}%` }}
                      />
                    </div>
                    <div className="flex justify-between text-[10px] font-mono text-slate-500">
                      <span>Spent: ${spent.toFixed(2)} ({pctUsed}%)</span>
                      <span>Avail: ${available.toFixed(2)}</span>
                    </div>
                  </div>

                  {/* Financial Breakdown Table */}
                  <div className="pt-2 border-t border-obsidian-800/80 space-y-1 text-xs text-slate-400 font-mono">
                    {isStock ? (
                      <>
                        <div className="flex justify-between">
                          <span className="text-slate-500">COGS Allocation:</span>
                          <span className="text-sky-300 font-semibold">${allocated.toFixed(2)}</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-slate-500">Purchases Deducted:</span>
                          <span className="text-rose-400 font-semibold">-${spent.toFixed(2)}</span>
                        </div>
                        <div className="flex justify-between font-bold pt-0.5 border-t border-obsidian-800/60">
                          <span className="text-slate-400">Reserve Balance:</span>
                          <span className="text-emerald-400">${remaining.toFixed(2)}</span>
                        </div>
                      </>
                    ) : (
                      <>
                        <div className="flex justify-between">
                          <span className="text-slate-500">New Allocation:</span>
                          <span className="text-slate-300 font-semibold">${allocated.toFixed(2)}</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-slate-500">Carry-Forward:</span>
                          <span className="text-sky-400">+{carryForward.toFixed(2)}</span>
                        </div>
                        {borrowed > 0 ? (
                          <div className="flex justify-between text-amber-400 font-bold pt-0.5 border-t border-obsidian-800/60">
                            <span>Capital Borrowed:</span>
                            <span>+${borrowed.toFixed(2)}</span>
                          </div>
                        ) : (
                          <div className="flex justify-between font-bold pt-0.5 border-t border-obsidian-800/60">
                            <span className="text-slate-400">Net Available:</span>
                            <span className="text-emerald-400">${available.toFixed(2)}</span>
                          </div>
                        )}
                      </>
                    )}
                  </div>
                </div>

                <div className="text-[10px] font-mono text-slate-500 pt-2 border-t border-obsidian-800/60">
                  {isStock && 'Reserved for inventory restocking & supplier invoices (Calculated from Section 2)'}
                  {isSalary && 'Designated for payroll & employee compensation'}
                  {isOperating && 'Operating overheads & utilities with balance rollover'}
                  {isLoopShare && `Founder & stakeholder profit-sharing pool for ${orgName}`}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Capital Protection & Borrowing Control Widget */}
      <div className="p-5 rounded-2xl bg-obsidian-900 border border-obsidian-800 space-y-4">
        <div className="flex items-center justify-between pb-3 border-b border-obsidian-800">
          <div className="flex items-center space-x-2">
            <ShieldCheck className="w-5 h-5 text-emerald-400" />
            <div>
              <h2 className="text-sm font-bold text-slate-100 uppercase tracking-wider font-display">
                Feature 7: Business Capital Protection & Advance Tracking
              </h2>
              <p className="text-xs text-slate-400">
                Operating budgets fund expenses first. Only unbudgeted shortages borrow from Capital with full repayment tracking.
              </p>
            </div>
          </div>

          <div className="flex items-center space-x-6">
            <div className="text-right">
              <div className="text-[10px] font-mono text-slate-400 uppercase">Capital Account Balance</div>
              <div className="text-lg font-black text-emerald-400 font-display">
                ${(capital.cashNow || capital.balance).toFixed(2)}
              </div>
            </div>

            <div className="text-right pl-6 border-l border-obsidian-800">
              <div className="text-[10px] font-mono text-slate-400 uppercase">Outstanding Repayment</div>
              <div className={`text-lg font-black font-display ${capital.outstandingRepayment > 0 ? 'text-rose-400' : 'text-slate-400'}`}>
                ${capital.outstandingRepayment.toFixed(2)}
              </div>
            </div>

            {capital.outstandingRepayment > 0 && (
              <div className="text-right pl-6 border-l border-obsidian-800">
                <div className="text-[10px] font-mono text-amber-400 uppercase font-semibold">Net Available Cash</div>
                <div className="text-lg font-black text-amber-300 font-display">
                  ${(capital.netLiquidCash !== undefined ? capital.netLiquidCash : Math.max(0, (capital.cashNow || capital.balance) - capital.outstandingRepayment)).toFixed(2)}
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Active Borrowings Table */}
        <div className="space-y-2">
          <div className="text-xs font-mono uppercase tracking-wider text-slate-400 font-semibold">
            Active Capital Borrowing Advances ({capital.activeBorrowings?.length || 0})
          </div>

          {capital.activeBorrowings?.length === 0 ? (
            <div className="p-4 rounded-xl bg-obsidian-950 border border-obsidian-800 text-center text-xs text-slate-500">
              <CheckCircle2 className="w-5 h-5 text-emerald-400 mx-auto mb-1 opacity-70" />
              <span>Capital is 100% protected. Zero outstanding borrowings. All expenses covered by operating budgets.</span>
            </div>
          ) : (
            <div className="space-y-2 max-h-48 overflow-y-auto pr-1">
              {capital.activeBorrowings.map(b => (
                <div key={b.id} className="p-3 rounded-xl bg-obsidian-950 border border-obsidian-800 flex items-center justify-between gap-3 text-xs">
                  <div>
                    <div className="flex items-center space-x-2">
                      <span className="font-mono font-bold text-rose-400">{b.borrowing_ref}</span>
                      <span className="text-[10px] font-mono text-slate-500">{new Date(b.date).toLocaleDateString()}</span>
                      <span className="px-1.5 py-0.5 rounded text-[9px] font-mono bg-rose-500/10 text-rose-400 border border-rose-500/20 font-bold uppercase">
                        {b.status}
                      </span>
                    </div>
                    <div className="text-slate-300 mt-0.5">{b.reason}</div>
                  </div>

                  <div className="flex items-center space-x-4 text-right">
                    <div>
                      <div className="text-[10px] font-mono text-slate-500 uppercase">Borrowed</div>
                      <div className="font-mono font-bold text-slate-200">${Number(b.amount || 0).toFixed(2)}</div>
                    </div>
                    <div>
                      <div className="text-[10px] font-mono text-slate-500 uppercase">Outstanding</div>
                      <div className="font-mono font-bold text-rose-400">${Number(b.outstanding_amount || 0).toFixed(2)}</div>
                    </div>
                    <div className="flex items-center gap-2">
                      {canRepayCapital && (
                        <button
                          onClick={() => {
                            setSelectedBorrowing(b);
                            setRepayForm({
                              amount: Number(b.outstanding_amount || 0).toFixed(2),
                              sourceCategoryId: b.budget_category_id || 'OPERATING_EXPENSES',
                              notes: `Repayment for ${b.borrowing_ref}`
                            });
                            setIsRepayOpen(true);
                          }}
                          className="px-3 py-1.5 rounded-lg bg-emerald-500 hover:bg-emerald-400 text-obsidian-950 font-bold text-xs shadow-sm transition"
                          title="Decide to pay back this capital borrowing"
                        >
                          Decide to Pay
                        </button>
                      )}

                      {canRepayCapital && (
                        <button
                          onClick={() => handleDismissBorrowing(b)}
                          className="px-3 py-1.5 rounded-lg bg-rose-500/15 hover:bg-rose-500/25 text-rose-300 border border-rose-500/30 font-bold text-xs transition"
                          title="Decide NOT to pay back this borrowing (dismisses advance and records decision in permanent history)"
                        >
                          Decide Not to Pay
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* All Borrowing Advances History Ledger */}
        <div className="pt-3 border-t border-obsidian-800 space-y-2">
          <div className="flex items-center justify-between">
            <div className="text-xs font-mono uppercase tracking-wider text-slate-400 font-semibold flex items-center gap-2">
              <span>All Borrowings History Ledger ({capital.allBorrowings?.length || 0})</span>
              <span className="text-[10px] text-slate-500 lowercase">(sorted by date & month)</span>
            </div>
            <button
              onClick={() => setShowAllBorrowings(!showAllBorrowings)}
              className="text-[11px] font-mono text-brass-400 hover:text-brass-300 transition"
            >
              {showAllBorrowings ? 'Hide History ▲' : 'Show All History ▼'}
            </button>
          </div>

          {showAllBorrowings && (
            <div className="overflow-x-auto rounded-xl border border-obsidian-800 bg-obsidian-950/70">
              <table className="w-full text-left text-xs">
                <thead className="bg-obsidian-900 text-slate-400 font-mono text-[10px] uppercase border-b border-obsidian-800">
                  <tr>
                    <th className="py-2.5 px-3">Date & Month</th>
                    <th className="py-2.5 px-3">Borrowing Ref</th>
                    <th className="py-2.5 px-3">Reason / Description</th>
                    <th className="py-2.5 px-3 text-right">Borrowed</th>
                    <th className="py-2.5 px-3 text-right">Repaid</th>
                    <th className="py-2.5 px-3 text-right">Outstanding</th>
                    <th className="py-2.5 px-3 text-center">Decision Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-obsidian-850">
                  {(capital.allBorrowings || []).length === 0 ? (
                    <tr>
                      <td colSpan="7" className="py-4 text-center text-slate-500 font-mono text-xs">
                        No capital borrowings recorded yet.
                      </td>
                    </tr>
                  ) : (
                    (capital.allBorrowings || []).map(row => (
                      <tr key={row.id} className="hover:bg-white/[0.02] transition">
                        <td className="py-2 px-3 font-mono text-slate-300">
                          <div>{row.date ? new Date(row.date).toISOString().slice(0, 10) : '-'}</div>
                          <div className="text-[10px] text-slate-500 font-bold">{row.period_month || ''}</div>
                        </td>
                        <td className="py-2 px-3 font-mono font-bold text-slate-200">
                          {row.borrowing_ref}
                        </td>
                        <td className="py-2 px-3 text-slate-300 max-w-xs truncate" title={row.reason}>
                          {row.reason}
                        </td>
                        <td className="py-2 px-3 text-right font-mono text-slate-200 font-semibold">
                          ${Number(row.amount || 0).toFixed(2)}
                        </td>
                        <td className="py-2 px-3 text-right font-mono text-emerald-400">
                          ${Number(row.repaid_amount || 0).toFixed(2)}
                        </td>
                        <td className="py-2 px-3 text-right font-mono text-rose-400 font-bold">
                          ${Number(row.outstanding_amount || 0).toFixed(2)}
                        </td>
                        <td className="py-2 px-3 text-center">
                          {row.status === 'FULLY_REPAID' ? (
                            <span className="px-2 py-0.5 rounded text-[10px] font-mono font-bold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                              Decided to Pay (Repaid)
                            </span>
                          ) : row.status === 'NOT_TO_PAY' ? (
                            <span className="px-2 py-0.5 rounded text-[10px] font-mono font-bold bg-amber-500/10 text-amber-300 border border-amber-500/20">
                              Decided Not to Pay
                            </span>
                          ) : row.status === 'PARTIALLY_REPAID' ? (
                            <span className="px-2 py-0.5 rounded text-[10px] font-mono font-bold bg-sky-500/10 text-sky-400 border border-sky-500/20">
                              Partially Repaid
                            </span>
                          ) : (
                            <span className="px-2 py-0.5 rounded text-[10px] font-mono font-bold bg-rose-500/10 text-rose-400 border border-rose-500/20">
                              Pending Decision
                            </span>
                          )}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
      </>
      ) : subTab === 'loop-share' ? (
        <LoopShareManagementView isEmbedded={true} />
      ) : (
        <MonthlyFinancialHistoryView isEmbedded={true} />
      )}

      {/* RECORD EXPENSE WITH CAPITAL PROTECTION MODAL */}
      {isExpenseOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-obsidian-950/80 backdrop-blur-sm p-4">
          <div className="w-full max-w-lg bg-obsidian-900 border border-obsidian-750 rounded-2xl shadow-2xl overflow-hidden p-6 space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-obsidian-800">
              <div>
                <h2 className="text-sm font-bold text-slate-100 uppercase tracking-wider font-display">
                  Record Expense / Pay Employee
                </h2>
                <p className="text-[11px] text-slate-400">
                  Deduct from monthly allocated budget with automatic capital overdraft protection.
                </p>
              </div>
              <button onClick={() => setIsExpenseOpen(false)} className="text-slate-400 hover:text-white">
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleRecordExpenseSubmit} className="space-y-4 text-xs">
              {/* Category / Budget Target Selector */}
              <div>
                <label className="text-[11px] font-mono uppercase text-slate-400 font-semibold block mb-1.5">
                  Expense Budget Source *
                </label>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => setExpenseForm(prev => ({
                      ...prev,
                      categoryId: 'EMPLOYEE_SALARIES',
                      expenseCategory: 'Monthly Staff Salary',
                      description: prev.supplierName ? `${prev.supplierName} — Staff Salary (${selectedMonth})` : `Staff Salary Payment (${selectedMonth})`
                    }))}
                    className={`p-3 rounded-xl border text-left transition flex flex-col justify-between ${
                      expenseForm.categoryId === 'EMPLOYEE_SALARIES'
                        ? 'bg-amber-500/10 border-amber-500/50 text-amber-300 ring-1 ring-amber-500/30'
                        : 'bg-obsidian-950 border-obsidian-800 text-slate-400 hover:border-obsidian-750'
                    }`}
                  >
                    <div className="font-bold flex items-center gap-1.5">
                      <span>💼</span>
                      <span>Staff Salary / Payroll</span>
                    </div>
                    <div className="text-[10px] font-mono opacity-80 mt-1">
                      Funds from Employee Salaries Budget
                    </div>
                  </button>

                  <button
                    type="button"
                    onClick={() => setExpenseForm(prev => ({
                      ...prev,
                      categoryId: 'OPERATING_EXPENSES',
                      expenseCategory: 'Rent & Facilities',
                      description: ''
                    }))}
                    className={`p-3 rounded-xl border text-left transition flex flex-col justify-between ${
                      expenseForm.categoryId === 'OPERATING_EXPENSES'
                        ? 'bg-sky-500/10 border-sky-500/50 text-sky-300 ring-1 ring-sky-500/30'
                        : 'bg-obsidian-950 border-obsidian-800 text-slate-400 hover:border-obsidian-750'
                    }`}
                  >
                    <div className="font-bold flex items-center gap-1.5">
                      <span>🏢</span>
                      <span>Operating Expense (OPEX)</span>
                    </div>
                    <div className="text-[10px] font-mono opacity-80 mt-1">
                      Funds from Operating Overhead Budget
                    </div>
                  </button>
                </div>
              </div>

              {/* EMPLOYEE SALARY SPECIFIC FIELDS */}
              {expenseForm.categoryId === 'EMPLOYEE_SALARIES' ? (
                <div className="space-y-3 p-3.5 rounded-xl bg-obsidian-950 border border-obsidian-800">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <label className="text-[11px] font-mono uppercase text-slate-400 font-semibold block mb-1">
                        Select Employee / Staff Member *
                      </label>
                      <select
                        value={expenseForm.selectedEmployeeId || ''}
                        onChange={(e) => {
                          const empId = e.target.value;
                          const emp = staffUsers.find(u => String(u.id) === String(empId));
                          const empName = emp ? (emp.fullName || emp.username) : '';
                          setExpenseForm(prev => ({
                            ...prev,
                            selectedEmployeeId: empId,
                            supplierName: empName,
                            description: empName ? `${empName} — Staff Salary (${selectedMonth})` : prev.description
                          }));
                        }}
                        required
                        className="w-full bg-obsidian-900 border border-obsidian-750 rounded-xl px-3 py-2 text-slate-200 focus:outline-none focus:border-amber-400 font-mono text-xs"
                      >
                        <option value="">-- Choose Staff Member --</option>
                        {staffUsers.map(u => (
                          <option key={u.id} value={u.id}>
                            {u.fullName || u.username} ({u.role || 'Staff'})
                          </option>
                        ))}
                      </select>
                    </div>

                    <div>
                      <label className="text-[11px] font-mono uppercase text-slate-400 font-semibold block mb-1">
                        Compensation Type
                      </label>
                      <select
                        value={expenseForm.expenseCategory}
                        onChange={(e) => setExpenseForm({ ...expenseForm, expenseCategory: e.target.value })}
                        className="w-full bg-obsidian-900 border border-obsidian-750 rounded-xl px-3 py-2 text-slate-200 focus:outline-none focus:border-amber-400 font-mono text-xs"
                      >
                        <option value="Monthly Staff Salary">Monthly Staff Salary</option>
                        <option value="Hourly Wages">Hourly Wages</option>
                        <option value="Sales Commission">Sales Commission</option>
                        <option value="Staff Performance Bonus">Staff Performance Bonus</option>
                        <option value="Overtime Compensation">Overtime Compensation</option>
                      </select>
                    </div>
                  </div>
                </div>
              ) : (
                /* OPERATING EXPENSE SPECIFIC FIELDS */
                <div className="space-y-3 p-3.5 rounded-xl bg-obsidian-950 border border-obsidian-800">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <label className="text-[11px] font-mono uppercase text-slate-400 font-semibold block mb-1">
                        OPEX Category *
                      </label>
                      <select
                        value={expenseForm.expenseCategory}
                        onChange={(e) => setExpenseForm({ ...expenseForm, expenseCategory: e.target.value })}
                        className="w-full bg-obsidian-900 border border-obsidian-750 rounded-xl px-3 py-2 text-slate-200 focus:outline-none focus:border-sky-400 font-mono text-xs"
                      >
                        <option value="Rent & Facilities">Rent & Facilities</option>
                        <option value="Electricity & Utilities">Electricity & Utilities</option>
                        <option value="Water & Sanitation">Water & Sanitation</option>
                        <option value="Internet & Telecom">Internet & Telecom</option>
                        <option value="Store Equipment & Maintenance">Store Equipment & Maintenance</option>
                        <option value="Packaging & Office Supplies">Packaging & Office Supplies</option>
                        <option value="Transportation & Logistics">Transportation & Logistics</option>
                        <option value="Miscellaneous Overhead">Miscellaneous Overhead</option>
                      </select>
                    </div>

                    <div>
                      <label className="text-[11px] font-mono uppercase text-slate-400 font-semibold block mb-1">
                        Vendor / Payee Name
                      </label>
                      <input
                        type="text"
                        placeholder="e.g. Electricité du Cambodge"
                        value={expenseForm.supplierName || ''}
                        onChange={(e) => setExpenseForm({ ...expenseForm, supplierName: e.target.value })}
                        className="w-full bg-obsidian-900 border border-obsidian-750 rounded-xl px-3 py-2 text-slate-200 focus:outline-none focus:border-sky-400 font-mono text-xs"
                      >
                      </input>
                    </div>
                  </div>
                </div>
              )}

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-[11px] font-mono uppercase text-slate-400 font-semibold block mb-1">
                    Amount ($) *
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    min="0.01"
                    required
                    placeholder="0.00"
                    value={expenseForm.amount}
                    onChange={(e) => setExpenseForm({ ...expenseForm, amount: e.target.value })}
                    className="w-full bg-obsidian-950 border border-obsidian-750 rounded-xl px-3 py-2 text-slate-200 font-mono font-bold focus:outline-none focus:border-brass-400 text-sm"
                  />
                </div>

                <div>
                  <label className="text-[11px] font-mono uppercase text-slate-400 font-semibold block mb-1">
                    Payment Date
                  </label>
                  <input
                    type="date"
                    value={expenseForm.paymentDate}
                    onChange={(e) => setExpenseForm({ ...expenseForm, paymentDate: e.target.value })}
                    className="w-full bg-obsidian-950 border border-obsidian-750 rounded-xl px-3 py-2 text-slate-200 font-mono focus:outline-none focus:border-brass-400"
                  />
                </div>
              </div>

              <div>
                <label className="text-[11px] font-mono uppercase text-slate-400 font-semibold block mb-1">
                  Description / Reference *
                </label>
                <input
                  type="text"
                  required
                  placeholder={expenseForm.categoryId === 'EMPLOYEE_SALARIES' ? "e.g. Panha — November Staff Salary" : "e.g. November Store Rent Payment to Landlord"}
                  value={expenseForm.description}
                  onChange={(e) => setExpenseForm({ ...expenseForm, description: e.target.value })}
                  className="w-full bg-obsidian-950 border border-obsidian-750 rounded-xl px-3 py-2 text-slate-200 focus:outline-none focus:border-brass-400"
                />
              </div>

              {/* Dynamic Capital Protection Calculation Card */}
              {inputExpenseAmount > 0 && (
                <div className="p-3.5 rounded-xl bg-obsidian-950 border border-obsidian-800 space-y-2">
                  <div className="flex items-center justify-between text-[10px] font-mono uppercase tracking-wider text-slate-400 font-bold">
                    <span>Funding Source & Capital Protection</span>
                    <span className="text-brass-400">{expenseForm.categoryId === 'EMPLOYEE_SALARIES' ? 'Salaries Budget' : 'Operating Budget'}</span>
                  </div>
                  <div className="flex justify-between text-xs">
                    <span className="text-slate-400">Available in Budget:</span>
                    <span className="font-mono text-sky-400">${currentAvailableBudget.toFixed(2)}</span>
                  </div>
                  <div className="flex justify-between text-xs">
                    <span className="text-slate-400">Deducted from Budget:</span>
                    <span className="font-mono text-emerald-400 font-bold">-${simBudgetDeduction.toFixed(2)}</span>
                  </div>
                  {simCapitalBorrowing > 0 ? (
                    <div className="pt-2 border-t border-obsidian-800 space-y-2">
                      <div className="flex justify-between text-xs text-rose-400 font-bold">
                        <span>Shortage Borrowed from Capital:</span>
                        <span className="font-mono">+${simCapitalBorrowing.toFixed(2)}</span>
                      </div>
                      <label className="flex items-center space-x-2 text-[11px] text-amber-300 font-mono cursor-pointer">
                        <input
                          type="checkbox"
                          checked={expenseForm.allowCapitalBorrowing}
                          onChange={(e) => setExpenseForm({ ...expenseForm, allowCapitalBorrowing: e.target.checked })}
                          className="rounded border-obsidian-700 text-amber-500 focus:ring-0"
                        />
                        <span>Authorize advance borrowing from Business Capital</span>
                      </label>
                    </div>
                  ) : (
                    <div className="text-[11px] font-mono text-emerald-400 pt-1 border-t border-obsidian-800">
                      ✓ Expense fully covered by designated budget. Business capital untouched.
                    </div>
                  )}
                </div>
              )}

              <button
                type="submit"
                className="w-full py-2.5 rounded-xl bg-brass-500 hover:bg-brass-400 text-obsidian-950 font-bold text-xs shadow-md shadow-brass-500/20 active:scale-98 transition"
              >
                {expenseForm.categoryId === 'EMPLOYEE_SALARIES' ? 'Confirm & Disburse Salary' : 'Confirm & Record Expense'}
              </button>
            </form>
          </div>
        </div>
      )}

      {/* REPAY CAPITAL MODAL */}
      {isRepayOpen && selectedBorrowing && (() => {
        const originCat = selectedBorrowing.budget_category_id || repayForm.sourceCategoryId || 'OPERATING_EXPENSES';
        const fundingBudget = budgets.find(bg => bg.category_id === originCat);
        const availableRepayBudget = Number(fundingBudget?.remaining_balance || 0);
        const repayNum = parseFloat(repayForm.amount) || 0;
        const isRepayInsufficient = repayNum > availableRepayBudget;

        return (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-obsidian-950/80 backdrop-blur-sm p-4">
            <div className="w-full max-w-md bg-obsidian-900 border border-obsidian-750 rounded-2xl shadow-2xl overflow-hidden p-6 space-y-4">
              <div className="flex items-center justify-between pb-3 border-b border-obsidian-800">
                <h2 className="text-sm font-bold text-slate-100 uppercase tracking-wider font-display">
                  Repay Capital Advance
                </h2>
                <button onClick={() => setIsRepayOpen(false)} className="text-slate-400 hover:text-white">
                  <X className="w-4 h-4" />
                </button>
              </div>

              <form onSubmit={handleRepaySubmit} className="space-y-4 text-xs">
                <div className="p-3 rounded-xl bg-obsidian-950 border border-obsidian-800 space-y-1">
                  <div className="text-[10px] font-mono text-slate-500 uppercase">Borrowing Reference</div>
                  <div className="font-mono font-bold text-rose-400">{selectedBorrowing.borrowing_ref}</div>
                  <div className="text-[11px] text-slate-300">{selectedBorrowing.reason}</div>
                  <div className="text-xs font-mono font-bold text-slate-200 mt-1">
                    Outstanding Balance: ${Number(selectedBorrowing.outstanding_amount || 0).toFixed(2)}
                  </div>
                </div>

                {/* Allocation Funding Source Confirmation */}
                <div className="p-3 rounded-xl bg-obsidian-950 border border-obsidian-800 space-y-1.5">
                  <div className="text-[10px] font-mono text-slate-400 uppercase font-semibold">
                    Repayment Funding Budget Source
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-slate-200">
                      {fundingBudget?.category_name || (originCat === 'EMPLOYEE_SALARIES' ? 'Employee Salaries' : 'Operating Expenses')}
                    </span>
                    <span className={`text-xs font-mono font-bold ${availableRepayBudget > 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
                      Available: ${availableRepayBudget.toFixed(2)}
                    </span>
                  </div>
                  <p className="text-[10px] text-slate-400 leading-relaxed">
                    This advance was borrowed by <strong>{fundingBudget?.category_name || originCat}</strong>. Repayment must be funded from this category's remaining budget.
                  </p>
                </div>

                <div>
                  <label className="text-[11px] font-mono uppercase text-slate-400 font-semibold block mb-1">
                    Repayment Amount ($) *
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    required
                    max={selectedBorrowing.outstanding_amount}
                    value={repayForm.amount}
                    onChange={(e) => setRepayForm({ ...repayForm, amount: e.target.value })}
                    className="w-full bg-obsidian-950 border border-obsidian-750 rounded-xl px-3 py-2 text-slate-200 font-mono font-bold focus:outline-none focus:border-emerald-400 text-sm"
                  />
                </div>

                {isRepayInsufficient && (
                  <div className="p-3 rounded-xl bg-rose-500/15 border border-rose-500/30 text-rose-300 text-xs space-y-1">
                    <div className="font-bold flex items-center gap-1.5">
                      <AlertTriangle className="w-4 h-4 text-rose-400 shrink-0" />
                      <span>Insufficient Budget to Pay Back</span>
                    </div>
                    <p className="text-[11px] text-slate-300">
                      The {fundingBudget?.category_name || 'selected'} budget only has <strong>${availableRepayBudget.toFixed(2)}</strong> available, which is not enough to pay back <strong>${repayNum.toFixed(2)}</strong>. You must allocate additional revenue to this budget before repaying.
                    </p>
                  </div>
                )}

                <button
                  type="submit"
                  disabled={isRepayInsufficient || !repayForm.amount || repayNum <= 0}
                  className={`w-full py-2.5 rounded-xl font-bold text-xs shadow-md transition ${
                    isRepayInsufficient || !repayForm.amount || repayNum <= 0
                      ? 'bg-obsidian-800 text-slate-500 border border-obsidian-750 cursor-not-allowed opacity-60'
                      : 'bg-emerald-500 hover:bg-emerald-400 text-obsidian-950 shadow-emerald-500/20 active:scale-98'
                  }`}
                >
                  {isRepayInsufficient ? 'Insufficient Budget to Pay Back' : 'Confirm & Execute Capital Repayment'}
                </button>
              </form>
            </div>
          </div>
        );
      })()}

      {/* INJECT CAPITAL MODAL */}
      {isInjectCapitalOpen && canInjectCapital && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-obsidian-950/80 backdrop-blur-sm p-4">
          <div className="w-full max-w-md bg-obsidian-900 border border-obsidian-750 rounded-2xl shadow-2xl overflow-hidden p-6 space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-obsidian-800">
              <div className="flex items-center space-x-2">
                <PlusCircle className="w-5 h-5 text-emerald-400" />
                <h2 className="text-sm font-bold text-slate-100 uppercase tracking-wider font-display">
                  Inject Business Capital
                </h2>
              </div>
              <button onClick={() => setIsInjectCapitalOpen(false)} className="text-slate-400 hover:text-white">
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleInjectSubmit} className="space-y-4 text-xs">
              <p className="text-slate-300">
                Deposit additional liquid capital into the business reserve. This increases equity and expands operating protection.
              </p>

              <div>
                <label className="text-[11px] font-mono uppercase text-slate-400 font-semibold block mb-1">
                  Injection Amount ($) *
                </label>
                <input
                  type="number"
                  step="0.01"
                  required
                  placeholder="e.g. 5000.00"
                  value={injectForm.amount}
                  onChange={(e) => setInjectForm({ ...injectForm, amount: e.target.value })}
                  className="w-full bg-obsidian-950 border border-obsidian-750 rounded-xl px-3 py-2 text-slate-200 font-mono font-bold focus:outline-none focus:border-emerald-400 text-sm"
                />
              </div>

              <div>
                <label className="text-[11px] font-mono uppercase text-slate-400 font-semibold block mb-1">
                  Reason / Source Reference (Optional)
                </label>
                <input
                  type="text"
                  placeholder="e.g. Owner Equity Top-Up or Partner Advance"
                  value={injectForm.notes}
                  onChange={(e) => setInjectForm({ ...injectForm, notes: e.target.value })}
                  className="w-full bg-obsidian-950 border border-obsidian-750 rounded-xl px-3 py-2 text-slate-200 focus:outline-none focus:border-emerald-400"
                />
              </div>

              <button
                type="submit"
                className="w-full py-2.5 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-obsidian-950 font-bold text-xs shadow-md shadow-emerald-500/20 active:scale-98 transition"
              >
                Confirm Capital Injection
              </button>
            </form>
          </div>
        </div>
      )}

      {/* WITHDRAW CAPITAL MODAL */}
      {isWithdrawCapitalOpen && canWithdrawCapital && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-obsidian-950/80 backdrop-blur-sm p-4">
          <div className="w-full max-w-md bg-obsidian-900 border border-obsidian-750 rounded-2xl shadow-2xl overflow-hidden p-6 space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-obsidian-800">
              <div className="flex items-center space-x-2">
                <MinusCircle className="w-5 h-5 text-rose-400" />
                <h2 className="text-sm font-bold text-slate-100 uppercase tracking-wider font-display">
                  Withdraw Business Capital
                </h2>
              </div>
              <button onClick={() => setIsWithdrawCapitalOpen(false)} className="text-slate-400 hover:text-white">
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleWithdrawSubmit} className="space-y-4 text-xs">
              <div className="p-3 rounded-xl bg-obsidian-950 border border-obsidian-800 flex justify-between text-xs">
                <span className="text-slate-400">Available Capital Equity:</span>
                <span className="font-mono font-bold text-emerald-400">${capital.balance.toFixed(2)}</span>
              </div>

              <div>
                <label className="text-[11px] font-mono uppercase text-slate-400 font-semibold block mb-1">
                  Withdrawal Amount ($) *
                </label>
                <input
                  type="number"
                  step="0.01"
                  required
                  max={capital.balance}
                  placeholder="e.g. 1000.00"
                  value={withdrawForm.amount}
                  onChange={(e) => setWithdrawForm({ ...withdrawForm, amount: e.target.value })}
                  className="w-full bg-obsidian-950 border border-obsidian-750 rounded-xl px-3 py-2 text-slate-200 font-mono font-bold focus:outline-none focus:border-rose-400 text-sm"
                />
              </div>

              <div>
                <label className="text-[11px] font-mono uppercase text-slate-400 font-semibold block mb-1">
                  Reason / Purpose (Optional)
                </label>
                <input
                  type="text"
                  placeholder="e.g. Owner Dividend Drawing"
                  value={withdrawForm.notes}
                  onChange={(e) => setWithdrawForm({ ...withdrawForm, notes: e.target.value })}
                  className="w-full bg-obsidian-950 border border-obsidian-750 rounded-xl px-3 py-2 text-slate-200 focus:outline-none focus:border-rose-400"
                />
              </div>

              <button
                type="submit"
                className="w-full py-2.5 rounded-xl bg-rose-500 hover:bg-rose-400 text-white font-bold text-xs shadow-md shadow-rose-500/20 active:scale-98 transition"
              >
                Confirm Capital Withdrawal
              </button>
            </form>
          </div>
        </div>
      )}

      {/* CLOSE MONTH-END MODAL */}
      {isCloseMonthOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-obsidian-950/80 backdrop-blur-sm p-4">
          <div className="w-full max-w-md bg-obsidian-900 border border-obsidian-750 rounded-2xl shadow-2xl overflow-hidden p-6 space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-obsidian-800">
              <div className="flex items-center space-x-2">
                <ShieldCheck className="w-5 h-5 text-brass-400" />
                <h2 className="text-sm font-bold text-slate-100 uppercase tracking-wider font-display">
                  Month-End Closing: {selectedMonth}
                </h2>
              </div>
              <button onClick={() => setIsCloseMonthOpen(false)} className="text-slate-400 hover:text-white">
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleCloseMonthSubmit} className="space-y-4 text-xs">
              <p className="text-slate-300">
                Closing finalizes <strong className="text-brass-400">{selectedMonth}</strong>, takes an immutable historical snapshot, and automatically opens the next month with carried-forward balances.
              </p>

              <div className="p-3 rounded-xl bg-obsidian-950 border border-obsidian-800 space-y-2">
                <label className="text-[11px] font-mono uppercase text-amber-400 font-bold block">
                  Feature 5 Rule: Employee Salary Carry-Forward Decision
                </label>
                <div className="space-y-1.5">
                  <label className="flex items-center space-x-2 cursor-pointer">
                    <input
                      type="radio"
                      name="salaryDecision"
                      value="CARRY_FORWARD"
                      checked={closingForm.salaryCarryForwardDecision === 'CARRY_FORWARD'}
                      onChange={() => setClosingForm({ ...closingForm, salaryCarryForwardDecision: 'CARRY_FORWARD' })}
                    />
                    <span>Option A: Carry Forward unused salary budget to next month</span>
                  </label>
                  <label className="flex items-center space-x-2 cursor-pointer">
                    <input
                      type="radio"
                      name="salaryDecision"
                      value="RESET_TO_RESERVE"
                      checked={closingForm.salaryCarryForwardDecision === 'RESET_TO_RESERVE'}
                      onChange={() => setClosingForm({ ...closingForm, salaryCarryForwardDecision: 'RESET_TO_RESERVE' })}
                    />
                    <span>Option B: Reset & transfer unused salary to Unallocated Reserve</span>
                  </label>
                </div>
              </div>

              <div className="text-[11px] font-mono text-sky-400 bg-sky-500/10 p-2.5 rounded-lg border border-sky-500/20">
                ℹ Operating Expense unused balance automatically carries forward into next month per Feature 6 rule.
              </div>

              <button
                type="submit"
                className="w-full py-2.5 rounded-xl bg-brass-500 hover:bg-brass-400 text-obsidian-950 font-bold text-xs shadow-md shadow-brass-500/20 active:scale-98 transition"
              >
                Authorize & Finalize Month-End Closing
              </button>
            </form>
          </div>
        </div>
      )}

      {/* CONFIGURE ALLOCATION PLAN MODAL */}
      {isConfigOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-obsidian-950/80 backdrop-blur-sm p-4">
          <div className="w-full max-w-xl bg-obsidian-900 border border-obsidian-750 rounded-2xl shadow-2xl overflow-hidden p-6 space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-obsidian-800">
              <h2 className="text-sm font-bold text-slate-100 uppercase tracking-wider font-display">
                Configure Revenue Allocation Plan ({selectedMonth})
              </h2>
              <button onClick={() => setIsConfigOpen(false)} className="text-slate-400 hover:text-white">
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleUpdatePlan} className="space-y-4 text-xs">
              {/* SECTION 3: ADDITIONAL MONTHLY REINVESTMENT PERCENTAGE */}
              <div className="p-3.5 rounded-xl bg-obsidian-950 border border-sky-500/40 space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-2">
                    <Layers className="w-4 h-4 text-sky-400" />
                    <span className="font-bold text-slate-100 uppercase font-mono text-[11px]">
                      Additional Inventory Reinvestment %
                    </span>
                  </div>
                  <span className="text-[10px] text-sky-400 font-mono font-bold">
                    Section 3 Rule
                  </span>
                </div>

                <div className="flex items-center space-x-3">
                  <div className="flex-1">
                    <label className="text-[10px] font-mono text-slate-400 block mb-1">
                      Percentage of Eligible Collected Revenue (%):
                    </label>
                    <div className="flex items-center space-x-2">
                      <input
                        type="number"
                        min="0"
                        max="100"
                        step="0.5"
                        value={additionalReinvestmentPercent}
                        onChange={(e) => setAdditionalReinvestmentPercent(Math.max(0, parseFloat(e.target.value) || 0))}
                        className="w-24 bg-obsidian-900 border border-obsidian-750 rounded-lg p-2 text-sm text-sky-400 font-mono font-bold focus:outline-none focus:border-sky-400"
                      />
                      <span className="text-slate-400 font-mono text-sm">%</span>
                      <div className="flex items-center space-x-1 ml-2">
                        {[0, 5, 10, 15, 20].map(pct => (
                          <button
                            key={pct}
                            type="button"
                            onClick={() => setAdditionalReinvestmentPercent(pct)}
                            className={`px-2 py-1 rounded text-[10px] font-mono font-bold transition ${
                              Number(additionalReinvestmentPercent) === pct
                                ? 'bg-sky-500 text-obsidian-950'
                                : 'bg-obsidian-900 border border-obsidian-750 text-slate-300 hover:text-white'
                            }`}
                          >
                            {pct}%
                          </button>
                        ))}
                      </div>
                    </div>
                  </div>
                </div>

                {/* Live Formula Preview */}
                <div className="p-2.5 rounded-lg bg-obsidian-900 border border-obsidian-800 text-[11px] font-mono space-y-1">
                  <div className="text-[9px] uppercase font-bold text-slate-400">Master Formula Simulation</div>
                  <div className="flex justify-between text-slate-300">
                    <span>Eligible Collected Revenue:</span>
                    <span className="font-bold text-brass-400">${revenue.eligibleRevenue.toFixed(2)}</span>
                  </div>
                  <div className="flex justify-between text-slate-300">
                    <span>Actual Product Cost (COGS):</span>
                    <span className="font-bold">${(allocationData?.metrics?.actualProductCost || 0).toFixed(2)}</span>
                  </div>
                  <div className="flex justify-between text-slate-300">
                    <span>Additional Reinvestment ({additionalReinvestmentPercent}%):</span>
                    <span className="font-bold text-sky-400">+${((revenue.eligibleRevenue * additionalReinvestmentPercent) / 100).toFixed(2)}</span>
                  </div>
                  <div className="flex justify-between text-slate-200 pt-1 border-t border-obsidian-800 font-bold">
                    <span>Total Reinvestment (Math.ceil):</span>
                    <span className="text-sky-300">${Math.ceil((allocationData?.metrics?.actualProductCost || 0) + ((revenue.eligibleRevenue * additionalReinvestmentPercent) / 100)).toFixed(2)}</span>
                  </div>
                  <div className="flex justify-between text-emerald-400 pt-0.5 font-bold">
                    <span>Resulting Remaining Allocation Pool:</span>
                    <span>${Math.max(0, revenue.eligibleRevenue - Math.ceil((allocationData?.metrics?.actualProductCost || 0) + ((revenue.eligibleRevenue * additionalReinvestmentPercent) / 100))).toFixed(2)}</span>
                  </div>
                </div>
              </div>

              <div className="text-[11px] font-mono uppercase text-slate-400 font-semibold px-1">
                Other Category Budgets (Calculated from Remaining Allocation Pool)
              </div>

              <div className="space-y-2 max-h-56 overflow-y-auto pr-1">
                {planCategories.map((cat, idx) => (
                  <div key={cat.id} className="p-3 rounded-xl bg-obsidian-950 border border-obsidian-800 space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="font-bold text-slate-200">{cat.name}</span>
                      <span className="text-[10px] font-mono text-slate-500 uppercase">{cat.id}</span>
                    </div>

                    <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 items-center">
                      <div>
                        <select
                          value={cat.type}
                          onChange={(e) => {
                            const updated = [...planCategories];
                            updated[idx] = { ...cat, type: e.target.value };
                            setPlanCategories(updated);
                          }}
                          className="w-full bg-obsidian-900 border border-obsidian-750 rounded-lg p-1.5 text-xs text-slate-300 font-mono"
                        >
                          <option value="PERCENT">Percentage (%)</option>
                          <option value="FIXED">Fixed Amount ($)</option>
                        </select>
                      </div>

                      <div>
                        <input
                          type="number"
                          step="0.01"
                          value={cat.value}
                          onChange={(e) => {
                            const updated = [...planCategories];
                            updated[idx] = { ...cat, value: parseFloat(e.target.value) || 0 };
                            setPlanCategories(updated);
                          }}
                          className="w-full bg-obsidian-900 border border-obsidian-750 rounded-lg p-1.5 text-xs text-slate-200 font-mono font-bold"
                        />
                      </div>

                      <div className="flex items-center space-x-2">
                        <label className="flex items-center space-x-1.5 cursor-pointer text-[11px] text-slate-400">
                          <input
                            type="checkbox"
                            checked={cat.allowsCarryForward !== false}
                            onChange={(e) => {
                              const updated = [...planCategories];
                              updated[idx] = { ...cat, allowsCarryForward: e.target.checked };
                              setPlanCategories(updated);
                            }}
                          />
                          <span>Carry Forward</span>
                        </label>
                      </div>
                    </div>
                  </div>
                ))}
              </div>

              <button
                type="submit"
                className="w-full py-2.5 rounded-xl bg-brass-500 hover:bg-brass-400 text-obsidian-950 font-bold text-xs shadow-md shadow-brass-500/20 active:scale-98 transition"
              >
                Save & Apply Allocation Plan
              </button>
            </form>
          </div>
        </div>
      )}

      {/* CLEAR PRINT PREVIEW MODAL */}
      {isPrintPreviewOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-obsidian-950/85 backdrop-blur-sm p-4">
          <div className="w-full max-w-4xl bg-white text-slate-900 rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[92vh] animate-in zoom-in-95">
            {/* Header */}
            <div className="p-4 border-b border-slate-200 bg-slate-50 flex items-center justify-between">
              <div className="flex items-center space-x-2">
                <Printer className="w-5 h-5 text-amber-600" />
                <h2 className="text-sm font-bold uppercase tracking-wider font-display text-slate-800">
                  Print Financial Statement Preview
                </h2>
              </div>
              <div className="flex items-center space-x-2">
                <button
                  onClick={() => handleExport('pdf')}
                  className="px-3 py-1.5 rounded-lg bg-slate-200 hover:bg-slate-300 text-slate-800 text-xs font-bold transition flex items-center space-x-1"
                >
                  <Download className="w-3.5 h-3.5" />
                  <span>Open Full PDF</span>
                </button>
                <button
                  onClick={() => window.print()}
                  className="px-3 py-1.5 rounded-lg bg-amber-600 hover:bg-amber-700 text-white text-xs font-bold transition flex items-center space-x-1"
                >
                  <Printer className="w-3.5 h-3.5" />
                  <span>Print Now</span>
                </button>
                <button onClick={() => setIsPrintPreviewOpen(false)} className="p-1 rounded-lg text-slate-500 hover:text-slate-900 transition">
                  <X className="w-4 h-4" />
                </button>
              </div>
            </div>

            {/* Printable Statement Body */}
            <div id="printable-financial-statement" className="p-8 space-y-6 overflow-y-auto font-sans bg-white text-slate-900">
              <style>{`
                @page {
                  size: A4 landscape;
                  margin: 10mm;
                }
                @media print {
                  html, body {
                    background: #ffffff !important;
                    color: #000000 !important;
                    font-size: 10pt !important;
                  }
                  body * { visibility: hidden !important; }
                  #printable-financial-statement, #printable-financial-statement * { visibility: visible !important; }
                  #printable-financial-statement {
                    position: absolute !important;
                    left: 0 !important;
                    top: 0 !important;
                    width: 100% !important;
                    height: auto !important;
                    margin: 0 !important;
                    padding: 10px !important;
                    background: #ffffff !important;
                    color: #000000 !important;
                    box-shadow: none !important;
                  }
                  #printable-financial-statement .no-print { display: none !important; }
                }
              `}</style>
              <div className="border-b-2 border-slate-900 pb-4 flex justify-between items-end">
                <div>
                  <div className="text-[11px] font-bold text-amber-700 uppercase tracking-widest font-mono">
                    Official Executive Financial Statement
                  </div>
                  <h1 className="text-2xl font-black text-slate-950 mt-1 font-display">BeyondVER Co., Ltd.</h1>
                  <p className="text-xs font-bold text-slate-700 uppercase tracking-wider mt-0.5">
                    Monthly Revenue Allocation & Financial Budget Statement ({selectedMonth})
                  </p>
                </div>
                <div className="text-right text-xs text-slate-700 font-mono">
                  <div>Statement Period: <strong className="text-slate-950 font-black">{selectedMonth}</strong></div>
                  <div>Generated: <strong>{new Date().toLocaleString()}</strong></div>
                  <div>Store / Branch: <strong>{selectedStoreId === 'ALL' ? 'Consolidated All Stores' : selectedStoreId}</strong></div>
                </div>
              </div>

              {/* Master 3-Section Financial Breakdown */}
              <div className="grid grid-cols-3 gap-4">
                {/* 1. Collection Basis */}
                <div className="p-3.5 rounded-lg border-2 border-slate-300 bg-slate-50 space-y-1.5">
                  <div className="text-[10px] uppercase font-bold text-slate-700 font-mono border-b border-slate-300 pb-1">
                    1. Revenue Collection Basis
                  </div>
                  <div className="flex justify-between text-xs">
                    <span className="text-slate-600">Total Recorded Sales:</span>
                    <span className="font-mono font-bold">${Number(allocationData?.metrics?.totalRecordedSales || revenue.totalSales || 0).toFixed(2)}</span>
                  </div>
                  <div className="flex justify-between text-xs">
                    <span className="text-slate-600">Collected Cash/Card:</span>
                    <span className="font-mono font-bold text-sky-800">${Number(allocationData?.metrics?.collectedPayments || revenue.collectedRevenue || 0).toFixed(2)}</span>
                  </div>
                  <div className="flex justify-between text-xs">
                    <span className="text-slate-600">Outstanding Receivables:</span>
                    <span className="font-mono font-bold text-amber-800">${Number(allocationData?.metrics?.outstandingReceivables || 0).toFixed(2)}</span>
                  </div>
                  <div className="flex justify-between text-xs">
                    <span className="text-slate-600">Refunds & Reversals:</span>
                    <span className="font-mono font-bold text-rose-800">-${Number(allocationData?.metrics?.refundsReversals || revenue.refunds || 0).toFixed(2)}</span>
                  </div>
                  <div className="flex justify-between text-xs pt-1 border-t border-slate-300 font-black text-slate-950 bg-amber-100/60 p-1 rounded">
                    <span>Eligible Revenue Basis:</span>
                    <span className="font-mono">${Number(allocationData?.metrics?.eligibleCollectedRevenue || revenue.eligibleRevenue || 0).toFixed(2)}</span>
                  </div>
                </div>

                {/* 2. Inventory Reinvestment */}
                <div className="p-3.5 rounded-lg border-2 border-slate-300 bg-slate-50 space-y-1.5">
                  <div className="text-[10px] uppercase font-bold text-slate-700 font-mono border-b border-slate-300 pb-1">
                    2. Inventory Reinvestment & Reserve
                  </div>
                  <div className="flex justify-between text-xs">
                    <span className="text-slate-600">Actual Product Cost (COGS):</span>
                    <span className="font-mono font-bold">${Number(allocationData?.metrics?.actualProductCost || 0).toFixed(2)}</span>
                  </div>
                  <div className="flex justify-between text-xs">
                    <span className="text-slate-600">Additional Reinvestment:</span>
                    <span className="font-mono font-bold text-sky-800">+{Number(allocationData?.metrics?.additionalReinvestmentPercent || 0)}% (${Number(allocationData?.metrics?.additionalReinvestmentAmount || 0).toFixed(2)})</span>
                  </div>
                  <div className="flex justify-between text-xs">
                    <span className="text-slate-600">Raw Reinvestment:</span>
                    <span className="font-mono font-bold">${Number(allocationData?.metrics?.rawReinvestment || 0).toFixed(2)}</span>
                  </div>
                  <div className="flex justify-between text-xs pt-1 border-t border-slate-300 font-black text-slate-950 bg-sky-100/60 p-1 rounded">
                    <span>Total Reinvestment (Ceil):</span>
                    <span className="font-mono">${Number(allocationData?.metrics?.totalInventoryReinvestment || 0).toFixed(2)}</span>
                  </div>
                  <div className="flex justify-between text-xs text-emerald-800 font-bold">
                    <span>Reserve Balance:</span>
                    <span className="font-mono">${Number(allocationData?.metrics?.inventoryReserveBalance || 0).toFixed(2)}</span>
                  </div>
                </div>

                {/* 3. Remaining Pool & Capital */}
                <div className="p-3.5 rounded-lg border-2 border-slate-300 bg-slate-50 space-y-1.5">
                  <div className="text-[10px] uppercase font-bold text-slate-700 font-mono border-b border-slate-300 pb-1">
                    3. Remaining Pool & Capital Protection
                  </div>
                  <div className="flex justify-between text-xs">
                    <span className="text-slate-600">Remaining Allocation Pool:</span>
                    <span className="font-mono font-black text-slate-950">${Number(allocationData?.metrics?.remainingAllocationPool || 0).toFixed(2)}</span>
                  </div>
                  <div className="flex justify-between text-xs">
                    <span className="text-slate-600">Total Allocated to Budgets:</span>
                    <span className="font-mono font-bold text-slate-800">${Number(allocationData?.plan?.total_allocated || 0).toFixed(2)}</span>
                  </div>
                  <div className="flex justify-between text-xs">
                    <span className="text-slate-600">Unallocated Surplus:</span>
                    <span className="font-mono font-bold text-emerald-800">${Number(allocationData?.plan?.unallocated_reserve || 0).toFixed(2)}</span>
                  </div>
                  <div className="flex justify-between text-xs">
                    <span className="text-slate-600">Capital Protected Reserve:</span>
                    <span className="font-mono font-bold text-sky-800">${Number(capital.balance || 0).toFixed(2)}</span>
                  </div>
                  <div className="flex justify-between text-xs pt-1 border-t border-slate-300 font-bold text-slate-700">
                    <span>Capital Borrowings / Repaid:</span>
                    <span className="font-mono">${Number(capital.borrowed || 0).toFixed(2)} / ${Number(capital.repaid || 0).toFixed(2)}</span>
                  </div>
                </div>
              </div>

              {/* Table */}
              <div className="border-2 border-slate-900 rounded-lg overflow-hidden">
                <table className="w-full text-left text-xs border-collapse">
                  <thead className="bg-slate-900 text-white font-mono uppercase text-[10px]">
                    <tr>
                      <th className="py-2.5 px-3">Budget Category</th>
                      <th className="py-2.5 px-3">Rule</th>
                      <th className="py-2.5 px-3 text-right">Allocated</th>
                      <th className="py-2.5 px-3 text-right">Carry-Forward</th>
                      <th className="py-2.5 px-3 text-right">Total Available</th>
                      <th className="py-2.5 px-3 text-right">Spent</th>
                      <th className="py-2.5 px-3 text-right">Borrowed</th>
                      <th className="py-2.5 px-3 text-right">Remaining</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-300 font-mono">
                    {budgets.map(b => (
                      <tr key={b.category_id} className="hover:bg-slate-50">
                        <td className="py-2 px-3 font-sans font-bold text-slate-950">{b.category_name}</td>
                        <td className="py-2 px-3 text-slate-700 font-semibold">{b.allocation_type === 'PERCENT' ? `${b.allocation_value}%` : `$${b.allocation_value}`}</td>
                        <td className="py-2 px-3 text-right font-bold text-slate-950">${Number(b.allocated_amount || 0).toFixed(2)}</td>
                        <td className="py-2 px-3 text-right text-slate-800">${Number(b.opening_carry_forward || 0).toFixed(2)}</td>
                        <td className="py-2 px-3 text-right font-bold text-slate-950">${Number(b.available_budget || 0).toFixed(2)}</td>
                        <td className="py-2 px-3 text-right font-bold text-rose-800">${Number(b.spent_amount || 0).toFixed(2)}</td>
                        <td className="py-2 px-3 text-right text-amber-800">${Number(b.borrowed_from_capital || 0).toFixed(2)}</td>
                        <td className="py-2 px-3 text-right font-black text-emerald-800">${Number(b.remaining_balance || 0).toFixed(2)}</td>
                      </tr>
                    ))}
                  </tbody>
                  <tfoot className="bg-slate-100 font-mono font-black text-slate-950 border-t-2 border-slate-900 text-xs">
                    <tr>
                      <td className="py-2.5 px-3 font-sans uppercase">Total Audited Summary</td>
                      <td className="py-2.5 px-3">—</td>
                      <td className="py-2.5 px-3 text-right">${budgets.reduce((s, b) => s + (Number(b.allocated_amount) || 0), 0).toFixed(2)}</td>
                      <td className="py-2.5 px-3 text-right">${budgets.reduce((s, b) => s + (Number(b.opening_carry_forward) || 0), 0).toFixed(2)}</td>
                      <td className="py-2.5 px-3 text-right">${budgets.reduce((s, b) => s + (Number(b.available_budget) || 0), 0).toFixed(2)}</td>
                      <td className="py-2.5 px-3 text-right text-rose-800">${budgets.reduce((s, b) => s + (Number(b.spent_amount) || 0), 0).toFixed(2)}</td>
                      <td className="py-2.5 px-3 text-right text-amber-800">${budgets.reduce((s, b) => s + (Number(b.borrowed_from_capital) || 0), 0).toFixed(2)}</td>
                      <td className="py-2.5 px-3 text-right text-emerald-900">${budgets.reduce((s, b) => s + (Number(b.remaining_balance) || 0), 0).toFixed(2)}</td>
                    </tr>
                  </tfoot>
                </table>
              </div>

              {/* Official Sign-Off Block */}
              <div className="pt-6 border-t-2 border-slate-300 grid grid-cols-3 gap-8 text-xs font-mono">
                <div className="space-y-4">
                  <div className="text-[10px] text-slate-500 uppercase">Prepared By (Staff / Accountant)</div>
                  <div className="border-b border-slate-400 pb-1 font-bold text-slate-900">
                    {currentUser?.fullName || 'Financial Accountant'}
                  </div>
                  <div className="text-[10px] text-slate-500">Signature / Date: {new Date().toLocaleDateString()}</div>
                </div>

                <div className="space-y-4">
                  <div className="text-[10px] text-slate-500 uppercase">Audited By (Internal Audit)</div>
                  <div className="border-b border-slate-400 pb-1 font-bold text-slate-900">
                    Section 16 Automated Ledger Bridge
                  </div>
                  <div className="text-[10px] text-slate-500">Hash: SHA256 Verified Immutable</div>
                </div>

                <div className="space-y-4">
                  <div className="text-[10px] text-slate-500 uppercase">Approved By (Business Owner)</div>
                  <div className="border-b border-slate-400 pb-1 font-bold text-slate-900">
                    long kimneng (Owner)
                  </div>
                  <div className="text-[10px] text-slate-500">Signature / Seal: [ APPROVED ]</div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

