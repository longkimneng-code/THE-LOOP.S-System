import React, { useState, useEffect } from 'react';
import { 
  Settings, 
  Layers, 
  BookOpen, 
  RotateCcw, 
  Coins, 
  Share2, 
  ShieldCheck, 
  Plus, 
  Search,
  CheckCircle,
  AlertCircle,
  Database,
  RefreshCw,
  Zap,
  Store,
  ArrowDownLeft,
  ArrowUpRight,
  UserPlus,
  Trash2,
  Edit3,
  Lock,
  ShieldAlert
} from 'lucide-react';
import { api, formatMoney } from '../api';
import ShippingCategoriesView from './ShippingCategoriesView';
import ProductCategoriesView from './ProductCategoriesView';
import ConfirmModal from './ConfirmModal';
import LoopShareManagementView from '../../../components/admin/LoopShareManagementView';

export default function AccountingSettings({ mode, onShowToast, currentUser }) {
  const [subTab, setSubTab] = useState('capital');
  const [capitalData, setCapitalData] = useState(null);
  const [ledgerEntries, setLedgerEntries] = useState([]);
  const [accounts, setAccounts] = useState([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [loading, setLoading] = useState(true);

  // Role-based permission check for capital management
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
  const canManageStoreShare = ['OWNER', 'SUPER_ADMIN'].includes(userRole) || currentUser?.permissions?.manageStoreShare === true || currentUser?.permissions?.manageCapital === true;

  // Stock Loops Integration State
  const [stockStatus, setStockStatus] = useState(null);
  const [isSyncing, setIsSyncing] = useState(false);
  const [syncLogs, setSyncLogs] = useState([]);

  // Capital Transaction Modal
  const [isCapitalModalOpen, setIsCapitalModalOpen] = useState(false);
  const [capitalForm, setCapitalForm] = useState({
    capitalAccountId: '',
    partnerName: '',
    type: 'CAPITAL_INJECTION',
    amount: '',
    paymentMethod: 'BANK_TRANSFER',
    notes: ''
  });

  // Add Partner / Investor Modal
  const [isAddPartnerModalOpen, setIsAddPartnerModalOpen] = useState(false);
  const [newPartnerForm, setNewPartnerForm] = useState({
    partnerName: '',
    partnerRole: 'Co-founder',
    ownershipPercentage: '',
    initialInvestment: '',
    notes: ''
  });

  // Edit Partner / Investor Modal
  const [isEditPartnerModalOpen, setIsEditPartnerModalOpen] = useState(false);
  const [editPartnerForm, setEditPartnerForm] = useState({
    id: '',
    partnerName: '',
    partnerRole: 'Co-investor',
    ownershipPercentage: '',
    notes: ''
  });

  // Reversal Modal
  const [reversingEntry, setReversingEntry] = useState(null);
  const [reversalReason, setReversalReason] = useState('');

  // Reusable Confirmation Modal State
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
    loadAll();
    loadStockStatus();
  }, []);

  const loadStockStatus = async () => {
    try {
      const status = await api.getStockLoopsStatus();
      setStockStatus(status);
    } catch (err) {
      console.warn('Stock loops status check error:', err);
    }
  };

  const addLog = (msg) => {
    const time = new Date().toLocaleTimeString();
    setSyncLogs(prev => [`[${time}] ${msg}`, ...prev.slice(0, 15)]);
  };

  const handleSyncProducts = async () => {
    setIsSyncing(true);
    try {
      addLog('Contacting Stock Loops (Port 3000)... fetching products...');
      const res = await api.syncStockProducts();
      addLog(`Success! Received ${res.productsFetched} products (${res.skusSynced} SKUs).`);
      onShowToast(`Synced ${res.productsFetched} products from Stock Loops!`, 'success');
      loadStockStatus();
    } catch (err) {
      addLog(`Error syncing products: ${err.message}`);
      onShowToast(err.message, 'error');
    } finally {
      setIsSyncing(false);
    }
  };

  const handleSyncSales = async () => {
    setIsSyncing(true);
    try {
      addLog('Fetching completed sales from Stock Loops POS register...');
      const res = await api.syncStockSales();
      addLog(`Completed! Synced ${res.newlyPostedToLedger} new sales into Finance Ledger ($${res.totalRevenueSynced}).`);
      onShowToast(`Posted ${res.newlyPostedToLedger} sales to ledger!`, 'success');
      loadAll();
      loadStockStatus();
    } catch (err) {
      addLog(`Error syncing sales: ${err.message}`);
      onShowToast(err.message, 'error');
    } finally {
      setIsSyncing(false);
    }
  };

  const handlePushLandedCosts = async () => {
    setIsSyncing(true);
    try {
      addLog('Pushing landed costs & catalog items to Stock Loops product catalog...');
      const res = await api.pushLandedCostsToStock();
      const codeList = (res.shipmentCodes && res.shipmentCodes.length > 0) ? ` [${res.shipmentCodes.join(', ')}]` : '';
      const catMsg = (res.createdCategories && res.createdCategories.length > 0) ? ` Auto-created categories: ${res.createdCategories.join(', ')}.` : '';
      addLog(`Success! Pushed landed costs${codeList}: Updated ${res.updatedCount || 0} SKUs, Created ${res.createdCount || 0} SKUs in Stock Loops.${catMsg}`);
      onShowToast(`Pushed landed costs${codeList} to Stock Loops! (${res.updatedCount || 0} updated, ${res.createdCount || 0} created)`, 'success');
      loadStockStatus();
    } catch (err) {
      addLog(`Error pushing landed costs: ${err.message}`);
      onShowToast(err.message, 'error');
    } finally {
      setIsSyncing(false);
    }
  };

  const handleFullSync = async () => {
    setIsSyncing(true);
    try {
      addLog('Initiating full 2-way synchronization with Stock Loops (Port 3000)...');
      const res = await api.runFullStockSync();
      addLog(`Full sync complete! Products: ${res.productsSync.productsFetched}, Sales posted: ${res.salesSync.newlyPostedToLedger}`);
      onShowToast('2-way synchronization completed successfully!', 'success');
      loadAll();
      loadStockStatus();
    } catch (err) {
      addLog(`Sync failed: ${err.message}`);
      onShowToast(err.message, 'error');
    } finally {
      setIsSyncing(false);
    }
  };

  const loadAll = async () => {
    try {
      const [cap, led, acc] = await Promise.all([
        api.getCapital(),
        api.getLedger(),
        api.getAccounts()
      ]);
      setCapitalData(cap);
      setLedgerEntries(led);
      setAccounts(acc);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const handleInitiateAddPartner = (e) => {
    e.preventDefault();
    if (!canManageCapital) {
      onShowToast('Access denied: Only Business Owners and Executive Directors can add investors.', 'error');
      return;
    }
    const name = (newPartnerForm.partnerName || '').trim();
    if (!name) {
      onShowToast('Please enter the partner/investor full name.', 'error');
      return;
    }

    const initInv = Number(newPartnerForm.initialInvestment) || 0;
    const equityPct = Number(newPartnerForm.ownershipPercentage) || 0;

    setConfirmConfig({
      isOpen: true,
      title: 'Confirm Add New Investor / Partner',
      subtitle: `Registering "${name}" to the business equity registry.`,
      variant: 'primary',
      details: [
        { label: 'Investor Name', value: name },
        { label: 'Title / Role', value: newPartnerForm.partnerRole || 'Co-investor' },
        { label: 'Ownership Equity', value: equityPct > 0 ? `${equityPct}%` : '0%' },
        { label: 'Initial Investment', value: initInv > 0 ? formatMoney(initInv) : '$0.00', highlight: initInv > 0 },
        { label: 'Notes', value: newPartnerForm.notes || 'None' }
      ],
      confirmText: 'Confirm & Register Partner',
      onConfirm: async () => {
        setConfirmConfig(prev => ({ ...prev, isLoading: true }));
        try {
          await api.addCapitalPartner({
            partnerName: name,
            partnerRole: newPartnerForm.partnerRole || 'Co-investor',
            ownershipPercentage: equityPct,
            initialInvestment: initInv,
            notes: newPartnerForm.notes
          });
          setIsAddPartnerModalOpen(false);
          setNewPartnerForm({ partnerName: '', partnerRole: 'Co-founder', ownershipPercentage: '', initialInvestment: '', notes: '' });
          setConfirmConfig({ isOpen: false, details: [] });
          onShowToast(`Investor "${name}" registered successfully!`, 'success');
          loadAll();
        } catch (err) {
          onShowToast(err.message, 'error');
          setConfirmConfig(prev => ({ ...prev, isLoading: false }));
        }
      }
    });
  };

  const handleOpenEditPartner = (partner) => {
    if (!canManageCapital) {
      onShowToast('Access denied: Only Business Owners and Executive Directors can edit investors.', 'error');
      return;
    }
    setEditPartnerForm({
      id: partner.id,
      partnerName: partner.partnerName || '',
      partnerRole: partner.partnerRole || 'Co-investor',
      ownershipPercentage: partner.ownershipPercentage !== undefined ? String(partner.ownershipPercentage) : '',
      notes: partner.notes || ''
    });
    setIsEditPartnerModalOpen(true);
  };

  const handleSaveEditPartner = async (e) => {
    e.preventDefault();
    if (!editPartnerForm.partnerName.trim()) {
      onShowToast('Partner name cannot be empty.', 'error');
      return;
    }
    const newPct = parseFloat(editPartnerForm.ownershipPercentage);
    if (isNaN(newPct) || newPct < 0 || newPct > 100) {
      onShowToast('Ownership percentage must be between 0% and 100%.', 'error');
      return;
    }
    try {
      await api.updateCapitalPartner(editPartnerForm.id, {
        partnerName: editPartnerForm.partnerName.trim(),
        partnerRole: editPartnerForm.partnerRole,
        ownershipPercentage: newPct,
        notes: editPartnerForm.notes
      });
      setIsEditPartnerModalOpen(false);
      onShowToast(`Investor "${editPartnerForm.partnerName}" updated! All investor shares auto-rebalanced to exactly 100%.`, 'success');
      loadAll();
    } catch (err) {
      onShowToast(err.message, 'error');
    }
  };

  const handleDeletePartner = (partner) => {
    if (!canManageCapital) {
      onShowToast('Access denied: Only Business Owners and Executive Directors can remove partners.', 'error');
      return;
    }

    setConfirmConfig({
      isOpen: true,
      title: 'Remove Investor / Partner',
      subtitle: `Are you sure you want to remove investor "${partner.partnerName}"?`,
      variant: 'danger',
      details: [
        { label: 'Partner Name', value: partner.partnerName },
        { label: 'Role / Title', value: partner.partnerRole || 'Partner' },
        { label: 'Current Equity', value: formatMoney(partner.currentEquity), highlight: true },
        { label: 'Total Invested', value: formatMoney(partner.totalInvested) }
      ],
      confirmText: 'Remove Investor',
      onConfirm: async () => {
        setConfirmConfig(prev => ({ ...prev, isLoading: true }));
        try {
          await api.deleteCapitalPartner(partner.id);
          setConfirmConfig({ isOpen: false, details: [] });
          onShowToast(`Partner "${partner.partnerName}" removed.`, 'success');
          loadAll();
        } catch (err) {
          onShowToast(err.message, 'error');
          setConfirmConfig(prev => ({ ...prev, isLoading: false }));
        }
      }
    });
  };

  const handleInitiateCapitalTx = (e) => {
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
    const selectedAcc = capitalData?.accounts?.find(a => a.id === capitalForm.capitalAccountId);
    const partnerName = selectedAcc ? selectedAcc.partnerName : capitalForm.partnerName;
    const partnerRole = selectedAcc ? selectedAcc.partnerRole : 'Partner';

    const typeLabels = {
      CAPITAL_INJECTION: 'Capital Injection (Cash In)',
      INITIAL_INVESTMENT: 'Initial Seed Capital',
      OWNER_DRAWING: 'Owner Drawing (Cash Out)',
      DIVIDEND_PAYOUT: 'Dividend Payout (Distribution)'
    };

    const isOutflow = capitalForm.type.includes('DRAWING') || capitalForm.type.includes('DIVIDEND');

    setConfirmConfig({
      isOpen: true,
      title: 'Confirm Capital Transaction',
      subtitle: 'Please review and confirm this equity ledger transaction before posting.',
      variant: isOutflow ? 'warning' : 'success',
      details: [
        { label: 'Investor / Partner', value: `${partnerName} (${partnerRole})` },
        { label: 'Transaction Type', value: typeLabels[capitalForm.type] || capitalForm.type },
        { label: 'Amount', value: formatMoney(numAmount), highlight: true },
        { label: 'Payment Account', value: capitalForm.paymentMethod === 'CASH' ? 'Cash in Hand (1010)' : 'Bank Operating Account (1020)' },
        { label: 'Equity Account', value: isOutflow ? 'Owner Drawings (3030) [Dr]' : 'Owner Capital (3010) [Cr]' },
        { label: 'Notes / Reference', value: capitalForm.notes || 'None' }
      ],
      confirmText: 'Confirm & Post to Ledger',
      onConfirm: async () => {
        setConfirmConfig(prev => ({ ...prev, isLoading: true }));
        try {
          await api.addCapitalTransaction({
            capitalAccountId: capitalForm.capitalAccountId,
            partnerName: partnerName,
            type: capitalForm.type,
            amount: numAmount,
            paymentMethod: capitalForm.paymentMethod || 'BANK_TRANSFER',
            notes: capitalForm.notes
          });
          setIsCapitalModalOpen(false);
          setCapitalForm({ capitalAccountId: '', partnerName: '', type: 'CAPITAL_INJECTION', amount: '', notes: '', paymentMethod: 'BANK_TRANSFER' });
          setConfirmConfig({ isOpen: false, details: [] });
          onShowToast('Capital transaction recorded & equity ledger updated!', 'success');
          loadAll();
        } catch (err) {
          onShowToast(err.message, 'error');
          setConfirmConfig(prev => ({ ...prev, isLoading: false }));
        }
      }
    });
  };

  const handleConfirmReverseJournal = (e) => {
    e.preventDefault();
    if (!reversalReason.trim()) {
      onShowToast('Please provide an audit justification for reversing this journal.', 'error');
      return;
    }
    setConfirmConfig({
      isOpen: true,
      title: 'Confirm Journal Reversal',
      subtitle: 'This will post a balanced correcting reversal entry to the General Ledger.',
      variant: 'danger',
      details: [
        { label: 'Original Entry', value: reversingEntry?.entryNumber || '' },
        { label: 'Original Memo', value: reversingEntry?.memo || '' },
        { label: 'Reversal Reason', value: reversalReason }
      ],
      confirmText: 'Confirm & Reverse',
      onConfirm: async () => {
        setConfirmConfig(prev => ({ ...prev, isLoading: true }));
        try {
          await api.reverseJournal(reversingEntry.id, reversalReason);
          setReversingEntry(null);
          setReversalReason('');
          setConfirmConfig({ isOpen: false, details: [] });
          onShowToast('Journal entry reversed with offsetting replacement!', 'success');
          loadAll();
        } catch (err) {
          onShowToast(err.message, 'error');
          setConfirmConfig(prev => ({ ...prev, isLoading: false }));
        }
      }
    });
  };

  const handleInitiatePushLandedCosts = () => {
    setConfirmConfig({
      isOpen: true,
      title: 'Push Landed Costs to Stock Management',
      subtitle: 'This will update costMinor for all matching SKUs on Stock Loops (Port 3000) and auto-create any missing categories and products.',
      variant: 'primary',
      details: [
        { label: 'Target System', value: 'Stock Management Loops (Port 3000)' },
        { label: 'Scope', value: 'Finalized Import Landed Costs' },
        { label: 'Action', value: 'Sync Cost of Goods & Inventory Receipts' }
      ],
      confirmText: 'Push to Stock Loops',
      onConfirm: async () => {
        setConfirmConfig({ isOpen: false, details: [] });
        await handlePushLandedCosts();
      }
    });
  };

  const handleInitiateFullSync = () => {
    setConfirmConfig({
      isOpen: true,
      title: 'Execute Full 2-Way Synchronization',
      subtitle: 'Synchronize products and SKUs from Stock Loops into Finance, and post all completed POS sales receipts into the General Ledger.',
      variant: 'primary',
      details: [
        { label: 'Sync Direction', value: 'Bi-directional (Port 3000 ↔ Port 3001)' },
        { label: 'Operations', value: '1. Catalog SKUs, 2. POS Sales Journals' }
      ],
      confirmText: 'Start Full Sync',
      onConfirm: async () => {
        setConfirmConfig({ isOpen: false, details: [] });
        await handleFullSync();
      }
    });
  };

  const filteredAccounts = accounts.filter(a => 
    a.name.toLowerCase().includes(searchTerm.toLowerCase()) || 
    a.code.includes(searchTerm) ||
    a.type.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="space-y-6">
      
      {/* Header & Sub-navigation */}
      <div className="flex flex-wrap items-center justify-between gap-4 pb-4 border-b border-white/10">
        <div>
          <h2 className="text-xl font-bold text-white flex items-center gap-2">
            <Settings className="w-5 h-5 text-[#E5A93C]" />
            Accounting & General Ledger Control
          </h2>
          <p className="text-xs text-slate-400 mt-1">
            Founder capital equity, immutable double-entry journal ledger, and the 65 standard chart of accounts.
          </p>
        </div>

        <div className="flex items-center bg-[#111520] p-1 rounded-xl border border-white/10 flex-wrap gap-1">
          {[
            { id: 'product_categories', label: 'Product Categories' },
            { id: 'shipping', label: 'Shipping Categories' },
            { id: 'capital', label: 'Capital & Equity Ledger' },
            ...(canManageStoreShare ? [{ id: 'store_share', label: 'Store Share Management' }] : []),
            { id: 'ledger', label: 'General Ledger (Journals)' },
            { id: 'coa', label: 'Chart of Accounts (65)' },
            { id: 'integration', label: 'Stock Loops Integration' }
          ].map((tab) => (
            <button
              key={tab.id}
              onClick={() => setSubTab(tab.id)}
              className={`px-3.5 py-1.5 rounded-lg text-xs font-semibold transition ${
                subTab === tab.id
                  ? 'bg-[#E5A93C] text-black font-bold shadow'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      {/* -------------------------------------------------------------------- */}
      {/* 1. CAPITAL & EQUITY LEDGER */}
      {/* -------------------------------------------------------------------- */}
      {subTab === 'capital' && capitalData && (
        <div className="space-y-6">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-base font-bold text-white flex items-center gap-2">
                <Coins className="w-4 h-4 text-[#E5A93C]" />
                Founder Capital & Ownership Shares
              </h3>
              <p className="text-xs text-slate-400">
                Tracks equity contributions, additional capital injections, and drawings without distorting revenue.
              </p>
            </div>

            <div className="flex items-center gap-2">
              <button
                onClick={() => {
                  if (!canManageCapital) {
                    onShowToast('Permission denied: Only Owners & Directors may add investors.', 'error');
                    return;
                  }
                  setIsAddPartnerModalOpen(true);
                }}
                disabled={!canManageCapital}
                className={`flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-bold transition border ${
                  canManageCapital
                    ? 'bg-white/5 hover:bg-white/10 text-white border-white/15'
                    : 'bg-white/5 text-slate-500 border-white/5 cursor-not-allowed opacity-60'
                }`}
                title={canManageCapital ? 'Add new investor or co-founder' : 'Requires Executive / Owner role'}
              >
                {canManageCapital ? <UserPlus className="w-4 h-4 text-[#E5A93C]" /> : <Lock className="w-3.5 h-3.5 text-slate-500" />}
                <span>+ Add Investor / Partner</span>
              </button>

              <button
                onClick={() => {
                  if (!canManageCapital) {
                    onShowToast('Permission denied: Only Owners & Directors may manage capital transactions.', 'error');
                    return;
                  }
                  setIsCapitalModalOpen(true);
                }}
                disabled={!canManageCapital}
                className={`flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-bold transition shadow-lg ${
                  canManageCapital
                    ? 'bg-[#E5A93C] hover:bg-[#F3C368] text-black shadow-[#E5A93C]/20'
                    : 'bg-slate-700 text-slate-400 cursor-not-allowed opacity-60'
                }`}
                title={canManageCapital ? 'Record capital injection or founder drawing' : 'Requires Executive / Owner role'}
              >
                {canManageCapital ? <Plus className="w-4 h-4" /> : <Lock className="w-3.5 h-3.5" />}
                <span>Capital In / Out</span>
              </button>
            </div>
          </div>

          {/* Permission Alert Banner for Non-Executive Roles */}
          {!canManageCapital && (
            <div className="p-3 bg-amber-500/10 border border-amber-500/20 rounded-xl text-amber-300 text-xs flex items-center gap-2.5">
              <ShieldAlert className="w-4 h-4 flex-shrink-0" />
              <span>
                <strong>Capital Protection Active:</strong> Only Business Owners, Managing Directors, and Executive Admins may add investors or record capital injections/drawings. You are signed in as <span className="font-mono bg-black/30 px-1.5 py-0.5 rounded text-amber-200">{userRole}</span> (Read-Only access).
              </span>
            </div>
          )}

          {/* Total Equity Invariant Status Bar */}
          <div className="flex items-center justify-between px-4 py-2.5 rounded-xl bg-obsidian-900 border border-white/10">
            <div className="flex items-center space-x-2">
              <span className="text-xs text-slate-400">Total Legal Equity Ownership:</span>
              <span className="font-mono text-xs font-bold text-emerald-400">
                {(capitalData?.accounts || []).reduce((s, a) => s + Number(a.ownershipPercentage || 0), 0).toFixed(2)}%
              </span>
              <span className="text-[10px] px-2 py-0.5 rounded bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 font-bold">
                100% INVARIANT ENFORCED
              </span>
            </div>
            <span className="text-[11px] font-mono text-slate-400">
              Proportional Dilution Active on All Equity Changes
            </span>
          </div>

          {/* Partner Equity Cards */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {(capitalData.accounts || []).map((acc) => (
              <div key={acc.id} className="glass-card p-5 border border-white/10 space-y-3 relative group">
                <div className="flex items-center justify-between">
                  <div>
                    <h4 className="font-bold text-white text-base">{acc.partnerName}</h4>
                    <span className="text-xs text-slate-400">{acc.partnerRole || 'Partner'}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="px-2.5 py-1 rounded-full text-xs font-mono font-bold bg-[#E5A93C]/20 text-[#E5A93C] border border-[#E5A93C]/40">
                      {acc.ownershipPercentage}% Equity
                    </span>
                    {canManageCapital && (
                      <div className="flex items-center gap-1.5">
                        <button
                          type="button"
                          onClick={() => handleOpenEditPartner(acc)}
                          className="p-1.5 rounded-lg bg-white/5 hover:bg-sky-500/20 text-slate-400 hover:text-sky-300 border border-white/5 transition"
                          title={`Edit investor ${acc.partnerName}`}
                        >
                          <Edit3 className="w-3.5 h-3.5" />
                        </button>
                        <button
                          type="button"
                          onClick={() => handleDeletePartner(acc)}
                          className="p-1.5 rounded-lg bg-white/5 hover:bg-rose-500/20 text-slate-400 hover:text-rose-400 border border-white/5 transition"
                          title={`Remove investor ${acc.partnerName}`}
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    )}
                  </div>
                </div>

                <div className="grid grid-cols-3 gap-2 pt-2 border-t border-white/5 text-center text-xs">
                  <div className="bg-white/5 p-2 rounded-lg">
                    <span className="text-[10px] text-slate-400 block">Total Invested</span>
                    <span className="font-bold num-font text-white">{formatMoney(acc.totalInvested)}</span>
                  </div>
                  <div className="bg-white/5 p-2 rounded-lg">
                    <span className="text-[10px] text-slate-400 block">Drawings</span>
                    <span className="font-bold num-font text-rose-300">-{formatMoney(acc.totalWithdrawn)}</span>
                  </div>
                  <div className="bg-white/5 p-2 rounded-lg">
                    <span className="text-[10px] text-slate-400 block">Current Equity</span>
                    <span className="font-bold num-font text-[#10B981]">{formatMoney(acc.currentEquity)}</span>
                  </div>
                </div>
              </div>
            ))}
            {(!capitalData.accounts || capitalData.accounts.length === 0) && (
              <div className="col-span-2 p-8 border border-dashed border-white/10 rounded-2xl text-center space-y-2">
                <Coins className="w-8 h-8 text-slate-600 mx-auto" />
                <p className="text-sm font-semibold text-slate-400">No Investors or Partners Registered Yet</p>
                <p className="text-xs text-slate-500">
                  Click "+ Add Investor / Partner" above to register founders, CEOs, and shareholders.
                </p>
              </div>
            )}
          </div>

          {/* Capital Transactions History */}
          <div className="glass-card overflow-hidden">
            <div className="p-4 border-b border-white/10 font-bold text-sm text-white">
              Capital Transactions History
            </div>
            <div className="divide-y divide-white/5 text-xs">
              {capitalData.transactions.map((tx) => (
                <div key={tx.id} className="p-3.5 flex items-center justify-between hover:bg-white/5 transition">
                  <div>
                    <span className="font-bold text-white mr-2">
                      {tx.type.replace(/_/g, ' ')}
                    </span>
                    <span className="text-slate-400">{tx.notes}</span>
                    <div className="text-[10px] text-slate-500 font-mono mt-0.5">
                      Date: {tx.transactionDate} • Method: {tx.paymentMethod}
                    </div>
                  </div>
                  <span className={`num-font font-bold text-sm ${
                    tx.type.includes('INVESTMENT') || tx.type.includes('INJECTION')
                      ? 'text-[#10B981]'
                      : 'text-rose-400'
                  }`}>
                    {tx.type.includes('INVESTMENT') || tx.type.includes('INJECTION') ? '+' : '-'}
                    {formatMoney(tx.amount)}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* -------------------------------------------------------------------- */}
      {/* 2. GENERAL LEDGER (JOURNALS) */}
      {/* -------------------------------------------------------------------- */}
      {subTab === 'ledger' && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-base font-bold text-white flex items-center gap-2">
                <BookOpen className="w-4 h-4 text-[#38BDF8]" />
                Double-Entry General Ledger
              </h3>
              <p className="text-xs text-slate-400">
                Immutable audit journal. Balanced invariant strictly enforced ($Debits \equiv $Credits).
              </p>
            </div>
          </div>

          <div className="space-y-3">
            {ledgerEntries.map((je) => (
              <div key={je.id} className="glass-card p-4 border border-white/10 space-y-3">
                <div className="flex flex-wrap items-center justify-between gap-2 pb-2 border-b border-white/5">
                  <div className="flex items-center gap-2">
                    <span className="font-mono font-bold text-white text-xs">{je.entryNumber}</span>
                    <span className={`px-2 py-0.5 rounded text-[10px] font-bold font-mono ${
                      je.status === 'POSTED'
                        ? 'bg-[#10B981]/20 text-[#10B981]'
                        : 'bg-rose-500/20 text-rose-300'
                    }`}>
                      {je.status}
                    </span>
                    <span className="text-xs text-slate-400 font-medium">{je.memo}</span>
                  </div>

                  <div className="flex items-center gap-3">
                    <span className="text-xs font-mono text-slate-400">{je.accountingDate}</span>
                    {je.status === 'POSTED' && (
                      <button
                        onClick={() => {
                          setReversingEntry(je);
                          setReversalReason('');
                        }}
                        className="px-2.5 py-1 rounded bg-white/5 hover:bg-rose-500/20 text-slate-400 hover:text-rose-300 text-xs transition border border-white/5 flex items-center gap-1"
                      >
                        <RotateCcw className="w-3 h-3" />
                        Reverse & Correct
                      </button>
                    )}
                  </div>
                </div>

                {/* Journal Lines Table */}
                <table className="w-full text-xs text-left">
                  <thead className="text-[10px] uppercase text-slate-500 border-b border-white/5">
                    <tr>
                      <th className="py-1">Account Code & Name</th>
                      <th className="py-1 text-right">Debit ($)</th>
                      <th className="py-1 text-right">Credit ($)</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-white/5">
                    {je.lines.map((line, idx) => (
                      <tr key={idx}>
                        <td className="py-1.5 text-slate-300">
                          <span className="font-mono font-bold text-white mr-2">{line.accountCode}</span>
                          {line.accountName}
                        </td>
                        <td className="py-1.5 text-right num-font font-medium text-slate-200">
                          {line.debit > 0 ? formatMoney(line.debit) : '—'}
                        </td>
                        <td className="py-1.5 text-right num-font font-medium text-slate-200">
                          {line.credit > 0 ? formatMoney(line.credit) : '—'}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                  <tfoot>
                    <tr className="border-t border-white/10 font-bold text-white text-[11px]">
                      <td className="pt-2 text-slate-400">Total Balanced Entry</td>
                      <td className="pt-2 text-right num-font text-[#10B981]">{formatMoney(je.totalDebit)}</td>
                      <td className="pt-2 text-right num-font text-[#10B981]">{formatMoney(je.totalCredit)}</td>
                    </tr>
                  </tfoot>
                </table>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* -------------------------------------------------------------------- */}
      {/* 3. CHART OF ACCOUNTS (65 ACCOUNTS) */}
      {/* -------------------------------------------------------------------- */}
      {subTab === 'coa' && (
        <div className="glass-card overflow-hidden">
          <div className="p-4 border-b border-white/10 flex flex-wrap items-center justify-between gap-4">
            <div>
              <h3 className="text-sm font-bold text-white flex items-center gap-2">
                <Layers className="w-4 h-4 text-[#E5A93C]" />
                Standard 65 Chart of Accounts
              </h3>
              <p className="text-xs text-slate-400">
                Expanded starter chart from Loops Finance V3 specification.
              </p>
            </div>

            <div className="relative w-64">
              <Search className="w-3.5 h-3.5 absolute left-3 top-3 text-slate-400" />
              <input
                type="text"
                placeholder="Search code or account..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full bg-[#111520] border border-white/10 rounded-xl pl-9 pr-3 py-1.5 text-xs text-white"
              />
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-xs text-left">
              <thead className="bg-[#111520] text-slate-400 border-b border-white/10 uppercase tracking-wider font-semibold">
                <tr>
                  <th className="py-3 px-4">Code</th>
                  <th className="py-3 px-4">Account Name</th>
                  <th className="py-3 px-3">Type</th>
                  <th className="py-3 px-3">Normal Side</th>
                  <th className="py-3 px-3 text-center">System Lock</th>
                  <th className="py-3 px-4 text-right font-bold">Current Balance</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5">
                {filteredAccounts.map((acc) => (
                  <tr key={acc.code} className="hover:bg-white/5 transition">
                    <td className="py-2.5 px-4 font-mono font-bold text-[#E5A93C]">{acc.code}</td>
                    <td className="py-2.5 px-4 font-medium text-white">{acc.name}</td>
                    <td className="py-2.5 px-3">
                      <span className="px-2 py-0.5 rounded text-[10px] font-mono bg-white/5 text-slate-300">
                        {acc.type}
                      </span>
                    </td>
                    <td className="py-2.5 px-3 text-slate-400 font-mono text-[10px]">{acc.normalSide}</td>
                    <td className="py-2.5 px-3 text-center">
                      {acc.isSystemProtected ? (
                        <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-[#10B981]/15 text-[#10B981]">
                          Protected
                        </span>
                      ) : (
                        <span className="text-slate-500">—</span>
                      )}
                    </td>
                    <td className="py-2.5 px-4 text-right num-font font-bold text-white">
                      {formatMoney(acc.balance || 0)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* -------------------------------------------------------------------- */}
      {/* 4. STOCK MANAGEMENT LOOPS LIVE INTEGRATION (PORT 3000) */}
      {/* -------------------------------------------------------------------- */}
      {subTab === 'integration' && (
        <div className="space-y-6">
          
          {/* Status & Sync Command Center */}
          <div className="glass-card p-6 space-y-6">
            <div className="flex flex-wrap items-center justify-between gap-4 pb-4 border-b border-white/10">
              <div>
                <div className="text-xs font-mono text-[#E5A93C] uppercase tracking-wider font-semibold">
                  Port 3000 Bridge • Section 6 Specification
                </div>
                <h3 className="text-base font-bold text-white flex items-center gap-2">
                  <Database className="w-4 h-4 text-[#E5A93C]" />
                  Stock Management Loops Real-Time Integration
                </h3>
                <p className="text-xs text-slate-400 mt-0.5">
                  Live connection to Stock Loops running on port 3000. Synchronizes catalog, POS sales, and landed costs.
                </p>
              </div>

              <div className="flex items-center gap-2.5">
                <button
                  onClick={loadStockStatus}
                  className="p-2 rounded-xl bg-white/5 hover:bg-white/10 text-slate-300 border border-white/10 transition"
                  title="Refresh Connection Status"
                >
                  <RefreshCw className={`w-4 h-4 ${isSyncing ? 'animate-spin' : ''}`} />
                </button>

                {stockStatus?.connected ? (
                  <span className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-[#10B981]/20 text-[#10B981] border border-[#10B981]/40 text-xs font-bold font-mono">
                    <span className="w-2 h-2 rounded-full bg-[#10B981] animate-pulse" />
                    Connected to Port 3000
                  </span>
                ) : (
                  <span className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-[#F43F5E]/20 text-rose-300 border border-[#F43F5E]/40 text-xs font-bold font-mono">
                    <AlertCircle className="w-3.5 h-3.5" />
                    Port 3000 Offline
                  </span>
                )}

                <button
                  onClick={handleInitiateFullSync}
                  disabled={isSyncing || !stockStatus?.connected}
                  className="flex items-center gap-2 px-4 py-2 rounded-xl bg-gradient-to-r from-[#E5A93C] to-[#D4952B] hover:from-[#F3C368] hover:to-[#E5A93C] text-black text-xs font-bold transition disabled:opacity-50 shadow-lg shadow-[#E5A93C]/20"
                >
                  <Zap className="w-4 h-4" />
                  <span>{isSyncing ? 'Synchronizing...' : 'Run Full 2-Way Sync'}</span>
                </button>
              </div>
            </div>

            {/* Live Stock Loops Metrics */}
            {stockStatus?.connected ? (
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
                <div className="bg-white/5 p-3 rounded-xl border border-white/5">
                  <span className="text-[10px] text-slate-400 uppercase block mb-1">Target Business</span>
                  <div className="font-bold text-white text-sm truncate">{stockStatus.storeName}</div>
                  <span className="text-[10px] text-slate-500 font-mono">Owner: {stockStatus.ownerName}</span>
                </div>

                <div className="bg-white/5 p-3 rounded-xl border border-white/5">
                  <span className="text-[10px] text-slate-400 uppercase block mb-1">Primary Location</span>
                  <div className="font-bold text-white text-sm truncate">{stockStatus.defaultLocation}</div>
                  <span className="text-[10px] text-slate-500 font-mono">API v{stockStatus.version}</span>
                </div>

                <div className="bg-white/5 p-3 rounded-xl border border-white/5">
                  <span className="text-[10px] text-slate-400 uppercase block mb-1">Stock Loops Catalog</span>
                  <div className="font-bold text-[#E5A93C] text-sm num-font">
                    {stockStatus.totalProductsInStock} Products ({stockStatus.totalSkusInStock} SKUs)
                  </div>
                  <span className="text-[10px] text-slate-500 font-mono">{stockStatus.totalUnitsInStock} physical units</span>
                </div>

                <div className="bg-white/5 p-3 rounded-xl border border-white/5">
                  <span className="text-[10px] text-slate-400 uppercase block mb-1">POS Sales Recorded</span>
                  <div className="font-bold text-[#10B981] text-sm num-font">
                    {stockStatus.totalSalesCountInStock} Completed Sales
                  </div>
                  <span className="text-[10px] text-[#10B981] font-mono">Ready to post to ledger</span>
                </div>
              </div>
            ) : (
              <div className="p-4 bg-[#F43F5E]/10 border border-[#F43F5E]/30 rounded-xl text-xs text-rose-200">
                <strong>Cannot reach Stock Management Loops on http://localhost:3000.</strong>
                <p className="text-[11px] mt-1 opacity-90">
                  Ensure the Stock Loops backend is running on port 3000 (`node backend/src/server.js` inside Stock_management_loops).
                </p>
              </div>
            )}

            {/* Individual Sync Action Buttons */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-2">
              <button
                onClick={handleSyncProducts}
                disabled={isSyncing || !stockStatus?.connected}
                className="p-3 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 text-left transition disabled:opacity-50"
              >
                <div className="flex items-center justify-between font-bold text-white text-xs mb-1">
                  <span>1. Sync Products & SKUs</span>
                  <ArrowDownLeft className="w-3.5 h-3.5 text-[#38BDF8]" />
                </div>
                <p className="text-[11px] text-slate-400">
                  Pulls products from Stock Loops so they are available in Landed Cost batches.
                </p>
              </button>

              <button
                onClick={handleSyncSales}
                disabled={isSyncing || !stockStatus?.connected}
                className="p-3 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 text-left transition disabled:opacity-50"
              >
                <div className="flex items-center justify-between font-bold text-white text-xs mb-1">
                  <span>2. Sync POS Sales</span>
                  <ArrowDownLeft className="w-3.5 h-3.5 text-[#10B981]" />
                </div>
                <p className="text-[11px] text-slate-400">
                  Converts POS receipts into Revenue & Landed COGS balanced journal lines.
                </p>
              </button>

              <button
                onClick={handleInitiatePushLandedCosts}
                disabled={isSyncing || !stockStatus?.connected}
                className="p-3 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 text-left transition disabled:opacity-50"
              >
                <div className="flex items-center justify-between font-bold text-white text-xs mb-1">
                  <span>3. Push Landed Costs</span>
                  <ArrowUpRight className="w-3.5 h-3.5 text-[#E5A93C]" />
                </div>
                <p className="text-[11px] text-slate-400">
                  Pushes finalized unit landed costs (e.g. $11.77, $3.82) to Stock Loops variants.
                </p>
              </button>
            </div>
          </div>

          {/* Real-time Activity Log */}
          <div className="glass-card p-5 space-y-3">
            <div className="flex items-center justify-between text-xs">
              <h4 className="font-bold text-white">Live Sync Activity Log</h4>
              <span className="font-mono text-slate-400">{syncLogs.length} events logged</span>
            </div>

            <div className="bg-[#0C0F17] p-3 rounded-xl border border-white/5 font-mono text-[11px] space-y-1.5 min-h-[100px] max-h-48 overflow-y-auto">
              {syncLogs.length > 0 ? (
                syncLogs.map((log, idx) => (
                  <div key={idx} className="text-slate-300">
                    {log}
                  </div>
                ))
              ) : (
                <div className="text-slate-600 italic">
                  No sync commands executed yet in this session. Click "Run Full 2-Way Sync" to start.
                </div>
              )}
            </div>
          </div>

          {/* Event Contract Reference */}
          <div className="glass-card p-5 text-xs space-y-2">
            <h4 className="font-bold text-white">Section 6 Ownership & Invariant Rules:</h4>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-slate-300 text-[11px] pt-1">
              <div>
                <strong className="text-[#E5A93C] block mb-1">Stock Loops Owns (Port 3000):</strong>
                • Product definitions, SKUs, and barcodes<br />
                • Physical counts and warehouse shelf locations<br />
                • Purchase orders quantities and physical receipt (GRN)<br />
                • POS terminal registers and sales capture
              </div>
              <div>
                <strong className="text-[#38BDF8] block mb-1">Loops Finance Owns (Port 3001):</strong>
                • The single source of ledger truth<br />
                • Bank accounts, cash flow, and AP/AR<br />
                • Supplier advances and 30/70 payment disbursement<br />
                • Landed Cost computation and weighted-average COGS
              </div>
            </div>
          </div>

        </div>
      )}

      {/* 5a. PRODUCT CATEGORIES MASTER (FINANCE OWNED) */}
      {subTab === 'product_categories' && (
        <ProductCategoriesView onShowToast={onShowToast} />
      )}

      {/* 5b. SHIPPING CATEGORIES LOGISTICS MANAGEMENT */}
      {subTab === 'shipping' && (
        <ShippingCategoriesView onShowToast={onShowToast} />
      )}

      {/* 5c. STORE SHARE MANAGEMENT (RESTRICTED PERMISSION) */}
      {subTab === 'store_share' && canManageStoreShare && (
        <div className="glass-card p-6 border border-rose-500/20">
          <LoopShareManagementView isEmbedded={true} />
        </div>
      )}
      {/* MODAL: ADD INVESTOR / PARTNER */}
      {isAddPartnerModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="glass-card-elevated w-full max-w-md p-6 border border-white/20 animate-in fade-in space-y-4">
            <div className="flex items-start justify-between">
              <div>
                <h3 className="text-base font-bold text-white flex items-center gap-2">
                  <UserPlus className="w-5 h-5 text-[#E5A93C]" />
                  Add Business Investor / Partner
                </h3>
                <p className="text-xs text-slate-400 mt-1">
                  Onboard a co-founder, executive, or financial investor and assign equity ownership.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setIsAddPartnerModalOpen(false)}
                className="text-slate-400 hover:text-white p-1 rounded-lg hover:bg-white/5"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleInitiateAddPartner} className="space-y-3.5 text-xs">
              <div>
                <label className="block text-slate-300 font-medium mb-1">
                  Investor / Partner Full Name <span className="text-rose-400">*</span>
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Michael Smith"
                  value={newPartnerForm.partnerName}
                  onChange={(e) => setNewPartnerForm({ ...newPartnerForm, partnerName: e.target.value })}
                  className="w-full bg-[#111520] border border-white/10 rounded-lg p-2.5 text-white focus:border-[#E5A93C] focus:outline-none"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-slate-300 font-medium mb-1">
                    Title / Role <span className="text-rose-400">*</span>
                  </label>
                  <select
                    value={newPartnerForm.partnerRole}
                    onChange={(e) => setNewPartnerForm({ ...newPartnerForm, partnerRole: e.target.value })}
                    className="w-full bg-[#111520] border border-white/10 rounded-lg p-2.5 text-white"
                  >
                    <option value="Co-founder">Co-founder</option>
                    <option value="CEO">CEO</option>
                    <option value="Managing Founder">Managing Founder</option>
                    <option value="Managing Director">Managing Director</option>
                    <option value="Co-investor">Co-investor</option>
                    <option value="Angel Investor">Angel Investor</option>
                    <option value="Venture Partner">Venture Partner</option>
                    <option value="Principal Shareholder">Principal Shareholder</option>
                    <option value="Silent Partner">Silent Partner</option>
                  </select>
                </div>

                <div>
                  <label className="block text-slate-300 font-medium mb-1">
                    Ownership Equity (%)
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    max="100"
                    placeholder="e.g. 25"
                    value={newPartnerForm.ownershipPercentage}
                    onChange={(e) => setNewPartnerForm({ ...newPartnerForm, ownershipPercentage: e.target.value })}
                    className="w-full bg-[#111520] border border-white/10 rounded-lg p-2.5 text-white num-font"
                  />
                </div>
              </div>

              <div>
                <label className="block text-slate-300 font-medium mb-1">
                  Initial Capital Investment ($ USD, Optional)
                </label>
                <input
                  type="number"
                  step="0.01"
                  min="0"
                  placeholder="e.g. 10000.00"
                  value={newPartnerForm.initialInvestment}
                  onChange={(e) => setNewPartnerForm({ ...newPartnerForm, initialInvestment: e.target.value })}
                  className="w-full bg-[#111520] border border-white/10 rounded-lg p-2.5 text-white num-font"
                />
                <span className="text-[10px] text-slate-500 mt-1 block">
                  If set, automatically debits Bank (1020) and credits Owner Capital (3010).
                </span>
              </div>

              <div>
                <label className="block text-slate-300 font-medium mb-1">
                  Notes / Agreement Terms
                </label>
                <input
                  type="text"
                  placeholder="e.g. Seed equity agreement"
                  value={newPartnerForm.notes}
                  onChange={(e) => setNewPartnerForm({ ...newPartnerForm, notes: e.target.value })}
                  className="w-full bg-[#111520] border border-white/10 rounded-lg p-2.5 text-white"
                />
              </div>

              <div className="flex justify-end gap-2.5 pt-4 border-t border-white/10">
                <button
                  type="button"
                  onClick={() => setIsAddPartnerModalOpen(false)}
                  className="px-4 py-2 rounded-lg bg-white/5 text-slate-300 hover:bg-white/10"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 rounded-lg bg-[#E5A93C] text-black font-bold hover:bg-[#F3C368]"
                >
                  Continue & Review
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL: EDIT INVESTOR / PARTNER */}
      {isEditPartnerModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="glass-card-elevated w-full max-w-md p-6 border border-white/20 animate-in fade-in space-y-4">
            <div className="flex items-start justify-between">
              <div>
                <h3 className="text-base font-bold text-white flex items-center gap-2">
                  <Edit3 className="w-5 h-5 text-sky-400" />
                  Edit Investor / Partner Details
                </h3>
                <p className="text-xs text-slate-400 mt-1">
                  Update legal ownership percentage. Proportional dilution will automatically adjust all other investors to maintain exactly 100% total equity.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setIsEditPartnerModalOpen(false)}
                className="text-slate-400 hover:text-white p-1 rounded-lg hover:bg-white/5"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleSaveEditPartner} className="space-y-3.5 text-xs">
              <div>
                <label className="block text-slate-300 font-medium mb-1">
                  Investor / Partner Full Name <span className="text-rose-400">*</span>
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Michael Smith"
                  value={editPartnerForm.partnerName}
                  onChange={(e) => setEditPartnerForm({ ...editPartnerForm, partnerName: e.target.value })}
                  className="w-full bg-[#111520] border border-white/10 rounded-lg p-2.5 text-white focus:border-sky-400 focus:outline-none"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-slate-300 font-medium mb-1">
                    Title / Role <span className="text-rose-400">*</span>
                  </label>
                  <select
                    value={editPartnerForm.partnerRole}
                    onChange={(e) => setEditPartnerForm({ ...editPartnerForm, partnerRole: e.target.value })}
                    className="w-full bg-[#111520] border border-white/10 rounded-lg p-2.5 text-white"
                  >
                    <option value="Co-founder">Co-founder</option>
                    <option value="CEO">CEO</option>
                    <option value="Managing Founder">Managing Founder</option>
                    <option value="Managing Director">Managing Director</option>
                    <option value="Co-investor">Co-investor</option>
                    <option value="Angel Investor">Angel Investor</option>
                    <option value="Venture Partner">Venture Partner</option>
                    <option value="Principal Shareholder">Principal Shareholder</option>
                    <option value="Silent Partner">Silent Partner</option>
                  </select>
                </div>

                <div>
                  <label className="block text-slate-300 font-medium mb-1">
                    Ownership Equity (%)
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    max="100"
                    placeholder="e.g. 25"
                    value={editPartnerForm.ownershipPercentage}
                    onChange={(e) => setEditPartnerForm({ ...editPartnerForm, ownershipPercentage: e.target.value })}
                    className="w-full bg-[#111520] border border-white/10 rounded-lg p-2.5 text-white num-font focus:border-sky-400 focus:outline-none"
                  />
                </div>
              </div>

              <div className="p-2.5 rounded-lg bg-sky-500/10 border border-sky-500/20 text-[11px] text-sky-300">
                <strong>Automatic Proportional Dilution:</strong> Modifying this share will automatically recalculate and rescale other active investors proportionally so total equity remains exactly 100.00%.
              </div>

              <div>
                <label className="block text-slate-300 font-medium mb-1">
                  Notes / Agreement Terms
                </label>
                <input
                  type="text"
                  placeholder="e.g. Updated shareholder agreement"
                  value={editPartnerForm.notes}
                  onChange={(e) => setEditPartnerForm({ ...editPartnerForm, notes: e.target.value })}
                  className="w-full bg-[#111520] border border-white/10 rounded-lg p-2.5 text-white"
                />
              </div>

              <div className="flex justify-end gap-2.5 pt-4 border-t border-white/10">
                <button
                  type="button"
                  onClick={() => setIsEditPartnerModalOpen(false)}
                  className="px-4 py-2 rounded-lg bg-white/5 text-slate-300 hover:bg-white/10"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 rounded-lg bg-sky-500 text-black font-bold hover:bg-sky-400"
                >
                  Save & Rebalance Equity
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL: CAPITAL INJECTION / DRAWING */}
      {isCapitalModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="glass-card-elevated w-full max-w-md p-6 border border-white/20 animate-in fade-in space-y-4">
            <div className="flex items-start justify-between">
              <div>
                <h3 className="text-base font-bold text-white flex items-center gap-2">
                  <Coins className="w-5 h-5 text-[#E5A93C]" />
                  Record Capital Transaction
                </h3>
                <p className="text-xs text-slate-400 mt-1">
                  Add partner investment or record founder drawing.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setIsCapitalModalOpen(false)}
                className="text-slate-400 hover:text-white p-1 rounded-lg hover:bg-white/5"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleInitiateCapitalTx} className="space-y-3.5 text-xs">
              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="text-slate-300 font-medium">
                    Partner / Investor <span className="text-rose-400">*</span>
                  </label>
                  {canManageCapital && (
                    <button
                      type="button"
                      onClick={() => {
                        setIsCapitalModalOpen(false);
                        setIsAddPartnerModalOpen(true);
                      }}
                      className="text-[11px] text-[#E5A93C] hover:underline flex items-center gap-1"
                    >
                      <UserPlus className="w-3 h-3" />
                      + Add New Investor
                    </button>
                  )}
                </div>
                <select
                  required
                  value={capitalForm.capitalAccountId}
                  onChange={(e) => {
                    const selected = capitalData?.accounts?.find(a => a.id === e.target.value);
                    setCapitalForm({
                      ...capitalForm,
                      capitalAccountId: e.target.value,
                      partnerName: selected ? selected.partnerName : ''
                    });
                  }}
                  className="w-full bg-[#111520] border border-white/10 rounded-lg p-2.5 text-white focus:border-[#E5A93C] focus:outline-none"
                >
                  <option value="">-- Select Registered Investor / Partner --</option>
                  {(capitalData?.accounts || []).map(acc => (
                    <option key={acc.id} value={acc.id}>
                      {acc.partnerName} — {acc.partnerRole || 'Partner'} ({acc.ownershipPercentage}% Equity)
                    </option>
                  ))}
                </select>
                {(!capitalData?.accounts || capitalData.accounts.length === 0) && (
                  <p className="text-[11px] text-amber-400 mt-1">
                    No investors registered yet. Please click "+ Add New Investor" first.
                  </p>
                )}
              </div>

              <div>
                <label className="block text-slate-300 font-medium mb-1">Transaction Type</label>
                <select
                  value={capitalForm.type}
                  onChange={(e) => setCapitalForm({ ...capitalForm, type: e.target.value })}
                  className="w-full bg-[#111520] border border-white/10 rounded-lg p-2.5 text-white"
                >
                  <option value="CAPITAL_INJECTION">Capital Injection (Dr Bank, Cr 3010 Owner Capital)</option>
                  <option value="INITIAL_INVESTMENT">Initial Seed Capital (Dr Bank, Cr 3010)</option>
                  <option value="OWNER_DRAWING">Owner Drawing (Dr 3030 Drawings, Cr Bank)</option>
                  <option value="DIVIDEND_PAYOUT">Dividends Declared (Dr 3040 Dividends, Cr Bank)</option>
                </select>
              </div>

              <div>
                <label className="block text-slate-300 font-medium mb-1">
                  Amount ($ USD) <span className="text-rose-400">*</span>
                </label>
                <input
                  type="number"
                  step="0.01"
                  min="0.01"
                  required
                  placeholder="0.00"
                  value={capitalForm.amount}
                  onChange={(e) => setCapitalForm({ ...capitalForm, amount: e.target.value })}
                  className="w-full bg-[#111520] border border-white/10 rounded-lg p-2.5 text-white num-font focus:border-[#E5A93C] focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-slate-300 font-medium mb-1">
                  Payment Account
                </label>
                <select
                  value={capitalForm.paymentMethod || 'BANK_TRANSFER'}
                  onChange={(e) => setCapitalForm({ ...capitalForm, paymentMethod: e.target.value })}
                  className="w-full bg-[#111520] border border-white/10 rounded-lg p-2.5 text-white"
                >
                  <option value="BANK_TRANSFER">Bank Operating Account (1020 - Wire / Transfer)</option>
                  <option value="CASH">Cash in Hand / Cash Register (1010)</option>
                </select>
              </div>

              <div>
                <label className="block text-slate-300 font-medium mb-1">Notes / Reference</label>
                <input
                  type="text"
                  placeholder="e.g. Seed expansion round"
                  value={capitalForm.notes}
                  onChange={(e) => setCapitalForm({ ...capitalForm, notes: e.target.value })}
                  className="w-full bg-[#111520] border border-white/10 rounded-lg p-2.5 text-white"
                />
              </div>

              <div className="flex justify-end gap-2.5 pt-4 border-t border-white/10">
                <button
                  type="button"
                  onClick={() => setIsCapitalModalOpen(false)}
                  className="px-4 py-2 rounded-lg bg-white/5 text-slate-300 hover:bg-white/10"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 rounded-lg bg-[#E5A93C] text-black font-bold hover:bg-[#F3C368]"
                >
                  Review & Post
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL: REVERSE JOURNAL */}
      {reversingEntry && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="glass-card-elevated w-full max-w-md p-6 border border-white/20 animate-in fade-in space-y-4">
            <h3 className="text-base font-bold text-white mb-1">Reverse Journal Entry</h3>
            <p className="text-xs text-slate-400">
              Posting reversal for <strong className="text-white font-mono">{reversingEntry.entryNumber}</strong>. Per V3 rules, entries are immutable and must be corrected via balancing reversal.
            </p>

            <form onSubmit={handleConfirmReverseJournal} className="space-y-3.5 text-xs">
              <div>
                <label className="block text-slate-300 font-medium mb-1">
                  Reason for Reversal <span className="text-rose-400">*</span>
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Inaccurate billing amount; corrected voucher issued"
                  value={reversalReason}
                  onChange={(e) => setReversalReason(e.target.value)}
                  className="w-full bg-[#111520] border border-white/10 rounded-lg p-2.5 text-white"
                />
              </div>

              <div className="flex justify-end gap-2.5 pt-4 border-t border-white/10">
                <button
                  type="button"
                  onClick={() => setReversingEntry(null)}
                  className="px-4 py-2 rounded-lg bg-white/5 text-slate-300 hover:bg-white/10"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 rounded-lg bg-rose-600 text-white font-bold hover:bg-rose-500"
                >
                  Review & Confirm Reversal
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* GLOBAL REUSABLE CONFIRM MODAL */}
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

