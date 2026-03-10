import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import {
  User, ArrowRight, ArrowLeft,
  Loader2, Phone, Mail, CheckCircle,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { formatPhoneNumber, isValidEmail } from './types';

export function DetailsStep({
  formData,
  onUpdate,
  onNext,
  onBack,
  errors,
  isRecognized,
  isLookingUp,
  recognizedName,
}: {
  formData: {
    firstName: string;
    lastName: string;
    phone: string;
    email: string;
    rememberMe: boolean;
  };
  onUpdate: (field: string, value: string | boolean) => void;
  onNext: () => void;
  onBack: () => void;
  errors: Record<string, string>;
  isRecognized?: boolean;
  isLookingUp?: boolean;
  recognizedName?: string;
}) {
  const isValid = formData.firstName.trim() && formData.lastName.trim() &&
                  formData.phone.replace(/\D/g, '').length >= 10 &&
                  (!formData.email || isValidEmail(formData.email));

  return (
    <div className="flex flex-col h-full">
      <div className="flex-1 overflow-y-auto px-4 py-4 space-y-5">
        <div className="text-center mb-6">
          <div className="w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center mx-auto mb-3">
            <User className="h-8 w-8 text-primary" />
          </div>
          <h2 className="text-xl font-bold">Your Details</h2>
          <p className="text-sm text-muted-foreground">We need this to process your order</p>
        </div>

        {/* Name fields */}
        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-2">
            <Label htmlFor="firstName" className="text-sm font-medium">
              First Name <span className="text-red-500">*</span>
            </Label>
            <Input
              id="firstName"
              autoComplete="given-name"
              placeholder="John"
              value={formData.firstName}
              onChange={(e) => onUpdate('firstName', e.target.value)}
              className={cn("h-12", errors.firstName && "border-red-500")}
            />
            {errors.firstName && (
              <p className="text-xs text-red-500">{errors.firstName}</p>
            )}
          </div>
          <div className="space-y-2">
            <Label htmlFor="lastName" className="text-sm font-medium">
              Last Name <span className="text-red-500">*</span>
            </Label>
            <Input
              id="lastName"
              autoComplete="family-name"
              placeholder="Doe"
              value={formData.lastName}
              onChange={(e) => onUpdate('lastName', e.target.value)}
              className={cn("h-12", errors.lastName && "border-red-500")}
            />
            {errors.lastName && (
              <p className="text-xs text-red-500">{errors.lastName}</p>
            )}
          </div>
        </div>

        {/* Phone */}
        <div className="space-y-2">
          <Label htmlFor="phone" className="text-sm font-medium flex items-center gap-2">
            <Phone className="h-4 w-4" />
            Phone Number <span className="text-red-500">*</span>
          </Label>
          <div className="relative">
            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground text-sm">
              +1
            </span>
            <Input
              id="phone"
              type="tel"
              autoComplete="tel"
              placeholder="(555) 123-4567"
              value={formData.phone}
              onChange={(e) => onUpdate('phone', formatPhoneNumber(e.target.value))}
              className={cn("h-12 pl-10 pr-10", errors.phone && "border-red-500")}
              maxLength={14}
            />
            {isLookingUp && (
              <Loader2 className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 animate-spin text-muted-foreground" />
            )}
            {isRecognized && !isLookingUp && (
              <CheckCircle className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-green-500" />
            )}
          </div>
          {errors.phone ? (
            <p className="text-xs text-red-500">{errors.phone}</p>
          ) : isRecognized ? (
            <p className="text-xs text-green-600">Welcome back, {recognizedName}!</p>
          ) : (
            <p className="text-xs text-muted-foreground">We'll text you order updates</p>
          )}
        </div>

        {/* Email */}
        <div className="space-y-2">
          <Label htmlFor="email" className="text-sm font-medium flex items-center gap-2">
            <Mail className="h-4 w-4" />
            Email (optional)
          </Label>
          <Input
            id="email"
            type="email"
            autoComplete="email"
            placeholder="john@example.com"
            value={formData.email}
            onChange={(e) => onUpdate('email', e.target.value)}
            className={cn("h-12", errors.email && "border-red-500")}
          />
          {errors.email && (
            <p className="text-xs text-red-500">{errors.email}</p>
          )}
        </div>

        {/* Remember me */}
        <div className="flex items-center gap-3 p-3 bg-muted/50 rounded-lg">
          <Checkbox
            id="rememberMe"
            checked={formData.rememberMe}
            onCheckedChange={(checked) => onUpdate('rememberMe', checked === true)}
          />
          <label htmlFor="rememberMe" className="text-sm cursor-pointer">
            Remember my details for next time
          </label>
        </div>
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
