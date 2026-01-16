import { useNavigate } from "react-router-dom";
import { Trash2, Plus } from "lucide-react";

/**
 * Component for displaying trade items with add/remove functionality
 */
export const TradeItemList = ({
  items,
  label,
  canEdit = false,
  onRemove,
  onAdd,
  removingItemId = null,
  maxItems = 5,
}) => {
  const navigate = useNavigate();

  return (
    <div className="flex-1">
      <p className="text-xs text-slate-500 mb-2 text-center">{label}</p>
      <div className="flex flex-wrap gap-2 justify-center">
        {items.map((item) => (
          <div key={item.item_id} className="relative group">
            <div
              className="w-16 h-16 rounded-lg overflow-hidden cursor-pointer border-2 border-indigo-200 hover:border-indigo-400 transition-colors"
              onClick={() => navigate(`/item/${item.item_id}`)}
            >
              <img
                src={item.image}
                alt={item.title}
                className="w-full h-full object-cover"
              />
            </div>
            {canEdit && onRemove && (
              <button
                onClick={() => onRemove(item.item_id)}
                disabled={removingItemId === item.item_id}
                className="absolute -top-1 -right-1 bg-red-500 text-white rounded-full p-1 opacity-0 group-hover:opacity-100 transition-opacity"
              >
                <Trash2 className="w-3 h-3" />
              </button>
            )}
          </div>
        ))}
        {canEdit && onAdd && items.length < maxItems && (
          <button
            onClick={onAdd}
            className="w-16 h-16 rounded-lg border-2 border-dashed border-slate-300 hover:border-indigo-400 flex items-center justify-center text-slate-400 hover:text-indigo-600 transition-colors"
          >
            <Plus className="w-4 h-4" />
          </button>
        )}
        {items.length === 0 && !canEdit && (
          <p className="text-xs text-slate-400 text-center py-4">No items</p>
        )}
      </div>
    </div>
  );
};
