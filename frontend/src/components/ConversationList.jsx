import { useNavigate } from "react-router-dom";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { ScrollArea } from "@/components/ui/scroll-area";

/**
 * Component for displaying the list of conversations
 */
export const ConversationList = ({ conversations, currentTradeId, getInitials }) => {
  const navigate = useNavigate();

  const truncateMessage = (message, maxLength = 50) => {
    if (!message) return "No messages yet";
    if (message.length <= maxLength) return message;
    return message.substring(0, maxLength) + "...";
  };

  return (
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
                  currentTradeId === conv.trade_id ? "bg-slate-50" : ""
                } ${hasUnread ? "bg-indigo-50" : ""}`}
                data-testid={`conversation-${conv.trade_id}`}
              >
                <div className="flex items-center gap-3">
                  <Avatar className="h-10 w-10 flex-shrink-0">
                    <AvatarImage
                      src={conv.partner.picture}
                      alt={conv.partner.name}
                    />
                    <AvatarFallback className="bg-indigo-100 text-indigo-600">
                      {getInitials(conv.partner.name)}
                    </AvatarFallback>
                  </Avatar>
                  <div className="flex-1 min-w-0 overflow-hidden">
                    <div className="flex items-center min-w-0">
                      <p
                        className={`font-medium truncate ${
                          hasUnread ? "font-semibold" : ""
                        }`}
                      >
                        {conv.partner.username || conv.partner.name}
                      </p>
                      {hasUnread && (
                        <div className="w-2 h-2 bg-red-500 rounded-full flex-shrink-0 ml-1.5" />
                      )}
                    </div>
                    <p
                      className={`text-sm truncate ${
                        hasUnread ? "text-slate-900 font-medium" : "text-slate-500"
                      }`}
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
  );
};
