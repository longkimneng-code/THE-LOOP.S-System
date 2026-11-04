import React, { useState } from 'react';
import { usePos } from '../context/PosContext';
import { 
  Trash2, 
  Plus, 
  Minus, 
  PauseCircle, 
  PlayCircle, 
  Percent, 
  ShoppingBag, 
  CreditCard,
  User,
  ArrowRight,
  Bookmark
} from 'lucide-react';

export default function ActiveCart() {
  const {
    cartItems,
    updateQuantity,
    removeFromCart,
    clearCart,
    subtotal,
    totalDiscount,
    taxTotal,
    grandTotal,
    orderDiscountPct,
    setOrderDiscountPct,
    parkedCarts,
    parkCurrentCart,
    recallParkedCart,
    setIsCheckoutOpen,
    customer,
    setCustomer,
    setIsSaveOrderModalOpen,
    activeSavedOrderId
  } = usePos();

  const [showDiscountPresets, setShowDiscountPresets] = useState(false);
  const [showParkedList, setShowParkedList] = useState(false);

  const khrTotal = Math.round(grandTotal * 4100).toLocaleString();

  return (
    <div className="w-96 lg:w-[420px] h-full bg-obsidian-900 border-l border-obsidian-800 flex flex-col justify-between select-none">
      {/* 1. Cart Header */}
      <div className="p-3.5 border-b border-obsidian-800 flex items-center justify-between">
        <div className="flex items-center space-x-2">
          <div className="p-1.5 rounded-lg bg-brass-500/10 text-brass-400">
            <ShoppingBag className="w-4 h-4" />
          </div>
          <span className="font-semibold text-slate-100 text-sm">Active Order</span>
          <span className="text-xs bg-obsidian-800 text-slate-400 px-2 py-0.5 rounded-full font-mono">
            {cartItems.reduce((acc, i) => acc + i.quantity, 0)}
          </span>
        </div>

        <div className="flex items-center space-x-1">
          {/* Park Order Button */}
          <button
            onClick={() => parkCurrentCart()}
            disabled={cartItems.length === 0}
            className="p-1.5 rounded-lg hover:bg-obsidian-800 text-slate-400 hover:text-amber-400 disabled:opacity-30 transition-colors"
            title="Hold / Park Cart"
          >
            <PauseCircle className="w-4 h-4" />
          </button>

          {/* Recall Parked Orders */}
          <div className="relative">
            <button
              onClick={() => setShowParkedList(!showParkedList)}
              disabled={parkedCarts.length === 0}
              className="p-1.5 rounded-lg hover:bg-obsidian-800 text-slate-400 hover:text-emerald-400 disabled:opacity-30 transition-colors relative"
              title="Recall Parked Orders"
            >
              <PlayCircle className="w-4 h-4" />
              {parkedCarts.length > 0 && (
                <span className="absolute -top-1 -right-1 w-3.5 h-3.5 rounded-full bg-emerald-500 text-obsidian-950 text-[9px] font-bold flex items-center justify-center">
                  {parkedCarts.length}
                </span>
              )}
            </button>

            {/* Parked Carts Dropdown */}
            {showParkedList && (
              <div className="absolute right-0 top-9 w-64 bg-obsidian-850 border border-obsidian-700 rounded-xl shadow-2xl p-2 z-30">
                <div className="text-xs font-semibold text-slate-300 px-2 py-1 border-b border-obsidian-750 mb-1">
                  Held Orders ({parkedCarts.length})
                </div>
                {parkedCarts.map(p => (
                  <button
                    key={p.id}
                    onClick={() => {
                      recallParkedCart(p.id);
                      setShowParkedList(false);
                    }}
                    className="w-full text-left p-2 rounded-lg hover:bg-obsidian-800 text-xs flex justify-between items-center transition-colors"
                  >
                    <div>
                      <div className="font-medium text-slate-200">{p.customerName || 'Walk-in'}</div>
                      <div className="text-[10px] text-slate-400">{p.itemCount} items • {new Date(p.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</div>
                    </div>
                    <span className="text-[10px] bg-brass-500/20 text-brass-400 px-1.5 py-0.5 rounded">
                      Resume
                    </span>
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Clear Cart Button */}
          <button
            onClick={clearCart}
            disabled={cartItems.length === 0}
            className="p-1.5 rounded-lg hover:bg-obsidian-800 text-slate-400 hover:text-rose-400 disabled:opacity-30 transition-colors"
            title="Clear Cart"
          >
            <Trash2 className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* 2. Scrollable Cart Items */}
      <div className="flex-1 overflow-y-auto p-3 space-y-2">
        {cartItems.length === 0 ? (
          <div className="h-full flex flex-col items-center justify-center text-slate-500 space-y-2">
            <ShoppingBag className="w-10 h-10 text-slate-700 stroke-[1.5]" />
            <p className="text-xs">Cart is empty</p>
            <span className="text-[11px] text-slate-600">Scan barcode or tap items to ring up</span>
          </div>
        ) : (
          cartItems.map(item => (
            <div
              key={item.variantSku}
              className="p-2.5 rounded-xl bg-obsidian-850/80 border border-obsidian-800 flex items-center justify-between space-x-2 group hover:border-obsidian-700 transition-all"
            >
              {/* Item Info */}
              <div className="flex-1 min-w-0">
                <div className="text-xs font-medium text-slate-200 truncate">
                  {item.itemTitle}
                </div>
                <div className="flex items-center space-x-2 mt-0.5 text-[11px] font-mono text-slate-400">
                  <span>${Number(item.unitPrice).toFixed(2)}</span>
                  <span>×</span>
                  <span className="text-slate-300 font-semibold">{item.quantity}</span>
                  {item.lineDiscount > 0 && (
                    <span className="text-rose-400 text-[10px]">
                      (-${Number(item.lineDiscount).toFixed(2)})
                    </span>
                  )}
                </div>
              </div>

              {/* Quantity Controls */}
              <div className="flex items-center space-x-1 bg-obsidian-900 border border-obsidian-750 rounded-lg p-0.5">
                <button
                  onClick={() => updateQuantity(item.variantSku, -1)}
                  className="w-6 h-6 flex items-center justify-center rounded text-slate-400 hover:text-slate-100 hover:bg-obsidian-800 transition-colors"
                >
                  <Minus className="w-3 h-3" />
                </button>
                <span className="w-6 text-center text-xs font-mono font-semibold text-slate-100">
                  {item.quantity}
                </span>
                <button
                  onClick={() => updateQuantity(item.variantSku, 1)}
                  className="w-6 h-6 flex items-center justify-center rounded text-slate-400 hover:text-slate-100 hover:bg-obsidian-800 transition-colors"
                >
                  <Plus className="w-3 h-3" />
                </button>
              </div>

              {/* Line Total */}
              <div className="text-right pl-1">
                <div className="text-xs font-semibold font-mono text-slate-100">
                  ${(item.unitPrice * item.quantity - (item.lineDiscount || 0)).toFixed(2)}
                </div>
                <button
                  onClick={() => removeFromCart(item.variantSku)}
                  className="text-slate-600 hover:text-rose-400 transition-colors mt-0.5 opacity-0 group-hover:opacity-100"
                >
                  <Trash2 className="w-3 h-3" />
                </button>
              </div>
            </div>
          ))
        )}
      </div>

      {/* 3. Financial Summary & Checkout Tray */}
      <div className="p-4 bg-obsidian-950 border-t border-obsidian-800 space-y-3">
        {/* Discount Preset Row */}
        <div className="flex items-center justify-between text-xs">
          <span className="text-slate-400 flex items-center space-x-1">
            <Percent className="w-3.5 h-3.5 text-slate-500" />
            <span>Order Discount</span>
          </span>
          <div className="flex items-center space-x-1">
            {[0, 5, 10, 15].map(pct => (
              <button
                key={pct}
                onClick={() => setOrderDiscountPct(pct)}
                className={`px-2 py-0.5 rounded text-[11px] font-mono transition-colors ${
                  orderDiscountPct === pct
                    ? 'bg-brass-500 text-obsidian-950 font-bold'
                    : 'bg-obsidian-850 text-slate-400 hover:text-slate-200 border border-obsidian-800'
                }`}
              >
                {pct}%
              </button>
            ))}
          </div>
        </div>

        {/* Breakdown Table */}
        <div className="space-y-1.5 text-xs border-t border-obsidian-850 pt-2 font-mono">
          <div className="flex justify-between text-slate-400">
            <span>Subtotal</span>
            <span>${subtotal.toFixed(2)}</span>
          </div>
          {totalDiscount > 0 && (
            <div className="flex justify-between text-rose-400">
              <span>Discounts</span>
              <span>-${totalDiscount.toFixed(2)}</span>
            </div>
          )}
          <div className="flex justify-between text-slate-400">
            <span>VAT (10%)</span>
            <span>${taxTotal.toFixed(2)}</span>
          </div>
          <div className="flex justify-between text-base font-bold text-slate-100 pt-1 border-t border-obsidian-800">
            <span className="font-sans">Grand Total</span>
            <span className="text-brass-400 font-mono">${grandTotal.toFixed(2)}</span>
          </div>
          <div className="flex items-center justify-between text-[11px] text-slate-500">
            {activeSavedOrderId ? (
              <span className="text-amber-400 font-mono flex items-center space-x-1">
                <Bookmark className="w-3 h-3" />
                <span>Held Order #{activeSavedOrderId.slice(-6)}</span>
              </span>
            ) : <span />}
            <span>≈ {khrTotal} KHR</span>
          </div>
        </div>

        {/* Dual Actions: Save/Hold Order & Checkout Button */}
        <div className="grid grid-cols-4 gap-2">
          <button
            onClick={() => setIsSaveOrderModalOpen(true)}
            disabled={cartItems.length === 0}
            className="col-span-1 h-12 rounded-xl bg-obsidian-850 hover:bg-obsidian-800 border border-obsidian-750 hover:border-amber-500/40 text-slate-300 hover:text-white font-medium text-xs flex flex-col items-center justify-center space-y-0.5 transition-all disabled:opacity-30 disabled:pointer-events-none active:scale-95 shadow-sm"
            title="Save Unpaid Order on Hold"
          >
            <Bookmark className="w-4 h-4 text-amber-400" />
            <span className="text-[10px] uppercase font-mono tracking-wider font-semibold text-amber-400">Hold</span>
          </button>

          <button
            onClick={() => setIsCheckoutOpen(true)}
            disabled={cartItems.length === 0}
            className="col-span-3 h-12 rounded-xl bg-gradient-to-r from-brass-500 via-brass-400 to-brass-500 hover:from-brass-400 hover:to-brass-300 text-obsidian-950 font-bold text-xs tracking-wide shadow-lg shadow-brass-500/20 disabled:opacity-30 disabled:pointer-events-none transition-all flex items-center justify-between px-4 active:scale-[0.99]"
          >
            <div className="flex items-center space-x-2">
              <CreditCard className="w-4 h-4 text-obsidian-950" />
              <span>PAY / CHECKOUT</span>
            </div>
            <div className="flex items-center space-x-1 font-mono text-sm">
              <span>${grandTotal.toFixed(2)}</span>
              <ArrowRight className="w-3.5 h-3.5 text-obsidian-950" />
            </div>
          </button>
        </div>
      </div>
    </div>
  );
}

