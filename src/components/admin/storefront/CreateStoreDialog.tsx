import { useState, useCallback, useEffect } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Store, AlertCircle, CheckCircle2, Loader2, ArrowLeft, ArrowRight, Coins } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useDebounce } from '@/hooks/useDebounce';
import { logger } from '@/lib/logger';
import { PresetPackSelector } from '@/components/admin/storefront/PresetPackSelector';
import { getPresetById, getPresetTheme } from '@/lib/storefrontPresets';
import { cn } from '@/lib/utils';
import { CreditCostIndicator } from '@/components/credits/CreditCostBadge';

export interface CreateStoreSubmitData {
  storeName: string;
  slug: string;
  tagline: string;
  presetId: string;
}

interface CreateStoreDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSubmit: (data: CreateStoreSubmitData) => void;
  isCreating?: boolean;
  defaultStoreName?: string;
}

const SLUG_REGEX = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

function generateSlug(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-+|-+$/g, '');
}

function getSlugFormatError(slug: string): string | null {
  if (slug.length < 3) return 'Slug must be at least 3 characters';
  if (!SLUG_REGEX.test(slug)) return 'Only lowercase letters, numbers, and hyphens allowed';
  return null;
}

type WizardStep = 'template' | 'details';

export function CreateStoreDialog({
  open,
  onOpenChange,
  onSubmit,
  isCreating = false,
  defaultStoreName = '',
}: CreateStoreDialogProps) {
  const [step, setStep] = useState<WizardStep>('template');
  const [selectedPresetId, setSelectedPresetId] = useState<string | null>(null);
  const [storeName, setStoreName] = useState(defaultStoreName);
  const [slug, setSlug] = useState(generateSlug(defaultStoreName));
  const [tagline, setTagline] = useState('');
  const [slugEdited, setSlugEdited] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [slugError, setSlugError] = useState<string | null>(null);
  const [isValidatingSlug, setIsValidatingSlug] = useState(false);
  const [slugAvailable, setSlugAvailable] = useState(false);

  const debouncedSlug = useDebounce(slug, 500);

  // Validate slug uniqueness when debounced value changes
  useEffect(() => {
    if (!debouncedSlug) {
      setSlugError(null);
      setSlugAvailable(false);
      return;
    }

    const formatError = getSlugFormatError(debouncedSlug);
    if (formatError) {
      setSlugError(formatError);
      setSlugAvailable(false);
      return;
    }

    let cancelled = false;
    setIsValidatingSlug(true);

    (async () => {
      try {
        const { data, error } = await supabase
          .from('marketplace_stores')
          .select('id')
          .eq('slug', debouncedSlug)
          .maybeSingle();

        if (cancelled) return;
        if (error) throw error;

        if (data) {
          setSlugError('This slug is already taken');
          setSlugAvailable(false);
        } else {
          setSlugError(null);
          setSlugAvailable(true);
        }
      } catch (err) {
        if (cancelled) return;
        logger.error('Failed to validate slug', err);
        setSlugError('Failed to check availability');
        setSlugAvailable(false);
      } finally {
        if (!cancelled) setIsValidatingSlug(false);
      }
    })();

    return () => { cancelled = true; };
  }, [debouncedSlug]);

  const handleStoreNameChange = (value: string) => {
    setStoreName(value);
    if (!slugEdited) {
      const newSlug = generateSlug(value);
      setSlug(newSlug);
      setSlugAvailable(false);
    }
  };

  const handleSlugChange = (value: string) => {
    const sanitized = value.toLowerCase().replace(/[^a-z0-9-]/g, '');
    setSlug(sanitized);
    setSlugEdited(true);
    setSlugAvailable(false);
  };

  const handleSubmit = useCallback((e: React.FormEvent) => {
    e.preventDefault();
    setSubmitted(true);

    if (!storeName.trim() || !slug.trim() || !selectedPresetId) return;

    const formatError = getSlugFormatError(slug);
    if (formatError || slugError || isValidatingSlug) return;

    onSubmit({
      storeName: storeName.trim(),
      slug: slug.trim(),
      tagline: tagline.trim(),
      presetId: selectedPresetId,
    });
  }, [storeName, slug, tagline, selectedPresetId, slugError, isValidatingSlug, onSubmit]);

  const resetState = () => {
    setStep('template');
    setSelectedPresetId(null);
    setStoreName(defaultStoreName);
    setSlug(generateSlug(defaultStoreName));
    setTagline('');
    setSlugEdited(false);
    setSubmitted(false);
    setSlugError(null);
    setIsValidatingSlug(false);
    setSlugAvailable(false);
  };

  const handleOpenChange = (newOpen: boolean) => {
    if (!newOpen) {
      resetState();
    }
    onOpenChange(newOpen);
  };

  const handleNextStep = () => {
    if (step === 'template' && selectedPresetId) {
      setStep('details');
      // Pre-fill tagline from preset if empty
      if (!tagline.trim()) {
        const preset = getPresetById(selectedPresetId);
        if (preset) {
          setTagline(preset.tagline);
        }
      }
    }
  };

  const handleBackStep = () => {
    if (step === 'details') {
      setStep('template');
      setSubmitted(false);
    }
  };

  const hasSlugError = !!slugError || (submitted && !slug.trim());
  const isSlugChecking = isValidatingSlug || (slug !== debouncedSlug && slug.length >= 3);

  const selectedPreset = selectedPresetId ? getPresetById(selectedPresetId) : undefined;
  const selectedTheme = selectedPreset ? getPresetTheme(selectedPreset) : undefined;

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className={cn(
        'transition-all duration-200',
        step === 'template' ? 'sm:max-w-4xl' : 'sm:max-w-md'
      )}>
        <DialogHeader>
          <div className="flex items-center gap-2">
            <Store className="h-5 w-5 text-primary" />
            <DialogTitle>
              {step === 'template' ? 'Choose a Template' : 'Store Details'}
            </DialogTitle>
          </div>
          <DialogDescription>
            {step === 'template'
              ? 'Pick a starting template for your storefront. You can customize everything later.'
              : 'Name your store and set up its URL.'}
          </DialogDescription>
        </DialogHeader>

        {/* Step indicator */}
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <span className={cn(
            'inline-flex items-center justify-center w-6 h-6 rounded-full text-xs font-medium',
            step === 'template'
              ? 'bg-primary text-primary-foreground'
              : 'bg-muted text-muted-foreground'
          )}>
            1
          </span>
          <span className={step === 'template' ? 'font-medium text-foreground' : ''}>
            Template
          </span>
          <div className="w-8 h-px bg-border" />
          <span className={cn(
            'inline-flex items-center justify-center w-6 h-6 rounded-full text-xs font-medium',
            step === 'details'
              ? 'bg-primary text-primary-foreground'
              : 'bg-muted text-muted-foreground'
          )}>
            2
          </span>
          <span className={step === 'details' ? 'font-medium text-foreground' : ''}>
            Details
          </span>
        </div>

        {/* Step 1: Template Selection */}
        {step === 'template' && (
          <div className="py-2">
            <PresetPackSelector
              selectedPresetId={selectedPresetId}
              onSelectPreset={(id) => setSelectedPresetId(id)}
            />
            <DialogFooter className="mt-6">
              <Button
                type="button"
                variant="outline"
                onClick={() => handleOpenChange(false)}
              >
                Cancel
              </Button>
              <Button
                type="button"
                onClick={handleNextStep}
                disabled={!selectedPresetId}
              >
                Next
                <ArrowRight className="w-4 h-4 ml-1" />
              </Button>
            </DialogFooter>
          </div>
        )}

        {/* Step 2: Store Details */}
        {step === 'details' && (
          <form onSubmit={handleSubmit} className="space-y-4">
            {/* Selected template preview */}
            {selectedPreset && selectedTheme && (
              <div className="flex items-center gap-3 p-3 rounded-lg border bg-muted/30">
                <div
                  className="w-10 h-10 rounded-lg shrink-0"
                  style={{
                    background: selectedTheme.darkMode
                      ? `linear-gradient(135deg, ${selectedTheme.colors.background}, ${selectedTheme.colors.primary}40)`
                      : `linear-gradient(135deg, ${selectedTheme.colors.primary}, ${selectedTheme.colors.accent})`,
                  }}
                />
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium">{selectedPreset.name}</p>
                  <p className="text-xs text-muted-foreground truncate">{selectedPreset.tagline}</p>
                </div>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={handleBackStep}
                  className="text-xs shrink-0"
                >
                  Change
                </Button>
              </div>
            )}

            <div className="space-y-2">
              <Label htmlFor="store-name">Store Name <span className="text-destructive ml-0.5" aria-hidden="true">*</span></Label>
              <Input
                id="store-name"
                value={storeName}
                onChange={(e) => handleStoreNameChange(e.target.value)}
                placeholder="My Awesome Store"
                disabled={isCreating}
                autoFocus
                required
              />
              {submitted && !storeName.trim() && (
                <p className="text-sm text-destructive">Store name is required</p>
              )}
            </div>
            <div className="space-y-2">
              <Label htmlFor="store-slug">Store URL <span className="text-destructive ml-0.5" aria-hidden="true">*</span></Label>
              <div className="flex items-center gap-2">
                <span className="text-sm text-muted-foreground">/shop/</span>
                <Input
                  id="store-slug"
                  value={slug}
                  onChange={(e) => handleSlugChange(e.target.value)}
                  placeholder="my-store"
                  disabled={isCreating}
                  className="flex-1"
                />
              </div>
              {hasSlugError && (
                <p className="text-sm text-destructive flex items-center gap-1">
                  <AlertCircle className="w-3 h-3 shrink-0" />
                  {slugError ?? 'Store URL is required'}
                </p>
              )}
              {isSlugChecking && (
                <p className="text-sm text-muted-foreground flex items-center gap-1">
                  <Loader2 className="w-3 h-3 animate-spin" />
                  Checking availability...
                </p>
              )}
              {slugAvailable && !isSlugChecking && slug.length >= 3 && (
                <p className="text-sm text-green-600 flex items-center gap-1">
                  <CheckCircle2 className="w-3 h-3" />
                  Slug is available
                </p>
              )}
              {slug.trim() ? (
                <p className="text-xs text-muted-foreground">
                  Your store URL: <span className="font-medium text-foreground">/shop/{slug}</span>
                </p>
              ) : (
                <p className="text-xs text-muted-foreground">
                  Type a store name to auto-generate the URL
                </p>
              )}
            </div>
            <div className="space-y-2">
              <Label htmlFor="store-tagline">Tagline (Optional)</Label>
              <Textarea
                id="store-tagline"
                value={tagline}
                onChange={(e) => setTagline(e.target.value)}
                placeholder="Welcome to our amazing store"
                rows={2}
                disabled={isCreating}
              />
            </div>
            {/* Credit cost warning */}
            <CreditCostIndicator actionKey="storefront_create" className="rounded-lg" />

            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={handleBackStep}
                disabled={isCreating}
              >
                <ArrowLeft className="w-4 h-4 mr-1" />
                Back
              </Button>
              <Button
                type="submit"
                disabled={!storeName.trim() || !slug.trim() || !!slugError || isSlugChecking || isCreating}
              >
                {isCreating && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                {isCreating ? 'Creating...' : (
                  <span className="inline-flex items-center gap-1.5">
                    Create Store
                    <Coins className="h-3.5 w-3.5" />
                    <span className="text-xs opacity-80">500</span>
                  </span>
                )}
              </Button>
            </DialogFooter>
          </form>
        )}
      </DialogContent>
    </Dialog>
  );
}
