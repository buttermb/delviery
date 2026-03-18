import * as React from 'react';
import { Controller, type Control, type FieldPath, type FieldValues } from 'react-hook-form';
import { format } from 'date-fns';
import { CalendarIcon, Check, ChevronsUpDown } from 'lucide-react';

import { cn } from '@/lib/utils';
import { Input } from '@/components/ui/input';
import { CurrencyInput, IntegerInput } from '@/components/ui/currency-input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import { Button } from '@/components/ui/button';
import { Calendar } from '@/components/ui/calendar';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from '@/components/ui/command';

/**
 * Base props shared by all form field components
 */
interface BaseFieldProps<TFieldValues extends FieldValues, TName extends FieldPath<TFieldValues>> {
  /** React Hook Form control object */
  control: Control<TFieldValues>;
  /** Field name matching the form schema */
  name: TName;
  /** Label text displayed above the field */
  label: string;
  /** Optional description text displayed below the label */
  description?: string;
  /** Whether the field is required */
  required?: boolean;
  /** Whether the field is disabled */
  disabled?: boolean;
  /** Additional className for the field wrapper */
  className?: string;
}

/**
 * Error message component for displaying validation errors
 */
function FieldError({ message }: { message?: string }) {
  if (!message) return null;
  return <p className="text-sm font-medium text-destructive mt-1">{message}</p>;
}

/**
 * Label component with optional required indicator
 */
function FieldLabel({
  htmlFor,
  label,
  required,
  description,
}: {
  htmlFor: string;
  label: string;
  required?: boolean;
  description?: string;
}) {
  return (
    <div className="space-y-1">
      <Label htmlFor={htmlFor}>
        {label}
        {required && <span className="text-destructive ml-1">*</span>}
      </Label>
      {description && (
        <p className="text-sm text-muted-foreground">{description}</p>
      )}
    </div>
  );
}

/**
 * TextField - Standard text input field
 *
 * Usage:
 * ```tsx
 * <TextField
 *   control={form.control}
 *   name="email"
 *   label="Email Address"
 *   placeholder="Enter your email"
 *   required
 * />
 * ```
 */
interface TextFieldProps<TFieldValues extends FieldValues, TName extends FieldPath<TFieldValues>>
  extends BaseFieldProps<TFieldValues, TName> {
  /** Input placeholder text */
  placeholder?: string;
  /** Input type (text, email, password, etc.) */
  type?: 'text' | 'email' | 'password' | 'tel' | 'url';
}

export function TextField<TFieldValues extends FieldValues, TName extends FieldPath<TFieldValues>>({
  control,
  name,
  label,
  description,
  placeholder,
  type = 'text',
  required,
  disabled,
  className,
}: TextFieldProps<TFieldValues, TName>) {
  return (
    <Controller
      control={control}
      name={name}
      render={({ field, fieldState: { error } }) => (
        <div className={cn('space-y-2', className)}>
          <FieldLabel
            htmlFor={name}
            label={label}
            required={required}
            description={description}
          />
          <Input
            {...field}
            id={name}
            type={type}
            placeholder={placeholder}
            disabled={disabled}
            error={!!error}
            value={field.value ?? ''}
          />
          <FieldError message={error?.message} />
        </div>
      )}
    />
  );
}

/**
 * NumberField - Numeric input field
 *
 * Usage:
 * ```tsx
 * <NumberField
 *   control={form.control}
 *   name="quantity"
 *   label="Quantity"
 *   min={0}
 *   max={100}
 *   step={1}
 * />
 * ```
 */
interface NumberFieldProps<TFieldValues extends FieldValues, TName extends FieldPath<TFieldValues>>
  extends BaseFieldProps<TFieldValues, TName> {
  /** Minimum allowed value */
  min?: number;
  /** Maximum allowed value */
  max?: number;
  /** Step increment for the input */
  step?: number;
  /** Input placeholder text */
  placeholder?: string;
  /** Variant: 'default' for standard number, 'currency' for price fields, 'integer' for whole numbers */
  variant?: 'default' | 'currency' | 'integer';
}

