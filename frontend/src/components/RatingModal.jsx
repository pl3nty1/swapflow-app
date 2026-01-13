import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { StarRating } from "./StarRating";

export const RatingModal = ({ isOpen, onClose, onSubmit, user, isLoading }) => {
  const [rating, setRating] = useState(0);

  const getInitials = (name) => {
    if (!name) return "U";
    return name
      .split(" ")
      .map((n) => n[0])
      .join("")
      .toUpperCase()
      .slice(0, 2);
  };

  const handleSubmit = () => {
    if (rating > 0) {
      onSubmit(rating);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-md" data-testid="rating-modal">
        <DialogHeader>
          <DialogTitle style={{ fontFamily: "Manrope, sans-serif" }}>
            Rate Your Trade Partner
          </DialogTitle>
          <DialogDescription>
            How was your trading experience with this user?
          </DialogDescription>
        </DialogHeader>

        <div className="flex flex-col items-center py-6">
          {/* User Avatar */}
          <Avatar className="h-16 w-16 mb-4">
            <AvatarImage src={user?.picture} alt={user?.name} />
            <AvatarFallback className="bg-indigo-100 text-indigo-600 text-xl">
              {getInitials(user?.name)}
            </AvatarFallback>
          </Avatar>

          <p className="text-lg font-medium text-slate-900 mb-1">
            {user?.username || user?.name}
          </p>

          {/* Star Rating */}
          <div className="mt-4">
            <StarRating rating={rating} onRate={setRating} size="lg" />
          </div>

          <p className="text-sm text-slate-500 mt-3">
            {rating === 0 && "Select a rating"}
            {rating === 1 && "Poor"}
            {rating === 2 && "Fair"}
            {rating === 3 && "Good"}
            {rating === 4 && "Very Good"}
            {rating === 5 && "Excellent"}
          </p>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose} data-testid="cancel-rating-btn">
            Skip
          </Button>
          <Button
            onClick={handleSubmit}
            disabled={rating === 0 || isLoading}
            className="bg-indigo-600 hover:bg-indigo-700"
            data-testid="submit-rating-btn"
          >
            {isLoading ? "Submitting..." : "Submit Rating"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
