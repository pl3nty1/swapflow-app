import { createContext, useContext } from 'react';

export const PreloadContext = createContext(null);

export const usePreloadCache = () => {
  const context = useContext(PreloadContext);
  return context || {
    getCachedConversations: () => null,
    getCachedTrades: () => null,
    getCachedItems: () => null,
    getCachedCategories: () => null,
    getCachedNotifications: () => null,
    getCachedUnreadCount: () => null,
    getCachedItem: () => null,
    setCachedItem: () => {},
    getCachedItemList: () => null,
    setCachedItemList: () => {},
    invalidateItemCache: () => {},
    invalidateCache: () => {}
  };
};
