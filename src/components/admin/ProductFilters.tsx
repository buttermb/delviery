import { Card } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";

interface ProductFiltersProps {
  onFilterChange: (filters: any) => void;
}

export function ProductFilters({ onFilterChange }: ProductFiltersProps) {
  return (
    <Card className="p-4 space-y-4">
      <div>
        <h3 className="font-semibold mb-3">Categories</h3>
        <div className="space-y-2">
          {["Flower", "Pre-Rolls", "Edibles", "Vapes", "Concentrates"].map((category) => (
            <div key={category} className="flex items-center space-x-2">
              <Checkbox id={category} />
              <Label htmlFor={category}>{category}</Label>
            </div>
          ))}
        </div>
      </div>

      <div>
        <h3 className="font-semibold mb-3">Stock Status</h3>
        <div className="space-y-2">
          <div className="flex items-center space-x-2">
            <Checkbox id="in-stock" />
            <Label htmlFor="in-stock">In Stock</Label>
          </div>
          <div className="flex items-center space-x-2">
            <Checkbox id="out-stock" />
            <Label htmlFor="out-stock">Out of Stock</Label>
          </div>
        </div>
      </div>

      <div>
        <h3 className="font-semibold mb-3">Price Range</h3>
        <div className="space-y-2">
          <div className="flex items-center space-x-2">
            <Checkbox id="under-25" />
            <Label htmlFor="under-25">Under $25</Label>
          </div>
          <div className="flex items-center space-x-2">
            <Checkbox id="25-50" />
            <Label htmlFor="25-50">$25 - $50</Label>
          </div>
          <div className="flex items-center space-x-2">
            <Checkbox id="over-50" />
            <Label htmlFor="over-50">Over $50</Label>
          </div>
        </div>
      </div>
    </Card>
  );
}
