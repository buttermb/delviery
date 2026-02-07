import * as React from "react";
import { format, addDays, startOfWeek, endOfWeek, startOfMonth, endOfMonth, subDays } from "date-fns";
import { CalendarIcon } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";

interface DatePreset {
  label: string;
  getValue: () => Date;
}

const defaultPresets: DatePreset[] = [
  { label: "Today", getValue: () => new Date() },
  { label: "Tomorrow", getValue: () => addDays(new Date(), 1) },
  { label: "In 3 Days", getValue: () => addDays(new Date(), 3) },
  { label: "Next Week", getValue: () => addDays(new Date(), 7) },
  { label: "Next Month", getValue: () => addDays(new Date(), 30) },
];

const pastPresets: DatePreset[] = [
  { label: "Today", getValue: () => new Date() },
  { label: "Yesterday", getValue: () => subDays(new Date(), 1) },
  { label: "3 Days Ago", getValue: () => subDays(new Date(), 3) },
  { label: "Last Week", getValue: () => subDays(new Date(), 7) },
  { label: "Last Month", getValue: () => subDays(new Date(), 30) },
];

interface DatePickerWithPresetsProps {
  date: Date | undefined;
  onDateChange: (date: Date | undefined) => void;
  placeholder?: string;
  presets?: DatePreset[];
  showPastPresets?: boolean;
  disabled?: boolean;
  className?: string;
}

export function DatePickerWithPresets({
  date,
  onDateChange,
  placeholder = "Pick a date",
  presets,
  showPastPresets = false,
  disabled = false,
  className,
}: DatePickerWithPresetsProps) {
  const [open, setOpen] = React.useState(false);
  
  const activePresets = presets || (showPastPresets ? pastPresets : defaultPresets);

  const handlePresetClick = (preset: DatePreset) => {
    onDateChange(preset.getValue());
    setOpen(false);
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          disabled={disabled}
          className={cn(
            "w-full justify-start text-left font-normal",
            !date && "text-muted-foreground",
            className
          )}
        >
          <CalendarIcon className="mr-2 h-4 w-4" />
          {date ? format(date, "PPP") : <span>{placeholder}</span>}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-auto p-0 bg-popover" align="start">
        <div className="flex">
          <div className="border-r border-border p-2 space-y-1">
            <p className="text-xs font-medium text-muted-foreground mb-2 px-2">Quick Pick</p>
            {activePresets.map((preset) => (
              <Button
                key={preset.label}
                variant="ghost"
                size="sm"
                className="w-full justify-start text-sm"
                onClick={() => handlePresetClick(preset)}
              >
                {preset.label}
              </Button>
            ))}
          </div>
          <Calendar
            mode="single"
            selected={date}
            onSelect={(d) => {
              onDateChange(d);
              setOpen(false);
            }}
            initialFocus
            className="p-3 pointer-events-auto"
          />
        </div>
      </PopoverContent>
    </Popover>
  );
}

interface DateRangePreset {
  label: string;
  getValue: () => { from: Date; to: Date };
}

const defaultRangePresets: DateRangePreset[] = [
  { label: "Today", getValue: () => ({ from: new Date(), to: new Date() }) },
  { label: "Yesterday", getValue: () => ({ from: subDays(new Date(), 1), to: subDays(new Date(), 1) }) },
  { label: "Last 7 Days", getValue: () => ({ from: subDays(new Date(), 6), to: new Date() }) },
  { label: "Last 30 Days", getValue: () => ({ from: subDays(new Date(), 29), to: new Date() }) },
  { label: "This Week", getValue: () => ({ from: startOfWeek(new Date()), to: endOfWeek(new Date()) }) },
  { label: "This Month", getValue: () => ({ from: startOfMonth(new Date()), to: endOfMonth(new Date()) }) },
];

interface DateRangePickerWithPresetsProps {
  dateRange: { from: Date | undefined; to: Date | undefined };
  onDateRangeChange: (range: { from: Date | undefined; to: Date | undefined }) => void;
  placeholder?: string;
  presets?: DateRangePreset[];
  disabled?: boolean;
  className?: string;
}

export function DateRangePickerWithPresets({
  dateRange,
  onDateRangeChange,
  placeholder = "Pick a date range",
  presets = defaultRangePresets,
  disabled = false,
  className,
}: DateRangePickerWithPresetsProps) {
  const [open, setOpen] = React.useState(false);

  const handlePresetClick = (preset: DateRangePreset) => {
    onDateRangeChange(preset.getValue());
    setOpen(false);
  };

  const formatDateRange = () => {
    if (dateRange.from && dateRange.to) {
      if (format(dateRange.from, "PP") === format(dateRange.to, "PP")) {
        return format(dateRange.from, "PP");
      }
      return `${format(dateRange.from, "MMM d")} - ${format(dateRange.to, "MMM d, yyyy")}`;
    }
    if (dateRange.from) {
      return format(dateRange.from, "PP");
    }
    return null;
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          disabled={disabled}
          className={cn(
            "w-full justify-start text-left font-normal",
            !dateRange.from && "text-muted-foreground",
            className
          )}
        >
          <CalendarIcon className="mr-2 h-4 w-4" />
          {formatDateRange() || <span>{placeholder}</span>}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-auto p-0 bg-popover" align="start">
        <div className="flex">
          <div className="border-r border-border p-2 space-y-1">
            <p className="text-xs font-medium text-muted-foreground mb-2 px-2">Quick Range</p>
            {presets.map((preset) => (
              <Button
                key={preset.label}
                variant="ghost"
                size="sm"
                className="w-full justify-start text-sm"
                onClick={() => handlePresetClick(preset)}
              >
                {preset.label}
              </Button>
            ))}
          </div>
          <Calendar
            mode="range"
            selected={{ from: dateRange.from, to: dateRange.to }}
            onSelect={(range) => {
              onDateRangeChange({ from: range?.from, to: range?.to });
              if (range?.from && range?.to) {
                setOpen(false);
              }
            }}
            numberOfMonths={2}
            initialFocus
            className="p-3 pointer-events-auto"
          />
        </div>
      </PopoverContent>
    </Popover>
  );
}
