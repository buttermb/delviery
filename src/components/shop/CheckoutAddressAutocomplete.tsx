/**
 * Checkout Address Autocomplete
 * Enhanced address input with Google Places-style autocomplete using Mapbox
 * Also supports saved addresses for returning customers
 */

import { useState, useEffect, useRef, useCallback } from 'react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { MapPin, Loader2, Clock, ChevronDown, Check } from 'lucide-react';
import { cn } from '@/lib/utils';
import { logger } from '@/lib/logger';

interface AddressSuggestion {
  id: string;
  place_name: string;
  text: string;
  context: Array<{ id: string; text: string; short_code?: string }>;
  center: [number, number];
}

interface ParsedAddress {
  street: string;
  city: string;
  state: string;
  zip: string;
  formatted: string;
  lat?: number;
  lng?: number;
}

interface SavedAddress {
  id: string;
  street: string;
  apartment?: string;
  city: string;
  state: string;
  zip: string;
  label?: string;
}

interface CheckoutAddressAutocompleteProps {
  onAddressSelect: (address: ParsedAddress) => void;
  savedAddresses?: SavedAddress[];
  onSaveAddress?: (address: SavedAddress) => void;
  defaultValue?: string;
  className?: string;
  placeholder?: string;
}

// Parse Mapbox response into structured address
function parseMapboxAddress(suggestion: AddressSuggestion): ParsedAddress {
  const address: ParsedAddress = {
    street: suggestion.text || '',
    city: '',
    state: '',
    zip: '',
    formatted: suggestion.place_name,
    lat: suggestion.center?.[1],
    lng: suggestion.center?.[0],
  };

  // Parse context for city, state, zip
  if (suggestion.context) {
    for (const ctx of suggestion.context) {
      if (ctx.id.startsWith('place')) {
        address.city = ctx.text;
      } else if (ctx.id.startsWith('region')) {
        address.state = ctx.short_code?.replace('US-', '') || ctx.text;
      } else if (ctx.id.startsWith('postcode')) {
        address.zip = ctx.text;
      }
    }
  }

  // If street is just a place name (not a full address), use formatted
  if (!address.street.includes(' ')) {
    address.street = suggestion.place_name.split(',')[0] || suggestion.text;
  }

  return address;
}

