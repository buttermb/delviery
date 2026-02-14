/**
 * CustomerInlineEdit - Click-to-edit for customer fields
 * Reduces friction: Click field → Edit inline → Enter saves
 */

import React, { useState, useRef, useEffect } from 'react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Check, X, Pencil, Loader2, Phone, Mail } from 'lucide-react';
import { cn } from '@/lib/utils';

type FieldType = 'text' | 'email' | 'phone';

interface CustomerInlineEditProps {
  value: string;
  onSave: (newValue: string) => Promise<void>;
  fieldType?: FieldType;
  placeholder?: string;
  className?: string;
  showIcon?: boolean;
}

export function CustomerInlineEdit({
  value,
  onSave,
  fieldType = 'text',
  placeholder = 'Click to add',
  className,
  showIcon = true,
}: CustomerInlineEditProps) {
  const [isEditing, setIsEditing] = useState(false);
  const [editValue, setEditValue] = useState(value);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (isEditing && inputRef.current) {
      inputRef.current.focus();
      inputRef.current.select();
    }
  }, [isEditing]);

  useEffect(() => {
    setEditValue(value);
  }, [value]);

  const validate = (val: string): string | null => {
    if (!val.trim()) return null; // Empty is allowed

    if (fieldType === 'email') {
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(val)) {
        return 'Invalid email format';
      }
    }

    if (fieldType === 'phone') {
      const phoneRegex = /^[\d\s\-\+\(\)]+$/;
      if (!phoneRegex.test(val) || val.replace(/\D/g, '').length < 10) {
        return 'Invalid phone format';
      }
    }

    return null;
  };

  const handleSave = async () => {
    const trimmedValue = editValue.trim();
    const validationError = validate(trimmedValue);
    
    if (validationError) {
      setError(validationError);
      return;
    }

    if (trimmedValue === value) {
      setIsEditing(false);
      setError(null);
      return;
    }

    setIsSaving(true);
    setError(null);
    try {
      await onSave(trimmedValue);
      setIsEditing(false);
    } catch {
      setError('Failed to save');
      setEditValue(value);
    } finally {
      setIsSaving(false);
    }
  };

  const handleCancel = () => {
    setEditValue(value);
    setIsEditing(false);
    setError(null);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      handleSave();
    } else if (e.key === 'Escape') {
      handleCancel();
    }
  };

  const getIcon = () => {
    if (fieldType === 'phone') return <Phone className="h-3 w-3" />;
    if (fieldType === 'email') return <Mail className="h-3 w-3" />;
    return null;
  };

  const getInputType = () => {
    if (fieldType === 'email') return 'email';
    if (fieldType === 'phone') return 'tel';
    return 'text';
  };

  const handleDirectAction = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (fieldType === 'phone' && value) {
      window.location.href = `tel:${value}`;
    } else if (fieldType === 'email' && value) {
      window.location.href = `mailto:${value}`;
    }
  };

  if (isEditing) {
    return (
      <div className={cn("flex flex-col gap-1", className)}>
        <div className="flex items-center gap-1">
          <Input
            ref={inputRef}
            type={getInputType()}
            value={editValue}
            onChange={(e) => {
              setEditValue(e.target.value);
              setError(null);
            }}
            onKeyDown={handleKeyDown}
            placeholder={placeholder}
            className={cn(
              "h-7 text-sm flex-1",
              error && "border-destructive focus-visible:ring-destructive"
            )}
            disabled={isSaving}
          />
          <Button
            variant="ghost"
            size="icon"
            className="h-7 w-7 text-success hover:text-success"
            onClick={handleSave}
            disabled={isSaving}
          >
            {isSaving ? <Loader2 className="h-3 w-3 animate-spin" /> : <Check className="h-3 w-3" />}
          </Button>
          <Button
            variant="ghost"
            size="icon"
            className="h-7 w-7 text-muted-foreground hover:text-destructive"
            onClick={handleCancel}
            disabled={isSaving}
          >
            <X className="h-3 w-3" />
          </Button>
        </div>
        {error && (
          <span className="text-xs text-destructive">{error}</span>
        )}
      </div>
    );
  }

  return (
    <div className={cn("flex items-center gap-1 group", className)}>
      {showIcon && value && (
        <button
          onClick={handleDirectAction}
          className="text-muted-foreground hover:text-primary transition-colors"
          title={fieldType === 'phone' ? 'Call' : fieldType === 'email' ? 'Email' : undefined}
        >
          {getIcon()}
        </button>
      )}
      
      <button
        onClick={() => setIsEditing(true)}
        className={cn(
          "text-sm text-left transition-colors flex items-center gap-1",
          value ? "text-foreground hover:text-primary" : "text-muted-foreground hover:text-foreground",
          "group-hover:underline"
        )}
        disabled={isSaving}
      >
        {isSaving ? (
          <Loader2 className="h-3 w-3 animate-spin" />
        ) : (
          <>
            <span>{value || placeholder}</span>
            <Pencil className="h-3 w-3 opacity-0 group-hover:opacity-100 transition-opacity" />
          </>
        )}
      </button>
    </div>
  );
}
