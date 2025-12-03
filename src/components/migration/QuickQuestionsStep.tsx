/**
 * Quick Questions Step for Menu Migration
 * Asks essential questions to fill in missing data before import
 */

import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
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
  CheckCircle,
  Info,
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
    category: suggestedDefaults?.category || 'flower',
    packMeaning: suggestedDefaults?.packMeaning || 'lb',
    qualityTier: suggestedDefaults?.qualityTier || 'indoor',
    priceType: suggestedDefaults?.priceType || 'wholesale',
    retailMarkup: suggestedDefaults?.retailMarkup || 30,
    defaultPricePerLb: suggestedDefaults?.defaultPricePerLb,
    allInStock: suggestedDefaults?.allInStock ?? true,
    minOrderQuantity: suggestedDefaults?.minOrderQuantity,
  });

  const [showAdvanced, setShowAdvanced] = useState(false);

  // Questions to show based on missing fields
  const needsCategory = missingFields.includes('category');
  const needsQuality = missingFields.includes('qualityTier');
  const needsPrice = missingFields.includes('price');
  const needsQuantity = missingFields.includes('quantity');

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

        {/* Pricing Section */}
        <Card className="border-dashed">
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <DollarSign className="h-4 w-4 text-emerald-500" />
              Pricing
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* Price Type */}
            <div className="flex items-center justify-between">
              <div className="space-y-0.5">
                <Label>Are these wholesale or retail prices?</Label>
                <p className="text-xs text-muted-foreground">
                  Most vendor menus show wholesale prices
                </p>
              </div>
              <Select
                value={answers.priceType}
                onValueChange={(v) => setAnswers(prev => ({ ...prev, priceType: v as 'wholesale' | 'retail' }))}
              >
                <SelectTrigger className="w-32">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="wholesale">Wholesale</SelectItem>
                  <SelectItem value="retail">Retail</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Retail Markup */}
            {answers.priceType === 'wholesale' && (
              <div className="space-y-2">
                <Label>Retail markup percentage</Label>
                <p className="text-xs text-muted-foreground">
                  Auto-calculate retail prices from wholesale
                </p>
                <div className="flex gap-2">
                  {MARKUP_PRESETS.map(preset => (
                    <Button
                      key={preset.value}
                      type="button"
                      size="sm"
                      variant={answers.retailMarkup === preset.value ? 'default' : 'outline'}
                      className={answers.retailMarkup === preset.value ? 'bg-emerald-500' : ''}
                      onClick={() => setAnswers(prev => ({ ...prev, retailMarkup: preset.value }))}
                    >
                      {preset.label}
                    </Button>
                  ))}
                  <Input
                    type="number"
                    placeholder="Custom %"
                    className="w-24"
                    value={MARKUP_PRESETS.some(p => p.value === answers.retailMarkup) ? '' : answers.retailMarkup}
                    onChange={(e) => setAnswers(prev => ({ ...prev, retailMarkup: parseInt(e.target.value) || 0 }))}
                  />
                </div>
              </div>
            )}

            {/* Default Price */}
            <div className="space-y-2">
              <Label>Default price per lb (if not detected)</Label>
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
                <span className="text-sm text-muted-foreground">/ lb</span>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Stock Status */}
        <div className="flex items-center justify-between p-4 rounded-lg border">
          <div className="space-y-0.5">
            <Label className="font-medium">Is everything in stock?</Label>
            <p className="text-xs text-muted-foreground">
              Mark all imported products as available
            </p>
          </div>
          <Switch
            checked={answers.allInStock}
            onCheckedChange={(checked) => setAnswers(prev => ({ ...prev, allInStock: checked }))}
          />
        </div>

        {/* Advanced Options Toggle */}
        <Button
          type="button"
          variant="ghost"
          size="sm"
          className="w-full"
          onClick={() => setShowAdvanced(!showAdvanced)}
        >
          {showAdvanced ? 'Hide' : 'Show'} Advanced Options
        </Button>

        {/* Advanced Options */}
        {showAdvanced && (
          <Card className="border-dashed bg-muted/30">
            <CardContent className="pt-4 space-y-4">
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

