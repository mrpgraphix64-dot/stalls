import React, { useState, useEffect, useRef } from 'react';
import { Calendar as CalendarIcon, ChevronLeft, ChevronRight, X } from 'lucide-react';

interface DateRangePickerProps {
  startDate: string; // YYYY-MM-DD
  endDate: string; // YYYY-MM-DD
  onChange: (startDate: string, endDate: string) => void;
  error?: string;
}

export function DateRangePicker({ startDate, endDate, onChange, error }: DateRangePickerProps) {
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  // Parse initial view month from startDate or today
  const initialDate = startDate ? new Date(startDate) : new Date();
  const [viewYear, setViewYear] = useState<number>(initialDate.getFullYear());
  const [viewMonth, setViewMonth] = useState<number>(initialDate.getMonth()); // 0-indexed

  // Track selection state: 'start' or 'end'
  const [selectionStep, setSelectionStep] = useState<'start' | 'end'>('start');

  // Close calendar on click outside
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };
    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [isOpen]);

  // Month navigation
  const prevMonth = () => {
    if (viewMonth === 0) {
      setViewMonth(11);
      setViewYear(viewYear - 1);
    } else {
      setViewMonth(viewMonth - 1);
    }
  };

  const nextMonth = () => {
    if (viewMonth === 11) {
      setViewMonth(0);
      setViewYear(viewYear + 1);
    } else {
      setViewMonth(viewMonth + 1);
    }
  };

  // Calendar helpers
  const monthNames = [
    'January', 'February', 'March', 'April', 'May', 'June',
    'July', 'August', 'September', 'October', 'November', 'December'
  ];

  const daysInMonth = (year: number, month: number) => new Date(year, month + 1, 0).getDate();
  const firstDayOfMonth = (year: number, month: number) => new Date(year, month, 1).getDay();

  // Format date helper: YYYY-MM-DD
  const formatYMD = (year: number, month: number, day: number) => {
    const m = String(month + 1).padStart(2, '0');
    const d = String(day).padStart(2, '0');
    return `${year}-${m}-${d}`;
  };

  // Handle day click
  const handleDayClick = (day: number) => {
    const clickedStr = formatYMD(viewYear, viewMonth, day);

    if (selectionStep === 'start' || !startDate || (startDate && endDate)) {
      onChange(clickedStr, '');
      setSelectionStep('end');
    } else {
      // Second click: if clicked is earlier than start, swap them
      if (clickedStr < startDate) {
        onChange(clickedStr, startDate);
      } else {
        onChange(startDate, clickedStr);
      }
      setSelectionStep('start');
      setIsOpen(false);
    }
  };

  // Calculate day cells
  const totalDays = daysInMonth(viewYear, viewMonth);
  const startDayOffset = firstDayOfMonth(viewYear, viewMonth);

  // Compute duration in days if both dates set
  let durationText = '';
  if (startDate && endDate && endDate >= startDate) {
    const s = new Date(startDate);
    const e = new Date(endDate);
    const diffTime = Math.abs(e.getTime() - s.getTime());
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24)) + 1;
    durationText = `${diffDays} day${diffDays === 1 ? '' : 's'}`;
  }

  return (
    <div className="space-y-1.5" ref={containerRef}>
      <label className="block text-xs font-semibold text-zinc-300">
        Exhibition Dates <span className="text-amber-500">*</span>
      </label>

      {/* Date Inputs Display Row */}
      <div className="grid grid-cols-2 gap-2 relative">
        <div className="relative">
          <input
            type="date"
            required
            value={startDate}
            onChange={(e) => {
              const val = e.target.value;
              onChange(val, endDate && endDate < val ? val : endDate);
            }}
            className="w-full bg-[#1c1f2a] border border-white/[0.08] rounded-xl px-3 py-2 text-xs text-zinc-100 focus:outline-none focus:border-amber-500/80 transition-all cursor-pointer"
          />
          <span className="text-[10px] text-zinc-500 absolute -top-2 left-2.5 bg-[#15171e] px-1 font-mono">
            Start Date
          </span>
        </div>

        <div className="relative">
          <input
            type="date"
            required
            min={startDate || undefined}
            value={endDate}
            onChange={(e) => {
              onChange(startDate, e.target.value);
            }}
            className="w-full bg-[#1c1f2a] border border-white/[0.08] rounded-xl px-3 py-2 text-xs text-zinc-100 focus:outline-none focus:border-amber-500/80 transition-all cursor-pointer"
          />
          <span className="text-[10px] text-zinc-500 absolute -top-2 left-2.5 bg-[#15171e] px-1 font-mono">
            End Date
          </span>
        </div>
      </div>

      {/* Quick Visual Helper Button */}
      <div className="flex items-center justify-between text-[11px] pt-1">
        <button
          type="button"
          onClick={() => setIsOpen(!isOpen)}
          className="text-amber-400 hover:text-amber-300 font-medium inline-flex items-center gap-1.5 cursor-pointer"
        >
          <CalendarIcon className="w-3.5 h-3.5" />
          <span>{isOpen ? 'Close Calendar' : 'Visual Date Range Picker'}</span>
        </button>

        {durationText && (
          <span className="text-zinc-400 font-mono text-[11px] bg-white/[0.04] border border-white/[0.08] px-2 py-0.5 rounded-md">
            Duration: {durationText}
          </span>
        )}
      </div>

      {/* Interactive Calendar Dropdown */}
      {isOpen && (
        <div className="mt-2 bg-[#181a24] border border-white/[0.1] rounded-2xl p-4 shadow-2xl animate-in fade-in duration-150 z-30">
          <div className="flex items-center justify-between pb-3 border-b border-white/[0.06]">
            <span className="text-xs font-bold text-zinc-100">
              {monthNames[viewMonth]} {viewYear}
            </span>
            <div className="flex items-center gap-1">
              <button
                type="button"
                onClick={prevMonth}
                className="p-1 rounded-lg bg-white/[0.04] hover:bg-white/[0.08] text-zinc-400 hover:text-zinc-200 cursor-pointer"
              >
                <ChevronLeft className="w-4 h-4" />
              </button>
              <button
                type="button"
                onClick={nextMonth}
                className="p-1 rounded-lg bg-white/[0.04] hover:bg-white/[0.08] text-zinc-400 hover:text-zinc-200 cursor-pointer"
              >
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          </div>

          <div className="text-[10px] text-zinc-500 py-1.5 text-center">
            {selectionStep === 'start' ? 'Click to select Start Date' : 'Click to select End Date'}
          </div>

          {/* Days of Week Header */}
          <div className="grid grid-cols-7 gap-1 text-center text-[10px] font-semibold text-zinc-500 py-1">
            <span>Su</span>
            <span>Mo</span>
            <span>Tu</span>
            <span>We</span>
            <span>Th</span>
            <span>Fr</span>
            <span>Sa</span>
          </div>

          {/* Days Grid */}
          <div className="grid grid-cols-7 gap-1 text-xs">
            {/* Blank offsets for start of month */}
            {Array.from({ length: startDayOffset }).map((_, i) => (
              <div key={`blank-${i}`} className="h-7" />
            ))}

            {/* Days in Month */}
            {Array.from({ length: totalDays }).map((_, i) => {
              const day = i + 1;
              const dateStr = formatYMD(viewYear, viewMonth, day);
              const isStart = startDate === dateStr;
              const isEnd = endDate === dateStr;
              const isInRange = startDate && endDate && dateStr > startDate && dateStr < endDate;

              return (
                <button
                  key={day}
                  type="button"
                  onClick={() => handleDayClick(day)}
                  className={`h-7 w-full rounded-lg font-medium text-xs flex items-center justify-center transition-colors cursor-pointer ${
                    isStart || isEnd
                      ? 'bg-amber-500 text-zinc-950 font-bold shadow'
                      : isInRange
                      ? 'bg-amber-500/20 text-amber-300'
                      : 'text-zinc-300 hover:bg-zinc-900'
                  }`}
                >
                  {day}
                </button>
              );
            })}
          </div>
        </div>
      )}

      {error && <p className="text-[11px] text-red-400 mt-1">{error}</p>}
    </div>
  );
}
