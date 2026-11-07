import React from 'react';
import Icon from './Icon';

const TABS = [
  { id: 'dashboard', label: 'Dashboard', iconName: 'dashboard' },
  { id: 'catalog', label: 'Product Catalog', iconName: 'catalog' },
  { id: 'inventory', label: 'Inventory Management', iconName: 'inventory' },
  { id: 'purchasing', label: 'Purchasing & Suppliers', iconName: 'purchasing' },
  { id: 'customers', label: 'Customers', iconName: 'customers' },
  { id: 'reports', label: 'Reports & Analytics', iconName: 'reports' },
  { id: 'locations', label: 'Stores & Locations', iconName: 'locations' },
  { id: 'settings', label: 'Settings & Attributes', iconName: 'settings' }
];

export default function NavigationTabs({ activeTab, onSelectTab }) {
  return (
    <div className="w-full bg-[#0C0F17]/95 px-4 sm:px-6 overflow-x-auto scrollbar-none select-none py-2 border-t border-obsidian-800/40">
      <nav
        className="flex items-center space-x-2 min-w-max text-xs min-h-[40px]"
        role="tablist"
        aria-label="Retail Platform Modules"
      >
        {TABS.map((tab) => {
          const isActive = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              role="tab"
              aria-selected={isActive}
              onClick={() => onSelectTab(tab.id)}
              className={`px-3.5 py-2 rounded-xl text-xs font-semibold tracking-wide transition-all duration-150 flex items-center space-x-2 select-none relative focus-visible:outline-none ${
                isActive
                  ? 'text-brass-400 bg-brass-500/15 border border-brass-500/35 font-bold shadow-xs'
                  : 'text-slate-400 hover:text-slate-200 hover:bg-white/[0.05] border border-transparent'
              }`}
            >
              <Icon
                name={tab.iconName}
                size={14}
                className={isActive ? 'text-brass-400' : 'text-slate-400 group-hover:text-slate-200'}
              />
              <span className="font-sans leading-tight whitespace-nowrap">{tab.label}</span>
            </button>
          );
        })}
      </nav>
    </div>
  );
}
