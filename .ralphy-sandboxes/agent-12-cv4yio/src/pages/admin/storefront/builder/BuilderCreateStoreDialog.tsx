/**
 * BuilderCreateStoreDialog
 * Dialog for creating a new storefront with slug validation
 */

import { AlertCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';

interface BuilderCreateStoreDialogProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    storeName: string;
    onStoreNameChange: (name: string) => void;
    storeSlug: string;
    onStoreSlugChange: (slug: string) => void;
    slugError: string | null;
    onSlugErrorChange: (error: string | null) => void;
    isValidatingSlug: boolean;
    generateSlug: (name: string) => string;
    validateSlug: (slug: string) => Promise<boolean>;
    onSubmit: () => void;
    isSubmitting: boolean;
}

export function BuilderCreateStoreDialog({
    open,
    onOpenChange,
    storeName,
    onStoreNameChange,
    storeSlug,
    onStoreSlugChange,
    slugError,
    onSlugErrorChange,
    isValidatingSlug,
    generateSlug,
    validateSlug,
    onSubmit,
    isSubmitting,
}: BuilderCreateStoreDialogProps) {
    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="sm:max-w-[425px]">
                <DialogHeader>
                    <DialogTitle>Create Your Storefront</DialogTitle>
                    <DialogDescription>
                        Create a new white-label storefront. This will deduct 500 credits from your account.
                    </DialogDescription>
                </DialogHeader>
                <div className="grid gap-4 py-4">
                    <div className="space-y-2">
                        <Label htmlFor="store-name">Store Name</Label>
                        <Input
                            id="store-name"
                            placeholder="My Awesome Store"
                            value={storeName}
                            onChange={(e) => {
                                onStoreNameChange(e.target.value);
                                onStoreSlugChange(generateSlug(e.target.value));
                                onSlugErrorChange(null);
                            }}
                        />
                    </div>
                    <div className="space-y-2">
                        <Label htmlFor="store-slug">Store URL Slug</Label>
                        <div className="flex items-center gap-2">
                            <span className="text-sm text-muted-foreground">/shop/</span>
                            <Input
                                id="store-slug"
                                placeholder="my-awesome-store"
                                value={storeSlug}
                                onChange={(e) => {
                                    onStoreSlugChange(e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, ''));
                                    onSlugErrorChange(null);
                                }}
                                onBlur={() => {
                                    if (storeSlug) {
                                        validateSlug(storeSlug);
                                    }
                                }}
                                className="flex-1"
                            />
                        </div>
                        {slugError && (
                            <p className="text-sm text-destructive flex items-center gap-1">
                                <AlertCircle className="w-3 h-3" />
                                {slugError}
                            </p>
                        )}
                        {isValidatingSlug && (
                            <p className="text-sm text-muted-foreground">Checking availability...</p>
                        )}
                    </div>
                </div>
                <DialogFooter>
                    <Button variant="outline" onClick={() => onOpenChange(false)}>
                        Cancel
                    </Button>
                    <Button
                        onClick={onSubmit}
                        disabled={!storeName || !storeSlug || isValidatingSlug || isSubmitting}
                    >
                        {isSubmitting ? 'Creating...' : 'Create Store (500 credits)'}
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}
