/**
 * Checkout Step 1: Customer Information
 * Collects name, phone, email, and preferred contact method.
 * Uses React Hook Form + Zod for validation.
 */

import { useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { motion } from 'framer-motion';
import { Check, Loader2 } from 'lucide-react';

import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Checkbox } from '@/components/ui/checkbox';
import { Separator } from '@/components/ui/separator';
import {
  Form,
  FormField,
  FormItem,
  FormLabel,
  FormControl,
  FormMessage,
} from '@/components/ui/form';
import type { ReturningCustomerData } from '@/hooks/useReturningCustomerLookup';

// Phone validation - accepts formats: (555) 123-4567, 555-123-4567, 5551234567, +1 555-123-4567
const PHONE_REGEX = /^[\+]?[(]?[0-9]{1,3}[)]?[-\s.]?[0-9]{3}[-\s.]?[0-9]{4,6}$/;

const PREFERRED_CONTACT_OPTIONS = [
  { value: 'text', label: 'Text' },
  { value: 'phone', label: 'Phone' },
  { value: 'email', label: 'Email' },
  { value: 'telegram', label: 'Telegram' },
] as const;

const customerInfoSchema = z.object({
  firstName: z.string().min(1, 'First name is required').max(100),
  lastName: z.string().min(1, 'Last name is required').max(100),
  phone: z
    .string()
    .min(1, 'Phone number is required')
    .refine(
      (val) => PHONE_REGEX.test(val.replace(/\s/g, '')),
      'Please enter a valid phone number'
    ),
  email: z
    .string()
    .email('Please enter a valid email address')
    .max(254)
    .or(z.literal('')),
  preferredContact: z.enum(['text', 'phone', 'email', 'telegram']),
  createAccount: z.boolean(),
  accountPassword: z.string(),
}).refine(
  (data) => !data.createAccount || data.accountPassword.length >= 8,
  { message: 'Password must be at least 8 characters', path: ['accountPassword'] }
);

export type CustomerInfoFormValues = z.infer<typeof customerInfoSchema>;

interface CheckoutCustomerInfoStepProps {
  initialValues: {
    firstName: string;
    lastName: string;
    phone: string;
    email: string;
    preferredContact: 'text' | 'phone' | 'email' | 'telegram';
  };
  createAccount: boolean;
  accountPassword: string;
  isLuxuryTheme: boolean;
  isLookingUpCustomer: boolean;
  isRecognized: boolean;
  returningCustomer: ReturningCustomerData | null;
  onFieldChange: (field: string, value: string) => void;
  onCreateAccountChange: (checked: boolean) => void;
  onAccountPasswordChange: (password: string) => void;
  onValidate: (validate: () => Promise<boolean>) => void;
}

