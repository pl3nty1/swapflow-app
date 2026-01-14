import { useEffect, useState, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import axios from "axios";
import { useAuth } from "@/App";
import { Header } from "@/components/Header";
import { ItemCard } from "@/components/ItemCard";
import { Button } from "@/components/ui/button";
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
import { Loader2, Plus, Trash2 } from "lucide-react";

const MyItems = () => {
  const navigate = useNavigate();
  const { user, API, getAuthHeaders } = useAuth();
  const [items, setItems] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [deletingItemId, setDeletingItemId] = useState(null);
  const [deleteDialog, setDeleteDialog] = useState({ isOpen: false, itemId: null });

  const fetchItems = useCallback(async () => {
    try {
      const headers = getAuthHeaders();
      const response = await axios.get(`${API}/my-items`, { 
        withCredentials: true,
        headers: headers
      });
      setItems(response.data);
    } catch (error) {
      console.error("Failed to fetch items:", error);
    } finally {
      setIsLoading(false);
    }
  }, [API]); // getAuthHeaders is stable and doesn't need to be in dependencies

  useEffect(() => {
    fetchItems();
  }, [fetchItems]);

  const handleDeleteClick = (itemId) => {
    setDeleteDialog({ isOpen: true, itemId });
  };

  const handleDeleteConfirm = async () => {
    if (!deleteDialog.itemId) return;
    
    setDeletingItemId(deleteDialog.itemId);
    try {
      const headers = getAuthHeaders();
      await axios.delete(`${API}/items/${deleteDialog.itemId}`, {
        withCredentials: true,
        headers: headers
      });
      toast.success("Item deleted");
      setDeleteDialog({ isOpen: false, itemId: null });
      fetchItems(); // Refresh the list
    } catch (error) {
      toast.error(error.response?.data?.detail || "Failed to delete item");
    } finally {
      setDeletingItemId(null);
    }
  };

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
              <div key={item.item_id} className="relative group">
                <ItemCard item={item} owner={user} />
                <Button
                  variant="destructive"
                  size="sm"
                  onClick={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    handleDeleteClick(item.item_id);
                  }}
                  disabled={deletingItemId === item.item_id}
                  className="absolute top-3 right-3 opacity-0 group-hover:opacity-100 transition-opacity rounded-full"
                  data-testid={`delete-item-${item.item_id}`}
                >
                  <Trash2 className="w-4 h-4" />
                </Button>
              </div>
            ))}
          </div>
        )}

        {/* Delete Confirmation Dialog */}
        <AlertDialog open={deleteDialog.isOpen} onOpenChange={(open) => !open && setDeleteDialog({ isOpen: false, itemId: null })}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Delete Item?</AlertDialogTitle>
              <AlertDialogDescription>
                Are you sure you want to delete this item? This action cannot be undone. Any active trades involving this item will be canceled.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel disabled={deletingItemId !== null}>Cancel</AlertDialogCancel>
              <AlertDialogAction
                onClick={handleDeleteConfirm}
                disabled={deletingItemId !== null}
                className="bg-red-600 hover:bg-red-700"
              >
                {deletingItemId ? "Deleting..." : "Delete"}
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </main>
    </div>
  );
};

export default MyItems;
