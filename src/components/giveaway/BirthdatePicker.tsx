import { useState, Fragment } from 'react';
import { Dialog, Transition } from '@headlessui/react';
import { Calendar, ChevronLeft, ChevronRight } from 'lucide-react';

interface BirthdatePickerProps {
  value: Date | null;
  onChange: (date: Date) => void;
  error?: string;
}

export default function BirthdatePicker({ value, onChange, error }: BirthdatePickerProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [viewDate, setViewDate] = useState(value || new Date(2000, 0, 1));
  const [selectedDate, setSelectedDate] = useState<Date | null>(value);

  const months = [
    'January', 'February', 'March', 'April', 'May', 'June',
    'July', 'August', 'September', 'October', 'November', 'December'
  ];

  const years = Array.from({ length: 100 }, (_, i) => {
    const currentYear = new Date().getFullYear();
    return currentYear - 21 - i;
  });

  const getDaysInMonth = (date: Date) => {
    return new Date(date.getFullYear(), date.getMonth() + 1, 0).getDate();
  };

  const getFirstDayOfMonth = (date: Date) => {
    return new Date(date.getFullYear(), date.getMonth(), 1).getDay();
  };

  const handleMonthChange = (direction: number) => {
    setViewDate(new Date(viewDate.getFullYear(), viewDate.getMonth() + direction, 1));
  };

  const handleDateSelect = (day: number) => {
    const newDate = new Date(viewDate.getFullYear(), viewDate.getMonth(), day);
    setSelectedDate(newDate);
  };

  const handleConfirm = () => {
    if (selectedDate) {
      onChange(selectedDate);
      setIsOpen(false);
    }
  };

  const formatDate = (date: Date | null) => {
    if (!date) return '';
    return date.toLocaleDateString('en-US', { 
      month: 'long', 
      day: 'numeric', 
      year: 'numeric' 
    });
  };

  const isToday = (day: number) => {
    const today = new Date();
    return (
      day === today.getDate() &&
      viewDate.getMonth() === today.getMonth() &&
      viewDate.getFullYear() === today.getFullYear()
    );
  };

  const isSelected = (day: number) => {
    if (!selectedDate) return false;
    return (
      day === selectedDate.getDate() &&
      viewDate.getMonth() === selectedDate.getMonth() &&
      viewDate.getFullYear() === selectedDate.getFullYear()
    );
  };

  const daysInMonth = getDaysInMonth(viewDate);
  const firstDay = getFirstDayOfMonth(viewDate);
  const days = Array.from({ length: daysInMonth }, (_, i) => i + 1);
  const emptyDays = Array.from({ length: firstDay }, (_, i) => i);

  return (
    <>
      <button
        type="button"
        onClick={() => setIsOpen(true)}
        className={`w-full px-4 py-4 rounded-xl bg-white/5 border transition-all text-left flex items-center justify-between ${
          error
            ? 'border-red-500'
            : 'border-white/10 focus:border-green-400 focus:ring-2 focus:ring-green-400/20'
        }`}
      >
        <div className="flex items-center gap-3">
          <Calendar className="w-5 h-5 text-green-400" />
          <span className={value ? 'text-white' : 'text-gray-500'}>
            {value ? formatDate(value) : 'Select your date of birth'}
          </span>
        </div>
        <svg
          className="w-5 h-5 text-gray-400"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
        >
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      </button>

      {error && (
        <p className="mt-2 text-sm text-red-500">{error}</p>
      )}

      <Transition appear show={isOpen} as={Fragment}>
        <Dialog as="div" className="relative z-50" onClose={() => setIsOpen(false)}>
          <Transition.Child
            as={Fragment}
            enter="ease-out duration-300"
            enterFrom="opacity-0"
            enterTo="opacity-100"
            leave="ease-in duration-200"
            leaveFrom="opacity-100"
            leaveTo="opacity-0"
          >
            <div className="fixed inset-0 bg-black/50 backdrop-blur-sm" />
          </Transition.Child>

          <div className="fixed inset-0 overflow-y-auto">
            <div className="flex min-h-full items-center justify-center p-4">
              <Transition.Child
                as={Fragment}
                enter="ease-out duration-300"
                enterFrom="opacity-0 scale-95"
                enterTo="opacity-100 scale-100"
                leave="ease-in duration-200"
                leaveFrom="opacity-100 scale-100"
                leaveTo="opacity-0 scale-95"
              >
                <Dialog.Panel className="w-full max-w-md transform overflow-hidden rounded-2xl bg-white p-6 shadow-xl transition-all">
                  <Dialog.Title className="text-lg font-bold text-gray-900 mb-4">
                    Select Your Date of Birth
                  </Dialog.Title>

                  {/* Month/Year Selector */}
                  <div className="flex items-center justify-between mb-6">
                    <button
                      type="button"
                      onClick={() => handleMonthChange(-1)}
                      className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
                    >
                      <ChevronLeft className="w-5 h-5" />
                    </button>

                    <div className="flex gap-2">
                      <select
                        value={viewDate.getMonth()}
                        onChange={(e) =>
                          setViewDate(new Date(viewDate.getFullYear(), parseInt(e.target.value), 1))
                        }
                        className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-green-500"
                      >
                        {months.map((month, idx) => (
                          <option key={month} value={idx}>
                            {month}
                          </option>
                        ))}
                      </select>

                      <select
                        value={viewDate.getFullYear()}
                        onChange={(e) =>
                          setViewDate(new Date(parseInt(e.target.value), viewDate.getMonth(), 1))
                        }
                        className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-green-500"
                      >
                        {years.map((year) => (
                          <option key={year} value={year}>
                            {year}
                          </option>
                        ))}
                      </select>
                    </div>

                    <button
                      type="button"
                      onClick={() => handleMonthChange(1)}
                      className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
                    >
                      <ChevronRight className="w-5 h-5" />
                    </button>
                  </div>

                  {/* Calendar Grid */}
                  <div className="mb-6">
                    {/* Day Headers */}
                    <div className="grid grid-cols-7 gap-1 mb-2">
                      {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map((day) => (
                        <div
                          key={day}
                          className="text-center text-xs font-medium text-gray-500 py-2"
                        >
                          {day}
                        </div>
                      ))}
                    </div>

                    {/* Calendar Days */}
                    <div className="grid grid-cols-7 gap-1">
                      {emptyDays.map((_, idx) => (
                        <div key={`empty-${idx}`} />
                      ))}
                      {days.map((day) => (
                        <button
                          key={day}
                          type="button"
                          onClick={() => handleDateSelect(day)}
                          className={`
                            aspect-square flex items-center justify-center rounded-lg text-sm font-medium transition-all
                            ${
                              isSelected(day)
                                ? 'bg-green-500 text-white hover:bg-green-600'
                                : isToday(day)
                                ? 'bg-blue-100 text-blue-900 hover:bg-blue-200'
                                : 'hover:bg-gray-100 text-gray-900'
                            }
                          `}
                        >
                          {day}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Age Verification Message */}
                  <div className="mb-6 p-3 bg-blue-50 rounded-lg border border-blue-200">
                    <p className="text-sm text-blue-900 text-center">
                      Must be 21 or older to enter
                    </p>
                  </div>

                  {/* Action Buttons */}
                  <div className="flex gap-3">
                    <button
                      type="button"
                      onClick={() => setIsOpen(false)}
                      className="flex-1 px-4 py-3 bg-gray-100 text-gray-900 rounded-lg font-medium hover:bg-gray-200 transition-colors"
                    >
                      Cancel
                    </button>
                    <button
                      type="button"
                      onClick={handleConfirm}
                      disabled={!selectedDate}
                      className="flex-1 px-4 py-3 bg-green-500 text-white rounded-lg font-medium hover:bg-green-600 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      Confirm
                    </button>
                  </div>
                </Dialog.Panel>
              </Transition.Child>
            </div>
          </div>
        </Dialog>
      </Transition>
    </>
  );
}
