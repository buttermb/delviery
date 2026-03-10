/**
 * ContactStep
 * Step 1: Contact information (name, email, phone, preferred contact, create account)
 */

import { motion } from 'framer-motion';
import { Loader2, Check } from 'lucide-react';

import type { CheckoutData } from './types';

import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Checkbox } from '@/components/ui/checkbox';
import { Separator } from '@/components/ui/separator';

interface ContactStepProps {
  formData: CheckoutData;
  updateField: (field: keyof CheckoutData, value: string) => void;
  showErrors: boolean;
  isLuxuryTheme: boolean;
  requirePhone: boolean;
  isLookingUpCustomer: boolean;
  isRecognized: boolean;
  returningCustomerName: string | undefined;
  createAccount: boolean;
  setCreateAccount: (value: boolean) => void;
  accountPassword: string;
  setAccountPassword: (value: string) => void;
}

export function ContactStep({
  formData,
  updateField,
  showErrors,
  isLuxuryTheme,
  requirePhone,
  isLookingUpCustomer,
  isRecognized,
  returningCustomerName,
  createAccount,
  setCreateAccount,
  accountPassword,
  setAccountPassword,
}: ContactStepProps) {
  return (
    <motion.div
      key="step1"
      initial={{ opacity: 0, x: 20 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: -20 }}
      transition={{ duration: 0.3 }}
      className="space-y-4"
    >
      <h2 className={`text-lg sm:text-xl font-semibold mb-3 sm:mb-4 ${isLuxuryTheme ? 'text-white font-light' : ''}`}>Contact Information</h2>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label htmlFor="firstName">First Name *</Label>
          <Input
            id="firstName"
            name="firstName"
            value={formData.firstName}
            onChange={(e) => updateField('firstName', e.target.value)}
            placeholder="John"
            className={showErrors && !formData.firstName ? "border-red-500 focus-visible:ring-red-500" : ""}
          />
          {showErrors && !formData.firstName && (
            <p className="text-xs text-red-500">Required</p>
          )}
        </div>
        <div className="space-y-2">
          <Label htmlFor="lastName">Last Name *</Label>
          <Input
            id="lastName"
            name="lastName"
            value={formData.lastName}
            onChange={(e) => updateField('lastName', e.target.value)}
            placeholder="Doe"
            className={showErrors && !formData.lastName ? "border-red-500 focus-visible:ring-red-500" : ""}
          />
          {showErrors && !formData.lastName && (
            <p className="text-xs text-red-500">Required</p>
          )}
        </div>
      </div>
      <div className="space-y-2">
        <Label htmlFor="email">Email *</Label>
        <Input
          id="email"
          name="email"
          type="email"
          value={formData.email}
          onChange={(e) => updateField('email', e.target.value)}
          placeholder="john@example.com"
          className={showErrors && !formData.email ? "border-red-500 focus-visible:ring-red-500" : ""}
        />
        {showErrors && !formData.email && (
          <p className="text-xs text-red-500">Required</p>
        )}
      </div>
      <div className="space-y-2">
        <Label htmlFor="phone">
          Phone {requirePhone ? '*' : '(Optional)'}
        </Label>
        <div className="relative">
          <Input
            id="phone"
            name="phone"
            type="tel"
            value={formData.phone}
            onChange={(e) => updateField('phone', e.target.value)}
            placeholder="(555) 123-4567"
          />
          {isLookingUpCustomer && (
            <Loader2 className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 animate-spin text-muted-foreground" />
          )}
          {isRecognized && !isLookingUpCustomer && (
            <Check className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-green-500" />
          )}
        </div>
        {isRecognized && (
          <p className="text-xs text-green-600">Welcome back, {returningCustomerName}!</p>
        )}
      </div>
      <div className="space-y-2">
        <Label>Preferred Contact Method</Label>
        <RadioGroup
          value={formData.preferredContact}
          onValueChange={(value) => updateField('preferredContact', value)}
          className="flex gap-4"
        >
          <div className="flex items-center space-x-2">
            <RadioGroupItem value="text" id="contact-text" />
            <Label htmlFor="contact-text" className="cursor-pointer">Text</Label>
          </div>
          <div className="flex items-center space-x-2">
            <RadioGroupItem value="phone" id="contact-phone" />
            <Label htmlFor="contact-phone" className="cursor-pointer">Call</Label>
          </div>
          <div className="flex items-center space-x-2">
            <RadioGroupItem value="email" id="contact-email" />
            <Label htmlFor="contact-email" className="cursor-pointer">Email</Label>
          </div>
          <div className="flex items-center space-x-2">
            <RadioGroupItem value="telegram" id="contact-telegram" />
            <Label htmlFor="contact-telegram" className="cursor-pointer">Telegram</Label>
          </div>
        </RadioGroup>
      </div>

      {/* Create Account Option */}
      <Separator />
      <div className="space-y-3">
        <div className="flex items-start gap-2">
          <Checkbox
            id="create-account"
            checked={createAccount}
            onCheckedChange={(checked) => {
              setCreateAccount(checked as boolean);
              if (!checked) setAccountPassword('');
            }}
          />
          <div>
            <Label htmlFor="create-account" className="cursor-pointer font-medium">
              Create an account
            </Label>
            <p className="text-xs text-muted-foreground mt-0.5">
              Save your info and view order history
            </p>
          </div>
        </div>
        {createAccount && (
          <div className="space-y-2 pl-6">
            <Label htmlFor="account-password">Password *</Label>
            <Input
              id="account-password"
              type="password"
              value={accountPassword}
              onChange={(e) => setAccountPassword(e.target.value)}
              placeholder="At least 8 characters"
              minLength={8}
              className={showErrors && createAccount && accountPassword.length < 8 ? "border-red-500 focus-visible:ring-red-500" : ""}
            />
            {showErrors && createAccount && accountPassword.length < 8 && (
              <p className="text-xs text-red-500">Password must be at least 8 characters</p>
            )}
          </div>
        )}
      </div>
    </motion.div>
  );
}
