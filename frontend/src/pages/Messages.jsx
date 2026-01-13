import { useEffect, useState, useCallback, useRef } from "react";
import { useParams, useNavigate } from "react-router-dom";
import axios from "axios";
import { useAuth } from "@/App";
import { Header } from "@/components/Header";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { toast } from "sonner";
import { Send, Loader2, ArrowLeft, MessageCircle } from "lucide-react";

const Messages = () => {
  const { partnerId } = useParams();
  const navigate = useNavigate();
  const { user, API, getAuthHeaders } = useAuth();
  const [conversations, setConversations] = useState([]);
  const [messages, setMessages] = useState([]);
  const [partner, setPartner] = useState(null);
  const [newMessage, setNewMessage] = useState("");
  const [isLoading, setIsLoading] = useState(true);
  const [isSending, setIsSending] = useState(false);
  const messagesEndRef = useRef(null);
  const wsRef = useRef(null);

  const fetchConversations = useCallback(async () => {
    try {
      // #region agent log
      fetch('http://127.0.0.1:7242/ingest/7e1d3f60-34a1-4d7e-99ac-6c65e0f8e90f',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'Messages.jsx:25',message:'fetchConversations entry',data:{hasGetAuthHeaders:typeof getAuthHeaders==='function',sessionToken:localStorage.getItem('session_token')},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'F'})}).catch(()=>{});
      // #endregion
      const headers = getAuthHeaders();
      // #region agent log
      fetch('http://127.0.0.1:7242/ingest/7e1d3f60-34a1-4d7e-99ac-6c65e0f8e90f',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'Messages.jsx:27',message:'fetchConversations headers',data:{headers:JSON.stringify(headers),hasAuth:!!headers.Authorization},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'F'})}).catch(()=>{});
      // #endregion
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
  }, [API, getAuthHeaders]);

  const fetchMessages = useCallback(async () => {
    if (!partnerId) return;

    try {
      // #region agent log
      fetch('http://127.0.0.1:7242/ingest/7e1d3f60-34a1-4d7e-99ac-6c65e0f8e90f',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'Messages.jsx:36',message:'fetchMessages entry',data:{hasGetAuthHeaders:typeof getAuthHeaders==='function',sessionToken:localStorage.getItem('session_token')},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'F'})}).catch(()=>{});
      // #endregion
      const headers = getAuthHeaders();
      // #region agent log
      fetch('http://127.0.0.1:7242/ingest/7e1d3f60-34a1-4d7e-99ac-6c65e0f8e90f',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'Messages.jsx:40',message:'fetchMessages headers',data:{headers:JSON.stringify(headers),hasAuth:!!headers.Authorization},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'F'})}).catch(()=>{});
      // #endregion
      const [messagesRes, partnerRes] = await Promise.all([
        axios.get(`${API}/messages/${partnerId}`, { 
          withCredentials: true,
          headers: headers
        }),
        axios.get(`${API}/users/${partnerId}`, { 
          withCredentials: true,
          headers: headers
        }),
      ]);
      setMessages(messagesRes.data);
      setPartner(partnerRes.data);
    } catch (error) {
      // #region agent log
      fetch('http://127.0.0.1:7242/ingest/7e1d3f60-34a1-4d7e-99ac-6c65e0f8e90f',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'Messages.jsx:48',message:'fetchMessages error',data:{status:error.response?.status,detail:error.response?.data?.detail,message:error.message},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'F'})}).catch(()=>{});
      // #endregion
      console.error("Failed to fetch messages:", error);
      toast.error("Failed to load messages");
    }
  }, [API, partnerId, getAuthHeaders]);

  useEffect(() => {
    fetchConversations();
  }, [fetchConversations]);

  useEffect(() => {
    if (partnerId) {
      fetchMessages();
      // Mark messages as read when viewing conversation
      const markAsRead = async () => {
        try {
          const headers = getAuthHeaders();
          await axios.post(
            `${API}/messages/${partnerId}/mark-read`,
            {},
            { withCredentials: true, headers: headers }
          );
          fetchConversations(); // Refresh to update unread counts
        } catch (error) {
          console.error("Failed to mark messages as read:", error);
        }
      };
      markAsRead();
    }
  }, [partnerId, fetchMessages, API, getAuthHeaders, fetchConversations]);

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

        ws.onmessage = (event) => {
          try {
            const data = JSON.parse(event.data);
            if (data.type === "new_message") {
              const newMsg = data.message;
              // Add message if it's for current conversation
              if (partnerId && (newMsg.sender_id === partnerId || newMsg.receiver_id === partnerId)) {
                setMessages((prev) => {
                  // Avoid duplicates
                  if (prev.some((m) => m.message_id === newMsg.message_id)) {
                    return prev;
                  }
                  return [...prev, newMsg];
                });
              }
              // Refresh conversations to update unread counts
              fetchConversations();
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
  }, [API, partnerId, fetchConversations]);

  useEffect(() => {
    // Auto-scroll to bottom
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const handleSendMessage = async (e) => {
    e.preventDefault();
    if (!newMessage.trim() || !partnerId) return;

    setIsSending(true);
    try {
      // #region agent log
      fetch('http://127.0.0.1:7242/ingest/7e1d3f60-34a1-4d7e-99ac-6c65e0f8e90f',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'Messages.jsx:67',message:'handleSendMessage entry',data:{hasGetAuthHeaders:typeof getAuthHeaders==='function',sessionToken:localStorage.getItem('session_token')},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'A'})}).catch(()=>{});
      // #endregion
      const headers = getAuthHeaders();
      // #region agent log
      fetch('http://127.0.0.1:7242/ingest/7e1d3f60-34a1-4d7e-99ac-6c65e0f8e90f',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'Messages.jsx:74',message:'headers generated',data:{headers:JSON.stringify(headers),hasAuth:!!headers.Authorization},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'B'})}).catch(()=>{});
      // #endregion

      const response = await axios.post(
        `${API}/messages`,
        {
          receiver_id: partnerId,
          content: newMessage.trim(),
        },
        { 
          withCredentials: true,
          headers: headers
        }
      );
      setMessages((prev) => [...prev, response.data]);
      setNewMessage("");
      fetchConversations(); // Refresh conversation list
    } catch (error) {
      // #region agent log
      fetch('http://127.0.0.1:7242/ingest/7e1d3f60-34a1-4d7e-99ac-6c65e0f8e90f',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'Messages.jsx:91',message:'send message error',data:{status:error.response?.status,detail:error.response?.data?.detail,message:error.message},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'C'})}).catch(()=>{});
      // #endregion
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

  const formatTime = (dateStr) => {
    const date = new Date(dateStr);
    return date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
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
                      key={conv.partner.user_id}
                      onClick={() => navigate(`/messages/${conv.partner.user_id}`)}
                      className={`p-4 cursor-pointer hover:bg-slate-50 transition-colors border-b border-slate-50 ${
                        partnerId === conv.partner.user_id ? "bg-slate-50" : ""
                      } ${hasUnread ? "bg-indigo-50" : ""}`}
                      data-testid={`conversation-${conv.partner.user_id}`}
                    >
                      <div className="flex items-center gap-3">
                        <div className="relative">
                          <Avatar className="h-10 w-10">
                            <AvatarImage src={conv.partner.picture} alt={conv.partner.name} />
                            <AvatarFallback className="bg-indigo-100 text-indigo-600">
                              {getInitials(conv.partner.name)}
                            </AvatarFallback>
                          </Avatar>
                          {hasUnread && (
                            <div className="absolute -top-1 -right-1 w-4 h-4 bg-red-500 rounded-full border-2 border-white flex items-center justify-center">
                              <span className="text-xs text-white font-bold">{unreadCount > 9 ? "9+" : unreadCount}</span>
                            </div>
                          )}
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2">
                            <p className={`font-medium truncate ${hasUnread ? "font-semibold" : ""}`}>
                              {conv.partner.username || conv.partner.name}
                            </p>
                            {hasUnread && (
                              <div className="w-2 h-2 bg-red-500 rounded-full flex-shrink-0" />
                            )}
                          </div>
                          <p className={`text-sm truncate ${hasUnread ? "text-slate-900 font-medium" : "text-slate-500"}`}>
                            {conv.last_message}
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
            {partnerId && partner ? (
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
                  <div>
                    <p
                      className="font-medium text-slate-900 cursor-pointer hover:text-indigo-600"
                      onClick={() => navigate(`/profile/${partner.user_id}`)}
                    >
                      {partner.username || partner.name}
                    </p>
                  </div>
                </div>

                {/* Messages */}
                <ScrollArea className="flex-1 p-4">
                  <div className="space-y-4">
                    {messages.map((msg) => {
                      const isSent = msg.sender_id === user.user_id;
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
                            <p className="break-words">{msg.content}</p>
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
            ) : (
              <div className="flex-1 flex items-center justify-center text-slate-500">
                <div className="text-center">
                  <MessageCircle className="w-12 h-12 mx-auto mb-4 text-slate-300" />
                  <p>Select a conversation to start messaging</p>
                </div>
              </div>
            )}
          </div>
        </div>
      </main>
    </div>
  );
};

export default Messages;
