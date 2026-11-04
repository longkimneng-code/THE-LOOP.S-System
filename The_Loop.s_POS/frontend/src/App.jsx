import React from 'react';
import { SyncProvider } from './context/SyncContext';
import { PosProvider, usePos } from './context/PosContext';
import AuthPage from './components/auth/AuthPage';
import AdminDashboardView from './components/admin/AdminDashboardView';
import TerminalHeader from './components/TerminalHeader';
import PosNavigationTabs from './components/PosNavigationTabs';
import ProductCatalogGrid from './components/ProductCatalogGrid';
import ActiveCart from './components/ActiveCart';
import PosDashboardView from './components/PosDashboardView';
import SalesHistoryView from './components/SalesHistoryView';
import HardwareSettingsView from './components/HardwareSettingsView';
import UserAndAccessManagementView from './components/UserAndAccessManagementView';
import TransactionDetailModal from './components/TransactionDetailModal';
import BarcodeListener from './components/BarcodeListener';
import CheckoutModal from './components/CheckoutModal';
import ShiftModal from './components/ShiftModal';
import CashMovementModal from './components/CashMovementModal';
import RefundModal from './components/RefundModal';
import ReceiptPreviewModal from './components/ReceiptPreviewModal';
import PinLockModal from './components/PinLockModal';
import SyncStatusPanel from './components/SyncStatusPanel';
import UserManagementModal from './components/UserManagementModal';
import CurrencyModal from './components/CurrencyModal';
import ShiftOpeningGate from './components/shifts/ShiftOpeningGate';
import ShiftHistoryView from './components/shifts/ShiftHistoryView';
import SavedOrdersView from './components/saved-orders/SavedOrdersView';
import SaveOrderModal from './components/saved-orders/SaveOrderModal';
import StoreSelectionModal from './components/StoreSelectionModal';
import StockModuleView from './modules/stock/StockModuleView';
import FinanceModuleView from './modules/finance/FinanceModuleView';
import { Loader2 } from 'lucide-react';

function PosTerminalApp() {
  const { activeTab, shiftInfo } = usePos();

  return (
    <div className="flex flex-col flex-1 w-full h-full overflow-hidden bg-obsidian-950 text-slate-100 font-sans">
      {/* 1. Original POS Terminal Header */}
      <TerminalHeader />

      {/* 2. Original POS Navigation Tabs */}
      <PosNavigationTabs />

      {/* 3. Main Body View (Switches based on activeTab) */}
      {(activeTab === 'REGISTER' || activeTab === 'NEW_SALE' || activeTab === 'New Sale') && (
        !shiftInfo?.hasActiveShift ? (
          <ShiftOpeningGate />
        ) : (
          <main className="flex-1 flex overflow-hidden">
            {/* Left: Product Catalog Grid & Search */}
            <ProductCatalogGrid />

            {/* Right: Active Order Cart & Fast Checkout Panel */}
            <ActiveCart />
          </main>
        )
      )}

      {activeTab === 'HOLD' && <SavedOrdersView />}

      {activeTab === 'SHIFTS' && <ShiftHistoryView />}

      {activeTab === 'DASHBOARD' && <PosDashboardView />}

      {activeTab === 'HISTORY' && <SalesHistoryView />}

      {activeTab === 'HARDWARE' && <HardwareSettingsView />}

      {activeTab === 'USERS' && <UserAndAccessManagementView />}

      {/* 4. Global Hardware Scanner Listener */}
      <BarcodeListener />
    </div>
  );
}

function MainAppRouter() {
  const { isAuthenticated, authLoading, appView, setAppView, currentUser } = usePos();

  const hasBackoffice = React.useMemo(() => {
    if (!currentUser) return false;
    return currentUser.role === 'OWNER' || 
           currentUser.role === 'SUPER_ADMIN' || 
           currentUser.role === 'POS_ADMIN' || 
           currentUser.role === 'STORE_MANAGER' || 
           currentUser.role === 'STOCK_ADMIN' ||
           currentUser.role === 'FINANCE_ADMIN' ||
           currentUser.permissions?.accessBackoffice === true ||
           currentUser.permissions?.manageEmployees === true ||
           currentUser.permissions?.accessStockApp === true ||
           currentUser.permissions?.accessFinanceApp === true ||
           currentUser.permissions?.viewFinancialReports === true;
  }, [currentUser]);

  // Prevent unauthorized access to Backoffice: if appView === 'ADMIN' but user lacks permission, force redirect to 'POS'
  React.useEffect(() => {
    if (isAuthenticated && currentUser && appView === 'ADMIN' && !hasBackoffice) {
      setAppView('POS');
    }
  }, [isAuthenticated, currentUser, appView, hasBackoffice, setAppView]);

  // 1. Session Initialization Splash
  if (authLoading) {
    return (
      <div className="h-screen w-screen bg-obsidian-950 flex flex-col items-center justify-center space-y-4 text-slate-100 font-sans">
        <div className="w-12 h-12 rounded-2xl bg-gradient-to-tr from-brass-500 via-brass-400 to-brass-600 flex items-center justify-center font-display font-black text-obsidian-950 text-2xl shadow-xl shadow-brass-500/20">
          ∞
        </div>
        <div className="text-center space-y-1">
          <h2 className="text-base font-bold uppercase tracking-widest font-display text-slate-200">
            The Loops Retail Suite
          </h2>
          <div className="flex items-center justify-center space-x-2 text-xs font-mono text-brass-400">
            <Loader2 className="w-3.5 h-3.5 animate-spin" />
            <span>Verifying private identity session...</span>
          </div>
        </div>
      </div>
    );
  }

  // 2. Unauthenticated Barrier: Loyverse-Style Auth Experience
  if (!isAuthenticated) {
    return <AuthPage />;
  }

  // 3. Authenticated App Router: Clean Authentic Single-Navbar System
  return (
    <div className="h-screen w-screen overflow-hidden flex flex-col bg-obsidian-950 text-slate-100 font-sans">
      {/* Active Application Body (Each app renders its own authentic single navbar) */}
      {appView === 'STOCK' ? (
        <div className="h-screen w-screen overflow-y-auto bg-obsidian-950">
          <StockModuleView />
        </div>
      ) : appView === 'FINANCE' ? (
        <div className="h-screen w-screen overflow-y-auto bg-obsidian-950">
          <FinanceModuleView />
        </div>
      ) : appView === 'ADMIN' ? (
        <AdminDashboardView />
      ) : (
        <PosTerminalApp />
      )}

      {/* Global Modals & Overlays Accessible Across Both Views */}
      <CheckoutModal />
      <ShiftModal />
      <CashMovementModal />
      <RefundModal />
      <ReceiptPreviewModal />
      <TransactionDetailModal />
      <PinLockModal />
      <SyncStatusPanel />
      <UserManagementModal />
      <StoreSelectionModal />
      <CurrencyModal />
      <SaveOrderModal />
    </div>
  );
}

export default function App() {
  return (
    <SyncProvider>
      <PosProvider>
        <MainAppRouter />
      </PosProvider>
    </SyncProvider>
  );
}
