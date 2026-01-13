import { Star } from "lucide-react";
import { useState } from "react";

export const StarRating = ({ rating, onRate, readonly = false, size = "md" }) => {
  const [hovered, setHovered] = useState(0);
  
  const sizes = {
    sm: "w-4 h-4",
    md: "w-5 h-5",
    lg: "w-6 h-6"
  };

  const starSize = sizes[size] || sizes.md;

  return (
    <div className="star-rating flex gap-1" data-testid="star-rating">
      {[1, 2, 3, 4, 5].map((star) => {
        const filled = readonly ? star <= rating : star <= (hovered || rating);
        
        return (
          <button
            key={star}
            type="button"
            disabled={readonly}
            onClick={() => onRate && onRate(star)}
            onMouseEnter={() => !readonly && setHovered(star)}
            onMouseLeave={() => !readonly && setHovered(0)}
            className={`star ${readonly ? "cursor-default" : "cursor-pointer"}`}
            data-testid={`star-${star}`}
          >
            <Star
              className={`${starSize} ${
                filled
                  ? "fill-amber-400 text-amber-400"
                  : "fill-transparent text-slate-300"
              } transition-colors duration-150`}
            />
          </button>
        );
      })}
    </div>
  );
};

export const DisplayRating = ({ rating, count, size = "sm" }) => {
  if (!rating && rating !== 0) {
    return (
      <span className="text-slate-400 text-sm" data-testid="no-rating">
        No ratings yet
      </span>
    );
  }

  return (
    <div className="flex items-center gap-2" data-testid="display-rating">
      <StarRating rating={Math.round(rating)} readonly size={size} />
      <span className="text-slate-600 text-sm">
        {rating.toFixed(1)} {count > 0 && `(${count})`}
      </span>
    </div>
  );
};
