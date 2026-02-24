import { useState, useRef, useEffect } from 'react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Check, X, Edit3 } from 'lucide-react';
import { cn } from '@/lib/utils';

interface EditableCellProps {
  value: string;
  isEditing: boolean;
  onEdit: () => void;
  onSave: (value: string) => void;
  onCancel: () => void;
  suffix?: string;
  className?: string;
}

export function EditableCell({
  value,
  isEditing,
  onEdit,
  onSave,
  onCancel,
  suffix,
  className,
}: EditableCellProps) {
  const [editValue, setEditValue] = useState(value);
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

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      onSave(editValue);
    } else if (e.key === 'Escape') {
      setEditValue(value);
      onCancel();
    }
  };

  if (isEditing) {
    return (
      <div className="flex items-center gap-1">
        <Input
          ref={inputRef}
          value={editValue}
          onChange={(e) => setEditValue(e.target.value)}
          onKeyDown={handleKeyDown}
          className="h-8 w-full"
          aria-label="Edit cell value"
        />
        <Button
          variant="ghost"
          size="icon"
          onClick={() => onSave(editValue)}
          className="h-8 w-8 text-emerald-500"
        >
          <Check className="h-4 w-4" />
        </Button>
        <Button
          variant="ghost"
          size="icon"
          onClick={() => {
            setEditValue(value);
            onCancel();
          }}
          className="h-8 w-8 text-muted-foreground"
        >
          <X className="h-4 w-4" />
        </Button>
      </div>
    );
  }

  return (
    <div 
      className={cn(
        'group flex items-center gap-2 cursor-pointer hover:bg-muted/50 rounded px-2 py-1 -mx-2 -my-1',
        className
      )}
      onClick={onEdit}
    >
      <span className="truncate">
        {value || <span className="text-muted-foreground italic">Empty</span>}
        {suffix && value && <span className="text-muted-foreground">{suffix}</span>}
      </span>
      <Edit3 className="h-3 w-3 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0" />
    </div>
  );
}