export function NumberField<TFieldValues extends FieldValues, TName extends FieldPath<TFieldValues>>({
  control,
  name,
  label,
  description,
  min,
  max,
  step,
  placeholder,
  required,
  disabled,
  className,
  variant = 'default',
}: NumberFieldProps<TFieldValues, TName>) {
  return (
    <Controller
      control={control}
      name={name}
      render={({ field, fieldState: { error } }) => (
        <div className={cn('space-y-2', className)}>
          <FieldLabel
            htmlFor={name}
            label={label}
            required={required}
            description={description}
          />
          {variant === 'currency' ? (
            <CurrencyInput
              id={name}
              placeholder={placeholder}
              disabled={disabled}
              error={!!error}
              value={field.value ?? ''}
              onChange={(e) => {
                const value = e.target.value;
                field.onChange(value === '' ? undefined : Number(value));
              }}
            />
          ) : variant === 'integer' ? (
            <IntegerInput
              id={name}
              min={min}
              max={max}
              placeholder={placeholder}
              disabled={disabled}
              error={!!error}
              value={field.value ?? ''}
              onChange={(e) => {
                const value = e.target.value;
                field.onChange(value === '' ? undefined : parseInt(value, 10));
              }}
            />
          ) : (
            <Input
              {...field}
              id={name}
              type="number"
              min={min}
              max={max}
              step={step}
              placeholder={placeholder}
              disabled={disabled}
              error={!!error}
              value={field.value ?? ''}
              onChange={(e) => {
                const value = e.target.value;
                field.onChange(value === '' ? undefined : Number(value));
              }}
            />
          )}
          <FieldError message={error?.message} />
        </div>
      )}
    />
  );
}

/**
 * TextareaField - Multi-line text input field
 *
 * Usage:
 * ```tsx
 * <TextareaField
 *   control={form.control}
 *   name="description"
 *   label="Description"
 *   placeholder="Enter description..."
 *   rows={4}
 * />
 * ```
 */
interface TextareaFieldProps<TFieldValues extends FieldValues, TName extends FieldPath<TFieldValues>>
  extends BaseFieldProps<TFieldValues, TName> {
  /** Input placeholder text */
  placeholder?: string;
  /** Number of visible text rows */
  rows?: number;
}

export function TextareaField<TFieldValues extends FieldValues, TName extends FieldPath<TFieldValues>>({
  control,
  name,
  label,
  description,
  placeholder,
  rows = 3,
  required,
  disabled,
  className,
}: TextareaFieldProps<TFieldValues, TName>) {
  return (
    <Controller
      control={control}
      name={name}
      render={({ field, fieldState: { error } }) => (
        <div className={cn('space-y-2', className)}>
          <FieldLabel
            htmlFor={name}
            label={label}
            required={required}
            description={description}
          />
          <Textarea
            {...field}
            id={name}
            placeholder={placeholder}
            rows={rows}
            disabled={disabled}
            error={!!error}
            value={field.value ?? ''}
          />
          <FieldError message={error?.message} />
        </div>
      )}
    />
  );
}

/**
 * SelectField - Dropdown select field
 *
 * Usage:
 * ```tsx
 * <SelectField
 *   control={form.control}
 *   name="status"
 *   label="Status"
 *   placeholder="Select status"
 *   options={[
 *     { value: 'active', label: 'Active' },
 *     { value: 'inactive', label: 'Inactive' },
 *   ]}
 * />
 * ```
 */
interface SelectOption {
  /** Option value */
  value: string;
  /** Display label */
  label: string;
}

interface SelectFieldProps<TFieldValues extends FieldValues, TName extends FieldPath<TFieldValues>>
  extends BaseFieldProps<TFieldValues, TName> {
  /** Select options */
  options: SelectOption[];
  /** Placeholder text when no option is selected */
  placeholder?: string;
}

