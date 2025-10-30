import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Textarea } from "@/components/ui/textarea";

interface BasicInfoStepProps {
  formData: any;
  updateFormData: (data: any) => void;
}

export function BasicInfoStep({ formData, updateFormData }: BasicInfoStepProps) {
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
          <Label htmlFor="name">Product Name *</Label>
          <Input
            id="name"
            value={formData.name || ""}
            onChange={(e) => updateFormData({ name: e.target.value })}
            placeholder="Example: Blue Dream - Sativa"
            className="mt-1.5"
          />
          <p className="text-xs text-muted-foreground mt-1">
            Example: "Blue Dream - Sativa"
          </p>
        </div>

        <div>
          <Label htmlFor="strain">Strain Name (Optional)</Label>
          <Input
            id="strain"
            value={formData.strain_lineage || ""}
            onChange={(e) => updateFormData({ strain_lineage: e.target.value })}
            placeholder="Example: Purple Haze"
            className="mt-1.5"
          />
          <p className="text-xs text-muted-foreground mt-1">
            The specific strain name (e.g., "Purple Haze", "OG Kush")
          </p>
        </div>

        <div>
          <Label>Category *</Label>
          <RadioGroup
            value={formData.category || ""}
            onValueChange={(value) => updateFormData({ category: value })}
            className="mt-3 space-y-2"
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
          <p className="text-xs text-muted-foreground mt-1">
            Choose the product category
          </p>
        </div>

        <div>
          <Label>Strain Type (Optional)</Label>
          <RadioGroup
            value={formData.strain_type || ""}
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
            <Label htmlFor="thca">Cannabinoid Percentage *</Label>
            <div className="flex items-center mt-1.5">
              <Input
                id="thca"
                type="number"
                min="0"
                max="100"
                step="0.1"
                value={formData.thca_percentage || ""}
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
                value={formData.cbd_content || ""}
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
          <Label htmlFor="weight">Weight/Size *</Label>
          <div className="flex gap-2 mt-1.5">
            <Input
              id="weight"
              type="number"
              step="0.1"
              value={formData.weight_grams || ""}
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
          <Input
            id="vendor"
            value={formData.vendor_name || ""}
            onChange={(e) => updateFormData({ vendor_name: e.target.value })}
            placeholder="Vendor/Brand name"
            className="mt-1.5"
          />
        </div>
      </div>
    </div>
  );
}
