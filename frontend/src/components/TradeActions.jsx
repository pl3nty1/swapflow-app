import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Check, X, Loader2, AlertTriangle } from "lucide-react";

/**
 * Component for trade action buttons and status badges
 */
export const TradeActions = ({
  trade,
  isOwner,
  onConfirm,
  onCancel,
  onReport,
  isConfirming = false,
  isCancelling = false,
}) => {
  const myConfirmed = isOwner ? trade.owner_confirmed : trade.trader_confirmed;
  const theirConfirmed = isOwner ? trade.trader_confirmed : trade.owner_confirmed;
  const canEdit = !trade.is_completed && !trade.is_cancelled;

  return (
    <div className="space-y-3">
      {/* Status Badges */}
      <div className="flex items-center gap-2 flex-wrap">
        {trade.is_completed && (
          <Badge className="bg-teal-600">Completed</Badge>
        )}
        {trade.is_cancelled && (
          <Badge className="bg-slate-400">Cancelled</Badge>
        )}
        {!trade.is_completed && (
          <>
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
          </>
        )}
      </div>

      {/* Action Buttons */}
      {canEdit && (
        <div className="flex gap-2 flex-wrap">
          {!myConfirmed && (
            <Button
              onClick={onConfirm}
              disabled={isConfirming}
              size="sm"
              className="bg-teal-600 hover:bg-teal-700 rounded-full"
            >
              {isConfirming ? (
                <Loader2 className="w-4 h-4 mr-2 spinner" />
              ) : (
                <Check className="w-4 h-4 mr-2" />
              )}
              Trade Finished
            </Button>
          )}
          <Button
            variant="outline"
            onClick={onCancel}
            disabled={isCancelling}
            size="sm"
            className="rounded-full text-red-600 border-red-200 hover:bg-red-50"
          >
            <X className="w-4 h-4 mr-2" />
            Cancel Trade
          </Button>
        </div>
      )}

      {/* Report Button (only for completed trades) */}
      {trade.is_completed && onReport && (
        <Button
          onClick={onReport}
          variant="outline"
          size="sm"
          className="border-red-300 text-red-600 hover:bg-red-50"
        >
          <AlertTriangle className="w-4 h-4 mr-2" />
          Report Trade
        </Button>
      )}
    </div>
  );
};