export function SelectField<TFieldValues extends FieldValues, TName extends FieldPath<TFieldValues>>({
  control,
  name,
  label,
  description,
  options,
  placeholder = 'Select an option',
  required,
  disabled,
  className,
}: SelectFieldProps<TFieldValues, TName>) {
  return (
    <Controller
      control={control}
      name={name}
      render={({ field, fieldState: { error } }) => (
        <div className={cn('space-y-2', className)}>
          <FieldLabel
            htmlFor={name}
            label={label}
            required={required}
            description={description}
          />
          <Select
            value={field.value ?? ''}
            onValueChange={field.onChange}
            disabled={disabled}
          >
            <SelectTrigger
              id={name}
              className={cn(error && 'border-destructive focus-visible:ring-destructive')}
            >
              <SelectValue placeholder={placeholder} />
            </SelectTrigger>
            <SelectContent>
              {options.map((option) => (
                <SelectItem key={option.value} value={option.value}>
                  {option.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <FieldError message={error?.message} />
        </div>
      )}
    />
  );
}

/**
 * DateField - Date picker field
 *
 * Usage:
 * ```tsx
 * <DateField
 *   control={form.control}
 *   name="dueDate"
 *   label="Due Date"
 *   placeholder="Pick a date"
 * />
 * ```
 */
interface DateFieldProps<TFieldValues extends FieldValues, TName extends FieldPath<TFieldValues>>
  extends BaseFieldProps<TFieldValues, TName> {
  /** Placeholder text when no date is selected */
  placeholder?: string;
  /** Minimum selectable date */
  minDate?: Date;
  /** Maximum selectable date */
  maxDate?: Date;
}

export function DateField<TFieldValues extends FieldValues, TName extends FieldPath<TFieldValues>>({
  control,
  name,
  label,
  description,
  placeholder = 'Pick a date',
  minDate,
  maxDate,
  required,
  disabled,
  className,
}: DateFieldProps<TFieldValues, TName>) {
  return (
    <Controller
      control={control}
      name={name}
      render={({ field, fieldState: { error } }) => (
        <div className={cn('space-y-2', className)}>
          <FieldLabel
            htmlFor={name}
            label={label}
            required={required}
            description={description}
          />
          <Popover>
            <PopoverTrigger asChild>
              <Button
                id={name}
                variant="outline"
                disabled={disabled}
                className={cn(
                  'w-full justify-start text-left font-normal',
                  !field.value && 'text-muted-foreground',
                  error && 'border-destructive focus-visible:ring-destructive'
                )}
              >
                <CalendarIcon className="mr-2 h-4 w-4" />
                {field.value ? format(new Date(field.value), 'PPP') : placeholder}
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-auto p-0" align="start">
              <Calendar
                mode="single"
                selected={field.value ? new Date(field.value) : undefined}
                onSelect={(date) => field.onChange(date)}
                disabled={(date) => {
                  if (minDate && date < minDate) return true;
                  if (maxDate && date > maxDate) return true;
                  return false;
                }}
                initialFocus
              />
            </PopoverContent>
          </Popover>
          <FieldError message={error?.message} />
        </div>
      )}
    />
  );
}

/**
 * SwitchField - Toggle switch field
 *
 * Usage:
 * ```tsx
 * <SwitchField
 *   control={form.control}
 *   name="isActive"
 *   label="Active"
 *   description="Enable or disable this feature"
 * />
 * ```
 */
type SwitchFieldProps<TFieldValues extends FieldValues, TName extends FieldPath<TFieldValues>> =
  BaseFieldProps<TFieldValues, TName>;

export function SwitchField<TFieldValues extends FieldValues, TName extends FieldPath<TFieldValues>>({
  control,
  name,
  label,
  description,
  required,
  disabled,
  className,
}: SwitchFieldProps<TFieldValues, TName>) {
  return (
    <Controller
      control={control}
      name={name}
      render={({ field, fieldState: { error } }) => (
        <div className={cn('flex items-center justify-between rounded-lg border p-4', className)}>
          <div className="space-y-0.5">
            <Label htmlFor={name}>
              {label}
              {required && <span className="text-destructive ml-1">*</span>}
            </Label>
            {description && (
              <p className="text-sm text-muted-foreground">{description}</p>
            )}
            <FieldError message={error?.message} />
          </div>
          <Switch
            id={name}
            checked={field.value ?? false}
            onCheckedChange={field.onChange}
            disabled={disabled}
          />
        </div>
      )}
    />
  );
}

/**
 * ComboboxField - Searchable dropdown field with autocomplete
 *
 * Usage:
 * ```tsx
 * <ComboboxField
 *   control={form.control}
 *   name="category"
 *   label="Category"
 *   placeholder="Select category"
 *   searchPlaceholder="Search categories..."
 *   emptyText="No category found."
 *   options={[
 *     { value: 'electronics', label: 'Electronics' },
 *     { value: 'clothing', label: 'Clothing' },
 *   ]}
 * />
 * ```
 */
interface ComboboxFieldProps<TFieldValues extends FieldValues, TName extends FieldPath<TFieldValues>>
  extends BaseFieldProps<TFieldValues, TName> {
  /** Combobox options */
  options: SelectOption[];
  /** Placeholder text when no option is selected */
  placeholder?: string;
  /** Placeholder text for the search input */
  searchPlaceholder?: string;
  /** Text shown when no options match the search */
  emptyText?: string;
}

export function ComboboxField<TFieldValues extends FieldValues, TName extends FieldPath<TFieldValues>>({
  control,
  name,
  label,
  description,
  options,
  placeholder = 'Select an option',
  searchPlaceholder = 'Search...',
  emptyText = 'No option found.',
  required,
  disabled,
  className,
}: ComboboxFieldProps<TFieldValues, TName>) {
  const [open, setOpen] = React.useState(false);

  return (
    <Controller
      control={control}
      name={name}
      render={({ field, fieldState: { error } }) => {
        const selectedOption = options.find((opt) => opt.value === field.value);

        return (
          <div className={cn('space-y-2', className)}>
            <FieldLabel
              htmlFor={name}
              label={label}
              required={required}
              description={description}
            />
            <Popover open={open} onOpenChange={setOpen}>
              <PopoverTrigger asChild>
                <Button
                  id={name}
                  variant="outline"
                  role="combobox"
                  aria-expanded={open}
                  disabled={disabled}
                  className={cn(
                    'w-full justify-between font-normal',
                    !field.value && 'text-muted-foreground',
                    error && 'border-destructive focus-visible:ring-destructive'
                  )}
                >
                  {selectedOption?.label ?? placeholder}
                  <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-full p-0" align="start">
                <Command>
                  <CommandInput placeholder={searchPlaceholder} />
                  <CommandList>
                    <CommandEmpty>{emptyText}</CommandEmpty>
                    <CommandGroup>
                      {options.map((option) => (
                        <CommandItem
                          key={option.value}
                          value={option.value}
                          onSelect={(currentValue) => {
                            field.onChange(currentValue === field.value ? '' : currentValue);
                            setOpen(false);
                          }}
                        >
                          <Check
                            className={cn(
                              'mr-2 h-4 w-4',
                              field.value === option.value ? 'opacity-100' : 'opacity-0'
                            )}
                          />
                          {option.label}
                        </CommandItem>
                      ))}
                    </CommandGroup>
                  </CommandList>
                </Command>
              </PopoverContent>
            </Popover>
            <FieldError message={error?.message} />
          </div>
        );
      }}
    />
  );
}

export default {
  TextField,
  NumberField,
  TextareaField,
  SelectField,
  DateField,
  SwitchField,
  ComboboxField,
};
