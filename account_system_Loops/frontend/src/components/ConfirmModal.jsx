import React from 'react';
import { AlertTriangle, Trash2, CheckCircle2, ShieldAlert, ArrowRight, Loader2 } from 'lucide-react';

export default function ConfirmModal({
  isOpen,
  title = 'Please Confirm',
  subtitle = 'Are you sure you want to proceed with this action?',
  details = [],
  confirmText = 'Confirm',
  cancelText = 'Cancel',
  variant = 'primary', // 'primary' | 'danger' | 'warning' | 'success'
  icon: CustomIcon = null,
  onConfirm,
  onCancel,
  isLoading = false
}) {
  if (!isOpen) return null;

  const getVariantStyles = () => {
    switch (variant) {
      case 'danger':
        return {
          iconBg: 'bg-rose-500/15 border-rose-500/30 text-rose-400',
          btnBg: 'bg-rose-500 hover:bg-rose-600 text-white',
          DefaultIcon: Trash2
        };
      case 'warning':
        return {
          iconBg: 'bg-amber-500/15 border-amber-500/30 text-amber-400',
          btnBg: 'bg-amber-500 hover:bg-amber-600 text-obsidian-950 font-bold',
          DefaultIcon: AlertTriangle
        };
      case 'success':
        return {
          iconBg: 'bg-emerald-500/15 border-emerald-500/30 text-emerald-400',
          btnBg: 'bg-emerald-500 hover:bg-emerald-600 text-obsidian-950 font-bold',
          DefaultIcon: CheckCircle2
        };
      case 'primary':
      default:
        return {
          iconBg: 'bg-[#E5A93C]/15 border-[#E5A93C]/30 text-[#E5A93C]',
          btnBg: 'bg-[#E5A93C] hover:bg-[#F3C368] text-black font-bold',
          DefaultIcon: ShieldAlert
        };
    }
  };

  const { iconBg, btnBg, DefaultIcon } = getVariantStyles();
  const IconComponent = CustomIcon || DefaultIcon;

  return (
    <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in">
      <div 
        className="w-full max-w-md bg-[#161A26] border border-white/15 rounded-2xl shadow-2xl p-6 text-slate-100 font-sans space-y-4"
        role="dialog"
        aria-modal="true"
      >
        {/* Header with Icon */}
        <div className="flex items-start space-x-3.5">
          <div className={`w-11 h-11 rounded-xl flex items-center justify-center border flex-shrink-0 ${iconBg}`}>
            <IconComponent className="w-5 h-5" />
          </div>
          <div className="flex-1 min-w-0">
            <h3 className="text-base font-bold text-white font-display leading-tight">{title}</h3>
            {subtitle && (
              <p className="text-xs text-slate-400 mt-1 leading-relaxed">{subtitle}</p>
            )}
          </div>
        </div>

        {/* Details Card (if provided) */}
        {details && details.length > 0 && (
          <div className="bg-[#111520] border border-white/10 rounded-xl p-3.5 space-y-2 text-xs">
            {details.map((item, idx) => (
              <div key={idx} className="flex justify-between items-center py-0.5 border-b border-white/5 last:border-0">
                <span className="text-slate-400 font-medium">{item.label}</span>
                <span className={`font-mono text-right ${item.highlight ? 'text-[#E5A93C] font-bold text-sm' : 'text-slate-100 font-semibold'}`}>
                  {item.value}
                </span>
              </div>
            ))}
          </div>
        )}

        {/* Action Buttons */}
        <div className="flex items-center justify-end space-x-3 pt-2 border-t border-white/10">
          <button
            type="button"
            onClick={onCancel}
            disabled={isLoading}
            className="px-4 py-2 rounded-xl bg-white/5 hover:bg-white/10 text-slate-300 text-xs font-semibold transition disabled:opacity-50"
          >
            {cancelText}
          </button>
          <button
            type="button"
            onClick={onConfirm}
            disabled={isLoading}
            className={`px-4 py-2 rounded-xl text-xs flex items-center space-x-1.5 transition shadow-lg disabled:opacity-50 ${btnBg}`}
          >
            {isLoading ? (
              <>
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
                <span>Processing...</span>
              </>
            ) : (
              <>
                <span>{confirmText}</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}

