import { useState } from 'react';
import { Drawer, DrawerContent, DrawerHeader, DrawerTitle, DrawerDescription, DrawerFooter } from '@/components/ui/drawer';
import { Button } from '@/components/ui/button';
import { BarcodeScanner } from '@/components/mobile/BarcodeScanner';
import { Scan, Plus, Minus, ShoppingCart } from 'lucide-react';
import { toast } from 'sonner';

interface Product {
    id: string;
    name: string;
    price: number;
    sku: string;
    image?: string;
}

export function ProductDrawer() {
    const [isOpen, setIsOpen] = useState(false);
    const [isScannerOpen, setIsScannerOpen] = useState(false);
    const [scannedProduct, setScannedProduct] = useState<Product | null>(null);
    const [quantity, setQuantity] = useState(1);

    // Mock product lookup
    const lookupProduct = (code: string) => {
        // Simulate API call
        setTimeout(() => {
            setScannedProduct({
                id: '123',
                name: 'Premium Cannabis Oil',
                price: 45.00,
                sku: code,
                image: '/placeholder.png'
            });
            setIsOpen(true);
            setIsScannerOpen(false);
            toast.success('Product found!');
        }, 500);
    };

    const handleScan = (code: string) => {
        lookupProduct(code);
    };

    const handleAddToCart = () => {
        toast.success(`Added ${quantity} x ${scannedProduct?.name} to cart`);
        setIsOpen(false);
        setQuantity(1);
        setScannedProduct(null);
    };

    return (
        <>
            <Button onClick={() => setIsScannerOpen(true)} className="w-full gap-2">
                <Scan className="w-4 h-4" />
                Scan Product
            </Button>

            <BarcodeScanner
                open={isScannerOpen}
                onClose={() => setIsScannerOpen(false)}
                onScan={handleScan}
            />

            <Drawer open={isOpen} onOpenChange={setIsOpen}>
                <DrawerContent>
                    <div className="mx-auto w-full max-w-sm">
                        <DrawerHeader>
                            <DrawerTitle>{scannedProduct?.name}</DrawerTitle>
                            <DrawerDescription>SKU: {scannedProduct?.sku}</DrawerDescription>
                        </DrawerHeader>

                        <div className="p-4 pb-0">
                            <div className="flex items-center justify-center space-x-2">
                                <Button
                                    variant="outline"
                                    size="icon"
                                    onClick={() => setQuantity(Math.max(1, quantity - 1))}
                                    disabled={quantity <= 1}
                                    className="h-8 w-8 rounded-full"
                                >
                                    <Minus className="h-4 w-4" />
                                    <span className="sr-only">Decrease</span>
                                </Button>
                                <div className="flex-1 text-center">
                                    <div className="text-5xl font-bold tracking-tighter">
                                        {quantity}
                                    </div>
                                    <div className="text-[0.70rem] uppercase text-muted-foreground">
                                        Quantity
                                    </div>
                                </div>
                                <Button
                                    variant="outline"
                                    size="icon"
                                    onClick={() => setQuantity(quantity + 1)}
                                    className="h-8 w-8 rounded-full"
                                >
                                    <Plus className="h-4 w-4" />
                                    <span className="sr-only">Increase</span>
                                </Button>
                            </div>
                            <div className="mt-3 h-[120px] w-full rounded-md border border-dashed flex items-center justify-center bg-muted/50">
                                Product Image Placeholder
                            </div>
                        </div>

                        <DrawerFooter>
                            <Button onClick={handleAddToCart} className="w-full">
                                <ShoppingCart className="mr-2 h-4 w-4" />
                                Add to Cart - ${(scannedProduct?.price ?? 0) * quantity}
                            </Button>
                            <Button variant="outline" onClick={() => setIsOpen(false)}>
                                Cancel
                            </Button>
                        </DrawerFooter>
                    </div>
                </DrawerContent>
            </Drawer>
        </>
    );
}
