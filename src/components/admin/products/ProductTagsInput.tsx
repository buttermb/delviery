/**
 * Product Tags Input
 * Manages product tags as an array of strings
 */

import { useState, KeyboardEvent } from 'react';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { X } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface ProductTagsInputProps {
  value: string[];
  onChange: (tags: string[]) => void;
  placeholder?: string;
  maxTags?: number;
}

export function ProductTagsInput({
  value = [],
  onChange,
  placeholder = 'Add tag and press Enter...',
  maxTags = 10,
}: ProductTagsInputProps) {
  const [inputValue, setInputValue] = useState('');

  const handleKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' || e.key === ',') {
      e.preventDefault();
      addTag();
    } else if (e.key === 'Backspace' && !inputValue && value.length > 0) {
      // Remove last tag on backspace if input is empty
      removeTag(value.length - 1);
    }
  };

  const addTag = () => {
    const trimmedValue = inputValue.trim();
    if (!trimmedValue) return;

    // Check if tag already exists (case-insensitive)
    if (value.some((tag) => tag.toLowerCase() === trimmedValue.toLowerCase())) {
      setInputValue('');
      return;
    }

    // Check max tags limit
    if (value.length >= maxTags) {
      setInputValue('');
      return;
    }

    onChange([...value, trimmedValue]);
    setInputValue('');
  };

  const removeTag = (index: number) => {
    onChange(value.filter((_, i) => i !== index));
  };

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap gap-2 min-h-[2.5rem] p-2 border rounded-md bg-background">
        {value.map((tag, index) => (
          <Badge
            key={index}
            variant="secondary"
            className="pl-2 pr-1 py-1 text-xs flex items-center gap-1"
          >
            {tag}
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="h-4 w-4 p-0 hover:bg-transparent"
              onClick={() => removeTag(index)}
              aria-label={`Remove tag ${tag}`}
            >
              <X className="h-3 w-3" />
            </Button>
          </Badge>
        ))}
        <Input
          type="text"
          value={inputValue}
          onChange={(e) => setInputValue(e.target.value)}
          onKeyDown={handleKeyDown}
          onBlur={addTag}
          placeholder={value.length === 0 ? placeholder : ''}
          className="flex-1 min-w-[120px] border-0 focus-visible:ring-0 focus-visible:ring-offset-0 shadow-none px-0"
          disabled={value.length >= maxTags}
        />
      </div>
      <p className="text-xs text-muted-foreground">
        {value.length}/{maxTags} tags • Press Enter or comma to add
      </p>
    </div>
  );
}
