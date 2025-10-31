import { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Checkbox } from '@/components/ui/checkbox';
import { useWholesaleInventory } from '@/hooks/useWholesaleData';
import { useCreateDisposableMenu } from '@/hooks/useDisposableMenus';
import { Loader2 } from 'lucide-react';

interface CreateMenuDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export const CreateMenuDialog = ({ open, onOpenChange }: CreateMenuDialogProps) => {
  const [step, setStep] = useState(1);
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [selectedProducts, setSelectedProducts] = useState<string[]>([]);
  const [minOrder, setMinOrder] = useState('5');
  const [maxOrder, setMaxOrder] = useState('50');

  const { data: inventory } = useWholesaleInventory();
  const createMenu = useCreateDisposableMenu();

  const toggleProduct = (productId: string) => {
    setSelectedProducts(prev =>
      prev.includes(productId)
        ? prev.filter(id => id !== productId)
        : [...prev, productId]
    );
  };

  const handleCreate = async () => {
    if (!name || selectedProducts.length === 0) return;

    await createMenu.mutateAsync({
      name,
      description,
      product_ids: selectedProducts,
      min_order_quantity: parseFloat(minOrder),
      max_order_quantity: parseFloat(maxOrder),
      security_settings: {
        access_type: 'invite_only',
        screenshot_protection: { enabled: true, watermark: true },
        device_locking: { enabled: true }
      }
    });

    // Reset and close
    setStep(1);
    setName('');
    setDescription('');
    setSelectedProducts([]);
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Create Disposable Menu - Step {step}/2</DialogTitle>
        </DialogHeader>

        <div className="space-y-6">
          {step === 1 && (
            <>
              <div className="space-y-2">
                <Label htmlFor="name">Menu Name (Internal)</Label>
                <Input
                  id="name"
                  placeholder="e.g., VIP Wholesale Clients"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="description">Description (Internal)</Label>
                <Textarea
                  id="description"
                  placeholder="Premium clients, bulk orders only"
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  rows={3}
                />
              </div>

              <div className="flex justify-end">
                <Button 
                  onClick={() => setStep(2)}
                  disabled={!name}
                >
                  Next: Select Products
                </Button>
              </div>
            </>
          )}

          {step === 2 && (
            <>
              <div className="space-y-4">
                <Label>Select Products</Label>
                <div className="border rounded-lg divide-y max-h-[400px] overflow-y-auto">
                  {inventory?.map(product => (
                    <div 
                      key={product.id} 
                      className="flex items-center gap-3 p-4 hover:bg-muted/50 cursor-pointer"
                      onClick={() => toggleProduct(product.id)}
                    >
                      <Checkbox
                        checked={selectedProducts.includes(product.id)}
                        onCheckedChange={() => toggleProduct(product.id)}
                      />
                      <div className="flex-1">
                        <div className="font-medium">{product.product_name}</div>
                        <div className="text-sm text-muted-foreground">
                          {product.quantity_lbs} lbs • {product.quantity_units} units available
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
                <div className="text-sm text-muted-foreground">
                  {selectedProducts.length} product(s) selected
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="minOrder">Min Order (lbs)</Label>
                  <Input
                    id="minOrder"
                    type="number"
                    value={minOrder}
                    onChange={(e) => setMinOrder(e.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="maxOrder">Max Order (lbs)</Label>
                  <Input
                    id="maxOrder"
                    type="number"
                    value={maxOrder}
                    onChange={(e) => setMaxOrder(e.target.value)}
                  />
                </div>
              </div>

              <div className="flex justify-between">
                <Button variant="outline" onClick={() => setStep(1)}>
                  Back
                </Button>
                <Button 
                  onClick={handleCreate}
                  disabled={selectedProducts.length === 0 || createMenu.isPending}
                >
                  {createMenu.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                  Create Menu
                </Button>
              </div>
            </>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
};
