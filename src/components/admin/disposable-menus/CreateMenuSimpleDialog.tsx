import { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Checkbox } from '@/components/ui/checkbox';
import { Badge } from '@/components/ui/badge';
import { useWholesaleInventory } from '@/hooks/useWholesaleData';
import { useCreateDisposableMenu } from '@/hooks/useDisposableMenus';
import { Loader2, ChevronRight, ChevronLeft, Eye, CheckCircle2, Users, X } from 'lucide-react';
import { Progress } from '@/components/ui/progress';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { toast } from 'sonner';
import { Card, CardContent } from '@/components/ui/card';
import { formatCurrency } from '@/lib/utils/formatCurrency';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useTenantAdminAuth } from '@/contexts/TenantAdminAuthContext';
import { useTenantLimits } from '@/hooks/useTenantLimits';

interface CreateMenuSimpleDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const STEPS = [
  { id: 1, name: 'Basic Info', icon: Eye },
  { id: 2, name: 'Select Products', icon: CheckCircle2 },
  { id: 3, name: 'Assign Customers', icon: Users },
];

export const CreateMenuSimpleDialog = ({ open, onOpenChange }: CreateMenuSimpleDialogProps) => {
  const { tenant } = useTenantAdminAuth();
  const { canCreate, getCurrent, getLimit } = useTenantLimits();
  const [currentStep, setCurrentStep] = useState(1);
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [menuType, setMenuType] = useState<'time_limited' | 'encrypted_link'>('time_limited');
  const [expiresIn, setExpiresIn] = useState('7');
  const [selectedProducts, setSelectedProducts] = useState<string[]>([]);
  const [productPrices, setProductPrices] = useState<Record<string, number>>({});
  const [accessType, setAccessType] = useState<'specific_customers' | 'public_link'>('specific_customers');
  const [selectedCustomers, setSelectedCustomers] = useState<string[]>([]);

  const { data: inventory } = useWholesaleInventory();
  const createMenu = useCreateDisposableMenu();

  // Fetch customers for this tenant
  const { data: customers } = useQuery({
    queryKey: ['tenant-customers', tenant?.id],
    queryFn: async () => {
      if (!tenant?.id) return [];
      // @ts-ignore - Complex Supabase query type
      const result = await supabase
        .from('customers')
        .select('id, name, email, business_name')
        .eq('tenant_id', tenant.id)
        .order('name', { ascending: true});
      const { data, error } = result;
      if (error) throw error;
      return data || [];
    },
    enabled: !!tenant?.id && currentStep === 3,
  });

  const progress = (currentStep / STEPS.length) * 100;

  const toggleProduct = (productId: string) => {
    setSelectedProducts(prev =>
      prev.includes(productId)
        ? prev.filter(id => id !== productId)
        : [...prev, productId]
    );
  };

  const toggleCustomer = (customerId: string) => {
    setSelectedCustomers(prev =>
      prev.includes(customerId)
        ? prev.filter(id => id !== customerId)
        : [...prev, customerId]
    );
  };

  const handleNext = () => {
    if (currentStep === 1 && !name.trim()) {
      toast.error("Please enter a menu name");
      return;
    }
    if (currentStep === 2 && selectedProducts.length === 0) {
      toast.error("Please select at least one product");
      return;
    }
    if (currentStep === 3 && accessType === 'specific_customers' && selectedCustomers.length === 0) {
      toast.error("Please select at least one customer");
      return;
    }
    if (currentStep < STEPS.length) {
      setCurrentStep(prev => prev + 1);
    }
  };

  const handleBack = () => {
    if (currentStep > 1) {
      setCurrentStep(prev => prev - 1);
    }
  };

  const handleCreate = async () => {
    if (!name || selectedProducts.length === 0) return;

    // Check menu limit before creating
    if (!canCreate('menus')) {
      const current = getCurrent('menus');
      const limit = getLimit('menus');
      toast.error('Menu Limit Reached', {
        description: limit === Infinity 
          ? 'Unable to create menu. Please contact support.'
          : `You've reached your menu limit (${current}/${limit === Infinity ? '∞' : limit}). Upgrade to Professional for unlimited menus.`,
      });
      return;
    }

    try {
      await createMenu.mutateAsync({
        name,
        description,
        product_ids: selectedProducts,
          security_settings: {
            access_type: accessType === 'public_link' ? 'shared' : 'invite_only',
            require_access_code: true,
            access_code: null, // Will be generated by backend
            customer_ids: accessType === 'specific_customers' ? selectedCustomers : [],
          },
      });

      toast.success("Menu created successfully!");
      onOpenChange(false);
      
      // Reset form
      setCurrentStep(1);
      setName('');
      setDescription('');
      setSelectedProducts([]);
      setSelectedCustomers([]);
      setAccessType('specific_customers');
    } catch (error: any) {
      toast.error(error.message || "Failed to create menu");
    }
  };

  const selectedProductsData = inventory?.filter(p => selectedProducts.includes(p.id)) || [];

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>📱 Create Disposable Menu</DialogTitle>
          <DialogDescription>
            Create a simple menu in 3 easy steps
          </DialogDescription>
        </DialogHeader>

        {/* Progress Bar */}
        <div className="space-y-2 mb-6">
          <div className="flex items-center justify-between text-sm text-muted-foreground">
            {STEPS.map((step, idx) => (
              <div key={step.id} className="flex items-center">
                <div className={`flex items-center gap-2 ${
                  currentStep > step.id ? 'text-primary' : 
                  currentStep === step.id ? 'text-primary font-medium' : 
                  'text-muted-foreground'
                }`}>
                  <div className={`w-8 h-8 rounded-full flex items-center justify-center border-2 ${
                    currentStep > step.id ? 'bg-primary border-primary text-primary-foreground' :
                    currentStep === step.id ? 'border-primary text-primary' :
                    'border-muted-foreground'
                  }`}>
                    {currentStep > step.id ? (
                      <CheckCircle2 className="h-4 w-4" />
                    ) : (
                      <step.icon className="h-4 w-4" />
                    )}
                  </div>
                  <span className="hidden sm:inline">{step.name}</span>
                </div>
                {idx < STEPS.length - 1 && (
                  <div className={`h-0.5 w-12 sm:w-24 mx-2 ${
                    currentStep > step.id ? 'bg-primary' : 'bg-muted'
                  }`} />
                )}
              </div>
            ))}
          </div>
          <Progress value={progress} className="h-2" />
        </div>

        {/* Step Content */}
        <div className="space-y-6 min-h-[400px]">
          {/* Step 1: Basic Info */}
          {currentStep === 1 && (
            <div className="space-y-4">
              <div>
                <Label htmlFor="menu-name">Menu Name *</Label>
                <Input
                  id="menu-name"
                  placeholder="VIP Wholesale Menu - November 2024"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="mt-1"
                />
              </div>

              <div>
                <Label htmlFor="menu-description">Description (optional)</Label>
                <Textarea
                  id="menu-description"
                  placeholder="Special wholesale pricing for premium customers"
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  rows={3}
                  className="mt-1"
                />
              </div>

              <div>
                <Label>Menu Type</Label>
                <RadioGroup value={menuType} onValueChange={(val: any) => setMenuType(val)} className="mt-2">
                  <div className="flex items-center space-x-2 p-4 border rounded-lg">
                    <RadioGroupItem value="encrypted_link" id="encrypted" />
                    <Label htmlFor="encrypted" className="flex-1 cursor-pointer">
                      <div className="font-medium">Encrypted Link</div>
                      <div className="text-sm text-muted-foreground">Burns after first view</div>
                    </Label>
                  </div>
                  <div className="flex items-center space-x-2 p-4 border rounded-lg">
                    <RadioGroupItem value="time_limited" id="time-limited" />
                    <Label htmlFor="time-limited" className="flex-1 cursor-pointer">
                      <div className="font-medium">Time-Limited</div>
                      <div className="text-sm text-muted-foreground">Expires after set time</div>
                    </Label>
                  </div>
                </RadioGroup>
              </div>

              {menuType === 'time_limited' && (
                <div>
                  <Label htmlFor="expires-in">Expires in</Label>
                  <Select value={expiresIn} onValueChange={setExpiresIn}>
                    <SelectTrigger className="mt-1">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="1">1 day</SelectItem>
                      <SelectItem value="3">3 days</SelectItem>
                      <SelectItem value="7">7 days</SelectItem>
                      <SelectItem value="14">14 days</SelectItem>
                      <SelectItem value="30">30 days</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              )}
            </div>
          )}

          {/* Step 2: Select Products */}
          {currentStep === 2 && (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <Label>Select Products</Label>
                <Badge variant="secondary">{selectedProducts.length} selected</Badge>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 max-h-[400px] overflow-y-auto">
                {inventory?.map((product) => {
                  const isSelected = selectedProducts.includes(product.id);
                  return (
                    <Card
                      key={product.id}
                      className={`cursor-pointer transition-all ${
                        isSelected ? 'border-primary bg-primary/5' : 'hover:border-primary/50'
                      }`}
                      onClick={() => toggleProduct(product.id)}
                    >
                      <CardContent className="p-4">
                        <div className="flex items-start gap-3">
                          <Checkbox
                            checked={isSelected}
                            onCheckedChange={() => toggleProduct(product.id)}
                            onClick={(e) => e.stopPropagation()}
                          />
                          <div className="flex-1">
                            <h4 className="font-medium">{(product as any).strain_name || (product as any).name || 'Product'}</h4>
                            <p className="text-sm text-muted-foreground">
                              {product.category || 'Product'}
                            </p>
                            <p className="text-sm font-semibold mt-1">
                              {formatCurrency(product.base_price || 0)}/unit
                            </p>
                            {(product as any).available_weight && (
                              <p className="text-xs text-muted-foreground mt-1">
                                Stock: {Number((product as any).available_weight).toFixed(2)} lbs
                              </p>
                            )}
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  );
                })}
              </div>
            </div>
          )}

          {/* Step 3: Assign Customers */}
          {currentStep === 3 && (
            <div className="space-y-4">
              <div>
                <Label>Who can access this menu?</Label>
                <RadioGroup value={accessType} onValueChange={(val: any) => setAccessType(val)} className="mt-2">
                  <div className="flex items-center space-x-2 p-4 border rounded-lg">
                    <RadioGroupItem value="specific_customers" id="specific" />
                    <Label htmlFor="specific" className="flex-1 cursor-pointer">
                      <div className="font-medium">Specific Customers</div>
                    </Label>
                  </div>
                  <div className="flex items-center space-x-2 p-4 border rounded-lg">
                    <RadioGroupItem value="public_link" id="public" />
                    <Label htmlFor="public" className="flex-1 cursor-pointer">
                      <div className="font-medium">Public Link</div>
                      <div className="text-sm text-muted-foreground">Anyone with link</div>
                    </Label>
                  </div>
                </RadioGroup>
              </div>

              {accessType === 'specific_customers' && (
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <Label>Select Customers</Label>
                    <Badge variant="secondary">{selectedCustomers.length} selected</Badge>
                  </div>
                  <div className="max-h-[300px] overflow-y-auto space-y-2 border rounded-lg p-2">
                    {customers && customers.length > 0 ? (
                      customers.map((customer: any) => {
                        const isSelected = selectedCustomers.includes(customer.id);
                        return (
                          <div
                            key={customer.id}
                            className={`flex items-center gap-3 p-3 rounded-lg cursor-pointer transition-colors ${
                              isSelected ? 'bg-primary/10 border border-primary' : 'hover:bg-muted'
                            }`}
                            onClick={() => toggleCustomer(customer.id)}
                          >
                            <Checkbox
                              checked={isSelected}
                              onCheckedChange={() => toggleCustomer(customer.id)}
                              onClick={(e) => e.stopPropagation()}
                            />
                            <div className="flex-1">
                              <p className="font-medium">{customer.name || customer.business_name || 'Unnamed Customer'}</p>
                              <p className="text-sm text-muted-foreground">{customer.email}</p>
                            </div>
                          </div>
                        );
                      })
                    ) : (
                      <div className="text-center py-6 text-muted-foreground">
                        No customers found
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Footer Actions */}
        <div className="flex items-center justify-between pt-6 border-t">
          <Button
            variant="outline"
            onClick={currentStep === 1 ? () => onOpenChange(false) : handleBack}
            disabled={createMenu.isPending}
          >
            {currentStep === 1 ? (
              'Cancel'
            ) : (
              <>
                <ChevronLeft className="h-4 w-4 mr-2" />
                Back
              </>
            )}
          </Button>
          
          <div className="flex gap-2">
            {currentStep < STEPS.length ? (
              <Button onClick={handleNext}>
                Next
                <ChevronRight className="h-4 w-4 ml-2" />
              </Button>
            ) : (
              <Button
                onClick={handleCreate}
                disabled={createMenu.isPending}
                className="bg-gradient-to-r from-primary to-primary/80"
              >
                {createMenu.isPending ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Creating...
                  </>
                ) : (
                  <>
                    Create Menu & Send
                    <ChevronRight className="h-4 w-4 ml-2" />
                  </>
                )}
              </Button>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};

