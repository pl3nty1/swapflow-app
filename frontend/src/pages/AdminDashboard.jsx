import { useEffect, useState, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import axios from "axios";
import { useAuth } from "@/App";
import { Header } from "@/components/Header";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
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
import { Loader2, Shield, Trash2, ArrowUp, ArrowDown, Search, Users, Package, MessageSquare, ArrowLeftRight, AlertTriangle, ChevronDown, Bug, Check, X } from "lucide-react";

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
  
  // Bug Reports
  const [bugReports, setBugReports] = useState([]);
  const [validatingBugId, setValidatingBugId] = useState(null);
  const [invalidatingBugId, setInvalidatingBugId] = useState(null);
  const [fixingBugId, setFixingBugId] = useState(null);
  const [selectedBug, setSelectedBug] = useState(null);
  const [bugDialogOpen, setBugDialogOpen] = useState(false);
  const [bugSubTab, setBugSubTab] = useState("pending"); // "pending", "valid", "fixed"
  
  // Reports
  const [reports, setReports] = useState([]);
  const [selectedReport, setSelectedReport] = useState(null);
  const [reportDialogOpen, setReportDialogOpen] = useState(false);
  const [reportSubTab, setReportSubTab] = useState("pending"); // "pending", "resolved", "dismissed"
  const [resolvingReportId, setResolvingReportId] = useState(null);
  const [dismissingReportId, setDismissingReportId] = useState(null);
  
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
      // Sort users by most recently active first
      const sortedUsers = [...response.data].sort((a, b) => {
        const aTime = a.last_active ? new Date(a.last_active).getTime() : 0;
        const bTime = b.last_active ? new Date(b.last_active).getTime() : 0;
        return bTime - aTime; // Descending order (most recent first)
      });
      setUsers(sortedUsers);
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

  const fetchBugReports = useCallback(async () => {
    try {
      const headers = getAuthHeaders();
      const response = await axios.get(`${API}/admin/bug-reports`, {
        withCredentials: true,
        headers: headers
      });
      setBugReports(response.data);
    } catch (error) {
      console.error("Failed to fetch bug reports:", error);
    }
  }, [API]);

  const handleValidateBug = async (bugId, e) => {
    if (e) e.stopPropagation(); // Prevent row click
    setValidatingBugId(bugId);
    try {
      const headers = getAuthHeaders();
      await axios.post(
        `${API}/admin/bug-reports/${bugId}/validate`,
        {},
        { withCredentials: true, headers: headers }
      );
      toast.success("Bug validated and trade points awarded!");
      fetchBugReports();
      fetchStats(); // Refresh stats to show updated trade points
      setBugDialogOpen(false);
      setSelectedBug(null);
    } catch (error) {
      toast.error(error.response?.data?.detail || "Failed to validate bug");
    } finally {
      setValidatingBugId(null);
    }
  };

  const handleInvalidateBug = async (bugId, e) => {
    if (e) e.stopPropagation(); // Prevent row click
    if (!window.confirm("Are you sure you want to delete this bug report? This action cannot be undone.")) {
      return;
    }
    setInvalidatingBugId(bugId);
    try {
      const headers = getAuthHeaders();
      await axios.post(
        `${API}/admin/bug-reports/${bugId}/invalidate`,
        {},
        { withCredentials: true, headers: headers }
      );
      toast.success("Bug report deleted");
      fetchBugReports();
      setBugDialogOpen(false);
      setSelectedBug(null);
    } catch (error) {
      toast.error(error.response?.data?.detail || "Failed to delete bug report");
    } finally {
      setInvalidatingBugId(null);
    }
  };

  const handleMarkFixed = async (bugId, e) => {
    if (e) e.stopPropagation(); // Prevent row click
    setFixingBugId(bugId);
    try {
      const headers = getAuthHeaders();
      await axios.post(
        `${API}/admin/bug-reports/${bugId}/mark-fixed`,
        {},
        { withCredentials: true, headers: headers }
      );
      toast.success("Bug marked as fixed");
      fetchBugReports();
      setBugDialogOpen(false);
      setSelectedBug(null);
    } catch (error) {
      toast.error(error.response?.data?.detail || "Failed to mark bug as fixed");
    } finally {
      setFixingBugId(null);
    }
  };

  const fetchReports = useCallback(async () => {
    try {
      const headers = getAuthHeaders();
      const response = await axios.get(`${API}/admin/reports`, {
        withCredentials: true,
        headers: headers
      });
      setReports(response.data);
    } catch (error) {
      console.error("Failed to fetch reports:", error);
      toast.error("Failed to load reports");
    }
  }, [API, getAuthHeaders]);

  const handleResolveReport = async (reportId, e) => {
    if (e) e.stopPropagation();
    setResolvingReportId(reportId);
    try {
      const headers = getAuthHeaders();
      await axios.post(
        `${API}/admin/reports/${reportId}/resolve`,
        {},
        { withCredentials: true, headers: headers }
      );
      toast.success("Report marked as resolved");
      fetchReports();
      setReportDialogOpen(false);
      setSelectedReport(null);
    } catch (error) {
      toast.error(error.response?.data?.detail || "Failed to resolve report");
    } finally {
      setResolvingReportId(null);
    }
  };

  const handleDismissReport = async (reportId, e) => {
    if (e) e.stopPropagation();
    setDismissingReportId(reportId);
    try {
      const headers = getAuthHeaders();
      await axios.post(
        `${API}/admin/reports/${reportId}/dismiss`,
        {},
        { withCredentials: true, headers: headers }
      );
      toast.success("Report dismissed");
      fetchReports();
      setReportDialogOpen(false);
      setSelectedReport(null);
    } catch (error) {
      toast.error(error.response?.data?.detail || "Failed to dismiss report");
    } finally {
      setDismissingReportId(null);
    }
  };

  const handleRemoveItemFromReport = async (itemId, reportId) => {
    try {
      const headers = getAuthHeaders();
      // Remove item
      await axios.delete(`${API}/admin/items/${itemId}`, {
        withCredentials: true,
        headers: headers
      });
      // Resolve report with action taken
      await axios.post(
        `${API}/admin/reports/${reportId}/resolve`,
        { action_taken: "item_removed" },
        { withCredentials: true, headers: headers }
      );
      toast.success("Item removed and report resolved");
      fetchReports();
      setReportDialogOpen(false);
      setSelectedReport(null);
    } catch (error) {
      toast.error(error.response?.data?.detail || "Failed to remove item");
    }
  };

  const handleRemoveUserFromReport = async (userId, reportId) => {
    try {
      const headers = getAuthHeaders();
      // Remove user
      await axios.delete(`${API}/admin/users/${userId}`, {
        withCredentials: true,
        headers: headers
      });
      // Resolve report with action taken
      await axios.post(
        `${API}/admin/reports/${reportId}/resolve`,
        { action_taken: "user_banned" },
        { withCredentials: true, headers: headers }
      );
      toast.success("User removed and report resolved");
      fetchReports();
      setReportDialogOpen(false);
      setSelectedReport(null);
    } catch (error) {
      toast.error(error.response?.data?.detail || "Failed to remove user");
    }
  };

  const handleReportClick = (report) => {
    setSelectedReport(report);
    setReportDialogOpen(true);
  };

  const handleBugClick = (bug) => {
    setSelectedBug(bug);
    setBugDialogOpen(true);
  };

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
    } else if (activeTab === "bugs") {
      fetchBugReports();
    }
  }, [activeTab, fetchUsers, fetchItems, fetchCategories, fetchTrades, fetchMessages, fetchBugReports]);

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
            <TabsTrigger value="bugs">Bug Reports</TabsTrigger>
            <TabsTrigger value="reports">Reports</TabsTrigger>
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
                          ? (() => {
                              const lastActive = new Date(u.last_active);
                              const now = new Date();
                              const diffMs = now - lastActive;
                              const diffHours = diffMs / (1000 * 60 * 60);
                              
                              if (diffHours < 12) {
                                // Show time if less than 12 hours
                                return lastActive.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
                              } else {
                                // Show date if 12 hours or more
                                return lastActive.toLocaleDateString();
                              }
                            })()
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

          {/* Bug Reports Tab */}
          <TabsContent value="bugs" className="space-y-4">
            {/* Sub-tabs for bug status */}
            <Tabs value={bugSubTab} onValueChange={setBugSubTab}>
              <TabsList>
                <TabsTrigger value="pending">Pending</TabsTrigger>
                <TabsTrigger value="valid">Valid</TabsTrigger>
                <TabsTrigger value="fixed">Fixed</TabsTrigger>
              </TabsList>

              {/* Pending Bugs */}
              <TabsContent value="pending" className="space-y-4">
                <div className="border rounded-lg">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Title</TableHead>
                        <TableHead>Reporter</TableHead>
                        <TableHead>Created</TableHead>
                        <TableHead>Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {bugReports.filter(bug => !bug.is_valid && !bug.is_resolved).map((bug) => (
                        <TableRow 
                          key={bug.bug_id}
                          className="cursor-pointer hover:bg-slate-50"
                          onClick={() => handleBugClick(bug)}
                        >
                          <TableCell className="font-medium">{bug.title}</TableCell>
                          <TableCell>
                            {bug.user?.username || bug.user?.name || bug.user?.email || "Unknown"}
                          </TableCell>
                          <TableCell>
                            {new Date(bug.created_at).toLocaleDateString()}
                          </TableCell>
                          <TableCell onClick={(e) => e.stopPropagation()}>
                            <div className="flex gap-2">
                              <Button
                                size="sm"
                                onClick={(e) => handleValidateBug(bug.bug_id, e)}
                                disabled={validatingBugId === bug.bug_id}
                                className="bg-green-600 hover:bg-green-700"
                              >
                                {validatingBugId === bug.bug_id ? (
                                  <Loader2 className="w-4 h-4 mr-2 spinner" />
                                ) : (
                                  <Check className="w-4 h-4 mr-2" />
                                )}
                                Mark Valid
                              </Button>
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={(e) => handleInvalidateBug(bug.bug_id, e)}
                                disabled={invalidatingBugId === bug.bug_id}
                                className="border-red-300 text-red-600 hover:bg-red-50"
                              >
                                {invalidatingBugId === bug.bug_id ? (
                                  <Loader2 className="w-4 h-4 mr-2 spinner" />
                                ) : (
                                  <X className="w-4 h-4 mr-2" />
                                )}
                                Delete
                              </Button>
                            </div>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
                {bugReports.filter(bug => !bug.is_valid && !bug.is_resolved).length === 0 && (
                  <div className="text-center py-8 text-slate-500">
                    No pending bug reports
                  </div>
                )}
              </TabsContent>

              {/* Valid Bugs */}
              <TabsContent value="valid" className="space-y-4">
                <div className="border rounded-lg">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Title</TableHead>
                        <TableHead>Reporter</TableHead>
                        <TableHead>Validated</TableHead>
                        <TableHead>Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {bugReports.filter(bug => bug.is_valid && !bug.is_resolved).map((bug) => (
                        <TableRow 
                          key={bug.bug_id}
                          className="cursor-pointer hover:bg-slate-50"
                          onClick={() => handleBugClick(bug)}
                        >
                          <TableCell className="font-medium">{bug.title}</TableCell>
                          <TableCell>
                            {bug.user?.username || bug.user?.name || bug.user?.email || "Unknown"}
                          </TableCell>
                          <TableCell>
                            {bug.validated_at ? new Date(bug.validated_at).toLocaleDateString() : "-"}
                          </TableCell>
                          <TableCell onClick={(e) => e.stopPropagation()}>
                            <Button
                              size="sm"
                              onClick={(e) => handleMarkFixed(bug.bug_id, e)}
                              disabled={fixingBugId === bug.bug_id}
                              className="bg-blue-600 hover:bg-blue-700"
                            >
                              {fixingBugId === bug.bug_id ? (
                                <Loader2 className="w-4 h-4 mr-2 spinner" />
                              ) : (
                                <Check className="w-4 h-4 mr-2" />
                              )}
                              Mark Fixed
                            </Button>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
                {bugReports.filter(bug => bug.is_valid && !bug.is_resolved).length === 0 && (
                  <div className="text-center py-8 text-slate-500">
                    No validated bug reports
                  </div>
                )}
              </TabsContent>

              {/* Fixed Bugs */}
              <TabsContent value="fixed" className="space-y-4">
                <div className="border rounded-lg">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Title</TableHead>
                        <TableHead>Reporter</TableHead>
                        <TableHead>Fixed</TableHead>
                        <TableHead>Fixed By</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {bugReports.filter(bug => bug.is_resolved).map((bug) => (
                        <TableRow 
                          key={bug.bug_id}
                          className="cursor-pointer hover:bg-slate-50"
                          onClick={() => handleBugClick(bug)}
                        >
                          <TableCell className="font-medium">{bug.title}</TableCell>
                          <TableCell>
                            {bug.user?.username || bug.user?.name || bug.user?.email || "Unknown"}
                          </TableCell>
                          <TableCell>
                            {bug.resolved_at ? new Date(bug.resolved_at).toLocaleDateString() : "-"}
                          </TableCell>
                          <TableCell>
                            {bug.resolver?.username || bug.resolver?.name || "Admin"}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
                {bugReports.filter(bug => bug.is_resolved).length === 0 && (
                  <div className="text-center py-8 text-slate-500">
                    No fixed bug reports
                  </div>
                )}
              </TabsContent>
            </Tabs>
          </TabsContent>

          {/* Reports Tab */}
          <TabsContent value="reports" className="space-y-4">
            <Tabs value={reportSubTab} onValueChange={setReportSubTab}>
              <TabsList>
                <TabsTrigger value="pending">Pending</TabsTrigger>
                <TabsTrigger value="resolved">Resolved</TabsTrigger>
                <TabsTrigger value="dismissed">Dismissed</TabsTrigger>
              </TabsList>

              {/* Pending Reports */}
              <TabsContent value="pending" className="space-y-4">
                <div className="border rounded-lg">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Type</TableHead>
                        <TableHead>Target</TableHead>
                        <TableHead>Category</TableHead>
                        <TableHead>Reporter</TableHead>
                        <TableHead>Created</TableHead>
                        <TableHead>Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {reports.filter(r => r.status === "pending").map((report) => (
                        <TableRow 
                          key={report.report_id}
                          className="cursor-pointer hover:bg-slate-50"
                          onClick={() => handleReportClick(report)}
                        >
                          <TableCell>
                            <Badge variant="outline" className="capitalize">{report.report_type}</Badge>
                          </TableCell>
                          <TableCell>
                            {report.report_type === "item" && report.reported_item ? (
                              <span className="text-blue-600 hover:underline">{report.reported_item.title}</span>
                            ) : report.report_type === "user" && report.reported_user ? (
                              <span className="text-blue-600 hover:underline">
                                {report.reported_user.username || report.reported_user.name || report.reported_user.email}
                              </span>
                            ) : report.report_type === "trade" ? (
                              <span className="text-blue-600 hover:underline">Trade #{report.reported_trade_id?.slice(-8)}</span>
                            ) : "-"}
                          </TableCell>
                          <TableCell>{report.category}</TableCell>
                          <TableCell>
                            {report.reporter?.username || report.reporter?.name || report.reporter?.email || "Unknown"}
                          </TableCell>
                          <TableCell>
                            {new Date(report.created_at).toLocaleDateString()}
                          </TableCell>
                          <TableCell onClick={(e) => e.stopPropagation()}>
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={(e) => handleReportClick(report)}
                            >
                              View Details
                            </Button>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
                {reports.filter(r => r.status === "pending").length === 0 && (
                  <div className="text-center py-8 text-slate-500">
                    No pending reports
                  </div>
                )}
              </TabsContent>

              {/* Resolved Reports */}
              <TabsContent value="resolved" className="space-y-4">
                <div className="border rounded-lg">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Type</TableHead>
                        <TableHead>Target</TableHead>
                        <TableHead>Category</TableHead>
                        <TableHead>Reporter</TableHead>
                        <TableHead>Action Taken</TableHead>
                        <TableHead>Resolved</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {reports.filter(r => r.status === "resolved").map((report) => (
                        <TableRow 
                          key={report.report_id}
                          className="cursor-pointer hover:bg-slate-50"
                          onClick={() => handleReportClick(report)}
                        >
                          <TableCell>
                            <Badge variant="outline" className="capitalize">{report.report_type}</Badge>
                          </TableCell>
                          <TableCell>
                            {report.report_type === "item" && report.reported_item ? (
                              <span className="text-blue-600 hover:underline">{report.reported_item.title}</span>
                            ) : report.report_type === "user" && report.reported_user ? (
                              <span className="text-blue-600 hover:underline">
                                {report.reported_user.username || report.reported_user.name || report.reported_user.email}
                              </span>
                            ) : report.report_type === "trade" ? (
                              <span className="text-blue-600 hover:underline">Trade #{report.reported_trade_id?.slice(-8)}</span>
                            ) : "-"}
                          </TableCell>
                          <TableCell>{report.category}</TableCell>
                          <TableCell>
                            {report.reporter?.username || report.reporter?.name || report.reporter?.email || "Unknown"}
                          </TableCell>
                          <TableCell>
                            <Badge className="bg-green-600 capitalize">
                              {report.action_taken?.replace("_", " ") || "Resolved"}
                            </Badge>
                          </TableCell>
                          <TableCell>
                            {report.resolved_at ? new Date(report.resolved_at).toLocaleDateString() : "-"}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
                {reports.filter(r => r.status === "resolved").length === 0 && (
                  <div className="text-center py-8 text-slate-500">
                    No resolved reports
                  </div>
                )}
              </TabsContent>

              {/* Dismissed Reports */}
              <TabsContent value="dismissed" className="space-y-4">
                <div className="border rounded-lg">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Type</TableHead>
                        <TableHead>Target</TableHead>
                        <TableHead>Category</TableHead>
                        <TableHead>Reporter</TableHead>
                        <TableHead>Dismissed</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {reports.filter(r => r.status === "dismissed").map((report) => (
                        <TableRow 
                          key={report.report_id}
                          className="cursor-pointer hover:bg-slate-50"
                          onClick={() => handleReportClick(report)}
                        >
                          <TableCell>
                            <Badge variant="outline" className="capitalize">{report.report_type}</Badge>
                          </TableCell>
                          <TableCell>
                            {report.report_type === "item" && report.reported_item ? (
                              <span className="text-blue-600 hover:underline">{report.reported_item.title}</span>
                            ) : report.report_type === "user" && report.reported_user ? (
                              <span className="text-blue-600 hover:underline">
                                {report.reported_user.username || report.reported_user.name || report.reported_user.email}
                              </span>
                            ) : report.report_type === "trade" ? (
                              <span className="text-blue-600 hover:underline">Trade #{report.reported_trade_id?.slice(-8)}</span>
                            ) : "-"}
                          </TableCell>
                          <TableCell>{report.category}</TableCell>
                          <TableCell>
                            {report.reporter?.username || report.reporter?.name || report.reporter?.email || "Unknown"}
                          </TableCell>
                          <TableCell>
                            {report.resolved_at ? new Date(report.resolved_at).toLocaleDateString() : "-"}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
                {reports.filter(r => r.status === "dismissed").length === 0 && (
                  <div className="text-center py-8 text-slate-500">
                    No dismissed reports
                  </div>
                )}
              </TabsContent>
            </Tabs>
          </TabsContent>
        </Tabs>

        {/* Bug Report Detail Dialog */}
        <Dialog open={bugDialogOpen} onOpenChange={setBugDialogOpen}>
          <DialogContent className="sm:max-w-2xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <Bug className="w-5 h-5" />
                Bug Report Details
              </DialogTitle>
              <DialogDescription>
                {selectedBug?.is_resolved 
                  ? "This bug report has been fixed."
                  : selectedBug?.is_valid 
                  ? "This bug report has been validated."
                  : "Review the bug report details below."}
              </DialogDescription>
            </DialogHeader>

            {selectedBug && (
              <div className="space-y-4">
                <div className="space-y-2">
                  <Label>Bug Title</Label>
                  <Input
                    value={selectedBug.title}
                    readOnly
                    className="bg-slate-50"
                  />
                </div>

                <div className="space-y-2">
                  <Label>Reporter</Label>
                  <Input
                    value={selectedBug.user?.username || selectedBug.user?.name || selectedBug.user?.email || "Unknown"}
                    readOnly
                    className="bg-slate-50"
                  />
                </div>

                <div className="space-y-2">
                  <Label>What is the bug?</Label>
                  <Textarea
                    value={selectedBug.description}
                    readOnly
                    className="min-h-[100px] bg-slate-50"
                  />
                </div>

                <div className="space-y-2">
                  <Label>Steps to Reproduce</Label>
                  <Textarea
                    value={selectedBug.steps_to_reproduce}
                    readOnly
                    className="min-h-[120px] font-mono text-sm bg-slate-50 whitespace-pre-wrap"
                  />
                </div>

                <div className="space-y-2">
                  <Label>Status</Label>
                  <div>
                    {selectedBug.is_resolved ? (
                      <Badge variant="default" className="bg-blue-600">
                        Fixed
                        {selectedBug.resolver && (
                          <span className="ml-2">
                            (by {selectedBug.resolver?.username || selectedBug.resolver?.name || "Admin"})
                          </span>
                        )}
                      </Badge>
                    ) : selectedBug.is_valid ? (
                      <Badge variant="default" className="bg-green-600">
                        Valid
                        {selectedBug.validator && (
                          <span className="ml-2">
                            (by {selectedBug.validator?.username || selectedBug.validator?.name || "Admin"})
                          </span>
                        )}
                      </Badge>
                    ) : (
                      <Badge variant="outline">Pending</Badge>
                    )}
                  </div>
                </div>

                <div className="space-y-2">
                  <Label>Created</Label>
                  <Input
                    value={new Date(selectedBug.created_at).toLocaleString()}
                    readOnly
                    className="bg-slate-50"
                  />
                </div>

                <DialogFooter>
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => {
                      setBugDialogOpen(false);
                      setSelectedBug(null);
                    }}
                  >
                    Close
                  </Button>
                  {!selectedBug.is_resolved && (
                    <>
                      {!selectedBug.is_valid ? (
                        <>
                          <Button
                            type="button"
                            variant="outline"
                            onClick={(e) => handleInvalidateBug(selectedBug.bug_id, e)}
                            disabled={invalidatingBugId === selectedBug.bug_id}
                            className="border-red-300 text-red-600 hover:bg-red-50"
                          >
                            {invalidatingBugId === selectedBug.bug_id ? (
                              <>
                                <Loader2 className="w-4 h-4 mr-2 spinner" />
                                Deleting...
                              </>
                            ) : (
                              <>
                                <X className="w-4 h-4 mr-2" />
                                Delete
                              </>
                            )}
                          </Button>
                          <Button
                            type="button"
                            onClick={(e) => handleValidateBug(selectedBug.bug_id, e)}
                            disabled={validatingBugId === selectedBug.bug_id}
                            className="bg-green-600 hover:bg-green-700"
                          >
                            {validatingBugId === selectedBug.bug_id ? (
                              <>
                                <Loader2 className="w-4 h-4 mr-2 spinner" />
                                Validating...
                              </>
                            ) : (
                              <>
                                <Check className="w-4 h-4 mr-2" />
                                Mark Valid
                              </>
                            )}
                          </Button>
                        </>
                      ) : (
                        <Button
                          type="button"
                          onClick={(e) => handleMarkFixed(selectedBug.bug_id, e)}
                          disabled={fixingBugId === selectedBug.bug_id}
                          className="bg-blue-600 hover:bg-blue-700"
                        >
                          {fixingBugId === selectedBug.bug_id ? (
                            <>
                              <Loader2 className="w-4 h-4 mr-2 spinner" />
                              Marking Fixed...
                            </>
                          ) : (
                            <>
                              <Check className="w-4 h-4 mr-2" />
                              Mark Fixed
                            </>
                          )}
                        </Button>
                      )}
                    </>
                  )}
                </DialogFooter>
              </div>
            )}
          </DialogContent>
        </Dialog>

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

        {/* Report Detail Dialog */}
        <Dialog open={reportDialogOpen} onOpenChange={setReportDialogOpen}>
          <DialogContent className="sm:max-w-2xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <AlertTriangle className="w-5 h-5 text-red-500" />
                Report Details
              </DialogTitle>
              <DialogDescription>
                {selectedReport?.status === "resolved" 
                  ? "This report has been resolved."
                  : selectedReport?.status === "dismissed"
                  ? "This report has been dismissed."
                  : "Review the report details below."}
              </DialogDescription>
            </DialogHeader>

            {selectedReport && (
              <div className="space-y-4">
                <div className="space-y-2">
                  <Label>Report Type</Label>
                  <Input
                    value={selectedReport.report_type.charAt(0).toUpperCase() + selectedReport.report_type.slice(1)}
                    readOnly
                    className="bg-slate-50"
                  />
                </div>

                <div className="space-y-2">
                  <Label>Target</Label>
                  <div className="flex items-center gap-2">
                    {selectedReport.report_type === "item" && selectedReport.reported_item ? (
                      <>
                        <Input
                          value={selectedReport.reported_item.title}
                          readOnly
                          className="bg-slate-50"
                        />
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => navigate(`/item/${selectedReport.reported_item_id}`)}
                        >
                          View Item
                        </Button>
                        {selectedReport.status === "pending" && (
                          <Button
                            variant="destructive"
                            size="sm"
                            onClick={() => handleRemoveItemFromReport(selectedReport.reported_item_id, selectedReport.report_id)}
                          >
                            <Trash2 className="w-4 h-4 mr-2" />
                            Remove Item
                          </Button>
                        )}
                      </>
                    ) : selectedReport.report_type === "user" && selectedReport.reported_user ? (
                      <>
                        <Input
                          value={selectedReport.reported_user.username || selectedReport.reported_user.name || selectedReport.reported_user.email}
                          readOnly
                          className="bg-slate-50"
                        />
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => navigate(`/profile/${selectedReport.reported_user_id}`)}
                        >
                          View User
                        </Button>
                        {selectedReport.status === "pending" && (
                          <Button
                            variant="destructive"
                            size="sm"
                            onClick={() => handleRemoveUserFromReport(selectedReport.reported_user_id, selectedReport.report_id)}
                          >
                            <Trash2 className="w-4 h-4 mr-2" />
                            Remove User
                          </Button>
                        )}
                      </>
                    ) : selectedReport.report_type === "trade" ? (
                      <>
                        <Input
                          value={`Trade #${selectedReport.reported_trade_id?.slice(-8)}`}
                          readOnly
                          className="bg-slate-50"
                        />
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => navigate(`/messages/${selectedReport.reported_trade_id}`)}
                        >
                          View Trade
                        </Button>
                      </>
                    ) : (
                      <Input value="N/A" readOnly className="bg-slate-50" />
                    )}
                  </div>
                </div>

                <div className="space-y-2">
                  <Label>Category</Label>
                  <Input
                    value={selectedReport.category}
                    readOnly
                    className="bg-slate-50"
                  />
                </div>

                <div className="space-y-2">
                  <Label>Description</Label>
                  <Textarea
                    value={selectedReport.description}
                    readOnly
                    className="min-h-[100px] bg-slate-50"
                  />
                </div>

                <div className="space-y-2">
                  <Label>Reporter</Label>
                  <div className="flex items-center gap-2">
                    <Input
                      value={selectedReport.reporter?.username || selectedReport.reporter?.name || selectedReport.reporter?.email || "Unknown"}
                      readOnly
                      className="bg-slate-50"
                    />
                    {selectedReport.reporter && (
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => navigate(`/profile/${selectedReport.reporter_id}`)}
                      >
                        View Profile
                      </Button>
                    )}
                  </div>
                </div>

                <div className="space-y-2">
                  <Label>Status</Label>
                  <div>
                    {selectedReport.status === "resolved" ? (
                      <Badge variant="default" className="bg-green-600">
                        Resolved
                        {selectedReport.resolver && (
                          <span className="ml-2">
                            (by {selectedReport.resolver?.username || selectedReport.resolver?.name || "Admin"})
                          </span>
                        )}
                      </Badge>
                    ) : selectedReport.status === "dismissed" ? (
                      <Badge variant="default" className="bg-gray-600">
                        Dismissed
                        {selectedReport.resolver && (
                          <span className="ml-2">
                            (by {selectedReport.resolver?.username || selectedReport.resolver?.name || "Admin"})
                          </span>
                        )}
                      </Badge>
                    ) : (
                      <Badge variant="outline">Pending</Badge>
                    )}
                  </div>
                </div>

                {selectedReport.action_taken && (
                  <div className="space-y-2">
                    <Label>Action Taken</Label>
                    <Input
                      value={selectedReport.action_taken.replace("_", " ").replace(/\b\w/g, l => l.toUpperCase())}
                      readOnly
                      className="bg-slate-50"
                    />
                  </div>
                )}

                <div className="space-y-2">
                  <Label>Created</Label>
                  <Input
                    value={new Date(selectedReport.created_at).toLocaleString()}
                    readOnly
                    className="bg-slate-50"
                  />
                </div>

                {selectedReport.resolved_at && (
                  <div className="space-y-2">
                    <Label>Resolved</Label>
                    <Input
                      value={new Date(selectedReport.resolved_at).toLocaleString()}
                      readOnly
                      className="bg-slate-50"
                    />
                  </div>
                )}

                <DialogFooter>
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => {
                      setReportDialogOpen(false);
                      setSelectedReport(null);
                    }}
                  >
                    Close
                  </Button>
                  {selectedReport.status === "pending" && (
                    <>
                      <Button
                        type="button"
                        variant="outline"
                        onClick={(e) => handleDismissReport(selectedReport.report_id, e)}
                        disabled={dismissingReportId === selectedReport.report_id}
                        className="border-gray-300 text-gray-600 hover:bg-gray-50"
                      >
                        {dismissingReportId === selectedReport.report_id ? (
                          <>
                            <Loader2 className="w-4 h-4 mr-2 spinner" />
                            Dismissing...
                          </>
                        ) : (
                          <>
                            <X className="w-4 h-4 mr-2" />
                            Dismiss
                          </>
                        )}
                      </Button>
                      <Button
                        type="button"
                        onClick={(e) => handleResolveReport(selectedReport.report_id, e)}
                        disabled={resolvingReportId === selectedReport.report_id}
                        className="bg-green-600 hover:bg-green-700"
                      >
                        {resolvingReportId === selectedReport.report_id ? (
                          <>
                            <Loader2 className="w-4 h-4 mr-2 spinner" />
                            Resolving...
                          </>
                        ) : (
                          <>
                            <Check className="w-4 h-4 mr-2" />
                            Mark Resolved
                          </>
                        )}
                      </Button>
                    </>
                  )}
                </DialogFooter>
              </div>
            )}
          </DialogContent>
        </Dialog>
      </main>
    </div>
  );
};

export default AdminDashboard;
