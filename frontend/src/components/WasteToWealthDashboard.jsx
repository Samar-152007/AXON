import React, { useState, useEffect } from 'react';
import { 
  Flame, 
  TrendingDown, 
  Sparkles, 
  Coins, 
  Wallet, 
  ArrowRight, 
  CheckCircle2, 
  RefreshCw, 
  AlertTriangle, 
  Coffee,
  ShieldCheck,
  Zap,
  Tag
} from 'lucide-react';
import { api } from '../api';

export default function WasteToWealthDashboard({ setTab, onDataRefresh, showToast }) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const fetchAnalytics = async () => {
    try {
      setLoading(true);
      const res = await api.getWasteToWealthSummary();
      setData(res);
      setError('');
    } catch (err) {
      console.error('Failed to load Waste-to-Wealth data:', err);
      setError(err.message || 'Failed to fetch financial analytics');
      if (showToast) showToast('Failed to load financial engine data', 'error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAnalytics();
  }, [onDataRefresh]);

  if (loading && !data) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[380px] text-[#A8B9A5]">
        <RefreshCw className="w-8 h-8 text-[#D8B56D] animate-spin mb-3" />
        <p className="font-enchanted text-sm text-[#F3E8D0]">Auditing Household Financial Ledger...</p>
      </div>
    );
  }

  if (error && !data) {
    return (
      <div className="p-6 rounded-2xl bg-[#5B1F32]/50 border border-red-500/40 text-red-200 text-center space-y-3">
        <AlertTriangle className="w-8 h-8 text-red-400 mx-auto" />
        <h3 className="font-bold text-base">Unable to Load Financial Summary</h3>
        <p className="text-xs max-w-md mx-auto text-red-300">{error}</p>
        <button
          onClick={fetchAnalytics}
          className="px-4 py-2 bg-red-700 hover:bg-red-600 rounded-lg text-xs font-semibold text-white transition-all cursor-pointer"
        >
          Retry Audit
        </button>
      </div>
    );
  }

  const {
    total_waste_value = 0.0,
    household_burn_rate = 0.0,
    gamified_message = "Track your food outcomes to unlock financial savings.",
    currency_symbol = "₹",
    total_consumed_value = 0.0,
    total_donated_value = 0.0,
    total_tracked_value = 0.0,
    waste_avoidance_rate = 100.0,
    burn_rate_status = "PRUDENT",
    month_name = "Current Month",
    item_breakdown = [],
    savings_opportunities = []
  } = data || {};

  // Financial proportions for visual comparison chart
  const combinedTotal = (total_consumed_value + total_waste_value + total_donated_value) || 1;
  const consumedPct = Math.round((total_consumed_value / combinedTotal) * 100);
  const wastedPct = Math.round((total_waste_value / combinedTotal) * 100);
  const donatedPct = Math.round((total_donated_value / combinedTotal) * 100);

  return (
    <div className="space-y-6 animate-fadeIn">
      {/* Top Banner / Concept Pitch */}
      <div className="relative overflow-hidden rounded-2xl p-6 sm:p-7 bg-gradient-to-r from-[#17251F] via-[#171D2B] to-[#10141E] border border-[#D8B56D]/30 shadow-2xl">
        <div className="absolute -right-6 -bottom-6 opacity-10 pointer-events-none">
          <Coins className="w-48 h-48 text-[#D8B56D]" />
        </div>

        <div className="relative z-10 max-w-2xl">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-[#D8B56D]/15 border border-[#D8B56D]/40 text-[#D8B56D] text-xs font-bold uppercase tracking-wider mb-2">
            <Coins className="w-3.5 h-3.5" />
            <span>Waste-to-Wealth Financial Engine</span>
          </div>

          <h1 className="font-enchanted text-2xl sm:text-3xl font-bold text-[#F3E8D0] tracking-wide">
            Turn Expired Groceries into Wealth
          </h1>

          <p className="text-xs sm:text-sm text-[#A8B9A5] leading-relaxed mt-1.5">
            Food waste isn't an abstract environmental concept—it's hard cash leaking from your wallet.
            Track your exact monetary loss, monitor your household burn rate, and reclaim your budget.
          </p>
        </div>
      </div>

      {/* 3 Dark Sleek Metric Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {/* Card 1: Total Wealth Wasted (Striking Red) */}
        <div className="relative overflow-hidden p-6 rounded-2xl bg-gradient-to-br from-[#1E1118] via-[#17141E] to-[#10141E] border border-red-500/40 shadow-xl shadow-red-950/20 group hover:border-red-400 transition-all">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-bold uppercase tracking-wider text-rose-300 font-enchanted">
              Total Wealth Wasted
            </span>
            <div className="p-2 rounded-lg bg-red-950/80 border border-red-500/40 text-red-400 shadow-md">
              <Flame className="w-5 h-5 text-red-500 animate-pulse" />
            </div>
          </div>

          <div className="flex items-baseline gap-1 my-1">
            <span className="font-enchanted text-3xl sm:text-4xl font-extrabold text-[#EF4444] tracking-tight drop-shadow-[0_0_12px_rgba(239,68,68,0.35)]">
              {currency_symbol}{total_waste_value.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </span>
          </div>

          <p className="text-[11px] text-[#A8B9A5] mt-2 flex items-center gap-1.5">
            <span>Direct financial loss for {month_name}</span>
          </p>
        </div>

        {/* Card 2: Household Burn Rate (Weekly Financial Trend) */}
        <div className="relative overflow-hidden p-6 rounded-2xl bg-gradient-to-br from-[#1B1917] via-[#171D2B] to-[#10141E] border border-amber-500/35 shadow-xl shadow-amber-950/15 group hover:border-amber-400/60 transition-all">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-bold uppercase tracking-wider text-amber-300 font-enchanted">
              Household Burn Rate
            </span>
            <div className="p-2 rounded-lg bg-amber-950/60 border border-amber-500/40 text-amber-300 shadow-md">
              <TrendingDown className="w-5 h-5 text-amber-400" />
            </div>
          </div>

          <div className="flex items-baseline gap-1.5 my-1">
            <span className="font-enchanted text-3xl sm:text-4xl font-bold text-[#F3E8D0] tracking-tight">
              {currency_symbol}{household_burn_rate.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </span>
            <span className="text-xs font-semibold text-[#A8B9A5]">/ week</span>
          </div>

          <div className="flex items-center gap-2 mt-2">
            <span className={`text-[10px] uppercase font-extrabold px-2 py-0.5 rounded ${
              burn_rate_status === 'CRITICAL' 
                ? 'bg-red-950 text-red-300 border border-red-500/40' 
                : burn_rate_status === 'ALERT'
                ? 'bg-amber-950 text-amber-300 border border-amber-500/40'
                : 'bg-emerald-950 text-emerald-300 border border-emerald-500/40'
            }`}>
              {burn_rate_status} EVAPORATION
            </span>
            <span className="text-[11px] text-[#A8B9A5]">Weekly loss velocity</span>
          </div>
        </div>

        {/* Card 3: Potential Savings (Gamified Real-World Value) */}
        <div className="relative overflow-hidden p-6 rounded-2xl bg-gradient-to-br from-[#121B19] via-[#17251F] to-[#10141E] border border-[#D8B56D]/45 shadow-xl shadow-[#D8B56D]/10 group hover:border-[#D8B56D] transition-all">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-bold uppercase tracking-wider text-[#D8B56D] font-enchanted">
              Potential Savings
            </span>
            <div className="p-2 rounded-lg bg-[#D8B56D]/20 border border-[#D8B56D]/40 text-[#D8B56D] shadow-md">
              <Sparkles className="w-5 h-5 text-[#D8B56D]" />
            </div>
          </div>

          <div className="my-1.5">
            <p className="text-xs sm:text-sm font-semibold text-[#F3E8D0] leading-snug">
              "{gamified_message}"
            </p>
          </div>

          <p className="text-[11px] text-[#A8B9A5] mt-2 flex items-center gap-1">
            <Coffee className="w-3.5 h-3.5 text-[#D8B56D]" />
            <span>Money reclaimable with 100% pantry discipline</span>
          </p>
        </div>
      </div>

      {/* Visual Chart: Consumed Value vs Discarded Value */}
      <div className="parchment-card p-6 rounded-2xl space-y-5">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <h2 className="font-enchanted text-lg font-bold text-[#F3E8D0] flex items-center gap-2">
              <Wallet className="w-5 h-5 text-[#D8B56D]" />
              <span>Capital Flow: Consumed Value vs. Discarded Value</span>
            </h2>
            <p className="text-xs text-[#A8B9A5]">
              Visual breakdown of grocery money well spent vs burned away.
            </p>
          </div>

          <div className="flex items-center gap-2">
            <span className="text-xs font-bold text-[#D8B56D] px-2.5 py-1 rounded bg-[#111620] border border-[#D8B56D]/30">
              {waste_avoidance_rate}% Budget Protected
            </span>
          </div>
        </div>

        {/* Visual Dual/Triple Comparison Bar */}
        <div className="space-y-2">
          <div className="w-full h-8 rounded-xl overflow-hidden flex bg-[#111620] p-1 border border-[#D8B56D]/30 shadow-inner">
            {consumedPct > 0 && (
              <div
                style={{ width: `${consumedPct}%` }}
                className="bg-gradient-to-r from-emerald-600 to-emerald-400 h-full rounded-l-lg transition-all duration-700 flex items-center justify-center text-[10px] font-extrabold text-black tracking-wider uppercase"
                title={`Consumed: ₹${total_consumed_value} (${consumedPct}%)`}
              >
                {consumedPct >= 15 ? `${consumedPct}% Spent Well` : ''}
              </div>
            )}
            {donatedPct > 0 && (
              <div
                style={{ width: `${donatedPct}%` }}
                className="bg-gradient-to-r from-[#D8B56D] to-[#ECC880] h-full transition-all duration-700 flex items-center justify-center text-[10px] font-extrabold text-black tracking-wider uppercase"
                title={`Donated: ₹${total_donated_value} (${donatedPct}%)`}
              >
                {donatedPct >= 10 ? `${donatedPct}% Donated` : ''}
              </div>
            )}
            {wastedPct > 0 && (
              <div
                style={{ width: `${wastedPct}%` }}
                className="bg-gradient-to-r from-red-600 to-rose-500 h-full rounded-r-lg transition-all duration-700 flex items-center justify-center text-[10px] font-extrabold text-white tracking-wider uppercase shadow-md shadow-red-900/50"
                title={`Discarded: ₹${total_waste_value} (${wastedPct}%)`}
              >
                {wastedPct >= 15 ? `${wastedPct}% Burned` : ''}
              </div>
            )}
          </div>

          {/* Metric Legend & Financial Totals */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-2">
            {/* Consumed Metric */}
            <div className="p-3.5 rounded-xl bg-[#111620]/80 border border-emerald-500/30 flex items-center justify-between">
              <div>
                <span className="text-[11px] font-semibold text-emerald-400 uppercase tracking-wider block">
                  Money Well Spent
                </span>
                <span className="font-enchanted text-lg font-bold text-[#F3E8D0]">
                  {currency_symbol}{total_consumed_value.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                </span>
              </div>
              <span className="text-xs font-bold text-emerald-400 px-2 py-0.5 rounded bg-emerald-950/70 border border-emerald-500/30">
                {consumedPct}%
              </span>
            </div>

            {/* Donated Metric */}
            <div className="p-3.5 rounded-xl bg-[#111620]/80 border border-[#D8B56D]/30 flex items-center justify-between">
              <div>
                <span className="text-[11px] font-semibold text-[#D8B56D] uppercase tracking-wider block">
                  Gifted / Donated
                </span>
                <span className="font-enchanted text-lg font-bold text-[#F3E8D0]">
                  {currency_symbol}{total_donated_value.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                </span>
              </div>
              <span className="text-xs font-bold text-[#D8B56D] px-2 py-0.5 rounded bg-[#D8B56D]/15 border border-[#D8B56D]/30">
                {donatedPct}%
              </span>
            </div>

            {/* Discarded Metric */}
            <div className="p-3.5 rounded-xl bg-[#111620]/80 border border-red-500/30 flex items-center justify-between">
              <div>
                <span className="text-[11px] font-semibold text-red-400 uppercase tracking-wider block">
                  Money Burned Away
                </span>
                <span className="font-enchanted text-lg font-bold text-[#EF4444]">
                  {currency_symbol}{total_waste_value.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                </span>
              </div>
              <span className="text-xs font-bold text-red-400 px-2 py-0.5 rounded bg-red-950/70 border border-red-500/30">
                {wastedPct}%
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Grid: Itemized Loss Breakdown + Actionable Wealth Reclaim Playbook */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Left: Top Financial Drain Items */}
        <div className="parchment-card p-6 rounded-2xl space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="font-enchanted text-base font-bold text-[#F3E8D0] flex items-center gap-2">
              <Tag className="w-4 h-4 text-[#D8B56D]" />
              <span>Top Financial Waste Culprits</span>
            </h3>
            <span className="text-[11px] text-[#A8B9A5]">Ranked by ₹ Loss</span>
          </div>

          {item_breakdown.length === 0 ? (
            <div className="p-6 text-center text-xs text-[#A8B9A5] italic">
              No discarded items recorded this period. Your pantry is financially optimized!
            </div>
          ) : (
            <div className="space-y-2.5">
              {item_breakdown.map((item, idx) => (
                <div
                  key={idx}
                  className="p-3 rounded-xl bg-[#111620] border border-[#D8B56D]/15 flex items-center justify-between hover:border-[#D8B56D]/40 transition-colors"
                >
                  <div className="space-y-0.5">
                    <span className="font-bold text-sm text-[#F3E8D0]">{item.item_name}</span>
                    <div className="flex items-center gap-2 text-[10px] text-[#A8B9A5]">
                      <span>{item.quantity} {item.unit}</span>
                      <span>•</span>
                      <span className="uppercase text-[#D8B56D]">{item.category}</span>
                    </div>
                  </div>

                  <div className="text-right">
                    <span className="font-enchanted font-extrabold text-sm text-[#EF4444] block">
                      -{currency_symbol}{item.total_loss.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                    </span>
                    <span className="text-[10px] text-red-300/80">Evaporated</span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Right: How to Save This Next Month (Gamified Action Playbook) */}
        <div className="parchment-card p-6 rounded-2xl space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="font-enchanted text-base font-bold text-[#F3E8D0] flex items-center gap-2">
              <Zap className="w-4 h-4 text-[#D8B56D]" />
              <span>How to Save It Next Month</span>
            </h3>
            <span className="text-[10px] uppercase font-bold text-emerald-400 px-2 py-0.5 rounded bg-emerald-950/60 border border-emerald-500/30">
              Recoverable
            </span>
          </div>

          <div className="space-y-3">
            {savings_opportunities.map((opp, idx) => (
              <div
                key={idx}
                className="p-3.5 rounded-xl bg-[#111620]/90 border border-[#D8B56D]/20 space-y-1 hover:border-[#D8B56D]/50 transition-colors"
              >
                <div className="flex items-center justify-between">
                  <span className="font-bold text-xs text-[#F3E8D0] flex items-center gap-1.5">
                    <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
                    <span>{opp.title}</span>
                  </span>
                  <span className="text-xs font-extrabold text-[#D8B56D] font-enchanted">
                    +{opp.potential_saving}
                  </span>
                </div>
                <p className="text-[11px] text-[#A8B9A5] leading-relaxed pl-5">
                  {opp.description}
                </p>
              </div>
            ))}
          </div>

          {/* Quick Action Button */}
          <button
            onClick={() => setTab('use-first')}
            className="w-full mt-2 py-2.5 px-4 bg-gradient-to-r from-[#D8B56D] to-[#ECC880] text-[#171D2B] font-bold text-xs rounded-xl hover:brightness-110 transition-all flex items-center justify-center gap-1.5 shadow-md shadow-[#D8B56D]/20 cursor-pointer"
          >
            <span>Audit Your "Use First" Queue Now</span>
            <ArrowRight className="w-3.5 h-3.5 stroke-[2.5]" />
          </button>
        </div>
      </div>
    </div>
  );
}
