import React, { useState } from 'react';
import { Sparkles, RefreshCw, Trash2, Plus, Info, CheckCircle2 } from 'lucide-react';
import { api } from '../api';

export default function Navbar({ onOpenAddItem, hasSampleData, onDataChange, showToast }) {
  const [resetting, setResetting] = useState(false);
  const [showTeamModal, setShowTeamModal] = useState(false);

  const handleResetSample = async () => {
    if (!confirm('Reset database to realistic demo sample data?')) return;
    try {
      setResetting(true);
      await api.resetSampleData();
      showToast('Sample data reset successfully!', 'success');
      if (onDataChange) onDataChange();
    } catch (err) {
      showToast('Failed to reset sample data: ' + err.message, 'error');
    } finally {
      setResetting(false);
    }
  };

  const handleClearAll = async () => {
    if (!confirm('Clear all items and outcomes to test empty states?')) return;
    try {
      setResetting(true);
      await api.clearData();
      showToast('All records cleared for empty-state testing.', 'info');
      if (onDataChange) onDataChange();
    } catch (err) {
      showToast('Failed to clear data: ' + err.message, 'error');
    } finally {
      setResetting(false);
    }
  };

  return (
    <>
      <header className="sticky top-0 z-30 h-16 border-b border-[#D8B56D]/20 bg-[#171D2B]/90 backdrop-blur-md px-4 sm:px-6 flex items-center justify-between">
        {/* Brand */}
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-lg bg-gradient-to-br from-[#D8B56D] to-[#5B1F32] flex items-center justify-center shadow-lg shadow-[#D8B56D]/10 border border-[#D8B56D]/30">
            <Sparkles className="w-5 h-5 text-[#171D2B]" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="font-enchanted font-bold text-xl text-[#F3E8D0] tracking-wider">
                Groc<span className="text-[#D8B56D]">IQ</span>
              </span>
              <span className="text-[10px] uppercase font-bold tracking-widest px-2 py-0.5 rounded border border-[#D8B56D]/30 bg-[#D8B56D]/10 text-[#D8B56D]">
                Team AXON
              </span>
            </div>
            <p className="text-xs text-[#A8B9A5] hidden sm:block">Smarter inventory. Less waste.</p>
          </div>
        </div>

        {/* Action Controls */}
        <div className="flex items-center gap-2 sm:gap-3">
          {/* Sample Data Badge & Control */}
          {hasSampleData ? (
            <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-[#D8B56D]/10 border border-[#D8B56D]/30 text-xs text-[#D8B56D]">
              <span className="w-1.5 h-1.5 rounded-full bg-[#D8B56D] animate-pulse"></span>
              <span className="font-medium hidden md:inline">Sample Data</span>
              <button
                onClick={handleResetSample}
                disabled={resetting}
                title="Reset sample data"
                className="hover:text-white p-0.5 transition-colors"
              >
                <RefreshCw className={`w-3 h-3 ${resetting ? 'animate-spin' : ''}`} />
              </button>
            </div>
          ) : (
            <button
              onClick={handleResetSample}
              disabled={resetting}
              className="px-2.5 py-1 text-xs rounded border border-[#D8B56D]/30 bg-[#17251F] text-[#D8B56D] hover:bg-[#D8B56D]/10 transition-colors flex items-center gap-1"
            >
              <RefreshCw className="w-3 h-3" />
              <span>Load Sample</span>
            </button>
          )}

          {/* Clear Data Button (for testing empty states) */}
          <button
            onClick={handleClearAll}
            disabled={resetting}
            title="Clear all data to test empty states"
            className="p-1.5 text-xs text-[#A8B9A5] hover:text-[#F3E8D0] rounded hover:bg-[#17251F]/80 transition-colors hidden sm:block"
          >
            <Trash2 className="w-4 h-4" />
          </button>

          {/* Team Info Button */}
          <button
            onClick={() => setShowTeamModal(true)}
            className="p-1.5 text-[#A8B9A5] hover:text-[#D8B56D] rounded hover:bg-[#17251F]/80 transition-colors"
            title="Team & Product Info"
          >
            <Info className="w-4 h-4" />
          </button>

          {/* Quick Add Button */}
          <button
            onClick={onOpenAddItem}
            className="px-3 py-1.5 text-xs sm:text-sm font-semibold rounded-lg bg-gradient-to-r from-[#D8B56D] to-[#ECC880] text-[#171D2B] hover:brightness-110 transition-all flex items-center gap-1.5 shadow-md shadow-[#D8B56D]/20 cursor-pointer"
          >
            <Plus className="w-4 h-4 stroke-[2.5]" />
            <span className="hidden xs:inline">Add Grocery</span>
          </button>
        </div>
      </header>

      {/* Team AXON Modal */}
      {showTeamModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
          <div className="bg-[#171D2B] border border-[#D8B56D]/40 rounded-xl p-6 max-w-md w-full shadow-2xl">
            <div className="flex items-center gap-3 mb-4">
              <div className="p-2 rounded-lg bg-[#D8B56D]/20 text-[#D8B56D]">
                <Sparkles className="w-6 h-6" />
              </div>
              <div>
                <h3 className="font-enchanted text-lg text-[#F3E8D0]">GrocIQ — Team AXON</h3>
                <p className="text-xs text-[#A8B9A5]">Triwizathon Round 2 Prototype</p>
              </div>
            </div>

            <div className="space-y-3 mb-6 text-sm text-[#F3E8D0]/90">
              <p className="text-xs leading-relaxed text-[#A8B9A5]">
                A transparent, feedback-driven grocery management MVP designed to prevent duplicate purchases,
                prioritize items before spoil, and record outcomes without unsupported AI claims.
              </p>
              <div className="p-3 rounded-lg bg-[#111620] border border-[#D8B56D]/20">
                <span className="text-xs text-[#D8B56D] font-bold block mb-1">TEAM MEMBERS:</span>
                <ul className="text-xs space-y-1 text-[#F3E8D0]">
                  <li>• Samarjeet Suryawanshi</li>
                  <li>• Shivanjali Desai</li>
                  <li>• Poonam Pawar</li>
                  <li>• Angel Kambale</li>
                </ul>
              </div>
            </div>

            <button
              onClick={() => setShowTeamModal(false)}
              className="w-full py-2 bg-[#D8B56D] text-[#171D2B] font-semibold text-sm rounded-lg hover:brightness-110 transition-all"
            >
              Close
            </button>
          </div>
        </div>
      )}
    </>
  );
}
