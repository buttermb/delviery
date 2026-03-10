import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/textarea';
import {
  MapPin, ArrowRight, ArrowLeft,
  Loader2, Home, Truck, Store, Clock,
  Navigation, MessageCircle,
  Locate, Building, KeyRound as Key,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';
import { DELIVERY_METHODS } from './types';

export function LocationStep({
  formData,
  onUpdate,
  onNext,
  onBack
}: {
  formData: {
    deliveryMethod: string;
    address: string;
    city: string;
    zipCode: string;
    landmark: string;
    gateCode: string;
    notes: string;
  };
  onUpdate: (field: string, value: string) => void;
  onNext: () => void;
  onBack: () => void;
}) {
  const [isLocating, setIsLocating] = useState(false);
  const needsAddress = formData.deliveryMethod === 'delivery';
  const isValid = formData.deliveryMethod && (!needsAddress || (formData.address.trim() && formData.city.trim()));

  const handleGetLocation = () => {
    setIsLocating(true);
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        async () => {
          // In production, use reverse geocoding API
          toast.success('Location detected! Please verify the address.');
          setIsLocating(false);
        },
        () => {
          toast.error('Could not get your location');
          setIsLocating(false);
        }
      );
    } else {
      toast.error('Geolocation not supported');
      setIsLocating(false);
    }
  };

  return (
    <div className="flex flex-col h-full">
      <div className="flex-1 overflow-y-auto px-4 py-4 space-y-5">
        <div className="text-center mb-6">
          <div className="w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center mx-auto mb-3">
            <MapPin className="h-8 w-8 text-primary" />
          </div>
          <h2 className="text-xl font-bold">Delivery Method</h2>
          <p className="text-sm text-muted-foreground">How would you like to receive your order?</p>
        </div>

        {/* Delivery method cards */}
        <div className="grid grid-cols-2 gap-3">
          {DELIVERY_METHODS.map((method) => {
            const Icon = method.icon;
            const isSelected = formData.deliveryMethod === method.id;

            return (
              <Card
                key={method.id}
                className={cn(
                  "cursor-pointer transition-all",
                  isSelected
                    ? "border-primary bg-primary/5 ring-2 ring-primary shadow-lg"
                    : "hover:border-primary/50"
                )}
                onClick={() => onUpdate('deliveryMethod', method.id)}
              >
                <CardContent className="p-4 text-center">
                  <div className={cn(
                    "w-12 h-12 rounded-full flex items-center justify-center mx-auto mb-2",
                    isSelected ? "bg-primary text-primary-foreground" : "bg-muted"
                  )}>
                    <Icon className="h-6 w-6" />
                  </div>
                  <div className="font-semibold">{method.label}</div>
                  <div className="text-xs text-muted-foreground mt-1">{method.eta}</div>
                  {isSelected && (
                    <Badge className="mt-2 bg-primary/20 text-primary">Selected</Badge>
                  )}
                </CardContent>
              </Card>
            );
          })}
        </div>

        {/* Address fields for delivery */}
        {needsAddress && (
          <div className="space-y-4 pt-4 border-t">
            <div className="flex items-center justify-between">
              <h3 className="font-semibold">Drop-off Location</h3>
              <Button
                variant="outline"
                size="sm"
                onClick={handleGetLocation}
                disabled={isLocating}
                className="gap-2"
              >
                {isLocating ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Locate className="h-4 w-4" />
                )}
                Use My Location
              </Button>
            </div>

            <div className="space-y-2">
              <Label htmlFor="address" className="flex items-center gap-2">
                <Home className="h-4 w-4" />
                Street Address <span className="text-red-500">*</span>
              </Label>
              <Input
                id="address"
                placeholder="123 Main Street, Apt 4B"
                value={formData.address}
                onChange={(e) => onUpdate('address', e.target.value)}
                className="h-12"
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label htmlFor="city" className="flex items-center gap-2">
                  <Building className="h-4 w-4" />
                  City <span className="text-red-500">*</span>
                </Label>
                <Input
                  id="city"
                  placeholder="New York"
                  value={formData.city}
                  onChange={(e) => onUpdate('city', e.target.value)}
                  className="h-12"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="zipCode">ZIP Code</Label>
                <Input
                  id="zipCode"
                  placeholder="10001"
                  value={formData.zipCode}
                  onChange={(e) => onUpdate('zipCode', e.target.value)}
                  className="h-12"
                  maxLength={5}
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label htmlFor="landmark" className="flex items-center gap-2">
                  <Navigation className="h-4 w-4" />
                  Landmark
                </Label>
                <Input
                  id="landmark"
                  placeholder="Near the park"
                  value={formData.landmark}
                  onChange={(e) => onUpdate('landmark', e.target.value)}
                  className="h-12"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="gateCode" className="flex items-center gap-2">
                  <Key className="h-4 w-4" />
                  Gate Code
                </Label>
                <Input
                  id="gateCode"
                  placeholder="#1234"
                  value={formData.gateCode}
                  onChange={(e) => onUpdate('gateCode', e.target.value)}
                  className="h-12"
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="notes" className="flex items-center gap-2">
                <MessageCircle className="h-4 w-4" />
                Delivery Instructions
              </Label>
              <Textarea
                id="notes"
                placeholder="Leave at door, ring doorbell twice..."
                value={formData.notes}
                onChange={(e) => onUpdate('notes', e.target.value)}
                rows={2}
                className="resize-none"
                maxLength={200}
              />
              <p className="text-xs text-muted-foreground text-right">
                {formData.notes.length}/200
              </p>
            </div>
          </div>
        )}

        {/* Pickup info */}
        {!needsAddress && (
          <Card className="bg-muted/50">
            <CardContent className="p-4">
              <div className="flex items-start gap-3">
                <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                  <Store className="h-5 w-5 text-primary" />
                </div>
                <div>
                  <div className="font-semibold">Pickup Location</div>
                  <p className="text-sm text-muted-foreground mt-1">
                    Address will be provided after order confirmation
                  </p>
                  <Badge variant="outline" className="mt-2">
                    <Clock className="h-3 w-3 mr-1" />
                    Ready in 15-20 min
                  </Badge>
                </div>
              </div>
            </CardContent>
          </Card>
        )}
      </div>

      {/* Bottom buttons */}
      <div className="border-t bg-card px-4 py-4 flex gap-3">
        <Button variant="outline" onClick={onBack} className="h-12 px-6" aria-label="Go back">
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <Button
          onClick={onNext}
          disabled={!isValid}
          className="flex-1 h-12 text-lg font-semibold"
        >
          Continue
          <ArrowRight className="h-5 w-5 ml-2" />
        </Button>
      </div>
    </div>
  );
}
