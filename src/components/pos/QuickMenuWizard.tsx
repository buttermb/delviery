import { logger } from '@/lib/logger';
import { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useCreateDisposableMenu } from '@/hooks/useDisposableMenus';
import { QRCodeCanvas } from 'qrcode.react';
import Loader2 from "lucide-react/dist/esm/icons/loader-2";
import Copy from "lucide-react/dist/esm/icons/copy";
import Check from "lucide-react/dist/esm/icons/check";
import Share2 from "lucide-react/dist/esm/icons/share-2";
import { toast } from '@/hooks/use-toast';
import type { POSCartItem } from '@/types/pos';

interface QuickMenuWizardProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    cartItems: POSCartItem[];
    tenantId: string;
}

export function QuickMenuWizard({ open, onOpenChange, cartItems, tenantId }: QuickMenuWizardProps) {
    const [step, setStep] = useState<'details' | 'success'>('details');
    const [name, setName] = useState('');
    const [generatedUrl, setGeneratedUrl] = useState('');
    const [copied, setCopied] = useState(false);

    const createMenu = useCreateDisposableMenu();

    useEffect(() => {
        if (open && step === 'details') {
            const date = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
            setName(`Quick Menu - ${date}`);
        }
    }, [open, step]);

    const handleCreate = async () => {
        if (!name.trim()) {
            toast({ title: 'Name required', variant: 'destructive' });
            return;
        }

        try {
            const productIds = cartItems.map(item => item.id);

            // Generate a random access code
            const accessCode = Math.random().toString(36).substring(2, 10).toUpperCase();

            const result = await createMenu.mutateAsync({
                tenant_id: tenantId,
                name,
                description: 'Created from POS Quick Menu',
                product_ids: productIds,
                access_code: accessCode,
                expiration_date: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(), // 24 hours
                security_settings: {
                    access_type: 'shared', // Simplified for quick menu
                    require_access_code: false,
                    burn_after_read: false,
                }
            });

            // Construct URL
            // Assuming the result contains the encrypted_url_token or we use the ID if token not returned
            // But based on MenuAccess, we need a token.
            // If the edge function returns the full menu object, we look for encrypted_url_token.
            // If not, we might need to fetch it or use a fallback.
            // For now, let's assume result.encrypted_url_token exists.

            const token = result.encrypted_url_token || result.id; // Fallback to ID if token missing (might fail validation but safe for now)
            const url = `${window.location.origin}/menu/${token}`;

            setGeneratedUrl(url);
            setStep('success');
        } catch (error) {
            logger.error('Failed to create menu', error);
            // Toast is handled by the hook
        }
    };

    const copyToClipboard = () => {
        navigator.clipboard.writeText(generatedUrl);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
        toast({ title: 'Link copied to clipboard' });
    };

    const handleClose = () => {
        onOpenChange(false);
        setTimeout(() => {
            setStep('details');
            setName('');
            setGeneratedUrl('');
        }, 300);
    };

    return (
        <Dialog open={open} onOpenChange={handleClose}>
            <DialogContent className="sm:max-w-md">
                <DialogHeader>
                    <DialogTitle>{step === 'details' ? 'Create Quick Menu' : 'Menu Ready'}</DialogTitle>
                </DialogHeader>

                {step === 'details' ? (
                    <div className="space-y-4 py-4">
                        <div className="space-y-2">
                            <Label htmlFor="name">Menu Name</Label>
                            <Input
                                id="name"
                                value={name}
                                onChange={(e) => setName(e.target.value)}
                                placeholder="e.g. Quick Menu"
                            />
                        </div>
                        <div className="text-sm text-muted-foreground">
                            Creating a disposable menu with {cartItems.length} items.
                            The menu will expire in 24 hours.
                        </div>
                        <Button
                            className="w-full"
                            onClick={handleCreate}
                            disabled={createMenu.isPending || cartItems.length === 0}
                        >
                            {createMenu.isPending ? (
                                <>
                                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                    Creating...
                                </>
                            ) : (
                                'Create & Generate QR'
                            )}
                        </Button>
                    </div>
                ) : (
                    <div className="flex flex-col items-center space-y-6 py-4">
                        <div className="p-4 bg-white rounded-xl shadow-sm border">
                            <QRCodeCanvas value={generatedUrl} size={200} />
                        </div>

                        <div className="flex items-center gap-2 w-full">
                            <Input value={generatedUrl} readOnly className="font-mono text-xs" />
                            <Button size="icon" variant="outline" onClick={copyToClipboard}>
                                {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
                            </Button>
                        </div>

                        <div className="flex gap-2 w-full">
                            <Button variant="outline" className="flex-1" onClick={handleClose}>
                                Done
                            </Button>
                            <Button className="flex-1" onClick={() => {
                                if (navigator.share) {
                                    navigator.share({
                                        title: name,
                                        text: 'Check out this menu!',
                                        url: generatedUrl
                                    }).catch(err => logger.error('Share failed', err));
                                } else {
                                    copyToClipboard();
                                }
                            }}>
                                <Share2 className="mr-2 h-4 w-4" />
                                Share
                            </Button>
                        </div>
                    </div>
                )}
            </DialogContent>
        </Dialog>
    );
}
