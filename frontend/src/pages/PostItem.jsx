import { useState, useRef, useEffect, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import axios from "axios";
import { useAuth } from "@/App";
import { Header } from "@/components/Header";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { toast } from "sonner";
import { ImagePlus, X, Loader2, ChevronDown, ChevronUp } from "lucide-react";
import imageCompression from "browser-image-compression";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";

const PostItem = () => {
  const navigate = useNavigate();
  const { API, getAuthHeaders } = useAuth();
  const fileInputRef = useRef(null);
  const [isLoading, setIsLoading] = useState(false);
  const [imagePreview, setImagePreview] = useState(null);
  const [formData, setFormData] = useState({
    title: "",
    description: "",
    category: "",
    image: "",
    desired_category: "",
    desired_item_ids: [],
  });
  const [showPreferences, setShowPreferences] = useState(false);
  const [availableItems, setAvailableItems] = useState([]);
  const [isLoadingItems, setIsLoadingItems] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [isCompressing, setIsCompressing] = useState(false);
  const [categories, setCategories] = useState([]);
  const [isLoadingCategories, setIsLoadingCategories] = useState(false);

  const handleImageChange = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Validate file type
    if (!file.type.startsWith("image/")) {
      toast.error("Please select an image file");
      return;
    }

    // Validate file size (max 5MB as fallback)
    if (file.size > 5 * 1024 * 1024) {
      toast.error("Image must be less than 5MB");
      return;
    }

    setIsCompressing(true);
    try {
      // Compression options
      const options = {
        maxSizeMB: 0.5,        // Target 500KB max
        maxWidthOrHeight: 1920, // Max dimension
        useWebWorker: true,     // Better performance
        fileType: 'image/jpeg', // Convert to JPEG for smaller size
        initialQuality: 0.82    // 82% quality - good balance
      };

      // Compress the image
      const compressedFile = await imageCompression(file, options);
      
      // Create preview from compressed file
      const reader = new FileReader();
      reader.onload = (event) => {
        setImagePreview(event.target.result);
        setFormData((prev) => ({ ...prev, image: event.target.result }));
        setIsCompressing(false);
        
        // Show compression info if significant reduction
        const originalSizeMB = (file.size / (1024 * 1024)).toFixed(2);
        const compressedSizeMB = (compressedFile.size / (1024 * 1024)).toFixed(2);
        if (file.size > compressedFile.size * 1.5) {
          toast.success(`Image compressed: ${originalSizeMB}MB → ${compressedSizeMB}MB`);
        }
      };
      reader.readAsDataURL(compressedFile);
    } catch (error) {
      console.error("Image compression error:", error);
      setIsCompressing(false);
      
      // Fallback to original file if compression fails
      toast.error("Compression failed, using original image");
      const reader = new FileReader();
      reader.onload = (event) => {
        setImagePreview(event.target.result);
        setFormData((prev) => ({ ...prev, image: event.target.result }));
      };
      reader.readAsDataURL(file);
    }
  };

  const handleRemoveImage = () => {
    setImagePreview(null);
    setFormData((prev) => ({ ...prev, image: "" }));
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  };

  const fetchCategories = useCallback(async () => {
    setIsLoadingCategories(true);
    try {
      // Fetch all predefined categories for posting (include_all=true)
      const response = await axios.get(`${API}/categories?include_all=true`, { withCredentials: true });
      // Sort categories alphabetically
      const sorted = response.data.sort((a, b) => a.name.localeCompare(b.name));
      setCategories(sorted);
    } catch (error) {
      console.error("Failed to fetch categories:", error);
    } finally {
      setIsLoadingCategories(false);
    }
  }, [API]);

  useEffect(() => {
    fetchCategories();
  }, [fetchCategories]);

  const fetchAvailableItems = async () => {
    setIsLoadingItems(true);
    try {
      const response = await axios.get(`${API}/items`, { withCredentials: true });
      setAvailableItems(response.data.items || []);
    } catch (error) {
      console.error("Failed to fetch items:", error);
    } finally {
      setIsLoadingItems(false);
    }
  };

  const handleToggleItem = (itemId) => {
    setFormData((prev) => {
      const currentIds = prev.desired_item_ids || [];
      if (currentIds.includes(itemId)) {
        return { ...prev, desired_item_ids: currentIds.filter((id) => id !== itemId) };
      } else {
        return { ...prev, desired_item_ids: [...currentIds, itemId] };
      }
    });
  };

  const filteredItems = availableItems.filter(
    (item) =>
      !formData.desired_item_ids?.includes(item.item_id) && // Exclude already selected items
      (searchQuery === "" ||
        item.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
        item.category.toLowerCase().includes(searchQuery.toLowerCase()))
  );

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (!formData.title.trim()) {
      toast.error("Please enter a title");
      return;
    }
    if (!formData.image) {
      toast.error("Please add an image");
      return;
    }
    if (!formData.category.trim()) {
      toast.error("Please select a category");
      return;
    }

    setIsLoading(true);
    try {
      const headers = getAuthHeaders();

      await axios.post(
        `${API}/items`,
        {
          title: formData.title.trim(),
          description: formData.description.trim() || null,
          category: formData.category.trim().toLowerCase(),
          image: formData.image,
          desired_category: formData.desired_category.trim() || null,
          desired_item_ids: formData.desired_item_ids.length > 0 ? formData.desired_item_ids : null,
        },
        { 
          withCredentials: true,
          headers: headers
        }
      );

      toast.success("Item posted successfully!");
      navigate("/dashboard");
    } catch (error) {
      toast.error(error.response?.data?.detail || "Failed to post item");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-white" data-testid="post-item-page">
      <Header />

      <main className="max-w-2xl mx-auto px-4 md:px-8 py-8">
        <h1
          className="text-3xl font-bold text-slate-900 mb-8"
          style={{ fontFamily: "Manrope, sans-serif" }}
        >
          Post an Item
        </h1>

        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Image Upload */}
          <div className="space-y-2">
            <Label>Item Image *</Label>
            <div
              className={`relative rounded-2xl border-2 border-dashed transition-colors ${
                imagePreview
                  ? "border-transparent"
                  : "border-slate-200 hover:border-indigo-300"
              }`}
            >
              {isCompressing ? (
                <div className="flex flex-col items-center justify-center aspect-video bg-slate-50 rounded-2xl">
                  <Loader2 className="w-12 h-12 text-indigo-600 spinner mb-2" />
                  <span className="text-slate-500 font-medium">Compressing image...</span>
                </div>
              ) : imagePreview ? (
                <div className="upload-preview aspect-video">
                  <img
                    src={imagePreview}
                    alt="Preview"
                    className="rounded-2xl"
                    data-testid="image-preview"
                  />
                  <div className="upload-overlay rounded-2xl">
                    <Button
                      type="button"
                      variant="destructive"
                      size="sm"
                      onClick={handleRemoveImage}
                      className="rounded-full"
                      data-testid="remove-image-btn"
                    >
                      <X className="w-4 h-4 mr-1" />
                      Remove
                    </Button>
                  </div>
                </div>
              ) : (
                <label
                  className="flex flex-col items-center justify-center aspect-video cursor-pointer bg-slate-50 rounded-2xl hover:bg-slate-100 transition-colors"
                  data-testid="image-upload-label"
                >
                  <ImagePlus className="w-12 h-12 text-slate-400 mb-2" />
                  <span className="text-slate-500 font-medium">
                    {isCompressing ? "Compressing image..." : "Click to upload image"}
                  </span>
                  <span className="text-sm text-slate-400 mt-1">
                    {isCompressing ? "Please wait..." : "PNG, JPG up to 5MB (auto-compressed)"}
                  </span>
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept="image/*"
                    onChange={handleImageChange}
                    className="hidden"
                    data-testid="image-input"
                  />
                </label>
              )}
            </div>
          </div>

          {/* Title */}
          <div className="space-y-2">
            <Label htmlFor="title">Title *</Label>
            <Input
              id="title"
              value={formData.title}
              onChange={(e) => setFormData((prev) => ({ ...prev, title: e.target.value }))}
              placeholder="What are you trading?"
              className="bg-slate-50"
              data-testid="title-input"
            />
          </div>

          {/* Description */}
          <div className="space-y-2">
            <Label htmlFor="description">Description (optional)</Label>
            <Textarea
              id="description"
              value={formData.description}
              onChange={(e) =>
                setFormData((prev) => ({ ...prev, description: e.target.value }))
              }
              placeholder="Add details about condition, what you're looking for in exchange, etc."
              className="bg-slate-50 min-h-[120px]"
              data-testid="description-input"
            />
          </div>

          {/* Category */}
          <div className="space-y-2">
            <Label htmlFor="category">Category *</Label>
            <Select
              value={formData.category}
              onValueChange={(value) =>
                setFormData((prev) => ({ ...prev, category: value }))
              }
              disabled={isLoadingCategories}
            >
              <SelectTrigger className="bg-slate-50" id="category" data-testid="category-select">
                <SelectValue placeholder="Select a category" />
              </SelectTrigger>
              <SelectContent>
                {categories.map((category) => (
                  <SelectItem key={category.name} value={category.name}>
                    <span className="capitalize">{category.name}</span>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Trade Preferences (Optional) */}
          <Collapsible open={showPreferences} onOpenChange={setShowPreferences}>
            <CollapsibleTrigger asChild>
              <Button
                type="button"
                variant="outline"
                className="w-full justify-between rounded-full"
              >
                <span>Trade Preferences (Optional)</span>
                {showPreferences ? (
                  <ChevronUp className="w-4 h-4" />
                ) : (
                  <ChevronDown className="w-4 h-4" />
                )}
              </Button>
            </CollapsibleTrigger>
            <CollapsibleContent className="space-y-4 pt-4">
              <p className="text-sm text-slate-600">
                These preferences are informational only and won't restrict trades. Users can still
                trade for your item regardless of these preferences.
              </p>

              {/* Desired Category */}
              <div className="space-y-2">
                <Label htmlFor="desired_category">Desired Category (Optional)</Label>
                <Input
                  id="desired_category"
                  value={formData.desired_category}
                  onChange={(e) =>
                    setFormData((prev) => ({ ...prev, desired_category: e.target.value }))
                  }
                  placeholder="e.g., electronics, clothing"
                  className="bg-slate-50"
                />
                <p className="text-xs text-slate-500">
                  What category of items are you interested in trading for?
                </p>
              </div>

              {/* Desired Items */}
              <div className="space-y-2">
                <Label>Specific Items You're Interested In (Optional)</Label>
                <Input
                  placeholder="Search items..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="bg-slate-50"
                  onFocus={fetchAvailableItems}
                />
                {showPreferences && (
                  <div className="max-h-48 overflow-y-auto border border-slate-200 rounded-lg p-2 space-y-2">
                    {isLoadingItems ? (
                      <div className="flex items-center justify-center py-4">
                        <Loader2 className="w-5 h-5 text-indigo-600 spinner" />
                      </div>
                    ) : filteredItems.length === 0 ? (
                      <p className="text-sm text-slate-500 text-center py-4">
                        No items found
                      </p>
                    ) : (
                      filteredItems.slice(0, 10).map((item) => (
                        <div
                          key={item.item_id}
                          onClick={() => handleToggleItem(item.item_id)}
                          className={`flex items-center gap-3 p-2 rounded-lg cursor-pointer transition-colors ${
                            formData.desired_item_ids?.includes(item.item_id)
                              ? "bg-indigo-50 border border-indigo-200"
                              : "hover:bg-slate-50 border border-transparent"
                          }`}
                        >
                          <img
                            src={item.image}
                            alt={item.title}
                            className="w-12 h-12 object-cover rounded"
                          />
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-medium text-slate-900 truncate">
                              {item.title}
                            </p>
                            <p className="text-xs text-slate-500">{item.category}</p>
                          </div>
                          {formData.desired_item_ids?.includes(item.item_id) && (
                            <div className="text-indigo-600">✓</div>
                          )}
                        </div>
                      ))
                    )}
                  </div>
                )}
                {formData.desired_item_ids.length > 0 && (
                  <div className="flex flex-wrap gap-2 mt-2">
                    {formData.desired_item_ids.map((itemId) => {
                      const item = availableItems.find((i) => i.item_id === itemId);
                      if (!item) return null;
                      return (
                        <Badge
                          key={itemId}
                          variant="secondary"
                          className="flex items-center gap-1"
                        >
                          {item.title}
                          <X
                            className="w-3 h-3 cursor-pointer"
                            onClick={() => handleToggleItem(itemId)}
                          />
                        </Badge>
                      );
                    })}
                  </div>
                )}
              </div>
            </CollapsibleContent>
          </Collapsible>

          {/* Submit */}
          <div className="flex gap-4 pt-4">
            <Button
              type="button"
              variant="outline"
              onClick={() => navigate(-1)}
              className="flex-1 rounded-full"
            >
              Cancel
            </Button>
            <Button
              type="submit"
              disabled={isLoading}
              className="flex-1 bg-indigo-600 hover:bg-indigo-700 rounded-full"
              data-testid="submit-item-btn"
            >
              {isLoading ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 spinner" />
                  Posting...
                </>
              ) : (
                "Post Item"
              )}
            </Button>
          </div>
        </form>
      </main>
    </div>
  );
};

export default PostItem;
