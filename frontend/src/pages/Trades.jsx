import { useEffect, useState, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import axios from "axios";
import { useAuth } from "@/App";
import { Header } from "@/components/Header";
import { RatingModal } from "@/components/RatingModal";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { toast } from "sonner";
import { Loader2, Check, MessageCircle, Star } from "lucide-react";

const Trades = () => {
  const navigate = useNavigate();
  const { user, API } = useAuth();
  const [trades, setTrades] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [confirmingId, setConfirmingId] = useState(null);
  const [ratingModal, setRatingModal] = useState({ isOpen: false, trade: null, otherUser: null });
  const [isRating, setIsRating] = useState(false);

  const fetchTrades = useCallback(async () => {
    try {
      const response = await axios.get(`${API}/trades`, { withCredentials: true });
      setTrades(response.data);
    } catch (error) {
      console.error("Failed to fetch trades:", error);
    } finally {
      setIsLoading(false);
    }
  }, [API]);

  useEffect(() => {
    fetchTrades();
  }, [fetchTrades]);

  const handleConfirm = async (tradeId) => {
    setConfirmingId(tradeId);
    try {
      await axios.post(`${API}/trades/${tradeId}/confirm`, {}, { withCredentials: true });
      toast.success("Trade confirmed!");
      fetchTrades();
    } catch (error) {
      toast.error(error.response?.data?.detail || "Failed to confirm trade");
    } finally {
      setConfirmingId(null);
    }
  };

  const handleRate = async (rating) => {
    if (!ratingModal.trade) return;

    setIsRating(true);
    try {
      await axios.post(
        `${API}/trades/${ratingModal.trade.trade_id}/rate`,
        { rating },
        { withCredentials: true }
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

  const openRatingModal = (tradeData) => {
    const isOwner = tradeData.trade.owner_id === user.user_id;
    const otherUser = isOwner ? tradeData.trader : tradeData.owner;
    setRatingModal({ isOpen: true, trade: tradeData.trade, otherUser });
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

  const activeTrades = trades.filter((t) => !t.trade.is_completed);
  const completedTrades = trades.filter((t) => t.trade.is_completed);

  const TradeCard = ({ tradeData }) => {
    const { trade, item, owner, trader } = tradeData;
    const isOwner = trade.owner_id === user.user_id;
    const otherUser = isOwner ? trader : owner;
    const myConfirmed = isOwner ? trade.owner_confirmed : trade.trader_confirmed;
    const theirConfirmed = isOwner ? trade.trader_confirmed : trade.owner_confirmed;
    const canRate =
      trade.is_completed &&
      (isOwner ? trade.owner_rating === null : trade.trader_rating === null);

    return (
      <div
        className="bg-white rounded-2xl border border-slate-100 p-6 hover:shadow-md transition-shadow"
        data-testid={`trade-card-${trade.trade_id}`}
      >
        <div className="flex gap-4">
          {/* Item Image */}
          <div
            className="w-24 h-24 rounded-xl overflow-hidden flex-shrink-0 cursor-pointer"
            onClick={() => navigate(`/item/${item.item_id}`)}
          >
            <img
              src={item?.image}
              alt={item?.title}
              className="w-full h-full object-cover"
            />
          </div>

          {/* Details */}
          <div className="flex-1 min-w-0">
            <h3
              className="font-semibold text-slate-900 mb-1 truncate cursor-pointer hover:text-indigo-600"
              onClick={() => navigate(`/item/${item.item_id}`)}
            >
              {item?.title}
            </h3>

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

            {/* Status */}
            {!trade.is_completed && (
              <div className="flex items-center gap-2 mb-3">
                <Badge
                  variant={myConfirmed ? "default" : "outline"}
                  className={myConfirmed ? "bg-teal-600" : ""}
                >
                  {myConfirmed ? "You confirmed" : "Awaiting your confirmation"}
                </Badge>
                <Badge
                  variant={theirConfirmed ? "default" : "outline"}
                  className={theirConfirmed ? "bg-teal-600" : ""}
                >
                  {theirConfirmed ? "They confirmed" : "Awaiting their confirmation"}
                </Badge>
              </div>
            )}

            {trade.is_completed && (
              <Badge className="bg-teal-600 mb-3">Trade Completed</Badge>
            )}

            {/* Actions */}
            <div className="flex gap-2 flex-wrap">
              {!trade.is_completed && !myConfirmed && (
                <Button
                  onClick={() => handleConfirm(trade.trade_id)}
                  disabled={confirmingId === trade.trade_id}
                  className="bg-teal-600 hover:bg-teal-700 rounded-full"
                  data-testid={`confirm-btn-${trade.trade_id}`}
                >
                  {confirmingId === trade.trade_id ? (
                    <Loader2 className="w-4 h-4 mr-2 spinner" />
                  ) : (
                    <Check className="w-4 h-4 mr-2" />
                  )}
                  Trade Finished
                </Button>
              )}

              <Button
                variant="outline"
                onClick={() => navigate(`/messages/${otherUser.user_id}`)}
                className="rounded-full"
                data-testid={`message-btn-${trade.trade_id}`}
              >
                <MessageCircle className="w-4 h-4 mr-2" />
                Message
              </Button>

              {canRate && (
                <Button
                  variant="outline"
                  onClick={() => openRatingModal(tradeData)}
                  className="rounded-full text-amber-600 border-amber-200 hover:bg-amber-50"
                  data-testid={`rate-btn-${trade.trade_id}`}
                >
                  <Star className="w-4 h-4 mr-2" />
                  Rate Trade
                </Button>
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
    </div>
  );
};

export default Trades;
