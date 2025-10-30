import { useState } from 'react';
import { DayPicker } from 'react-day-picker';
import { format, subYears } from 'date-fns';
import { Calendar } from 'lucide-react';
import { cn } from '@/lib/utils';
import 'react-day-picker/dist/style.css';

interface CustomDatePickerProps {
  value: Date | null;
  onChange: (date: Date) => void;
}

export default function CustomDatePicker({ value, onChange }: CustomDatePickerProps) {
  const [isOpen, setIsOpen] = useState(false);
  
  const maxDate = subYears(new Date(), 21);
  const minDate = subYears(new Date(), 100);
  
  const handleSelect = (date: Date | undefined) => {
    if (date) {
      onChange(date);
      setIsOpen(false);
    }
  };

  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className="w-full px-4 py-3.5 rounded-xl bg-slate-800/50 border border-slate-700 focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20 transition-all text-left flex items-center justify-between"
      >
        <div className="flex items-center gap-3">
          <Calendar className="w-5 h-5 text-primary" />
          <span className={cn(
            "font-light",
            value ? 'text-white' : 'text-slate-500'
          )}>
            {value ? format(value, 'MMMM d, yyyy') : 'Date of Birth (Must be 21+)'}
          </span>
        </div>
        <svg
          className={cn(
            "w-5 h-5 text-slate-400 transition-transform",
            isOpen && 'rotate-180'
          )}
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
        >
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      </button>

      {isOpen && (
        <>
          <div 
            className="fixed inset-0 z-40" 
            onClick={() => setIsOpen(false)}
          />
          <div className="absolute z-50 mt-2 bg-white rounded-xl shadow-2xl p-4 border border-gray-200">
            <DayPicker
              mode="single"
              selected={value || undefined}
              onSelect={handleSelect}
              disabled={{ after: maxDate, before: minDate }}
              captionLayout="dropdown-buttons"
              fromYear={minDate.getFullYear()}
              toYear={maxDate.getFullYear()}
              className={cn("p-3 pointer-events-auto")}
              classNames={{
                months: "flex flex-col",
                month: "space-y-4",
                caption: "flex justify-center pt-1 relative items-center",
                caption_label: "text-sm font-medium text-gray-900",
                nav: "space-x-1 flex items-center",
                nav_button: "h-7 w-7 bg-transparent hover:bg-gray-100 p-0 rounded-md transition-colors",
                nav_button_previous: "absolute left-1",
                nav_button_next: "absolute right-1",
                table: "w-full border-collapse space-y-1",
                head_row: "flex",
                head_cell: "text-gray-500 rounded-md w-9 font-normal text-[0.8rem]",
                row: "flex w-full mt-2",
                cell: "text-center text-sm p-0 relative [&:has([aria-selected])]:bg-green-100 first:[&:has([aria-selected])]:rounded-l-md last:[&:has([aria-selected])]:rounded-r-md focus-within:relative focus-within:z-20",
                day: "h-9 w-9 p-0 font-normal aria-selected:opacity-100 hover:bg-gray-100 rounded-md transition-colors",
                day_selected: "bg-primary text-white hover:bg-primary/90 focus:bg-primary/90",
                day_today: "bg-blue-50 text-blue-900 font-semibold",
                day_outside: "text-gray-400 opacity-50",
                day_disabled: "text-gray-400 opacity-50 cursor-not-allowed",
                day_hidden: "invisible",
              }}
            />
            <div className="mt-4 pt-4 border-t border-gray-200 text-center">
              <p className="text-xs text-gray-600">Must be 21 or older to enter</p>
            </div>
          </div>
        </>
      )}
    </div>
  );
}