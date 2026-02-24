/**
 * Quick Questions Step for Menu Migration
 * Asks essential questions to fill in missing data before import
 */

import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import {
  HelpCircle,
  Leaf,
  Package,
  DollarSign,
  Sparkles,
  ArrowRight,
  FlaskConical,
  Calculator,
  Truck,
  Store,
} from 'lucide-react';
import type { QuickAnswers } from '@/lib/migration/text-parser';
import type { CannabisCategory, QualityTier } from '@/types/migration';

interface QuickQuestionsStepProps {
  suggestedDefaults?: Partial<QuickAnswers>;
  parsedProductCount: number;
  missingFields: string[];
  onConfirm: (answers: QuickAnswers) => void;
  onBack: () => void;
}

const CATEGORY_OPTIONS: { value: CannabisCategory; label: string; icon: string }[] = [
  { value: 'flower', label: 'Flower', icon: '🌿' },
  { value: 'concentrate', label: 'Concentrate', icon: '💎' },
  { value: 'edible', label: 'Edible', icon: '🍬' },
  { value: 'vape', label: 'Vape', icon: '💨' },
  { value: 'preroll', label: 'Pre-roll', icon: '🚬' },
  { value: 'tincture', label: 'Tincture', icon: '💧' },
  { value: 'topical', label: 'Topical', icon: '🧴' },
  { value: 'other', label: 'Other', icon: '📦' },
];

const QUALITY_OPTIONS: { value: QualityTier; label: string; description: string }[] = [
  { value: 'exotic', label: 'Exotic / Premium', description: 'Top shelf, highest quality' },
  { value: 'indoor', label: 'Indoor', description: 'Grown indoors with controlled environment' },
  { value: 'greenhouse', label: 'Greenhouse / Deps', description: 'Light deprivation or greenhouse grown' },
  { value: 'outdoor', label: 'Outdoor', description: 'Sun-grown, natural cultivation' },
];

const PACK_OPTIONS: { value: QuickAnswers['packMeaning']; label: string; description: string }[] = [
  { value: 'lb', label: 'Pounds (lbs)', description: 'Each pack = 1 lb' },
  { value: 'hp', label: 'Half Pounds', description: 'Each pack = 0.5 lb' },
  { value: 'qp', label: 'Quarter Pounds', description: 'Each pack = 0.25 lb' },
  { value: 'oz', label: 'Ounces', description: 'Each pack = 1 oz' },
  { value: 'unit', label: 'Units / Each', description: 'Individual items' },
];

const MARKUP_PRESETS = [
  { value: 20, label: '20%' },
  { value: 30, label: '30%' },
  { value: 40, label: '40%' },
  { value: 50, label: '50%' },
];

