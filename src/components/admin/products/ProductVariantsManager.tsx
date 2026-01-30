import { useState, useCallback, useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Plus, X, Scale, Leaf, DollarSign, Trash2 } from "lucide-react";
import { AutocompleteInput } from "@/components/ui/autocomplete-input";

// Weight/size options commonly used in cannabis wholesale
const WHOLESALE_WEIGHT_PRESETS = [
  { key: "QP", label: "Quarter Pound (QP)", grams: 113.4 },
  { key: "HP", label: "Half Pound (HP)", grams: 226.8 },
  { key: "LB", label: "Pound (LB)", grams: 453.6 },
] as const;

// Retail weight presets
const RETAIL_WEIGHT_PRESETS = [
  { key: "1g", label: "1 gram", grams: 1 },
  { key: "3.5g", label: "3.5 grams (1/8 oz)", grams: 3.5 },
  { key: "7g", label: "7 grams (1/4 oz)", grams: 7 },
  { key: "14g", label: "14 grams (1/2 oz)", grams: 14 },
  { key: "28g", label: "28 grams (1 oz)", grams: 28 },
] as const;

// Strain types
const STRAIN_TYPES = [
  { value: "indica", label: "Indica", description: "Relaxing, body-focused effects" },
  { value: "sativa", label: "Sativa", description: "Energizing, cerebral effects" },
  { value: "hybrid", label: "Hybrid", description: "Balanced effects" },
  { value: "cbd", label: "CBD", description: "Non-intoxicating, therapeutic" },
] as const;

export interface WeightVariant {
  key: string;
  label: string;
  grams: number;
  price: number | null;
}

export interface StrainOptions {
  strain_name: string;
  strain_type: string;
  strain_lineage: string;
  thc_percent: number | null;
  cbd_percent: number | null;
  terpenes: Record<string, number>;
}

export interface ProductVariantsData {
  prices: Record<string, number>;
  weight_grams: number | null;
  strain_name: string;
  strain_type: string;
  strain_lineage: string;
  thc_percent: number | null;
  cbd_percent: number | null;
  terpenes: Record<string, number>;
}

interface ProductVariantsManagerProps {
  data: Partial<ProductVariantsData>;
  onChange: (data: Partial<ProductVariantsData>) => void;
  mode?: "wholesale" | "retail" | "both";
}

