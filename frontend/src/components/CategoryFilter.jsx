import { ScrollArea, ScrollBar } from "@/components/ui/scroll-area";

export const CategoryFilter = ({ categories, selectedCategory, onSelectCategory }) => {
  return (
    <div className="w-full py-4" data-testid="category-filter">
      <ScrollArea className="w-full whitespace-nowrap">
        <div className="flex gap-2 px-1">
          {/* All Category */}
          <button
            onClick={() => onSelectCategory(null)}
            className={`category-pill px-4 py-2 rounded-full text-sm font-medium transition-all duration-200 ${
              !selectedCategory
                ? "bg-indigo-600 text-white shadow-lg"
                : "bg-slate-100 text-slate-600 hover:bg-slate-200"
            }`}
            data-testid="category-all"
          >
            All
          </button>

          {/* Dynamic Categories - sorted by click_count */}
          {categories.map((category) => (
            <button
              key={category.name}
              onClick={() => onSelectCategory(category.name)}
              className={`category-pill px-4 py-2 rounded-full text-sm font-medium capitalize transition-all duration-200 ${
                selectedCategory === category.name
                  ? "bg-indigo-600 text-white shadow-lg"
                  : "bg-slate-100 text-slate-600 hover:bg-slate-200"
              }`}
              data-testid={`category-${category.name}`}
            >
              {category.name}
            </button>
          ))}
        </div>
        <ScrollBar orientation="horizontal" />
      </ScrollArea>
    </div>
  );
};
