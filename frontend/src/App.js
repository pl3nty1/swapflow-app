import { useEffect, useState } from "react";
import "@/App.css";
import { BrowserRouter, Routes, Route, useNavigate } from "react-router-dom";
import axios from "axios";
import { Toaster } from "@/components/ui/sonner";

// Pages
import Landing from "@/pages/Landing";
import Dashboard from "@/pages/Dashboard";
import Profile from "@/pages/Profile";
import ItemDetail from "@/pages/ItemDetail";
import Messages from "@/pages/Messages";
import PostItem from "@/pages/PostItem";
import MyItems from "@/pages/MyItems";
import Trades from "@/pages/Trades";

const BACKEND_URL = (process.env.REACT_APP_BACKEND_URL || 'https://swapflow-app-uj7o.vercel.app').replace(/\/+$/, ''); // Remove trailing slashes
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
  const { user, setUser, isLoading, setIsLoading } = useAuth();

  useEffect(() => {
    // If we already have user, skip
    if (user) {
      setIsLoading(false);
      return;
    }

    const checkAuth = async () => {
      if (!API) {
        console.error('API URL not configured');
        setIsLoading(false);
        navigate("/", { replace: true });
        return;
      }

      try {
        // Get session token from localStorage as fallback
        const sessionToken = localStorage.getItem('session_token');
        const headers = {};
        if (sessionToken) {
          headers['Authorization'] = `Bearer ${sessionToken}`;
        }

        const response = await axios.get(`${API}/auth/me`, { 
          withCredentials: true,
          headers: headers,
          timeout: 10000 // 10 second timeout
        });

        if (response.data) {
          setUser(response.data);
        } else {
          navigate("/", { replace: true });
        }
      } catch (error) {
        console.error('Auth check failed:', error);
        navigate("/", { replace: true });
      } finally {
        setIsLoading(false);
      }
    };

    checkAuth();
  }, [navigate, setUser, user, setIsLoading, API]);

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-white">
        <div className="w-8 h-8 border-2 border-indigo-600 border-t-transparent rounded-full spinner"></div>
      </div>
    );
  }

  return user ? children : null;
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
        path="/messages/:partnerId"
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
    }
  };

  return (
    <AuthContext.Provider value={{ user, setUser, isLoading, setIsLoading, logout, API, getAuthHeaders }}>
      {children}
    </AuthContext.Provider>
  );
}

function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <AppRouter />
        <Toaster position="top-right" richColors />
      </AuthProvider>
    </BrowserRouter>
  );
}

export default App;
