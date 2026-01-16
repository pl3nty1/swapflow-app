import { Button } from "@/components/ui/button";
import axios from "axios";
import { useAuth } from "@/App";
import { toast } from "sonner";

/**
 * Message bubble component for displaying chat messages
 * Handles text messages and item request messages
 */
export const MessageBubble = ({ message, isSent, onItemRequestResponse }) => {
  const { user, API, getAuthHeaders } = useAuth();
  const isItemRequest =
    message.message_type === "item_request" &&
    message.item_request_data?.status === "pending";

  const formatTime = (dateStr) => {
    const date = new Date(dateStr);
    return date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
  };

  const handleItemRequestResponse = async (accepted, requestId, tradeId) => {
    try {
      const headers = getAuthHeaders();
      await axios.post(
        `${API}/trades/${tradeId}/items/request/${requestId}/respond`,
        { accepted },
        { withCredentials: true, headers: headers }
      );
      toast.success(accepted ? "Item request accepted" : "Item request declined");
      if (onItemRequestResponse) {
        onItemRequestResponse();
      }
    } catch (error) {
      toast.error(
        error.response?.data?.detail ||
          `Failed to ${accepted ? "accept" : "decline"} request`
      );
    }
  };

  return (
    <div className={`flex ${isSent ? "justify-end" : "justify-start"}`}>
      <div
        className={`max-w-[70%] px-4 py-2 ${
          isSent ? "message-sent" : "message-received"
        }`}
        data-testid={`message-${message.message_id}`}
      >
        {isItemRequest && !isSent ? (
          <div className="space-y-2">
            <p className="break-words">{message.content}</p>
            <div className="flex gap-2">
              <Button
                size="sm"
                onClick={() =>
                  handleItemRequestResponse(
                    true,
                    message.item_request_data.request_id,
                    message.trade_id
                  )
                }
                className="bg-teal-600 hover:bg-teal-700"
              >
                Accept
              </Button>
              <Button
                size="sm"
                variant="outline"
                onClick={() =>
                  handleItemRequestResponse(
                    false,
                    message.item_request_data.request_id,
                    message.trade_id
                  )
                }
              >
                Decline
              </Button>
            </div>
          </div>
        ) : (
          <p className="break-words">{message.content}</p>
        )}
        <p
          className={`text-xs mt-1 ${
            isSent ? "text-indigo-200" : "text-slate-400"
          }`}
        >
          {formatTime(message.created_at)}
        </p>
      </div>
    </div>
  );
};
