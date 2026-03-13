/**
 * Storefront Checkout Flow Component
 * Multi-step checkout: contact info, delivery address, time selection, review, place order
 */

import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import {
  User,
  MapPin,
  Clock,
  FileText,
  Check,
  ArrowRight,
  ArrowLeft,
  ShoppingCart,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Separator } from '@/components/ui/separator';
import { Badge } from '@/components/ui/badge';
import ProductImage from '@/components/ProductImage';
import { formatCurrency } from '@/lib/utils/formatCurrency';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';

// Validation schema
const checkoutSchema = z.object({
  // Contact Info
  customer_name: z.string().min(2, 'Name must be at least 2 characters').max(100),
  customer_email: z.string().email('Invalid email address'),
  customer_phone: z
    .string()
    .regex(/^\+?[\d\s()-]{10,}$/, 'Invalid phone number')
    .max(20),

  // Delivery Address
  address_line1: z.string().min(5, 'Address is required').max(200),
  address_line2: z.string().max(200).optional(),
  city: z.string().min(2, 'City is required').max(100),
  state: z.string().min(2, 'State is required').max(50),
  postal_code: z.string().min(5, 'Postal code is required').max(20),

  // Delivery Time
  delivery_date: z.string().min(1, 'Delivery date is required'),
  delivery_time_slot: z.string().min(1, 'Time slot is required'),

  // Notes
  delivery_notes: z.string().max(500).optional(),
});

type CheckoutFormData = z.infer<typeof checkoutSchema>;

export interface CartItem {
  id: string;
  product_id: string;
  name: string;
  price: number;
  quantity: number;
  image_url: string | null;
  sku: string | null;
}

interface CheckoutFlowProps {
  items: CartItem[];
  subtotal: number;
  tax: number;
  deliveryFee: number;
  total: number;
  onSubmit: (data: CheckoutFormData) => Promise<void>;
  onCancel: () => void;
  availableTimeSlots?: string[];
}

type CheckoutStep = 'contact' | 'address' | 'time' | 'review';

const STEPS: { id: CheckoutStep; label: string; icon: typeof User }[] = [
  { id: 'contact', label: 'Contact', icon: User },
  { id: 'address', label: 'Delivery', icon: MapPin },
  { id: 'time', label: 'Time', icon: Clock },
  { id: 'review', label: 'Review', icon: FileText },
];