export function ProductVariantsManager({
  data,
  onChange,
  mode = "both",
}: ProductVariantsManagerProps) {
  const [activeTab, setActiveTab] = useState("weights");
  const [customWeightKey, setCustomWeightKey] = useState("");
  const [customWeightGrams, setCustomWeightGrams] = useState("");
  const [customTerpeneName, setCustomTerpeneName] = useState("");
  const [customTerpenePercent, setCustomTerpenePercent] = useState("");

  // Memoize prices to avoid recreating on each render
  const prices = useMemo(() => (data.prices || {}) as Record<string, number>, [data.prices]);

  // Get weight presets based on mode
  const weightPresets = mode === "wholesale"
    ? WHOLESALE_WEIGHT_PRESETS
    : mode === "retail"
    ? RETAIL_WEIGHT_PRESETS
    : [...RETAIL_WEIGHT_PRESETS, ...WHOLESALE_WEIGHT_PRESETS];

  // Add a weight variant
  const addWeightVariant = useCallback((key: string) => {
    const newPrices = { ...prices, [key]: 0 };
    onChange({ prices: newPrices });
  }, [prices, onChange]);

  // Update price for a weight variant
  const updateWeightPrice = useCallback((key: string, price: string) => {
    const priceNum = price === "" ? 0 : parseFloat(price);
    const newPrices = { ...prices, [key]: isNaN(priceNum) ? 0 : priceNum };
    onChange({ prices: newPrices });
  }, [prices, onChange]);

  // Remove a weight variant
  const removeWeightVariant = useCallback((key: string) => {
    const newPrices = { ...prices };
    delete newPrices[key];
    onChange({ prices: newPrices });
  }, [prices, onChange]);

  // Add custom weight
  const addCustomWeight = useCallback(() => {
    if (!customWeightKey.trim()) return;
    addWeightVariant(customWeightKey.trim());
    setCustomWeightKey("");
    setCustomWeightGrams("");
  }, [customWeightKey, addWeightVariant]);

  // Update strain info
  const updateStrainInfo = useCallback((field: keyof StrainOptions, value: string | number | null) => {
    onChange({ [field]: value });
  }, [onChange]);

  // Update terpene
  const updateTerpene = useCallback((name: string, percent: number | null) => {
    const currentTerpenes = (data.terpenes || {}) as Record<string, number>;
    if (percent === null) {
      const newTerpenes = { ...currentTerpenes };
      delete newTerpenes[name];
      onChange({ terpenes: newTerpenes });
    } else {
      onChange({ terpenes: { ...currentTerpenes, [name]: percent } });
    }
  }, [data.terpenes, onChange]);

  // Add custom terpene
  const addCustomTerpene = useCallback(() => {
    if (!customTerpeneName.trim()) return;
    const percent = parseFloat(customTerpenePercent) || 0;
    updateTerpene(customTerpeneName.trim(), percent);
    setCustomTerpeneName("");
    setCustomTerpenePercent("");
  }, [customTerpeneName, customTerpenePercent, updateTerpene]);

  // Common terpenes
  const COMMON_TERPENES = [
    "Myrcene", "Limonene", "Caryophyllene", "Pinene",
    "Linalool", "Humulene", "Terpinolene", "Ocimene"
  ];

  const currentTerpenes = (data.terpenes || {}) as Record<string, number>;
  const availableTerpenes = COMMON_TERPENES.filter(t => !(t in currentTerpenes));

  return (
    <Card>
      <CardHeader className="pb-4">
        <CardTitle className="flex items-center gap-2 text-lg">
          <Scale className="h-5 w-5" />
          Product Variants
        </CardTitle>
      </CardHeader>
      <CardContent>
        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="weights" className="flex items-center gap-2">
              <DollarSign className="h-4 w-4" />
              Size & Pricing
            </TabsTrigger>
            <TabsTrigger value="strain" className="flex items-center gap-2">
              <Leaf className="h-4 w-4" />
              Strain Info
            </TabsTrigger>
          </TabsList>

          {/* Weight/Size Variants Tab */}
          <TabsContent value="weights" className="space-y-4 pt-4">
            <div>
              <Label className="text-sm font-medium">Weight Options</Label>
              <p className="text-xs text-muted-foreground mb-3">
                Add different size options with their prices
              </p>

              {/* Current weight variants */}
              <div className="space-y-2 mb-4">
                {Object.entries(prices).length > 0 ? (
                  Object.entries(prices).map(([key, price]) => {
                    const preset = weightPresets.find(p => p.key === key);
                    return (
                      <div key={key} className="flex items-center gap-2 p-3 bg-muted/50 rounded-lg">
                        <div className="flex-1">
                          <div className="flex items-center gap-2">
                            <Badge variant="secondary">{key}</Badge>
                            {preset && (
                              <span className="text-xs text-muted-foreground">
                                {preset.label}
                              </span>
                            )}
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          <span className="text-muted-foreground">$</span>
                          <Input
                            type="number"
                            min="0"
                            step="0.01"
                            value={price || ""}
                            onChange={(e) => updateWeightPrice(key, e.target.value)}
                            className="w-24"
                            placeholder="0.00"
                          />
                        </div>
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          onClick={() => removeWeightVariant(key)}
                          className="h-8 w-8 text-muted-foreground hover:text-destructive"
                        >
                          <X className="h-4 w-4" />
                        </Button>
                      </div>
                    );
                  })
                ) : (
                  <div className="text-center py-6 text-muted-foreground text-sm border-2 border-dashed rounded-lg">
                    No weight variants added. Add sizes below.
                  </div>
                )}
              </div>

              {/* Quick add presets */}
              <div className="space-y-2">
                <Label className="text-xs text-muted-foreground">Quick Add</Label>
                <div className="flex flex-wrap gap-2">
                  {weightPresets
                    .filter(preset => !(preset.key in prices))
                    .map(preset => (
                      <Button
                        key={preset.key}
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={() => addWeightVariant(preset.key)}
                      >
                        <Plus className="h-3 w-3 mr-1" />
                        {preset.key}
                      </Button>
                    ))}
                </div>
              </div>

              {/* Custom weight */}
              <div className="mt-4 pt-4 border-t">
                <Label className="text-xs text-muted-foreground mb-2 block">Custom Weight</Label>
                <div className="flex gap-2">
                  <Input
                    placeholder="Key (e.g., 2oz)"
                    value={customWeightKey}
                    onChange={(e) => setCustomWeightKey(e.target.value)}
                    className="flex-1"
                  />
                  <Input
                    type="number"
                    placeholder="Grams"
                    value={customWeightGrams}
                    onChange={(e) => setCustomWeightGrams(e.target.value)}
                    className="w-24"
                  />
                  <Button
                    type="button"
                    variant="outline"
                    onClick={addCustomWeight}
                    disabled={!customWeightKey.trim()}
                  >
                    <Plus className="h-4 w-4" />
                  </Button>
                </div>
              </div>

              {/* Base weight */}
              <div className="mt-4 pt-4 border-t">
                <Label htmlFor="base-weight">Base Unit Weight (grams)</Label>
                <Input
                  id="base-weight"
                  type="number"
                  min="0"
                  step="0.1"
                  value={data.weight_grams ?? ""}
                  onChange={(e) => onChange({
                    weight_grams: e.target.value === "" ? null : parseFloat(e.target.value)
                  })}
                  placeholder="e.g., 3.5"
                  className="mt-1.5"
                />
                <p className="text-xs text-muted-foreground mt-1">
                  Default product weight when no variant is selected
                </p>
              </div>
            </div>
          </TabsContent>

          {/* Strain Info Tab */}
          <TabsContent value="strain" className="space-y-4 pt-4">
            {/* Strain Name */}
            <div>
              <Label htmlFor="strain-name">Strain Name</Label>
              <AutocompleteInput
                value={data.strain_name || ""}
                onChange={(value) => updateStrainInfo("strain_name", value)}
                type="strain"
                placeholder="e.g., Blue Dream, OG Kush, Gelato"
                className="mt-1.5"
              />
            </div>

            {/* Strain Type */}
            <div>
              <Label>Strain Type</Label>
              <Select
                value={data.strain_type || ""}
                onValueChange={(value) => updateStrainInfo("strain_type", value)}
              >
                <SelectTrigger className="mt-1.5">
                  <SelectValue placeholder="Select strain type" />
                </SelectTrigger>
                <SelectContent>
                  {STRAIN_TYPES.map(type => (
                    <SelectItem key={type.value} value={type.value}>
                      <div className="flex flex-col">
                        <span>{type.label}</span>
                        <span className="text-xs text-muted-foreground">
                          {type.description}
                        </span>
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Strain Lineage */}
            <div>
              <Label htmlFor="strain-lineage">Strain Lineage</Label>
              <Input
                id="strain-lineage"
                value={data.strain_lineage || ""}
                onChange={(e) => updateStrainInfo("strain_lineage", e.target.value)}
                placeholder="e.g., OG Kush x Durban Poison"
                className="mt-1.5"
              />
              <p className="text-xs text-muted-foreground mt-1">
                Parent strains or genetic lineage
              </p>
            </div>

            {/* THC & CBD Percentages */}
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label htmlFor="thc-percent">THC %</Label>
                <div className="flex items-center gap-2 mt-1.5">
                  <Input
                    id="thc-percent"
                    type="number"
                    min="0"
                    max="100"
                    step="0.1"
                    value={data.thc_percent ?? ""}
                    onChange={(e) => updateStrainInfo(
                      "thc_percent",
                      e.target.value === "" ? null : parseFloat(e.target.value)
                    )}
                    placeholder="0.0"
                  />
                  <span className="text-muted-foreground">%</span>
                </div>
              </div>
              <div>
                <Label htmlFor="cbd-percent">CBD %</Label>
                <div className="flex items-center gap-2 mt-1.5">
                  <Input
                    id="cbd-percent"
                    type="number"
                    min="0"
                    max="100"
                    step="0.1"
                    value={data.cbd_percent ?? ""}
                    onChange={(e) => updateStrainInfo(
                      "cbd_percent",
                      e.target.value === "" ? null : parseFloat(e.target.value)
                    )}
                    placeholder="0.0"
                  />
                  <span className="text-muted-foreground">%</span>
                </div>
              </div>
            </div>

            {/* Terpene Profile */}
            <div className="pt-4 border-t">
              <Label className="text-sm font-medium">Terpene Profile</Label>
              <p className="text-xs text-muted-foreground mb-3">
                Add terpene percentages for this strain
              </p>

              {/* Current terpenes */}
              <div className="space-y-2 mb-4">
                {Object.entries(currentTerpenes).length > 0 ? (
                  Object.entries(currentTerpenes).map(([name, percent]) => (
                    <div key={name} className="flex items-center gap-2 p-2 bg-muted/50 rounded-lg">
                      <Badge variant="outline" className="flex-1">
                        {name}
                      </Badge>
                      <div className="flex items-center gap-2">
                        <Input
                          type="number"
                          min="0"
                          max="100"
                          step="0.01"
                          value={percent}
                          onChange={(e) => updateTerpene(
                            name,
                            e.target.value === "" ? 0 : parseFloat(e.target.value)
                          )}
                          className="w-20"
                        />
                        <span className="text-muted-foreground text-sm">%</span>
                      </div>
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        onClick={() => updateTerpene(name, null)}
                        className="h-8 w-8 text-muted-foreground hover:text-destructive"
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  ))
                ) : (
                  <div className="text-center py-4 text-muted-foreground text-sm border-2 border-dashed rounded-lg">
                    No terpenes added
                  </div>
                )}
              </div>

              {/* Quick add common terpenes */}
              {availableTerpenes.length > 0 && (
                <div className="space-y-2">
                  <Label className="text-xs text-muted-foreground">Quick Add</Label>
                  <div className="flex flex-wrap gap-2">
                    {availableTerpenes.slice(0, 4).map(terpene => (
                      <Button
                        key={terpene}
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={() => updateTerpene(terpene, 0)}
                      >
                        <Plus className="h-3 w-3 mr-1" />
                        {terpene}
                      </Button>
                    ))}
                  </div>
                </div>
              )}

              {/* Custom terpene */}
              <div className="mt-4 pt-4 border-t">
                <Label className="text-xs text-muted-foreground mb-2 block">Custom Terpene</Label>
                <div className="flex gap-2">
                  <Input
                    placeholder="Terpene name"
                    value={customTerpeneName}
                    onChange={(e) => setCustomTerpeneName(e.target.value)}
                    className="flex-1"
                  />
                  <Input
                    type="number"
                    placeholder="%"
                    min="0"
                    max="100"
                    step="0.01"
                    value={customTerpenePercent}
                    onChange={(e) => setCustomTerpenePercent(e.target.value)}
                    className="w-20"
                  />
                  <Button
                    type="button"
                    variant="outline"
                    onClick={addCustomTerpene}
                    disabled={!customTerpeneName.trim()}
                  >
                    <Plus className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            </div>
          </TabsContent>
        </Tabs>
      </CardContent>
    </Card>
  );
}
