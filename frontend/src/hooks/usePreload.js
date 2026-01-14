import { useEffect, useRef } from 'react';
import axios from 'axios';

/**
 * Preload hook that fetches common data in the background after authentication
 * This improves perceived performance by loading data before users navigate to pages
 */
export const usePreload = (user, API, getAuthHeaders) => {
  const preloadedRef = useRef(false);
  const preloadCacheRef = useRef({
    conversations: null,
    trades: null,
    items: null,
    categories: null,
    notifications: null,
    unreadCount: null,
    timestamp: null
  });

  useEffect(() => {
    // Only preload if user is authenticated and we haven't preloaded yet
    if (!user || preloadedRef.current) return;

    const preloadData = async () => {
      try {
        const headers = getAuthHeaders();
        const preloadPromises = [];

        // Preload conversations (for messages page)
        preloadPromises.push(
          axios.get(`${API}/conversations`, {
            withCredentials: true,
            headers: headers
          }).then(res => {
            preloadCacheRef.current.conversations = res.data;
          }).catch(() => {}) // Silently fail - will fetch on demand
        );

        // Preload trades (for trades page)
        preloadPromises.push(
          axios.get(`${API}/trades`, {
            withCredentials: true,
            headers: headers
          }).then(res => {
            preloadCacheRef.current.trades = res.data;
          }).catch(() => {})
        );

        // Preload items (for dashboard - limit to first page for performance)
        preloadPromises.push(
          axios.get(`${API}/items?include_owners=true`, {
            withCredentials: true,
            headers: headers,
            params: { limit: 20 } // Preload first 20 items
          }).then(res => {
            preloadCacheRef.current.items = res.data;
          }).catch(() => {})
        );

        // Preload categories (for dashboard and post item)
        preloadPromises.push(
          axios.get(`${API}/categories`, {
            withCredentials: true,
            headers: headers
          }).then(res => {
            preloadCacheRef.current.categories = res.data;
          }).catch(() => {})
        );

        // Preload notifications
        preloadPromises.push(
          axios.get(`${API}/notifications`, {
            withCredentials: true,
            headers: headers
          }).then(res => {
            preloadCacheRef.current.notifications = res.data;
          }).catch(() => {})
        );

        // Preload unread message count
        preloadPromises.push(
          axios.get(`${API}/messages/unread-count`, {
            withCredentials: true,
            headers: headers
          }).then(res => {
            preloadCacheRef.current.unreadCount = res.data.unread_count || 0;
          }).catch(() => {})
        );

        // Wait for all preloads to complete (or fail silently)
        await Promise.allSettled(preloadPromises);
        
        preloadCacheRef.current.timestamp = Date.now();
        preloadedRef.current = true;
        
        console.log('Data preloaded successfully');
      } catch (error) {
        console.error('Preload error:', error);
        // Don't block - preload is optional
      }
    };

    // Start preloading after a short delay to not block initial render
    const timeoutId = setTimeout(() => {
      preloadData();
    }, 500);

    return () => clearTimeout(timeoutId);
  }, [user, API, getAuthHeaders]);

  // Return cache getter functions
  return {
    getCachedConversations: () => {
      const cached = preloadCacheRef.current.conversations;
      // Cache is valid for 30 seconds
      if (cached && preloadCacheRef.current.timestamp && 
          Date.now() - preloadCacheRef.current.timestamp < 30000) {
        return cached;
      }
      return null;
    },
    getCachedTrades: () => {
      const cached = preloadCacheRef.current.trades;
      if (cached && preloadCacheRef.current.timestamp && 
          Date.now() - preloadCacheRef.current.timestamp < 30000) {
        return cached;
      }
      return null;
    },
    getCachedItems: () => {
      const cached = preloadCacheRef.current.items;
      if (cached && preloadCacheRef.current.timestamp && 
          Date.now() - preloadCacheRef.current.timestamp < 30000) {
        return cached;
      }
      return null;
    },
    getCachedCategories: () => {
      const cached = preloadCacheRef.current.categories;
      if (cached && preloadCacheRef.current.timestamp && 
          Date.now() - preloadCacheRef.current.timestamp < 30000) {
        return cached;
      }
      return null;
    },
    getCachedNotifications: () => {
      const cached = preloadCacheRef.current.notifications;
      if (cached && preloadCacheRef.current.timestamp && 
          Date.now() - preloadCacheRef.current.timestamp < 30000) {
        return cached;
      }
      return null;
    },
    getCachedUnreadCount: () => {
      const cached = preloadCacheRef.current.unreadCount;
      if (cached !== null && preloadCacheRef.current.timestamp && 
          Date.now() - preloadCacheRef.current.timestamp < 30000) {
        return cached;
      }
      return null;
    },
    invalidateCache: () => {
      preloadCacheRef.current = {
        conversations: null,
        trades: null,
        items: null,
        categories: null,
        notifications: null,
        unreadCount: null,
        timestamp: null
      };
      preloadedRef.current = false;
    }
  };
};