export function QuickQuestionsStep({
  suggestedDefaults,
  parsedProductCount,
  missingFields,
  onConfirm,
  onBack,
}: QuickQuestionsStepProps) {
  const [answers, setAnswers] = useState<QuickAnswers>({
    category: suggestedDefaults?.category ?? 'flower',
    packMeaning: suggestedDefaults?.packMeaning ?? 'lb',
    qualityTier: suggestedDefaults?.qualityTier ?? 'indoor',
    priceType: suggestedDefaults?.priceType ?? 'wholesale',
    priceFormat: suggestedDefaults?.priceFormat ?? 'abbreviated',
    retailMarkup: suggestedDefaults?.retailMarkup || 30,
    defaultPricePerLb: suggestedDefaults?.defaultPricePerLb,
    defaultRetailPricePerOz: suggestedDefaults?.defaultRetailPricePerOz,
    allInStock: suggestedDefaults?.allInStock ?? true,
    minOrderQuantity: suggestedDefaults?.minOrderQuantity,
    labTested: suggestedDefaults?.labTested ?? false,
    supplierName: suggestedDefaults?.supplierName,
    notes: suggestedDefaults?.notes,
  });

  const [showAdvanced, setShowAdvanced] = useState(false);

  // Calculate example retail prices from wholesale
  const exampleRetailOz = answers.defaultPricePerLb 
    ? Math.round((answers.defaultPricePerLb / 16) * (1 + (answers.retailMarkup || 30) / 100))
    : null;
  
  const handleSubmit = () => {
    onConfirm(answers);
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="text-center space-y-2">
        <div className="flex justify-center">
          <div className="p-3 bg-emerald-500/10 rounded-full">
            <HelpCircle className="h-8 w-8 text-emerald-500" />
          </div>
        </div>
        <h3 className="text-xl font-semibold">Quick Setup</h3>
        <p className="text-muted-foreground">
          Answer a few questions to fill in missing details for {parsedProductCount} products
        </p>
      </div>

      {/* Missing Fields Indicator */}
      {missingFields.length > 0 && (
        <div className="flex flex-wrap gap-2 justify-center">
          {missingFields.map(field => (
            <Badge key={field} variant="secondary" className="text-xs">
              Missing: {field}
            </Badge>
          ))}
        </div>
      )}

      <Separator />

      {/* Core Questions */}
      <div className="space-y-8">
        {/* Category Selection */}
        <div className="space-y-3">
          <Label className="text-base font-medium flex items-center gap-2">
            <Leaf className="h-4 w-4 text-emerald-500" />
            What category are these products?
          </Label>
          <div className="grid grid-cols-4 gap-2">
            {CATEGORY_OPTIONS.map(option => (
              <Button
                key={option.value}
                type="button"
                variant={answers.category === option.value ? 'default' : 'outline'}
                className={`flex flex-col h-auto py-3 ${
                  answers.category === option.value 
                    ? 'bg-emerald-500 hover:bg-emerald-600' 
                    : ''
                }`}
                onClick={() => setAnswers(prev => ({ ...prev, category: option.value }))}
              >
                <span className="text-lg">{option.icon}</span>
                <span className="text-xs">{option.label}</span>
              </Button>
            ))}
          </div>
        </div>

        {/* Pack Meaning */}
        <div className="space-y-3">
          <Label className="text-base font-medium flex items-center gap-2">
            <Package className="h-4 w-4 text-emerald-500" />
            What does &quot;pack&quot; mean in your menu?
          </Label>
          <RadioGroup
            value={answers.packMeaning}
            onValueChange={(v) => setAnswers(prev => ({ ...prev, packMeaning: v as QuickAnswers['packMeaning'] }))}
            className="grid grid-cols-2 gap-3"
          >
            {PACK_OPTIONS.map(option => (
              <div
                key={option.value}
                className={`flex items-start space-x-3 p-3 rounded-lg border cursor-pointer transition-colors ${
                  answers.packMeaning === option.value 
                    ? 'border-emerald-500 bg-emerald-500/5' 
                    : 'border-border hover:border-emerald-500/50'
                }`}
                onClick={() => setAnswers(prev => ({ ...prev, packMeaning: option.value }))}
              >
                <RadioGroupItem value={option.value} id={`pack-${option.value}`} />
                <div className="space-y-1">
                  <Label htmlFor={`pack-${option.value}`} className="font-medium cursor-pointer">
                    {option.label}
                  </Label>
                  <p className="text-xs text-muted-foreground">{option.description}</p>
                </div>
              </div>
            ))}
          </RadioGroup>
        </div>

        {/* Quality Tier */}
        <div className="space-y-3">
          <Label className="text-base font-medium flex items-center gap-2">
            <Sparkles className="h-4 w-4 text-emerald-500" />
            Default quality tier?
          </Label>
          <RadioGroup
            value={answers.qualityTier}
            onValueChange={(v) => setAnswers(prev => ({ ...prev, qualityTier: v as QualityTier }))}
            className="grid grid-cols-2 gap-3"
          >
            {QUALITY_OPTIONS.map(option => (
              <div
                key={option.value}
                className={`flex items-start space-x-3 p-3 rounded-lg border cursor-pointer transition-colors ${
                  answers.qualityTier === option.value 
                    ? 'border-emerald-500 bg-emerald-500/5' 
                    : 'border-border hover:border-emerald-500/50'
                }`}
                onClick={() => setAnswers(prev => ({ ...prev, qualityTier: option.value }))}
              >
                <RadioGroupItem value={option.value} id={`quality-${option.value}`} />
                <div className="space-y-1">
                  <Label htmlFor={`quality-${option.value}`} className="font-medium cursor-pointer">
                    {option.label}
                  </Label>
                  <p className="text-xs text-muted-foreground">{option.description}</p>
                </div>
              </div>
            ))}
          </RadioGroup>
        </div>

        {/* Pricing Section - Most Important */}
        <Card className="border-emerald-500/50 bg-emerald-500/5">
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <DollarSign className="h-4 w-4 text-emerald-500" />
              Pricing Setup
              <Badge variant="outline" className="ml-2 text-xs">Important</Badge>
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-5">
            {/* Price Format - Critical for informal menus */}
            <div className="space-y-3 p-4 bg-amber-500/10 border border-amber-500/30 rounded-lg">
              <Label className="text-sm font-medium flex items-center gap-2">
                <span className="text-amber-600">⚡</span>
                How are prices written in your menu?
              </Label>
              <p className="text-xs text-muted-foreground">
                Most people text prices as &quot;32&quot; meaning $3,200/lb
              </p>
              <RadioGroup
                value={answers.priceFormat}
                onValueChange={(v) => setAnswers(prev => ({ ...prev, priceFormat: v as 'abbreviated' | 'full' }))}
                className="grid grid-cols-2 gap-3"
              >
                <div
                  className={`flex items-start space-x-3 p-3 rounded-lg border-2 cursor-pointer transition-all ${
                    answers.priceFormat === 'abbreviated' 
                      ? 'border-amber-500 bg-amber-500/10' 
                      : 'border-border hover:border-amber-500/50'
                  }`}
                  onClick={() => setAnswers(prev => ({ ...prev, priceFormat: 'abbreviated' }))}
                >
                  <RadioGroupItem value="abbreviated" id="price-abbrev" className="mt-1" />
                  <div className="space-y-1">
                    <Label htmlFor="price-abbrev" className="font-semibold cursor-pointer">
                      Abbreviated
                    </Label>
                    <p className="text-xs text-muted-foreground">
                      &quot;32&quot; = $3,200/lb<br />
                      &quot;18&quot; = $1,800/lb
                    </p>
                  </div>
                </div>
                <div
                  className={`flex items-start space-x-3 p-3 rounded-lg border-2 cursor-pointer transition-all ${
                    answers.priceFormat === 'full' 
                      ? 'border-amber-500 bg-amber-500/10' 
                      : 'border-border hover:border-amber-500/50'
                  }`}
                  onClick={() => setAnswers(prev => ({ ...prev, priceFormat: 'full' }))}
                >
                  <RadioGroupItem value="full" id="price-full" className="mt-1" />
                  <div className="space-y-1">
                    <Label htmlFor="price-full" className="font-semibold cursor-pointer">
                      Full Prices
                    </Label>
                    <p className="text-xs text-muted-foreground">
                      &quot;3200&quot; = $3,200/lb<br />
                      &quot;1800&quot; = $1,800/lb
                    </p>
                  </div>
                </div>
              </RadioGroup>
            </div>

            {/* Price Type - Wholesale vs Retail */}
            <div className="space-y-3">
              <Label className="text-sm font-medium">What type of prices are in your menu?</Label>
              <RadioGroup
                value={answers.priceType}
                onValueChange={(v) => setAnswers(prev => ({ ...prev, priceType: v as 'wholesale' | 'retail' }))}
                className="grid grid-cols-2 gap-3"
              >
                <div
                  className={`flex items-start space-x-3 p-4 rounded-lg border-2 cursor-pointer transition-all ${
                    answers.priceType === 'wholesale' 
                      ? 'border-emerald-500 bg-emerald-500/10' 
                      : 'border-border hover:border-emerald-500/50'
                  }`}
                  onClick={() => setAnswers(prev => ({ ...prev, priceType: 'wholesale' }))}
                >
                  <RadioGroupItem value="wholesale" id="price-wholesale" className="mt-1" />
                  <div className="space-y-1">
                    <Label htmlFor="price-wholesale" className="font-semibold cursor-pointer flex items-center gap-2">
                      <Truck className="h-4 w-4" />
                      Wholesale Prices
                    </Label>
                    <p className="text-xs text-muted-foreground">
                      B2B prices for other businesses (most common for vendor menus)
                    </p>
                  </div>
                </div>
                <div
                  className={`flex items-start space-x-3 p-4 rounded-lg border-2 cursor-pointer transition-all ${
                    answers.priceType === 'retail' 
                      ? 'border-emerald-500 bg-emerald-500/10' 
                      : 'border-border hover:border-emerald-500/50'
                  }`}
                  onClick={() => setAnswers(prev => ({ ...prev, priceType: 'retail' }))}
                >
                  <RadioGroupItem value="retail" id="price-retail" className="mt-1" />
                  <div className="space-y-1">
                    <Label htmlFor="price-retail" className="font-semibold cursor-pointer flex items-center gap-2">
                      <Store className="h-4 w-4" />
                      Retail Prices
                    </Label>
                    <p className="text-xs text-muted-foreground">
                      Consumer prices for dispensary/storefront sales
                    </p>
                  </div>
                </div>
              </RadioGroup>
            </div>

            {/* Wholesale Default Price */}
            <div className="space-y-2">
              <Label className="flex items-center gap-2">
                Default wholesale price per lb
                <span className="text-xs text-muted-foreground">(if not in your menu)</span>
              </Label>
              <div className="flex items-center gap-2">
                <span className="text-muted-foreground">$</span>
                <Input
                  type="number"
                  placeholder="e.g., 1800"
                  value={answers.defaultPricePerLb || ''}
                  onChange={(e) => setAnswers(prev => ({ 
                    ...prev, 
                    defaultPricePerLb: e.target.value ? parseInt(e.target.value) : undefined 
                  }))}
                  className="w-32"
                />
                <span className="text-sm text-muted-foreground">/ lb wholesale</span>
              </div>
            </div>

            {/* Retail Markup Calculator */}
            {answers.priceType === 'wholesale' && (
              <div className="space-y-3 p-4 bg-background rounded-lg border">
                <div className="flex items-center gap-2">
                  <Calculator className="h-4 w-4 text-emerald-500" />
                  <Label className="font-medium">Auto-Calculate Retail Prices</Label>
                </div>
                <p className="text-xs text-muted-foreground">
                  We&apos;ll calculate retail prices by adding your markup to wholesale
                </p>
                
                <div className="space-y-2">
                  <Label className="text-sm">Retail markup percentage</Label>
                  <div className="flex flex-wrap gap-2">
                    {MARKUP_PRESETS.map(preset => (
                      <Button
                        key={preset.value}
                        type="button"
                        size="sm"
                        variant={answers.retailMarkup === preset.value ? 'default' : 'outline'}
                        className={answers.retailMarkup === preset.value ? 'bg-emerald-500 hover:bg-emerald-600' : ''}
                        onClick={() => setAnswers(prev => ({ ...prev, retailMarkup: preset.value }))}
                      >
                        {preset.label}
                      </Button>
                    ))}
                    <div className="flex items-center gap-1">
                      <Input
                        type="number"
                        placeholder="Custom"
                        className="w-20 h-8"
                        value={MARKUP_PRESETS.some(p => p.value === answers.retailMarkup) ? '' : answers.retailMarkup}
                        onChange={(e) => setAnswers(prev => ({ ...prev, retailMarkup: parseInt(e.target.value) || 0 }))}
                      />
                      <span className="text-sm text-muted-foreground">%</span>
                    </div>
                  </div>
                </div>

                {/* Price Preview */}
                {answers.defaultPricePerLb && (
                  <div className="mt-3 p-3 bg-muted/50 rounded-md">
                    <p className="text-xs font-medium text-muted-foreground mb-2">Example calculation:</p>
                    <div className="grid grid-cols-2 gap-2 text-sm">
                      <div>
                        <span className="text-muted-foreground">Wholesale/lb:</span>
                        <span className="ml-2 font-mono">${answers.defaultPricePerLb}</span>
                      </div>
                      <div>
                        <span className="text-muted-foreground">Wholesale/oz:</span>
                        <span className="ml-2 font-mono">${Math.round(answers.defaultPricePerLb / 16)}</span>
                      </div>
                      <div className="text-emerald-600">
                        <span className="text-muted-foreground">Retail/lb:</span>
                        <span className="ml-2 font-mono font-semibold">
                          ${Math.round(answers.defaultPricePerLb * (1 + (answers.retailMarkup || 30) / 100))}
                        </span>
                      </div>
                      <div className="text-emerald-600">
                        <span className="text-muted-foreground">Retail/oz:</span>
                        <span className="ml-2 font-mono font-semibold">${exampleRetailOz}</span>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* Direct Retail Price Input (if retail type) */}
            {answers.priceType === 'retail' && (
              <div className="space-y-2">
                <Label>Default retail price per oz</Label>
                <div className="flex items-center gap-2">
                  <span className="text-muted-foreground">$</span>
                  <Input
                    type="number"
                    placeholder="e.g., 150"
                    value={answers.defaultRetailPricePerOz || ''}
                    onChange={(e) => setAnswers(prev => ({ 
                      ...prev, 
                      defaultRetailPricePerOz: e.target.value ? parseInt(e.target.value) : undefined 
                    }))}
                    className="w-32"
                  />
                  <span className="text-sm text-muted-foreground">/ oz retail</span>
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Quick Toggles Row */}
        <div className="grid grid-cols-2 gap-4">
          {/* Stock Status */}
          <div className="flex items-center justify-between p-4 rounded-lg border">
            <div className="space-y-0.5">
              <Label className="font-medium">All in stock?</Label>
              <p className="text-xs text-muted-foreground">
                Mark as available
              </p>
            </div>
            <Switch
              checked={answers.allInStock}
              onCheckedChange={(checked) => setAnswers(prev => ({ ...prev, allInStock: checked }))}
            />
          </div>

          {/* Lab Tested */}
          <div className="flex items-center justify-between p-4 rounded-lg border">
            <div className="space-y-0.5">
              <Label className="font-medium flex items-center gap-2">
                <FlaskConical className="h-4 w-4 text-emerald-500" />
                Lab tested?
              </Label>
              <p className="text-xs text-muted-foreground">
                COA available
              </p>
            </div>
            <Switch
              checked={answers.labTested}
              onCheckedChange={(checked) => setAnswers(prev => ({ ...prev, labTested: checked }))}
            />
          </div>
        </div>

        {/* Advanced Options Toggle */}
        <Button
          type="button"
          variant="ghost"
          size="sm"
          className="w-full"
          onClick={() => setShowAdvanced(!showAdvanced)}
        >
          {showAdvanced ? 'Hide' : 'Show'} Additional Options
        </Button>

        {/* Advanced Options */}
        {showAdvanced && (
          <Card className="border-dashed bg-muted/30">
            <CardContent className="pt-4 space-y-4">
              {/* Supplier Name */}
              <div className="space-y-2">
                <Label>Supplier / Vendor name (optional)</Label>
                <Input
                  type="text"
                  placeholder="e.g., Green Valley Farms"
                  value={answers.supplierName ?? ''}
                  onChange={(e) => setAnswers(prev => ({ 
                    ...prev, 
                    supplierName: e.target.value || undefined 
                  }))}
                  className="w-full"
                />
                <p className="text-xs text-muted-foreground">
                  Tag all imported products with this supplier
                </p>
              </div>

              {/* Min Order */}
              <div className="space-y-2">
                <Label>Minimum order quantity</Label>
                <Input
                  type="number"
                  placeholder="Optional"
                  value={answers.minOrderQuantity || ''}
                  onChange={(e) => setAnswers(prev => ({ 
                    ...prev, 
                    minOrderQuantity: e.target.value ? parseInt(e.target.value) : undefined 
                  }))}
                  className="w-32"
                />
              </div>

              {/* Notes */}
              <div className="space-y-2">
                <Label>Import notes (optional)</Label>
                <Textarea
                  placeholder="Any notes about this batch..."
                  value={answers.notes ?? ''}
                  onChange={(e) => setAnswers(prev => ({ 
                    ...prev, 
                    notes: e.target.value || undefined 
                  }))}
                  className="h-20"
                />
              </div>
            </CardContent>
          </Card>
        )}
      </div>

      <Separator />

      {/* Actions */}
      <div className="flex justify-between">
        <Button variant="ghost" onClick={onBack}>
          Back
        </Button>
        <Button onClick={handleSubmit} className="bg-emerald-500 hover:bg-emerald-600 gap-2">
          Continue to Preview
          <ArrowRight className="h-4 w-4" />
        </Button>
      </div>
    </div>
  );
}

