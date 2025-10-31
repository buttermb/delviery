import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Plus } from "lucide-react";

interface DetailsStepProps {
  formData: any;
  updateFormData: (data: any) => void;
}

const EFFECTS = [
  "Relaxing", "Energizing", "Uplifting", "Focused",
  "Sleepy", "Creative", "Social", "Pain Relief", "Euphoric"
];

const FLAVORS = [
  "Earthy", "Citrus", "Sweet", "Pine",
  "Berry", "Diesel", "Spicy", "Floral", "Fruity"
];

export function DetailsStep({ formData, updateFormData }: DetailsStepProps) {
  const toggleEffect = (effect: string) => {
    const currentEffects = Array.isArray(formData.effects) ? formData.effects : [];
    const newEffects = currentEffects.includes(effect)
      ? currentEffects.filter((e: string) => e !== effect)
      : [...currentEffects, effect];
    updateFormData({ effects: newEffects });
  };

  const toggleFlavor = (flavor: string) => {
    const currentFlavors = Array.isArray(formData.flavors) ? formData.flavors : [];
    const newFlavors = currentFlavors.includes(flavor)
      ? currentFlavors.filter((f: string) => f !== flavor)
      : [...currentFlavors, flavor];
    updateFormData({ flavors: newFlavors });
  };

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold mb-4">Detailed Information</h2>
        <p className="text-muted-foreground">
          Add descriptions and characteristics
        </p>
      </div>

      <div>
        <Label htmlFor="short-desc">Short Description * (Shown on product card)</Label>
        <Textarea
          id="short-desc"
          value={formData.description || ""}
          onChange={(e) => updateFormData({ description: e.target.value })}
          placeholder="Hand-trimmed indoor cultivation. Premium flower represents the pinnacle of quality genetics."
          maxLength={200}
          rows={3}
          className="mt-1.5"
        />
        <p className="text-xs text-muted-foreground mt-1">
          Characters: {(formData.description || "").length}/200
        </p>
      </div>

      <div>
        <Label htmlFor="full-desc">Full Description (Shown on product page)</Label>
        <Textarea
          id="full-desc"
          value={formData.strain_info?.description || ""}
          onChange={(e) =>
            updateFormData({
              strain_info: { ...formData.strain_info, description: e.target.value },
            })
          }
          placeholder="Tell customers about strain effects, flavor profile, best use cases, and lab testing highlights..."
          rows={6}
          className="mt-1.5"
        />
        <p className="text-xs text-muted-foreground mt-1">
          Include details about effects, flavors, and best use cases
        </p>
      </div>

      <div>
        <Label>Effects (Check all that apply)</Label>
        <div className="grid grid-cols-3 gap-3 mt-3">
          {EFFECTS.map((effect) => (
            <div key={effect} className="flex items-center space-x-2">
              <Checkbox
                id={`effect-${effect}`}
                checked={Array.isArray(formData.effects) && formData.effects.includes(effect)}
                onCheckedChange={() => toggleEffect(effect)}
              />
              <Label htmlFor={`effect-${effect}`} className="font-normal cursor-pointer">
                {effect}
              </Label>
            </div>
          ))}
        </div>
      </div>

      <div>
        <Label>Flavors (Check all that apply)</Label>
        <div className="grid grid-cols-3 gap-3 mt-3">
          {FLAVORS.map((flavor) => (
            <div key={flavor} className="flex items-center space-x-2">
              <Checkbox
                id={`flavor-${flavor}`}
                checked={Array.isArray(formData.flavors) && formData.flavors.includes(flavor)}
                onCheckedChange={() => toggleFlavor(flavor)}
              />
              <Label htmlFor={`flavor-${flavor}`} className="font-normal cursor-pointer">
                {flavor}
              </Label>
            </div>
          ))}
        </div>
      </div>

      <div>
        <Label htmlFor="usage-tips">Usage Tips (Optional)</Label>
        <Textarea
          id="usage-tips"
          value={formData.usage_tips || ""}
          onChange={(e) => updateFormData({ usage_tips: e.target.value })}
          placeholder="Best practices for consumption, dosage recommendations, etc."
          rows={3}
          className="mt-1.5"
        />
      </div>
    </div>
  );
}
