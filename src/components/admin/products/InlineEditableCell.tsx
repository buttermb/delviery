import { useState, useRef, useEffect } from "react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Check, X, Pencil } from "lucide-react";
import { cn } from "@/lib/utils";

interface InlineEditableCellProps {
    value: string | number | null | undefined;
    onSave: (newValue: string) => Promise<void>;
    type?: "text" | "number" | "currency";
    placeholder?: string;
    className?: string;
    displayValue?: string; // Custom display format
    valueClassName?: string; // Additional class for the display value text
}

export function InlineEditableCell({
    value,
    onSave,
    type = "text",
    placeholder = "—",
    className,
    displayValue,
    valueClassName,
}: InlineEditableCellProps) {
    const [isEditing, setIsEditing] = useState(false);
    const [editValue, setEditValue] = useState(String(value ?? ""));
    const [isSaving, setIsSaving] = useState(false);
    const inputRef = useRef<HTMLInputElement>(null);

    useEffect(() => {
        if (isEditing && inputRef.current) {
            inputRef.current.focus();
            inputRef.current.select();
        }
    }, [isEditing]);

    // Reset edit value when source value changes
    useEffect(() => {
        setEditValue(String(value ?? ""));
    }, [value]);

    const handleSave = async () => {
        if (editValue === String(value ?? "")) {
            setIsEditing(false);
            return;
        }

        setIsSaving(true);
        try {
            await onSave(editValue);
            setIsEditing(false);
        } catch {
            // Keep editing mode open on error
        } finally {
            setIsSaving(false);
        }
    };

    const handleCancel = () => {
        setEditValue(String(value ?? ""));
        setIsEditing(false);
    };

    const handleKeyDown = (e: React.KeyboardEvent) => {
        if (e.key === "Enter") {
            e.preventDefault();
            handleSave();
        } else if (e.key === "Escape") {
            handleCancel();
        }
    };

    if (isEditing) {
        return (
            <div className="flex items-center gap-1">
                <Input
                    ref={inputRef}
                    type={type === "currency" ? "number" : type}
                    value={editValue}
                    onChange={(e) => setEditValue(e.target.value)}
                    onKeyDown={handleKeyDown}
                    aria-label="Edit cell value"
                    onBlur={() => {
                        // Small delay to allow button clicks to register
                        setTimeout(() => {
                            if (!isSaving) handleCancel();
                        }, 150);
                    }}
                    className="h-7 w-20 text-sm"
                    step={type === "currency" ? "0.01" : type === "number" ? "1" : undefined}
                    min={type === "number" || type === "currency" ? "0" : undefined}
                    disabled={isSaving}
                />
                <Button
                    size="icon"
                    variant="ghost"
                    className="h-6 w-6"
                    onClick={handleSave}
                    disabled={isSaving}
                    aria-label="Save"
                >
                    <Check className="h-3 w-3 text-green-600" />
                </Button>
                <Button
                    size="icon"
                    variant="ghost"
                    className="h-6 w-6"
                    onClick={handleCancel}
                    disabled={isSaving}
                    aria-label="Cancel"
                >
                    <X className="h-3 w-3 text-red-600" />
                </Button>
            </div>
        );
    }

    const display = displayValue ?? (value != null ? String(value) : placeholder);

    return (
        <div
            className={cn(
                "group flex items-center gap-1 cursor-pointer hover:bg-muted/50 rounded px-1 py-0.5 -mx-1 transition-colors",
                className
            )}
            onClick={() => setIsEditing(true)}
        >
            <span className={cn(!value && "text-muted-foreground", valueClassName)}>{display}</span>
            <Pencil className="h-3 w-3 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity" />
        </div>
    );
}
