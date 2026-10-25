import React from 'react';
import { CheckCircle2, AlertCircle, Info, X } from 'lucide-react';

export default function Toast({ toast, onClose }) {
  if (!toast) return null;

  const { message, type = 'info' } = toast;

  const styles = {
    success: 'bg-[#17251F] border-emerald-500/50 text-emerald-200',
    error: 'bg-[#5B1F32] border-red-500/50 text-red-100',
    warning: 'bg-[#171D2B] border-[#D8B56D]/60 text-amber-200',
    info: 'bg-[#171D2B] border-[#D8B56D]/40 text-[#F3E8D0]',
  };

  const icons = {
    success: <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />,
    error: <AlertCircle className="w-4 h-4 text-red-400 shrink-0" />,
    warning: <AlertCircle className="w-4 h-4 text-[#D8B56D] shrink-0" />,
    info: <Info className="w-4 h-4 text-[#D8B56D] shrink-0" />,
  };

  return (
    <div className="fixed bottom-5 right-5 z-50 max-w-sm w-full animate-fadeIn">
      <div
        className={`flex items-center justify-between gap-3 p-3.5 rounded-xl border shadow-2xl backdrop-blur-md ${
          styles[type] || styles.info
        }`}
      >
        <div className="flex items-center gap-2.5 text-xs font-medium">
          {icons[type]}
          <span>{message}</span>
        </div>
        <button
          onClick={onClose}
          className="text-[#A8B9A5] hover:text-white p-1 rounded transition-colors cursor-pointer"
        >
          <X className="w-3.5 h-3.5" />
        </button>
      </div>
    </div>
  );
}
