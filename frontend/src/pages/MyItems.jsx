import { useEffect, useState, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import axios from "axios";
import { useAuth } from "@/App";
import { Header } from "@/components/Header";
import { ItemCard } from "@/components/ItemCard";
import { Button } from "@/components/ui/button";
import { Loader2, Plus } from "lucide-react";

const MyItems = () => {
  const navigate = useNavigate();
  const { user, API } = useAuth();
  const [items, setItems] = useState([]);
  const [isLoading, setIsLoading] = useState(true);

  const fetchItems = useCallback(async () => {
    try {
      const response = await axios.get(`${API}/my-items`, { withCredentials: true });
      setItems(response.data);
    } catch (error) {
      console.error("Failed to fetch items:", error);
    } finally {
      setIsLoading(false);
    }
  }, [API]);

  useEffect(() => {
    fetchItems();
  }, [fetchItems]);

  return (
    <div className="min-h-screen bg-white" data-testid="my-items-page">
      <Header />

      <main className="max-w-7xl mx-auto px-4 md:px-8 lg:px-12 py-8">
        <div className="flex items-center justify-between mb-8">
          <h1
            className="text-3xl font-bold text-slate-900"
            style={{ fontFamily: "Manrope, sans-serif" }}
          >
            My Items
          </h1>
          <Button
            onClick={() => navigate("/post")}
            className="bg-indigo-600 hover:bg-indigo-700 text-white rounded-full"
            data-testid="post-new-btn"
          >
            <Plus className="w-4 h-4 mr-2" />
            Post New Item
          </Button>
        </div>

        {isLoading ? (
          <div className="flex items-center justify-center py-20">
            <Loader2 className="w-8 h-8 text-indigo-600 spinner" />
          </div>
        ) : items.length === 0 ? (
          <div className="text-center py-20 bg-slate-50 rounded-2xl">
            <p className="text-slate-500 text-lg mb-4">
              You haven't posted any items yet
            </p>
            <Button
              onClick={() => navigate("/post")}
              className="bg-indigo-600 hover:bg-indigo-700 text-white rounded-full"
            >
              <Plus className="w-4 h-4 mr-2" />
              Post Your First Item
            </Button>
          </div>
        ) : (
          <div className="masonry-grid" data-testid="my-items-grid">
            {items.map((item) => (
              <ItemCard key={item.item_id} item={item} owner={user} />
            ))}
          </div>
        )}
      </main>
    </div>
  );
};

export default MyItems;
