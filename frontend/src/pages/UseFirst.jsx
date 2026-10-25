import React, { useState, useEffect } from 'react';
import { 
  Hourglass, 
  AlertTriangle, 
  CheckCircle, 
  Info, 
  HelpCircle, 
  Utensils, 
  Edit3, 
  ShieldAlert,
  Sparkles,
  RefreshCw
} from 'lucide-react';
import { api } from '../api';

const TIERS = [
  { id: 'ALL', label: 'All Items' },
  { id: 'URGENT', label: 'Urgent Attention' },
  { id: 'HIGH', label: 'High Priority (1-2 days)' },
  { id: 'MEDIUM', label: 'Medium Horizon (3-5 days)' },
  { id: 'LOW', label: 'Low Horizon (> 5 days)' },
  { id: 'UNCLASSIFIED', label: 'Missing Dates' }
];

export default function UseFirst({ onOpenOutcome, onEditItem, showToast, refreshTrigger }) {
  const [recommendations, setRecommendations] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedTier, setSelectedTier] = useState('ALL');

  const fetchRecommendations = async () => {
    try {
      setLoading(true);
      const res = await api.getRecommendations({
        tier: selectedTier
      });
      setRecommendations(res);
    } catch (err) {
      showToast('Error loading recommendations: ' + err.message, 'error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchRecommendations();
  }, [selectedTier, refreshTrigger]);

  const getTierBadge = (tier) => {
    switch (tier) {
      case 'URGENT':
        return (
          <span className="px-2.5 py-1 text-xs font-bold rounded-full bg-[#5B1F32] text-red-200 border border-red-500/40 flex items-center gap-1">
            <AlertTriangle className="w-3 h-3 text-red-400" />
            <span>URGENT</span>
          </span>
        );
      case 'HIGH':
        return (
          <span className="px-2.5 py-1 text-xs font-bold rounded-full bg-[#D8B56D]/20 text-[#D8B56D] border border-[#D8B56D]/40 flex items-center gap-1">
            <Hourglass className="w-3 h-3" />
            <span>HIGH PRIORITY</span>
          </span>
        );
      case 'MEDIUM':
        return (
          <span className="px-2.5 py-1 text-xs font-bold rounded-full bg-[#17251F] text-[#A8B9A5] border border-[#A8B9A5]/30">
            MEDIUM
          </span>
        );
      case 'LOW':
        return (
          <span className="px-2.5 py-1 text-xs font-bold rounded-full bg-[#111620] text-emerald-400/90 border border-emerald-500/20 flex items-center gap-1">
            <CheckCircle className="w-3 h-3" />
            <span>LOW / SAFE</span>
          </span>
        );
      case 'UNCLASSIFIED':
        return (
          <span className="px-2.5 py-1 text-xs font-bold rounded-full bg-[#171D2B] text-amber-200/90 border border-amber-300/30 flex items-center gap-1">
            <HelpCircle className="w-3 h-3 text-amber-300" />
            <span>MISSING DATE</span>
          </span>
        );
      default:
        return null;
    }
  };

  return (
    <div className="space-y-6">
      {/* Title & Transparent Engine Disclaimer */}
      <div>
        <div className="flex items-center gap-2">
          <Hourglass className="w-6 h-6 text-[#D8B56D]" />
          <h1 className="font-enchanted text-2xl font-bold text-[#F3E8D0]">
            Use First — Transparent Risk Review
          </h1>
        </div>
        <p className="text-xs text-[#A8B9A5] mt-1">
          Household inventory ranked by nearing dates and missing information. No synthetic AI dates are invented.
        </p>
      </div>

      {/* Prominent Educational Disclaimer Box */}
      <div className="p-4 rounded-xl bg-[#17251F]/90 border border-[#D8B56D]/30 flex items-start gap-3">
        <ShieldAlert className="w-5 h-5 text-[#D8B56D] shrink-0 mt-0.5" />
        <div className="space-y-1 text-xs">
          <p className="font-semibold text-[#F3E8D0]">
            Transparent Prioritization Notice
          </p>
          <p className="text-[#A8B9A5] leading-relaxed">
            Prioritization scores help schedule meal rotation and remind you of recorded dates.
            GrocIQ <strong>does not determine food safety</strong> or claim an item is safe or unsafe to eat.
            Always inspect visual condition, smell, and packaging before consuming food.
          </p>
        </div>
      </div>

      {/* Tier Filter Tabs */}
      <div className="flex items-center gap-2 overflow-x-auto pb-1 no-scrollbar">
        {TIERS.map((tier) => (
          <button
            key={tier.id}
            onClick={() => setSelectedTier(tier.id)}
            className={`px-3.5 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap transition-colors cursor-pointer ${
              selectedTier === tier.id
                ? 'bg-[#D8B56D] text-[#171D2B] shadow-sm'
                : 'bg-[#171D2B] text-[#A8B9A5] border border-[#D8B56D]/20 hover:text-[#F3E8D0] hover:border-[#D8B56D]/40'
            }`}
          >
            {tier.label}
          </button>
        ))}
      </div>

      {/* Recommendations Cards */}
      {loading ? (
        <div className="flex items-center justify-center p-12 text-[#A8B9A5]">
          <RefreshCw className="w-6 h-6 animate-spin text-[#D8B56D] mr-2" />
          <span className="text-sm">Calculating transparent queue...</span>
        </div>
      ) : recommendations.length === 0 ? (
        <div className="parchment-card rounded-2xl p-12 text-center space-y-3">
          <Sparkles className="w-12 h-12 mx-auto text-[#D8B56D]" />
          <h3 className="font-enchanted text-lg font-bold text-[#F3E8D0]">No Items in this Queue</h3>
          <p className="text-xs text-[#A8B9A5] max-w-sm mx-auto">
            No items currently match the selected tier filter. Check another tier or add new items.
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {recommendations.map((rec) => (
            <div
              key={rec.item_id}
              className={`parchment-card rounded-xl p-5 border-l-4 transition-all ${
                rec.urgency_tier === 'URGENT'
                  ? 'border-l-red-500 bg-gradient-to-r from-[#5B1F32]/20 to-transparent'
                  : rec.urgency_tier === 'HIGH'
                  ? 'border-l-[#D8B56D] bg-gradient-to-r from-[#D8B56D]/10 to-transparent'
                  : rec.urgency_tier === 'UNCLASSIFIED'
                  ? 'border-l-amber-400/60'
                  : 'border-l-[#A8B9A5]'
              }`}
            >
              <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                {/* Left details */}
                <div className="space-y-2 flex-1">
                  <div className="flex flex-wrap items-center gap-2.5">
                    <h3 className="font-bold text-[#F3E8D0] text-lg font-enchanted">
                      {rec.name}
                    </h3>
                    <span className="text-xs text-[#D8B56D] font-semibold">
                      ({rec.quantity} {rec.unit})
                    </span>
                    <span className="text-[10px] uppercase font-bold px-2 py-0.5 rounded bg-[#111620] border border-[#D8B56D]/20 text-[#A8B9A5]">
                      {rec.category}
                    </span>
                    {getTierBadge(rec.urgency_tier)}
                  </div>

                  {/* Why it appears (Required Explainable Section) */}
                  <div className="p-3 rounded-lg bg-[#111620]/90 border border-[#D8B56D]/15 space-y-1.5 text-xs">
                    <div className="flex items-start gap-1.5">
                      <span className="text-[#D8B56D] font-bold uppercase tracking-wider text-[10px] shrink-0">
                        Why this appears:
                      </span>
                      <span className="text-[#F3E8D0] font-medium leading-relaxed">
                        {rec.explanation}
                      </span>
                    </div>

                    <div className="flex items-start gap-1.5 pt-1 border-t border-white/5">
                      <span className="text-[#A8B9A5] font-bold uppercase tracking-wider text-[10px] shrink-0">
                        Recommended Action:
                      </span>
                      <span className="text-[#A8B9A5] leading-relaxed">
                        {rec.recommended_action}
                      </span>
                    </div>
                  </div>
                </div>

                {/* Right Actions */}
                <div className="flex items-center gap-2.5 shrink-0 self-end md:self-center">
                  {rec.urgency_tier === 'UNCLASSIFIED' && (
                    <button
                      onClick={() => onEditItem({ id: rec.item_id, name: rec.name, category: rec.category, quantity: rec.quantity, unit: rec.unit })}
                      className="px-3 py-2 text-xs font-semibold rounded-lg bg-[#111620] hover:bg-[#17251F] text-amber-200 border border-amber-300/30 transition-colors flex items-center gap-1.5 cursor-pointer"
                    >
                      <Edit3 className="w-3.5 h-3.5" />
                      <span>Add Date</span>
                    </button>
                  )}

                  <button
                    onClick={() => onOpenOutcome({ id: rec.item_id, name: rec.name, quantity: rec.quantity, unit: rec.unit })}
                    className="px-4 py-2 text-xs font-bold rounded-lg bg-gradient-to-r from-[#D8B56D] to-[#ECC880] text-[#171D2B] hover:brightness-110 transition-all flex items-center gap-1.5 shadow-md shadow-[#D8B56D]/20 cursor-pointer"
                  >
                    <Utensils className="w-3.5 h-3.5 stroke-[2.5]" />
                    <span>Record Outcome</span>
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
