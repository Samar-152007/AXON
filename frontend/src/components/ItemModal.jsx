import React, { useState, useEffect } from 'react';
import { X, AlertCircle, Sparkles, Check, HelpCircle } from 'lucide-react';
import { api } from '../api';

const CATEGORIES = [
  'Vegetables',
  'Fruits',
  'Dairy',
  'Grains',
  'Pantry',
  'Bakery',
  'Frozen',
  'Meat & Seafood',
  'Beverages',
  'Snacks',
  'Other'
];

const UNITS = ['units', 'bunches', 'kg', 'g', 'lbs', 'oz', 'gallons', 'liters', 'ml', 'boxes', 'cans', 'tubs', 'loaves', 'bags'];

export default function ItemModal({ isOpen, onClose, onSave, itemToEdit = null }) {
  const isEdit = Boolean(itemToEdit && itemToEdit.id);

  const getTodayISO = () => new Date().toISOString().split('T')[0];

  const [formData, setFormData] = useState({
    name: '',
    quantity: 1,
    unit: 'units',
    category: 'Vegetables',
    purchase_date: getTodayISO(),
    expiry_date: '',
    hasNoExpiry: false,
    price: '',
    notes: ''
  });

  const [duplicateWarning, setDuplicateWarning] = useState(null);
  const [checkingDuplicate, setCheckingDuplicate] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (itemToEdit) {
      setFormData({
        name: itemToEdit.name || '',
        quantity: itemToEdit.quantity || 1,
        unit: itemToEdit.unit || 'units',
        category: itemToEdit.category || 'Other',
        purchase_date: itemToEdit.purchase_date || getTodayISO(),
        expiry_date: itemToEdit.expiry_date || '',
        hasNoExpiry: !itemToEdit.expiry_date,
        price: itemToEdit.price !== null && itemToEdit.price !== undefined ? itemToEdit.price : '',
        notes: itemToEdit.notes || ''
      });
      setDuplicateWarning(null);
    } else {
      setFormData({
        name: '',
        quantity: 1,
        unit: 'units',
        category: 'Vegetables',
        purchase_date: getTodayISO(),
        expiry_date: '',
        hasNoExpiry: false,
        price: '',
        notes: ''
      });
      setDuplicateWarning(null);
    }
    setErrorMsg('');
  }, [itemToEdit, isOpen]);

  // Debounced duplicate detection as user types
  useEffect(() => {
    if (isEdit || !formData.name.trim() || formData.name.trim().length < 2) {
      setDuplicateWarning(null);
      return;
    }

    const timer = setTimeout(async () => {
      try {
        setCheckingDuplicate(true);
        const match = await api.checkDuplicate(formData.name.trim());
        if (match && match.is_duplicate) {
          setDuplicateWarning(match);
        } else {
          setDuplicateWarning(null);
        }
      } catch (err) {
        console.error('Duplicate check error:', err);
      } finally {
        setCheckingDuplicate(false);
      }
    }, 400);

    return () => clearTimeout(timer);
  }, [formData.name, isEdit]);

  if (!isOpen) return null;

  const handleSubmit = async (e) => {
    e.preventDefault();
    setErrorMsg('');

    if (!formData.name.trim()) {
      setErrorMsg('Item name is required.');
      return;
    }

    const qty = parseFloat(formData.quantity);
    if (isNaN(qty) || qty <= 0) {
      setErrorMsg('Quantity must be greater than 0.');
      return;
    }

    let parsedPrice = null;
    if (formData.price !== '' && formData.price !== null) {
      parsedPrice = parseFloat(formData.price);
      if (isNaN(parsedPrice) || parsedPrice < 0) {
        setErrorMsg('Price cannot be negative.');
        return;
      }
    }

    const payload = {
      name: formData.name.trim(),
      quantity: qty,
      unit: formData.unit,
      category: formData.category,
      purchase_date: formData.purchase_date,
      expiry_date: formData.hasNoExpiry ? null : (formData.expiry_date || null),
      unit_price: parsedPrice,
      price: parsedPrice,
      notes: formData.notes.trim()
    };

    try {
      setSaving(true);
      await onSave(payload, itemToEdit?.id);
      onClose();
    } catch (err) {
      setErrorMsg(err.message || 'Failed to save item');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm overflow-y-auto">
      <div className="relative w-full max-w-lg bg-[#171D2B] border border-[#D8B56D]/40 rounded-2xl shadow-2xl overflow-hidden my-8">
        {/* Header */}
        <div className="px-6 py-4 border-b border-[#D8B56D]/20 bg-gradient-to-r from-[#17251F] to-[#171D2B] flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Sparkles className="w-5 h-5 text-[#D8B56D]" />
            <h3 className="font-enchanted font-bold text-lg text-[#F3E8D0]">
              {isEdit ? 'Edit Grocery Item' : 'Add New Grocery Item'}
            </h3>
          </div>
          <button
            onClick={onClose}
            className="text-[#A8B9A5] hover:text-[#F3E8D0] p-1 rounded-lg hover:bg-white/5 transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Form Body */}
        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          {errorMsg && (
            <div className="p-3 rounded-lg bg-[#5B1F32]/60 border border-red-500/40 text-red-200 text-xs flex items-center gap-2">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{errorMsg}</span>
            </div>
          )}

          {/* Name Field */}
          <div>
            <label className="block text-xs font-semibold uppercase tracking-wider text-[#D8B56D] mb-1">
              Item Name *
            </label>
            <input
              type="text"
              required
              placeholder="e.g. Baby Spinach, Whole Milk, Fuji Apples"
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              className="w-full px-3.5 py-2.5 rounded-lg bg-[#111620] border border-[#D8B56D]/30 text-[#F3E8D0] placeholder-[#A8B9A5]/50 focus:outline-none focus:border-[#D8B56D] text-sm"
            />
          </div>

          {/* Duplicate Detection Warning */}
          {duplicateWarning && (
            <div className="p-3 rounded-lg bg-[#5B1F32]/30 border border-[#D8B56D]/50 text-xs text-[#F3E8D0] flex items-start gap-2.5 animate-fadeIn">
              <AlertCircle className="w-4 h-4 text-[#D8B56D] shrink-0 mt-0.5" />
              <div>
                <span className="font-bold text-[#D8B56D]">Possible Duplicate Detected: </span>
                <span>{duplicateWarning.message}</span>
              </div>
            </div>
          )}

          {/* Quantity & Unit */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider text-[#D8B56D] mb-1">
                Quantity *
              </label>
              <input
                type="number"
                step="any"
                min="0.01"
                required
                value={formData.quantity}
                onChange={(e) => setFormData({ ...formData, quantity: e.target.value })}
                className="w-full px-3 py-2 rounded-lg bg-[#111620] border border-[#D8B56D]/30 text-[#F3E8D0] text-sm focus:outline-none focus:border-[#D8B56D]"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider text-[#D8B56D] mb-1">
                Unit
              </label>
              <select
                value={formData.unit}
                onChange={(e) => setFormData({ ...formData, unit: e.target.value })}
                className="w-full px-3 py-2 rounded-lg bg-[#111620] border border-[#D8B56D]/30 text-[#F3E8D0] text-sm focus:outline-none focus:border-[#D8B56D]"
              >
                {UNITS.map((u) => (
                  <option key={u} value={u} className="bg-[#171D2B]">
                    {u}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Category */}
          <div>
            <label className="block text-xs font-semibold uppercase tracking-wider text-[#D8B56D] mb-1">
              Category
            </label>
            <select
              value={formData.category}
              onChange={(e) => setFormData({ ...formData, category: e.target.value })}
              className="w-full px-3 py-2 rounded-lg bg-[#111620] border border-[#D8B56D]/30 text-[#F3E8D0] text-sm focus:outline-none focus:border-[#D8B56D]"
            >
              {CATEGORIES.map((cat) => (
                <option key={cat} value={cat} className="bg-[#171D2B]">
                  {cat}
                </option>
              ))}
            </select>
          </div>

          {/* Dates: Purchase Date & Best-Before Date */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider text-[#D8B56D] mb-1">
                Purchase Date
              </label>
              <input
                type="date"
                required
                value={formData.purchase_date}
                onChange={(e) => setFormData({ ...formData, purchase_date: e.target.value })}
                className="w-full px-3 py-2 rounded-lg bg-[#111620] border border-[#D8B56D]/30 text-[#F3E8D0] text-sm focus:outline-none focus:border-[#D8B56D]"
              />
            </div>

            <div>
              <div className="flex items-center justify-between mb-1">
                <label className="text-xs font-semibold uppercase tracking-wider text-[#D8B56D]">
                  Best-Before Date
                </label>
                <label className="text-[11px] text-[#A8B9A5] flex items-center gap-1 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={formData.hasNoExpiry}
                    onChange={(e) =>
                      setFormData({
                        ...formData,
                        hasNoExpiry: e.target.checked,
                        expiry_date: e.target.checked ? '' : formData.expiry_date
                      })
                    }
                    className="rounded border-[#D8B56D]/40 text-[#D8B56D] focus:ring-0"
                  />
                  <span>No date recorded</span>
                </label>
              </div>
              <input
                type="date"
                disabled={formData.hasNoExpiry}
                value={formData.expiry_date}
                onChange={(e) => setFormData({ ...formData, expiry_date: e.target.value })}
                className={`w-full px-3 py-2 rounded-lg bg-[#111620] border border-[#D8B56D]/30 text-[#F3E8D0] text-sm focus:outline-none focus:border-[#D8B56D] ${
                  formData.hasNoExpiry ? 'opacity-40 cursor-not-allowed bg-black/40' : ''
                }`}
              />
            </div>
          </div>

          {/* Price & Notes */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider text-[#D8B56D] mb-1">
                Unit Price (₹) <span className="text-[10px] lowercase text-[#A8B9A5]">(optional)</span>
              </label>
              <input
                type="number"
                step="0.01"
                min="0"
                placeholder="0.00"
                value={formData.price}
                onChange={(e) => setFormData({ ...formData, price: e.target.value })}
                className="w-full px-3 py-2 rounded-lg bg-[#111620] border border-[#D8B56D]/30 text-[#F3E8D0] text-sm focus:outline-none focus:border-[#D8B56D]"
              />
            </div>
            <div className="sm:col-span-2">
              <label className="block text-xs font-semibold uppercase tracking-wider text-[#D8B56D] mb-1">
                Notes <span className="text-[10px] lowercase text-[#A8B9A5]">(optional)</span>
              </label>
              <input
                type="text"
                placeholder="e.g. In crisper drawer, sealed"
                value={formData.notes}
                onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                className="w-full px-3 py-2 rounded-lg bg-[#111620] border border-[#D8B56D]/30 text-[#F3E8D0] text-sm focus:outline-none focus:border-[#D8B56D]"
              />
            </div>
          </div>

          {/* Buttons */}
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
              disabled={saving}
              className="px-5 py-2 text-sm font-semibold rounded-lg bg-gradient-to-r from-[#D8B56D] to-[#ECC880] text-[#171D2B] hover:brightness-110 transition-all shadow-md shadow-[#D8B56D]/20 flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
            >
              {saving ? 'Saving...' : isEdit ? 'Save Changes' : 'Add to Inventory'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
