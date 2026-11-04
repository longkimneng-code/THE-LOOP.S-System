import React from 'react';
import { 
  LayoutDashboard, 
  CalendarRange, 
  Receipt, 
  Ship, 
  BarChart3, 
  Settings,
  Sparkles,
  PieChart,
  History
} from 'lucide-react';

export default function Navigation({ activeTab, setActiveTab, attentionCount = 0 }) {
  const navItems = [
    { id: 'home', label: 'Home', icon: LayoutDashboard, badge: attentionCount > 0 ? attentionCount : null },
    { id: 'allocation', label: 'Revenue Allocation', icon: PieChart, highlight: true },
    { id: 'period', label: 'Date & Period', icon: CalendarRange },
    { id: 'bills', label: 'Bills & Suppliers', icon: Receipt },
    { id: 'imports', label: 'Landed Cost', icon: Ship },
    { id: 'reports', label: 'Reports', icon: BarChart3 },
    { id: 'accounting', label: 'Accounting & Settings', icon: Settings }
  ];

  return (
    <nav className="sticky top-12 z-20 border-b border-obsidian-800 bg-obsidian-900/95 backdrop-blur-md px-3 sm:px-5 flex items-center overflow-x-auto scrollbar-none select-none h-10">
      <div className="flex items-center gap-1 min-w-max">
        {navItems.map((item) => {
          const Icon = item.icon;
          const isActive = activeTab === item.id;
          return (
            <button
              key={item.id}
              onClick={() => setActiveTab(item.id)}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all relative ${
                isActive
                  ? 'text-white bg-white/[0.08] font-bold border border-white/10 shadow-xs'
                  : 'text-slate-400 hover:text-slate-200 hover:bg-white/[0.04]'
              }`}
            >
              <Icon className={`w-3.5 h-3.5 ${isActive ? 'text-brass-400' : 'text-slate-400'}`} />
              <span className="leading-none whitespace-nowrap">{item.label}</span>
              
              {item.highlight && (
                <span className="w-1.5 h-1.5 rounded-full bg-brass-400 animate-pulse" />
              )}

              {item.badge && (
                <span className="px-1.5 py-0.2 rounded-full text-[9px] font-mono font-bold bg-[#F43F5E] text-white">
                  {item.badge}
                </span>
              )}

              {isActive && (
                <span className="absolute bottom-0 left-2 right-2 h-[2px] bg-brass-400 rounded-full" />
              )}
            </button>
          );
        })}
      </div>
    </nav>
  );
}

