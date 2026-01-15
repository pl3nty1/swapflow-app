import { useEffect, useState, useCallback, useRef } from "react";
import { useParams, useNavigate } from "react-router-dom";
import axios from "axios";
import { useAuth } from "@/App";
import { usePreloadCache } from "@/contexts/PreloadContext";
import { Header } from "@/components/Header";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { toast } from "sonner";
import { Send, Loader2, ArrowLeft, MessageCircle, ArrowLeftRight, Plus, Trash2, Check, X } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";

const Messages = () => {
  const { tradeId } = useParams();
  const navigate = useNavigate();
  const { user, API, getAuthHeaders } = useAuth();
  const { getCachedConversations } = usePreloadCache();
  const [conversations, setConversations] = useState([]);
  const [messages, setMessages] = useState([]);
  const [partner, setPartner] = useState(null);
  const [trade, setTrade] = useState(null);
  const [newMessage, setNewMessage] = useState("");
  const [isLoading, setIsLoading] = useState(true);
  const [isSending, setIsSending] = useState(false);
  const messagesEndRef = useRef(null);
  const wsRef = useRef(null);
  const [myAvailableItems, setMyAvailableItems] = useState([]);
  const [addingItemTradeId, setAddingItemTradeId] = useState(null);
  const [removingItemId, setRemovingItemId] = useState(null);
  const [deleteLastItemDialog, setDeleteLastItemDialog] = useState({ isOpen: false, tradeId: null, itemId: null });
  const [confirmingId, setConfirmingId] = useState(null);

  const fetchConversations = useCallback(async () => {
    // Check cache first
    const cached = getCachedConversations();
    if (cached) {
      setConversations(cached);
      setIsLoading(false);
      // Still fetch in background to update
    }

    try {
      const headers = getAuthHeaders();
      const response = await axios.get(`${API}/conversations`, { 
        withCredentials: true,
        headers: headers
      });
      setConversations(response.data);
    } catch (error) {
      // #region agent log
      fetch('http://127.0.0.1:7242/ingest/7e1d3f60-34a1-4d7e-99ac-6c65e0f8e90f',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'Messages.jsx:30',message:'fetchConversations error',data:{status:error.response?.status,detail:error.response?.data?.detail,message:error.message},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'F'})}).catch(()=>{});
      // #endregion
      console.error("Failed to fetch conversations:", error);
    } finally {
      setIsLoading(false);
    }
  }, [API, getCachedConversations]); // getAuthHeaders is stable and doesn't need to be in dependencies

  const fetchMessages = useCallback(async () => {
    if (!tradeId) return;

    try {
      const headers = getAuthHeaders();
      const [messagesRes, tradeRes] = await Promise.all([
        axios.get(`${API}/messages/${tradeId}`, { 
          withCredentials: true,
          headers: headers
        }).catch(() => ({ data: [] })), // If no messages exist, return empty array
        axios.get(`${API}/trades/${tradeId}`, { 
          withCredentials: true,
          headers: headers
        }),
      ]);
      setMessages(messagesRes.data || []);
      setTrade(tradeRes.data);
      // Set partner from trade
      const isOwner = tradeRes.data.trade.owner_id === user.user_id;
      setPartner(isOwner ? tradeRes.data.trader : tradeRes.data.owner);
    } catch (error) {
      console.error("Failed to fetch messages:", error);
      if (error.response?.status === 404) {
        toast.error("Trade not found");
        navigate("/messages");
      } else if (error.response?.status === 403) {
        toast.error("You don't have access to this trade");
        navigate("/messages");
      } else {
        toast.error("Failed to load messages");
      }
    }
  }, [API, tradeId, user, navigate]); // getAuthHeaders is stable and doesn't need to be in dependencies

  useEffect(() => {
    fetchConversations();
  }, [fetchConversations]);

  useEffect(() => {
    if (tradeId) {
      fetchMessages();
      // Mark messages as read when viewing conversation
      const markAsRead = async () => {
        try {
          const headers = getAuthHeaders();
          await axios.post(
            `${API}/messages/${tradeId}/mark-read`,
            {},
            { withCredentials: true, headers: headers }
          );
          fetchConversations(); // Refresh to update unread counts
          // Dispatch event to notify Header to refresh unread count
          window.dispatchEvent(new CustomEvent('messagesRead'));
        } catch (error) {
          console.error("Failed to mark messages as read:", error);
        }
      };
      markAsRead();
    }
  }, [tradeId, fetchMessages, API, fetchConversations]); // getAuthHeaders is stable and doesn't need to be in dependencies

  // Ensure current trade appears in conversations list even if not loaded yet
  useEffect(() => {
    if (tradeId && trade && partner && !conversations.find(c => c.trade_id === tradeId)) {
      // Add current trade to conversations list if it's not there
      setConversations(prev => {
        if (prev.find(c => c.trade_id === tradeId)) return prev;
        const newConv = {
          trade_id: tradeId,
          partner: partner,
          last_message: null,
          last_message_time: trade.trade.created_at,
          unread_count: 0,
          is_completed: trade.trade.is_completed
        };
        return [newConv, ...prev];
      });
    }
  }, [tradeId, trade, partner, conversations]);

  // WebSocket connection
  useEffect(() => {
    const connectWebSocket = () => {
      const token = localStorage.getItem("session_token");
      if (!token) return;

      const wsProtocol = window.location.protocol === "https:" ? "wss:" : "ws:";
      const wsHost = API.replace(/^https?:\/\//, "").replace(/^http:\/\//, "");
      const wsUrl = `${wsProtocol}//${wsHost}/ws/messages?token=${token}`;

      try {
        const ws = new WebSocket(wsUrl);
        wsRef.current = ws;

        ws.onopen = () => {
          console.log("WebSocket connected");
        };

        ws.onmessage = async (event) => {
          try {
            const data = JSON.parse(event.data);
            if (data.type === "new_message") {
              const newMsg = data.message;
              
              // Add message if it's for current trade
              if (tradeId && newMsg.trade_id === tradeId) {
                setMessages((prev) => {
                  // Avoid duplicates
                  if (prev.some((m) => m.message_id === newMsg.message_id)) {
                    return prev;
                  }
                  return [...prev, newMsg];
                });
                
                // If we're viewing this trade, mark the message as read immediately
                if (tradeId && newMsg.trade_id === tradeId && newMsg.receiver_id === user?.user_id) {
                  const markAsRead = async () => {
                    try {
                      const headers = getAuthHeaders();
                      await axios.post(
                        `${API}/messages/${tradeId}/mark-read`,
                        {},
                        { withCredentials: true, headers: headers }
                      );
                      // Dispatch event to notify Header to refresh unread count
                      window.dispatchEvent(new CustomEvent('messagesRead'));
                    } catch (error) {
                      console.error("Failed to mark message as read:", error);
                    }
                  };
                  markAsRead();
                }
              }
              
              // Update conversations list optimistically (only last message and unread count)
              setConversations((prev) => {
                const existingIndex = prev.findIndex(conv => conv.trade_id === newMsg.trade_id);
                if (existingIndex >= 0) {
                  // Update existing conversation
                  return prev.map((conv, idx) => {
                    if (idx === existingIndex) {
                      return {
                        ...conv,
                        last_message: newMsg.content,
                        last_message_time: newMsg.created_at,
                        unread_count: newMsg.receiver_id === user?.user_id 
                          ? (conv.unread_count || 0) + 1 
                          : conv.unread_count
                      };
                    }
                    return conv;
                  });
                }
                // If conversation doesn't exist, it will be added by fetchConversations when needed
                return prev;
              });
            } else if (data.type === "trade_updated" && tradeId && data.trade_id === tradeId) {
              // Trade was updated, refresh trade data
              fetchMessages();
            }
          } catch (error) {
            console.error("Failed to parse WebSocket message:", error);
          }
        };

        ws.onerror = (error) => {
          console.error("WebSocket error:", error);
        };

        ws.onclose = () => {
          console.log("WebSocket disconnected, reconnecting...");
          // Reconnect after 3 seconds
          setTimeout(connectWebSocket, 3000);
        };
      } catch (error) {
        console.error("Failed to connect WebSocket:", error);
      }
    };

    connectWebSocket();

    return () => {
      if (wsRef.current) {
        wsRef.current.close();
      }
    };
  }, [API, tradeId, fetchConversations, user]); // getAuthHeaders is stable and doesn't need to be in dependencies

  useEffect(() => {
    // Auto-scroll to bottom
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const handleSendMessage = async (e) => {
    e.preventDefault();
    if (!newMessage.trim() || !tradeId) return;

    const messageText = newMessage.trim();
    const tempId = `temp_${Date.now()}`;
    
    // OPTIMISTIC UPDATE: Add message immediately for instant feedback
    const optimisticMessage = {
      message_id: tempId,
      trade_id: tradeId,
      sender_id: user.user_id,
      receiver_id: partner?.user_id || "",
      content: messageText,
      created_at: new Date().toISOString(),
      message_type: "text",
      read_at: null
    };
    
    setMessages((prev) => [...prev, optimisticMessage]);
    setNewMessage("");
    setIsSending(true);

    try {
      const headers = getAuthHeaders();
      const response = await axios.post(
        `${API}/messages`,
        {
          trade_id: tradeId,
          content: messageText,
        },
        { 
          withCredentials: true,
          headers: headers
        }
      );
      
      // Replace optimistic message with real one (WebSocket might have already done this)
      setMessages((prev) => {
        // Remove optimistic message
        const filtered = prev.filter(m => m.message_id !== tempId);
        // Add real message if not already present (WebSocket might have added it)
        if (!filtered.some(m => m.message_id === response.data.message_id)) {
          return [...filtered, response.data];
        }
        return filtered;
      });
      
      // Don't call fetchConversations() - WebSocket will handle it automatically
    } catch (error) {
      // Rollback optimistic update on error
      setMessages((prev) => prev.filter(m => m.message_id !== tempId));
      setNewMessage(messageText); // Restore message text
      toast.error("Failed to send message");
    } finally {
      setIsSending(false);
    }
  };

  const getInitials = (name) => {
    if (!name) return "U";
    return name
      .split(" ")
      .map((n) => n[0])
      .join("")
      .toUpperCase()
      .slice(0, 2);
  };

  const truncateMessage = (message, maxLength = 50) => {
    if (!message) return "No messages yet";
    if (message.length <= maxLength) return message;
    return message.substring(0, maxLength) + "...";
  };

  const formatTime = (dateStr) => {
    const date = new Date(dateStr);
    return date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
  };

  const fetchMyAvailableItems = useCallback(async (currentItemIds) => {
    try {
      const headers = getAuthHeaders();
      const response = await axios.get(`${API}/my-items`, {
        withCredentials: true,
        headers: headers
      });
      const available = response.data.filter(item => item.is_available);
      // Filter out items already in trade
      setMyAvailableItems(available.filter(item => !currentItemIds.includes(item.item_id)));
    } catch (error) {
      console.error("Failed to fetch items:", error);
    }
  }, [API]);

  const handleAddItem = async (itemId, side) => {
    if (!tradeId || !trade) return;
    
    // Find the item to add
    const itemToAdd = myAvailableItems.find(item => item.item_id === itemId);
    if (!itemToAdd) return;
    
    // OPTIMISTIC UPDATE: Add item to UI immediately
    const isOwner = trade.trade.owner_id === user.user_id;
    const updatedTrade = { ...trade };
    if (isOwner && side === "owner") {
      updatedTrade.owner_items = [...(trade.owner_items || []), itemToAdd];
      updatedTrade.trade = {
        ...trade.trade,
        owner_item_ids: [...(trade.trade.owner_item_ids || []), itemId]
      };
    } else if (!isOwner && side === "trader") {
      updatedTrade.trader_items = [...(trade.trader_items || []), itemToAdd];
      updatedTrade.trade = {
        ...trade.trade,
        trader_item_ids: [...(trade.trade.trader_item_ids || []), itemId]
      };
    }
    setTrade(updatedTrade);
    setAddingItemTradeId(null);
    
    try {
      const headers = getAuthHeaders();
      await axios.post(
        `${API}/trades/${tradeId}/items`,
        { item_ids: [itemId], side },
        { withCredentials: true, headers: headers }
      );
      // Don't call fetchMessages() - WebSocket will handle it
      toast.success("Item added to trade");
    } catch (error) {
      // Rollback on error
      setTrade(trade);
      toast.error(error.response?.data?.detail || "Failed to add item");
    }
  };

  const handleRemoveItem = async (itemId, isLastItem = false) => {
    if (!tradeId || !trade) return;
    // If it's the last item, show confirmation dialog
    if (isLastItem) {
      setDeleteLastItemDialog({ isOpen: true, tradeId, itemId });
      return;
    }
    
    // OPTIMISTIC UPDATE: Remove item from UI immediately
    const isOwner = trade.trade.owner_id === user.user_id;
    const updatedTrade = { ...trade };
    let itemRemoved = false;
    
    if (isOwner) {
      updatedTrade.owner_items = (trade.owner_items || []).filter(item => item.item_id !== itemId);
      updatedTrade.trade = {
        ...trade.trade,
        owner_item_ids: (trade.trade.owner_item_ids || []).filter(id => id !== itemId)
      };
      itemRemoved = trade.owner_items?.some(item => item.item_id === itemId);
    } else {
      updatedTrade.trader_items = (trade.trader_items || []).filter(item => item.item_id !== itemId);
      updatedTrade.trade = {
        ...trade.trade,
        trader_item_ids: (trade.trade.trader_item_ids || []).filter(id => id !== itemId)
      };
      itemRemoved = trade.trader_items?.some(item => item.item_id === itemId);
    }
    
    if (itemRemoved) {
      setTrade(updatedTrade);
    }
    setRemovingItemId(itemId);
    
    try {
      const headers = getAuthHeaders();
      await axios.delete(
        `${API}/trades/${tradeId}/items/${itemId}`,
        { withCredentials: true, headers: headers }
      );
      // Don't call fetchMessages() - WebSocket will handle it
      toast.success("Item removed from trade");
      setRemovingItemId(null);
    } catch (error) {
      // Rollback on error
      setTrade(trade);
      toast.error(error.response?.data?.detail || "Failed to remove item");
      setRemovingItemId(null);
    }
  };

  const handleConfirmDeleteLastItem = async () => {
    const { tradeId: dialogTradeId, itemId } = deleteLastItemDialog;
    if (!dialogTradeId || !itemId) return;
    
    // OPTIMISTIC UPDATE: Navigate away immediately (trade will be cancelled)
    setDeleteLastItemDialog({ isOpen: false, tradeId: null, itemId: null });
    navigate("/messages");
    setRemovingItemId(itemId);
    
    try {
      const headers = getAuthHeaders();
      // Remove the item (which will leave the trade with 0 items on that side, effectively canceling it)
      await axios.delete(
        `${API}/trades/${dialogTradeId}/items/${itemId}`,
        { withCredentials: true, headers: headers }
      );
      // Then cancel the trade since it has no items on one side
      await axios.delete(
        `${API}/trades/${dialogTradeId}`,
        { withCredentials: true, headers: headers }
      );
      toast.success("Item removed and trade cancelled");
      setRemovingItemId(null);
    } catch (error) {
      toast.error(error.response?.data?.detail || "Failed to remove item");
      setRemovingItemId(null);
    }
  };

  const handleConfirm = async () => {
    if (!tradeId || !trade) return;
    
    // OPTIMISTIC UPDATE: Mark as confirmed immediately
    const isOwner = trade.trade.owner_id === user.user_id;
    const updatedTrade = {
      ...trade,
      trade: {
        ...trade.trade,
        ...(isOwner ? { owner_confirmed: true } : { trader_confirmed: true })
      }
    };
    setTrade(updatedTrade);
    setConfirmingId(tradeId);
    
    try {
      const headers = getAuthHeaders();
      await axios.post(
        `${API}/trades/${tradeId}/confirm`,
        {},
        { withCredentials: true, headers: headers }
      );
      // Don't call fetchMessages() - WebSocket will handle it
      toast.success("Trade confirmed!");
    } catch (error) {
      // Rollback on error
      setTrade(trade);
      toast.error(error.response?.data?.detail || "Failed to confirm trade");
    } finally {
      setConfirmingId(null);
    }
  };

  const handleCancel = async () => {
    if (!tradeId) return;
    if (!window.confirm("Are you sure you want to cancel this trade?")) return;
    
    // OPTIMISTIC UPDATE: Navigate away immediately
    navigate("/messages");
    
    try {
      const headers = getAuthHeaders();
      await axios.delete(
        `${API}/trades/${tradeId}`,
        { withCredentials: true, headers: headers }
      );
      toast.success("Trade cancelled");
    } catch (error) {
      toast.error(error.response?.data?.detail || "Failed to cancel trade");
    }
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-white">
        <Header />
        <div className="flex items-center justify-center py-20">
          <Loader2 className="w-8 h-8 text-indigo-600 spinner" />
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-white" data-testid="messages-page">
      <Header />

      <main className="max-w-6xl mx-auto px-4 md:px-8 lg:px-12 py-8">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 h-[calc(100vh-180px)]">
          {/* Conversations List */}
          <div className="bg-white rounded-2xl border border-slate-100 overflow-hidden">
            <div className="p-4 border-b border-slate-100">
              <h2
                className="font-semibold text-slate-900"
                style={{ fontFamily: "Manrope, sans-serif" }}
              >
                Messages
              </h2>
            </div>
            <ScrollArea className="h-[calc(100%-60px)]">
              {conversations.length === 0 ? (
                <div className="p-4 text-center text-slate-500">
                  No conversations yet
                </div>
              ) : (
                conversations.map((conv) => {
                  const unreadCount = conv.unread_count || 0;
                  const hasUnread = unreadCount > 0;
                  return (
                    <div
                      key={conv.trade_id}
                      onClick={() => navigate(`/messages/${conv.trade_id}`)}
                      className={`p-4 cursor-pointer hover:bg-slate-50 transition-colors border-b border-slate-50 ${
                        tradeId === conv.trade_id ? "bg-slate-50" : ""
                      } ${hasUnread ? "bg-indigo-50" : ""}`}
                      data-testid={`conversation-${conv.trade_id}`}
                    >
                      <div className="flex items-center gap-3">
                        <Avatar className="h-10 w-10 flex-shrink-0">
                          <AvatarImage src={conv.partner.picture} alt={conv.partner.name} />
                          <AvatarFallback className="bg-indigo-100 text-indigo-600">
                            {getInitials(conv.partner.name)}
                          </AvatarFallback>
                        </Avatar>
                        <div className="flex-1 min-w-0 overflow-hidden">
                          <div className="flex items-center gap-2 min-w-0">
                            <p className={`font-medium truncate flex-1 min-w-0 ${hasUnread ? "font-semibold" : ""}`}>
                              {conv.partner.username || conv.partner.name}
                            </p>
                            {hasUnread && (
                              <div className="w-2 h-2 bg-red-500 rounded-full flex-shrink-0" />
                            )}
                          </div>
                          <p 
                            className={`text-sm truncate ${hasUnread ? "text-slate-900 font-medium" : "text-slate-500"}`}
                            title={conv.last_message || "No messages yet"}
                          >
                            {truncateMessage(conv.last_message, 35)}
                          </p>
                        </div>
                      </div>
                    </div>
                  );
                })
              )}
            </ScrollArea>
          </div>

          {/* Chat Area */}
          <div className="md:col-span-2 bg-white rounded-2xl border border-slate-100 overflow-hidden flex flex-col">
            {tradeId && partner && trade ? (
              <>
                {/* Chat Header */}
                <div className="p-4 border-b border-slate-100 flex items-center gap-3">
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => navigate("/messages")}
                    className="md:hidden"
                  >
                    <ArrowLeft className="w-4 h-4" />
                  </Button>
                  <Avatar
                    className="h-10 w-10 cursor-pointer"
                    onClick={() => navigate(`/profile/${partner.user_id}`)}
                  >
                    <AvatarImage src={partner.picture} alt={partner.name} />
                    <AvatarFallback className="bg-indigo-100 text-indigo-600">
                      {getInitials(partner.name)}
                    </AvatarFallback>
                  </Avatar>
                  <div className="flex-1">
                    <p
                      className="font-medium text-slate-900 cursor-pointer hover:text-indigo-600"
                      onClick={() => navigate(`/profile/${partner.user_id}`)}
                    >
                      {partner.username || partner.name}
                    </p>
                    <p className="text-xs text-slate-500">
                      Trade: {trade.trade.owner_item_ids?.length || 0} ↔ {trade.trade.trader_item_ids?.length || 0} items
                      {trade.trade.is_completed && " • Completed"}
                    </p>
                  </div>
                </div>

                {/* Trade Display Section */}
                <div className="p-4 border-b border-slate-100 bg-slate-50">
                  <div className="flex items-center justify-between mb-3">
                    <h3 className="font-semibold text-slate-900 flex items-center gap-2">
                      <ArrowLeftRight className="w-4 h-4" />
                      Trade Details
                    </h3>
                    {trade.trade.is_completed && (
                      <Badge className="bg-teal-600">Completed</Badge>
                    )}
                    {trade.trade.is_cancelled && (
                      <Badge className="bg-slate-400">Cancelled</Badge>
                    )}
                  </div>
                  
                  {!trade.trade.is_completed && !trade.trade.is_cancelled && (
                    <div className="flex gap-2 mb-3">
                      <Button
                        onClick={handleConfirm}
                        disabled={confirmingId === tradeId}
                        size="sm"
                        className="bg-teal-600 hover:bg-teal-700 rounded-full"
                      >
                        {confirmingId === tradeId ? (
                          <Loader2 className="w-4 h-4 mr-2 spinner" />
                        ) : (
                          <Check className="w-4 h-4 mr-2" />
                        )}
                        Trade Finished
                      </Button>
                      <Button
                        variant="outline"
                        onClick={handleCancel}
                        size="sm"
                        className="rounded-full text-red-600 border-red-200 hover:bg-red-50"
                      >
                        <X className="w-4 h-4 mr-2" />
                        Cancel Trade
                      </Button>
                    </div>
                  )}

                  <div className="flex gap-4 items-start">
                    {/* Their Items */}
                    <div className="flex-1">
                      <p className="text-xs text-slate-500 mb-2 text-center">
                        {partner.username || partner.name}'s items
                      </p>
                      <div className="flex flex-wrap gap-2 justify-center">
                        {(trade.trader_items || []).map((item) => (
                          <div
                            key={item.item_id}
                            className="w-16 h-16 rounded-lg overflow-hidden cursor-pointer border-2 border-indigo-200 hover:border-indigo-400 transition-colors"
                            onClick={() => navigate(`/item/${item.item_id}`)}
                          >
                            <img
                              src={item.image}
                              alt={item.title}
                              className="w-full h-full object-cover"
                            />
                          </div>
                        ))}
                        {(!trade.trader_items || trade.trader_items.length === 0) && (
                          <p className="text-xs text-slate-400 text-center py-4">No items</p>
                        )}
                      </div>
                    </div>

                    {/* Arrow */}
                    <div className="flex items-center text-slate-400 pt-6">
                      <ArrowLeftRight className="w-5 h-5" />
                    </div>

                    {/* My Items */}
                    <div className="flex-1">
                      <p className="text-xs text-slate-500 mb-2 text-center">Your items</p>
                      <div className="flex flex-wrap gap-2 justify-center">
                        {(trade.owner_items || []).map((item) => {
                          const isOwner = trade.trade.owner_id === user.user_id;
                          const myItems = isOwner ? trade.owner_items : trade.trader_items;
                          const canEdit = !trade.trade.is_completed && !trade.trade.is_cancelled;
                          
                          return (
                            <div key={item.item_id} className="relative group">
                              <div
                                className="w-16 h-16 rounded-lg overflow-hidden cursor-pointer border-2 border-indigo-200 hover:border-indigo-400 transition-colors"
                                onClick={() => navigate(`/item/${item.item_id}`)}
                              >
                                <img
                                  src={item.image}
                                  alt={item.title}
                                  className="w-full h-full object-cover"
                                />
                              </div>
                              {canEdit && (
                                <button
                                  onClick={() => handleRemoveItem(item.item_id, myItems.length === 1)}
                                  disabled={removingItemId === item.item_id}
                                  className="absolute -top-1 -right-1 bg-red-500 text-white rounded-full p-1 opacity-0 group-hover:opacity-100 transition-opacity"
                                >
                                  <Trash2 className="w-3 h-3" />
                                </button>
                              )}
                            </div>
                          );
                        })}
                        {!trade.trade.is_completed && !trade.trade.is_cancelled && (
                          (() => {
                            const isOwner = trade.trade.owner_id === user.user_id;
                            const myItems = isOwner ? trade.owner_items : trade.trader_items;
                            const side = isOwner ? "owner" : "trader";
                            return myItems.length < 5 && (
                              <button
                                onClick={() => {
                                  const currentItemIds = myItems.map(i => i.item_id);
                                  fetchMyAvailableItems(currentItemIds);
                                  setAddingItemTradeId(tradeId);
                                }}
                                className="w-16 h-16 rounded-lg border-2 border-dashed border-slate-300 hover:border-indigo-400 flex items-center justify-center text-slate-400 hover:text-indigo-600 transition-colors"
                              >
                                <Plus className="w-4 h-4" />
                              </button>
                            );
                          })()
                        )}
                        {(!trade.owner_items || trade.owner_items.length === 0) && trade.trade.is_completed && (
                          <p className="text-xs text-slate-400 text-center py-4">No items</p>
                        )}
                      </div>
                    </div>
                  </div>
                </div>

                {/* Messages */}
                <ScrollArea className="flex-1 p-4">
                  <div className="space-y-4">
                    {messages.map((msg) => {
                      const isSent = msg.sender_id === user.user_id;
                      const isItemRequest = msg.message_type === "item_request" && msg.item_request_data?.status === "pending";
                      
                      return (
                        <div
                          key={msg.message_id}
                          className={`flex ${isSent ? "justify-end" : "justify-start"}`}
                        >
                          <div
                            className={`max-w-[70%] px-4 py-2 ${
                              isSent ? "message-sent" : "message-received"
                            }`}
                            data-testid={`message-${msg.message_id}`}
                          >
                            {isItemRequest && !isSent ? (
                              <div className="space-y-2">
                                <p className="break-words">{msg.content}</p>
                                <div className="flex gap-2">
                                  <Button
                                    size="sm"
                                    onClick={async () => {
                                      try {
                                        const headers = getAuthHeaders();
                                        await axios.post(
                                          `${API}/trades/${tradeId}/items/request/${msg.item_request_data.request_id}/respond`,
                                          { accepted: true },
                                          { withCredentials: true, headers: headers }
                                        );
                                        toast.success("Item request accepted");
                                        fetchMessages();
                                        fetchConversations();
                                      } catch (error) {
                                        toast.error(error.response?.data?.detail || "Failed to accept request");
                                      }
                                    }}
                                    className="bg-teal-600 hover:bg-teal-700"
                                  >
                                    Accept
                                  </Button>
                                  <Button
                                    size="sm"
                                    variant="outline"
                                    onClick={async () => {
                                      try {
                                        const headers = getAuthHeaders();
                                        await axios.post(
                                          `${API}/trades/${tradeId}/items/request/${msg.item_request_data.request_id}/respond`,
                                          { accepted: false },
                                          { withCredentials: true, headers: headers }
                                        );
                                        toast.success("Item request declined");
                                        fetchMessages();
                                      } catch (error) {
                                        toast.error(error.response?.data?.detail || "Failed to decline request");
                                      }
                                    }}
                                  >
                                    Decline
                                  </Button>
                                </div>
                              </div>
                            ) : (
                              <p className="break-words">{msg.content}</p>
                            )}
                            <p
                              className={`text-xs mt-1 ${
                                isSent ? "text-indigo-200" : "text-slate-400"
                              }`}
                            >
                              {formatTime(msg.created_at)}
                            </p>
                          </div>
                        </div>
                      );
                    })}
                    <div ref={messagesEndRef} />
                  </div>
                </ScrollArea>

                {/* Message Input */}
                <form
                  onSubmit={handleSendMessage}
                  className="p-4 border-t border-slate-100 flex gap-2"
                >
                  <Input
                    value={newMessage}
                    onChange={(e) => setNewMessage(e.target.value)}
                    placeholder="Type a message..."
                    className="flex-1 bg-slate-50 rounded-full"
                    data-testid="message-input"
                  />
                  <Button
                    type="submit"
                    disabled={!newMessage.trim() || isSending}
                    className="rounded-full bg-indigo-600 hover:bg-indigo-700"
                    data-testid="send-btn"
                  >
                    <Send className="w-4 h-4" />
                  </Button>
                </form>
              </>
            ) : tradeId && !trade ? (
              <div className="flex-1 flex items-center justify-center text-slate-500">
                <div className="text-center">
                  <MessageCircle className="w-12 h-12 mx-auto mb-4 text-slate-300" />
                  <p>Loading trade...</p>
                </div>
              </div>
            ) : (
              <div className="flex-1 flex items-center justify-center text-slate-500">
                <div className="text-center">
                  <MessageCircle className="w-12 h-12 mx-auto mb-4 text-slate-300" />
                  <p>Select a trade to start messaging</p>
                </div>
              </div>
            )}
          </div>
        </div>
      </main>

      {/* Add Item Dialog */}
      <Dialog open={!!addingItemTradeId} onOpenChange={(open) => !open && setAddingItemTradeId(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add Item to Trade</DialogTitle>
          </DialogHeader>
          <div className="space-y-2 max-h-96 overflow-y-auto">
            {myAvailableItems.length === 0 ? (
              <p className="text-slate-500 text-center py-4">No available items to add</p>
            ) : (
              myAvailableItems.map((item) => {
                if (!trade) return null;
                const isOwner = trade.trade.owner_id === user.user_id;
                const side = isOwner ? "owner" : "trader";
                return (
                  <div
                    key={item.item_id}
                    onClick={() => handleAddItem(item.item_id, side)}
                    className="p-3 border rounded-lg cursor-pointer hover:bg-slate-50"
                  >
                    <div className="flex gap-3">
                      <img src={item.image} alt={item.title} className="w-16 h-16 object-cover rounded" />
                      <div className="flex-1">
                        <h4 className="font-medium">{item.title}</h4>
                        <p className="text-sm text-slate-500">{item.category}</p>
                      </div>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </DialogContent>
      </Dialog>

      {/* Delete Last Item Warning Dialog */}
      <AlertDialog open={deleteLastItemDialog.isOpen} onOpenChange={(open) => !open && setDeleteLastItemDialog({ isOpen: false, tradeId: null, itemId: null })}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Remove Last Item?</AlertDialogTitle>
            <AlertDialogDescription>
              Removing this item will cancel the entire trade. Are you sure you want to continue?
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleConfirmDeleteLastItem}
              className="bg-red-600 hover:bg-red-700"
            >
              Delete Trade
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};

export default Messages;
