import React, { useState, useEffect } from 'react';
import { 
  ShoppingCart, 
  Plus, 
  Trash2, 
  CheckCircle2, 
  Circle, 
  AlertTriangle, 
  ArrowRight,
  PackagePlus,
  RefreshCw,
  Sparkles
} from 'lucide-react';
import { api } from '../api';

const UNITS = ['units', 'bunches', 'kg', 'g', 'lbs', 'oz', 'gallons', 'liters', 'ml', 'boxes', 'cans', 'tubs', 'loaves', 'bags'];
const CATEGORIES = ['Vegetables', 'Fruits', 'Dairy', 'Grains', 'Pantry', 'Bakery', 'Frozen', 'Meat & Seafood', 'Beverages', 'Other'];

export default function ShoppingList({ showToast, onDataRefresh }) {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);

  // New item form state
  const [name, setName] = useState('');
  const [quantity, setQuantity] = useState(1);
  const [unit, setUnit] = useState('units');
  const [category, setCategory] = useState('Vegetables');
  const [notes, setNotes] = useState('');
  const [duplicateWarning, setDuplicateWarning] = useState(null);
  const [adding, setAdding] = useState(false);

  const fetchShoppingList = async () => {
    try {
      setLoading(true);
      const res = await api.getShoppingList();
      setItems(res);
    } catch (err) {
      showToast('Error loading shopping list: ' + err.message, 'error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchShoppingList();
  }, [onDataRefresh]);

  // Real-time duplicate check as user types
  useEffect(() => {
    if (!name.trim() || name.trim().length < 2) {
      setDuplicateWarning(null);
      return;
    }

    const timer = setTimeout(async () => {
      try {
        const match = await api.checkDuplicate(name.trim());
        if (match && match.is_duplicate) {
          setDuplicateWarning(match);
        } else {
          setDuplicateWarning(null);
        }
      } catch (err) {
        console.error('Error during duplicate check:', err);
      }
    }, 350);

    return () => clearTimeout(timer);
  }, [name]);

  const handleAddItem = async (e) => {
    e.preventDefault();
    if (!name.trim()) return;

    try {
      setAdding(true);
      await api.addShoppingItem({
        name: name.trim(),
        quantity: parseFloat(quantity) || 1,
        unit,
        category,
        notes: notes.trim()
      });
      showToast(`Added "${name.trim()}" to shopping list.`, 'success');
      setName('');
      setQuantity(1);
      setNotes('');
      setDuplicateWarning(null);
      fetchShoppingList();
    } catch (err) {
      showToast('Failed to add shopping item: ' + err.message, 'error');
    } finally {
      setAdding(false);
    }
  };

  const handleTogglePurchased = async (item) => {
    try {
      await api.updateShoppingItem(item.id, {
        is_purchased: !item.is_purchased
      });
      fetchShoppingList();
    } catch (err) {
      showToast('Failed to update status: ' + err.message, 'error');
    }
  };

  const handleDelete = async (item) => {
    try {
      await api.deleteShoppingItem(item.id);
      showToast(`Removed "${item.name}" from shopping list.`, 'info');
      fetchShoppingList();
    } catch (err) {
      showToast('Failed to remove item: ' + err.message, 'error');
    }
  };

  const handleConvertToInventory = async (item) => {
    try {
      const res = await api.convertToInventory(item.id);
      showToast(res.message, 'success');
      fetchShoppingList();
    } catch (err) {
      showToast('Failed to convert to inventory: ' + err.message, 'error');
    }
  };

  const pendingItems = items.filter((i) => !i.is_purchased);
  const purchasedItems = items.filter((i) => i.is_purchased);

  return (
    <div className="space-y-6">
      {/* Title */}
      <div>
        <div className="flex items-center gap-2">
          <ShoppingCart className="w-6 h-6 text-[#D8B56D]" />
          <h1 className="font-enchanted text-2xl font-bold text-[#F3E8D0]">
            Smart Shopping List
          </h1>
        </div>
        <p className="text-xs text-[#A8B9A5] mt-1">
          Plan upcoming groceries with real-time duplicate checks against what's already in your pantry.
        </p>
      </div>

      {/* Add New Shopping Item Box */}
      <div className="parchment-card p-5 rounded-2xl space-y-4">
        <div className="flex items-center gap-2 text-xs uppercase tracking-wider text-[#D8B56D] font-bold font-enchanted">
          <Sparkles className="w-4 h-4" />
          <span>Add Item to Shopping List</span>
        </div>

        <form onSubmit={handleAddItem} className="space-y-3">
          <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
            <div className="sm:col-span-2">
              <input
                type="text"
                required
                placeholder="Item name (e.g. Spinach, Oat Milk)..."
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="w-full px-3.5 py-2.5 rounded-lg bg-[#111620] border border-[#D8B56D]/30 text-[#F3E8D0] placeholder-[#A8B9A5]/50 text-sm focus:outline-none focus:border-[#D8B56D]"
              />
            </div>
            <div>
              <div className="flex gap-2">
                <input
                  type="number"
                  step="any"
                  min="0.1"
                  required
                  value={quantity}
                  onChange={(e) => setQuantity(e.target.value)}
                  className="w-20 px-3 py-2 rounded-lg bg-[#111620] border border-[#D8B56D]/30 text-[#F3E8D0] text-sm focus:outline-none focus:border-[#D8B56D]"
                />
                <select
                  value={unit}
                  onChange={(e) => setUnit(e.target.value)}
                  className="flex-1 px-2 py-2 rounded-lg bg-[#111620] border border-[#D8B56D]/30 text-[#F3E8D0] text-sm focus:outline-none focus:border-[#D8B56D]"
                >
                  {UNITS.map((u) => (
                    <option key={u} value={u} className="bg-[#171D2B]">
                      {u}
                    </option>
                  ))}
                </select>
              </div>
            </div>
            <div>
              <button
                type="submit"
                disabled={adding}
                className="w-full py-2.5 px-4 bg-gradient-to-r from-[#D8B56D] to-[#ECC880] text-[#171D2B] text-sm font-bold rounded-lg shadow-md hover:brightness-110 transition-all flex items-center justify-center gap-1.5 cursor-pointer disabled:opacity-50"
              >
                <Plus className="w-4 h-4 stroke-[2.5]" />
                <span>{adding ? 'Adding...' : 'Add Item'}</span>
              </button>
            </div>
          </div>

          {/* Real-time Duplicate Detection Notice */}
          {duplicateWarning && (
            <div className="p-3.5 rounded-xl bg-[#5B1F32]/40 border border-[#D8B56D]/60 flex items-start gap-2.5 animate-fadeIn">
              <AlertTriangle className="w-5 h-5 text-[#D8B56D] shrink-0 mt-0.5" />
              <div className="text-xs">
                <p className="font-bold text-[#D8B56D]">Review Before Buying — Item Already in Stock!</p>
                <p className="text-[#F3E8D0] mt-0.5">{duplicateWarning.message}</p>
              </div>
            </div>
          )}
        </form>
      </div>

      {/* Shopping List Rows */}
      {loading ? (
        <div className="flex items-center justify-center p-12 text-[#A8B9A5]">
          <RefreshCw className="w-6 h-6 animate-spin text-[#D8B56D] mr-2" />
          <span className="text-sm">Retrieving shopping list...</span>
        </div>
      ) : items.length === 0 ? (
        <div className="parchment-card rounded-2xl p-12 text-center space-y-3">
          <ShoppingCart className="w-12 h-12 mx-auto text-[#D8B56D]" />
          <h3 className="font-enchanted text-lg font-bold text-[#F3E8D0]">Shopping List is Clear</h3>
          <p className="text-xs text-[#A8B9A5] max-w-sm mx-auto">
            You have no pending grocery items. Add essentials above to keep your household stocked.
          </p>
        </div>
      ) : (
        <div className="space-y-6">
          {/* Pending items */}
          <div className="space-y-3">
            <h2 className="text-xs uppercase font-bold tracking-wider text-[#D8B56D] font-enchanted">
              Items to Purchase ({pendingItems.length})
            </h2>

            {pendingItems.length === 0 ? (
              <p className="text-xs text-[#A8B9A5] italic">All items marked as purchased!</p>
            ) : (
              <div className="space-y-2.5">
                {pendingItems.map((item) => (
                  <div
                    key={item.id}
                    className="parchment-card rounded-xl p-4 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 hover:border-[#D8B56D]/40 transition-all"
                  >
                    <div className="flex items-start sm:items-center gap-3">
                      <button
                        onClick={() => handleTogglePurchased(item)}
                        className="text-[#A8B9A5] hover:text-[#D8B56D] p-1 cursor-pointer transition-colors mt-0.5 sm:mt-0"
                        title="Mark as purchased"
                      >
                        <Circle className="w-5 h-5" />
                      </button>

                      <div>
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="font-bold text-[#F3E8D0] text-sm sm:text-base">
                            {item.name}
                          </span>
                          <span className="text-xs font-semibold text-[#D8B56D]">
                            ({item.quantity} {item.unit})
                          </span>
                          <span className="text-[10px] uppercase font-bold px-2 py-0.5 rounded bg-[#111620] border border-[#D8B56D]/20 text-[#A8B9A5]">
                            {item.category}
                          </span>
                        </div>

                        {/* Duplicate Alert Chip if this item exists in inventory */}
                        {item.duplicate_warning && (
                          <div className="mt-1 inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded bg-[#5B1F32]/50 border border-[#D8B56D]/40 text-[11px] text-[#F3E8D0]">
                            <AlertTriangle className="w-3.5 h-3.5 text-[#D8B56D]" />
                            <span>
                              In inventory: {item.duplicate_warning.existing_quantity} {item.duplicate_warning.existing_unit}
                            </span>
                          </div>
                        )}
                      </div>
                    </div>

                    <div className="flex items-center gap-2 self-end sm:self-center">
                      <button
                        onClick={() => handleTogglePurchased(item)}
                        className="px-3 py-1.5 text-xs font-medium rounded-lg bg-[#111620] hover:bg-[#17251F] text-[#F3E8D0] border border-[#D8B56D]/30 transition-colors cursor-pointer"
                      >
                        Mark Bought
                      </button>
                      <button
                        onClick={() => handleDelete(item)}
                        className="p-1.5 text-[#A8B9A5] hover:text-red-400 rounded hover:bg-[#111620] transition-colors cursor-pointer"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Purchased Items section with "Convert to Inventory" button */}
          {purchasedItems.length > 0 && (
            <div className="space-y-3 pt-4 border-t border-[#D8B56D]/15">
              <h2 className="text-xs uppercase font-bold tracking-wider text-[#A8B9A5] font-enchanted">
                Purchased ({purchasedItems.length})
              </h2>
              <div className="space-y-2">
                {purchasedItems.map((item) => (
                  <div
                    key={item.id}
                    className="p-3.5 rounded-xl bg-[#111620]/60 border border-white/5 flex items-center justify-between gap-3 text-xs opacity-75 hover:opacity-100 transition-opacity"
                  >
                    <div className="flex items-center gap-3">
                      <button
                        onClick={() => handleTogglePurchased(item)}
                        className="text-emerald-400 p-0.5 cursor-pointer"
                        title="Mark unpurchased"
                      >
                        <CheckCircle2 className="w-5 h-5" />
                      </button>
                      <span className="line-through text-[#A8B9A5] font-medium text-sm">
                        {item.name} ({item.quantity} {item.unit})
                      </span>
                    </div>

                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => handleConvertToInventory(item)}
                        className="px-2.5 py-1 text-[11px] font-semibold rounded bg-[#17251F] hover:bg-[#D8B56D] hover:text-[#171D2B] text-[#D8B56D] border border-[#D8B56D]/30 transition-all flex items-center gap-1 cursor-pointer"
                        title="Save directly to active inventory"
                      >
                        <PackagePlus className="w-3.5 h-3.5" />
                        <span>Move to Inventory</span>
                      </button>
                      <button
                        onClick={() => handleDelete(item)}
                        className="p-1 text-[#A8B9A5] hover:text-red-400 cursor-pointer"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
