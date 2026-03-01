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
import { Store, AlertCircle, CheckCircle2, Loader2 } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useDebounce } from '@/hooks/useDebounce';
import { logger } from '@/lib/logger';

interface CreateStoreDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSubmit: (data: { storeName: string; slug: string; tagline: string }) => void;
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

export function CreateStoreDialog({
  open,
  onOpenChange,
  onSubmit,
  isCreating = false,
  defaultStoreName = '',
}: CreateStoreDialogProps) {
  const [storeName, setStoreName] = useState(defaultStoreName);
  const [slug, setSlug] = useState(generateSlug(defaultStoreName));
  const [tagline, setTagline] = useState('');
  const [slugEdited, setSlugEdited] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [slugError, setSlugError] = useState<string | null>(null);
  const [isValidatingSlug, setIsValidatingSlug] = useState(false);
  const [slugAvailable, setSlugAvailable] = useState(false);

  const debouncedSlug = useDebounce(slug, 400);

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

    if (!storeName.trim() || !slug.trim()) return;

    const formatError = getSlugFormatError(slug);
    if (formatError || slugError || isValidatingSlug) return;

    onSubmit({
      storeName: storeName.trim(),
      slug: slug.trim(),
      tagline: tagline.trim(),
    });
  }, [storeName, slug, tagline, slugError, isValidatingSlug, onSubmit]);

  const handleOpenChange = (newOpen: boolean) => {
    if (!newOpen) {
      setStoreName(defaultStoreName);
      setSlug(generateSlug(defaultStoreName));
      setTagline('');
      setSlugEdited(false);
      setSubmitted(false);
      setSlugError(null);
      setIsValidatingSlug(false);
      setSlugAvailable(false);
    }
    onOpenChange(newOpen);
  };

  const hasSlugError = !!slugError || (submitted && !slug.trim());
  const isSlugChecking = isValidatingSlug || (slug !== debouncedSlug && slug.length >= 3);

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <div className="flex items-center gap-2">
            <Store className="h-5 w-5 text-primary" />
            <DialogTitle>Create New Store</DialogTitle>
          </div>
          <DialogDescription>
            Set up a new storefront for your business.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="store-name">Store Name <span className="text-destructive ml-0.5" aria-hidden="true">*</span></Label>
            <Input
              id="store-name"
              value={storeName}
              onChange={(e) => handleStoreNameChange(e.target.value)}
              placeholder="My Awesome Store"
              disabled={isCreating}
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
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => handleOpenChange(false)}
              disabled={isCreating}
            >
              Cancel
            </Button>
            <Button
              type="submit"
              disabled={!storeName.trim() || !slug.trim() || !!slugError || isSlugChecking || isCreating}
            >
              {isCreating ? 'Creating...' : 'Create Store'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