export function CheckoutCustomerInfoStep({
  initialValues,
  createAccount,
  accountPassword,
  isLuxuryTheme,
  isLookingUpCustomer,
  isRecognized,
  returningCustomer,
  onFieldChange,
  onCreateAccountChange,
  onAccountPasswordChange,
  onValidate,
}: CheckoutCustomerInfoStepProps) {
  const form = useForm<CustomerInfoFormValues>({
    resolver: zodResolver(customerInfoSchema),
    defaultValues: {
      firstName: initialValues.firstName,
      lastName: initialValues.lastName,
      phone: initialValues.phone,
      email: initialValues.email,
      preferredContact: initialValues.preferredContact,
      createAccount,
      accountPassword,
    },
    mode: 'onTouched',
  });

  // Sync external changes (returning customer auto-fill) into the form
  useEffect(() => {
    const current = form.getValues();
    if (initialValues.firstName && !current.firstName) {
      form.setValue('firstName', initialValues.firstName);
    }
    if (initialValues.lastName && !current.lastName) {
      form.setValue('lastName', initialValues.lastName);
    }
    if (initialValues.email && !current.email) {
      form.setValue('email', initialValues.email);
    }
    if (initialValues.preferredContact !== current.preferredContact) {
      form.setValue('preferredContact', initialValues.preferredContact);
    }
  }, [initialValues.firstName, initialValues.lastName, initialValues.email, initialValues.preferredContact, form]);

  // Sync createAccount/accountPassword from parent
  useEffect(() => {
    form.setValue('createAccount', createAccount);
  }, [createAccount, form]);

  useEffect(() => {
    form.setValue('accountPassword', accountPassword);
  }, [accountPassword, form]);

  // Propagate field changes to parent
  const handleFieldChange = (field: string, value: string) => {
    onFieldChange(field, value);
  };

  // Expose validation function to parent
  useEffect(() => {
    onValidate(async () => {
      const result = await form.trigger();
      return result;
    });
  }, [form, onValidate]);

  return (
    <motion.div
      key="step1"
      initial={{ opacity: 0, x: 20 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: -20 }}
      transition={{ duration: 0.3 }}
      className="space-y-4"
    >
      <h2
        className={`text-lg sm:text-xl font-semibold mb-3 sm:mb-4 ${
          isLuxuryTheme ? 'text-white font-light' : ''
        }`}
      >
        Contact Information
      </h2>

      <Form {...form}>
        <div className="space-y-4">
          {/* Name fields */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <FormField
              control={form.control}
              name="firstName"
              render={({ field }) => (
                <FormItem>
                  <FormLabel required>First Name</FormLabel>
                  <FormControl>
                    <Input
                      {...field}
                      placeholder="John"
                      onChange={(e) => {
                        field.onChange(e);
                        handleFieldChange('firstName', e.target.value);
                      }}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="lastName"
              render={({ field }) => (
                <FormItem>
                  <FormLabel required>Last Name</FormLabel>
                  <FormControl>
                    <Input
                      {...field}
                      placeholder="Doe"
                      onChange={(e) => {
                        field.onChange(e);
                        handleFieldChange('lastName', e.target.value);
                      }}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
          </div>

          {/* Phone field (required) */}
          <FormField
            control={form.control}
            name="phone"
            render={({ field }) => (
              <FormItem>
                <FormLabel required>Phone</FormLabel>
                <FormControl>
                  <div className="relative">
                    <Input
                      {...field}
                      type="tel"
                      placeholder="(555) 123-4567"
                      onChange={(e) => {
                        field.onChange(e);
                        handleFieldChange('phone', e.target.value);
                      }}
                    />
                    {isLookingUpCustomer && (
                      <Loader2 className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 animate-spin text-muted-foreground" />
                    )}
                    {isRecognized && !isLookingUpCustomer && (
                      <Check className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-green-500" />
                    )}
                  </div>
                </FormControl>
                {isRecognized && (
                  <p className="text-xs text-green-600">
                    Welcome back, {returningCustomer?.firstName}!
                  </p>
                )}
                <FormMessage />
              </FormItem>
            )}
          />

          {/* Email field (optional) */}
          <FormField
            control={form.control}
            name="email"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Email <span className="text-muted-foreground font-normal">(optional)</span></FormLabel>
                <FormControl>
                  <Input
                    {...field}
                    type="email"
                    placeholder="john@example.com"
                    onChange={(e) => {
                      field.onChange(e);
                      handleFieldChange('email', e.target.value);
                    }}
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          {/* Preferred Contact Method */}
          <FormField
            control={form.control}
            name="preferredContact"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Preferred Contact Method</FormLabel>
                <FormControl>
                  <RadioGroup
                    value={field.value}
                    onValueChange={(value) => {
                      field.onChange(value);
                      handleFieldChange('preferredContact', value);
                    }}
                    className="flex flex-wrap gap-4"
                  >
                    {PREFERRED_CONTACT_OPTIONS.map((option) => (
                      <div key={option.value} className="flex items-center space-x-2">
                        <RadioGroupItem value={option.value} id={`contact-${option.value}`} />
                        <Label htmlFor={`contact-${option.value}`} className="cursor-pointer">
                          {option.label}
                        </Label>
                      </div>
                    ))}
                  </RadioGroup>
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          {/* Create Account Option */}
          <Separator />
          <div className="space-y-3">
            <div className="flex items-start gap-2">
              <Checkbox
                id="create-account"
                checked={createAccount}
                onCheckedChange={(checked) => {
                  const val = checked as boolean;
                  onCreateAccountChange(val);
                  form.setValue('createAccount', val);
                  if (!val) {
                    onAccountPasswordChange('');
                    form.setValue('accountPassword', '');
                  }
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
              <FormField
                control={form.control}
                name="accountPassword"
                render={({ field }) => (
                  <FormItem className="pl-6">
                    <FormLabel required>Password</FormLabel>
                    <FormControl>
                      <Input
                        {...field}
                        type="password"
                        placeholder="At least 8 characters"
                        onChange={(e) => {
                          field.onChange(e);
                          onAccountPasswordChange(e.target.value);
                        }}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            )}
          </div>
        </div>
      </Form>
    </motion.div>
  );
}
