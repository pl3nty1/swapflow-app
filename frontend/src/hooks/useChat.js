import { useState, useCallback, useEffect, useRef } from "react";
import axios from "axios";
import { useAuth } from "@/App";
import { usePreloadCache } from "@/contexts/PreloadContext";
import { useWebSocket } from "@/hooks/useWebSocket";
import { toast } from "sonner";

/**
 * Hook for managing chat conversations and messages
 * Handles fetching, sending messages, and real-time updates
 */
export const useChat = (tradeId = null) => {
  const { user, API, getAuthHeaders } = useAuth();
  const { 
    getCachedConversations, 
    setCachedConversations, 
    getCachedMessages, 
    setCachedMessages, 
    updateCachedMessage 
  } = usePreloadCache();
  
  // Initialize conversations from cache immediately if available
  const initialCachedConversations = getCachedConversations();
  const [conversations, setConversations] = useState(initialCachedConversations || []);
  const [messages, setMessages] = useState([]);
  const [isLoading, setIsLoading] = useState(!initialCachedConversations); // Only show loading if no cache
  const [isSending, setIsSending] = useState(false);
  const messagesEndRef = useRef(null);

  // Fetch all conversations
  const fetchConversations = useCallback(async (forceRefresh = false) => {
    // Always check cache first - use it if available and fresh
    const cached = getCachedConversations();
    if (cached && cached.length > 0 && !forceRefresh) {
      setConversations(cached);
      setIsLoading(false);
      // Always refresh in background to keep cache fresh
      const headers = getAuthHeaders();
      axios.get(`${API}/conversations`, {
        withCredentials: true,
        headers: headers,
      }).then(response => {
        setConversations(response.data);
        setCachedConversations(response.data);
      }).catch(() => {}); // Silently fail - keep using cache
      return; // Exit early - cache is good!
    }

    // Cache miss or force refresh - fetch fresh data
    setIsLoading(true);
    try {
      const headers = getAuthHeaders();
      const response = await axios.get(`${API}/conversations`, {
        withCredentials: true,
        headers: headers,
      });
      setConversations(response.data);
      setCachedConversations(response.data);
    } catch (error) {
      console.error("Failed to fetch conversations:", error);
      // If we have stale cache, use it
      if (cached && cached.length > 0) {
        setConversations(cached);
      }
    } finally {
      setIsLoading(false);
    }
  }, [API, getAuthHeaders, getCachedConversations, setCachedConversations]);

  // Fetch messages for a specific trade
  const fetchMessages = useCallback(
    async (targetTradeId = tradeId, forceRefresh = false) => {
      if (!targetTradeId) return;

      // Check cache first - use it if available and fresh
      const cached = getCachedMessages(targetTradeId);
      if (cached && cached.length > 0 && !forceRefresh) {
        setMessages(cached);
        // Always refresh in background to keep cache fresh (messages change frequently)
        const headers = getAuthHeaders();
        axios.get(`${API}/messages/${targetTradeId}`, {
          withCredentials: true,
          headers: headers,
        }).then(response => {
          const freshMessages = response.data || [];
          setMessages(freshMessages);
          setCachedMessages(targetTradeId, freshMessages);
        }).catch(() => {}); // Silently fail - keep using cache
        return; // Exit early - cache is good!
      }

      // Cache miss or force refresh - fetch fresh data
      try {
        const headers = getAuthHeaders();
        const response = await axios.get(`${API}/messages/${targetTradeId}`, {
          withCredentials: true,
          headers: headers,
        });
        const freshMessages = response.data || [];
        setMessages(freshMessages);
        setCachedMessages(targetTradeId, freshMessages);
      } catch (error) {
        console.error("Failed to fetch messages:", error);
        // If we have stale cache, use it
        if (cached && cached.length > 0) {
          setMessages(cached);
        }
        throw error;
      }
    },
    [API, tradeId, getAuthHeaders, getCachedMessages, setCachedMessages]
  );

  // Mark messages as read
  const markAsRead = useCallback(
    async (targetTradeId = tradeId) => {
      if (!targetTradeId) return;

      try {
        const headers = getAuthHeaders();
        await axios.post(
          `${API}/messages/${targetTradeId}/mark-read`,
          {},
          { withCredentials: true, headers: headers }
        );
        fetchConversations();
        window.dispatchEvent(new CustomEvent("messagesRead"));
      } catch (error) {
        console.error("Failed to mark messages as read:", error);
      }
    },
    [API, tradeId, fetchConversations, getAuthHeaders]
  );

  // Send a message
  const sendMessage = useCallback(
    async (content, targetTradeId = tradeId) => {
      if (!content.trim() || !targetTradeId) return;

      const messageText = content.trim();
      const tempId = `temp_${Date.now()}`;

      // Optimistic update
      const optimisticMessage = {
        message_id: tempId,
        trade_id: targetTradeId,
        sender_id: user.user_id,
        receiver_id: "", // Will be set by backend
        content: messageText,
        created_at: new Date().toISOString(),
        message_type: "text",
        read_at: null,
      };

      setMessages((prev) => [...prev, optimisticMessage]);
      setIsSending(true);

      try {
        const headers = getAuthHeaders();
        const response = await axios.post(
          `${API}/messages`,
          {
            trade_id: targetTradeId,
            content: messageText,
          },
          {
            withCredentials: true,
            headers: headers,
          }
        );

        // Replace optimistic message with real one
        const realMessage = response.data;
        setMessages((prev) => {
          const filtered = prev.filter((m) => m.message_id !== tempId);
          if (!filtered.some((m) => m.message_id === realMessage.message_id)) {
            return [...filtered, realMessage];
          }
          return filtered;
        });
        
        // Update cache
        updateCachedMessage(targetTradeId, realMessage);
      } catch (error) {
        // Rollback optimistic update
        setMessages((prev) => prev.filter((m) => m.message_id !== tempId));
        toast.error("Failed to send message");
        throw error;
      } finally {
        setIsSending(false);
      }
    },
    [API, tradeId, user, getAuthHeaders, updateCachedMessage]
  );

  // Handle WebSocket messages
  const handleWebSocketMessage = useCallback(
    (channel, type, data) => {
      if (channel === "messages" && type === "new_message") {
        const newMsg = data.message;

        // Add message if it's for current trade
        if (tradeId && newMsg.trade_id === tradeId) {
          setMessages((prev) => {
            if (prev.some((m) => m.message_id === newMsg.message_id)) {
              return prev;
            }
            return [...prev, newMsg];
          });
          
          // Update cache
          updateCachedMessage(tradeId, newMsg);

          // Mark as read if we're viewing this trade
          if (newMsg.receiver_id === user?.user_id) {
            markAsRead(tradeId);
          }
        }

        // Update conversations list
        setConversations((prev) => {
          const existingIndex = prev.findIndex(
            (conv) => conv.trade_id === newMsg.trade_id
          );
          if (existingIndex >= 0) {
            return prev.map((conv, idx) => {
              if (idx === existingIndex) {
                return {
                  ...conv,
                  last_message: newMsg.content,
                  last_message_time: newMsg.created_at,
                  unread_count:
                    newMsg.receiver_id === user?.user_id
                      ? (conv.unread_count || 0) + 1
                      : conv.unread_count,
                };
              }
              return conv;
            });
          }
          return prev;
        });
      }
    },
    [tradeId, user, markAsRead]
  );

  // WebSocket connection
  useWebSocket(["messages"], handleWebSocketMessage);

  // Clear messages when tradeId changes or becomes null
  useEffect(() => {
    if (!tradeId) {
      setMessages([]);
    }
  }, [tradeId]);

  // Auto-scroll to bottom when messages change
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  return {
    conversations,
    messages,
    isLoading,
    isSending,
    messagesEndRef,
    fetchConversations,
    fetchMessages,
    sendMessage,
    markAsRead,
  };
};
