/**
 * Smart ZIP code chip input with Mapbox geocoding
 * Shows "90210 — Beverly Hills, CA" badges with status indicators
 */

import { useState, useRef } from 'react';
import { X, Loader2 } from 'lucide-react';

import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { cn } from '@/lib/utils';
import { geocodeZipCode } from '@/lib/deliveryZoneHelpers';
import { toast } from 'sonner';

import type { ZipChip } from '@/types/setup-wizard';

interface ZipCodeInputProps {
  value: ZipChip[];
  onChange: (chips: ZipChip[]) => void;
  mapboxToken: string | null;
  disabled?: boolean;
}

const ZIP_REGEX = /^\d{5}$/;

export function ZipCodeInput({ value, onChange, mapboxToken, disabled }: ZipCodeInputProps) {
  const [inputValue, setInputValue] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);

  const addZip = async (raw: string) => {
    const zip = raw.trim();
    if (!zip) return;

    // Validate format
    if (!ZIP_REGEX.test(zip)) {
      toast.error(`"${zip}" is not a valid 5-digit ZIP code`);
      return;
    }

    // Check duplicates
    if (value.some((c) => c.zip === zip)) {
      toast.info(`ZIP ${zip} is already added`);
      return;
    }

    // Add loading chip
    const loadingChip: ZipChip = {
      zip,
      city: '',
      state: '',
      lat: 0,
      lng: 0,
      status: 'loading',
    };
    const withLoading = [...value, loadingChip];
    onChange(withLoading);

    // Geocode if token available
    if (mapboxToken) {
      const result = await geocodeZipCode(zip, mapboxToken);
      const finalChip: ZipChip = result
        ? { zip, city: result.city, state: result.state, lat: result.lat, lng: result.lng, status: 'valid' }
        : { zip, city: '', state: '', lat: 0, lng: 0, status: 'not_found' };

      onChange(withLoading.map((c) => (c.zip === zip && c.status === 'loading' ? finalChip : c)));
    } else {
      // No token — mark as valid with no geo data
      const basicChip: ZipChip = { zip, city: '', state: '', lat: 0, lng: 0, status: 'valid' };
      onChange(withLoading.map((c) => (c.zip === zip && c.status === 'loading' ? basicChip : c)));
    }
  };

  const removeZip = (zip: string) => {
    onChange(value.filter((c) => c.zip !== zip));
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' || e.key === ',' || e.key === ' ') {
      e.preventDefault();
      if (inputValue.trim()) {
        addZip(inputValue);
        setInputValue('');
      }
    }
    // Backspace on empty removes last chip
    if (e.key === 'Backspace' && !inputValue && value.length > 0) {
      removeZip(value[value.length - 1].zip);
    }
  };

  const handlePaste = async (e: React.ClipboardEvent<HTMLInputElement>) => {
    e.preventDefault();
    const text = e.clipboardData.getData('text');
    const zips = text.split(/[,\s]+/).filter(Boolean);
    for (const z of zips) {
      await addZip(z);
    }
  };

  const chipLabel = (chip: ZipChip) => {
    if (chip.status === 'loading') return chip.zip;
    if (chip.city && chip.state) return `${chip.zip} — ${chip.city}, ${chip.state}`;
    if (chip.city) return `${chip.zip} — ${chip.city}`;
    return chip.zip;
  };

  const chipClassName = (chip: ZipChip) => {
    switch (chip.status) {
      case 'valid':
        return 'bg-green-50 text-green-800 border-green-200 hover:bg-green-100';
      case 'not_found':
        return 'bg-yellow-50 text-yellow-800 border-yellow-200 hover:bg-yellow-100';
      case 'invalid':
        return 'bg-red-50 text-red-800 border-red-200 hover:bg-red-100';
      case 'loading':
        return 'bg-muted text-muted-foreground border-border';
    }
  };

  return (
    <div
      className={cn(
        'flex flex-wrap items-center gap-1.5 rounded-md border border-input bg-background px-3 py-2 min-h-[42px] cursor-text',
        disabled && 'opacity-50 pointer-events-none'
      )}
      onClick={() => inputRef.current?.focus()}
    >
      {value.map((chip) => (
        <Badge
          key={chip.zip}
          variant="outline"
          className={cn('gap-1 pr-1 text-xs font-normal', chipClassName(chip))}
        >
          {chip.status === 'loading' && <Loader2 className="h-3 w-3 animate-spin" />}
          {chipLabel(chip)}
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              removeZip(chip.zip);
            }}
            className="ml-0.5 rounded-full p-0.5 hover:bg-black/10 min-h-[22px] min-w-[22px] flex items-center justify-center"
            aria-label={`Remove ZIP ${chip.zip}`}
          >
            <X className="h-3 w-3" />
          </button>
        </Badge>
      ))}
      <Input
        ref={inputRef}
        value={inputValue}
        onChange={(e) => setInputValue(e.target.value)}
        onKeyDown={handleKeyDown}
        onPaste={handlePaste}
        onBlur={() => {
          if (inputValue.trim()) {
            addZip(inputValue);
            setInputValue('');
          }
        }}
        placeholder={value.length === 0 ? 'Type ZIP codes (e.g., 90210)' : ''}
        disabled={disabled}
        className="border-0 shadow-none p-0 h-7 min-w-[120px] flex-1 focus-visible:ring-0"
      />
    </div>
  );
}
