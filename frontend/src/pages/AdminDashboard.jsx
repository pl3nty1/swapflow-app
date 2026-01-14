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
import { Loader2, Shield, Trash2, ArrowUp, ArrowDown, Search, Users, Package, MessageSquare, ArrowLeftRight, AlertTriangle, ChevronDown } from "lucide-react";

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
  const [itemUsers, setItemUsers] = useState({}); // Map of user_id to user object
  
  // Categories
  const [categories, setCategories] = useState([]);
  const [deletingCategory, setDeletingCategory] = useState(null);
  
  // Trades
  const [trades, setTrades] = useState([]);
  
  // Messages
  const [messages, setMessages] = useState([]);
  const [messagesPage, setMessagesPage] = useState(0);
  const [messagesTotal, setMessagesTotal] = useState(0);
  const messagesLimit = 50;
  
  // Database reset
  const [resetDialogOpen, setResetDialogOpen] = useState(false);
  const [isResetting, setIsResetting] = useState(false);

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
  }, [API]); // getAuthHeaders is stable and doesn't need to be in dependencies

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
  }, [API]); // getAuthHeaders is stable and doesn't need to be in dependencies

  const fetchItems = useCallback(async () => {
    try {
      const headers = getAuthHeaders();
      const response = await axios.get(`${API}/admin/items`, {
        withCredentials: true,
        headers: headers
      });
      setItems(response.data);
      
      // Fetch user info for all unique user_ids
      const uniqueUserIds = [...new Set(response.data.map(item => item.user_id))];
      const userMap = {};
      for (const userId of uniqueUserIds) {
        try {
          const userResponse = await axios.get(`${API}/users/${userId}`, {
            withCredentials: true,
            headers: headers
          });
          userMap[userId] = userResponse.data;
        } catch (error) {
          console.error(`Failed to fetch user ${userId}:`, error);
        }
      }
      setItemUsers(userMap);
    } catch (error) {
      console.error("Failed to fetch items:", error);
      toast.error("Failed to load items");
    }
  }, [API]); // getAuthHeaders is stable and doesn't need to be in dependencies

  const fetchCategories = useCallback(async () => {
    try {
      const headers = getAuthHeaders();
      const response = await axios.get(`${API}/admin/categories`, {
        withCredentials: true,
        headers: headers
      });
      setCategories(response.data);
    } catch (error) {
      console.error("Failed to fetch categories:", error);
      toast.error("Failed to load categories");
    }
  }, [API]); // getAuthHeaders is stable and doesn't need to be in dependencies

  const handleDeleteCategory = async () => {
    if (!deletingCategory) return;
    
    try {
      const headers = getAuthHeaders();
      await axios.delete(`${API}/admin/categories/${deletingCategory}`, {
        withCredentials: true,
        headers: headers
      });
      toast.success("Category deleted");
      setDeletingCategory(null);
      fetchCategories();
    } catch (error) {
      toast.error(error.response?.data?.detail || "Failed to delete category");
    }
  };

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
  }, [API]); // getAuthHeaders is stable and doesn't need to be in dependencies

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
    } else if (activeTab === "categories") {
      fetchCategories();
    } else if (activeTab === "trades") {
      fetchTrades();
    } else if (activeTab === "messages") {
      fetchMessages(0);
    }
  }, [activeTab, fetchUsers, fetchItems, fetchCategories, fetchTrades, fetchMessages]);

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

  const handleResetDatabase = async () => {
    setIsResetting(true);
    try {
      const headers = getAuthHeaders();
      await axios.post(`${API}/admin/reset-database`, {}, {
        withCredentials: true,
        headers: headers
      });
      toast.success("Database reset successfully. All data has been deleted.");
      setResetDialogOpen(false);
      // Refresh stats
      fetchStats();
      // Optionally refresh other tabs
      if (activeTab === "users") fetchUsers();
      if (activeTab === "items") fetchItems();
      if (activeTab === "categories") fetchCategories();
      if (activeTab === "trades") fetchTrades();
      if (activeTab === "messages") fetchMessages(0);
    } catch (error) {
      toast.error(error.response?.data?.detail || "Failed to reset database");
    } finally {
      setIsResetting(false);
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
            <TabsTrigger value="categories">Categories</TabsTrigger>
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
            
            {/* Reset Database Button - Only for homemail192@gmail.com - Hidden at bottom */}
            {user?.email?.toLowerCase() === "homemail192@gmail.com" && (
              <div className="mt-8 pt-8 border-t border-slate-200">
                <details className="group">
                  <summary className="cursor-pointer list-none flex items-center justify-between text-sm text-slate-500 hover:text-slate-700">
                    <span className="flex items-center gap-2">
                      <AlertTriangle className="w-4 h-4 text-slate-400" />
                      Danger Zone
                    </span>
                    <ChevronDown className="w-4 h-4 transition-transform group-open:rotate-180" />
                  </summary>
                  <div className="mt-4 p-4 bg-red-50 border border-red-200 rounded-lg">
                    <div className="space-y-3">
                      <div>
                        <p className="font-semibold text-red-900 text-sm">Reset Entire Database</p>
                        <p className="text-xs text-red-700 mt-1">This will permanently delete all data. This action cannot be undone.</p>
                      </div>
                      <Button
                        variant="destructive"
                        size="sm"
                        onClick={() => setResetDialogOpen(true)}
                        className="bg-red-600 hover:bg-red-700 text-xs"
                        data-testid="reset-database-btn"
                      >
                        <Trash2 className="w-3 h-3 mr-2" />
                        Reset Database
                      </Button>
                    </div>
                  </div>
                </details>
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
                    <TableHead>Last Active</TableHead>
                    <TableHead>Admin</TableHead>
                    <TableHead>Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredUsers.map((u) => (
                    <TableRow 
                      key={u.user_id}
                      className="cursor-pointer hover:bg-slate-50"
                      onClick={() => navigate(`/profile/${u.user_id}`)}
                    >
                      <TableCell className="font-medium">{u.name}</TableCell>
                      <TableCell>{u.email}</TableCell>
                      <TableCell>{u.username || "-"}</TableCell>
                      <TableCell>{u.trade_points || 0}</TableCell>
                      <TableCell>
                        {u.rating ? `${u.rating} (${u.rating_count})` : "-"}
                      </TableCell>
                      <TableCell>
                        {u.last_active
                          ? new Date(u.last_active).toLocaleDateString()
                          : "-"}
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
                      <TableCell onClick={(e) => e.stopPropagation()}>
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
                  {filteredItems.map((item) => {
                    const owner = itemUsers[item.user_id];
                    return (
                      <TableRow 
                        key={item.item_id}
                        className="cursor-pointer hover:bg-slate-50"
                        onClick={() => navigate(`/item/${item.item_id}`)}
                      >
                        <TableCell className="font-medium">{item.title}</TableCell>
                        <TableCell>
                          <Badge variant="outline">{item.category}</Badge>
                        </TableCell>
                        <TableCell>
                          {owner ? (owner.username || owner.name || item.user_id) : item.user_id}
                        </TableCell>
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
                        <TableCell onClick={(e) => e.stopPropagation()}>
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
                    );
                  })}
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

          {/* Categories Tab */}
          <TabsContent value="categories" className="space-y-4">
            <div className="border rounded-lg">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Category Name</TableHead>
                    <TableHead>Items Count</TableHead>
                    <TableHead>Click Count</TableHead>
                    <TableHead>Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {categories.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={4} className="text-center text-slate-500 py-8">
                        No categories found
                      </TableCell>
                    </TableRow>
                  ) : (
                    categories.map((category) => (
                      <TableRow key={category.name}>
                        <TableCell className="font-medium">
                          <Badge variant="outline" className="capitalize">{category.name}</Badge>
                        </TableCell>
                        <TableCell>{category.item_count || 0}</TableCell>
                        <TableCell>{category.click_count || 0}</TableCell>
                        <TableCell>
                          <Button
                            size="sm"
                            variant="destructive"
                            onClick={() => setDeletingCategory(category.name)}
                            className="h-7"
                          >
                            <Trash2 className="w-3 h-3 mr-1" />
                            Delete
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))
                  )}
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

        {/* Delete Category Dialog */}
        <Dialog open={!!deletingCategory} onOpenChange={() => setDeletingCategory(null)}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Delete Category</DialogTitle>
              <DialogDescription>
                Are you sure you want to delete the category "{deletingCategory}"? 
                This will remove it from the categories list. Items with this category will still have the category field, but it won't appear in the categories list.
              </DialogDescription>
            </DialogHeader>
            <DialogFooter>
              <Button variant="outline" onClick={() => setDeletingCategory(null)}>
                Cancel
              </Button>
              <Button variant="destructive" onClick={handleDeleteCategory}>
                Delete Category
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Reset Database Dialog */}
        <AlertDialog open={resetDialogOpen} onOpenChange={setResetDialogOpen}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle className="flex items-center gap-2 text-red-600">
                <AlertTriangle className="w-5 h-5" />
                Reset Database?
              </AlertDialogTitle>
              <AlertDialogDescription className="pt-2">
                <p className="font-semibold mb-2">This action cannot be undone!</p>
                <p>This will permanently delete:</p>
                <ul className="list-disc list-inside mt-2 space-y-1 text-sm">
                  <li>All users (except you will remain logged in)</li>
                  <li>All items/posts</li>
                  <li>All trades</li>
                  <li>All messages</li>
                  <li>All categories</li>
                  <li>All notifications</li>
                  <li>All user sessions</li>
                </ul>
                <p className="mt-4 font-semibold text-red-600">Are you absolutely sure you want to proceed?</p>
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel disabled={isResetting}>Cancel</AlertDialogCancel>
              <AlertDialogAction
                onClick={handleResetDatabase}
                disabled={isResetting}
                className="bg-red-600 hover:bg-red-700"
              >
                {isResetting ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 spinner" />
                    Resetting...
                  </>
                ) : (
                  "Yes, Reset Database"
                )}
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </main>
    </div>
  );
};

export default AdminDashboard;
