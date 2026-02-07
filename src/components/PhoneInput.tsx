import PhoneInputWithCountry from 'react-phone-number-input';
import 'react-phone-number-input/style.css';
import { cn } from '@/lib/utils';

interface PhoneInputProps {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  className?: string;
  error?: string;
}

export function PhoneInput({ value, onChange, placeholder, className, error }: PhoneInputProps) {
  return (
    <div className="space-y-2">
      <PhoneInputWithCountry
        international
        defaultCountry="US"
        value={value}
        onChange={(val) => onChange(val || '')}
        placeholder={placeholder}
        className={cn(
          'flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm',
          'ring-offset-background placeholder:text-muted-foreground',
          'focus-within:outline-none focus-within:ring-2 focus-within:ring-ring focus-within:ring-offset-2',
          error && 'border-destructive',
          className
        )}
        numberInputProps={{
          id: 'phone-number-input',
          name: 'phone',
          className: cn(
            'flex-1 bg-transparent outline-none',
            'placeholder:text-muted-foreground'
          )
        }}
      />
      {error && <p className="text-sm text-destructive">{error}</p>}
    </div>
  );
}
