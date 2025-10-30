import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { DollarSign, Zap, Leaf, Star } from "lucide-react";

interface QuickFiltersProps {
  onFilterSelect: (filter: QuickFilter) => void;
  activeFilter?: string;
}

export type QuickFilter = {
  id: string;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  priceRange?: [number, number];
  potencyRange?: [number, number];
  category?: string;
};

const quickFilters: QuickFilter[] = [
  {
    id: "under-50",
    label: "Under $50",
    icon: DollarSign,
    priceRange: [0, 50],
  },
  {
    id: "high-potency",
    label: "High Potency",
    icon: Zap,
    potencyRange: [25, 100],
  },
  {
    id: "flower",
    label: "Flower Only",
    icon: Leaf,
    category: "flower",
  },
  {
    id: "top-rated",
    label: "Top Rated",
    icon: Star,
  },
];

const QuickFilters = ({ onFilterSelect, activeFilter }: QuickFiltersProps) => {
  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2">
        <Badge variant="outline" className="text-xs">Quick Filters</Badge>
        <div className="h-px flex-1 bg-border"></div>
      </div>
      
      <div className="flex flex-wrap gap-2">
        {quickFilters.map((filter) => {
          const Icon = filter.icon;
          const isActive = activeFilter === filter.id;
          
          return (
            <Button
              key={filter.id}
              variant={isActive ? "default" : "outline"}
              size="sm"
              onClick={() => onFilterSelect(filter)}
              className="gap-2"
            >
              <Icon className="w-4 h-4" />
              {filter.label}
            </Button>
          );
        })}
      </div>
    </div>
  );
};

export default QuickFilters;
