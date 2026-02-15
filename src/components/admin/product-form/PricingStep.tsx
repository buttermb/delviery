import { useState, useCallback } from "react";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Plus, X } from "lucide-react";

interface ProductFormData {
  price?: number | string;
  [key: string]: unknown;
}

interface PricingStepProps {
  formData: ProductFormData;
  updateFormData: (data: Partial<ProductFormData>) => void;
  showErrors?: boolean;
}

function getFieldError(
  field: string,
  value: unknown,
  touched: boolean,
  showErrors: boolean
): string | null {
  if (!touched && !showErrors) return null;
  switch (field) {
    case "price": {
      const num = typeof value === "string" ? parseFloat(value) : (value as number);
      if (value === "" || value === undefined || value === null || value === 0) return "Regular price is required";
      if (isNaN(num) || num <= 0) return "Price must be a positive number";
      if (num > 999999) return "Price must be less than $1,000,000";
      return null;
    }
    case "stock_quantity": {
      if (value === "" || value === undefined || value === null) return null; // Optional
      const num = typeof value === "string" ? parseFloat(value) : (value as number);
      if (isNaN(num)) return "Stock must be a valid number";
      if (!Number.isInteger(num)) return "Stock quantity must be a whole number";
      if (num < 0) return "Stock cannot be negative";
      return null;
    }
    case "sale_price": {
      if (value === "" || value === undefined || value === null) return null; // Optional
      const num = typeof value === "string" ? parseFloat(value) : (value as number);
      if (isNaN(num) || num < 0) return "Sale price must be a positive number";
      return null;
    }
    case "cost_per_unit": {
      if (value === "" || value === undefined || value === null) return null; // Optional
      const num = typeof value === "string" ? parseFloat(value) : (value as number);
      if (isNaN(num) || num < 0) return "Cost must be a positive number";
      return null;
    }
    default:
      return null;
  }
}

export function PricingStep({ formData, updateFormData, showErrors = false }: PricingStepProps) {
  const [touched, setTouched] = useState<Record<string, boolean>>({});

  const markTouched = useCallback((field: string) => {
    setTouched((prev) => ({ ...prev, [field]: true }));
  }, []);

  const regularPrice = (formData.price as number) || 0;
  const salePrice = (formData.sale_price as number) || 0;
  const costPerUnit = (formData.cost_per_unit as number) || 0;

  const profit = regularPrice - costPerUnit;
  const profitMargin = regularPrice > 0 ? ((profit / regularPrice) * 100).toFixed(1) : 0;

  const priceError = getFieldError("price", formData.price, !!touched.price, showErrors);
  const stockError = getFieldError("stock_quantity", formData.stock_quantity, !!touched.stock_quantity, showErrors);
  const salePriceError = getFieldError("sale_price", formData.sale_price, !!touched.sale_price, showErrors);
  const costError = getFieldError("cost_per_unit", formData.cost_per_unit, !!touched.cost_per_unit, showErrors);

  const addPriceVariation = (weight: string) => {
    const currentPrices = (formData.prices as Record<string, unknown>) || {};
    updateFormData({
      prices: { ...currentPrices, [weight]: "" },
    });
  };

  const updatePriceVariation = (weight: string, price: string) => {
    const currentPrices = (formData.prices as Record<string, unknown>) || {};
    updateFormData({
      prices: { ...currentPrices, [weight]: price === "" ? "" : parseFloat(price) },
    });
  };

  const removePriceVariation = (weight: string) => {
    const newPrices = { ...((formData.prices as Record<string, unknown>) || {}) };
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
          <Label htmlFor="price">Regular Price <span className="text-destructive">*</span></Label>
          <div className="flex items-center mt-1.5">
            <span className="mr-2">$</span>
            <Input
              id="price"
              type="number"
              min="0"
              step="0.01"
              value={(formData.price as string | number) || ""}
              onChange={(e) => {
                const value = e.target.value;
                updateFormData({ price: value === "" ? 0 : parseFloat(value) || 0 });
              }}
              onBlur={() => markTouched("price")}
              placeholder="45.00"
              className={priceError ? "border-destructive focus-visible:ring-destructive" : ""}
              aria-invalid={!!priceError}
            />
          </div>
          {priceError && (
            <p className="text-sm text-destructive mt-1">{priceError}</p>
          )}
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
              value={(formData.sale_price as string | number) || ""}
              onChange={(e) => {
                const value = e.target.value;
                updateFormData({ sale_price: value === "" ? "" : parseFloat(value) });
              }}
              onBlur={() => markTouched("sale_price")}
              placeholder="35.00"
              className={salePriceError ? "border-destructive focus-visible:ring-destructive" : ""}
              aria-invalid={!!salePriceError}
            />
          </div>
          {salePriceError ? (
            <p className="text-sm text-destructive mt-1">{salePriceError}</p>
          ) : (
            <p className="text-xs text-muted-foreground mt-1">
              Leave blank if not on sale
            </p>
          )}
        </div>
      </div>

      {typeof salePrice === 'number' && salePrice > 0 && typeof regularPrice === 'number' && salePrice < regularPrice && (
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
            value={(formData.cost_per_unit as string | number) || ""}
            onChange={(e) => {
              const value = e.target.value;
              updateFormData({ cost_per_unit: value === "" ? "" : parseFloat(value) });
            }}
            onBlur={() => markTouched("cost_per_unit")}
            placeholder="20.00"
            className={costError ? "border-destructive focus-visible:ring-destructive" : ""}
            aria-invalid={!!costError}
          />
        </div>
        {costError ? (
          <p className="text-sm text-destructive mt-1">{costError}</p>
        ) : (
          <p className="text-xs text-muted-foreground mt-1">
            Used to calculate profit margins (not shown to customers)
          </p>
        )}
      </div>

      {typeof costPerUnit === 'number' && costPerUnit > 0 && typeof regularPrice === 'number' && regularPrice > 0 && (
        <Card className="p-4 bg-muted">
          <p className="text-sm font-medium mb-1">Profit Margin:</p>
          <p className={`text-2xl font-bold ${
            parseFloat(String(profitMargin)) > 40 ? "text-success" :
            parseFloat(String(profitMargin)) > 20 ? "text-warning" : "text-destructive"
          }`}>
            {profitMargin}% (${profit.toFixed(2)} profit per unit)
          </p>
        </Card>
      )}

      <hr className="my-6" />

      <div>
        <Label htmlFor="stock">Current Stock Quantity</Label>
        <Input
          id="stock"
          type="number"
          min="0"
          step="1"
          value={(formData.stock_quantity as string | number) || ""}
          onChange={(e) => {
            const value = e.target.value;
            updateFormData({ stock_quantity: value === "" ? "" : parseInt(value) });
          }}
          onBlur={() => markTouched("stock_quantity")}
          placeholder="15"
          className={`mt-1.5 ${stockError ? "border-destructive focus-visible:ring-destructive" : ""}`}
          aria-invalid={!!stockError}
        />
        {stockError ? (
          <p className="text-sm text-destructive mt-1">{stockError}</p>
        ) : (
          <p className="text-xs text-muted-foreground mt-1">
            Number of units available (whole numbers only)
          </p>
        )}
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
