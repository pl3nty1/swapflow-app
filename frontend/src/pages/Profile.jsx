import { useEffect, useState, useCallback } from "react";
import { useParams } from "react-router-dom";
import axios from "axios";
import { useAuth } from "@/App";
import { Header } from "@/components/Header";
import { ItemCard } from "@/components/ItemCard";
import { DisplayRating } from "@/components/StarRating";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { toast } from "sonner";
import { ArrowLeftRight, Edit2, Loader2 } from "lucide-react";

const Profile = () => {
  const { userId } = useParams();
  const { user: currentUser, setUser, API } = useAuth();
  const [profileUser, setProfileUser] = useState(null);
  const [items, setItems] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isEditOpen, setIsEditOpen] = useState(false);
  const [editUsername, setEditUsername] = useState("");
  const [isSaving, setIsSaving] = useState(false);

  const isOwnProfile = currentUser?.user_id === userId;

  const fetchProfile = useCallback(async () => {
    try {
      const [userRes, itemsRes] = await Promise.all([
        axios.get(`${API}/users/${userId}`, { withCredentials: true }),
        axios.get(`${API}/items`, { params: { user_id: userId }, withCredentials: true }),
      ]);
      setProfileUser(userRes.data);
      setItems(itemsRes.data);
      setEditUsername(userRes.data.username || "");
    } catch (error) {
      console.error("Failed to fetch profile:", error);
      toast.error("Failed to load profile");
    } finally {
      setIsLoading(false);
    }
  }, [API, userId]);

  useEffect(() => {
    fetchProfile();
  }, [fetchProfile]);

  const handleSaveProfile = async () => {
    if (!editUsername.trim()) {
      toast.error("Username cannot be empty");
      return;
    }
    if (editUsername.includes(" ")) {
      toast.error("Username must be a single word");
      return;
    }

    setIsSaving(true);
    try {
      const response = await axios.put(
        `${API}/users/profile`,
        { username: editUsername.trim() },
        { withCredentials: true }
      );
      setProfileUser(response.data);
      setUser(response.data);
      setIsEditOpen(false);
      toast.success("Profile updated!");
    } catch (error) {
      toast.error(error.response?.data?.detail || "Failed to update profile");
    } finally {
      setIsSaving(false);
    }
  };

  const getInitials = (name) => {
    if (!name) return "U";
    return name
      .split(" ")
      .map((n) => n[0])
      .join("")
      .toUpperCase()
      .slice(0, 2);
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-white">
        <Header />
        <div className="flex items-center justify-center py-20">
          <Loader2 className="w-8 h-8 text-indigo-600 spinner" />
        </div>
      </div>
    );
  }

  if (!profileUser) {
    return (
      <div className="min-h-screen bg-white">
        <Header />
        <div className="text-center py-20">
          <p className="text-slate-500 text-lg">User not found</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-white" data-testid="profile-page">
      <Header />

      <main className="max-w-7xl mx-auto px-4 md:px-8 lg:px-12 py-8">
        {/* Profile Card */}
        <div className="bg-white rounded-2xl p-8 border border-slate-100 shadow-sm mb-8" data-testid="profile-card">
          <div className="flex flex-col md:flex-row items-center md:items-start gap-6">
            {/* Avatar */}
            <Avatar className="h-24 w-24 border-4 border-white shadow-lg">
              <AvatarImage src={profileUser.picture} alt={profileUser.name} />
              <AvatarFallback className="bg-indigo-100 text-indigo-600 text-2xl">
                {getInitials(profileUser.name)}
              </AvatarFallback>
            </Avatar>

            {/* Info */}
            <div className="flex-1 text-center md:text-left">
              <div className="flex items-center justify-center md:justify-start gap-3 mb-2">
                <h1
                  className="text-2xl font-bold text-slate-900"
                  style={{ fontFamily: "Manrope, sans-serif" }}
                  data-testid="profile-name"
                >
                  {profileUser.username || profileUser.name}
                </h1>
                {isOwnProfile && (
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setIsEditOpen(true)}
                    className="text-slate-500 hover:text-indigo-600"
                    data-testid="edit-profile-btn"
                  >
                    <Edit2 className="w-4 h-4" />
                  </Button>
                )}
              </div>

              {profileUser.username && (
                <p className="text-slate-500 mb-3">{profileUser.name}</p>
              )}

              {/* Stats */}
              <div className="flex items-center justify-center md:justify-start gap-6 mt-4">
                {/* Trade Points */}
                <div className="flex items-center gap-2">
                  <div className="trade-badge flex items-center gap-1">
                    <ArrowLeftRight className="w-4 h-4" />
                    <span data-testid="trade-points">{profileUser.trade_points || 0}</span>
                  </div>
                  <span className="text-sm text-slate-500">Trade Points</span>
                </div>

                {/* Rating */}
                <div className="flex items-center gap-2">
                  <DisplayRating
                    rating={profileUser.rating}
                    count={profileUser.rating_count}
                  />
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* User's Items */}
        <div>
          <h2
            className="text-xl font-semibold text-slate-900 mb-6"
            style={{ fontFamily: "Manrope, sans-serif" }}
          >
            {isOwnProfile ? "My Items" : `${profileUser.username || profileUser.name}'s Items`}
          </h2>

          {items.length === 0 ? (
            <div className="text-center py-12 bg-slate-50 rounded-2xl">
              <p className="text-slate-500">
                {isOwnProfile
                  ? "You haven't posted any items yet"
                  : "No items available"}
              </p>
            </div>
          ) : (
            <div className="masonry-grid" data-testid="profile-items-grid">
              {items.map((item) => (
                <ItemCard key={item.item_id} item={item} owner={profileUser} />
              ))}
            </div>
          )}
        </div>
      </main>

      {/* Edit Profile Dialog */}
      <Dialog open={isEditOpen} onOpenChange={setIsEditOpen}>
        <DialogContent className="sm:max-w-md" data-testid="edit-profile-modal">
          <DialogHeader>
            <DialogTitle style={{ fontFamily: "Manrope, sans-serif" }}>
              Edit Profile
            </DialogTitle>
            <DialogDescription>
              Update your profile information
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="username">Username</Label>
              <Input
                id="username"
                value={editUsername}
                onChange={(e) => setEditUsername(e.target.value)}
                placeholder="Enter a username (single word)"
                className="bg-slate-50"
                data-testid="username-input"
              />
              <p className="text-xs text-slate-500">
                Username must be a single word with no spaces
              </p>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setIsEditOpen(false)}>
              Cancel
            </Button>
            <Button
              onClick={handleSaveProfile}
              disabled={isSaving}
              className="bg-indigo-600 hover:bg-indigo-700"
              data-testid="save-profile-btn"
            >
              {isSaving ? "Saving..." : "Save Changes"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default Profile;
