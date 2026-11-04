import React from 'react';
import Icon from './Icon';

export default function Toast({ toasts }) {
  if (!toasts || toasts.length === 0) return null;

  return (
    <div className="fixed bottom-5 right-5 z-50 space-y-2 pointer-events-none" role="region" aria-live="polite">
      {toasts.map((toast) => {
        let borderCol = 'border-gold-500/40 text-gold-400 bg-gold-500/10';
        let iconName = 'info';
        if (toast.type === 'emerald') {
          borderCol = 'border-emerald-500/40 text-emerald-400 bg-emerald-500/10';
          iconName = 'checkCircle';
        }
        if (toast.type === 'crimson') {
          borderCol = 'border-crimson-500/40 text-crimson-400 bg-crimson-500/10';
          iconName = 'alertTriangle';
        }

        return (
          <div
            key={toast.id}
            className={`glass-panel-elevated px-4 py-3 rounded-xl border ${borderCol} text-xs font-mono shadow-2xl flex items-center space-x-2.5 animate-in slide-in-from-bottom duration-200 pointer-events-auto`}
          >
            <Icon name={iconName} size={15} />
            <span className="text-white font-medium">{toast.message}</span>
          </div>
        );
      })}
    </div>
  );
}

