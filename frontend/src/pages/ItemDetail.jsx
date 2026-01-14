import { useEffect, useState, useCallback } from "react";
import { useParams, useNavigate } from "react-router-dom";
import axios from "axios";
import { useAuth } from "@/App";
import { Header } from "@/components/Header";
import { DisplayRating } from "@/components/StarRating";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { toast } from "sonner";
import { ArrowLeftRight, MessageCircle, Loader2, ArrowLeft, Trash2 } from "lucide-react";

const ItemDetail = () => {
  const { itemId } = useParams();
  const navigate = useNavigate();
  const { user, API, getAuthHeaders } = useAuth();
  const [item, setItem] = useState(null);
  const [owner, setOwner] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isDeleting, setIsDeleting] = useState(false);
  const [isTradeOpen, setIsTradeOpen] = useState(false);
  const [isCreatingTrade, setIsCreatingTrade] = useState(false);
  const [myItems, setMyItems] = useState([]);
  const [selectedItemIds, setSelectedItemIds] = useState([]);
  const [isLoadingItems, setIsLoadingItems] = useState(false);
  const [preferredItems, setPreferredItems] = useState([]);

  const isOwner = user?.user_id === item?.user_id;

  const fetchItem = useCallback(async () => {
    try {
      const response = await axios.get(`${API}/items/${itemId}`, { withCredentials: true });
      setItem(response.data.item);
      setOwner(response.data.owner);
      
      // Fetch preferred items if desired_item_ids exist
      if (response.data.item.desired_item_ids && response.data.item.desired_item_ids.length > 0) {
        try {
          const itemsResponse = await axios.get(`${API}/items`, { withCredentials: true });
          const allItems = itemsResponse.data.items || [];
          const preferred = allItems.filter((i) =>
            response.data.item.desired_item_ids.includes(i.item_id)
          );
          setPreferredItems(preferred);
        } catch (error) {
          console.error("Failed to fetch preferred items:", error);
        }
      }
    } catch (error) {
      console.error("Failed to fetch item:", error);
      toast.error("Item not found");
      navigate("/dashboard");
    } finally {
      setIsLoading(false);
    }
  }, [API, itemId, navigate]);

  useEffect(() => {
    fetchItem();
  }, [fetchItem]);


  const fetchMyItems = useCallback(async () => {
    setIsLoadingItems(true);
    try {
      const headers = getAuthHeaders();
      const response = await axios.get(`${API}/my-items`, {
        withCredentials: true,
        headers: headers
      });
      // Filter to only available items
      const availableItems = response.data.filter(item => item.is_available);
      setMyItems(availableItems);
    } catch (error) {
      console.error("Failed to fetch items:", error);
      toast.error("Failed to load your items");
    } finally {
      setIsLoadingItems(false);
    }
  }, [API]); // getAuthHeaders is stable and doesn't need to be in dependencies

  const handleOpenTradeDialog = () => {
    setIsTradeOpen(true);
    setSelectedItemIds([]);
    fetchMyItems();
  };

  const handleToggleItem = (itemId) => {
    setSelectedItemIds(prev => {
      if (prev.includes(itemId)) {
        return prev.filter(id => id !== itemId);
      } else {
        if (prev.length >= 5) {
          toast.error("Maximum 5 items per side allowed");
          return prev;
        }
        return [...prev, itemId];
      }
    });
  };

  const handleStartTrade = async () => {
    if (selectedItemIds.length === 0) {
      toast.error("Please select at least one item to trade");
      return;
    }

    setIsCreatingTrade(true);
    try {
      const headers = getAuthHeaders();

      await axios.post(
        `${API}/trades`,
        {
          owner_item_ids: [itemId],
          trader_item_ids: selectedItemIds,
        },
        { 
          withCredentials: true,
          headers: headers
        }
      );
      toast.success("Trade initiated! Check your trades page.");
      setIsTradeOpen(false);
      setSelectedItemIds([]);
      navigate("/trades");
    } catch (error) {
      toast.error(error.response?.data?.detail || "Failed to start trade");
    } finally {
      setIsCreatingTrade(false);
    }
  };

  const handleDelete = async () => {
    if (!window.confirm("Are you sure you want to delete this item?")) return;

    setIsDeleting(true);
    try {
      const headers = getAuthHeaders();

      await axios.delete(`${API}/items/${itemId}`, { 
        withCredentials: true,
        headers: headers
      });
      toast.success("Item deleted");
      navigate("/my-items");
    } catch (error) {
      toast.error("Failed to delete item");
    } finally {
      setIsDeleting(false);
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

  if (!item) {
    return (
      <div className="min-h-screen bg-white">
        <Header />
        <div className="text-center py-20">
          <p className="text-slate-500 text-lg">Item not found</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-white" data-testid="item-detail-page">
      <Header />

      <main className="max-w-5xl mx-auto px-4 md:px-8 lg:px-12 py-8">
        {/* Back Button */}
        <Button
          variant="ghost"
          onClick={() => navigate(-1)}
          className="mb-6 text-slate-600 hover:text-slate-900"
          data-testid="back-btn"
        >
          <ArrowLeft className="w-4 h-4 mr-2" />
          Back
        </Button>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
          {/* Image */}
          <div className="rounded-2xl overflow-hidden bg-slate-100">
            <img
              src={item.image}
              alt={item.title}
              className="w-full h-full object-cover"
              style={{ minHeight: "400px" }}
              data-testid="item-image"
            />
          </div>

          {/* Details */}
          <div className="space-y-6">
            <div>
              <Badge className="mb-3 capitalize bg-slate-100 text-slate-600 border-0">
                {item.category}
              </Badge>
              <h1
                className="text-3xl font-bold text-slate-900 mb-3"
                style={{ fontFamily: "Manrope, sans-serif" }}
                data-testid="item-title"
              >
                {item.title}
              </h1>
              {item.description && (
                <p className="text-slate-600 leading-relaxed" data-testid="item-description">
                  {item.description}
                </p>
              )}
            </div>

            {/* Trade Preferences */}
            {(item.desired_category || (item.desired_item_ids && item.desired_item_ids.length > 0)) && (
              <div className="bg-indigo-50 rounded-2xl p-4 border border-indigo-100">
                <p className="text-sm font-medium text-indigo-900 mb-3">Trade Preferences</p>
                <p className="text-xs text-indigo-700 mb-3">
                  These preferences are informational only. You can still trade for this item regardless.
                </p>
                {item.desired_category && (
                  <div className="mb-3">
                    <p className="text-sm text-slate-600 mb-1">Looking for category:</p>
                    <Badge className="bg-indigo-100 text-indigo-700 border-0 capitalize">
                      {item.desired_category}
                    </Badge>
                  </div>
                )}
                {preferredItems.length > 0 && (
                  <div>
                    <p className="text-sm text-slate-600 mb-2">Interested in:</p>
                    <div className="flex flex-wrap gap-2">
                      {preferredItems.map((prefItem) => (
                        <Badge
                          key={prefItem.item_id}
                          variant="secondary"
                          className="cursor-pointer hover:bg-indigo-100"
                          onClick={() => navigate(`/item/${prefItem.item_id}`)}
                        >
                          {prefItem.title}
                        </Badge>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* Owner Card */}
            {owner && (
              <div
                className="bg-slate-50 rounded-2xl p-4 cursor-pointer hover:bg-slate-100 transition-colors"
                onClick={() => navigate(`/profile/${owner.user_id}`)}
                data-testid="owner-card"
              >
                <p className="text-sm text-slate-500 mb-2">Posted by</p>
                <div className="flex items-center gap-3">
                  <Avatar className="h-12 w-12">
                    <AvatarImage src={owner.picture} alt={owner.name} />
                    <AvatarFallback className="bg-indigo-100 text-indigo-600">
                      {getInitials(owner.name)}
                    </AvatarFallback>
                  </Avatar>
                  <div className="flex-1">
                    <p className="font-medium text-slate-900">
                      {owner.username || owner.name}
                    </p>
                    <div className="flex items-center gap-3 mt-1">
                      <span className="text-sm text-teal-600 font-medium">
                        {owner.trade_points || 0} trades
                      </span>
                      <DisplayRating rating={owner.rating} count={owner.rating_count} />
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* Actions */}
            {!isOwner && item.is_available && (
              <div className="flex gap-3">
                <Button
                  onClick={handleOpenTradeDialog}
                  className="flex-1 bg-indigo-600 hover:bg-indigo-700 text-white rounded-full py-6 shadow-lg hover:shadow-indigo-500/30 transition-all"
                  data-testid="trade-btn"
                >
                  <ArrowLeftRight className="w-5 h-5 mr-2" />
                  Start Trade
                </Button>
              </div>
            )}

            {isOwner && (
              <Button
                variant="destructive"
                onClick={handleDelete}
                disabled={isDeleting}
                className="rounded-full"
                data-testid="delete-btn"
              >
                <Trash2 className="w-4 h-4 mr-2" />
                {isDeleting ? "Deleting..." : "Delete Item"}
              </Button>
            )}

            {!item.is_available && (
              <div className="bg-slate-100 rounded-2xl p-4 text-center">
                <p className="text-slate-500">This item is no longer available</p>
              </div>
            )}
          </div>
        </div>
      </main>

      {/* Trade Confirmation Dialog */}
      <Dialog open={isTradeOpen} onOpenChange={setIsTradeOpen}>
        <DialogContent className="sm:max-w-lg max-h-[80vh] overflow-y-auto" data-testid="trade-modal">
          <DialogHeader>
            <DialogTitle style={{ fontFamily: "Manrope, sans-serif" }}>
              Start Trade
            </DialogTitle>
            <DialogDescription>
              Select items to trade for "{item.title}" (up to 5 items)
            </DialogDescription>
          </DialogHeader>

          <div className="py-4 space-y-4">
            <p className="text-sm text-slate-600">
              Choose one or more of your available items to trade. Both parties must confirm to complete the trade.
            </p>
            {selectedItemIds.length > 0 && (
              <p className="text-sm text-indigo-600 font-medium">
                {selectedItemIds.length} item{selectedItemIds.length > 1 ? 's' : ''} selected
              </p>
            )}

            {isLoadingItems ? (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="w-6 h-6 text-indigo-600 spinner" />
              </div>
            ) : myItems.length === 0 ? (
              <div className="text-center py-8 bg-slate-50 rounded-lg">
                <p className="text-slate-500 mb-4">You don't have any available items to trade.</p>
                <Button
                  onClick={() => {
                    setIsTradeOpen(false);
                    navigate("/post");
                  }}
                  className="bg-indigo-600 hover:bg-indigo-700"
                >
                  Post an Item
                </Button>
              </div>
            ) : (
              <div className="space-y-2 max-h-96 overflow-y-auto">
                {myItems.map((myItem) => (
                  <div
                    key={myItem.item_id}
                    onClick={() => handleToggleItem(myItem.item_id)}
                    className={`p-3 border-2 rounded-lg cursor-pointer transition-all ${
                      selectedItemIds.includes(myItem.item_id)
                        ? "border-indigo-600 bg-indigo-50"
                        : "border-slate-200 hover:border-indigo-300"
                    }`}
                  >
                    <div className="flex gap-3">
                      <img
                        src={myItem.image}
                        alt={myItem.title}
                        className="w-16 h-16 object-cover rounded"
                      />
                      <div className="flex-1">
                        <h4 className="font-medium text-slate-900">{myItem.title}</h4>
                        <p className="text-sm text-slate-500">{myItem.category}</p>
                      </div>
                      {selectedItemIds.includes(myItem.item_id) && (
                        <div className="flex items-center text-indigo-600">
                          ✓
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setIsTradeOpen(false)}>
              Cancel
            </Button>
            <Button
              onClick={handleStartTrade}
              disabled={isCreatingTrade || selectedItemIds.length === 0 || myItems.length === 0}
              className="bg-indigo-600 hover:bg-indigo-700"
              data-testid="confirm-trade-btn"
            >
              {isCreatingTrade ? "Starting..." : "Start Trade"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default ItemDetail;
