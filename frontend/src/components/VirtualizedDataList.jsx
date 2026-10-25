import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useVirtualizer } from '@tanstack/react-virtual';
import { 
  Database, 
  RefreshCw, 
  AlertCircle, 
  CheckCircle2, 
  Layers, 
  Sparkles, 
  ChevronRight,
  Radio,
  Zap
} from 'lucide-react';
import { supabase as defaultSupabaseClient } from '../supabaseClient';

/**
 * VirtualizedDataList
 * 
 * High-performance infinite scrolling React component using:
 * 1. @supabase/supabase-js with cursor pagination (.order('id', { ascending: true }).gt('id', lastSeenId).limit(50))
 * 2. @tanstack/react-virtual (useVirtualizer) for 60fps windowing on massive datasets
 * 3. Supabase Realtime WebSocket subscription listening strictly for INSERT events
 * 4. Functional state updates maintaining strict ID ascending sort order
 * 5. Memory cleanup with supabase.removeChannel(channel)
 * 6. Fallback UI with bottom loading spinner and empty/error states
 */
export default function VirtualizedDataList({
  tableName = 'items',
  supabase = defaultSupabaseClient,
  pageSize = 50,
  height = 500,
  renderItem,
  title = 'Supabase Virtualized Dataset'
}) {
  const [items, setItems] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isFetchingNextPage, setIsFetchingNextPage] = useState(false);
  const [hasMore, setHasMore] = useState(true);
  const [error, setError] = useState(null);

  // Realtime connection state
  const [isRealtimeActive, setIsRealtimeActive] = useState(false);
  const [realtimeInsertCount, setRealtimeInsertCount] = useState(0);

  // Parent ref for the scroll container
  const parentRef = useRef(null);

  // References to prevent stale closures and duplicate fetches during rapid scrolls
  const itemsRef = useRef(items);
  itemsRef.current = items;
  const isFetchingRef = useRef(false);

  /**
   * 1. Cursor Pagination Fetcher:
   * Orders by id ascending and uses .gt('id', lastSeenId) to fetch chunks of 50 rows.
   */
  const fetchChunk = useCallback(async (isInitial = false) => {
    if (isFetchingRef.current) return;
    if (!isInitial && !hasMore) return;

    isFetchingRef.current = true;
    if (isInitial) {
      setIsLoading(true);
    } else {
      setIsFetchingNextPage(true);
    }
    setError(null);

    try {
      const currentItems = isInitial ? [] : itemsRef.current;
      const lastItem = currentItems[currentItems.length - 1];
      const lastSeenId = lastItem ? lastItem.id : null;

      // Construct cursor pagination query
      let query = supabase
        .from(tableName)
        .select('*')
        .order('id', { ascending: true })
        .limit(pageSize);

      // Use .gt('id', lastSeenId) for cursor pagination
      if (lastSeenId !== null && lastSeenId !== undefined) {
        query = query.gt('id', lastSeenId);
      }

      const { data, error: queryError } = await query;

      if (queryError) {
        throw queryError;
      }

      const newRows = data || [];

      if (isInitial) {
        setItems(newRows);
      } else {
        setItems((prev) => {
          // Merge avoiding any duplicate IDs
          const existingIds = new Set(prev.map((i) => i.id));
          const filtered = newRows.filter((r) => !existingIds.has(r.id));
          const combined = [...prev, ...filtered];
          return combined.sort((a, b) => a.id - b.id);
        });
      }

      // If returned rows are fewer than requested pageSize, we reached the end
      setHasMore(newRows.length === pageSize);
    } catch (err) {
      console.warn('Supabase fetch error:', err);
      setError(err.message || 'Failed to fetch rows from local Supabase instance.');
    } finally {
      setIsLoading(false);
      setIsFetchingNextPage(false);
      isFetchingRef.current = false;
    }
  }, [supabase, tableName, pageSize, hasMore]);

  // Initial load
  useEffect(() => {
    fetchChunk(true);
  }, [tableName]);

  /**
   * 2. Supabase Realtime Subscription:
   * Listens strictly for INSERT events on the target table.
   * Uses functional state updates to append new rows maintaining ascending ID order.
   * Includes cleanup function calling supabase.removeChannel(channel).
   */
  useEffect(() => {
    if (!supabase) return;

    // Unique channel identifier
    const channelTopic = `realtime:${tableName}:${Date.now()}`;

    const channel = supabase
      .channel(channelTopic)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: tableName,
        },
        (payload) => {
          if (!payload?.new) return;
          const insertedRow = payload.new;

          // Safely update state using functional updater
          setItems((prev) => {
            // Guard against duplicate event delivery
            if (prev.some((row) => row.id === insertedRow.id)) {
              return prev;
            }

            // Append to the list (since items are sorted by ID ascending)
            const updated = [...prev, insertedRow];

            // Ensure strict ID ascending order
            return updated.sort((a, b) => a.id - b.id);
          });

          setRealtimeInsertCount((count) => count + 1);
        }
      )
      .subscribe((status, subscriptionError) => {
        if (status === 'SUBSCRIBED') {
          setIsRealtimeActive(true);
        } else if (status === 'CLOSED' || status === 'CHANNEL_ERROR') {
          setIsRealtimeActive(false);
        }

        if (subscriptionError) {
          console.warn('Supabase Realtime subscription error:', subscriptionError);
        }
      });

    // Memory Cleanup: Remove channel on unmount or when table/supabase client changes
    return () => {
      supabase.removeChannel(channel);
      setIsRealtimeActive(false);
    };
  }, [supabase, tableName]);

  /**
   * 3. Virtualizer Configuration:
   * Only renders visible DOM nodes within the 500px scrollable container.
   * If hasMore is true, count includes +1 row for the bottom loading spinner.
   */
  const rowVirtualizer = useVirtualizer({
    count: hasMore ? items.length + 1 : items.length,
    getScrollElement: () => parentRef.current,
    estimateSize: () => 68,
    overscan: 5,
  });

  const virtualItems = rowVirtualizer.getVirtualItems();
  const lastVirtualItem = virtualItems[virtualItems.length - 1];

  /**
   * 4. Trigger Infinite Scroll:
   * When user scrolls near the bottom of the virtualized list, automatically fetch next 50 rows.
   */
  useEffect(() => {
    if (!lastVirtualItem) return;

    if (
      lastVirtualItem.index >= items.length - 1 &&
      hasMore &&
      !isFetchingNextPage &&
      !isLoading
    ) {
      fetchChunk(false);
    }
  }, [lastVirtualItem, hasMore, isFetchingNextPage, isLoading, items.length, fetchChunk]);

  // Demo fallback generator if local Supabase table is not currently populated
  const handleLoadDemoSimulation = () => {
    setIsLoading(true);
    setError(null);
    setTimeout(() => {
      const mockBatch = Array.from({ length: 50 }, (_, i) => ({
        id: items.length + i + 1,
        name: `Simulated Record Item #${items.length + i + 1}`,
        category: ['Produce', 'Bakery', 'Dairy', 'Pantry', 'Meat'][i % 5],
        quantity: ((i % 4) + 1) * 2,
        unit_price: 45 + (i * 3.5),
        created_at: new Date().toISOString()
      }));
      setItems((prev) => [...prev, ...mockBatch]);
      setIsLoading(false);
      setHasMore(items.length + 50 < 300);
    }, 400);
  };

  return (
    <div className="space-y-4 text-[#F3E8D0] animate-fade-in">
      {/* Header Bar with Realtime Status Badge */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-4 rounded-xl bg-gradient-to-r from-[#17251F] via-[#171D2B] to-[#121620] border border-[#D8B56D]/30 shadow-lg">
        <div className="flex items-center gap-3">
          <div className="p-2.5 rounded-lg bg-[#D8B56D]/15 border border-[#D8B56D]/40 text-[#D8B56D]">
            <Layers className="w-5 h-5" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="font-enchanted font-bold text-lg text-[#F3E8D0]">
                {title}
              </h2>
              <span className="text-[10px] uppercase font-bold tracking-wider px-2 py-0.5 rounded bg-[#111620] border border-[#D8B56D]/30 text-[#D8B56D]">
                Table: {tableName}
              </span>

              {/* Realtime Status Indicator */}
              <div 
                className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[10px] font-semibold border ${
                  isRealtimeActive
                    ? 'bg-emerald-950/60 text-emerald-300 border-emerald-500/40 shadow-sm shadow-emerald-500/20'
                    : 'bg-[#111620] text-[#A8B9A5] border-[#D8B56D]/20'
                }`}
                title={isRealtimeActive ? 'WebSocket connected: listening for live INSERT events' : 'Realtime inactive or connecting'}
              >
                <Radio className={`w-3 h-3 ${isRealtimeActive ? 'text-emerald-400 animate-pulse' : 'text-[#A8B9A5]'}`} />
                <span>{isRealtimeActive ? 'Realtime Live' : 'Connecting...'}</span>
              </div>
            </div>
            <p className="text-xs text-[#A8B9A5] mt-0.5">
              Infinite windowing (.gt('id', lastSeenId)) + Realtime INSERT streaming
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 self-start sm:self-auto">
          {realtimeInsertCount > 0 && (
            <span className="inline-flex items-center gap-1 text-[11px] px-2 py-0.5 rounded-full bg-[#D8B56D]/20 text-[#D8B56D] border border-[#D8B56D]/40 animate-pulse">
              <Zap className="w-3 h-3 text-[#D8B56D]" />
              <span>+{realtimeInsertCount} live</span>
            </span>
          )}

          <span className="text-xs px-2.5 py-1 rounded-md bg-[#111620] border border-[#D8B56D]/20 text-[#A8B9A5]">
            Loaded: <strong className="text-[#D8B56D]">{items.length}</strong> rows
          </span>

          <button
            onClick={() => fetchChunk(true)}
            disabled={isLoading || isFetchingNextPage}
            className="p-2 rounded-lg bg-[#17251F] hover:bg-[#D8B56D] hover:text-[#171D2B] text-[#D8B56D] border border-[#D8B56D]/30 transition-all cursor-pointer disabled:opacity-50"
            title="Refresh from beginning"
          >
            <RefreshCw className={`w-4 h-4 ${isLoading ? 'animate-spin' : ''}`} />
          </button>
        </div>
      </div>

      {/* Main Virtualized Container */}
      <div className="relative rounded-2xl bg-[#171D2B]/90 border border-[#D8B56D]/30 p-2 shadow-2xl">
        {/* Initial Loading State */}
        {isLoading && items.length === 0 ? (
          <div 
            style={{ height: `${height}px` }} 
            className="flex flex-col items-center justify-center space-y-3 text-[#A8B9A5]"
          >
            <RefreshCw className="w-8 h-8 text-[#D8B56D] animate-spin" />
            <p className="font-enchanted text-sm text-[#F3E8D0]">
              Connecting to Supabase... Querying first 50 rows.
            </p>
            <p className="text-xs text-[#A8B9A5]">
              Ordering by id ascending
            </p>
          </div>
        ) : error && items.length === 0 ? (
          /* Error State when Supabase is unreachable */
          <div 
            style={{ height: `${height}px` }} 
            className="flex flex-col items-center justify-center p-6 text-center space-y-3 bg-[#5B1F32]/20 rounded-xl border border-red-500/30"
          >
            <div className="p-3 rounded-full bg-red-950/60 border border-red-500/40 text-red-300">
              <AlertCircle className="w-6 h-6" />
            </div>
            <h3 className="font-enchanted font-bold text-red-200 text-base">
              Supabase Query Notice
            </h3>
            <p className="text-xs text-[#F3E8D0] max-w-md">
              {error}
            </p>
            <div className="flex items-center gap-3 pt-2">
              <button
                onClick={() => fetchChunk(true)}
                className="px-4 py-2 bg-gradient-to-r from-[#D8B56D] to-[#ECC880] text-[#171D2B] font-bold text-xs rounded-lg hover:brightness-110 transition-all cursor-pointer"
              >
                Retry Supabase Query
              </button>
              <button
                onClick={handleLoadDemoSimulation}
                className="px-4 py-2 bg-[#17251F] border border-[#D8B56D]/40 text-[#F3E8D0] font-semibold text-xs rounded-lg hover:bg-[#171D2B] transition-all flex items-center gap-1.5 cursor-pointer"
              >
                <Sparkles className="w-3.5 h-3.5 text-[#D8B56D]" />
                <span>Simulate 500 Rows</span>
              </button>
            </div>
          </div>
        ) : items.length === 0 ? (
          /* Empty State */
          <div 
            style={{ height: `${height}px` }} 
            className="flex flex-col items-center justify-center space-y-2 text-[#A8B9A5]"
          >
            <Database className="w-10 h-10 text-[#D8B56D]/40" />
            <p className="font-enchanted text-base text-[#F3E8D0]">No records found in table "{tableName}"</p>
            <p className="text-xs text-[#A8B9A5]">Insert records into Supabase to populate the live virtual list.</p>
          </div>
        ) : (
          /* Virtualized Scrollable Viewport (Fixed Height) */
          <div
            ref={parentRef}
            className="w-full overflow-y-auto rounded-xl border border-[#D8B56D]/20 bg-[#111620] shadow-inner custom-scrollbar"
            style={{ height: `${height}px` }}
          >
            <div
              className="relative w-full"
              style={{ height: `${rowVirtualizer.getTotalSize()}px` }}
            >
              {virtualItems.map((virtualRow) => {
                const isLoaderRow = virtualRow.index > items.length - 1;
                const item = items[virtualRow.index];

                return (
                  <div
                    key={virtualRow.index}
                    data-index={virtualRow.index}
                    ref={rowVirtualizer.measureElement}
                    className="absolute top-0 left-0 w-full px-2 py-1"
                    style={{
                      transform: `translateY(${virtualRow.start}px)`,
                    }}
                  >
                    {isLoaderRow ? (
                      /* Fallback UI: Loading Spinner at bottom while next chunk is being fetched */
                      <div className="flex items-center justify-center gap-3 p-4 rounded-xl bg-[#171D2B]/90 border border-[#D8B56D]/30 shadow-md">
                        <RefreshCw className="w-4 h-4 text-[#D8B56D] animate-spin" />
                        <span className="text-xs font-semibold text-[#D8B56D] font-enchanted">
                          Fetching next {pageSize} rows via Supabase cursor pagination...
                        </span>
                      </div>
                    ) : (
                      /* Render Single Row */
                      renderItem ? (
                        renderItem(item, virtualRow.index)
                      ) : (
                        <div className="flex items-center justify-between p-3.5 rounded-xl bg-[#171D2B]/80 hover:bg-[#1C2436] border border-[#D8B56D]/15 hover:border-[#D8B56D]/40 transition-all shadow-sm">
                          <div className="flex items-center gap-3 min-w-0">
                            <span className="flex items-center justify-center w-7 h-7 rounded-lg bg-[#111620] border border-[#D8B56D]/20 text-[11px] font-mono font-bold text-[#D8B56D] shrink-0">
                              #{item.id}
                            </span>
                            <div className="truncate">
                              <h4 className="text-sm font-semibold text-[#F3E8D0] truncate">
                                {item.name || item.title || `Record #${item.id}`}
                              </h4>
                              <p className="text-[11px] text-[#A8B9A5] flex items-center gap-2 mt-0.5">
                                {item.category && (
                                  <span className="px-1.5 py-0.5 rounded bg-[#111620] text-[#D8B56D]">
                                    {item.category}
                                  </span>
                                )}
                                {item.quantity && <span>Qty: {item.quantity}</span>}
                                {item.unit_price && <span>Price: ₹{item.unit_price}</span>}
                                {item.created_at && (
                                  <span>{new Date(item.created_at).toLocaleDateString()}</span>
                                )}
                              </p>
                            </div>
                          </div>

                          <div className="shrink-0 flex items-center gap-2 text-xs text-[#A8B9A5]">
                            <ChevronRight className="w-4 h-4 text-[#D8B56D]/50" />
                          </div>
                        </div>
                      )
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Footer Status Bar */}
        <div className="flex items-center justify-between px-3 pt-3 text-xs text-[#A8B9A5]">
          <span className="flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
            <span>Virtualizer Active: {virtualItems.length} visible DOM nodes mounted</span>
          </span>

          {!hasMore && items.length > 0 && (
            <span className="text-emerald-400 font-medium flex items-center gap-1">
              <CheckCircle2 className="w-3.5 h-3.5" />
              All {items.length} records loaded
            </span>
          )}

          {isFetchingNextPage && (
            <span className="text-[#D8B56D] font-medium flex items-center gap-1">
              <RefreshCw className="w-3 h-3 animate-spin" />
              Cursor advancing (lastSeenId: {items[items.length - 1]?.id})...
            </span>
          )}
        </div>
      </div>
    </div>
  );
}
