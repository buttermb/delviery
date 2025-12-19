/**
 * InlineStockEdit - Click-to-edit stock quantity component
 * Reduces friction: Click stock number → Edit inline → Enter saves
 */

import React, { useState, useRef, useEffect } from 'react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Check, X, Minus, Plus, Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';

interface InlineStockEditProps {
  value: number;
  onSave: (newValue: number) => Promise<void>;
  min?: number;
  max?: number;
  lowStockThreshold?: number;
  className?: string;
}

export function InlineStockEdit({
  value,
  onSave,
  min = 0,
  max = 99999,
  lowStockThreshold = 10,
  className,
}: InlineStockEditProps) {
  const [isEditing, setIsEditing] = useState(false);
  const [editValue, setEditValue] = useState(value.toString());
  const [isSaving, setIsSaving] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (isEditing && inputRef.current) {
      inputRef.current.focus();
      inputRef.current.select();
    }
  }, [isEditing]);

  const handleSave = async () => {
    const numValue = parseInt(editValue, 10);
    if (isNaN(numValue) || numValue < min || numValue > max) {
      setEditValue(value.toString());
      setIsEditing(false);
      return;
    }

    if (numValue === value) {
      setIsEditing(false);
      return;
    }

    setIsSaving(true);
    try {
      await onSave(numValue);
      setIsEditing(false);
    } catch (error) {
      setEditValue(value.toString());
    } finally {
      setIsSaving(false);
    }
  };

  const handleCancel = () => {
    setEditValue(value.toString());
    setIsEditing(false);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      handleSave();
    } else if (e.key === 'Escape') {
      handleCancel();
    }
  };

  const handleQuickAdjust = async (delta: number) => {
    const newValue = Math.max(min, Math.min(max, value + delta));
    if (newValue !== value) {
      setIsSaving(true);
      try {
        await onSave(newValue);
      } finally {
        setIsSaving(false);
      }
    }
  };

  const getStockStatus = () => {
    if (value === 0) return 'out';
    if (value <= lowStockThreshold) return 'low';
    return 'ok';
  };

  const stockStatus = getStockStatus();

  if (isEditing) {
    return (
      <div className={cn("flex items-center gap-1", className)}>
        <Input
          ref={inputRef}
          type="number"
          value={editValue}
          onChange={(e) => setEditValue(e.target.value)}
          onKeyDown={handleKeyDown}
          onBlur={handleSave}
          min={min}
          max={max}
          className="w-20 h-7 text-sm"
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
    );
  }

  return (
    <div className={cn("flex items-center gap-1 group", className)}>
      <Button
        variant="ghost"
        size="icon"
        className="h-6 w-6 opacity-0 group-hover:opacity-100 transition-opacity"
        onClick={() => handleQuickAdjust(-1)}
        disabled={isSaving || value <= min}
      >
        <Minus className="h-3 w-3" />
      </Button>
      
      <button
        onClick={() => setIsEditing(true)}
        className={cn(
          "px-2 py-0.5 rounded text-sm font-medium cursor-pointer transition-colors",
          "hover:bg-muted",
          stockStatus === 'out' && "text-destructive bg-destructive/10",
          stockStatus === 'low' && "text-warning bg-warning/10",
          stockStatus === 'ok' && "text-success bg-success/10"
        )}
        disabled={isSaving}
      >
        {isSaving ? (
          <Loader2 className="h-3 w-3 animate-spin" />
        ) : (
          value
        )}
      </button>

      <Button
        variant="ghost"
        size="icon"
        className="h-6 w-6 opacity-0 group-hover:opacity-100 transition-opacity"
        onClick={() => handleQuickAdjust(1)}
        disabled={isSaving || value >= max}
      >
        <Plus className="h-3 w-3" />
      </Button>
    </div>
  );
}
