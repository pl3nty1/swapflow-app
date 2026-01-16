import { useEffect, useState, useCallback } from "react";
import { useParams, useNavigate } from "react-router-dom";
import axios from "axios";
import { useAuth } from "@/App";
import { useChat } from "@/hooks/useChat";
import { useTrade } from "@/hooks/useTrade";
import { useWebSocket } from "@/hooks/useWebSocket";
import { Header } from "@/components/Header";
import { ReportDialog } from "@/components/ReportDialog";
import { ConversationList } from "@/components/ConversationList";
import { MessageBubble } from "@/components/MessageBubble";
import { TradeItemList } from "@/components/TradeItemList";
import { TradeActions } from "@/components/TradeActions";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Send, Loader2, ArrowLeft, MessageCircle, ArrowLeftRight } from "lucide-react";
import { toast } from "sonner";

const Messages = () => {
  const { tradeId } = useParams();
  const navigate = useNavigate();
  const { user, API, getAuthHeaders } = useAuth();
  const [newMessage, setNewMessage] = useState("");
  const [myAvailableItems, setMyAvailableItems] = useState([]);
  const [addingItemTradeId, setAddingItemTradeId] = useState(null);
  const [removingItemId, setRemovingItemId] = useState(null);
  const [deleteLastItemDialog, setDeleteLastItemDialog] = useState({
    isOpen: false,
    tradeId: null,
    itemId: null,
  });
  const [isReportOpen, setIsReportOpen] = useState(false);

  // Use custom hooks
  const {
    conversations,
    messages,
    isLoading: chatLoading,
    isSending,
    messagesEndRef,
    fetchConversations,
    fetchMessages,
    sendMessage,
    markAsRead,
  } = useChat(tradeId);

  const {
    trade,
    partner,
    isLoading: tradeLoading,
    isUpdating,
    fetchTrade,
    confirmTrade,
    cancelTrade,
    addItem,
    removeItem,
  } = useTrade(tradeId);

  // Handle WebSocket trade updates
  const handleWebSocketMessage = useCallback(
    (channel, type, data) => {
      if (channel === "trades" && type === "trade_updated" && tradeId && data.trade_id === tradeId) {
        fetchTrade();
        fetchMessages();
      }
    },
    [tradeId, fetchTrade, fetchMessages]
  );

  useWebSocket(["trades"], handleWebSocketMessage);

  // Initial data loading - load from cache immediately
  useEffect(() => {
    // Load from cache first (instant), then refresh in background
    fetchConversations(false); // false = use cache if available
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []); // Only run once on mount

  useEffect(() => {
    if (tradeId) {
      // Load messages from cache first (instant), then refresh in background
      Promise.all([fetchMessages(tradeId, false), fetchTrade()]).catch((error) => {
        if (error.response?.status === 404) {
          toast.error("Trade not found");
          navigate("/messages");
        } else if (error.response?.status === 403) {
          toast.error("You don't have access to this trade");
          navigate("/messages");
        } else {
          toast.error("Failed to load trade");
        }
      });
      markAsRead();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tradeId]); // Functions are stable, only depend on tradeId

  // Helper functions
  const getInitials = (name) => {
    if (!name) return "U";
    return name
      .split(" ")
      .map((n) => n[0])
      .join("")
      .toUpperCase()
      .slice(0, 2);
  };

  // Fetch available items for adding to trade
  const fetchMyAvailableItems = useCallback(
    async (currentItemIds) => {
      try {
        const headers = getAuthHeaders();
        const response = await axios.get(`${API}/my-items`, {
          withCredentials: true,
          headers: headers,
        });
        const available = response.data.filter((item) => item.is_available);
        setMyAvailableItems(available.filter((item) => !currentItemIds.includes(item.item_id)));
      } catch (error) {
        console.error("Failed to fetch items:", error);
      }
    },
    [API, getAuthHeaders]
  );

  // Handle sending message
  const handleSendMessage = async (e) => {
    e.preventDefault();
    if (!newMessage.trim() || !tradeId) return;
    await sendMessage(newMessage.trim(), tradeId);
    setNewMessage("");
  };

  // Handle adding item to trade
  const handleAddItem = async (itemId, side) => {
    if (!tradeId || !trade) return;

    const itemToAdd = myAvailableItems.find((item) => item.item_id === itemId);
    if (!itemToAdd) return;

    await addItem(itemId, side);
    setAddingItemTradeId(null);
  };

  // Handle removing item from trade
  const handleRemoveItem = async (itemId, isLastItem = false) => {
    if (!tradeId || !trade) return;

    if (isLastItem) {
      setDeleteLastItemDialog({ isOpen: true, tradeId, itemId });
      return;
    }

    setRemovingItemId(itemId);
    try {
      await removeItem(itemId);
      setRemovingItemId(null);
    } catch (error) {
      setRemovingItemId(null);
    }
  };

  // Handle confirming deletion of last item (which cancels trade)
  const handleConfirmDeleteLastItem = async () => {
    const { tradeId: dialogTradeId, itemId } = deleteLastItemDialog;
    if (!dialogTradeId || !itemId) return;

    setDeleteLastItemDialog({ isOpen: false, tradeId: null, itemId: null });
    navigate("/messages");
    setRemovingItemId(itemId);

    try {
      const headers = getAuthHeaders();
      await axios.delete(`${API}/trades/${dialogTradeId}/items/${itemId}`, {
        withCredentials: true,
        headers: headers,
      });
      await axios.delete(`${API}/trades/${dialogTradeId}`, {
        withCredentials: true,
        headers: headers,
      });
      toast.success("Item removed and trade cancelled");
      setRemovingItemId(null);
    } catch (error) {
      toast.error(error.response?.data?.detail || "Failed to remove item");
      setRemovingItemId(null);
    }
  };

  // Handle trade confirmation
  const handleConfirm = async () => {
    await confirmTrade();
  };

  // Handle trade cancellation
  const handleCancel = async () => {
    if (!window.confirm("Are you sure you want to cancel this trade?")) return;
    await cancelTrade();
    navigate("/messages");
  };

  // Only show loading spinner if we're loading AND have no conversations (first load)
  // If we have cached conversations, show them immediately even if refreshing
  const isLoading = (chatLoading && conversations.length === 0) || (tradeLoading && tradeId);

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

  const isOwner = trade?.trade?.owner_id === user.user_id;
  const myItems = isOwner ? trade?.owner_items || [] : trade?.trader_items || [];
  const theirItems = isOwner ? trade?.trader_items || [] : trade?.owner_items || [];
  const canEdit = trade && !trade.trade.is_completed && !trade.trade.is_cancelled;

  return (
    <div className="min-h-screen bg-white" data-testid="messages-page">
      <Header />

      <main className="max-w-6xl mx-auto px-4 md:px-8 lg:px-12 py-8">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 h-[calc(100vh-180px)]">
          {/* Conversations List */}
          <ConversationList
            conversations={conversations}
            currentTradeId={tradeId}
            getInitials={getInitials}
          />

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
                      Trade: {trade.trade.owner_item_ids?.length || 0} ↔{" "}
                      {trade.trade.trader_item_ids?.length || 0} items
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
                  </div>

                  <TradeActions
                    trade={trade.trade}
                    isOwner={isOwner}
                    onConfirm={handleConfirm}
                    onCancel={handleCancel}
                    onReport={() => setIsReportOpen(true)}
                    isConfirming={isUpdating}
                    isCancelling={isUpdating}
                  />

                  <div className="flex gap-4 items-start mt-4">
                    {/* Their Items */}
                    <TradeItemList
                      items={theirItems}
                      label={`${partner.username || partner.name}'s items`}
                      canEdit={false}
                    />

                    {/* Arrow */}
                    <div className="flex items-center text-slate-400 pt-6">
                      <ArrowLeftRight className="w-5 h-5" />
                    </div>

                    {/* My Items */}
                    <TradeItemList
                      items={myItems}
                      label="Your items"
                      canEdit={canEdit}
                      onRemove={(itemId) => handleRemoveItem(itemId, myItems.length === 1)}
                      onAdd={() => {
                        const currentItemIds = myItems.map((i) => i.item_id);
                        fetchMyAvailableItems(currentItemIds);
                        setAddingItemTradeId(tradeId);
                      }}
                      removingItemId={removingItemId}
                    />
                  </div>
                </div>

                {/* Messages */}
                <ScrollArea className="flex-1 p-4">
                  <div className="space-y-4">
                    {messages.map((msg) => (
                      <MessageBubble
                        key={msg.message_id}
                        message={msg}
                        isSent={msg.sender_id === user.user_id}
                        onItemRequestResponse={() => {
                          fetchMessages();
                          fetchConversations();
                        }}
                      />
                    ))}
                    <div ref={messagesEndRef} />
                  </div>
                </ScrollArea>

                {/* Message Input */}
                <form onSubmit={handleSendMessage} className="p-4 border-t border-slate-100 flex gap-2">
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
      <Dialog
        open={!!addingItemTradeId}
        onOpenChange={(open) => !open && setAddingItemTradeId(null)}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add Item to Trade</DialogTitle>
          </DialogHeader>
          <div className="space-y-2 max-h-96 overflow-y-auto">
            {myAvailableItems.length === 0 ? (
              <p className="text-slate-500 text-center py-4">No available items to add</p>
            ) : trade && (() => {
              const isOwner = trade.trade.owner_id === user.user_id;
              const side = isOwner ? "owner" : "trader";
              return myAvailableItems.map((item) => (
                <div
                  key={item.item_id}
                  onClick={() => handleAddItem(item.item_id, side)}
                  className="p-3 border rounded-lg cursor-pointer hover:bg-slate-50"
                >
                  <div className="flex gap-3">
                    <img
                      src={item.image}
                      alt={item.title}
                      className="w-16 h-16 object-cover rounded"
                    />
                    <div className="flex-1">
                      <h4 className="font-medium">{item.title}</h4>
                      <p className="text-sm text-slate-500">{item.category}</p>
                    </div>
                  </div>
                </div>
              ));
            })()}
          </div>
        </DialogContent>
      </Dialog>

      {/* Delete Last Item Warning Dialog */}
      <AlertDialog
        open={deleteLastItemDialog.isOpen}
        onOpenChange={(open) =>
          !open && setDeleteLastItemDialog({ isOpen: false, tradeId: null, itemId: null })
        }
      >
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

      <ReportDialog
        isOpen={isReportOpen}
        onOpenChange={setIsReportOpen}
        reportType="trade"
        reportedTradeId={tradeId}
      />
    </div>
  );
};

export default Messages;
