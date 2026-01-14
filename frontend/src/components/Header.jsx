import { Link, useNavigate, useLocation } from "react-router-dom";
import { useEffect, useState, useCallback, useRef } from "react";
import axios from "axios";
import { useAuth } from "@/App";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { ArrowLeftRight, Plus, MessageCircle, User, LogOut, Package, Shield, Bell, X } from "lucide-react";

export const Header = () => {
  const { user, logout, API, getAuthHeaders } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [unreadCount, setUnreadCount] = useState(0);
  const [notifications, setNotifications] = useState([]);
  const [notificationCount, setNotificationCount] = useState(0);
  const notificationWsRef = useRef(null);

  const handleLogout = async () => {
    await logout();
    navigate("/");
  };

  const fetchUnreadCount = useCallback(async () => {
    if (!user) return;
    try {
      const headers = getAuthHeaders();
      const response = await axios.get(`${API}/messages/unread-count`, {
        withCredentials: true,
        headers: headers
      });
      setUnreadCount(response.data.unread_count || 0);
    } catch (error) {
      console.error("Failed to fetch unread count:", error);
    }
  }, [user, API]); // getAuthHeaders is stable and doesn't need to be in dependencies

  useEffect(() => {
    fetchUnreadCount();
    // Poll for unread count every 10 seconds
    const interval = setInterval(fetchUnreadCount, 10000);
    return () => clearInterval(interval);
  }, [fetchUnreadCount]);

  // Refresh unread count when navigating to/from messages
  useEffect(() => {
    if (location.pathname === "/messages" || location.pathname.startsWith("/messages/")) {
      fetchUnreadCount();
    }
  }, [location.pathname, fetchUnreadCount]);

  // Listen for messages being marked as read
  useEffect(() => {
    const handleMessagesRead = () => {
      fetchUnreadCount();
    };
    window.addEventListener('messagesRead', handleMessagesRead);
    return () => window.removeEventListener('messagesRead', handleMessagesRead);
  }, [fetchUnreadCount]);

  // Fetch notifications
  const fetchNotifications = useCallback(async () => {
    if (!user) return;
    try {
      const headers = getAuthHeaders();
      const response = await axios.get(`${API}/notifications`, {
        withCredentials: true,
        headers: headers
      });
      setNotifications(response.data);
      setNotificationCount(response.data.length);
    } catch (error) {
      console.error("Failed to fetch notifications:", error);
    }
  }, [user, API, getAuthHeaders]);

  // WebSocket connection for notifications
  useEffect(() => {
    if (!user) return;

    const connectNotificationWebSocket = () => {
      const token = localStorage.getItem("session_token");
      if (!token) return;

      const wsProtocol = window.location.protocol === "https:" ? "wss:" : "ws:";
      const wsHost = API.replace(/^https?:\/\//, "").replace(/^http:\/\//, "");
      const wsUrl = `${wsProtocol}//${wsHost}/ws/notifications?token=${token}`;

      try {
        const ws = new WebSocket(wsUrl);
        notificationWsRef.current = ws;

        ws.onopen = () => {
          console.log("Notification WebSocket connected");
          fetchNotifications(); // Fetch initial notifications
        };

        ws.onmessage = async (event) => {
          try {
            const data = JSON.parse(event.data);
            if (data.type === "new_notification") {
              setNotifications((prev) => [data.notification, ...prev]);
              setNotificationCount((prev) => prev + 1);
            }
          } catch (error) {
            console.error("Failed to parse notification WebSocket message:", error);
          }
        };

        ws.onerror = (error) => {
          console.error("Notification WebSocket error:", error);
        };

        ws.onclose = () => {
          console.log("Notification WebSocket disconnected, reconnecting...");
          setTimeout(connectNotificationWebSocket, 3000);
        };
      } catch (error) {
        console.error("Failed to connect notification WebSocket:", error);
      }
    };

    connectNotificationWebSocket();

    return () => {
      if (notificationWsRef.current) {
        notificationWsRef.current.close();
      }
    };
  }, [user, API, fetchNotifications]);

  const handleDismissNotification = async (notificationId) => {
    try {
      const headers = getAuthHeaders();
      await axios.post(`${API}/notifications/${notificationId}/dismiss`, {}, {
        withCredentials: true,
        headers: headers
      });
      setNotifications((prev) => prev.filter((n) => n.notification_id !== notificationId));
      setNotificationCount((prev) => Math.max(0, prev - 1));
    } catch (error) {
      console.error("Failed to dismiss notification:", error);
    }
  };

  const formatTimeAgo = (dateStr) => {
    const date = new Date(dateStr);
    const now = new Date();
    const diffMs = now - date;
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);

    if (diffMins < 1) return "Just now";
    if (diffMins < 60) return `${diffMins}m ago`;
    if (diffHours < 24) return `${diffHours}h ago`;
    if (diffDays < 7) return `${diffDays}d ago`;
    return date.toLocaleDateString();
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

  return (
    <header className="glass-header sticky top-0 z-50" data-testid="header">
      <div className="max-w-7xl mx-auto px-4 md:px-8 lg:px-12">
        <div className="flex items-center justify-between h-16">
          {/* Logo */}
          <Link to="/dashboard" className="flex items-center gap-2" data-testid="logo-link">
            <div className="w-8 h-8 bg-indigo-600 rounded-lg flex items-center justify-center">
              <ArrowLeftRight className="w-5 h-5 text-white" />
            </div>
            <span className="text-xl font-bold text-slate-900" style={{ fontFamily: 'Manrope, sans-serif' }}>
              SwapFlow
            </span>
          </Link>

          {/* Right side */}
          <div className="flex items-center gap-3">
            {/* Post Item Button */}
            <Button
              onClick={() => navigate("/post")}
              className="bg-indigo-600 hover:bg-indigo-700 text-white rounded-full px-4 shadow-lg hover:shadow-indigo-500/30 transition-all duration-300"
              data-testid="post-item-btn"
            >
              <Plus className="w-4 h-4 mr-2" />
              Post Item
            </Button>

            {/* Messages */}
            <Button
              variant="ghost"
              size="icon"
              onClick={() => navigate("/messages")}
              className="text-slate-600 hover:text-slate-900 hover:bg-slate-100 relative"
              data-testid="messages-btn"
            >
              <MessageCircle className="w-5 h-5" />
              {unreadCount > 0 && (
                <div className="absolute -top-1 -right-1 w-5 h-5 bg-red-500 rounded-full border-2 border-white flex items-center justify-center">
                  <span className="text-xs text-white font-bold">
                    {unreadCount > 9 ? "9+" : unreadCount}
                  </span>
                </div>
              )}
            </Button>

            {/* Notifications */}
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon"
                  className="text-slate-600 hover:text-slate-900 hover:bg-slate-100 relative"
                  data-testid="notifications-btn"
                >
                  <Bell className="w-5 h-5" />
                  {notificationCount > 0 && (
                    <div className="absolute -top-1 -right-1 w-5 h-5 bg-red-500 rounded-full border-2 border-white flex items-center justify-center">
                      <span className="text-xs text-white font-bold">
                        {notificationCount > 9 ? "9+" : notificationCount}
                      </span>
                    </div>
                  )}
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent className="w-80" align="end" forceMount>
                <div className="p-3 border-b">
                  <p className="font-semibold text-slate-900">Notifications</p>
                </div>
                <ScrollArea className="h-[400px]">
                  {notifications.length === 0 ? (
                    <div className="p-4 text-center text-slate-500 text-sm">
                      No notifications
                    </div>
                  ) : (
                    <div className="py-2">
                      {notifications.map((notification) => (
                        <div
                          key={notification.notification_id}
                          className="px-4 py-3 hover:bg-slate-50 border-b border-slate-100 last:border-b-0"
                        >
                          <div className="flex items-start justify-between gap-2">
                            <div className="flex-1 min-w-0">
                              <p className="text-sm text-slate-900">{notification.message}</p>
                              <p className="text-xs text-slate-500 mt-1">
                                {formatTimeAgo(notification.created_at)}
                              </p>
                            </div>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-6 w-6 flex-shrink-0"
                              onClick={() => handleDismissNotification(notification.notification_id)}
                            >
                              <X className="w-3 h-3" />
                            </Button>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </ScrollArea>
              </DropdownMenuContent>
            </DropdownMenu>

            {/* Trades */}
            <Button
              variant="ghost"
              size="icon"
              onClick={() => navigate("/trades")}
              className="text-slate-600 hover:text-slate-900 hover:bg-slate-100"
              data-testid="trades-btn"
            >
              <ArrowLeftRight className="w-5 h-5" />
            </Button>

            {/* Admin - only show for admins */}
            {user?.is_admin && (
              <Button
                variant="ghost"
                size="icon"
                onClick={() => navigate("/admin")}
                className="text-slate-600 hover:text-slate-900 hover:bg-slate-100"
                data-testid="admin-btn"
              >
                <Shield className="w-5 h-5" />
              </Button>
            )}

            {/* User Menu */}
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button
                  variant="ghost"
                  className="relative h-10 w-10 rounded-full"
                  data-testid="user-menu-btn"
                >
                  <Avatar className="h-10 w-10 border-2 border-slate-200">
                    <AvatarImage src={user?.picture} alt={user?.name} />
                    <AvatarFallback className="bg-indigo-100 text-indigo-600 font-medium">
                      {getInitials(user?.name)}
                    </AvatarFallback>
                  </Avatar>
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent className="w-56" align="end" forceMount>
                <div className="flex items-center gap-3 p-3 border-b">
                  <Avatar className="h-10 w-10">
                    <AvatarImage src={user?.picture} alt={user?.name} />
                    <AvatarFallback className="bg-indigo-100 text-indigo-600">
                      {getInitials(user?.name)}
                    </AvatarFallback>
                  </Avatar>
                  <div className="flex flex-col">
                    <p className="text-sm font-medium text-slate-900">{user?.name}</p>
                    <p className="text-xs text-slate-500">
                      {user?.trade_points || 0} trade points
                    </p>
                  </div>
                </div>
                <DropdownMenuItem
                  onClick={() => navigate(`/profile/${user?.user_id}`)}
                  className="cursor-pointer"
                  data-testid="profile-menu-item"
                >
                  <User className="w-4 h-4 mr-2" />
                  My Profile
                </DropdownMenuItem>
                <DropdownMenuItem
                  onClick={() => navigate("/my-items")}
                  className="cursor-pointer"
                  data-testid="my-items-menu-item"
                >
                  <Package className="w-4 h-4 mr-2" />
                  My Items
                </DropdownMenuItem>
                <DropdownMenuItem
                  onClick={() => navigate("/trades")}
                  className="cursor-pointer"
                  data-testid="trades-menu-item"
                >
                  <ArrowLeftRight className="w-4 h-4 mr-2" />
                  My Trades
                </DropdownMenuItem>
                {user?.is_admin && (
                  <>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem
                      onClick={() => navigate("/admin")}
                      className="cursor-pointer text-indigo-600 focus:text-indigo-600"
                      data-testid="admin-menu-item"
                    >
                      <Shield className="w-4 h-4 mr-2" />
                      Admin Dashboard
                    </DropdownMenuItem>
                  </>
                )}
                <DropdownMenuSeparator />
                <DropdownMenuItem
                  onClick={handleLogout}
                  className="cursor-pointer text-red-600 focus:text-red-600"
                  data-testid="logout-menu-item"
                >
                  <LogOut className="w-4 h-4 mr-2" />
                  Log out
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>
      </div>
    </header>
  );
};
