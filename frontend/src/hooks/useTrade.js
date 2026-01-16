import { useState, useCallback } from "react";
import axios from "axios";
import { useAuth } from "@/App";
import { toast } from "sonner";

/**
 * Hook for managing a single trade
 * Handles fetching, updating, and trade operations
 */
export const useTrade = (tradeId) => {
  const { user, API, getAuthHeaders } = useAuth();
  const [trade, setTrade] = useState(null);
  const [partner, setPartner] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isUpdating, setIsUpdating] = useState(false);

  // Fetch trade details
  const fetchTrade = useCallback(async () => {
    if (!tradeId) {
      setIsLoading(false);
      return;
    }

    setIsLoading(true);
    try {
      const headers = getAuthHeaders();
      const response = await axios.get(`${API}/trades/${tradeId}`, {
        withCredentials: true,
        headers: headers,
      });

      const tradeData = response.data;
      setTrade(tradeData);

      // Set partner based on user role
      const isOwner = tradeData.trade.owner_id === user.user_id;
      setPartner(isOwner ? tradeData.trader : tradeData.owner);
    } catch (error) {
      console.error("Failed to fetch trade:", error);
      throw error;
    } finally {
      setIsLoading(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [API, tradeId, user]); // getAuthHeaders is stable

  // Confirm trade
  const confirmTrade = useCallback(async () => {
    if (!tradeId || !trade) return;

    setIsUpdating(true);
    const isOwner = trade.trade.owner_id === user.user_id;

    // Optimistic update
    const updatedTrade = {
      ...trade,
      trade: {
        ...trade.trade,
        ...(isOwner ? { owner_confirmed: true } : { trader_confirmed: true }),
      },
    };
    setTrade(updatedTrade);

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
      setTrade(trade);
      toast.error(error.response?.data?.detail || "Failed to confirm trade");
      throw error;
    } finally {
      setIsUpdating(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [API, tradeId, trade, user]); // getAuthHeaders is stable

  // Cancel trade
  const cancelTrade = useCallback(async () => {
    if (!tradeId) return;

    setIsUpdating(true);
    try {
      const headers = getAuthHeaders();
      await axios.delete(`${API}/trades/${tradeId}`, {
        withCredentials: true,
        headers: headers,
      });
      toast.success("Trade cancelled");
    } catch (error) {
      toast.error(error.response?.data?.detail || "Failed to cancel trade");
      throw error;
    } finally {
      setIsUpdating(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [API, tradeId]); // getAuthHeaders is stable

  // Add item to trade
  const addItem = useCallback(
    async (itemId, side) => {
      if (!tradeId || !trade) return;

      let itemToAdd = trade.owner_items
        .concat(trade.trader_items)
        .find((item) => item.item_id === itemId);

      if (!itemToAdd) {
        // Need to fetch item details first
        try {
          const headers = getAuthHeaders();
          const itemResponse = await axios.get(`${API}/items/${itemId}`, {
            withCredentials: true,
            headers: headers,
          });
          itemToAdd = itemResponse.data;
        } catch (error) {
          toast.error("Failed to fetch item details");
          return;
        }
      }

      // Optimistic update
      const isOwner = trade.trade.owner_id === user.user_id;
      const updatedTrade = { ...trade };

      if (isOwner && side === "owner") {
        updatedTrade.owner_items = [...(trade.owner_items || []), itemToAdd];
        updatedTrade.trade = {
          ...trade.trade,
          owner_item_ids: [...(trade.trade.owner_item_ids || []), itemId],
        };
      } else if (!isOwner && side === "trader") {
        updatedTrade.trader_items = [...(trade.trader_items || []), itemToAdd];
        updatedTrade.trade = {
          ...trade.trade,
          trader_item_ids: [...(trade.trade.trader_item_ids || []), itemId],
        };
      }

      setTrade(updatedTrade);

      try {
        const headers = getAuthHeaders();
        await axios.post(
          `${API}/trades/${tradeId}/items`,
          { item_ids: [itemId], side },
          { withCredentials: true, headers: headers }
        );
        toast.success("Item added to trade");
      } catch (error) {
        // Rollback
        setTrade(trade);
        toast.error(error.response?.data?.detail || "Failed to add item");
        throw error;
      }
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [API, tradeId, trade, user] // getAuthHeaders is stable
  );

  // Remove item from trade
  const removeItem = useCallback(
    async (itemId) => {
      if (!tradeId || !trade) return;

      // Optimistic update
      const isOwner = trade.trade.owner_id === user.user_id;
      const updatedTrade = { ...trade };

      if (isOwner) {
        updatedTrade.owner_items = (trade.owner_items || []).filter(
          (item) => item.item_id !== itemId
        );
        updatedTrade.trade = {
          ...trade.trade,
          owner_item_ids: (trade.trade.owner_item_ids || []).filter(
            (id) => id !== itemId
          ),
        };
      } else {
        updatedTrade.trader_items = (trade.trader_items || []).filter(
          (item) => item.item_id !== itemId
        );
        updatedTrade.trade = {
          ...trade.trade,
          trader_item_ids: (trade.trade.trader_item_ids || []).filter(
            (id) => id !== itemId
          ),
        };
      }

      setTrade(updatedTrade);

      try {
        const headers = getAuthHeaders();
        await axios.delete(`${API}/trades/${tradeId}/items/${itemId}`, {
          withCredentials: true,
          headers: headers,
        });
        toast.success("Item removed from trade");
      } catch (error) {
        // Rollback
        setTrade(trade);
        toast.error(error.response?.data?.detail || "Failed to remove item");
        throw error;
      }
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [API, tradeId, trade, user] // getAuthHeaders is stable
  );

  // Handle WebSocket trade updates
  const handleTradeUpdate = useCallback(
    (updatedTradeData) => {
      if (updatedTradeData.trade_id === tradeId) {
        setTrade(updatedTradeData);
      }
    },
    [tradeId]
  );

  return {
    trade,
    partner,
    isLoading,
    isUpdating,
    fetchTrade,
    confirmTrade,
    cancelTrade,
    addItem,
    removeItem,
    handleTradeUpdate,
  };
};