export function CheckoutAddressAutocomplete({
  onAddressSelect,
  savedAddresses = [],
  onSaveAddress,
  defaultValue = '',
  className,
  placeholder = 'Start typing your address...',
}: CheckoutAddressAutocompleteProps) {
  const [inputValue, setInputValue] = useState(defaultValue);
  const [suggestions, setSuggestions] = useState<AddressSuggestion[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [showSavedAddresses, setShowSavedAddresses] = useState(false);
  const [selectedSavedId, setSelectedSavedId] = useState<string | null>(null);
  const wrapperRef = useRef<HTMLDivElement>(null);
  const debounceRef = useRef<NodeJS.Timeout>();
  const inputRef = useRef<HTMLInputElement>(null);

  // Close dropdowns when clicking outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (wrapperRef.current && !wrapperRef.current.contains(event.target as Node)) {
        setShowSuggestions(false);
        setShowSavedAddresses(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Fetch suggestions from Mapbox
  const fetchSuggestions = useCallback(async (query: string) => {
    if (!query || query.length < 3) {
      setSuggestions([]);
      return;
    }

    setIsLoading(true);

    try {
      const mapboxToken = import.meta.env.VITE_MAPBOX_TOKEN;
      
      if (!mapboxToken) {
        logger.warn('Mapbox token not configured for address autocomplete');
        setIsLoading(false);
        return;
      }

      const response = await fetch(
        `https://api.mapbox.com/geocoding/v5/mapbox.places/${encodeURIComponent(query)}.json?` +
        `access_token=${mapboxToken}&` +
        `autocomplete=true&` +
        `country=us&` +
        `types=address&` +
        `limit=5`
      );

      if (!response.ok) {
        throw new Error('Failed to fetch suggestions');
      }

      const data = await response.json();
      setSuggestions(data.features || []);
      setShowSuggestions(true);
    } catch (error) {
      logger.error('Error fetching address suggestions:', error);
      setSuggestions([]);
    } finally {
      setIsLoading(false);
    }
  }, []);

  // Handle input change with debouncing
  const handleInputChange = (value: string) => {
    setInputValue(value);
    setSelectedSavedId(null);
    setShowSavedAddresses(false);

    if (debounceRef.current) {
      clearTimeout(debounceRef.current);
    }

    debounceRef.current = setTimeout(() => {
      fetchSuggestions(value);
    }, 300);
  };

  // Handle suggestion selection
  const handleSelectSuggestion = (suggestion: AddressSuggestion) => {
    const parsed = parseMapboxAddress(suggestion);
    setInputValue(parsed.street);
    setShowSuggestions(false);
    setSuggestions([]);
    onAddressSelect(parsed);
  };

  // Handle saved address selection
  const handleSelectSavedAddress = (saved: SavedAddress) => {
    setInputValue(saved.street);
    setSelectedSavedId(saved.id);
    setShowSavedAddresses(false);
    onAddressSelect({
      street: saved.street,
      city: saved.city,
      state: saved.state,
      zip: saved.zip,
      formatted: `${saved.street}, ${saved.city}, ${saved.state} ${saved.zip}`,
    });
  };

  const hasSavedAddresses = savedAddresses.length > 0;

  return (
    <div ref={wrapperRef} className={cn("relative", className)}>
      {/* Saved Addresses Toggle */}
      {hasSavedAddresses && (
        <div className="mb-3">
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => setShowSavedAddresses(!showSavedAddresses)}
            className="w-full justify-between text-sm"
          >
            <span className="flex items-center gap-2">
              <Clock className="w-4 h-4" />
              Use a saved address
            </span>
            <ChevronDown className={cn(
              "w-4 h-4 transition-transform",
              showSavedAddresses && "rotate-180"
            )} />
          </Button>
          
          {/* Saved Addresses Dropdown */}
          {showSavedAddresses && (
            <div className="absolute z-50 w-full mt-1 bg-popover border border-border rounded-md shadow-lg max-h-48 overflow-auto">
              {savedAddresses.map((saved) => (
                <button
                  key={saved.id}
                  type="button"
                  onClick={() => handleSelectSavedAddress(saved)}
                  className={cn(
                    "w-full text-left px-3 py-2.5 hover:bg-accent hover:text-accent-foreground transition-colors flex items-start gap-2 border-b border-border last:border-0",
                    selectedSavedId === saved.id && "bg-accent/50"
                  )}
                >
                  <MapPin className="w-4 h-4 mt-0.5 flex-shrink-0 text-muted-foreground" />
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-sm">
                      {saved.label || saved.street}
                    </p>
                    <p className="text-xs text-muted-foreground truncate">
                      {saved.street}{saved.apartment ? `, ${saved.apartment}` : ''}, {saved.city}, {saved.state} {saved.zip}
                    </p>
                  </div>
                  {selectedSavedId === saved.id && (
                    <Check className="w-4 h-4 text-primary flex-shrink-0" />
                  )}
                </button>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Address Input */}
      <div className="space-y-2">
        <Label htmlFor="address-autocomplete" className="sr-only">
          Street Address
        </Label>
        <div className="relative">
          <Input
            ref={inputRef}
            id="address-autocomplete"
            value={inputValue}
            onChange={(e) => handleInputChange(e.target.value)}
            onFocus={() => {
              if (suggestions.length > 0) {
                setShowSuggestions(true);
              }
            }}
            placeholder={placeholder}
            className={cn("pr-10")}
            autoComplete="off"
          />
          <div className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none">
            {isLoading ? (
              <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
            ) : (
              <MapPin className="h-4 w-4 text-muted-foreground" />
            )}
          </div>
        </div>
      </div>

      {/* Suggestions Dropdown */}
      {showSuggestions && suggestions.length > 0 && (
        <div className="absolute z-50 w-full mt-1 bg-popover border border-border rounded-md shadow-lg max-h-60 overflow-auto">
          {suggestions.map((suggestion) => (
            <button
              key={suggestion.id}
              type="button"
              onClick={() => handleSelectSuggestion(suggestion)}
              className="w-full text-left px-3 py-2.5 hover:bg-accent hover:text-accent-foreground transition-colors flex items-start gap-2 border-b border-border last:border-0"
            >
              <MapPin className="h-4 w-4 mt-0.5 flex-shrink-0 text-muted-foreground" />
              <div className="flex-1 min-w-0">
                <p className="font-medium text-sm">{suggestion.text}</p>
                <p className="text-xs text-muted-foreground truncate">{suggestion.place_name}</p>
              </div>
            </button>
          ))}
        </div>
      )}

      {/* No results */}
      {showSuggestions && !isLoading && inputValue.length >= 3 && suggestions.length === 0 && (
        <div className="absolute z-50 w-full mt-1 bg-popover border border-border rounded-md shadow-lg p-3 text-sm text-muted-foreground">
          No addresses found. Try a different search.
        </div>
      )}

      {/* Powered by Mapbox attribution */}
      <p className="text-[10px] text-muted-foreground/50 mt-1">
        Powered by Mapbox
      </p>
    </div>
  );
}

export default CheckoutAddressAutocomplete;
