/**
 * BuilderCreateStore
 * Empty state UI for when a tenant has no storefront yet.
 */

import { Store, Loader2, AlertCircle, CheckCircle2 } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { ThemePresetStrip } from '@/components/admin/storefront/ThemePresetSelector';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { type ThemePreset } from '@/lib/storefrontThemes';

interface BuilderCreateStoreProps {
    newStoreName: string;
    setNewStoreName: (val: string) => void;
    newStoreSlug: string;
    setNewStoreSlug: (val: string) => void;
    slugError: string | null;
    isSlugChecking: boolean;
    slugAvailable: boolean;
    setSlugAvailable: (val: boolean) => void;
    generateSlug: (name: string) => string;
    handleThemeSelect: (theme: ThemePreset) => void;
    selectedThemeId: string | undefined;
    handleCreateStore: () => void;
    isCreatingWithCredits: boolean;
    isCreatePending: boolean;
    isDialog?: boolean;
    open?: boolean;
    onOpenChange?: (open: boolean) => void;
}

export function BuilderCreateStore({
    newStoreName,
    setNewStoreName,
    newStoreSlug,
    setNewStoreSlug,
    slugError,
    isSlugChecking,
    slugAvailable,
    setSlugAvailable,
    generateSlug,
    handleThemeSelect,
    selectedThemeId,
    handleCreateStore,
    isCreatingWithCredits,
    isCreatePending,
    isDialog = false,
    open,
    onOpenChange,
}: BuilderCreateStoreProps) {
    const isCreateDisabled = !newStoreName || !newStoreSlug || !!slugError || isSlugChecking || isCreatingWithCredits || isCreatePending;

    const commonForm = (
        <div className="space-y-4">
            <div className="space-y-2">
                <Label htmlFor="store-name">Store Name</Label>
                <Input
                    id="store-name"
                    placeholder="My Awesome Store"
                    value={newStoreName}
                    onChange={(e) => {
                        setNewStoreName(e.target.value);
                        setNewStoreSlug(generateSlug(e.target.value));
                        setSlugAvailable(false);
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
                        value={newStoreSlug}
                        onChange={(e) => {
                            setNewStoreSlug(e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, ''));
                            setSlugAvailable(false);
                        }}
                        className="flex-1"
                    />
                </div>
                {slugError && (
                    <p className="text-sm text-destructive flex items-center gap-1">
                        <AlertCircle className="w-3 h-3 shrink-0" />
                        {slugError}
                    </p>
                )}
                {isSlugChecking && (
                    <p className="text-sm text-muted-foreground flex items-center gap-1">
                        <Loader2 className="w-3 h-3 animate-spin" />
                        Checking availability...
                    </p>
                )}
                {slugAvailable && !isSlugChecking && newStoreSlug.length >= 3 && (
                    <p className="text-sm text-green-600 flex items-center gap-1">
                        <CheckCircle2 className="w-3 h-3" />
                        Slug is available
                    </p>
                )}
            </div>
        </div>
    );

    if (isDialog) {
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
                        {commonForm}
                    </div>
                    <DialogFooter>
                        <Button variant="outline" onClick={() => onOpenChange?.(false)}>
                            Cancel
                        </Button>
                        <Button onClick={handleCreateStore} disabled={isCreateDisabled}>
                            {(isCreatingWithCredits || isCreatePending) && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                            {isCreatingWithCredits || isCreatePending ? 'Creating...' : 'Create Store (500 credits)'}
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        );
    }

    // Full page layout
    return (
        <div className="flex-1 flex items-center justify-center p-6">
            <Card className="w-full max-w-md">
                <CardContent className="pt-6 space-y-6">
                    <div className="flex flex-col items-center text-center space-y-2">
                        <div className="h-12 w-12 rounded-full bg-primary/10 flex items-center justify-center">
                            <Store className="h-6 w-6 text-primary" />
                        </div>
                        <h2 className="text-xl font-semibold">Create Your Store</h2>
                        <p className="text-sm text-muted-foreground">
                            Set up your white-label storefront to start selling to customers.
                        </p>
                    </div>
                    <div className="space-y-4">
                        {commonForm}
                        <div className="space-y-2">
                            <Label>Theme</Label>
                            <ThemePresetStrip
                                onSelectTheme={handleThemeSelect}
                                selectedThemeId={selectedThemeId}
                            />
                        </div>
                    </div>
                    <Button
                        className="w-full"
                        onClick={handleCreateStore}
                        disabled={isCreateDisabled}
                    >
                        {(isCreatingWithCredits || isCreatePending) && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                        {isCreatingWithCredits || isCreatePending ? 'Creating...' : 'Create Store (500 credits)'}
                    </Button>
                </CardContent>
            </Card>
        </div>
    );
}
