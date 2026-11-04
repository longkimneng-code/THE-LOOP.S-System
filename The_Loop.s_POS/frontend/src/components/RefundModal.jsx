import React, { useState } from 'react';
import { usePos } from '../context/PosContext';
import { useSync } from '../context/SyncContext';
import { X, RotateCcw, Search, CheckCircle, AlertCircle, Package } from 'lucide-react';

export default function RefundModal() {
  const {
    isRefundOpen,
    setIsRefundOpen,
    cashierUser,
    playBeep
  } = usePos();

  const { refreshStatus } = useSync();

  const [orderQuery, setOrderQuery] = useState('');
  const [searchedOrder, setSearchedOrder] = useState(null);
  const [selectedLines, setSelectedLines] = useState({});
  const [refundMethod, setRefundMethod] = useState('CASH');
  const [reasonCode, setReasonCode] = useState('WRONG_SIZE');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [successMsg, setSuccessMsg] = useState('');

  if (!isRefundOpen) return null;

  const handleLookup = async (e) => {
    e.preventDefault();
    if (!orderQuery.trim()) return;

    setErrorMsg('');
    setSearchedOrder(null);

    try {
      const res = await fetch(`/api/orders/${encodeURIComponent(orderQuery.trim())}`);
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Receipt not found');
      setSearchedOrder(data);
      // Pre-select first line
      if (data.lines && data.lines.length > 0) {
        setSelectedLines({
          [data.lines[0].variantSku]: {
            selected: true,
            quantity: 1,
            restockDecision: 'RESELLABLE'
          }
        });
      }
    } catch (err) {
      setErrorMsg(err.message);
    }
  };

  const handleToggleLine = (sku) => {
    setSelectedLines(prev => ({
      ...prev,
      [sku]: {
        selected: !prev[sku]?.selected,
        quantity: prev[sku]?.quantity || 1,
        restockDecision: prev[sku]?.restockDecision || 'RESELLABLE'
      }
    }));
  };

  const handleProcessRefund = async () => {
    const itemsToRefund = Object.entries(selectedLines)
      .filter(([_, val]) => val.selected)
      .map(([sku, val]) => ({
        variantSku: sku,
        quantity: val.quantity,
        restockDecision: val.restockDecision
      }));

    if (itemsToRefund.length === 0) {
      setErrorMsg('Please select at least one item to refund');
      return;
    }

    setIsSubmitting(true);
    setErrorMsg('');

    try {
      const res = await fetch('/api/orders/refund', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          originalOrderNumber: searchedOrder.order.orderNumber,
          itemsToRefund,
          refundMethod,
          reasonCode,
          cashierUserId: cashierUser.id
        })
      });

      const data = await res.json();
      if (!res.ok || !data.ok) throw new Error(data.error || 'Refund failed');

      playBeep(980, 'sine', 0.15);
      setSuccessMsg(`Refund #${data.refund.id} processed successfully! ($${data.refund.totalRefund})`);
      refreshStatus();

      setTimeout(() => {
        setIsRefundOpen(false);
      }, 2000);
    } catch (err) {
      setErrorMsg(err.message);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-obsidian-900 border border-obsidian-700 rounded-2xl w-full max-w-lg shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="px-6 py-4 border-b border-obsidian-800 flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <RotateCcw className="w-5 h-5 text-rose-400" />
            <div>
              <div className="text-xs font-mono text-rose-400 uppercase tracking-wider">Customer Care</div>
              <h3 className="text-base font-semibold text-slate-100">Returns & Exchanges</h3>
            </div>
          </div>
          <button
            onClick={() => setIsRefundOpen(false)}
            className="p-1 rounded-lg text-slate-400 hover:text-slate-200 hover:bg-obsidian-800"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Body */}
        <div className="p-6 overflow-y-auto space-y-4">
          {errorMsg && (
            <div className="p-3 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-400 text-xs">
              {errorMsg}
            </div>
          )}

          {successMsg && (
            <div className="p-3 rounded-xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 text-xs flex items-center space-x-2">
              <CheckCircle className="w-4 h-4" />
              <span>{successMsg}</span>
            </div>
          )}

          {/* Order Search Form */}
          <form onSubmit={handleLookup} className="flex items-center space-x-2">
            <input
              type="text"
              value={orderQuery}
              onChange={(e) => setOrderQuery(e.target.value)}
              placeholder="Enter or scan Order # (e.g. REG01-20261101-...)"
              className="flex-1 bg-obsidian-950 border border-obsidian-700 rounded-xl px-3.5 py-2 text-xs font-mono text-slate-100 focus:outline-none focus:border-brass-500"
            />
            <button
              type="submit"
              className="px-4 py-2 rounded-xl bg-obsidian-800 hover:bg-obsidian-750 border border-obsidian-700 text-xs font-medium text-slate-200 flex items-center space-x-1"
            >
              <Search className="w-3.5 h-3.5" />
              <span>Find</span>
            </button>
          </form>

          {/* Found Order Details */}
          {searchedOrder && (
            <div className="space-y-3 pt-2 border-t border-obsidian-800">
              <div className="flex justify-between items-center text-xs">
                <span className="font-mono text-slate-400">Order: {searchedOrder.order.orderNumber}</span>
                <span className="font-mono text-brass-400 font-bold">${Number(searchedOrder.order.totalAmount).toFixed(2)}</span>
              </div>

              {/* Order Lines */}
              <div className="space-y-2">
                <label className="text-xs font-medium text-slate-400 block">Select Items to Return:</label>
                {searchedOrder.lines.map(l => {
                  const isChecked = selectedLines[l.variantSku]?.selected || false;
                  return (
                    <div
                      key={l.id}
                      className={`p-3 rounded-xl border transition-all text-xs flex items-center justify-between ${
                        isChecked
                          ? 'bg-obsidian-800 border-rose-500/50 text-slate-100'
                          : 'bg-obsidian-850 border-obsidian-750 text-slate-400'
                      }`}
                    >
                      <label className="flex items-center space-x-2.5 cursor-pointer flex-1">
                        <input
                          type="checkbox"
                          checked={isChecked}
                          onChange={() => handleToggleLine(l.variantSku)}
                          className="rounded bg-obsidian-900 border-obsidian-700 text-rose-500 focus:ring-0"
                        />
                        <div>
                          <div className="font-medium text-slate-200">{l.itemTitle}</div>
                          <div className="font-mono text-[10px] text-slate-500">
                            ${Number(l.unitPrice).toFixed(2)} × {l.quantity}
                          </div>
                        </div>
                      </label>

                      {isChecked && (
                        <div className="flex items-center space-x-2">
                          <select
                            value={selectedLines[l.variantSku]?.restockDecision || 'RESELLABLE'}
                            onChange={(e) => {
                              setSelectedLines(prev => ({
                                ...prev,
                                [l.variantSku]: {
                                  ...prev[l.variantSku],
                                  restockDecision: e.target.value
                                }
                              }));
                            }}
                            className="bg-obsidian-950 border border-obsidian-700 rounded-lg px-2 py-1 text-[11px] text-slate-300 focus:outline-none"
                          >
                            <option value="RESELLABLE">Resellable (Restock)</option>
                            <option value="DAMAGED">Damaged (Write-off)</option>
                          </select>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>

              {/* Refund Method & Reason */}
              <div className="grid grid-cols-2 gap-3 pt-2">
                <div>
                  <label className="text-xs font-medium text-slate-400 block mb-1">Refund Method</label>
                  <select
                    value={refundMethod}
                    onChange={(e) => setRefundMethod(e.target.value)}
                    className="w-full bg-obsidian-950 border border-obsidian-700 rounded-xl px-3 py-2 text-xs text-slate-200 focus:outline-none"
                  >
                    <option value="CASH">Cash Refund</option>
                    <option value="ORIGINAL_TENDER">Original Tender</option>
                    <option value="STORE_CREDIT">Store Credit</option>
                  </select>
                </div>
                <div>
                  <label className="text-xs font-medium text-slate-400 block mb-1">Reason Code</label>
                  <select
                    value={reasonCode}
                    onChange={(e) => setReasonCode(e.target.value)}
                    className="w-full bg-obsidian-950 border border-obsidian-700 rounded-xl px-3 py-2 text-xs text-slate-200 focus:outline-none"
                  >
                    <option value="WRONG_SIZE">Wrong Size / Fit</option>
                    <option value="DEFECTIVE">Customer Defect Claim</option>
                    <option value="CHANGE_OF_MIND">Change of Mind</option>
                    <option value="INCORRECT_ITEM">Incorrect Item Dispensed</option>
                  </select>
                </div>
              </div>

              <button
                onClick={handleProcessRefund}
                disabled={isSubmitting}
                className="w-full py-3 rounded-xl bg-gradient-to-r from-rose-600 to-rose-500 hover:from-rose-500 text-white font-bold text-xs tracking-wide shadow-md transition-all mt-3"
              >
                {isSubmitting ? 'Processing Refund...' : 'Authorize & Complete Refund'}
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

