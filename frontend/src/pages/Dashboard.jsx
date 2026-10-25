import React, { useEffect, useState, useRef } from 'react';
import { 
  Package, 
  Hourglass, 
  AlertTriangle, 
  ShoppingCart, 
  ArrowRight, 
  Utensils, 
  Trash2, 
  Gift, 
  Sparkles, 
  TrendingUp, 
  RefreshCw, 
  Coins,
  Camera,
  Upload,
  Plus,
  CheckCircle2,
  X,
  FileText,
  AlertCircle,
  Scan,
  CheckSquare,
  Square,
  Calendar
} from 'lucide-react';
import { api } from '../api';
import ProductScanner from '../components/ProductScanner';

const SAMPLE_RECEIPT = `GROCERY STORE #104
1x Whole Milk Gallon 75.00
2x Organic Spinach 40.00
1 Sourdough Bread 65.00
6 Eggs Farm Fresh 90.00
Subtotal 270.00
TOTAL 270.00`;

export default function Dashboard({ setTab, onOpenAddItem, onOpenOutcome, onDataRefresh, showToast }) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  // Hidden native file input refs
  const cameraInputRef = useRef(null);
  const fileInputRef = useRef(null);

  // OCR Scan & Candidate Review States
  const [extracting, setExtracting] = useState(false);
  const [candidates, setCandidates] = useState([]);
  const [confirming, setConfirming] = useState(false);
  const [ocrNotice, setOcrNotice] = useState(null);
  const [showTextPaste, setShowTextPaste] = useState(false);
  const [receiptText, setReceiptText] = useState('');

  // Live Product Expiry Scanner States
  const [scannedExpiryDate, setScannedExpiryDate] = useState('');
  const [isExpiryScannerOpen, setIsExpiryScannerOpen] = useState(false);

  const fetchDashboard = async () => {
    try {
      setLoading(true);
      const res = await api.getDashboard();
      setData(res);
      setError('');
    } catch (err) {
      setError(err.message || 'Failed to load dashboard data');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchDashboard();
  }, [onDataRefresh]);

  // Helper to map candidates with complete/incomplete data transparency
  const mapParsedCandidates = (candidatesList, detectedReceiptDate) => {
    return (candidatesList || []).map((c, i) => {
      const isPriceMissing = c.unit_price === null || c.unit_price === undefined || c.unit_price === '';
      const isNameMissing = !c.name || c.name.trim().length < 2;
      const isExpiryMissing = !c.expiry_date;
      const isIncomplete = Boolean(c.is_incomplete || isPriceMissing || isNameMissing);

      return {
        id: i + 1,
        name: c.name || '',
        quantity: c.quantity || 1.0,
        unit: c.unit || 'units',
        category: c.category || 'Other',
        unit_price: !isPriceMissing ? c.unit_price : '',
        expiry_date: c.expiry_date || '',
        purchase_date: detectedReceiptDate || new Date().toISOString().split('T')[0],
        is_incomplete: isIncomplete,
        missing_fields: [
          ...(isNameMissing ? ['name'] : []),
          ...(isPriceMissing ? ['unit_price'] : []),
          ...(isExpiryMissing ? ['expiry_date'] : [])
        ],
        confidence: c.confidence || (isIncomplete ? 'Incomplete' : 'Complete'),
        selected: true
      };
    });
  };

  // Handle image capture from camera or file picker
  const handleImageUpload = async (file) => {
    if (!file) return;

    try {
      setExtracting(true);
      setOcrNotice(null);
      const formData = new FormData();
      formData.append('file', file);

      const res = await api.extractReceipt(formData);

      if (res.success && res.candidates && res.candidates.length > 0) {
        const mapped = mapParsedCandidates(res.candidates, res.detected_receipt_date);
        setCandidates(mapped);
        if (showToast) {
          showToast(res.message || `Parsed ${mapped.length} candidate item(s). Review below before saving.`, 'success');
        }
      } else {
        const noticeMsg = res.error || res.message || 'No clear text detected in the image. You can paste receipt lines or enter items manually below.';
        setOcrNotice(noticeMsg);
        setShowTextPaste(true);
        if (showToast) {
          showToast(noticeMsg, 'info');
        }
      }
    } catch (err) {
      const errMsg = 'OCR processing notice: ' + (err.message || 'Local OCR engine unavailable. You can use the text parser below.');
      setOcrNotice(errMsg);
      setShowTextPaste(true);
      if (showToast) {
        showToast(errMsg, 'error');
      }
    } finally {
      setExtracting(false);
    }
  };

  // Text parser fallback handler
  const handleExtractFromText = async () => {
    if (!receiptText.trim()) {
      if (showToast) showToast('Please enter or paste receipt text.', 'error');
      return;
    }

    try {
      setExtracting(true);
      setOcrNotice(null);
      const formData = new FormData();
      formData.append('raw_text', receiptText);
      const res = await api.extractReceipt(formData);

      if (res.success && res.candidates && res.candidates.length > 0) {
        const mapped = mapParsedCandidates(res.candidates, res.detected_receipt_date);
        setCandidates(mapped);
        setShowTextPaste(false);
        if (showToast) {
          showToast(`Parsed ${mapped.length} candidate item(s) from receipt text!`, 'success');
        }
      } else {
        setOcrNotice(res.message || 'No candidate items could be parsed from the provided text.');
      }
    } catch (err) {
      if (showToast) showToast('Text extraction failed: ' + err.message, 'error');
    } finally {
      setExtracting(false);
    }
  };

  // Candidate modification handlers
  const updateCandidate = (index, field, value) => {
    setCandidates((prev) => {
      const copy = [...prev];
      const updatedItem = { ...copy[index], [field]: value };
      
      // Dynamically recalculate completeness
      const isPriceMissing = updatedItem.unit_price === '' || updatedItem.unit_price === null || updatedItem.unit_price === undefined;
      const isNameMissing = !updatedItem.name || updatedItem.name.trim().length < 2;
      updatedItem.is_incomplete = isPriceMissing || isNameMissing;
      updatedItem.confidence = updatedItem.is_incomplete ? 'Incomplete' : 'Complete';

      copy[index] = updatedItem;
      return copy;
    });
  };

  const removeCandidate = (index) => {
    setCandidates((prev) => prev.filter((_, i) => i !== index));
  };

  const addBlankCandidate = () => {
    setCandidates((prev) => [
      ...prev,
      {
        id: Date.now(),
        name: '',
        quantity: 1,
        unit: 'units',
        category: 'Produce',
        unit_price: '',
        expiry_date: '',
        purchase_date: new Date().toISOString().split('T')[0],
        is_incomplete: true,
        missing_fields: ['name', 'unit_price', 'expiry_date'],
        confidence: 'Incomplete',
        selected: true
      }
    ]);
  };

  const toggleSelectAll = (checked) => {
    setCandidates((prev) => prev.map((c) => ({ ...c, selected: checked })));
  };

  // Confirm candidates and save into active inventory
  const handleConfirmImport = async () => {
    const selected = candidates.filter((c) => c.selected);
    if (selected.length === 0) {
      if (showToast) showToast('Please select at least one item to confirm.', 'error');
      return;
    }

    // Never save items with blank names
    const invalidItems = selected.filter((c) => !c.name || !c.name.trim());
    if (invalidItems.length > 0) {
      if (showToast) {
        showToast('Incomplete information: Please provide a valid grocery name for all selected items before saving.', 'error');
      }
      return;
    }

    try {
      setConfirming(true);
      const payload = selected.map((c) => {
        const priceNum = c.unit_price !== '' && c.unit_price !== null && !isNaN(parseFloat(c.unit_price))
          ? parseFloat(c.unit_price) 
          : null;
        return {
          name: c.name.trim(),
          quantity: parseFloat(c.quantity) || 1.0,
          unit: c.unit || 'units',
          category: c.category || 'Other',
          unit_price: priceNum,
          price: priceNum,
          purchase_date: c.purchase_date || new Date().toISOString().split('T')[0],
          expiry_date: c.expiry_date && c.expiry_date.trim() ? c.expiry_date.trim() : null,
          notes: c.is_incomplete ? 'Scanned from receipt (Incomplete fields reviewed).' : 'Scanned from receipt.'
        };
      });

      const res = await api.confirmReceipt(payload);
      if (showToast) {
        showToast(res.message || `Successfully saved ${selected.length} item(s) into inventory!`, 'success');
      }
      setCandidates([]);
      fetchDashboard();
      if (onDataRefresh) onDataRefresh();
    } catch (err) {
      if (showToast) showToast('Failed to import items: ' + err.message, 'error');
    } finally {
      setConfirming(false);
    }
  };

  if (loading && !data) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[400px] text-[#A8B9A5]">
        <RefreshCw className="w-8 h-8 text-[#D8B56D] animate-spin mb-3" />
        <p className="font-enchanted text-sm text-[#F3E8D0]">Consulting the Pantry Ledger...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-6 rounded-xl bg-[#5B1F32]/50 border border-red-500/40 text-red-200">
        <p className="font-semibold mb-2">Error loading dashboard</p>
        <p className="text-sm">{error}</p>
        <button
          onClick={fetchDashboard}
          className="mt-4 px-4 py-1.5 text-xs bg-red-800 rounded-lg hover:bg-red-700 text-white"
        >
          Try Again
        </button>
      </div>
    );
  }

  const {
    total_active_items = 0,
    items_needing_review = 0,
    urgent_recommendations = [],
    shopping_list_count = 0,
    duplicate_warnings_count = 0,
    duplicate_warnings = [],
    outcomes_summary = { consumed: 0, discarded: 0, donated: 0, waste_avoidance_rate: 100 },
    recent_outcomes = []
  } = data || {};

  const allSelected = candidates.length > 0 && candidates.every((c) => c.selected);
  const selectedCount = candidates.filter((c) => c.selected).length;

  return (
    <div className="space-y-6">
      {/* Hidden Native File Inputs */}
      {/* 1. Camera Input: capture="environment" launches rear camera on mobile or file picker on desktop */}
      <input
        ref={cameraInputRef}
        type="file"
        accept="image/*"
        capture="environment"
        className="hidden"
        onChange={(e) => {
          if (e.target.files && e.target.files[0]) {
            handleImageUpload(e.target.files[0]);
            e.target.value = '';
          }
        }}
      />

      {/* 2. Standard File Upload Input */}
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={(e) => {
          if (e.target.files && e.target.files[0]) {
            handleImageUpload(e.target.files[0]);
            e.target.value = '';
          }
        }}
      />

      {/* ========================================================================= */}
      {/* PROMINENT QUICK ACTIONS SECTION AT TOP OF DASHBOARD                       */}
      {/* ========================================================================= */}
      <div className="relative overflow-hidden rounded-2xl p-6 sm:p-7 bg-gradient-to-r from-[#17251F]/95 via-[#171D2B] to-[#121720]/95 border border-[#D8B56D]/35 shadow-2xl">
        <div className="absolute top-0 right-0 p-8 opacity-10 pointer-events-none">
          <Sparkles className="w-48 h-48 text-[#D8B56D]" />
        </div>

        <div className="relative z-10">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-5">
            <div>
              <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-[#D8B56D]/15 border border-[#D8B56D]/40 text-[#D8B56D] text-xs font-semibold uppercase tracking-wider mb-2 font-enchanted">
                <Sparkles className="w-3.5 h-3.5" />
                <span>Enchanted Grocery Intelligence</span>
              </div>
              <h1 className="font-enchanted text-2xl sm:text-3xl font-bold text-[#F3E8D0] tracking-wide">
                The Household Pantry Ledger
              </h1>
              <p className="text-xs sm:text-sm text-[#A8B9A5] mt-1 max-w-xl">
                Quickly register groceries via live camera scan, receipt upload, or manual entry to keep your pantry up-to-date.
              </p>
            </div>

            {/* Sub-toggle for manual text parser */}
            <button
              onClick={() => setShowTextPaste(!showTextPaste)}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[#111620] hover:bg-[#17251F] border border-[#D8B56D]/30 text-xs font-semibold text-[#D8B56D] transition-colors self-start md:self-auto cursor-pointer"
            >
              <FileText className="w-3.5 h-3.5" />
              <span>{showTextPaste ? 'Hide Text Parser' : 'Paste Receipt Text'}</span>
            </button>
          </div>

          {/* Quick Actions Buttons Row */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3.5 pt-1">
            {/* Action 1: Add Manually */}
            <button
              onClick={onOpenAddItem}
              className="py-3 px-4 rounded-xl bg-gradient-to-r from-[#D8B56D] to-[#ECC880] text-[#171D2B] font-bold text-sm shadow-lg shadow-[#D8B56D]/10 hover:brightness-110 active:scale-[0.99] transition-all flex items-center justify-center gap-2 cursor-pointer group"
            >
              <Plus className="w-4 h-4 stroke-[2.5] group-hover:rotate-90 transition-transform" />
              <span>+ Add Manually</span>
            </button>

            {/* Action 2: Live Expiry Scanner (Tesseract.js OCR frame capture) */}
            <button
              onClick={() => setIsExpiryScannerOpen(true)}
              className="py-3 px-4 rounded-xl bg-gradient-to-r from-amber-600/90 to-amber-700/90 hover:from-amber-500 hover:to-amber-600 text-white font-bold text-sm shadow-lg shadow-amber-950/40 active:scale-[0.99] transition-all flex items-center justify-center gap-2 cursor-pointer border border-amber-400/30 group"
            >
              <Scan className="w-4 h-4 text-amber-200 group-hover:scale-110 transition-transform" />
              <span>📸 Scan Expiry (Live OCR)</span>
            </button>

            {/* Action 3: Scan Receipt / Camera Image */}
            <button
              onClick={() => cameraInputRef.current?.click()}
              disabled={extracting}
              className="py-3 px-4 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-700 hover:from-emerald-500 hover:to-teal-600 text-white font-bold text-sm shadow-lg shadow-emerald-950/40 active:scale-[0.99] transition-all flex items-center justify-center gap-2 cursor-pointer border border-emerald-400/30 disabled:opacity-50 group"
            >
              <Camera className="w-4 h-4 group-hover:scale-110 transition-transform text-emerald-200" />
              <span>🧾 Scan Receipt</span>
            </button>

            {/* Action 4: Upload Image */}
            <button
              onClick={() => fileInputRef.current?.click()}
              disabled={extracting}
              className="py-3 px-4 rounded-xl bg-[#171D2B] hover:bg-[#1C2333] text-[#F3E8D0] font-bold text-sm border border-[#D8B56D]/40 hover:border-[#D8B56D] shadow-md active:scale-[0.99] transition-all flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50 group"
            >
              <Upload className="w-4 h-4 text-[#D8B56D] group-hover:-translate-y-0.5 transition-transform" />
              <span>📁 Upload Image</span>
            </button>
          </div>
        </div>
      </div>

      {/* ========================================================================= */}
      {/* DETECTED EXPIRY DATE AUTO-FILLED BANNER                                   */}
      {/* ========================================================================= */}
      {scannedExpiryDate && (
        <div className="p-4 rounded-2xl bg-gradient-to-r from-emerald-950/60 via-[#171D2B] to-[#121620] border border-emerald-500/40 text-emerald-200 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 shadow-xl animate-fade-in">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-xl bg-emerald-500/20 border border-emerald-500/30 text-emerald-300">
              <Calendar className="w-5 h-5 text-emerald-400" />
            </div>
            <div>
              <span className="text-[10px] uppercase font-bold tracking-wider text-emerald-400">
                Product Expiry Detected & Auto-Filled
              </span>
              <div className="font-enchanted font-bold text-lg text-white">
                Detected Expiry Date: <span className="text-[#D8B56D]">{scannedExpiryDate}</span>
              </div>
            </div>
          </div>
          <div className="flex items-center gap-2 self-start sm:self-auto">
            <button
              onClick={() => onOpenAddItem({ expiry_date: scannedExpiryDate })}
              className="px-3.5 py-1.5 rounded-lg bg-emerald-500 hover:bg-emerald-400 text-black font-bold text-xs shadow-md transition-all flex items-center gap-1.5 cursor-pointer"
            >
              <Plus className="w-3.5 h-3.5 stroke-[2.5]" />
              <span>Log Item with this Date</span>
            </button>
            <button
              onClick={() => setScannedExpiryDate('')}
              className="px-2.5 py-1.5 rounded-lg bg-[#111620] hover:bg-[#17251F] border border-[#D8B56D]/30 text-xs text-[#A8B9A5] hover:text-white transition-colors cursor-pointer"
            >
              Clear
            </button>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* OCR PROCESSING LOADING STATE (RENDERED RIGHT ON DASHBOARD)                */}
      {/* ========================================================================= */}
      {extracting && (
        <div className="parchment-card rounded-2xl p-6 border-2 border-[#D8B56D]/60 bg-gradient-to-r from-[#17251F]/90 via-[#171D2B]/90 to-[#121720]/90 shadow-2xl relative overflow-hidden">
          <div className="flex flex-col sm:flex-row items-center gap-5 relative z-10">
            <div className="relative p-3.5 rounded-2xl bg-[#111620] border border-[#D8B56D]/40 shadow-inner">
              <RefreshCw className="w-8 h-8 text-[#D8B56D] animate-spin" />
            </div>
            <div className="space-y-1 text-center sm:text-left flex-1">
              <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-[#D8B56D]/20 text-[#D8B56D] text-[11px] font-bold uppercase tracking-wider font-enchanted">
                <Scan className="w-3.5 h-3.5 animate-pulse" />
                Deciphering Receipt & Products
              </div>
              <h3 className="font-enchanted text-lg font-bold text-[#F3E8D0]">
                Consulting GrocIQ Vision Engine...
              </h3>
              <p className="text-xs text-[#A8B9A5]">
                Extracting candidate items, detected quantities, and pricing into the verification ledger.
              </p>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* TEXT PARSER FALLBACK DRAWER (EXPANDABLE)                                  */}
      {/* ========================================================================= */}
      {showTextPaste && (
        <div className="parchment-card p-5 rounded-2xl space-y-3 border border-[#D8B56D]/40 bg-[#171D2B]/95 animate-fade-in">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <FileText className="w-4 h-4 text-[#D8B56D]" />
              <h3 className="text-xs uppercase font-bold text-[#D8B56D] tracking-wider font-enchanted">
                Receipt Text / Line Parser (OCR Fallback)
              </h3>
            </div>
            <button
              onClick={() => setShowTextPaste(false)}
              className="text-[#A8B9A5] hover:text-white p-1"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          <textarea
            rows={4}
            value={receiptText}
            onChange={(e) => setReceiptText(e.target.value)}
            placeholder="Paste receipt lines: e.g. 1 Milk 60.00, 2 Apples 45.00..."
            className="w-full p-3 rounded-xl bg-[#111620] border border-[#D8B56D]/30 text-[#F3E8D0] text-xs font-mono focus:outline-none focus:border-[#D8B56D]"
          />

          <div className="flex flex-wrap items-center justify-between gap-2">
            <button
              type="button"
              onClick={() => setReceiptText(SAMPLE_RECEIPT)}
              className="text-xs text-[#A8B9A5] hover:text-[#D8B56D] underline cursor-pointer"
            >
              Load Sample Text
            </button>
            <button
              onClick={handleExtractFromText}
              disabled={extracting}
              className="py-2 px-5 bg-gradient-to-r from-[#D8B56D] to-[#ECC880] text-[#171D2B] font-bold text-xs rounded-lg hover:brightness-110 transition-all flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
            >
              <Sparkles className="w-3.5 h-3.5" />
              <span>Parse Items from Text</span>
            </button>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* REVIEW CANDIDATES TABLE (CONFIRMATION STAGE - NEVER AUTO-SAVED)           */}
      {/* ========================================================================= */}
      {candidates.length > 0 && (() => {
        const incompleteCandidatesCount = candidates.filter(
          (c) => c.is_incomplete || !c.unit_price || !c.expiry_date
        ).length;

        return (
          <div className="parchment-card p-5 sm:p-6 rounded-2xl space-y-4 border-2 border-[#D8B56D]/50 bg-[#171D2B]/95 shadow-2xl animate-fade-in">
            {/* Header */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-[#D8B56D]/20 pb-3">
              <div>
                <div className="flex items-center gap-2">
                  <span className="p-1 rounded bg-[#D8B56D]/20 text-[#D8B56D]">
                    <Scan className="w-4 h-4" />
                  </span>
                  <h2 className="font-enchanted text-base sm:text-lg font-bold text-[#F3E8D0]">
                    Review Scanned Candidates ({candidates.length})
                  </h2>
                </div>
                <p className="text-xs text-[#A8B9A5] mt-0.5">
                  GrocIQ never saves unconfirmed scans. Review incomplete information and enter missing prices or dates before saving.
                </p>
              </div>

              <div className="flex items-center gap-2 self-start sm:self-auto flex-wrap">
                <button
                  type="button"
                  onClick={addBlankCandidate}
                  className="px-3 py-1.5 rounded-lg bg-[#111620] hover:bg-[#17251F] border border-[#D8B56D]/30 text-xs font-semibold text-[#D8B56D] transition-colors flex items-center gap-1 cursor-pointer"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>Add Row</span>
                </button>

                <button
                  type="button"
                  onClick={() => setCandidates([])}
                  className="px-3 py-1.5 rounded-lg bg-[#111620] hover:bg-red-950/50 border border-red-500/30 text-xs font-semibold text-red-300 transition-colors flex items-center gap-1 cursor-pointer"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                  <span>Dismiss</span>
                </button>

                <button
                  onClick={handleConfirmImport}
                  disabled={confirming || selectedCount === 0}
                  className="px-4 py-2 bg-gradient-to-r from-emerald-500 to-teal-600 hover:brightness-110 text-white font-bold text-xs sm:text-sm rounded-lg shadow-md transition-all flex items-center gap-1.5 cursor-pointer disabled:opacity-40"
                >
                  <CheckCircle2 className="w-4 h-4 stroke-[2.5]" />
                  <span>{confirming ? 'Saving...' : `Confirm & Save Selected (${selectedCount})`}</span>
                </button>
              </div>
            </div>

            {/* Incomplete Information Notice Banner */}
            {incompleteCandidatesCount > 0 && (
              <div className="p-3 rounded-xl bg-amber-950/40 border border-amber-500/40 text-amber-200 text-xs flex flex-col sm:flex-row sm:items-center justify-between gap-3 animate-fade-in">
                <div className="flex items-center gap-2">
                  <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0" />
                  <span>
                    <strong>Incomplete Information:</strong> {incompleteCandidatesCount} item(s) have missing prices or expiry dates. Complete the highlighted fields below.
                  </span>
                </div>
                <div className="flex items-center gap-2 self-start sm:self-auto">
                  <button
                    type="button"
                    onClick={() => {
                      const d = new Date();
                      d.setDate(d.getDate() + 7);
                      const plus7 = d.toISOString().split('T')[0];
                      setCandidates((prev) =>
                        prev.map((c) => (c.selected && !c.expiry_date ? { ...c, expiry_date: plus7 } : c))
                      );
                      if (showToast) showToast('Filled +7d expiry for selected items without a date.', 'info');
                    }}
                    className="px-2.5 py-1 rounded bg-[#111620] hover:bg-[#D8B56D] hover:text-[#171D2B] border border-[#D8B56D]/30 text-[11px] font-semibold text-[#D8B56D] transition-colors cursor-pointer"
                  >
                    Quick-Set Expiry (+7d)
                  </button>
                </div>
              </div>
            )}

            {/* Table */}
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs text-[#F3E8D0]">
                <thead>
                  <tr className="border-b border-[#D8B56D]/20 text-[#D8B56D] uppercase text-[10px] tracking-wider font-enchanted">
                    <th className="py-2 px-2 w-10 text-center">
                      <button
                        type="button"
                        onClick={() => toggleSelectAll(!allSelected)}
                        className="cursor-pointer text-[#D8B56D] hover:text-white"
                        title={allSelected ? 'Deselect All' : 'Select All'}
                      >
                        {allSelected ? <CheckSquare className="w-4 h-4 text-emerald-400" /> : <Square className="w-4 h-4 text-[#A8B9A5]" />}
                      </button>
                    </th>
                    <th className="py-2 px-2 w-24">Status</th>
                    <th className="py-2 px-3">Item Name</th>
                    <th className="py-2 px-3 w-28">Quantity</th>
                    <th className="py-2 px-3 w-32">Category</th>
                    <th className="py-2 px-3 w-28">Unit Price (₹)</th>
                    <th className="py-2 px-3 w-36">Best-Before Date</th>
                    <th className="py-2 px-2 w-10 text-center">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#D8B56D]/10">
                  {candidates.map((c, idx) => (
                    <tr key={c.id || idx} className="hover:bg-[#111620]/60 transition-colors">
                      <td className="py-2 px-2 text-center">
                        <input
                          type="checkbox"
                          checked={c.selected}
                          onChange={(e) => updateCandidate(idx, 'selected', e.target.checked)}
                          className="rounded border-[#D8B56D]/40 text-[#D8B56D] focus:ring-0 cursor-pointer accent-[#D8B56D]"
                        />
                      </td>
                      <td className="py-2 px-2">
                        {c.is_incomplete || !c.unit_price || !c.expiry_date ? (
                          <span 
                            className="text-[10px] text-amber-300 bg-amber-950/60 px-2 py-0.5 rounded border border-amber-500/30 whitespace-nowrap"
                            title={c.missing_fields?.length ? `Missing: ${c.missing_fields.join(', ')}` : 'Incomplete fields'}
                          >
                            ⚠️ Incomplete
                          </span>
                        ) : (
                          <span className="text-[10px] text-emerald-400 bg-emerald-950/60 px-2 py-0.5 rounded border border-emerald-500/30 whitespace-nowrap">
                            ✅ Complete
                          </span>
                        )}
                      </td>
                      <td className="py-2 px-3">
                        <input
                          type="text"
                          value={c.name}
                          onChange={(e) => updateCandidate(idx, 'name', e.target.value)}
                          placeholder="Required: Item name"
                          className={`w-full px-2.5 py-1.5 rounded-lg bg-[#111620] text-xs text-[#F3E8D0] focus:border-[#D8B56D] focus:outline-none ${
                            !c.name?.trim() ? 'border-2 border-amber-500/70' : 'border border-[#D8B56D]/25'
                          }`}
                        />
                      </td>
                      <td className="py-2 px-3">
                        <div className="flex items-center gap-1">
                          <input
                            type="number"
                            step="any"
                            min="0.1"
                            value={c.quantity}
                            onChange={(e) => updateCandidate(idx, 'quantity', e.target.value)}
                            className="w-16 px-2 py-1.5 rounded-lg bg-[#111620] border border-[#D8B56D]/25 text-xs text-[#F3E8D0] focus:border-[#D8B56D] focus:outline-none"
                          />
                          <input
                            type="text"
                            value={c.unit}
                            onChange={(e) => updateCandidate(idx, 'unit', e.target.value)}
                            placeholder="unit"
                            className="w-14 px-1.5 py-1.5 rounded-lg bg-[#111620] border border-[#D8B56D]/25 text-xs text-[#A8B9A5] focus:border-[#D8B56D] focus:outline-none text-center"
                          />
                        </div>
                      </td>
                      <td className="py-2 px-3">
                        <select
                          value={c.category}
                          onChange={(e) => updateCandidate(idx, 'category', e.target.value)}
                          className="w-full px-2 py-1.5 rounded-lg bg-[#111620] border border-[#D8B56D]/25 text-xs text-[#F3E8D0] focus:border-[#D8B56D] focus:outline-none"
                        >
                          {['Vegetables', 'Fruits', 'Dairy', 'Grains', 'Pantry', 'Bakery', 'Frozen', 'Meat & Seafood', 'Beverages', 'Other'].map((cat) => (
                            <option key={cat} value={cat} className="bg-[#171D2B]">
                              {cat}
                            </option>
                          ))}
                        </select>
                      </td>
                      <td className="py-2 px-3">
                        <div className="relative">
                          <span className="absolute left-2.5 top-1.5 text-xs text-[#D8B56D] font-bold">₹</span>
                          <input
                            type="number"
                            step="0.01"
                            min="0"
                            value={c.unit_price}
                            onChange={(e) => updateCandidate(idx, 'unit_price', e.target.value)}
                            placeholder="Optional"
                            className={`w-full pl-6 pr-2 py-1.5 rounded-lg bg-[#111620] text-xs text-[#F3E8D0] focus:border-[#D8B56D] focus:outline-none ${
                              c.unit_price === '' ? 'border border-amber-500/40' : 'border border-[#D8B56D]/25'
                            }`}
                          />
                        </div>
                      </td>
                      <td className="py-2 px-3">
                        <input
                          type="date"
                          value={c.expiry_date || ''}
                          onChange={(e) => updateCandidate(idx, 'expiry_date', e.target.value)}
                          className={`w-full px-2 py-1.5 rounded-lg bg-[#111620] text-xs text-[#F3E8D0] focus:border-[#D8B56D] focus:outline-none ${
                            !c.expiry_date ? 'border border-amber-500/40' : 'border border-[#D8B56D]/25'
                          }`}
                        />
                      </td>
                      <td className="py-2 px-2 text-center">
                        <button
                          type="button"
                          onClick={() => removeCandidate(idx)}
                          className="text-[#A8B9A5] hover:text-red-400 p-1.5 cursor-pointer rounded hover:bg-red-950/40 transition-colors"
                          title="Remove row"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        );
      })()}

      {/* ========================================================================= */}
      {/* 4 PRIMARY METRIC CARDS                                                    */}
      {/* ========================================================================= */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Metric 1: Active Items */}
        <div 
          onClick={() => setTab('inventory')}
          className="parchment-card p-5 rounded-xl cursor-pointer hover:border-[#D8B56D]/50 transition-all group"
        >
          <div className="flex items-center justify-between mb-3">
            <span className="text-xs uppercase font-semibold tracking-wider text-[#A8B9A5]">Active Inventory</span>
            <div className="p-2 rounded-lg bg-[#17251F] text-[#D8B56D] border border-[#D8B56D]/20 group-hover:scale-105 transition-transform">
              <Package className="w-5 h-5" />
            </div>
          </div>
          <div className="font-enchanted text-3xl font-bold text-[#F3E8D0] mb-1">
            {total_active_items}
          </div>
          <p className="text-xs text-[#A8B9A5] flex items-center justify-between">
            <span>Items currently tracked</span>
            <ArrowRight className="w-3.5 h-3.5 opacity-0 group-hover:opacity-100 transition-opacity text-[#D8B56D]" />
          </p>
        </div>

        {/* Metric 2: Needs Review (Use First) */}
        <div 
          onClick={() => setTab('use-first')}
          className="parchment-card p-5 rounded-xl cursor-pointer hover:border-[#D8B56D]/50 transition-all group"
        >
          <div className="flex items-center justify-between mb-3">
            <span className="text-xs uppercase font-semibold tracking-wider text-[#D8B56D]">Needs Review</span>
            <div className={`p-2 rounded-lg border group-hover:scale-105 transition-transform ${
              items_needing_review > 0 
                ? 'bg-[#5B1F32]/80 text-rose-200 border-red-500/40' 
                : 'bg-[#17251F] text-[#A8B9A5] border-[#D8B56D]/20'
            }`}>
              <Hourglass className="w-5 h-5" />
            </div>
          </div>
          <div className={`font-enchanted text-3xl font-bold mb-1 ${items_needing_review > 0 ? 'text-amber-300' : 'text-[#F3E8D0]'}`}>
            {items_needing_review}
          </div>
          <p className="text-xs text-[#A8B9A5] flex items-center justify-between">
            <span>Approaching / overdue dates</span>
            <ArrowRight className="w-3.5 h-3.5 opacity-0 group-hover:opacity-100 transition-opacity text-[#D8B56D]" />
          </p>
        </div>

        {/* Metric 3: Duplicate Warnings */}
        <div 
          onClick={() => setTab('shopping-list')}
          className="parchment-card p-5 rounded-xl cursor-pointer hover:border-[#D8B56D]/50 transition-all group"
        >
          <div className="flex items-center justify-between mb-3">
            <span className="text-xs uppercase font-semibold tracking-wider text-[#A8B9A5]">Duplicate Warnings</span>
            <div className={`p-2 rounded-lg border group-hover:scale-105 transition-transform ${
              duplicate_warnings_count > 0 
                ? 'bg-[#D8B56D]/20 text-[#D8B56D] border-[#D8B56D]/50' 
                : 'bg-[#17251F] text-[#A8B9A5] border-[#D8B56D]/20'
            }`}>
              <AlertTriangle className="w-5 h-5" />
            </div>
          </div>
          <div className="font-enchanted text-3xl font-bold text-[#F3E8D0] mb-1">
            {duplicate_warnings_count}
          </div>
          <p className="text-xs text-[#A8B9A5] flex items-center justify-between">
            <span>Potential repeat purchases</span>
            <ArrowRight className="w-3.5 h-3.5 opacity-0 group-hover:opacity-100 transition-opacity text-[#D8B56D]" />
          </p>
        </div>

        {/* Metric 4: Shopping List */}
        <div 
          onClick={() => setTab('shopping-list')}
          className="parchment-card p-5 rounded-xl cursor-pointer hover:border-[#D8B56D]/50 transition-all group"
        >
          <div className="flex items-center justify-between mb-3">
            <span className="text-xs uppercase font-semibold tracking-wider text-[#A8B9A5]">Shopping List</span>
            <div className="p-2 rounded-lg bg-[#17251F] text-[#D8B56D] border border-[#D8B56D]/20 group-hover:scale-105 transition-transform">
              <ShoppingCart className="w-5 h-5" />
            </div>
          </div>
          <div className="font-enchanted text-3xl font-bold text-[#F3E8D0] mb-1">
            {shopping_list_count}
          </div>
          <p className="text-xs text-[#A8B9A5] flex items-center justify-between">
            <span>Pending items to acquire</span>
            <ArrowRight className="w-3.5 h-3.5 opacity-0 group-hover:opacity-100 transition-opacity text-[#D8B56D]" />
          </p>
        </div>
      </div>

      {/* ========================================================================= */}
      {/* MAIN GRID: IMMEDIATE ATTENTION QUEUE & OUTCOMES SUMMARY                   */}
      {/* ========================================================================= */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left Column: Use First Queue (2 cols on large) */}
        <div className="lg:col-span-2 space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Hourglass className="w-5 h-5 text-[#D8B56D]" />
              <h2 className="font-enchanted text-lg font-bold text-[#F3E8D0]">
                Immediate Attention (Use First)
              </h2>
            </div>
            <button
              onClick={() => setTab('use-first')}
              className="text-xs font-semibold text-[#D8B56D] hover:underline flex items-center gap-1 cursor-pointer"
            >
              <span>View Full Prioritization Queue</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
          </div>

          {urgent_recommendations.length === 0 ? (
            <div className="parchment-card rounded-xl p-8 text-center space-y-3">
              <div className="w-12 h-12 mx-auto rounded-full bg-[#17251F] border border-[#D8B56D]/30 flex items-center justify-center text-[#D8B56D]">
                <Sparkles className="w-6 h-6" />
              </div>
              <p className="font-enchanted text-base text-[#F3E8D0]">No urgent food items requiring review</p>
              <p className="text-xs text-[#A8B9A5] max-w-sm mx-auto">
                All items are within comfortable recorded horizons or missing date tags.
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              {urgent_recommendations.map((rec) => (
                <div
                  key={rec.item_id}
                  className="parchment-card rounded-xl p-4 border-l-4 border-l-[#D8B56D] flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4"
                >
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <span className="font-bold text-[#F3E8D0] text-sm sm:text-base">{rec.name}</span>
                      <span className="text-[10px] uppercase font-bold px-2 py-0.5 rounded bg-[#111620] border border-[#D8B56D]/30 text-[#D8B56D]">
                        {rec.category}
                      </span>
                      <span className={`text-[10px] font-bold px-2 py-0.5 rounded ${
                        rec.urgency_tier === 'URGENT' 
                          ? 'bg-[#5B1F32] text-red-200 border border-red-500/30' 
                          : 'bg-[#D8B56D]/20 text-[#D8B56D] border border-[#D8B56D]/30'
                      }`}>
                        {rec.urgency_tier}
                      </span>
                    </div>

                    <p className="text-xs text-[#A8B9A5] flex items-center gap-1">
                      <span className="text-[#D8B56D] font-medium">Why it appears:</span> {rec.explanation}
                    </p>
                  </div>

                  <button
                    onClick={() => onOpenOutcome({ id: rec.item_id, name: rec.name, quantity: rec.quantity, unit: rec.unit })}
                    className="px-3.5 py-1.5 text-xs font-semibold rounded-lg bg-[#17251F] hover:bg-[#D8B56D] hover:text-[#171D2B] text-[#D8B56D] border border-[#D8B56D]/40 transition-all shrink-0 cursor-pointer"
                  >
                    Record Outcome
                  </button>
                </div>
              ))}
            </div>
          )}

          {/* Duplicate Purchase Warnings Banner if any */}
          {duplicate_warnings.length > 0 && (
            <div className="p-4 rounded-xl bg-[#5B1F32]/25 border border-[#D8B56D]/40 space-y-2">
              <div className="flex items-center gap-2 text-[#D8B56D]">
                <AlertTriangle className="w-4 h-4" />
                <span className="text-xs font-bold uppercase tracking-wider font-enchanted">
                  Duplicate Groceries Alert
                </span>
              </div>
              <ul className="text-xs text-[#F3E8D0] space-y-1">
                {duplicate_warnings.map((warn, idx) => (
                  <li key={idx} className="flex items-center gap-1.5">
                    <span className="text-[#D8B56D]">•</span>
                    <span>
                      Shopping item <strong className="text-white">"{warn.shopping_item_name}"</strong> matches active inventory{' '}
                      <strong className="text-[#D8B56D]">"{warn.matched_item_name}"</strong> ({warn.existing_quantity} {warn.existing_unit}).
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>

        {/* Right Column: Outcomes & Household Metrics */}
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <TrendingUp className="w-5 h-5 text-[#D8B56D]" />
              <h2 className="font-enchanted text-lg font-bold text-[#F3E8D0]">
                Waste & Outcomes
              </h2>
            </div>
            <button
              onClick={() => setTab('outcomes')}
              className="text-xs font-semibold text-[#D8B56D] hover:underline cursor-pointer"
            >
              Full Logs
            </button>
          </div>

          <div className="parchment-card rounded-xl p-5 space-y-4">
            {/* Waste-to-Wealth Financial Engine Spotlight */}
            <div 
              onClick={() => setTab('waste-to-wealth')}
              className="p-4 rounded-xl bg-gradient-to-br from-red-950/40 via-[#171D2B] to-[#121720] border border-red-500/30 hover:border-red-400 cursor-pointer transition-all group"
            >
              <div className="flex items-center justify-between mb-1.5">
                <span className="text-[11px] font-bold uppercase tracking-wider text-rose-300 flex items-center gap-1.5 font-enchanted">
                  <Coins className="w-3.5 h-3.5 text-[#D8B56D]" />
                  <span>Waste-to-Wealth</span>
                </span>
                <span className="text-[10px] text-[#D8B56D] font-bold group-hover:translate-x-0.5 transition-transform flex items-center gap-0.5">
                  View Financial Engine →
                </span>
              </div>
              <div className="flex items-baseline gap-2">
                <span className="font-enchanted text-2xl font-extrabold text-[#EF4444]">
                  {outcomes_summary.currency_symbol || '₹'}{(outcomes_summary.total_waste_value || 0).toFixed(2)}
                </span>
                <span className="text-xs text-[#A8B9A5]">wasted this month</span>
              </div>
              <p className="text-[11px] text-[#A8B9A5] mt-1">
                Burn rate: {outcomes_summary.currency_symbol || '₹'}{(outcomes_summary.household_burn_rate || 0).toFixed(2)} / week. Tap to see savings.
              </p>
            </div>

            {/* Efficiency Ratio */}
            <div className="p-4 rounded-xl bg-[#111620] border border-[#D8B56D]/20">
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs font-semibold text-[#A8B9A5]">Waste Avoidance Rate</span>
                <span className="text-sm font-bold text-[#D8B56D]">
                  {outcomes_summary.waste_avoidance_rate}%
                </span>
              </div>
              <div className="w-full bg-[#171D2B] h-2.5 rounded-full overflow-hidden border border-[#D8B56D]/20">
                <div
                  className="bg-gradient-to-r from-[#D8B56D] to-emerald-400 h-full rounded-full transition-all duration-500"
                  style={{ width: `${Math.min(100, Math.max(0, outcomes_summary.waste_avoidance_rate))}%` }}
                />
              </div>
              <p className="text-[11px] text-[#A8B9A5] mt-2">
                Derived from {outcomes_summary.total || 0} explicitly recorded household outcomes.
              </p>
            </div>

            {/* Counts Breakdown */}
            <div className="grid grid-cols-3 gap-2 text-center">
              <div className="p-3 rounded-lg bg-[#17251F] border border-[#D8B56D]/20">
                <Utensils className="w-4 h-4 mx-auto mb-1 text-[#D8B56D]" />
                <div className="font-bold text-[#F3E8D0] text-base">{outcomes_summary.consumed}</div>
                <div className="text-[10px] text-[#A8B9A5] uppercase font-semibold">Consumed</div>
              </div>
              <div className="p-3 rounded-lg bg-[#5B1F32]/50 border border-red-500/30">
                <Trash2 className="w-4 h-4 mx-auto mb-1 text-red-300" />
                <div className="font-bold text-red-200 text-base">{outcomes_summary.discarded}</div>
                <div className="text-[10px] text-red-300 uppercase font-semibold">Discarded</div>
              </div>
              <div className="p-3 rounded-lg bg-[#17251F] border border-[#A8B9A5]/30">
                <Gift className="w-4 h-4 mx-auto mb-1 text-[#A8B9A5]" />
                <div className="font-bold text-[#F3E8D0] text-base">{outcomes_summary.donated}</div>
                <div className="text-[10px] text-[#A8B9A5] uppercase font-semibold">Donated</div>
              </div>
            </div>

            {/* Recent Outcomes Stream */}
            <div className="pt-2">
              <span className="text-xs uppercase font-semibold text-[#D8B56D] block mb-2 font-enchanted">
                Recent Food Log
              </span>
              {recent_outcomes.length === 0 ? (
                <p className="text-xs text-[#A8B9A5] italic">No outcomes recorded yet.</p>
              ) : (
                <div className="space-y-2">
                  {recent_outcomes.map((item) => (
                    <div
                      key={item.id}
                      className="p-2.5 rounded-lg bg-[#111620] border border-[#D8B56D]/15 flex items-center justify-between text-xs"
                    >
                      <div className="space-y-0.5">
                        <span className="font-semibold text-[#F3E8D0]">{item.item_name}</span>
                        <p className="text-[10px] text-[#A8B9A5]">{item.reason || item.outcome_type}</p>
                      </div>
                      <span className={`text-[10px] font-bold px-2 py-0.5 rounded capitalize ${
                        item.outcome_type === 'consumed'
                          ? 'bg-[#17251F] text-[#D8B56D] border border-[#D8B56D]/30'
                          : item.outcome_type === 'discarded'
                          ? 'bg-[#5B1F32] text-red-200 border border-red-400/30'
                          : 'bg-[#17251F] text-[#A8B9A5]'
                      }`}>
                        {item.outcome_type}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Live Product Expiry Scanner Modal (Tesseract.js OCR) */}
      <ProductScanner
        isOpen={isExpiryScannerOpen}
        onClose={() => setIsExpiryScannerOpen(false)}
        onExpiryDetected={(date, meta) => {
          setScannedExpiryDate(date);
          const scannedName = meta?.name || '';
          if (showToast) {
            showToast(
              scannedName 
                ? `Scanned: ${scannedName} (Exp: ${date || 'No Date'})` 
                : `Product expiry date captured: ${date}`, 
              'success'
            );
          }
          if (candidates.length > 0) {
            setCandidates((prev) =>
              prev.map((c) => (c.selected ? { 
                ...c, 
                name: scannedName && (!c.name || c.name === 'Item') ? scannedName : c.name,
                expiry_date: date || c.expiry_date 
              } : c))
            );
            if (showToast) {
              showToast(`Applied package details to selected candidate item(s).`, 'success');
            }
          } else if (onOpenAddItem) {
            onOpenAddItem({
              name: scannedName,
              expiry_date: date,
              notes: meta?.wasManuallyCompleted 
                ? 'Scanned via camera OCR (Manually verified).' 
                : 'Scanned via camera OCR.'
            });
          }
        }}
        showToast={showToast}
      />
    </div>
  );
}
