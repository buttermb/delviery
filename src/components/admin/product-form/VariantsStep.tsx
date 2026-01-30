import { useState } from "react";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Plus, X, DollarSign, Scale, AlertCircle } from "lucide-react";

interface ProductFormData {
  prices?: Record<string, number | string>;
  [key: string]: unknown;
}

interface VariantsStepProps {
  formData: ProductFormData;
  updateFormData: (data: Partial<ProductFormData>) => void;
}

// Common weight variants for cannabis products
const PRESET_WEIGHTS = [
  { value: "1g", label: "1 gram" },
  { value: "3.5g", label: "3.5g (1/8 oz)" },
  { value: "7g", label: "7g (1/4 oz)" },
  { value: "14g", label: "14g (1/2 oz)" },
  { value: "28g", label: "28g (1 oz)" },
];

// Non-weight variants for edibles, vapes, etc.
const PRESET_SIZES = [
  { value: "single", label: "Single" },
  { value: "2-pack", label: "2-Pack" },
  { value: "4-pack", label: "4-Pack" },
  { value: "10-pack", label: "10-Pack" },
];

export function VariantsStep({ formData, updateFormData }: VariantsStepProps) {
  const [customWeight, setCustomWeight] = useState("");
  const [customPrice, setCustomPrice] = useState("");
  const [variantType, setVariantType] = useState<"weight" | "size">("weight");

  const currentPrices = (formData.prices as Record<string, number | string>) || {};
  const hasVariants = Object.keys(currentPrices).length > 0;

  const addVariant = (key: string, price: number | string = "") => {
    updateFormData({
      prices: { ...currentPrices, [key]: price },
    });
  };

  const updateVariantPrice = (key: string, price: string) => {
    updateFormData({
      prices: {
        ...currentPrices,
        [key]: price === "" ? "" : parseFloat(price),
      },
    });
  };

  const removeVariant = (key: string) => {
    const newPrices = { ...currentPrices };
    delete newPrices[key];
    updateFormData({ prices: newPrices });
  };

  const addCustomVariant = () => {
    if (!customWeight.trim()) return;

    const key = customWeight.trim();
    if (currentPrices[key] !== undefined) {
      return; // Already exists
    }

    addVariant(key, customPrice ? parseFloat(customPrice) : "");
    setCustomWeight("");
    setCustomPrice("");
  };

  const presets = variantType === "weight" ? PRESET_WEIGHTS : PRESET_SIZES;
  const availablePresets = presets.filter((p) => currentPrices[p.value] === undefined);

  // Calculate price per gram for variants (for comparison)
  const calculatePricePerGram = (key: string, price: number | string): number | null => {
    const priceNum = typeof price === "string" ? parseFloat(price) : price;
    if (!priceNum || isNaN(priceNum)) return null;

    // Extract numeric value from key
    const match = key.match(/^(\d+\.?\d*)/);
    if (!match) return null;

    const grams = parseFloat(match[1]);
    if (!grams) return null;

    return priceNum / grams;
  };

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold mb-4">Price Variants</h2>
        <p className="text-muted-foreground">
          Set up different prices for different sizes or quantities. This allows customers
          to choose from multiple options when purchasing.
        </p>
      </div>

      {/* Variant Type Toggle */}
      <div className="flex gap-2">
        <Button
          type="button"
          variant={variantType === "weight" ? "default" : "outline"}
          size="sm"
          onClick={() => setVariantType("weight")}
        >
          <Scale className="h-4 w-4 mr-2" />
          Weight-Based
        </Button>
        <Button
          type="button"
          variant={variantType === "size" ? "default" : "outline"}
          size="sm"
          onClick={() => setVariantType("size")}
        >
          <DollarSign className="h-4 w-4 mr-2" />
          Size/Pack-Based
        </Button>
      </div>

      {/* Quick Add Presets */}
      {availablePresets.length > 0 && (
        <div>
          <Label className="text-sm font-medium mb-2 block">Quick Add</Label>
          <div className="flex flex-wrap gap-2">
            {availablePresets.map((preset) => (
              <Button
                key={preset.value}
                type="button"
                variant="outline"
                size="sm"
                onClick={() => addVariant(preset.value)}
              >
                <Plus className="h-3 w-3 mr-1" />
                {preset.label}
              </Button>
            ))}
          </div>
        </div>
      )}

      {/* Current Variants */}
      {hasVariants && (
        <div className="space-y-3">
          <Label className="text-sm font-medium">Price Variants</Label>
          {Object.entries(currentPrices)
            .filter(([, price]) => price !== null && price !== undefined)
            .map(([key, price]) => {
              const pricePerGram = calculatePricePerGram(key, price);
              return (
                <Card key={key} className="p-4">
                  <div className="flex items-center gap-4">
                    <div className="flex-shrink-0">
                      <Badge variant="secondary" className="font-mono text-sm">
                        {key}
                      </Badge>
                    </div>
                    <div className="flex-1">
                      <div className="flex items-center">
                        <span className="text-muted-foreground mr-2">$</span>
                        <Input
                          type="number"
                          min="0"
                          step="0.01"
                          value={price === "" ? "" : (typeof price === "number" ? price : 0)}
                          onChange={(e) => updateVariantPrice(key, e.target.value)}
                          placeholder="0.00"
                          className="max-w-[150px]"
                        />
                      </div>
                      {pricePerGram !== null && (
                        <p className="text-xs text-muted-foreground mt-1">
                          ${pricePerGram.toFixed(2)}/g
                        </p>
                      )}
                    </div>
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      onClick={() => removeVariant(key)}
                      className="text-destructive hover:text-destructive"
                    >
                      <X className="h-4 w-4" />
                    </Button>
                  </div>
                </Card>
              );
            })}
        </div>
      )}

      {/* Custom Variant Input */}
      <Card className="p-4 border-dashed">
        <Label className="text-sm font-medium mb-3 block">Add Custom Variant</Label>
        <div className="flex gap-2 items-end">
          <div className="flex-1">
            <Label className="text-xs text-muted-foreground mb-1 block">
              Name/Size
            </Label>
            <Input
              value={customWeight}
              onChange={(e) => setCustomWeight(e.target.value)}
              placeholder={variantType === "weight" ? "e.g., 56g" : "e.g., 6-pack"}
            />
          </div>
          <div className="w-32">
            <Label className="text-xs text-muted-foreground mb-1 block">
              Price
            </Label>
            <div className="flex items-center">
              <span className="text-muted-foreground mr-2">$</span>
              <Input
                type="number"
                min="0"
                step="0.01"
                value={customPrice}
                onChange={(e) => setCustomPrice(e.target.value)}
                placeholder="0.00"
              />
            </div>
          </div>
          <Button
            type="button"
            onClick={addCustomVariant}
            disabled={!customWeight.trim()}
          >
            <Plus className="h-4 w-4 mr-1" />
            Add
          </Button>
        </div>
      </Card>

      {/* No Variants Info */}
      {!hasVariants && (
        <Card className="p-6 bg-muted/50">
          <div className="flex items-start gap-3">
            <AlertCircle className="h-5 w-5 text-muted-foreground mt-0.5" />
            <div>
              <p className="font-medium">No variants configured</p>
              <p className="text-sm text-muted-foreground mt-1">
                You can sell this product at a single price, or add variants above
                to offer multiple size/quantity options. The base price from the
                Pricing step will be used if no variants are configured.
              </p>
            </div>
          </div>
        </Card>
      )}

      {/* Pricing Tips */}
      <Card className="p-4 bg-blue-50 border-blue-200">
        <h4 className="font-medium text-blue-900 mb-2">Pricing Tips</h4>
        <ul className="text-sm text-blue-800 space-y-1">
          <li>- Larger quantities typically have a lower price per gram</li>
          <li>- Consider offering a small discount for bulk purchases</li>
          <li>- Keep prices competitive with market rates</li>
          <li>- Variants without prices will use the base product price</li>
        </ul>
      </Card>
    </div>
  );
}
