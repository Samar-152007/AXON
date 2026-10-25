import React, { useState, useEffect } from 'react';
import { 
  PieChart, 
  Utensils, 
  Trash2, 
  Gift, 
  TrendingUp, 
  Calendar, 
  Filter, 
  FileText,
  Sparkles,
  RefreshCw
} from 'lucide-react';
import { api } from '../api';

export default function Outcomes({ showToast, refreshTrigger }) {
  const [summary, setSummary] = useState(null);
  const [outcomes, setOutcomes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filterType, setFilterType] = useState('all');

  const fetchData = async () => {
    try {
      setLoading(true);
      const [sumRes, outRes] = await Promise.all([
        api.getOutcomesSummary(),
        api.getOutcomes({ outcome_type: filterType, limit: 100 })
      ]);
      setSummary(sumRes);
      setOutcomes(outRes);
    } catch (err) {
      showToast('Error loading outcomes: ' + err.message, 'error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, [filterType, refreshTrigger]);

  const {
    consumed = { count: 0, total_qty: 0 },
    discarded = { count: 0, total_qty: 0 },
    donated = { count: 0, total_qty: 0 },
    total_tracked = 0,
    waste_avoidance_rate = 100
  } = summary || {};

  const total = total_tracked || 1;
  const consumedPct = Math.round((consumed.count / total) * 100) || 0;
  const discardedPct = Math.round((discarded.count / total) * 100) || 0;
  const donatedPct = Math.round((donated.count / total) * 100) || 0;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <div className="flex items-center gap-2">
          <PieChart className="w-6 h-6 text-[#D8B56D]" />
          <h1 className="font-enchanted text-2xl font-bold text-[#F3E8D0]">
            Outcomes & Waste Analytics
          </h1>
        </div>
        <p className="text-xs text-[#A8B9A5] mt-1">
          Household records of food actually consumed, discarded, or donated.
        </p>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Card 1: Waste Avoidance Rate */}
        <div className="parchment-card p-5 rounded-xl border-l-4 border-l-[#D8B56D]">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs uppercase font-bold tracking-wider text-[#A8B9A5]">Efficiency Rate</span>
            <TrendingUp className="w-4 h-4 text-[#D8B56D]" />
          </div>
          <div className="font-enchanted text-3xl font-bold text-[#D8B56D] mb-1">
            {waste_avoidance_rate}%
          </div>
          <p className="text-xs text-[#A8B9A5]">Food saved from waste</p>
        </div>

        {/* Card 2: Consumed */}
        <div className="parchment-card p-5 rounded-xl border-l-4 border-l-emerald-500">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs uppercase font-bold tracking-wider text-emerald-400">Consumed</span>
            <Utensils className="w-4 h-4 text-emerald-400" />
          </div>
          <div className="font-enchanted text-3xl font-bold text-[#F3E8D0] mb-1">
            {consumed.count}
          </div>
          <p className="text-xs text-[#A8B9A5]">{consumed.total_qty} units utilized</p>
        </div>

        {/* Card 3: Discarded */}
        <div className="parchment-card p-5 rounded-xl border-l-4 border-l-rose-500">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs uppercase font-bold tracking-wider text-rose-400">Discarded</span>
            <Trash2 className="w-4 h-4 text-rose-400" />
          </div>
          <div className="font-enchanted text-3xl font-bold text-red-200 mb-1">
            {discarded.count}
          </div>
          <p className="text-xs text-[#A8B9A5]">{discarded.total_qty} units lost</p>
        </div>

        {/* Card 4: Donated */}
        <div className="parchment-card p-5 rounded-xl border-l-4 border-l-[#A8B9A5]">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs uppercase font-bold tracking-wider text-[#A8B9A5]">Donated</span>
            <Gift className="w-4 h-4 text-[#A8B9A5]" />
          </div>
          <div className="font-enchanted text-3xl font-bold text-[#F3E8D0] mb-1">
            {donated.count}
          </div>
          <p className="text-xs text-[#A8B9A5]">{donated.total_qty} units gifted</p>
        </div>
      </div>

      {/* Visual Chart / Proportion Bar */}
      <div className="parchment-card p-6 rounded-2xl space-y-4">
        <h2 className="font-enchanted text-base font-bold text-[#F3E8D0]">
          Household Utilization Ratio
        </h2>

        {total_tracked === 0 ? (
          <div className="p-8 text-center text-xs text-[#A8B9A5]">
            No outcomes recorded yet. As you mark items as consumed or discarded, visual ratios will appear here.
          </div>
        ) : (
          <div className="space-y-3">
            {/* Multi-segment stacked bar */}
            <div className="w-full h-5 rounded-full overflow-hidden flex bg-[#111620] p-1 border border-[#D8B56D]/30 shadow-inner">
              {consumedPct > 0 && (
                <div
                  style={{ width: `${consumedPct}%` }}
                  className="bg-emerald-500 h-full rounded-l-full transition-all duration-500 relative group"
                  title={`Consumed: ${consumedPct}%`}
                />
              )}
              {donatedPct > 0 && (
                <div
                  style={{ width: `${donatedPct}%` }}
                  className="bg-[#D8B56D] h-full transition-all duration-500"
                  title={`Donated: ${donatedPct}%`}
                />
              )}
              {discardedPct > 0 && (
                <div
                  style={{ width: `${discardedPct}%` }}
                  className="bg-rose-500 h-full rounded-r-full transition-all duration-500"
                  title={`Discarded: ${discardedPct}%`}
                />
              )}
            </div>

            {/* Legend */}
            <div className="flex flex-wrap items-center justify-between text-xs text-[#A8B9A5] pt-1">
              <div className="flex items-center gap-2">
                <span className="w-3 h-3 rounded-full bg-emerald-500 inline-block" />
                <span>Consumed: <strong>{consumed.count}</strong> ({consumedPct}%)</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="w-3 h-3 rounded-full bg-[#D8B56D] inline-block" />
                <span>Donated: <strong>{donated.count}</strong> ({donatedPct}%)</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="w-3 h-3 rounded-full bg-rose-500 inline-block" />
                <span>Discarded: <strong>{discarded.count}</strong> ({discardedPct}%)</span>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Outcome History Stream / Table */}
      <div className="parchment-card p-6 rounded-2xl space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <h2 className="font-enchanted text-base font-bold text-[#F3E8D0]">
              Historical Ledger Records
            </h2>
            <p className="text-xs text-[#A8B9A5]">Verified logs of past household food outcomes</p>
          </div>

          {/* Filter Pills */}
          <div className="flex items-center gap-1.5 self-start sm:self-auto">
            {['all', 'consumed', 'discarded', 'donated'].map((type) => (
              <button
                key={type}
                onClick={() => setFilterType(type)}
                className={`px-3 py-1 rounded-lg text-xs font-semibold capitalize transition-colors cursor-pointer ${
                  filterType === type
                    ? 'bg-[#D8B56D] text-[#171D2B]'
                    : 'bg-[#111620] text-[#A8B9A5] border border-[#D8B56D]/20 hover:text-white'
                }`}
              >
                {type}
              </button>
            ))}
          </div>
        </div>

        {loading ? (
          <div className="p-8 text-center text-xs text-[#A8B9A5]">
            <RefreshCw className="w-5 h-5 animate-spin mx-auto mb-2 text-[#D8B56D]" />
            Loading outcomes...
          </div>
        ) : outcomes.length === 0 ? (
          <div className="p-8 text-center text-xs text-[#A8B9A5] italic">
            No outcome records found matching "{filterType}".
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs text-[#F3E8D0]">
              <thead>
                <tr className="border-b border-[#D8B56D]/20 text-[#D8B56D] uppercase text-[10px] tracking-wider font-enchanted">
                  <th className="py-2.5 px-3">Date</th>
                  <th className="py-2.5 px-3">Item</th>
                  <th className="py-2.5 px-3">Quantity</th>
                  <th className="py-2.5 px-3">Outcome</th>
                  <th className="py-2.5 px-3">Reason / Context</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#D8B56D]/10">
                {outcomes.map((o) => (
                  <tr key={o.id} className="hover:bg-[#111620]/50 transition-colors">
                    <td className="py-3 px-3 text-[#A8B9A5] whitespace-nowrap">{o.date}</td>
                    <td className="py-3 px-3 font-semibold text-[#F3E8D0]">{o.item_name}</td>
                    <td className="py-3 px-3 text-[#D8B56D]">
                      {o.quantity} {o.unit}
                    </td>
                    <td className="py-3 px-3">
                      <span className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase ${
                        o.outcome_type === 'consumed'
                          ? 'bg-emerald-950 text-emerald-300 border border-emerald-500/30'
                          : o.outcome_type === 'discarded'
                          ? 'bg-rose-950 text-rose-300 border border-rose-500/30'
                          : 'bg-[#17251F] text-[#A8B9A5] border border-[#A8B9A5]/30'
                      }`}>
                        {o.outcome_type}
                      </span>
                    </td>
                    <td className="py-3 px-3 text-[#A8B9A5] max-w-xs truncate">
                      {o.reason || '—'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
