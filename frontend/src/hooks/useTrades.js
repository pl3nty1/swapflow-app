import { useState, useCallback } from "react";
import axios from "axios";
import { useAuth } from "@/App";
import { usePreloadCache } from "@/contexts/PreloadContext";
import { useWebSocket } from "@/hooks/useWebSocket";
import { toast } from "sonner";

/**
 * Hook for managing multiple trades
 * Handles fetching all trades, filtering, and real-time updates
 */
export const useTrades = () => {
  const { user, API, getAuthHeaders } = useAuth();
  const { getCachedTrades } = usePreloadCache();
  const [trades, setTrades] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [updatingTradeId, setUpdatingTradeId] = useState(null);

  // Fetch all trades
  const fetchTrades = useCallback(async () => {
    const cached = getCachedTrades();
    if (cached) {
      setTrades(cached);
      setIsLoading(false);
    }

    try {
      const headers = getAuthHeaders();
      const response = await axios.get(`${API}/trades`, {
        withCredentials: true,
        headers: headers,
      });
      setTrades(response.data);
    } catch (error) {
      console.error("Failed to fetch trades:", error);
    } finally {
      setIsLoading(false);
    }
  }, [API, getAuthHeaders, getCachedTrades]);

  // Confirm a trade
  const confirmTrade = useCallback(
    async (tradeId) => {
      const tradeData = trades.find((t) => t.trade.trade_id === tradeId);
      if (!tradeData) return;

      setUpdatingTradeId(tradeId);
      const isOwner = tradeData.trade.owner_id === user.user_id;

      // Optimistic update
      const updatedTrades = trades.map((t) => {
        if (t.trade.trade_id === tradeId) {
          return {
            ...t,
            trade: {
              ...t.trade,
              ...(isOwner ? { owner_confirmed: true } : { trader_confirmed: true }),
            },
          };
        }
        return t;
      });
      setTrades(updatedTrades);

      try {
        const headers = getAuthHeaders();
        await axios.post(
          `${API}/trades/${tradeId}/confirm`,
          {},
          { withCredentials: true, headers: headers }
        );
        toast.success("Trade confirmed!");
      } catch (error) {
        // Rollback
        setTrades(trades);
        toast.error(error.response?.data?.detail || "Failed to confirm trade");
      } finally {
        setUpdatingTradeId(null);
      }
    },
    [API, getAuthHeaders, trades, user]
  );

  // Cancel a trade
  const cancelTrade = useCallback(
    async (tradeId) => {
      setUpdatingTradeId(tradeId);

      // Optimistic update
      const updatedTrades = trades.filter(
        (t) => t.trade.trade_id !== tradeId
      );
      setTrades(updatedTrades);

      try {
        const headers = getAuthHeaders();
        await axios.delete(`${API}/trades/${tradeId}`, {
          withCredentials: true,
          headers: headers,
        });
        toast.success("Trade cancelled");
      } catch (error) {
        // Rollback
        setTrades(trades);
        toast.error(error.response?.data?.detail || "Failed to cancel trade");
      } finally {
        setUpdatingTradeId(null);
      }
    },
    [API, getAuthHeaders, trades]
  );

  // Add item to trade
  const addItem = useCallback(
    async (tradeId, itemId, side) => {
      const tradeData = trades.find((t) => t.trade.trade_id === tradeId);
      if (!tradeData) return;

      // Optimistic update
      const isOwner = tradeData.trade.owner_id === user.user_id;
      const updatedTrades = trades.map((t) => {
        if (t.trade.trade_id === tradeId) {
          const updated = { ...t };
          if (isOwner && side === "owner") {
            updated.owner_items = [...(t.owner_items || []), { item_id: itemId }];
            updated.trade = {
              ...t.trade,
              owner_item_ids: [...(t.trade.owner_item_ids || []), itemId],
            };
          } else if (!isOwner && side === "trader") {
            updated.trader_items = [...(t.trader_items || []), { item_id: itemId }];
            updated.trade = {
              ...t.trade,
              trader_item_ids: [...(t.trade.trader_item_ids || []), itemId],
            };
          }
          return updated;
        }
        return t;
      });
      setTrades(updatedTrades);

      try {
        const headers = getAuthHeaders();
        await axios.post(
          `${API}/trades/${tradeId}/items`,
          { item_ids: [itemId], side },
          { withCredentials: true, headers: headers }
        );
        toast.success("Item added to trade");
        // Refresh to get full item details
        fetchTrades();
      } catch (error) {
        // Rollback
        setTrades(trades);
        toast.error(error.response?.data?.detail || "Failed to add item");
      }
    },
    [API, getAuthHeaders, trades, user, fetchTrades]
  );

  // Remove item from trade
  const removeItem = useCallback(
    async (tradeId, itemId) => {
      setUpdatingTradeId(itemId);

      // Optimistic update
      const tradeData = trades.find((t) => t.trade.trade_id === tradeId);
      if (!tradeData) return;

      const isOwner = tradeData.trade.owner_id === user.user_id;
      const updatedTrades = trades.map((t) => {
        if (t.trade.trade_id === tradeId) {
          const updated = { ...t };
          if (isOwner) {
            updated.owner_items = (t.owner_items || []).filter(
              (item) => item.item_id !== itemId
            );
            updated.trade = {
              ...t.trade,
              owner_item_ids: (t.trade.owner_item_ids || []).filter(
                (id) => id !== itemId
              ),
            };
          } else {
            updated.trader_items = (t.trader_items || []).filter(
              (item) => item.item_id !== itemId
            );
            updated.trade = {
              ...t.trade,
              trader_item_ids: (t.trade.trader_item_ids || []).filter(
                (id) => id !== itemId
              ),
            };
          }
          return updated;
        }
        return t;
      });
      setTrades(updatedTrades);

      try {
        const headers = getAuthHeaders();
        await axios.delete(`${API}/trades/${tradeId}/items/${itemId}`, {
          withCredentials: true,
          headers: headers,
        });
        toast.success("Item removed from trade");
      } catch (error) {
        // Rollback
        setTrades(trades);
        toast.error(error.response?.data?.detail || "Failed to remove item");
      } finally {
        setUpdatingTradeId(null);
      }
    },
    [API, getAuthHeaders, trades, user]
  );

  // Handle WebSocket trade updates
  const handleWebSocketMessage = useCallback(
    (channel, type, data) => {
      if (channel === "trades" && type === "trade_updated") {
        setTrades((prev) => {
          const existingIndex = prev.findIndex(
            (t) => t.trade.trade_id === data.trade_id
          );
          if (existingIndex >= 0) {
            // Update existing trade
            return prev.map((t, idx) => {
              if (idx === existingIndex) {
                return { ...t, ...data };
              }
              return t;
            });
          }
          // New trade - refresh list
          fetchTrades();
          return prev;
        });
      }
    },
    [fetchTrades]
  );

  // WebSocket connection
  useWebSocket(["trades"], handleWebSocketMessage);

  // Filter trades
  const activeTrades = trades.filter(
    (t) => !t.trade.is_completed && !t.trade.is_cancelled
  );
  const completedTrades = trades.filter((t) => t.trade.is_completed);

  return {
    trades,
    activeTrades,
    completedTrades,
    isLoading,
    updatingTradeId,
    fetchTrades,
    confirmTrade,
    cancelTrade,
    addItem,
    removeItem,
  };
};
