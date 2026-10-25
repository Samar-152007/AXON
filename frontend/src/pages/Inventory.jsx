import React, { useState, useEffect } from 'react';
import { 
  Package, 
  Search, 
  Plus, 
  Edit3, 
  Trash2, 
  Utensils, 
  Filter, 
  Calendar, 
  AlertCircle,
  Tag,
  Sparkles,
  RefreshCw
} from 'lucide-react';
import { api } from '../api';

const CATEGORIES = [
  'All',
  'Vegetables',
  'Fruits',
  'Dairy',
  'Grains',
  'Pantry',
  'Bakery',
  'Frozen',
  'Meat & Seafood',
  'Beverages',
  'Other'
];

export default function Inventory({ onOpenAddItem, onEditItem, onOpenOutcome, showToast, refreshTrigger }) {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('All');
  const [statusFilter, setStatusFilter] = useState('active');
  const [deletingId, setDeletingId] = useState(null);

  const fetchItems = async () => {
    try {
      setLoading(true);
      const res = await api.getItems({
        category: selectedCategory,
        status: statusFilter,
        search: search.trim()
      });
      setItems(res);
    } catch (err) {
      showToast('Error loading inventory: ' + err.message, 'error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchItems();
  }, [selectedCategory, statusFilter, refreshTrigger]);

  const handleSearchSubmit = (e) => {
    e.preventDefault();
    fetchItems();
  };

  const handleDelete = async (item) => {
    if (!confirm(`Are you sure you want to delete "${item.name}" from inventory?`)) return;
    try {
      setDeletingId(item.id);
      await api.deleteItem(item.id);
      showToast(`Deleted "${item.name}" from inventory.`, 'info');
      fetchItems();
    } catch (err) {
      showToast('Failed to delete item: ' + err.message, 'error');
    } finally {
      setDeletingId(null);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header and Controls */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <Package className="w-6 h-6 text-[#D8B56D]" />
            <h1 className="font-enchanted text-2xl font-bold text-[#F3E8D0]">
              Pantry Inventory
            </h1>
          </div>
          <p className="text-xs text-[#A8B9A5]">
            Manage all active groceries, check recorded dates, and update food stock.
          </p>
        </div>

        <button
          onClick={onOpenAddItem}
          className="px-4 py-2 bg-gradient-to-r from-[#D8B56D] to-[#ECC880] text-[#171D2B] text-xs sm:text-sm font-bold rounded-lg shadow-md hover:brightness-110 transition-all cursor-pointer flex items-center gap-2 shrink-0 self-start sm:self-auto"
        >
          <Plus className="w-4 h-4 stroke-[2.5]" />
          <span>Add Grocery Item</span>
        </button>
      </div>

      {/* Filter Bar & Search */}
      <div className="parchment-card p-4 rounded-xl space-y-3">
        <div className="flex flex-col md:flex-row gap-3">
          {/* Search Box */}
          <form onSubmit={handleSearchSubmit} className="relative flex-1">
            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-[#A8B9A5]" />
            <input
              type="text"
              placeholder="Search by grocery name or notes (Press Enter)..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-9 pr-4 py-2 rounded-lg bg-[#111620] border border-[#D8B56D]/30 text-[#F3E8D0] placeholder-[#A8B9A5]/50 text-xs sm:text-sm focus:outline-none focus:border-[#D8B56D]"
            />
          </form>

          {/* Status Filter */}
          <div className="flex items-center gap-2">
            <span className="text-xs text-[#A8B9A5] hidden sm:inline">Status:</span>
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="px-3 py-2 rounded-lg bg-[#111620] border border-[#D8B56D]/30 text-[#F3E8D0] text-xs sm:text-sm focus:outline-none focus:border-[#D8B56D]"
            >
              <option value="active">Active Only</option>
              <option value="consumed">Consumed</option>
              <option value="discarded">Discarded</option>
              <option value="donated">Donated</option>
              <option value="all">All Records</option>
            </select>
          </div>
        </div>

        {/* Category Pills */}
        <div className="flex items-center gap-1.5 overflow-x-auto pb-1 pt-1 no-scrollbar">
          {CATEGORIES.map((cat) => (
            <button
              key={cat}
              onClick={() => setSelectedCategory(cat)}
              className={`px-3 py-1 rounded-full text-xs font-medium whitespace-nowrap transition-colors cursor-pointer ${
                selectedCategory === cat
                  ? 'bg-[#D8B56D] text-[#171D2B] font-bold shadow-sm'
                  : 'bg-[#111620] text-[#A8B9A5] border border-[#D8B56D]/20 hover:text-[#F3E8D0] hover:border-[#D8B56D]/40'
              }`}
            >
              {cat}
            </button>
          ))}
        </div>
      </div>

      {/* Inventory Items List / Table */}
      {loading ? (
        <div className="flex items-center justify-center p-12 text-[#A8B9A5]">
          <RefreshCw className="w-6 h-6 animate-spin text-[#D8B56D] mr-2" />
          <span className="text-sm">Fetching inventory...</span>
        </div>
      ) : items.length === 0 ? (
        <div className="parchment-card rounded-2xl p-12 text-center space-y-4">
          <div className="w-16 h-16 mx-auto rounded-full bg-[#17251F] border border-[#D8B56D]/30 flex items-center justify-center text-[#D8B56D]">
            <Package className="w-8 h-8" />
          </div>
          <div>
            <h3 className="font-enchanted text-lg font-bold text-[#F3E8D0]">No Grocery Items Found</h3>
            <p className="text-xs text-[#A8B9A5] max-w-sm mx-auto mt-1">
              {search || selectedCategory !== 'All' || statusFilter !== 'active'
                ? 'No items matched your active search or filters. Try resetting filters.'
                : 'Your pantry is currently empty. Add your first item to begin tracking.'}
            </p>
          </div>
          <button
            onClick={onOpenAddItem}
            className="px-4 py-2 bg-[#D8B56D] text-[#171D2B] text-xs font-bold rounded-lg hover:brightness-110 transition-all cursor-pointer inline-flex items-center gap-1.5"
          >
            <Plus className="w-4 h-4" />
            <span>Add Item Now</span>
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {items.map((item) => {
            const hasExpiry = Boolean(item.expiry_date);
            return (
              <div
                key={item.id}
                className="parchment-card rounded-xl p-4 flex flex-col justify-between space-y-3 hover:border-[#D8B56D]/50 transition-all"
              >
                <div>
                  {/* Top Bar: Category & Sample Badge */}
                  <div className="flex items-center justify-between gap-2 mb-2">
                    <span className="text-[10px] uppercase font-bold tracking-wider px-2 py-0.5 rounded bg-[#111620] border border-[#D8B56D]/30 text-[#D8B56D]">
                      {item.category}
                    </span>

                    <div className="flex items-center gap-1">
                      {item.is_sample && (
                        <span className="text-[9px] uppercase font-bold px-1.5 py-0.5 rounded bg-[#D8B56D]/15 border border-[#D8B56D]/30 text-[#D8B56D]">
                          Sample
                        </span>
                      )}
                      <span className={`text-[10px] font-semibold px-2 py-0.5 rounded capitalize ${
                        item.status === 'active'
                          ? 'bg-[#17251F] text-emerald-400 border border-emerald-500/20'
                          : 'bg-[#5B1F32] text-rose-300'
                      }`}>
                        {item.status}
                      </span>
                    </div>
                  </div>

                  {/* Name & Quantity */}
                  <div className="flex items-baseline justify-between gap-2">
                    <h3 className="font-bold text-[#F3E8D0] text-base group-hover:text-[#D8B56D]">
                      {item.name}
                    </h3>
                    <span className="font-semibold text-sm text-[#D8B56D] shrink-0">
                      {item.quantity} {item.unit}
                    </span>
                  </div>

                  {/* Date details */}
                  <div className="mt-2 space-y-1 text-xs text-[#A8B9A5]">
                    <div className="flex items-center gap-1.5">
                      <Calendar className="w-3.5 h-3.5 text-[#D8B56D]/70 shrink-0" />
                      {hasExpiry ? (
                        <span>
                          Best-before: <strong className="text-[#F3E8D0]">{item.expiry_date}</strong>
                        </span>
                      ) : (
                        <span className="text-amber-200/80 italic">
                          No best-before date recorded
                        </span>
                      )}
                    </div>
                    {item.price && (
                      <div className="text-[11px] text-[#A8B9A5]">
                        Price: ${item.price.toFixed(2)}
                      </div>
                    )}
                    {item.notes && (
                      <p className="text-[11px] text-[#A8B9A5]/80 italic line-clamp-1">
                        "{item.notes}"
                      </p>
                    )}
                  </div>
                </div>

                {/* Card Actions */}
                <div className="pt-3 border-t border-[#D8B56D]/15 flex items-center justify-between gap-2">
                  {item.status === 'active' ? (
                    <button
                      onClick={() => onOpenOutcome(item)}
                      className="px-2.5 py-1 text-xs font-semibold rounded bg-[#17251F] hover:bg-[#D8B56D] hover:text-[#171D2B] text-[#D8B56D] border border-[#D8B56D]/30 transition-all flex items-center gap-1 cursor-pointer"
                    >
                      <Utensils className="w-3.5 h-3.5" />
                      <span>Log Outcome</span>
                    </button>
                  ) : (
                    <span className="text-[11px] text-[#A8B9A5] italic">Outcome logged</span>
                  )}

                  <div className="flex items-center gap-1">
                    <button
                      onClick={() => onEditItem(item)}
                      className="p-1.5 text-[#A8B9A5] hover:text-[#F3E8D0] rounded hover:bg-[#111620] transition-colors cursor-pointer"
                      title="Edit item"
                    >
                      <Edit3 className="w-4 h-4" />
                    </button>
                    <button
                      onClick={() => handleDelete(item)}
                      disabled={deletingId === item.id}
                      className="p-1.5 text-[#A8B9A5] hover:text-red-400 rounded hover:bg-[#111620] transition-colors cursor-pointer"
                      title="Delete item"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
