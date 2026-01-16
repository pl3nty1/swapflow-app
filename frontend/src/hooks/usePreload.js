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
  
  // Item cache: stores items by ID and item lists by query key
  const itemCacheRef = useRef({
    itemsById: {}, // { itemId: { item, owner, timestamp } }
    itemLists: {}, // { queryKey: { items, timestamp, lastSync } }
    CACHE_DURATION: 10 * 60 * 1000, // 10 minutes - extended for better persistence
    SYNC_INTERVAL: 30 * 1000 // Sync check every 30 seconds (lightweight)
  });
  
  // Messages cache: stores messages by trade_id
  const messagesCacheRef = useRef({
    messagesByTradeId: {}, // { tradeId: { messages, timestamp } }
    CACHE_DURATION: 10 * 60 * 1000 // 10 minutes - same as items
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
        // Use lower priority - delay this to not block other critical data
        setTimeout(() => {
          axios.get(`${API}/items?include_owners=true`, {
            withCredentials: true,
            headers: headers,
            params: { limit: 20 } // Preload first 20 items
          }).then(res => {
            preloadCacheRef.current.items = res.data;
          }).catch(() => {});
        }, 1000); // Delay items preload by 1 second

        // Preload categories (for dashboard and post item)
        preloadPromises.push(
          axios.get(`${API}/categories`, {
            withCredentials: true,
            headers: headers
          }).then(res => {
            preloadCacheRef.current.categories = res.data;
          }).catch(() => {})
        );

        // Preload notifications (lower priority - delay)
        setTimeout(() => {
          axios.get(`${API}/notifications`, {
            withCredentials: true,
            headers: headers
          }).then(res => {
            preloadCacheRef.current.notifications = res.data;
          }).catch(() => {});
        }, 1500); // Delay notifications by 1.5 seconds

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
        // Increased delay to let UI render first
        const timeoutId = setTimeout(() => {
          preloadData();
        }, 1000);

    return () => clearTimeout(timeoutId);
  }, [user, API, getAuthHeaders]);

  // Helper to generate query key for item lists
  const getItemListKey = (params = {}) => {
    const sortedParams = Object.keys(params).sort().map(key => `${key}:${params[key]}`).join('|');
    return sortedParams || 'all';
  };

  // Return cache getter functions
  return {
    getCachedConversations: () => {
      const cached = preloadCacheRef.current.conversations;
      // Cache is valid for 10 minutes (extended from 30 seconds)
      if (cached && preloadCacheRef.current.timestamp && 
          Date.now() - preloadCacheRef.current.timestamp < 10 * 60 * 1000) {
        return cached;
      }
      return null;
    },
    setCachedConversations: (conversations) => {
      preloadCacheRef.current.conversations = conversations;
      preloadCacheRef.current.timestamp = Date.now();
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
    // Item cache functions
    getCachedItem: (itemId) => {
      const cached = itemCacheRef.current.itemsById[itemId];
      if (cached && Date.now() - cached.timestamp < itemCacheRef.current.CACHE_DURATION) {
        return cached;
      }
      return null;
    },
    setCachedItem: (itemId, item, owner = null) => {
      itemCacheRef.current.itemsById[itemId] = {
        item,
        owner,
        timestamp: Date.now()
      };
    },
    getCachedItemList: (params = {}) => {
      const key = getItemListKey(params);
      const cached = itemCacheRef.current.itemLists[key];
      if (cached && Date.now() - cached.timestamp < itemCacheRef.current.CACHE_DURATION) {
        return cached.items;
      }
      return null;
    },
    getCachedItemListMetadata: (params = {}) => {
      const key = getItemListKey(params);
      const cached = itemCacheRef.current.itemLists[key];
      if (cached) {
        return {
          items: cached.items,
          timestamp: cached.timestamp,
          lastSync: cached.lastSync || cached.timestamp,
          itemIds: cached.items?.map(i => i.item_id).join(',') || ''
        };
      }
      return null;
    },
    setCachedItemList: (params = {}, items, lastSync = null) => {
      const key = getItemListKey(params);
      itemCacheRef.current.itemLists[key] = {
        items,
        timestamp: Date.now(),
        lastSync: lastSync || Date.now()
      };
      // Also cache individual items
      items.forEach(item => {
        if (item.item_id) {
          itemCacheRef.current.itemsById[item.item_id] = {
            item,
            owner: item.owner || null,
            timestamp: Date.now()
          };
        }
      });
    },
    updateCachedItemList: (params = {}, newItems, removedIds = []) => {
      // Incrementally update cache with new/changed items
      const key = getItemListKey(params);
      const cached = itemCacheRef.current.itemLists[key];
      if (cached && cached.items) {
        // Remove deleted items
        const itemsById = new Map(cached.items.map(i => [i.item_id, i]));
        removedIds.forEach(id => itemsById.delete(id));
        
        // Add/update new items
        newItems.forEach(newItem => {
          itemsById.set(newItem.item_id, newItem);
          // Also update individual item cache
          itemCacheRef.current.itemsById[newItem.item_id] = {
            item: newItem,
            owner: newItem.owner || null,
            timestamp: Date.now()
          };
        });
        
        cached.items = Array.from(itemsById.values());
        cached.lastSync = Date.now();
      } else {
        // No existing cache, set new
        itemCacheRef.current.itemLists[key] = {
          items: newItems,
          timestamp: Date.now(),
          lastSync: Date.now()
        };
      }
    },
    invalidateItemCache: (itemId = null) => {
      if (itemId) {
        // Invalidate specific item
        delete itemCacheRef.current.itemsById[itemId];
        // Invalidate all lists that might contain this item
        Object.keys(itemCacheRef.current.itemLists).forEach(key => {
          const list = itemCacheRef.current.itemLists[key];
          if (list && list.items && list.items.some(item => item.item_id === itemId)) {
            delete itemCacheRef.current.itemLists[key];
          }
        });
      } else {
        // Invalidate all item caches
        itemCacheRef.current.itemsById = {};
        itemCacheRef.current.itemLists = {};
      }
    },
    // Messages cache functions
    getCachedMessages: (tradeId) => {
      const cached = messagesCacheRef.current.messagesByTradeId[tradeId];
      if (cached && Date.now() - cached.timestamp < messagesCacheRef.current.CACHE_DURATION) {
        return cached.messages;
      }
      return null;
    },
    setCachedMessages: (tradeId, messages) => {
      messagesCacheRef.current.messagesByTradeId[tradeId] = {
        messages,
        timestamp: Date.now()
      };
    },
    updateCachedMessage: (tradeId, newMessage) => {
      // Add or update a single message in cache
      const cached = messagesCacheRef.current.messagesByTradeId[tradeId];
      if (cached) {
        const existingIndex = cached.messages.findIndex(m => m.message_id === newMessage.message_id);
        if (existingIndex >= 0) {
          cached.messages[existingIndex] = newMessage;
        } else {
          cached.messages.push(newMessage);
        }
        cached.timestamp = Date.now();
      }
    },
    invalidateMessagesCache: (tradeId = null) => {
      if (tradeId) {
        delete messagesCacheRef.current.messagesByTradeId[tradeId];
      } else {
        messagesCacheRef.current.messagesByTradeId = {};
      }
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
      itemCacheRef.current.itemsById = {};
      itemCacheRef.current.itemLists = {};
      messagesCacheRef.current.messagesByTradeId = {};
      preloadedRef.current = false;
    }
  };
};
