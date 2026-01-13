import { Link } from "react-router-dom";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";

export const ItemCard = ({ item, owner }) => {
  const getInitials = (name) => {
    if (!name) return "U";
    return name
      .split(" ")
      .map((n) => n[0])
      .join("")
      .toUpperCase()
      .slice(0, 2);
  };

  return (
    <Link
      to={`/item/${item.item_id}`}
      className="item-card block group relative break-inside-avoid rounded-2xl bg-white overflow-hidden border border-slate-100 hover:shadow-xl transition-all duration-300 ease-out masonry-item"
      data-testid={`item-card-${item.item_id}`}
    >
      {/* Image */}
      <div className="relative">
        <img
          src={item.image}
          alt={item.title}
          className="w-full object-cover"
          style={{ minHeight: "150px" }}
          loading="lazy"
        />
        {/* Category Badge */}
        <Badge
          className="absolute top-3 left-3 bg-white/90 backdrop-blur-sm text-slate-700 border-0 capitalize"
          data-testid={`item-category-${item.item_id}`}
        >
          {item.category}
        </Badge>
      </div>

      {/* Content */}
      <div className="p-4">
        <h3
          className="font-semibold text-slate-900 line-clamp-2 mb-2"
          style={{ fontFamily: "Manrope, sans-serif" }}
        >
          {item.title}
        </h3>

        {/* Owner Info */}
        {owner && (
          <div className="flex items-center gap-2 mt-3">
            <Avatar className="h-6 w-6">
              <AvatarImage src={owner.picture} alt={owner.name} />
              <AvatarFallback className="bg-indigo-100 text-indigo-600 text-xs">
                {getInitials(owner.name)}
              </AvatarFallback>
            </Avatar>
            <span className="text-sm text-slate-500 truncate">
              {owner.username || owner.name}
            </span>
            {owner.rating && (
              <span className="text-sm text-amber-500 flex items-center gap-1">
                ★ {owner.rating.toFixed(1)}
              </span>
            )}
          </div>
        )}
      </div>
    </Link>
  );
};
