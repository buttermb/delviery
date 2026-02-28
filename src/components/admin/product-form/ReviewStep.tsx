import { useMemo } from "react";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Label } from "@/components/ui/label";
import { Check, AlertCircle, Package } from "lucide-react";

interface ProductFormData {
  [key: string]: unknown;
}

interface ReviewStepProps {
  formData: ProductFormData;
  updateFormData: (data: Partial<ProductFormData>) => void;
}

const requiredFields = [
  { field: "name", label: "Product name" },
  { field: "category", label: "Category" },
  { field: "thca_percentage", label: "Cannabinoid percentage" },
  { field: "image_url", label: "Main image" },
  { field: "price", label: "Price" },
  { field: "description", label: "Description" },
  { field: "coa_url", label: "COA" },
] as const;

const optionalFields = [
  { field: "effects", label: "Effects tags" },
  { field: "flavors", label: "Flavor tags" },
  { field: "vendor_name", label: "Vendor name" },
  { field: "weight_kg", label: "Shipping weight" },
  { field: "length_cm", label: "Package dimensions" },
] as const;

export function ReviewStep({ formData, updateFormData }: ReviewStepProps) {

  // Optimized: single pass for both filters with memoization
  const { missingRequired, missingOptional } = useMemo(() => {
    const required: Array<{ field: string; label: string }> = [];
    const optional: Array<{ field: string; label: string }> = [];
    
    for (const f of requiredFields) {
      if (!formData[f.field]) {
        required.push(f);
      }
    }
    
    for (const f of optionalFields) {
      const value = formData[f.field];
      if (!value || (Array.isArray(value) && value.length === 0)) {
        optional.push(f);
      }
    }
    
    return { missingRequired: required, missingOptional: optional };
  }, [formData]);

  // Optimized: avoid Object.keys() check, just get first value directly
  const getPrice = () => {
    if (formData.prices && typeof formData.prices === 'object' && !Array.isArray(formData.prices)) {
      const prices = formData.prices as Record<string, unknown>;
      const firstKey = Object.keys(prices)[0];
      if (firstKey) {
        return prices[firstKey] ?? 0;
      }
    }
    return formData.price ?? 0;
  };

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold mb-4">Review & Publish</h2>
        <p className="text-muted-foreground">
          Review your product before publishing
        </p>
      </div>

      {/* Product Preview */}
      <div>
        <Label className="text-lg font-semibold">Product Preview</Label>
        <p className="text-sm text-muted-foreground mb-3">
          This is how customers will see your product
        </p>
        <Card className="overflow-hidden max-w-sm">
          <img
            src={(formData.image_url as string) || "/placeholder.svg"}
            alt={(formData.name as string) || "Product"}
            className="w-full h-48 object-cover"
            loading="lazy"
          />
          <div className="p-4 space-y-2">
            <h3 className="font-semibold text-lg">{(formData.name as string) || "Product Name"}</h3>
            <p className="text-sm text-muted-foreground">
              {(formData.category as string) || "Category"} • {(formData.thca_percentage as string | number) || "0"}%
            </p>
            <p className="text-sm line-clamp-2">
              {(formData.description as string) || "No description provided"}
            </p>
            <div className="flex items-center justify-between pt-2">
              <span className="text-2xl font-bold">${String(getPrice())}</span>
              <Badge variant={formData.in_stock ? "default" : "secondary"}>
                {formData.in_stock ? "In Stock" : "Out of Stock"}
              </Badge>
            </div>
            <Button className="w-full" disabled>
              Add to Cart
            </Button>
          </div>
        </Card>
      </div>

      {/* Shipping Dimensions */}
      {(formData.weight_kg || formData.length_cm || formData.width_cm || formData.height_cm) && (
        <div>
          <Label className="text-lg font-semibold flex items-center gap-2">
            <Package className="h-4 w-4" />
            Shipping Dimensions
          </Label>
          <Card className="p-4 mt-3">
            <div className="grid grid-cols-2 gap-4 text-sm">
              {formData.weight_kg && (
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Weight:</span>
                  <span className="font-medium">{String(formData.weight_kg)} kg</span>
                </div>
              )}
              {(formData.length_cm || formData.width_cm || formData.height_cm) && (
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Dimensions:</span>
                  <span className="font-medium">
                    {String(formData.length_cm || "-")} × {String(formData.width_cm || "-")} × {String(formData.height_cm || "-")} cm
                  </span>
                </div>
              )}
              {formData.length_cm && formData.width_cm && formData.height_cm && (
                <div className="flex justify-between col-span-2">
                  <span className="text-muted-foreground">Volume:</span>
                  <span className="font-medium">
                    {(
                      (Number(formData.length_cm) *
                        Number(formData.width_cm) *
                        Number(formData.height_cm)) /
                      1000
                    ).toFixed(2)}{" "}
                    L
                  </span>
                </div>
              )}
            </div>
          </Card>
        </div>
      )}

      {/* Checklist */}
      <div>
        <Label className="text-lg font-semibold">Checklist Before Publishing</Label>
        <Card className="p-4 mt-3 space-y-2">
          {requiredFields.map((field) => (
            <div key={field.field} className="flex items-center gap-2">
              {formData[field.field] ? (
                <Check className="h-5 w-5 text-green-600" />
              ) : (
                <AlertCircle className="h-5 w-5 text-red-600" />
              )}
              <span className={formData[field.field] ? "" : "text-red-600"}>
                {field.label}
              </span>
            </div>
          ))}
          {missingOptional.map((field) => (
            <div key={field.field} className="flex items-center gap-2">
              <AlertCircle className="h-5 w-5 text-yellow-600" />
              <span className="text-yellow-600">{field.label} (optional)</span>
            </div>
          ))}
        </Card>
      </div>

      {/* Visibility Settings */}
      <div>
        <Label className="text-lg font-semibold">Visibility Settings</Label>
        <RadioGroup
          value={(formData.publish_status as string) || "publish"}
          onValueChange={(value) => updateFormData({ publish_status: value })}
          className="mt-3"
        >
          <div className="flex items-center space-x-2">
            <RadioGroupItem value="publish" id="publish" />
            <Label htmlFor="publish" className="font-normal cursor-pointer">
              Publish Now (Live immediately)
            </Label>
          </div>
          <div className="flex items-center space-x-2">
            <RadioGroupItem value="draft" id="draft" />
            <Label htmlFor="draft" className="font-normal cursor-pointer">
              Save as Draft (Not visible to customers)
            </Label>
          </div>
        </RadioGroup>
      </div>

      {missingRequired.length > 0 && (
        <Card className="p-4 border-red-200 bg-red-50">
          <p className="text-red-600 font-medium">
            Cannot publish: {missingRequired.length} required field
            {missingRequired.length > 1 ? "s" : ""} missing
          </p>
          <ul className="mt-2 space-y-1">
            {missingRequired.map((field) => (
              <li key={field.field} className="text-sm text-red-600">
                • {field.label}
              </li>
            ))}
          </ul>
        </Card>
      )}
    </div>
  );
}
