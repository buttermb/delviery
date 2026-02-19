import { useState, useCallback } from "react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { AutocompleteInput } from "@/components/ui/autocomplete-input";

interface ProductFormData {
  name?: string;
  category?: string;
  [key: string]: unknown;
}

interface BasicInfoStepProps {
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
    case "name":
      if (!value || !(value as string).trim()) return "Product name is required";
      if ((value as string).trim().length > 200) return "Name must be 200 characters or less";
      return null;
    case "category":
      if (!value) return "Category is required";
      return null;
    default:
      return null;
  }
}

export function BasicInfoStep({ formData, updateFormData, showErrors = false }: BasicInfoStepProps) {
  const [touched, setTouched] = useState<Record<string, boolean>>({});

  const markTouched = useCallback((field: string) => {
    setTouched((prev) => ({ ...prev, [field]: true }));
  }, []);

  const nameError = getFieldError("name", formData.name, !!touched.name, showErrors);
  const categoryError = getFieldError("category", formData.category, !!touched.category, showErrors);

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold mb-4">Basic Information</h2>
        <p className="text-muted-foreground">
          Enter the essential details about your product
        </p>
      </div>

      <div className="space-y-4">
        <div>
          <Label htmlFor="name">Product Name <span className="text-destructive">*</span></Label>
          <Input
            id="name"
            maxLength={200}
            value={formData.name || ""}
            onChange={(e) => updateFormData({ name: e.target.value })}
            onBlur={() => markTouched("name")}
            placeholder="Example: Blue Dream - Sativa"
            className={`mt-1.5 ${nameError ? "border-destructive focus-visible:ring-destructive" : ""}`}
            aria-invalid={!!nameError}
          />
          {nameError ? (
            <p className="text-sm text-destructive mt-1">{nameError}</p>
          ) : (
            <p className="text-xs text-muted-foreground mt-1">
              Example: &quot;Blue Dream - Sativa&quot;
            </p>
          )}
        </div>

        <div>
          <Label htmlFor="strain">Strain Name (Optional)</Label>
          <AutocompleteInput
            value={(formData.strain_lineage as string) || (formData.strain_name as string) || ""}
            onChange={(value) => updateFormData({
              strain_lineage: value,
              strain_name: value
            })}
            type="strain"
            placeholder="Strain name (e.g., Gelato, Runtz, OG Kush)"
            className="mt-1.5"
          />
          <p className="text-xs text-muted-foreground mt-1">
            The specific strain name (e.g., &quot;Purple Haze&quot;, &quot;OG Kush&quot;)
          </p>
        </div>

        <div>
          <Label>Category <span className="text-destructive">*</span></Label>
          <RadioGroup
            value={formData.category || ""}
            onValueChange={(value) => {
              updateFormData({ category: value });
              markTouched("category");
            }}
            className={`mt-3 space-y-2 ${categoryError ? "rounded-md ring-1 ring-destructive p-2" : ""}`}
          >
            {["flower", "edibles", "vapes", "concentrates"].map(
              (cat) => (
                <div key={cat} className="flex items-center space-x-2">
                  <RadioGroupItem value={cat} id={`cat-${cat}`} />
                  <Label htmlFor={`cat-${cat}`} className="font-normal capitalize cursor-pointer">
                    {cat}
                  </Label>
                </div>
              )
            )}
          </RadioGroup>
          {categoryError ? (
            <p className="text-sm text-destructive mt-1">{categoryError}</p>
          ) : (
            <p className="text-xs text-muted-foreground mt-1">
              Choose the product category
            </p>
          )}
        </div>

        <div>
          <Label>Strain Type (Optional)</Label>
          <RadioGroup
            value={(formData.strain_type as string) || ""}
            onValueChange={(value) => updateFormData({ strain_type: value })}
            className="mt-3 flex gap-4"
          >
            <div className="flex items-center space-x-2">
              <RadioGroupItem value="indica" id="strain-indica" />
              <Label htmlFor="strain-indica" className="font-normal cursor-pointer">Indica</Label>
            </div>
            <div className="flex items-center space-x-2">
              <RadioGroupItem value="sativa" id="strain-sativa" />
              <Label htmlFor="strain-sativa" className="font-normal cursor-pointer">Sativa</Label>
            </div>
            <div className="flex items-center space-x-2">
              <RadioGroupItem value="hybrid" id="strain-hybrid" />
              <Label htmlFor="strain-hybrid" className="font-normal cursor-pointer">Hybrid</Label>
            </div>
            <div className="flex items-center space-x-2">
              <RadioGroupItem value="cbd" id="strain-cbd" />
              <Label htmlFor="strain-cbd" className="font-normal cursor-pointer">CBD</Label>
            </div>
          </RadioGroup>
          <p className="text-xs text-muted-foreground mt-1">
            Select indica, sativa, hybrid, or CBD
          </p>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <Label htmlFor="thca">Cannabinoid Percentage <span className="text-destructive ml-0.5" aria-hidden="true">*</span></Label>
            <div className="flex items-center mt-1.5">
              <Input
                id="thca"
                type="number"
                min="0"
                max="100"
                step="0.1"
                value={(formData.thca_percentage as string | number) || ""}
                onChange={(e) =>
                  updateFormData({ thca_percentage: e.target.value === "" ? "" : parseFloat(e.target.value) })
                }
                placeholder="24.5"
              />
              <span className="ml-2">%</span>
            </div>
          </div>

          <div>
            <Label htmlFor="cbd">CBD Percentage (Optional)</Label>
            <div className="flex items-center mt-1.5">
              <Input
                id="cbd"
                type="number"
                min="0"
                max="100"
                step="0.1"
                value={(formData.cbd_content as string | number) || ""}
                onChange={(e) =>
                  updateFormData({ cbd_content: e.target.value === "" ? "" : parseFloat(e.target.value) })
                }
                placeholder="0.5"
              />
              <span className="ml-2">%</span>
            </div>
          </div>
        </div>

        <div>
          <Label htmlFor="weight">Weight/Size <span className="text-destructive ml-0.5" aria-hidden="true">*</span></Label>
          <div className="flex gap-2 mt-1.5">
            <Input
              id="weight"
              type="number"
              step="0.1"
              value={(formData.weight_grams as string | number) || ""}
              onChange={(e) =>
                updateFormData({ weight_grams: e.target.value === "" ? "" : parseFloat(e.target.value) })
              }
              placeholder="3.5"
              className="flex-1"
            />
            <select
              className="border rounded-md px-3"
              value="grams"
              disabled
            >
              <option value="grams">grams</option>
            </select>
          </div>
        </div>

        <div>
          <Label htmlFor="vendor">Vendor Name (Optional)</Label>
          <AutocompleteInput
            value={(formData.vendor_name as string) || ""}
            onChange={(value) => updateFormData({ vendor_name: value })}
            type="brand"
            placeholder="Vendor/Brand name (e.g., Cookies, Jungle Boys)"
            className="mt-1.5"
          />
        </div>

        {/* Shipping Dimensions Section */}
        <div className="pt-4 border-t">
          <Label className="text-base font-medium">Shipping Dimensions (Optional)</Label>
          <p className="text-xs text-muted-foreground mb-3">
            Used for shipping cost calculation and delivery route optimization
          </p>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label htmlFor="weight_kg">Shipping Weight</Label>
              <div className="flex items-center mt-1.5">
                <Input
                  id="weight_kg"
                  type="number"
                  min="0"
                  step="0.001"
                  value={(formData.weight_kg as string | number) || ""}
                  onChange={(e) =>
                    updateFormData({ weight_kg: e.target.value === "" ? "" : parseFloat(e.target.value) })
                  }
                  placeholder="0.5"
                />
                <span className="ml-2 text-sm text-muted-foreground">kg</span>
              </div>
            </div>

            <div>
              <Label htmlFor="length_cm">Length</Label>
              <div className="flex items-center mt-1.5">
                <Input
                  id="length_cm"
                  type="number"
                  min="0"
                  step="0.1"
                  value={(formData.length_cm as string | number) || ""}
                  onChange={(e) =>
                    updateFormData({ length_cm: e.target.value === "" ? "" : parseFloat(e.target.value) })
                  }
                  placeholder="10"
                />
                <span className="ml-2 text-sm text-muted-foreground">cm</span>
              </div>
            </div>

            <div>
              <Label htmlFor="width_cm">Width</Label>
              <div className="flex items-center mt-1.5">
                <Input
                  id="width_cm"
                  type="number"
                  min="0"
                  step="0.1"
                  value={(formData.width_cm as string | number) || ""}
                  onChange={(e) =>
                    updateFormData({ width_cm: e.target.value === "" ? "" : parseFloat(e.target.value) })
                  }
                  placeholder="5"
                />
                <span className="ml-2 text-sm text-muted-foreground">cm</span>
              </div>
            </div>

            <div>
              <Label htmlFor="height_cm">Height</Label>
              <div className="flex items-center mt-1.5">
                <Input
                  id="height_cm"
                  type="number"
                  min="0"
                  step="0.1"
                  value={(formData.height_cm as string | number) || ""}
                  onChange={(e) =>
                    updateFormData({ height_cm: e.target.value === "" ? "" : parseFloat(e.target.value) })
                  }
                  placeholder="3"
                />
                <span className="ml-2 text-sm text-muted-foreground">cm</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
