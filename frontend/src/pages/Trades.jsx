import { useEffect, useState, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import axios from "axios";
import { useAuth } from "@/App";
import { useTrades } from "@/hooks/useTrades";
import { Header } from "@/components/Header";
import { RatingModal } from "@/components/RatingModal";
import { ReportDialog } from "@/components/ReportDialog";
import { TradeItemList } from "@/components/TradeItemList";
import { TradeActions } from "@/components/TradeActions";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
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
import { Loader2, MessageCircle, Star, ArrowLeftRight, Trash2, Plus } from "lucide-react";
import { toast } from "sonner";

const Trades = () => {
  const navigate = useNavigate();
  const { user, API, getAuthHeaders } = useAuth();
  const [ratingModal, setRatingModal] = useState({ isOpen: false, trade: null, otherUser: null });
  const [isRating, setIsRating] = useState(false);
  const [cancelDialog, setCancelDialog] = useState({ isOpen: false, tradeId: null });
  const [addingItemTradeId, setAddingItemTradeId] = useState(null);
  const [myAvailableItems, setMyAvailableItems] = useState([]);
  const [deleteLastItemDialog, setDeleteLastItemDialog] = useState({
    isOpen: false,
    tradeId: null,
    itemId: null,
  });
  const [reportDialog, setReportDialog] = useState({ isOpen: false, tradeId: null });

  // Use custom hook
  const {
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
  } = useTrades();

  useEffect(() => {
    fetchTrades();
  }, [fetchTrades]);

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
    async (tradeId, currentItemIds) => {
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

  // Handle trade confirmation
  const handleConfirm = async (tradeId) => {
    await confirmTrade(tradeId);
  };

  // Handle rating submission
  const handleRate = async (rating) => {
    if (!ratingModal.trade) return;

    setIsRating(true);
    try {
      const headers = getAuthHeaders();
      await axios.post(
        `${API}/trades/${ratingModal.trade.trade_id}/rate`,
        { rating },
        {
          withCredentials: true,
          headers: headers,
        }
      );
      toast.success("Rating submitted!");
      setRatingModal({ isOpen: false, trade: null, otherUser: null });
      fetchTrades();
    } catch (error) {
      toast.error(error.response?.data?.detail || "Failed to submit rating");
    } finally {
      setIsRating(false);
    }
  };

  // Open rating modal
  const openRatingModal = (tradeData) => {
    const isOwner = tradeData.trade.owner_id === user.user_id;
    const otherUser = isOwner ? tradeData.trader : tradeData.owner;
    setRatingModal({ isOpen: true, trade: tradeData.trade, otherUser });
  };

  // Handle trade cancellation
  const handleCancelTrade = async () => {
    if (!cancelDialog.tradeId) return;
    await cancelTrade(cancelDialog.tradeId);
    setCancelDialog({ isOpen: false, tradeId: null });
  };

  // Handle adding item to trade
  const handleAddItem = async (tradeId, itemId, side) => {
    await addItem(tradeId, itemId, side);
    setAddingItemTradeId(null);
  };

  // Handle removing item from trade
  const handleRemoveItem = async (tradeId, itemId, isLastItem = false) => {
    if (isLastItem) {
      setDeleteLastItemDialog({ isOpen: true, tradeId, itemId });
      return;
    }
    await removeItem(tradeId, itemId);
  };

  // Handle confirming deletion of last item
  const handleConfirmDeleteLastItem = async () => {
    const { tradeId, itemId } = deleteLastItemDialog;
    if (!tradeId || !itemId) return;

    try {
      const headers = getAuthHeaders();
      await axios.delete(`${API}/trades/${tradeId}/items/${itemId}`, {
        withCredentials: true,
        headers: headers,
      });
      await axios.delete(`${API}/trades/${tradeId}`, {
        withCredentials: true,
        headers: headers,
      });
      toast.success("Item removed and trade cancelled");
      fetchTrades();
      setDeleteLastItemDialog({ isOpen: false, tradeId: null, itemId: null });
    } catch (error) {
      toast.error(error.response?.data?.detail || "Failed to remove item");
    }
  };

  // Trade card component
  const TradeCard = ({ tradeData }) => {
    const { trade, owner_items = [], trader_items = [], owner, trader } = tradeData;
    // Backward compatibility: if old format exists, convert to arrays
    const ownerItems =
      owner_items.length > 0 ? owner_items : tradeData.item ? [tradeData.item] : [];
    const traderItems =
      trader_items.length > 0 ? trader_items : tradeData.trader_item ? [tradeData.trader_item] : [];

    const isOwner = trade.owner_id === user.user_id;
    const otherUser = isOwner ? trader : owner;
    const myItems = isOwner ? ownerItems : traderItems;
    const theirItems = isOwner ? traderItems : ownerItems;
    const canCancel = !trade.is_completed && !trade.is_cancelled;
    const canRate =
      trade.is_completed &&
      (isOwner ? trade.owner_rating === null : trade.trader_rating === null);

    return (
      <div
        className="bg-white rounded-2xl border border-slate-100 p-6 hover:shadow-md transition-shadow"
        data-testid={`trade-card-${trade.trade_id}`}
      >
        <div className="flex gap-4">
          {/* Items Display */}
          <div className="flex gap-3 flex-shrink-0">
            {/* Their items */}
            <div className="flex flex-col gap-2">
              <p className="text-xs text-slate-500 text-center">
                {otherUser?.username || otherUser?.name}'s items
              </p>
              <div className="flex flex-col gap-2">
                {theirItems.map((item) => (
                  <div
                    key={item.item_id}
                    className="w-20 h-20 rounded-xl overflow-hidden cursor-pointer border-2 border-indigo-200"
                    onClick={() => navigate(`/item/${item.item_id}`)}
                  >
                    <img
                      src={item.image}
                      alt={item.title}
                      className="w-full h-full object-cover"
                    />
                  </div>
                ))}
              </div>
            </div>

            {/* Arrow */}
            <div className="flex items-center text-slate-400">
              <ArrowLeftRight className="w-5 h-5" />
            </div>

            {/* My items */}
            <div className="flex flex-col gap-2">
              <p className="text-xs text-slate-500 text-center">Your items</p>
              <div className="flex flex-col gap-2">
                {myItems.map((item) => (
                  <div key={item.item_id} className="relative group">
                    <div
                      className="w-20 h-20 rounded-xl overflow-hidden cursor-pointer border-2 border-indigo-200"
                      onClick={() => navigate(`/item/${item.item_id}`)}
                    >
                      <img
                        src={item.image}
                        alt={item.title}
                        className="w-full h-full object-cover"
                      />
                    </div>
                    {canCancel && (
                      <button
                        onClick={() => handleRemoveItem(trade.trade_id, item.item_id, myItems.length === 1)}
                        disabled={updatingTradeId === item.item_id}
                        className="absolute -top-2 -right-2 bg-red-500 text-white rounded-full p-1 opacity-0 group-hover:opacity-100 transition-opacity"
                      >
                        <Trash2 className="w-3 h-3" />
                      </button>
                    )}
                  </div>
                ))}
                {canCancel && myItems.length < 5 && (
                  <button
                    onClick={() => {
                      const currentItemIds = myItems.map((i) => i.item_id);
                      fetchMyAvailableItems(trade.trade_id, currentItemIds);
                      setAddingItemTradeId(trade.trade_id);
                    }}
                    className="w-20 h-20 rounded-xl border-2 border-dashed border-slate-300 hover:border-indigo-400 flex items-center justify-center text-slate-400 hover:text-indigo-600 transition-colors"
                  >
                    <Plus className="w-5 h-5" />
                  </button>
                )}
              </div>
            </div>
          </div>

          {/* Details */}
          <div className="flex-1 min-w-0">
            <div className="mb-2">
              <div className="flex items-center gap-2 mb-1">
                <span className="text-sm text-slate-600">
                  {theirItems.length} item{theirItems.length !== 1 ? "s" : ""} ↔ {myItems.length}{" "}
                  item{myItems.length !== 1 ? "s" : ""}
                </span>
              </div>
            </div>

            {/* Other User */}
            <div
              className="flex items-center gap-2 mb-3 cursor-pointer"
              onClick={() => navigate(`/profile/${otherUser.user_id}`)}
            >
              <Avatar className="h-6 w-6">
                <AvatarImage src={otherUser?.picture} alt={otherUser?.name} />
                <AvatarFallback className="bg-indigo-100 text-indigo-600 text-xs">
                  {getInitials(otherUser?.name)}
                </AvatarFallback>
              </Avatar>
              <span className="text-sm text-slate-600">
                Trading with {otherUser?.username || otherUser?.name}
              </span>
            </div>

            {/* Trade Actions */}
            <TradeActions
              trade={trade}
              isOwner={isOwner}
              onConfirm={() => handleConfirm(trade.trade_id)}
              onCancel={() => setCancelDialog({ isOpen: true, tradeId: trade.trade_id })}
              onReport={() => setReportDialog({ isOpen: true, tradeId: trade.trade_id })}
              isConfirming={updatingTradeId === trade.trade_id}
              isCancelling={updatingTradeId === trade.trade_id}
            />

            {/* Additional Actions */}
            <div className="flex gap-2 flex-wrap mt-3">
              <Button
                variant="outline"
                onClick={() => navigate(`/messages/${trade.trade_id}`)}
                className="rounded-full"
                data-testid={`message-btn-${trade.trade_id}`}
              >
                <MessageCircle className="w-4 h-4 mr-2" />
                Message
              </Button>

              {canRate && (
                <>
                  <Button
                    variant="outline"
                    onClick={() => openRatingModal(tradeData)}
                    className="rounded-full text-amber-600 border-amber-200 hover:bg-amber-50"
                    data-testid={`rate-btn-${trade.trade_id}`}
                  >
                    <Star className="w-4 h-4 mr-2" />
                    Rate Trade
                  </Button>
                </>
              )}
            </div>
          </div>
        </div>
      </div>
    );
  };

  return (
    <div className="min-h-screen bg-white" data-testid="trades-page">
      <Header />

      <main className="max-w-4xl mx-auto px-4 md:px-8 lg:px-12 py-8">
        <h1
          className="text-3xl font-bold text-slate-900 mb-8"
          style={{ fontFamily: "Manrope, sans-serif" }}
        >
          My Trades
        </h1>

        {isLoading ? (
          <div className="flex items-center justify-center py-20">
            <Loader2 className="w-8 h-8 text-indigo-600 spinner" />
          </div>
        ) : trades.length === 0 ? (
          <div className="text-center py-20 bg-slate-50 rounded-2xl">
            <p className="text-slate-500 text-lg mb-4">No trades yet</p>
            <Button
              onClick={() => navigate("/dashboard")}
              className="bg-indigo-600 hover:bg-indigo-700 text-white rounded-full"
            >
              Browse Items
            </Button>
          </div>
        ) : (
          <Tabs defaultValue="active" className="w-full">
            <TabsList className="mb-6">
              <TabsTrigger value="active" data-testid="active-tab">
                Active ({activeTrades.length})
              </TabsTrigger>
              <TabsTrigger value="completed" data-testid="completed-tab">
                Completed ({completedTrades.length})
              </TabsTrigger>
            </TabsList>

            <TabsContent value="active" className="space-y-4">
              {activeTrades.length === 0 ? (
                <div className="text-center py-12 bg-slate-50 rounded-2xl">
                  <p className="text-slate-500">No active trades</p>
                </div>
              ) : (
                activeTrades.map((t) => <TradeCard key={t.trade.trade_id} tradeData={t} />)
              )}
            </TabsContent>

            <TabsContent value="completed" className="space-y-4">
              {completedTrades.length === 0 ? (
                <div className="text-center py-12 bg-slate-50 rounded-2xl">
                  <p className="text-slate-500">No completed trades yet</p>
                </div>
              ) : (
                completedTrades.map((t) => <TradeCard key={t.trade.trade_id} tradeData={t} />)
              )}
            </TabsContent>
          </Tabs>
        )}
      </main>

      {/* Rating Modal */}
      <RatingModal
        isOpen={ratingModal.isOpen}
        onClose={() => setRatingModal({ isOpen: false, trade: null, otherUser: null })}
        onSubmit={handleRate}
        user={ratingModal.otherUser}
        isLoading={isRating}
      />

      {/* Cancel Trade Confirmation Dialog */}
      <AlertDialog
        open={cancelDialog.isOpen}
        onOpenChange={(open) => !open && setCancelDialog({ isOpen: false, tradeId: null })}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Cancel Trade?</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to cancel this trade? This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Keep Trade</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleCancelTrade}
              className="bg-red-600 hover:bg-red-700"
            >
              Cancel Trade
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

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
            ) : (
              myAvailableItems.map((item) => {
                const currentTrade = trades.find((t) => t.trade.trade_id === addingItemTradeId);
                if (!currentTrade) return null;
                const isOwner = currentTrade.trade.owner_id === user.user_id;
                const side = isOwner ? "owner" : "trader";
                return (
                  <div
                    key={item.item_id}
                    onClick={() => handleAddItem(addingItemTradeId, item.item_id, side)}
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
                );
              })
            )}
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
              Removing this item will cancel the trade since you'll have no items left to trade. Are
              you sure you want to proceed?
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleConfirmDeleteLastItem}
              className="bg-red-600 hover:bg-red-700"
            >
              Remove Item & Cancel Trade
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <ReportDialog
        isOpen={reportDialog.isOpen}
        onOpenChange={(open) => setReportDialog({ isOpen: open, tradeId: reportDialog.tradeId })}
        reportType="trade"
        reportedTradeId={reportDialog.tradeId}
      />
    </div>
  );
};

export default Trades;
