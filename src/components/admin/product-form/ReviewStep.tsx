import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Label } from "@/components/ui/label";
import { Check, AlertCircle } from "lucide-react";

interface ReviewStepProps {
  formData: any;
  updateFormData: (data: any) => void;
}

export function ReviewStep({ formData, updateFormData }: ReviewStepProps) {
  const requiredFields = [
    { field: "name", label: "Product name" },
    { field: "category", label: "Category" },
    { field: "thca_percentage", label: "Cannabinoid percentage" },
    { field: "image_url", label: "Main image" },
    { field: "price", label: "Price" },
    { field: "description", label: "Description" },
    { field: "coa_url", label: "COA" },
  ];

  const optionalFields = [
    { field: "effects", label: "Effects tags" },
    { field: "flavors", label: "Flavor tags" },
    { field: "vendor_name", label: "Vendor name" },
  ];

  const missingRequired = requiredFields.filter((f) => !formData[f.field]);
  const missingOptional = optionalFields.filter(
    (f) => !formData[f.field] || formData[f.field]?.length === 0
  );

  const getPrice = () => {
    if (formData.prices && Object.keys(formData.prices).length > 0) {
      return Object.values(formData.prices)[0];
    }
    return formData.price || 0;
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
            src={formData.image_url || "/placeholder.svg"}
            alt={formData.name}
            className="w-full h-48 object-cover"
          />
          <div className="p-4 space-y-2">
            <h3 className="font-semibold text-lg">{formData.name || "Product Name"}</h3>
            <p className="text-sm text-muted-foreground">
              {formData.category || "Category"} • {formData.thca_percentage || "0"}%
            </p>
            <p className="text-sm line-clamp-2">
              {formData.description || "No description provided"}
            </p>
            <div className="flex items-center justify-between pt-2">
              <span className="text-2xl font-bold">${getPrice()}</span>
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
          value={formData.publish_status || "publish"}
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
            ⚠️ Cannot publish: {missingRequired.length} required field
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
