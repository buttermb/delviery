import { useState, useEffect, useRef } from "react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { MapPin, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";

const MAPBOX_TOKEN = "pk.eyJ1IjoiYnV1dGVybWIiLCJhIjoiY21nNzNrd3U3MGlyNjJqcTNlMnhsenFwbCJ9.Ss9KyWJkDeSvZilooUFZgA";

interface AddressSuggestion {
  id: string;
  place_name: string;
  text: string;
  center: [number, number]; // [lng, lat]
  context?: Array<{
    id: string;
    text: string;
  }>;
}

interface MapboxAddressAutocompleteProps {
  value: string;
  onChange: (address: string, lat?: number, lng?: number, borough?: string) => void;
  placeholder?: string;
  className?: string;
}

export default function MapboxAddressAutocomplete({
  value,
  onChange,
  placeholder = "Enter delivery address",
  className,
}: MapboxAddressAutocompleteProps) {
  const [suggestions, setSuggestions] = useState<AddressSuggestion[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const debounceTimer = useRef<NodeJS.Timeout>();
  const wrapperRef = useRef<HTMLDivElement>(null);

  // Close suggestions when clicking outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (wrapperRef.current && !wrapperRef.current.contains(event.target as Node)) {
        setShowSuggestions(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const fetchSuggestions = async (query: string) => {
    if (query.length < 3) {
      setSuggestions([]);
      return;
    }

    setIsLoading(true);
    try {
      // Limit search to New York City area
      const bbox = "-74.2591,40.4774,-73.7004,40.9176"; // NYC bounding box
      const response = await fetch(
        `https://api.mapbox.com/geocoding/v5/mapbox.places/${encodeURIComponent(query)}.json?` +
        `access_token=${MAPBOX_TOKEN}&` +
        `bbox=${bbox}&` +
        `proximity=-73.935242,40.730610&` + // NYC center
        `types=address&` +
        `limit=5`
      );

      if (!response.ok) {
        throw new Error("Failed to fetch suggestions");
      }

      const data = await response.json();
      setSuggestions(data.features || []);
      setShowSuggestions(true);
    } catch (error) {
      console.error("Error fetching address suggestions:", error);
      setSuggestions([]);
    } finally {
      setIsLoading(false);
    }
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newValue = e.target.value;
    onChange(newValue);

    if (debounceTimer.current) {
      clearTimeout(debounceTimer.current);
    }

    debounceTimer.current = setTimeout(() => {
      fetchSuggestions(newValue);
    }, 300);
  };

  const handleSelectSuggestion = (suggestion: AddressSuggestion) => {
    const [lng, lat] = suggestion.center;
    
    // Extract borough from context (only Brooklyn, Queens, Manhattan)
    let borough = "";
    
    // Check context array for borough info
    if (suggestion.context) {
      // Try place context first
      const placeContext = suggestion.context.find(c => c.id.startsWith("place"));
      if (placeContext) {
        const boroughName = placeContext.text.toLowerCase();
        if (boroughName.includes("brooklyn")) borough = "brooklyn";
        else if (boroughName.includes("queens")) borough = "queens";
        else if (boroughName.includes("manhattan")) borough = "manhattan";
      }
      
      // If not found, try locality context
      if (!borough) {
        const localityContext = suggestion.context.find(c => c.id.startsWith("locality"));
        if (localityContext) {
          const localityName = localityContext.text.toLowerCase();
          if (localityName.includes("brooklyn")) borough = "brooklyn";
          else if (localityName.includes("queens")) borough = "queens";
          else if (localityName.includes("manhattan")) borough = "manhattan";
        }
      }
    }
    
    // Fallback: check the full place_name
    if (!borough) {
      const placeName = suggestion.place_name.toLowerCase();
      if (placeName.includes("brooklyn")) borough = "brooklyn";
      else if (placeName.includes("queens")) borough = "queens";
      else if (placeName.includes("manhattan")) borough = "manhattan";
      // If it says "New York, New York" it's likely Manhattan
      else if (placeName.includes("new york, new york") && !placeName.includes("brooklyn") && !placeName.includes("queens")) {
        borough = "manhattan";
      }
    }

    onChange(suggestion.place_name, lat, lng, borough);
    setShowSuggestions(false);
    setSuggestions([]);
  };

  return (
    <div ref={wrapperRef} className={cn("relative", className)}>
      <Label htmlFor="address" className="mb-2 block">Street Address</Label>
      <div className="relative">
        <MapPin className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
        <Input
          id="address"
          value={value}
          onChange={handleInputChange}
          placeholder={placeholder}
          className="pl-10"
          autoComplete="off"
        />
        {isLoading && (
          <Loader2 className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 animate-spin text-muted-foreground" />
        )}
      </div>

      {showSuggestions && suggestions.length > 0 && (
        <div className="absolute z-50 w-full mt-1 bg-background border rounded-lg shadow-lg max-h-60 overflow-y-auto">
          {suggestions.map((suggestion) => (
            <button
              key={suggestion.id}
              type="button"
              onClick={() => handleSelectSuggestion(suggestion)}
              className="w-full px-4 py-3 text-left hover:bg-muted/50 transition-colors flex items-start gap-2 border-b last:border-b-0"
            >
              <MapPin className="w-4 h-4 mt-1 text-primary flex-shrink-0" />
              <div className="flex-1 min-w-0">
                <div className="font-medium text-sm truncate">{suggestion.text}</div>
                <div className="text-xs text-muted-foreground truncate">
                  {suggestion.place_name}
                </div>
              </div>
            </button>
          ))}
        </div>
      )}

      {showSuggestions && suggestions.length === 0 && !isLoading && value.length >= 3 && (
        <div className="absolute z-50 w-full mt-1 bg-background border rounded-lg shadow-lg p-4 text-center text-sm text-muted-foreground">
          No addresses found. Try a different search.
        </div>
      )}
    </div>
  );
}
