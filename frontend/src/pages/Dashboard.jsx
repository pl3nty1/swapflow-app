import { useEffect, useState, useCallback } from "react";
import axios from "axios";
import { useAuth } from "@/App";
import { Header } from "@/components/Header";
import { ItemCard } from "@/components/ItemCard";
import { CategoryFilter } from "@/components/CategoryFilter";
import { Input } from "@/components/ui/input";
import { Search, Loader2 } from "lucide-react";

const Dashboard = () => {
  const { API } = useAuth();
  const [items, setItems] = useState([]);
  const [categories, setCategories] = useState([]);
  const [selectedCategory, setSelectedCategory] = useState(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [isLoading, setIsLoading] = useState(true);
  const [owners, setOwners] = useState({});

  const fetchItems = useCallback(async () => {
    try {
      const params = selectedCategory ? { category: selectedCategory } : {};
      const response = await axios.get(`${API}/items`, { params, withCredentials: true });
      setItems(response.data);

      // Fetch owner info for each item
      const ownerIds = [...new Set(response.data.map((item) => item.user_id))];
      const ownerPromises = ownerIds.map((id) =>
        axios.get(`${API}/users/${id}`, { withCredentials: true }).catch(() => null)
      );
      const ownerResponses = await Promise.all(ownerPromises);
      const ownerMap = {};
      ownerResponses.forEach((res) => {
        if (res?.data) {
          ownerMap[res.data.user_id] = res.data;
        }
      });
      setOwners(ownerMap);
    } catch (error) {
      console.error("Failed to fetch items:", error);
    } finally {
      setIsLoading(false);
    }
  }, [API, selectedCategory]);

  const fetchCategories = useCallback(async () => {
    try {
      const response = await axios.get(`${API}/categories`, { withCredentials: true });
      setCategories(response.data);
    } catch (error) {
      console.error("Failed to fetch categories:", error);
    }
  }, [API]);

  useEffect(() => {
    fetchItems();
    fetchCategories();
  }, [fetchItems, fetchCategories]);

  // Filter items by search query
  const filteredItems = items.filter((item) => {
    if (!searchQuery) return true;
    const query = searchQuery.toLowerCase();
    return (
      item.title.toLowerCase().includes(query) ||
      item.category.toLowerCase().includes(query) ||
      item.description?.toLowerCase().includes(query)
    );
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
