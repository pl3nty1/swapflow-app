import { useEffect, useState, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import axios from "axios";
import { useAuth } from "@/App";
import { Header } from "@/components/Header";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { toast } from "sonner";
import { Loader2, Shield, Trash2, ArrowUp, ArrowDown, Search, Users, Package, MessageSquare, ArrowLeftRight } from "lucide-react";

const AdminDashboard = () => {
  const navigate = useNavigate();
  const { user, API, getAuthHeaders } = useAuth();
  const [activeTab, setActiveTab] = useState("stats");
  const [isLoading, setIsLoading] = useState(true);
  
  // Stats
  const [stats, setStats] = useState(null);
  
  // Users
  const [users, setUsers] = useState([]);
  const [usersSearchQuery, setUsersSearchQuery] = useState("");
  const [promotingUserId, setPromotingUserId] = useState(null);
  const [demotingUserId, setDemotingUserId] = useState(null);
  const [deletingUserId, setDeletingUserId] = useState(null);
  
  // Items
  const [items, setItems] = useState([]);
  const [itemsSearchQuery, setItemsSearchQuery] = useState("");
  const [deletingItemId, setDeletingItemId] = useState(null);
  
  // Trades
  const [trades, setTrades] = useState([]);
  
  // Messages
  const [messages, setMessages] = useState([]);
  const [messagesPage, setMessagesPage] = useState(0);
  const [messagesTotal, setMessagesTotal] = useState(0);
  const messagesLimit = 50;

  // Check if user is admin
  useEffect(() => {
    if (user && !user.is_admin) {
      toast.error("Access denied. Admin privileges required.");
      navigate("/dashboard");
    }
  }, [user, navigate]);

  const fetchStats = useCallback(async () => {
    try {
      const headers = getAuthHeaders();
      const response = await axios.get(`${API}/admin/stats`, {
        withCredentials: true,
        headers: headers
      });
      setStats(response.data);
    } catch (error) {
      console.error("Failed to fetch stats:", error);
      toast.error("Failed to load statistics");
    }
  }, [API, getAuthHeaders]);

  const fetchUsers = useCallback(async () => {
    try {
      const headers = getAuthHeaders();
      const response = await axios.get(`${API}/admin/users`, {
        withCredentials: true,
        headers: headers
      });
      setUsers(response.data);
    } catch (error) {
      console.error("Failed to fetch users:", error);
      toast.error("Failed to load users");
    }
  }, [API, getAuthHeaders]);

  const fetchItems = useCallback(async () => {
    try {
      const headers = getAuthHeaders();
      const response = await axios.get(`${API}/admin/items`, {
        withCredentials: true,
        headers: headers
      });
      setItems(response.data);
    } catch (error) {
      console.error("Failed to fetch items:", error);
      toast.error("Failed to load items");
    }
  }, [API, getAuthHeaders]);

  const fetchTrades = useCallback(async () => {
    try {
      const headers = getAuthHeaders();
      const response = await axios.get(`${API}/admin/trades`, {
        withCredentials: true,
        headers: headers
      });
      setTrades(response.data);
    } catch (error) {
      console.error("Failed to fetch trades:", error);
      toast.error("Failed to load trades");
    }
  }, [API, getAuthHeaders]);

  const fetchMessages = useCallback(async (page = 0) => {
    try {
      const headers = getAuthHeaders();
      const response = await axios.get(`${API}/admin/messages`, {
        params: { skip: page * messagesLimit, limit: messagesLimit },
        withCredentials: true,
        headers: headers
      });
      setMessages(response.data.messages);
      setMessagesTotal(response.data.total);
      setMessagesPage(page);
    } catch (error) {
      console.error("Failed to fetch messages:", error);
      toast.error("Failed to load messages");
    }
  }, [API, getAuthHeaders, messagesLimit]);

  useEffect(() => {
    if (user?.is_admin) {
      fetchStats();
      setIsLoading(false);
    }
  }, [user, fetchStats]);

  useEffect(() => {
    if (activeTab === "users") {
      fetchUsers();
    } else if (activeTab === "items") {
      fetchItems();
    } else if (activeTab === "trades") {
      fetchTrades();
    } else if (activeTab === "messages") {
      fetchMessages(0);
    }
  }, [activeTab, fetchUsers, fetchItems, fetchTrades, fetchMessages]);

  const handlePromoteUser = async (userId) => {
    try {
      const headers = getAuthHeaders();
      await axios.post(`${API}/admin/users/${userId}/promote`, {}, {
        withCredentials: true,
        headers: headers
      });
      toast.success("User promoted to admin");
      setPromotingUserId(null);
      fetchUsers();
    } catch (error) {
      toast.error(error.response?.data?.detail || "Failed to promote user");
    }
  };

  const handleDemoteUser = async (userId) => {
    try {
      const headers = getAuthHeaders();
      await axios.post(`${API}/admin/users/${userId}/demote`, {}, {
        withCredentials: true,
        headers: headers
      });
      toast.success("User demoted from admin");
      setDemotingUserId(null);
      fetchUsers();
    } catch (error) {
      toast.error(error.response?.data?.detail || "Failed to demote user");
    }
  };

  const handleDeleteUser = async (userId) => {
    try {
      const headers = getAuthHeaders();
      await axios.delete(`${API}/admin/users/${userId}`, {
        withCredentials: true,
        headers: headers
      });
      toast.success("User deleted");
      setDeletingUserId(null);
      fetchUsers();
      fetchStats();
    } catch (error) {
      toast.error(error.response?.data?.detail || "Failed to delete user");
    }
  };

  const handleDeleteItem = async (itemId) => {
    try {
      const headers = getAuthHeaders();
      await axios.delete(`${API}/admin/items/${itemId}`, {
        withCredentials: true,
        headers: headers
      });
      toast.success("Item deleted");
      setDeletingItemId(null);
      fetchItems();
      fetchStats();
    } catch (error) {
      toast.error(error.response?.data?.detail || "Failed to delete item");
    }
  };

  // Filter users
  const filteredUsers = users.filter((u) => {
    if (!usersSearchQuery) return true;
    const query = usersSearchQuery.toLowerCase();
    return (
      u.name?.toLowerCase().includes(query) ||
      u.email?.toLowerCase().includes(query) ||
      u.username?.toLowerCase().includes(query)
    );
  });

  // Filter items
  const filteredItems = items.filter((item) => {
    if (!itemsSearchQuery) return true;
    const query = itemsSearchQuery.toLowerCase();
    return (
      item.title?.toLowerCase().includes(query) ||
      item.category?.toLowerCase().includes(query) ||
      item.description?.toLowerCase().includes(query)
    );
  });

  if (!user?.is_admin) {
    return null;
  }

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
    <div className="min-h-screen bg-white">
      <Header />
      <main className="max-w-7xl mx-auto px-4 md:px-8 lg:px-12 py-8">
        <div className="mb-6">
          <h1 className="text-3xl font-bold text-slate-900 mb-2" style={{ fontFamily: "Manrope, sans-serif" }}>
            Admin Dashboard
          </h1>
          <p className="text-slate-500">Manage users, posts, and platform statistics</p>
        </div>

        <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
          <TabsList className="mb-6">
            <TabsTrigger value="stats">Statistics</TabsTrigger>
            <TabsTrigger value="users">Users</TabsTrigger>
            <TabsTrigger value="items">Posts</TabsTrigger>
            <TabsTrigger value="trades">Trades</TabsTrigger>
            <TabsTrigger value="messages">Messages</TabsTrigger>
          </TabsList>

          {/* Statistics Tab */}
          <TabsContent value="stats" className="space-y-4">
            {stats && (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                <Card>
                  <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                    <CardTitle className="text-sm font-medium">Total Users</CardTitle>
                    <Users className="h-4 w-4 text-muted-foreground" />
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-bold">{stats.total_users}</div>
                    <p className="text-xs text-muted-foreground">
                      {stats.total_admins} admins
                    </p>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                    <CardTitle className="text-sm font-medium">Total Items</CardTitle>
                    <Package className="h-4 w-4 text-muted-foreground" />
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-bold">{stats.total_items}</div>
                    <p className="text-xs text-muted-foreground">
                      {stats.available_items} available
                    </p>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                    <CardTitle className="text-sm font-medium">Total Trades</CardTitle>
                    <ArrowLeftRight className="h-4 w-4 text-muted-foreground" />
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-bold">{stats.total_trades}</div>
                    <p className="text-xs text-muted-foreground">
                      {stats.active_trades} active, {stats.completed_trades} completed
                    </p>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                    <CardTitle className="text-sm font-medium">Total Messages</CardTitle>
                    <MessageSquare className="h-4 w-4 text-muted-foreground" />
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-bold">{stats.total_messages}</div>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                    <CardTitle className="text-sm font-medium">Categories</CardTitle>
                    <Package className="h-4 w-4 text-muted-foreground" />
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-bold">{stats.total_categories}</div>
                  </CardContent>
                </Card>
              </div>
            )}
          </TabsContent>

          {/* Users Tab */}
          <TabsContent value="users" className="space-y-4">
            <div className="relative mb-4">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
              <Input
                type="text"
                placeholder="Search users by name, email, or username..."
                value={usersSearchQuery}
                onChange={(e) => setUsersSearchQuery(e.target.value)}
                className="pl-10"
              />
            </div>

            <div className="border rounded-lg">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Name</TableHead>
                    <TableHead>Email</TableHead>
                    <TableHead>Username</TableHead>
                    <TableHead>Trade Points</TableHead>
                    <TableHead>Rating</TableHead>
                    <TableHead>Admin</TableHead>
                    <TableHead>Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredUsers.map((u) => (
                    <TableRow key={u.user_id}>
                      <TableCell className="font-medium">{u.name}</TableCell>
                      <TableCell>{u.email}</TableCell>
                      <TableCell>{u.username || "-"}</TableCell>
                      <TableCell>{u.trade_points || 0}</TableCell>
                      <TableCell>
                        {u.rating ? `${u.rating} (${u.rating_count})` : "-"}
                      </TableCell>
                      <TableCell>
                        {u.is_admin ? (
                          <Badge variant="default" className="bg-indigo-600">
                            <Shield className="w-3 h-3 mr-1" />
                            Admin
                          </Badge>
                        ) : (
                          <Badge variant="outline">User</Badge>
                        )}
                      </TableCell>
                      <TableCell>
                        <div className="flex gap-2">
                          {!u.is_admin ? (
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => setPromotingUserId(u.user_id)}
                              className="h-7"
                            >
                              <ArrowUp className="w-3 h-3 mr-1" />
                              Promote
                            </Button>
                          ) : u.user_id !== user.user_id && user.email?.toLowerCase() === "homemail192@gmail.com" ? (
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => setDemotingUserId(u.user_id)}
                              className="h-7"
                            >
                              <ArrowDown className="w-3 h-3 mr-1" />
                              Demote
                            </Button>
                          ) : null}
                          {u.user_id !== user.user_id && (
                            <Button
                              size="sm"
                              variant="destructive"
                              onClick={() => setDeletingUserId(u.user_id)}
                              className="h-7"
                            >
                              <Trash2 className="w-3 h-3" />
                            </Button>
                          )}
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </TabsContent>

          {/* Items Tab */}
          <TabsContent value="items" className="space-y-4">
            <div className="relative mb-4">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
              <Input
                type="text"
                placeholder="Search items by title, category, or description..."
                value={itemsSearchQuery}
                onChange={(e) => setItemsSearchQuery(e.target.value)}
                className="pl-10"
              />
            </div>

            <div className="border rounded-lg">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Title</TableHead>
                    <TableHead>Category</TableHead>
                    <TableHead>Owner</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Created</TableHead>
                    <TableHead>Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredItems.map((item) => (
                    <TableRow key={item.item_id}>
                      <TableCell className="font-medium">{item.title}</TableCell>
                      <TableCell>
                        <Badge variant="outline">{item.category}</Badge>
                      </TableCell>
                      <TableCell>{item.user_id}</TableCell>
                      <TableCell>
                        {item.is_available ? (
                          <Badge variant="default" className="bg-green-600">Available</Badge>
                        ) : (
                          <Badge variant="outline">Unavailable</Badge>
                        )}
                      </TableCell>
                      <TableCell>
                        {new Date(item.created_at).toLocaleDateString()}
                      </TableCell>
                      <TableCell>
                        <Button
                          size="sm"
                          variant="destructive"
                          onClick={() => setDeletingItemId(item.item_id)}
                          className="h-7"
                        >
                          <Trash2 className="w-3 h-3" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </TabsContent>

          {/* Trades Tab */}
          <TabsContent value="trades" className="space-y-4">
            <div className="border rounded-lg">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Trade ID</TableHead>
                    <TableHead>Item</TableHead>
                    <TableHead>Owner</TableHead>
                    <TableHead>Trader</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Created</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {trades.map((t) => (
                    <TableRow key={t.trade.trade_id}>
                      <TableCell className="font-mono text-xs">{t.trade.trade_id}</TableCell>
                      <TableCell>{t.item?.title || "N/A"}</TableCell>
                      <TableCell>{t.owner?.name || t.owner?.email || "N/A"}</TableCell>
                      <TableCell>{t.trader?.name || t.trader?.email || "N/A"}</TableCell>
                      <TableCell>
                        {t.trade.is_completed ? (
                          <Badge variant="default" className="bg-green-600">Completed</Badge>
                        ) : (
                          <Badge variant="outline">Active</Badge>
                        )}
                      </TableCell>
                      <TableCell>
                        {new Date(t.trade.created_at).toLocaleDateString()}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </TabsContent>

          {/* Messages Tab */}
          <TabsContent value="messages" className="space-y-4">
            <div className="border rounded-lg">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>From</TableHead>
                    <TableHead>To</TableHead>
                    <TableHead>Message</TableHead>
                    <TableHead>Created</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {messages.map((m) => (
                    <TableRow key={m.message.message_id}>
                      <TableCell>{m.sender?.name || m.sender?.email || "N/A"}</TableCell>
                      <TableCell>{m.receiver?.name || m.receiver?.email || "N/A"}</TableCell>
                      <TableCell className="max-w-md truncate">{m.message.content}</TableCell>
                      <TableCell>
                        {new Date(m.message.created_at).toLocaleDateString()}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
            <div className="flex justify-between items-center">
              <p className="text-sm text-slate-500">
                Showing {messages.length} of {messagesTotal} messages
              </p>
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => fetchMessages(messagesPage - 1)}
                  disabled={messagesPage === 0}
                >
                  Previous
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => fetchMessages(messagesPage + 1)}
                  disabled={(messagesPage + 1) * messagesLimit >= messagesTotal}
                >
                  Next
                </Button>
              </div>
            </div>
          </TabsContent>
        </Tabs>

        {/* Promote User Dialog */}
        <Dialog open={!!promotingUserId} onOpenChange={() => setPromotingUserId(null)}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Promote User to Admin</DialogTitle>
              <DialogDescription>
                Are you sure you want to promote this user to admin? They will have full access to the admin dashboard.
              </DialogDescription>
            </DialogHeader>
            <DialogFooter>
              <Button variant="outline" onClick={() => setPromotingUserId(null)}>
                Cancel
              </Button>
              <Button onClick={() => handlePromoteUser(promotingUserId)}>
                Promote
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Demote User Dialog */}
        <Dialog open={!!demotingUserId} onOpenChange={() => setDemotingUserId(null)}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Demote User from Admin</DialogTitle>
              <DialogDescription>
                Are you sure you want to remove admin privileges from this user?
              </DialogDescription>
            </DialogHeader>
            <DialogFooter>
              <Button variant="outline" onClick={() => setDemotingUserId(null)}>
                Cancel
              </Button>
              <Button variant="destructive" onClick={() => handleDemoteUser(demotingUserId)}>
                Demote
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Delete User Dialog */}
        <Dialog open={!!deletingUserId} onOpenChange={() => setDeletingUserId(null)}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Delete User</DialogTitle>
              <DialogDescription>
                Are you sure you want to delete this user? This will permanently delete their account, items, messages, and sessions. This action cannot be undone.
              </DialogDescription>
            </DialogHeader>
            <DialogFooter>
              <Button variant="outline" onClick={() => setDeletingUserId(null)}>
                Cancel
              </Button>
              <Button variant="destructive" onClick={() => handleDeleteUser(deletingUserId)}>
                Delete
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Delete Item Dialog */}
        <Dialog open={!!deletingItemId} onOpenChange={() => setDeletingItemId(null)}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Delete Item</DialogTitle>
              <DialogDescription>
                Are you sure you want to delete this item? This action cannot be undone.
              </DialogDescription>
            </DialogHeader>
            <DialogFooter>
              <Button variant="outline" onClick={() => setDeletingItemId(null)}>
                Cancel
              </Button>
              <Button variant="destructive" onClick={() => handleDeleteItem(deletingItemId)}>
                Delete
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </main>
    </div>
  );
};

export default AdminDashboard;