export default function CheckoutFlow({
  items,
  subtotal,
  tax,
  deliveryFee,
  total,
  onSubmit,
  onCancel,
  availableTimeSlots = ['9:00 AM - 12:00 PM', '12:00 PM - 3:00 PM', '3:00 PM - 6:00 PM'],
}: CheckoutFlowProps) {
  const [currentStep, setCurrentStep] = useState<CheckoutStep>('contact');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const {
    register,
    handleSubmit,
    watch,
    setValue,
    formState: { errors },
  } = useForm<CheckoutFormData>({
    resolver: zodResolver(checkoutSchema),
    mode: 'onBlur',
  });

  const formData = watch();

  const currentStepIndex = STEPS.findIndex((s) => s.id === currentStep);

  const handleNext = () => {
    const nextIndex = currentStepIndex + 1;
    if (nextIndex < STEPS.length) {
      setCurrentStep(STEPS[nextIndex].id);
    }
  };

  const handleBack = () => {
    const prevIndex = currentStepIndex - 1;
    if (prevIndex >= 0) {
      setCurrentStep(STEPS[prevIndex].id);
    }
  };

  const handleFormSubmit = async (data: CheckoutFormData) => {
    setIsSubmitting(true);
    try {
      await onSubmit(data);
      toast.success('Order placed successfully!');
    } catch (error) {
      toast.error('Failed to place order. Please try again.');
      console.error(error);
    } finally {
      setIsSubmitting(false);
    }
  };

  const validateCurrentStep = (): boolean => {
    switch (currentStep) {
      case 'contact':
        return (
          !errors.customer_name && !errors.customer_email && !errors.customer_phone && !!formData.customer_name && !!formData.customer_email && !!formData.customer_phone
        );
      case 'address':
        return (
          !errors.address_line1 &&
          !errors.city &&
          !errors.state &&
          !errors.postal_code &&
          !!formData.address_line1 &&
          !!formData.city &&
          !!formData.state &&
          !!formData.postal_code
        );
      case 'time':
        return !errors.delivery_date && !errors.delivery_time_slot && !!formData.delivery_date && !!formData.delivery_time_slot;
      case 'review':
        return true;
      default:
        return false;
    }
  };

  return (
    <div className="min-h-screen bg-background">
      <div className="container mx-auto px-4 py-8 max-w-4xl">
        {/* Progress Steps */}
        <div className="mb-8">
          <div className="flex items-center justify-between">
            {STEPS.map((step, index) => {
              const Icon = step.icon;
              const isActive = step.id === currentStep;
              const isCompleted = index < currentStepIndex;

              return (
                <div key={step.id} className="flex items-center flex-1">
                  <div className="flex flex-col items-center flex-1">
                    <div
                      className={cn(
                        'w-12 h-12 rounded-full flex items-center justify-center border-2 transition-colors',
                        isActive && 'border-primary bg-primary text-primary-foreground',
                        isCompleted && 'border-primary bg-primary text-primary-foreground',
                        !isActive &&
                          !isCompleted &&
                          'border-muted-foreground/30 bg-muted text-muted-foreground'
                      )}
                    >
                      {isCompleted ? <Check className="h-5 w-5" /> : <Icon className="h-5 w-5" />}
                    </div>
                    <p
                      className={cn(
                        'text-sm mt-2 font-medium',
                        isActive && 'text-primary',
                        !isActive && 'text-muted-foreground'
                      )}
                    >
                      {step.label}
                    </p>
                  </div>
                  {index < STEPS.length - 1 && (
                    <div
                      className={cn(
                        'h-0.5 flex-1 mx-2',
                        isCompleted ? 'bg-primary' : 'bg-muted-foreground/30'
                      )}
                    />
                  )}
                </div>
              );
            })}
          </div>
        </div>

        <form onSubmit={handleSubmit(handleFormSubmit)}>
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Main Content */}
            <div className="lg:col-span-2 space-y-6">
              {/* Contact Info */}
              {currentStep === 'contact' && (
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <User className="h-5 w-5" />
                      Contact Information
                    </CardTitle>
                    <CardDescription>How can we reach you?</CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div>
                      <Label htmlFor="customer_name">Full Name *</Label>
                      <Input
                        id="customer_name"
                        {...register('customer_name')}
                        placeholder="John Doe"
                        className={errors.customer_name && 'border-destructive'}
                      />
                      {errors.customer_name && (
                        <p className="text-sm text-destructive mt-1">
                          {errors.customer_name.message}
                        </p>
                      )}
                    </div>
                    <div>
                      <Label htmlFor="customer_email">Email Address *</Label>
                      <Input
                        id="customer_email"
                        type="email"
                        {...register('customer_email')}
                        placeholder="john@example.com"
                        className={errors.customer_email && 'border-destructive'}
                      />
                      {errors.customer_email && (
                        <p className="text-sm text-destructive mt-1">
                          {errors.customer_email.message}
                        </p>
                      )}
                    </div>
                    <div>
                      <Label htmlFor="customer_phone">Phone Number *</Label>
                      <Input
                        id="customer_phone"
                        type="tel"
                        {...register('customer_phone')}
                        placeholder="+1 (555) 123-4567"
                        className={errors.customer_phone && 'border-destructive'}
                      />
                      {errors.customer_phone && (
                        <p className="text-sm text-destructive mt-1">
                          {errors.customer_phone.message}
                        </p>
                      )}
                    </div>
                  </CardContent>
                </Card>
              )}

              {/* Delivery Address */}
              {currentStep === 'address' && (
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <MapPin className="h-5 w-5" />
                      Delivery Address
                    </CardTitle>
                    <CardDescription>Where should we deliver your order?</CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div>
                      <Label htmlFor="address_line1">Street Address *</Label>
                      <Input
                        id="address_line1"
                        {...register('address_line1')}
                        placeholder="123 Main St"
                        className={errors.address_line1 && 'border-destructive'}
                      />
                      {errors.address_line1 && (
                        <p className="text-sm text-destructive mt-1">
                          {errors.address_line1.message}
                        </p>
                      )}
                    </div>
                    <div>
                      <Label htmlFor="address_line2">Apartment, Suite, etc. (Optional)</Label>
                      <Input
                        id="address_line2"
                        {...register('address_line2')}
                        placeholder="Apt 4B"
                      />
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <Label htmlFor="city">City *</Label>
                        <Input
                          id="city"
                          {...register('city')}
                          placeholder="San Francisco"
                          className={errors.city && 'border-destructive'}
                        />
                        {errors.city && (
                          <p className="text-sm text-destructive mt-1">{errors.city.message}</p>
                        )}
                      </div>
                      <div>
                        <Label htmlFor="state">State *</Label>
                        <Input
                          id="state"
                          {...register('state')}
                          placeholder="CA"
                          className={errors.state && 'border-destructive'}
                        />
                        {errors.state && (
                          <p className="text-sm text-destructive mt-1">{errors.state.message}</p>
                        )}
                      </div>
                    </div>
                    <div>
                      <Label htmlFor="postal_code">Postal Code *</Label>
                      <Input
                        id="postal_code"
                        {...register('postal_code')}
                        placeholder="94102"
                        className={errors.postal_code && 'border-destructive'}
                      />
                      {errors.postal_code && (
                        <p className="text-sm text-destructive mt-1">
                          {errors.postal_code.message}
                        </p>
                      )}
                    </div>
                  </CardContent>
                </Card>
              )}

              {/* Delivery Time */}
              {currentStep === 'time' && (
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <Clock className="h-5 w-5" />
                      Delivery Time
                    </CardTitle>
                    <CardDescription>When would you like to receive your order?</CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div>
                      <Label htmlFor="delivery_date">Delivery Date *</Label>
                      <Input
                        id="delivery_date"
                        type="date"
                        {...register('delivery_date')}
                        min={new Date().toISOString().split('T')[0]}
                        className={errors.delivery_date && 'border-destructive'}
                      />
                      {errors.delivery_date && (
                        <p className="text-sm text-destructive mt-1">
                          {errors.delivery_date.message}
                        </p>
                      )}
                    </div>
                    <div>
                      <Label>Time Slot *</Label>
                      <RadioGroup
                        value={formData.delivery_time_slot || ''}
                        onValueChange={(value) => setValue('delivery_time_slot', value)}
                        className="space-y-2 mt-2"
                      >
                        {availableTimeSlots.map((slot) => (
                          <div
                            key={slot}
                            className="flex items-center space-x-2 p-3 border rounded-lg hover:bg-muted/50 cursor-pointer"
                          >
                            <RadioGroupItem value={slot} id={`slot-${slot}`} />
                            <Label htmlFor={`slot-${slot}`} className="flex-1 cursor-pointer">
                              {slot}
                            </Label>
                          </div>
                        ))}
                      </RadioGroup>
                      {errors.delivery_time_slot && (
                        <p className="text-sm text-destructive mt-1">
                          {errors.delivery_time_slot.message}
                        </p>
                      )}
                    </div>
                    <div>
                      <Label htmlFor="delivery_notes">Delivery Notes (Optional)</Label>
                      <Textarea
                        id="delivery_notes"
                        {...register('delivery_notes')}
                        placeholder="Gate code, special instructions, etc."
                        rows={3}
                        maxLength={500}
                      />
                      <p className="text-xs text-muted-foreground mt-1">
                        {formData.delivery_notes?.length || 0}/500
                      </p>
                    </div>
                  </CardContent>
                </Card>
              )}

              {/* Review */}
              {currentStep === 'review' && (
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <FileText className="h-5 w-5" />
                      Review Order
                    </CardTitle>
                    <CardDescription>Please review your order before placing it</CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-6">
                    {/* Contact Info */}
                    <div>
                      <h3 className="font-semibold mb-2">Contact Information</h3>
                      <div className="text-sm space-y-1 text-muted-foreground">
                        <p>{formData.customer_name}</p>
                        <p>{formData.customer_email}</p>
                        <p>{formData.customer_phone}</p>
                      </div>
                    </div>
                    <Separator />
                    {/* Delivery Address */}
                    <div>
                      <h3 className="font-semibold mb-2">Delivery Address</h3>
                      <div className="text-sm space-y-1 text-muted-foreground">
                        <p>{formData.address_line1}</p>
                        {formData.address_line2 && <p>{formData.address_line2}</p>}
                        <p>
                          {formData.city}, {formData.state} {formData.postal_code}
                        </p>
                      </div>
                    </div>
                    <Separator />
                    {/* Delivery Time */}
                    <div>
                      <h3 className="font-semibold mb-2">Delivery Time</h3>
                      <div className="text-sm space-y-1 text-muted-foreground">
                        <p>{formData.delivery_date}</p>
                        <p>{formData.delivery_time_slot}</p>
                        {formData.delivery_notes && (
                          <p className="italic">Notes: {formData.delivery_notes}</p>
                        )}
                      </div>
                    </div>
                  </CardContent>
                </Card>
              )}
            </div>

            {/* Order Summary Sidebar */}
            <div className="lg:col-span-1">
              <Card className="sticky top-4">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <ShoppingCart className="h-5 w-5" />
                    Order Summary
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  {/* Items */}
                  <div className="space-y-3 max-h-64 overflow-y-auto">
                    {items.map((item) => (
                      <div key={item.product_id} className="flex gap-3">
                        <div className="relative w-16 h-16 rounded-md overflow-hidden bg-muted shrink-0">
                          <ProductImage
                            src={item.image_url}
                            alt={item.name}
                            className="w-full h-full object-cover"
                          />
                          <Badge className="absolute -top-1 -right-1 h-6 w-6 rounded-full p-0 flex items-center justify-center text-xs">
                            {item.quantity}
                          </Badge>
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium truncate">{item.name}</p>
                          <p className="text-sm text-muted-foreground">
                            {formatCurrency(item.price)} × {item.quantity}
                          </p>
                          <p className="text-sm font-semibold">
                            {formatCurrency(item.price * item.quantity)}
                          </p>
                        </div>
                      </div>
                    ))}
                  </div>

                  <Separator />

                  {/* Totals */}
                  <div className="space-y-2 text-sm">
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Subtotal</span>
                      <span>{formatCurrency(subtotal)}</span>
                    </div>
                    {deliveryFee > 0 && (
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Delivery Fee</span>
                        <span>{formatCurrency(deliveryFee)}</span>
                      </div>
                    )}
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Tax</span>
                      <span>{formatCurrency(tax)}</span>
                    </div>
                    <Separator />
                    <div className="flex justify-between text-lg font-bold">
                      <span>Total</span>
                      <span>{formatCurrency(total)}</span>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>
          </div>

          {/* Navigation Buttons */}
          <div className="flex justify-between mt-8">
            <Button
              type="button"
              variant="outline"
              onClick={currentStepIndex === 0 ? onCancel : handleBack}
              disabled={isSubmitting}
            >
              <ArrowLeft className="h-4 w-4 mr-2" />
              {currentStepIndex === 0 ? 'Cancel' : 'Back'}
            </Button>
            {currentStep === 'review' ? (
              <Button type="submit" size="lg" disabled={isSubmitting}>
                {isSubmitting ? 'Placing Order...' : 'Place Order'}
                <Check className="h-4 w-4 ml-2" />
              </Button>
            ) : (
              <Button
                type="button"
                onClick={handleNext}
                disabled={!validateCurrentStep()}
                size="lg"
              >
                Continue
                <ArrowRight className="h-4 w-4 ml-2" />
              </Button>
            )}
          </div>
        </form>
      </div>
    </div>
  );
}
