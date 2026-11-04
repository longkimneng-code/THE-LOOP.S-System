import React, { useEffect } from 'react';
import { CheckCircle2, AlertTriangle, X } from 'lucide-react';

export default function Toast({ toast, onClose }) {
  useEffect(() => {
    if (!toast) return;
    const timer = setTimeout(() => {
      onClose();
    }, 4500);
    return () => clearTimeout(timer);
  }, [toast, onClose]);

  if (!toast) return null;

  return (
    <div className="fixed bottom-6 right-6 z-50 flex items-center gap-3 px-4 py-3 rounded-2xl bg-[#111520] border border-white/20 shadow-2xl backdrop-blur-lg animate-in slide-in-from-bottom-5">
      {toast.type === 'success' ? (
        <CheckCircle2 className="w-5 h-5 text-[#10B981] shrink-0" />
      ) : (
        <AlertTriangle className="w-5 h-5 text-[#F43F5E] shrink-0" />
      )}
      
      <div className="text-xs text-white font-medium pr-2 max-w-sm leading-snug">
        {toast.message}
      </div>

      <button
        onClick={onClose}
        className="p-1 rounded-lg text-slate-400 hover:text-white transition"
      >
        <X className="w-4 h-4" />
      </button>
    </div>
  );
}

