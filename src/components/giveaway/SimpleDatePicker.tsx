import { useState } from 'react';
import { Calendar } from 'lucide-react';

interface SimpleDatePickerProps {
  value: Date | null;
  onChange: (date: Date) => void;
}

export default function SimpleDatePicker({ value, onChange }: SimpleDatePickerProps) {
  const currentYear = new Date().getFullYear();
  const [month, setMonth] = useState(value?.getMonth() || 0);
  const [day, setDay] = useState(value?.getDate() || 1);
  const [year, setYear] = useState(value?.getFullYear() || currentYear - 25);

  const months = [
    'January', 'February', 'March', 'April', 'May', 'June',
    'July', 'August', 'September', 'October', 'November', 'December'
  ];

  const days = Array.from({ length: 31 }, (_, i) => i + 1);
  const years = Array.from({ length: 100 }, (_, i) => currentYear - 21 - i);

  const handleChange = (newMonth: number, newDay: number, newYear: number) => {
    setMonth(newMonth);
    setDay(newDay);
    setYear(newYear);
    onChange(new Date(newYear, newMonth, newDay));
  };

  return (
    <div>
      <label className="block text-sm font-semibold text-gray-300 mb-2">
        Date of Birth
      </label>
      
      <div className="grid grid-cols-3 gap-3">
        {/* Month */}
        <select
          value={month}
          onChange={(e) => handleChange(parseInt(e.target.value), day, year)}
          className="px-4 py-4 rounded-xl bg-white/5 border border-white/10 focus:border-green-400 focus:outline-none focus:ring-2 focus:ring-green-400/20 transition-all text-white cursor-pointer"
        >
          {months.map((m, idx) => (
            <option key={m} value={idx} className="bg-gray-900">
              {m}
            </option>
          ))}
        </select>

        {/* Day */}
        <select
          value={day}
          onChange={(e) => handleChange(month, parseInt(e.target.value), year)}
          className="px-4 py-4 rounded-xl bg-white/5 border border-white/10 focus:border-green-400 focus:outline-none focus:ring-2 focus:ring-green-400/20 transition-all text-white cursor-pointer"
        >
          {days.map((d) => (
            <option key={d} value={d} className="bg-gray-900">
              {d}
            </option>
          ))}
        </select>

        {/* Year */}
        <select
          value={year}
          onChange={(e) => handleChange(month, day, parseInt(e.target.value))}
          className="px-4 py-4 rounded-xl bg-white/5 border border-white/10 focus:border-green-400 focus:outline-none focus:ring-2 focus:ring-green-400/20 transition-all text-white cursor-pointer"
        >
          {years.map((y) => (
            <option key={y} value={y} className="bg-gray-900">
              {y}
            </option>
          ))}
        </select>
      </div>

      <p className="mt-2 text-xs text-gray-400 flex items-center gap-2">
        <Calendar className="w-3 h-3" />
        Must be 21 or older
      </p>
    </div>
  );
}
