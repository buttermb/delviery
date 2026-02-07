import { useState } from 'react';
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
import { Store } from 'lucide-react';

interface CreateStoreDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSubmit: (data: { storeName: string; slug: string; tagline: string }) => void;
  isCreating?: boolean;
  defaultStoreName?: string;
}

function generateSlug(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .trim();
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

  const handleStoreNameChange = (value: string) => {
    setStoreName(value);
    if (!slugEdited) {
      setSlug(generateSlug(value));
    }
  };

  const handleSlugChange = (value: string) => {
    setSlug(generateSlug(value));
    setSlugEdited(true);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (storeName.trim() && slug.trim()) {
      onSubmit({
        storeName: storeName.trim(),
        slug: slug.trim(),
        tagline: tagline.trim(),
      });
    }
  };

  const handleOpenChange = (newOpen: boolean) => {
    if (!newOpen) {
      setStoreName(defaultStoreName);
      setSlug(generateSlug(defaultStoreName));
      setTagline('');
      setSlugEdited(false);
    }
    onOpenChange(newOpen);
  };

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
            <Label htmlFor="store-name">Store Name *</Label>
            <Input
              id="store-name"
              value={storeName}
              onChange={(e) => handleStoreNameChange(e.target.value)}
              placeholder="My Awesome Store"
              disabled={isCreating}
              required
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="store-slug">Store URL</Label>
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
            <p className="text-xs text-muted-foreground">
              This will be your store's unique URL path
            </p>
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
            <Button type="submit" disabled={!storeName.trim() || !slug.trim() || isCreating}>
              {isCreating ? 'Creating...' : 'Create Store'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
