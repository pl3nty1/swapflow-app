import { useEffect, useState, useCallback } from "react";
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
  const { getCachedItems, getCachedCategories, getCachedItemList, setCachedItemList } = usePreloadCache();
  const [allItems, setAllItems] = useState([]); // Store all items for client-side filtering
  const [categories, setCategories] = useState([]);
  const [selectedCategory, setSelectedCategory] = useState(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [isLoading, setIsLoading] = useState(true);
  const [owners, setOwners] = useState({});

  const fetchItems = useCallback(async (showCached = true) => {
    // Always fetch ALL items (no category filter) for client-side filtering
    const params = { include_owners: true };
    
    // Check cache first and show immediately
    if (showCached) {
      const cached = getCachedItemList(params);
      if (cached && cached.length > 0) {
        setAllItems(cached);
        const ownerMap = {};
        cached.forEach((item) => {
          if (item.owner) {
            ownerMap[item.owner.user_id] = item.owner;
          }
        });
        setOwners(ownerMap);
        setIsLoading(false);
        // Extract categories from cached items
        const categorySet = new Set(cached.map(item => item.category).filter(Boolean));
        const categoryList = Array.from(categorySet).map(name => ({ name })).sort((a, b) => a.name.localeCompare(b.name));
        setCategories(categoryList);
        // Continue to fetch fresh data in background
      }
    }

    try {
      const response = await axios.get(`${API}/items`, { params, withCredentials: true });
      const freshItems = response.data;
      
      // Check for desync: compare cached vs fresh
      if (showCached) {
        const cached = getCachedItemList(params);
        if (cached) {
          const cachedIds = new Set(cached.map(i => i.item_id));
          const freshIds = new Set(freshItems.map(i => i.item_id));
          
          // Check if there are differences
          const hasNewItems = freshItems.some(i => !cachedIds.has(i.item_id));
          const hasRemovedItems = cached.some(i => !freshIds.has(i.item_id));
          const hasUpdatedItems = cached.some(cachedItem => {
            const freshItem = freshItems.find(f => f.item_id === cachedItem.item_id);
            return freshItem && JSON.stringify(cachedItem) !== JSON.stringify(freshItem);
          });
          
          // Only update if there's a desync
          if (hasNewItems || hasRemovedItems || hasUpdatedItems) {
            setAllItems(freshItems);
            const ownerMap = {};
            freshItems.forEach((item) => {
              if (item.owner) {
                ownerMap[item.owner.user_id] = item.owner;
              }
            });
            setOwners(ownerMap);
            // Update categories from fresh items
            const categorySet = new Set(freshItems.map(item => item.category).filter(Boolean));
            const categoryList = Array.from(categorySet).map(name => ({ name })).sort((a, b) => a.name.localeCompare(b.name));
            setCategories(categoryList);
          }
        } else {
          // No cache, set fresh data
          setAllItems(freshItems);
          const ownerMap = {};
          freshItems.forEach((item) => {
            if (item.owner) {
              ownerMap[item.owner.user_id] = item.owner;
            }
          });
          setOwners(ownerMap);
          // Extract categories from fresh items
          const categorySet = new Set(freshItems.map(item => item.category).filter(Boolean));
          const categoryList = Array.from(categorySet).map(name => ({ name })).sort((a, b) => a.name.localeCompare(b.name));
          setCategories(categoryList);
        }
      } else {
        // Not showing cached, set fresh data directly
        setAllItems(freshItems);
        const ownerMap = {};
        freshItems.forEach((item) => {
          if (item.owner) {
            ownerMap[item.owner.user_id] = item.owner;
          }
        });
        setOwners(ownerMap);
        // Extract categories from fresh items
        const categorySet = new Set(freshItems.map(item => item.category).filter(Boolean));
        const categoryList = Array.from(categorySet).map(name => ({ name })).sort((a, b) => a.name.localeCompare(b.name));
        setCategories(categoryList);
      }
      
      // Update cache with fresh data
      setCachedItemList(params, freshItems);
    } catch (error) {
      console.error("Failed to fetch items:", error);
      // If we showed cached data and fetch failed, keep showing cached
      if (!showCached) {
        setIsLoading(false);
      }
    } finally {
      setIsLoading(false);
    }
  }, [API, getCachedItemList, setCachedItemList]);

  useEffect(() => {
    fetchItems();
  }, [fetchItems]);

  // Filter items client-side by category and search query
  const filteredItems = allItems.filter((item) => {
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
