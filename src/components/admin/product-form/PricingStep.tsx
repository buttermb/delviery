import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Plus, X } from "lucide-react";

interface PricingStepProps {
  formData: any;
  updateFormData: (data: any) => void;
}

export function PricingStep({ formData, updateFormData }: PricingStepProps) {
  const regularPrice = formData.price || 0;
  const salePrice = formData.sale_price || 0;
  const costPerUnit = formData.cost_per_unit || 0;
  
  const profit = regularPrice - costPerUnit;
  const profitMargin = regularPrice > 0 ? ((profit / regularPrice) * 100).toFixed(1) : 0;

  const addPriceVariation = (weight: string) => {
    const currentPrices = formData.prices || {};
    updateFormData({
      prices: { ...currentPrices, [weight]: "" },
    });
  };

  const updatePriceVariation = (weight: string, price: string) => {
    updateFormData({
      prices: { ...formData.prices, [weight]: price === "" ? "" : parseFloat(price) },
    });
  };

  const removePriceVariation = (weight: string) => {
    const newPrices = { ...formData.prices };
    delete newPrices[weight];
    updateFormData({ prices: newPrices });
  };

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold mb-4">Pricing & Inventory</h2>
        <p className="text-muted-foreground">
          Set prices and manage stock levels
        </p>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div>
          <Label htmlFor="price">Regular Price *</Label>
          <div className="flex items-center mt-1.5">
            <span className="mr-2">$</span>
            <Input
              id="price"
              type="number"
              min="0"
              step="0.01"
              value={formData.price || ""}
              onChange={(e) => {
                const value = e.target.value;
                updateFormData({ price: value === "" ? "" : parseFloat(value) });
              }}
              placeholder="45.00"
            />
          </div>
        </div>

        <div>
          <Label htmlFor="sale-price">Sale Price (Optional)</Label>
          <div className="flex items-center mt-1.5">
            <span className="mr-2">$</span>
            <Input
              id="sale-price"
              type="number"
              min="0"
              step="0.01"
              value={formData.sale_price || ""}
              onChange={(e) => {
                const value = e.target.value;
                updateFormData({ sale_price: value === "" ? "" : parseFloat(value) });
              }}
              placeholder="35.00"
            />
          </div>
          <p className="text-xs text-muted-foreground mt-1">
            Leave blank if not on sale
          </p>
        </div>
      </div>

      {salePrice > 0 && salePrice < regularPrice && (
        <Card className="p-4 bg-muted">
          <p className="text-sm font-medium">Sale Badge Preview:</p>
          <p className="text-sm">
            Regular: <span className="line-through">${regularPrice}</span> → Sale: ${salePrice}{" "}
            <span className="text-primary font-semibold">
              (Save ${(regularPrice - salePrice).toFixed(2)}!)
            </span>
          </p>
        </Card>
      )}

      <div>
        <Label htmlFor="cost">Cost Per Unit (Your Cost - Private)</Label>
        <div className="flex items-center mt-1.5">
          <span className="mr-2">$</span>
          <Input
            id="cost"
            type="number"
            min="0"
            step="0.01"
            value={formData.cost_per_unit || ""}
            onChange={(e) => {
              const value = e.target.value;
              updateFormData({ cost_per_unit: value === "" ? "" : parseFloat(value) });
            }}
            placeholder="20.00"
          />
        </div>
        <p className="text-xs text-muted-foreground mt-1">
          Used to calculate profit margins (not shown to customers)
        </p>
      </div>

      {costPerUnit > 0 && regularPrice > 0 && (
        <Card className="p-4 bg-muted">
          <p className="text-sm font-medium mb-1">Profit Margin:</p>
          <p className={`text-2xl font-bold ${
            parseFloat(profitMargin as string) > 40 ? "text-green-600" :
            parseFloat(profitMargin as string) > 20 ? "text-yellow-600" : "text-red-600"
          }`}>
            {profitMargin}% (${profit.toFixed(2)} profit per unit)
          </p>
        </Card>
      )}

      <hr className="my-6" />

      <div>
        <Label htmlFor="stock">Current Stock Quantity *</Label>
        <Input
          id="stock"
          type="number"
          min="0"
          value={formData.stock_quantity || ""}
          onChange={(e) => {
            const value = e.target.value;
            updateFormData({ stock_quantity: value === "" ? "" : parseInt(value) });
          }}
          placeholder="15"
          className="mt-1.5"
        />
        <p className="text-xs text-muted-foreground mt-1">
          Number of units available
        </p>
      </div>

      <div>
        <Label>Stock Status</Label>
        <RadioGroup
          value={formData.in_stock ? "in-stock" : "out-of-stock"}
          onValueChange={(value) => updateFormData({ in_stock: value === "in-stock" })}
          className="mt-3"
        >
          <div className="flex items-center space-x-2">
            <RadioGroupItem value="in-stock" id="in-stock" />
            <Label htmlFor="in-stock" className="font-normal cursor-pointer">
              In Stock
            </Label>
          </div>
          <div className="flex items-center space-x-2">
            <RadioGroupItem value="out-of-stock" id="out-of-stock" />
            <Label htmlFor="out-of-stock" className="font-normal cursor-pointer">
              Out of Stock
            </Label>
          </div>
        </RadioGroup>
      </div>

      <div>
        <Label>Price Variations (Optional)</Label>
        <p className="text-sm text-muted-foreground mb-3">
          Offer different sizes at different prices
        </p>
        <div className="space-y-2">
          {Object.entries(formData.prices || {})
            .filter(([_, price]) => price !== null && price !== undefined)
            .map(([weight, price]) => (
              <div key={weight} className="flex gap-2 items-center">
                <Input value={weight} disabled className="w-24" />
                <div className="flex items-center flex-1">
                  <span className="mr-2">$</span>
                  <Input
                    type="number"
                    min="0"
                    step="0.01"
                    value={price === "" ? "" : (typeof price === 'number' ? price : 0)}
                    onChange={(e) => updatePriceVariation(weight, e.target.value)}
                    placeholder="0.00"
                  />
                </div>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  onClick={() => removePriceVariation(weight)}
                  className="h-10 w-10"
                >
                  <X className="h-4 w-4" />
                </Button>
              </div>
            ))}
        </div>
        <div className="flex gap-2 mt-2">
          {["3.5g", "7g", "14g", "28g"].map((weight) => (
            !formData.prices?.[weight] && (
              <Button
                key={weight}
                onClick={() => addPriceVariation(weight)}
                variant="outline"
                size="sm"
              >
                <Plus className="mr-1 h-3 w-3" />
                Add {weight}
              </Button>
            )
          ))}
        </div>
      </div>
    </div>
  );
}
