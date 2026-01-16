import { useEffect, useState, useRef } from "react";
import "@/App.css";
import { BrowserRouter, Routes, Route, useNavigate } from "react-router-dom";
import axios from "axios";
import { Toaster } from "@/components/ui/sonner";
import { usePreload } from "@/hooks/usePreload";
import { PreloadContext } from "@/contexts/PreloadContext";
import { WebSocketProvider } from "@/contexts/WebSocketContext";
import { BugReportButton } from "@/components/BugReportButton";

// Pages
import Landing from "@/pages/Landing";
import Dashboard from "@/pages/Dashboard";
import Profile from "@/pages/Profile";
import ItemDetail from "@/pages/ItemDetail";
import Messages from "@/pages/Messages";
import PostItem from "@/pages/PostItem";
import MyItems from "@/pages/MyItems";
import Trades from "@/pages/Trades";
import AdminDashboard from "@/pages/AdminDashboard";

// Auto-detect backend URL based on environment
const getBackendURL = () => {
  // If explicitly set via environment variable, use it
  if (process.env.REACT_APP_BACKEND_URL) {
    return process.env.REACT_APP_BACKEND_URL.replace(/\/+$/, '');
  }
  
  // Auto-detect: if running on localhost, use local backend
  if (typeof window !== 'undefined') {
    const hostname = window.location.hostname;
    if (hostname === 'localhost' || hostname === '127.0.0.1' || hostname === '0.0.0.0') {
      return 'http://localhost:8000';
    }
  }
  
  // Default to production URL
  return 'https://swapflow-app-uj7o.vercel.app';
};

const BACKEND_URL = getBackendURL();
const API = `${BACKEND_URL}/api`;

// Auth Context
import { createContext, useContext } from "react";

export const AuthContext = createContext(null);

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth must be used within AuthProvider");
  }
  return context;
};


// Protected Route Component
const ProtectedRoute = ({ children }) => {
  const navigate = useNavigate();
  const { user, isLoading } = useAuth();

  useEffect(() => {
    // Wait for auth check to complete, then redirect if not authenticated
    if (!isLoading && !user) {
      navigate("/", { replace: true });
    }
  }, [isLoading, user, navigate]);

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-white">
        <div className="w-8 h-8 border-2 border-indigo-600 border-t-transparent rounded-full spinner"></div>
      </div>
    );
  }

  return user ? children : null;
};

// Admin Protected Route Component
const AdminProtectedRoute = ({ children }) => {
  const navigate = useNavigate();
  const { user, isLoading } = useAuth();

  useEffect(() => {
    // Wait for auth check to complete
    if (!isLoading) {
      if (!user) {
        navigate("/", { replace: true });
      } else if (!user.is_admin) {
        navigate("/dashboard", { replace: true });
      }
    }
  }, [isLoading, user, navigate]);

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-white">
        <div className="w-8 h-8 border-2 border-indigo-600 border-t-transparent rounded-full spinner"></div>
      </div>
    );
  }

  return user && user.is_admin ? children : null;
};

// App Router
function AppRouter() {
  return (
    <Routes>
      <Route path="/" element={<Landing />} />
      <Route
        path="/dashboard"
        element={
          <ProtectedRoute>
            <Dashboard />
          </ProtectedRoute>
        }
      />
      <Route
        path="/profile/:userId"
        element={
          <ProtectedRoute>
            <Profile />
          </ProtectedRoute>
        }
      />
      <Route
        path="/item/:itemId"
        element={
          <ProtectedRoute>
            <ItemDetail />
          </ProtectedRoute>
        }
      />
      <Route
        path="/messages"
        element={
          <ProtectedRoute>
            <Messages />
          </ProtectedRoute>
        }
      />
      <Route
        path="/messages/:tradeId"
        element={
          <ProtectedRoute>
            <Messages />
          </ProtectedRoute>
        }
      />
      <Route
        path="/post"
        element={
          <ProtectedRoute>
            <PostItem />
          </ProtectedRoute>
        }
      />
      <Route
        path="/my-items"
        element={
          <ProtectedRoute>
            <MyItems />
          </ProtectedRoute>
        }
      />
      <Route
        path="/trades"
        element={
          <ProtectedRoute>
            <Trades />
          </ProtectedRoute>
        }
      />
      <Route
        path="/admin"
        element={
          <AdminProtectedRoute>
            <AdminDashboard />
          </AdminProtectedRoute>
        }
      />
    </Routes>
  );
}

// Helper function to get auth headers
const getAuthHeaders = () => {
  const sessionToken = localStorage.getItem('session_token');
  const headers = {};
  if (sessionToken) {
    headers['Authorization'] = `Bearer ${sessionToken}`;
  }
  return headers;
};

// Auth Provider
function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const authCheckedRef = useRef(false);

  // Check auth once on mount
  useEffect(() => {
    if (authCheckedRef.current) return;
    
    const checkAuth = async () => {
      if (!API) {
        setIsLoading(false);
        return;
      }

      try {
        const sessionToken = localStorage.getItem('session_token');
        const headers = {};
        if (sessionToken) {
          headers['Authorization'] = `Bearer ${sessionToken}`;
        }

        const response = await axios.get(`${API}/auth/me`, { 
          withCredentials: true,
          headers: headers,
          timeout: 5000
        });

        if (response.data) {
          setUser(response.data);
        }
      } catch (error) {
        // Silently fail - user is not authenticated
        console.debug('Auth check failed (user not logged in):', error.message);
      } finally {
        setIsLoading(false);
        authCheckedRef.current = true;
      }
    };

    checkAuth();
  }, [API]);

  const logout = async () => {
    try {
      const headers = getAuthHeaders();
      await axios.post(`${API}/auth/logout`, {}, { 
        withCredentials: true,
        headers: headers
      });
    } catch (error) {
      console.error("Logout error:", error);
    } finally {
      setUser(null);
      localStorage.removeItem('session_token');
      authCheckedRef.current = false;
    }
  };

  // Preload data after authentication
  const preloadCache = usePreload(user, API, getAuthHeaders);

  return (
    <AuthContext.Provider value={{ user, setUser, isLoading, setIsLoading, logout, API, getAuthHeaders }}>
      <PreloadContext.Provider value={preloadCache}>
        {children}
      </PreloadContext.Provider>
    </AuthContext.Provider>
  );
}

function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <WebSocketProvider>
          <AppRouter />
          <BugReportButton />
          <Toaster position="top-right" richColors />
        </WebSocketProvider>
      </AuthProvider>
    </BrowserRouter>
  );
}

export default App;
