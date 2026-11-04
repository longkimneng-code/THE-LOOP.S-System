import React, { useEffect, useRef, useState } from 'react';
import { usePos } from '../context/PosContext';
import { Scan, CheckCircle, AlertCircle } from 'lucide-react';

export default function BarcodeListener() {
  const { products, addToCart, playBeep } = usePos();
  const [scanNotification, setScanNotification] = useState(null);

  const bufferRef = useRef('');
  const lastKeyTimeRef = useRef(0);

  useEffect(() => {
    const handleKeyDown = (e) => {
      // Ignore if user is typing in a modal text field or textarea
      const target = e.target;
      const isInput = target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable;

      const currentTime = Date.now();
      const timeDiff = currentTime - lastKeyTimeRef.current;
      lastKeyTimeRef.current = currentTime;

      // Hardware barcode scanners send keystrokes with < 50ms intervals
      if (e.key === 'Enter') {
        const barcode = bufferRef.current.trim();
        bufferRef.current = '';

        if (barcode.length >= 3) {
          e.preventDefault();
          lookupAndAdd(barcode);
        }
        return;
      }

      // Ignore single modifier keys
      if (e.key.length > 1) return;

      // If time between keystrokes is too long and user was in an input, reset buffer
      if (timeDiff > 120 && isInput) {
        bufferRef.current = e.key;
        return;
      }

      bufferRef.current += e.key;

      // Safety timeout: clear buffer if idle for > 400ms
      setTimeout(() => {
        if (Date.now() - lastKeyTimeRef.current > 350) {
          bufferRef.current = '';
        }
      }, 400);
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [products]);

  const lookupAndAdd = (barcode) => {
    let matchedProduct = null;
    let matchedVariant = null;

    for (const prod of products) {
      if (prod.barcode === barcode || prod.code === barcode) {
        matchedProduct = prod;
        matchedVariant = prod.variants?.[0] || null;
        break;
      }
      for (const variant of prod.variants || []) {
        if (variant.barcode === barcode || variant.sku === barcode) {
          matchedProduct = prod;
          matchedVariant = variant;
          break;
        }
      }
      if (matchedProduct) break;
    }

    if (matchedProduct) {
      addToCart(matchedProduct, matchedVariant);
      setScanNotification({
        type: 'success',
        title: 'Barcode Scanned',
        detail: matchedVariant ? `${matchedProduct.name} (${matchedVariant.title})` : matchedProduct.name
      });
    } else {
      playBeep(300, 'sawtooth', 0.15);
      setScanNotification({
        type: 'error',
        title: 'Unknown Barcode',
        detail: `SKU/Barcode "${barcode}" not in catalog`
      });
    }

    setTimeout(() => {
      setScanNotification(null);
    }, 2500);
  };

  if (!scanNotification) return null;

  return (
    <div className="fixed top-20 right-6 z-50 flex items-center space-x-3 bg-obsidian-900 border border-obsidian-700 shadow-2xl px-4 py-3 rounded-xl animate-bounce-short">
      <div className={`p-2 rounded-lg ${scanNotification.type === 'success' ? 'bg-emerald-500/20 text-emerald-400' : 'bg-rose-500/20 text-rose-400'}`}>
        {scanNotification.type === 'success' ? <CheckCircle className="w-5 h-5" /> : <AlertCircle className="w-5 h-5" />}
      </div>
      <div>
        <div className="text-xs font-semibold text-slate-100">{scanNotification.title}</div>
        <div className="text-xs text-slate-400 font-mono">{scanNotification.detail}</div>
      </div>
    </div>
  );
}

