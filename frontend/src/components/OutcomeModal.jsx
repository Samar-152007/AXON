import React, { useState, useEffect } from 'react';
import { X, CheckCircle, Trash2, Gift, Utensils, AlertCircle } from 'lucide-react';
import { api } from '../api';

const QUICK_REASONS = {
  consumed: ['Cooked for dinner', 'Used in salad / smoothie', 'Finished by family', 'Snacked on'],
  discarded: ['Spoiled / moldy before use', 'Passed best-before & smelled off', 'Forgotten in back of fridge', 'Damaged container'],
  donated: ['Shared with neighbor', 'Food drive donation', 'Left with housemate']
};

export default function OutcomeModal({ isOpen, onClose, item, onSuccess }) {
  if (!isOpen || !item) return null;

  const [outcomeType, setOutcomeType] = useState('consumed');
  const [quantity, setQuantity] = useState(item.quantity || 1);
  const [reason, setReason] = useState('');
  const [dateStr, setDateStr] = useState(new Date().toISOString().split('T')[0]);
  const [submitting, setSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');

  useEffect(() => {
    if (item) {
      setQuantity(item.quantity || 1);
      setOutcomeType('consumed');
      setReason('');
      setDateStr(new Date().toISOString().split('T')[0]);
      setErrorMsg('');
    }
  }, [item, isOpen]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setErrorMsg('');

    const qty = parseFloat(quantity);
    if (isNaN(qty) || qty <= 0) {
      setErrorMsg('Quantity must be greater than 0.');
      return;
    }

    if (qty > item.quantity) {
      setErrorMsg(`Cannot record more than available quantity (${item.quantity} ${item.unit}).`);
      return;
    }

    try {
      setSubmitting(true);
      const res = await api.recordItemOutcome(item.id, {
        outcome_type: outcomeType,
        quantity: qty,
        reason: reason.trim(),
        date: dateStr
      });
      onSuccess(res);
      onClose();
    } catch (err) {
      setErrorMsg(err.message || 'Failed to record outcome');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-sm">
      <div className="relative w-full max-w-md bg-[#171D2B] border border-[#D8B56D]/40 rounded-2xl shadow-2xl overflow-hidden">
        {/* Header */}
        <div className="px-6 py-4 border-b border-[#D8B56D]/20 bg-gradient-to-r from-[#17251F] to-[#171D2B] flex items-center justify-between">
          <div>
            <h3 className="font-enchanted font-bold text-lg text-[#F3E8D0]">Record Item Outcome</h3>
            <p className="text-xs text-[#A8B9A5]">
              {item.name} ({item.quantity} {item.unit})
            </p>
          </div>
          <button
            onClick={onClose}
            className="text-[#A8B9A5] hover:text-[#F3E8D0] p-1 rounded-lg hover:bg-white/5 transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          {errorMsg && (
            <div className="p-3 rounded-lg bg-[#5B1F32]/60 border border-red-500/40 text-red-200 text-xs flex items-center gap-2">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{errorMsg}</span>
            </div>
          )}

          {/* Outcome Type Selector */}
          <div>
            <label className="block text-xs font-semibold uppercase tracking-wider text-[#D8B56D] mb-2">
              What happened to this food?
            </label>
            <div className="grid grid-cols-3 gap-2">
              <button
                type="button"
                onClick={() => setOutcomeType('consumed')}
                className={`py-2.5 px-3 rounded-xl border text-xs font-semibold flex flex-col items-center gap-1.5 transition-all cursor-pointer ${
                  outcomeType === 'consumed'
                    ? 'bg-[#17251F] border-[#D8B56D] text-[#D8B56D] shadow-md shadow-[#D8B56D]/15'
                    : 'bg-[#111620] border-[#D8B56D]/20 text-[#A8B9A5] hover:border-[#D8B56D]/50'
                }`}
              >
                <Utensils className="w-4 h-4" />
                <span>Consumed</span>
              </button>

              <button
                type="button"
                onClick={() => setOutcomeType('discarded')}
                className={`py-2.5 px-3 rounded-xl border text-xs font-semibold flex flex-col items-center gap-1.5 transition-all cursor-pointer ${
                  outcomeType === 'discarded'
                    ? 'bg-[#5B1F32]/60 border-red-400 text-red-200 shadow-md shadow-red-900/30'
                    : 'bg-[#111620] border-[#D8B56D]/20 text-[#A8B9A5] hover:border-[#D8B56D]/50'
                }`}
              >
                <Trash2 className="w-4 h-4" />
                <span>Discarded</span>
              </button>

              <button
                type="button"
                onClick={() => setOutcomeType('donated')}
                className={`py-2.5 px-3 rounded-xl border text-xs font-semibold flex flex-col items-center gap-1.5 transition-all cursor-pointer ${
                  outcomeType === 'donated'
                    ? 'bg-[#17251F] border-[#A8B9A5] text-[#A8B9A5] shadow-md'
                    : 'bg-[#111620] border-[#D8B56D]/20 text-[#A8B9A5] hover:border-[#D8B56D]/50'
                }`}
              >
                <Gift className="w-4 h-4" />
                <span>Donated</span>
              </button>
            </div>
          </div>

          {/* Quantity and Date */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider text-[#D8B56D] mb-1">
                Quantity ({item.unit})
              </label>
              <input
                type="number"
                step="any"
                min="0.01"
                max={item.quantity}
                required
                value={quantity}
                onChange={(e) => setQuantity(e.target.value)}
                className="w-full px-3 py-2 rounded-lg bg-[#111620] border border-[#D8B56D]/30 text-[#F3E8D0] text-sm focus:outline-none focus:border-[#D8B56D]"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider text-[#D8B56D] mb-1">
                Date
              </label>
              <input
                type="date"
                required
                value={dateStr}
                onChange={(e) => setDateStr(e.target.value)}
                className="w-full px-3 py-2 rounded-lg bg-[#111620] border border-[#D8B56D]/30 text-[#F3E8D0] text-sm focus:outline-none focus:border-[#D8B56D]"
              />
            </div>
          </div>

          {/* Reason */}
          <div>
            <label className="block text-xs font-semibold uppercase tracking-wider text-[#D8B56D] mb-1">
              Reason / Context <span className="text-[10px] lowercase text-[#A8B9A5]">(optional)</span>
            </label>
            <input
              type="text"
              placeholder="e.g. Cooked pasta, spoiled before eating"
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              className="w-full px-3 py-2 rounded-lg bg-[#111620] border border-[#D8B56D]/30 text-[#F3E8D0] text-sm focus:outline-none focus:border-[#D8B56D]"
            />
            {/* Quick Reason Suggestions */}
            <div className="flex flex-wrap gap-1.5 mt-2">
              {QUICK_REASONS[outcomeType]?.map((preset) => (
                <button
                  key={preset}
                  type="button"
                  onClick={() => setReason(preset)}
                  className="px-2 py-0.5 rounded text-[11px] bg-[#111620] border border-[#D8B56D]/20 text-[#A8B9A5] hover:text-[#F3E8D0] hover:border-[#D8B56D]/50 transition-colors"
                >
                  {preset}
                </button>
              ))}
            </div>
          </div>

          {/* Action Buttons */}
          <div className="pt-4 flex items-center justify-end gap-3 border-t border-[#D8B56D]/20">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-sm text-[#A8B9A5] hover:text-[#F3E8D0] rounded-lg transition-colors cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={submitting}
              className={`px-5 py-2 text-sm font-semibold rounded-lg text-[#171D2B] hover:brightness-110 transition-all shadow-md cursor-pointer disabled:opacity-50 ${
                outcomeType === 'consumed'
                  ? 'bg-gradient-to-r from-[#D8B56D] to-[#ECC880]'
                  : outcomeType === 'discarded'
                  ? 'bg-gradient-to-r from-red-400 to-rose-300'
                  : 'bg-gradient-to-r from-[#A8B9A5] to-emerald-300'
              }`}
            >
              {submitting ? 'Recording...' : `Record as ${outcomeType.toUpperCase()}`}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
