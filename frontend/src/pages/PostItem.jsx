import { useState, useRef } from "react";
import { useNavigate } from "react-router-dom";
import axios from "axios";
import { useAuth } from "@/App";
import { Header } from "@/components/Header";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import { ImagePlus, X, Loader2 } from "lucide-react";

const PostItem = () => {
  const navigate = useNavigate();
  const { API } = useAuth();
  const fileInputRef = useRef(null);
  const [isLoading, setIsLoading] = useState(false);
  const [imagePreview, setImagePreview] = useState(null);
  const [formData, setFormData] = useState({
    title: "",
    description: "",
    category: "",
    image: "",
  });

  const handleImageChange = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Validate file type
    if (!file.type.startsWith("image/")) {
      toast.error("Please select an image file");
      return;
    }

    // Validate file size (max 5MB)
    if (file.size > 5 * 1024 * 1024) {
      toast.error("Image must be less than 5MB");
      return;
    }

    // Create preview
    const reader = new FileReader();
    reader.onload = (event) => {
      setImagePreview(event.target.result);
      setFormData((prev) => ({ ...prev, image: event.target.result }));
    };
    reader.readAsDataURL(file);
  };

  const handleRemoveImage = () => {
    setImagePreview(null);
    setFormData((prev) => ({ ...prev, image: "" }));
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  };

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
      toast.error("Please enter a category");
      return;
    }
    if (formData.category.includes(" ")) {
      toast.error("Category must be a single word");
      return;
    }

    setIsLoading(true);
    try {
      await axios.post(
        `${API}/items`,
        {
          title: formData.title.trim(),
          description: formData.description.trim() || null,
          category: formData.category.trim().toLowerCase(),
          image: formData.image,
        },
        { withCredentials: true }
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
              {imagePreview ? (
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
                  <span className="text-slate-500 font-medium">Click to upload image</span>
                  <span className="text-sm text-slate-400 mt-1">PNG, JPG up to 5MB</span>
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
            <Input
              id="category"
              value={formData.category}
              onChange={(e) =>
                setFormData((prev) => ({ ...prev, category: e.target.value }))
              }
              placeholder="e.g., electronics, clothing, books"
              className="bg-slate-50"
              data-testid="category-input"
            />
            <p className="text-xs text-slate-500">
              Single word only (e.g., "electronics" not "electronic items")
            </p>
          </div>

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
