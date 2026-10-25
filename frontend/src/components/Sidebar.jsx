import React from 'react';
import { 
  LayoutDashboard, 
  Package, 
  Hourglass, 
  ShoppingCart, 
  PieChart, 
  AlertTriangle,
  Flame,
  Coins
} from 'lucide-react';

export default function Sidebar({ currentTab, setTab, stats }) {
  const navItems = [
    { 
      id: 'dashboard', 
      label: 'Dashboard', 
      icon: LayoutDashboard,
      badge: null
    },
    { 
      id: 'waste-to-wealth', 
      label: 'Waste-to-Wealth', 
      icon: Coins,
      badge: '₹ Engine',
      badgeGold: true
    },
    { 
      id: 'inventory', 
      label: 'Inventory', 
      icon: Package,
      badge: stats?.total_active_items || null
    },
    { 
      id: 'use-first', 
      label: 'Use First', 
      icon: Hourglass,
      badge: stats?.items_needing_review ? `${stats.items_needing_review} review` : null,
      badgeUrgent: true
    },
    { 
      id: 'shopping-list', 
      label: 'Shopping List', 
      icon: ShoppingCart,
      badge: stats?.shopping_list_count || null
    },
    { 
      id: 'outcomes', 
      label: 'Outcomes & Logs', 
      icon: PieChart,
      badge: null
    },
  ];

  return (
    <aside className="w-full md:w-64 border-r border-[#D8B56D]/20 bg-[#171D2B]/70 backdrop-blur-md flex flex-col justify-between shrink-0">
      <div className="p-4 space-y-1.5">
        <div className="px-3 py-2 text-[11px] font-bold uppercase tracking-wider text-[#D8B56D]/70 font-enchanted">
          Enchanted Pantry
        </div>

        <nav className="space-y-1">
          {navItems.map((item) => {
            const Icon = item.icon;
            const isActive = currentTab === item.id;
            return (
              <button
                key={item.id}
                onClick={() => setTab(item.id)}
                className={`w-full flex items-center justify-between px-3.5 py-2.5 rounded-lg text-sm font-medium transition-all cursor-pointer ${
                  isActive
                    ? 'bg-gradient-to-r from-[#D8B56D]/20 to-[#17251F] text-[#F3E8D0] border-l-3 border-[#D8B56D] shadow-md shadow-black/20'
                    : 'text-[#A8B9A5] hover:text-[#F3E8D0] hover:bg-[#17251F]/50'
                }`}
              >
                <div className="flex items-center gap-3">
                  <Icon className={`w-4 h-4 ${isActive ? 'text-[#D8B56D]' : 'text-[#A8B9A5]'}`} />
                  <span>{item.label}</span>
                </div>

                {item.badge && (
                  <span
                    className={`text-[10px] px-2 py-0.5 rounded-full font-semibold ${
                      item.badgeGold
                        ? 'bg-[#D8B56D]/20 text-[#D8B56D] border border-[#D8B56D]/50 shadow-sm shadow-[#D8B56D]/20'
                        : item.badgeUrgent && stats?.items_needing_review > 0
                        ? 'bg-[#5B1F32] text-[#F3E8D0] border border-[#D8B56D]/40 animate-pulse'
                        : 'bg-[#121720] text-[#D8B56D] border border-[#D8B56D]/20'
                    }`}
                  >
                    {item.badge}
                  </span>
                )}
              </button>
            );
          })}
        </nav>
      </div>

      {/* Magical Pantry Quote / Status footer */}
      <div className="p-4 m-3 rounded-lg bg-[#121720]/80 border border-[#D8B56D]/20 text-xs text-[#A8B9A5] hidden md:block">
        <div className="flex items-center gap-1.5 text-[#D8B56D] font-medium mb-1">
          <Flame className="w-3.5 h-3.5 text-[#D8B56D]" />
          <span className="font-enchanted text-[11px]">System Status</span>
        </div>
        <p className="text-[11px] leading-relaxed text-[#F3E8D0]/80">
          Transparent rules active. No synthetic dates inferred.
        </p>
      </div>
    </aside>
  );
}
