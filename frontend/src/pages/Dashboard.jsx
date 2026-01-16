import { useEffect, useState, useCallback, useMemo, useRef } from "react";
import axios from "axios";
import { useAuth } from "@/App";
import { usePreloadCache } from "@/contexts/PreloadContext";
import { Header } from "@/components/Header";
import { ItemCard } from "@/components/ItemCard";
import { CategoryFilter } from "@/components/CategoryFilter";
import { Input } from "@/components/ui/input";
import { Search, Loader2 } from "lucide-react";

const Dashboard = () => {
  const { API } = useAuth();
  const { getCachedItemList, setCachedItemList, getCachedItemListMetadata, updateCachedItemList } = usePreloadCache();
  const [allItems, setAllItems] = useState([]); // Store all items for client-side filtering
  const [categories, setCategories] = useState([]);
  const [selectedCategory, setSelectedCategory] = useState(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [isLoading, setIsLoading] = useState(false); // Start with false - use cache immediately
  const [owners, setOwners] = useState({});
  const syncInProgressRef = useRef(false);
  const lastSyncRef = useRef(0);

  // Helper to process items and extract data (frontloaded computation)
  const processItems = useCallback((items) => {
    const ownerMap = {};
    items.forEach((item) => {
      if (item.owner) {
        ownerMap[item.owner.user_id] = item.owner;
      }
    });
    const categorySet = new Set(items.map(item => item.category).filter(Boolean));
    const categoryList = Array.from(categorySet).map(name => ({ name })).sort((a, b) => a.name.localeCompare(b.name));
    return { ownerMap, categoryList };
  }, []);

  // Lightweight sync check - only fetch IDs to see what changed
  const syncItems = useCallback(async () => {
    if (syncInProgressRef.current) return;
    
    const params = { include_owners: true, limit: 100 };
    const cacheMeta = getCachedItemListMetadata(params);
    
    // If no cache or cache is very fresh (< 30s), skip sync
    if (!cacheMeta || (Date.now() - cacheMeta.lastSync < 30000)) {
      return;
    }

    syncInProgressRef.current = true;
    try {
      // Lightweight sync: just get IDs
      const syncResponse = await axios.get(`${API}/items/sync`, {
        params: { cached_ids: cacheMeta.itemIds },
        withCredentials: true
      });

      const { item_ids, removed_ids } = syncResponse.data;
      const cachedIds = new Set(cacheMeta.items.map(i => i.item_id));
      const currentIds = new Set(item_ids);
      
      // Find new/changed items (items in server but not in cache)
      const newItemIds = item_ids.filter(id => !cachedIds.has(id));
      
      if (newItemIds.length > 0 || removed_ids.length > 0) {
        // Only fetch the new/changed items
        if (newItemIds.length > 0) {
          const newItemsResponse = await axios.get(`${API}/items`, {
            params: { 
              item_ids: newItemIds.join(','),
              include_owners: true 
            },
            withCredentials: true
          });
          
          // Incrementally update cache
          updateCachedItemList(params, newItemsResponse.data, removed_ids);
          
          // Update state
          const updatedCache = getCachedItemList(params);
          if (updatedCache) {
            setAllItems(updatedCache);
            const { ownerMap, categoryList } = processItems(updatedCache);
            setOwners(ownerMap);
            setCategories(categoryList);
          }
        } else if (removed_ids.length > 0) {
          // Only removals, update cache
          updateCachedItemList(params, [], removed_ids);
          const updatedCache = getCachedItemList(params);
          if (updatedCache) {
            setAllItems(updatedCache);
            const { ownerMap, categoryList } = processItems(updatedCache);
            setOwners(ownerMap);
            setCategories(categoryList);
          }
        }
      }
      
      lastSyncRef.current = Date.now();
    } catch (error) {
      console.error("Sync failed:", error);
      // Don't block UI on sync failure
    } finally {
      syncInProgressRef.current = false;
    }
  }, [API, getCachedItemListMetadata, getCachedItemList, updateCachedItemList, processItems]);

  // Full fetch (only when cache is missing or stale)
  const fetchItems = useCallback(async (forceRefresh = false) => {
    const params = { include_owners: true, limit: 100 };
    
    // Always check cache first - use it if available and fresh
    const cached = getCachedItemList(params);
    if (cached && cached.length > 0 && !forceRefresh) {
      setAllItems(cached);
      const { ownerMap, categoryList } = processItems(cached);
      setOwners(ownerMap);
      setCategories(categoryList);
      setIsLoading(false);
      
      // Do lightweight sync in background if cache is older than 30s
      if (Date.now() - lastSyncRef.current > 30000) {
        syncItems();
      }
      return; // Exit early - cache is good!
    }

    // Cache miss or force refresh - fetch full data
    setIsLoading(true);
    try {
      const response = await axios.get(`${API}/items`, { params, withCredentials: true });
      const freshItems = response.data;
      
      setAllItems(freshItems);
      const { ownerMap, categoryList } = processItems(freshItems);
      setOwners(ownerMap);
      setCategories(categoryList);
      
      // Update cache
      setCachedItemList(params, freshItems, Date.now());
      lastSyncRef.current = Date.now();
    } catch (error) {
      console.error("Failed to fetch items:", error);
      // If we have stale cache, use it
      if (cached && cached.length > 0) {
        setAllItems(cached);
        const { ownerMap, categoryList } = processItems(cached);
        setOwners(ownerMap);
        setCategories(categoryList);
      }
    } finally {
      setIsLoading(false);
    }
  }, [API, getCachedItemList, setCachedItemList, processItems, syncItems]);

  // Load from cache immediately on mount (no loading state)
  useEffect(() => {
    const params = { include_owners: true, limit: 100 };
    const cached = getCachedItemList(params);
    if (cached && cached.length > 0) {
      setAllItems(cached);
      const { ownerMap, categoryList } = processItems(cached);
      setOwners(ownerMap);
      setCategories(categoryList);
      lastSyncRef.current = Date.now();
    }
    
    // Fetch fresh data if no cache or cache is stale
    fetchItems(!cached || cached.length === 0);
  }, [fetchItems, getCachedItemList, processItems]);

  // Periodic lightweight sync (every 30 seconds if user is on page)
  useEffect(() => {
    const interval = setInterval(() => {
      syncItems();
    }, 30000); // Sync every 30 seconds
    
    return () => clearInterval(interval);
  }, [syncItems]);

  // Frontload client-side filtering with useMemo for performance
  const filteredItems = useMemo(() => {
    return allItems.filter((item) => {
      // Filter by category (client-side)
      if (selectedCategory && item.category !== selectedCategory) {
        return false;
      }
      
      // Filter by search query
      if (searchQuery) {
        const query = searchQuery.toLowerCase();
        return (
          item.title.toLowerCase().includes(query) ||
          item.category.toLowerCase().includes(query) ||
          item.description?.toLowerCase().includes(query)
        );
      }
      
      return true;
    });
  }, [allItems, selectedCategory, searchQuery]);

  return (
    <div className="min-h-screen bg-white" data-testid="dashboard-page">
      <Header />

      <main className="max-w-7xl mx-auto px-4 md:px-8 lg:px-12 py-8">
        {/* Search Bar */}
        <div className="relative max-w-xl mx-auto mb-6">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
          <Input
            type="text"
            placeholder="Search items..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-12 h-12 rounded-full bg-slate-50 border-slate-200 focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500"
            data-testid="search-input"
          />
        </div>

        {/* Category Filter */}
        <CategoryFilter
          categories={categories}
          selectedCategory={selectedCategory}
          onSelectCategory={setSelectedCategory}
        />

        {/* Items Grid */}
        {isLoading ? (
          <div className="flex items-center justify-center py-20">
            <Loader2 className="w-8 h-8 text-indigo-600 spinner" />
          </div>
        ) : filteredItems.length === 0 ? (
          <div className="text-center py-20">
            <p className="text-slate-500 text-lg">
              {searchQuery || selectedCategory
                ? "No items found matching your criteria"
                : "No items available yet. Be the first to post!"}
            </p>
          </div>
        ) : (
          <div className="masonry-grid" data-testid="items-grid">
            {filteredItems.map((item) => (
              <ItemCard
                key={item.item_id}
                item={item}
                owner={owners[item.user_id]}
              />
            ))}
          </div>
        )}
      </main>
    </div>
  );
};

export default Dashboard;
