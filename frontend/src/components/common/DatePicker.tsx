import React, { useState, useRef, useEffect } from 'react';

export interface DatePickerProps {
    value?: string;
    onChange: (date: string) => void;
    placeholder?: string;
    disabled?: boolean;
    error?: boolean;
    minDate?: string;
    maxDate?: string;
    className?: string;
    id?: string;
    name?: string;
}

const DatePicker: React.FC<DatePickerProps> = ({
    value,
    onChange,
    placeholder = 'Select date',
    disabled = false,
    error = false,
    minDate,
    maxDate,
    className = '',
    id,
    name,
}) => {
    const [isOpen, setIsOpen] = useState(false);
    const [currentMonth, setCurrentMonth] = useState(new Date());
    const [inputValue, setInputValue] = useState(value || '');
    const containerRef = useRef<HTMLDivElement>(null);
    const inputRef = useRef<HTMLInputElement>(null);

    const selectedDate = value ? new Date(value) : null;

    useEffect(() => {
        setInputValue(value || '');
    }, [value]);

    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
                setIsOpen(false);
            }
        };

        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    const formatDate = (date: Date): string => {
        return date.toISOString().split('T')[0];
    };

    const parseDate = (dateString: string): Date | null => {
        const date = new Date(dateString);
        return isNaN(date.getTime()) ? null : date;
    };

    const handleInputChange = (event: React.ChangeEvent<HTMLInputElement>) => {
        const newValue = event.target.value;
        setInputValue(newValue);

        const parsedDate = parseDate(newValue);
        if (parsedDate) {
            onChange(formatDate(parsedDate));
            setCurrentMonth(parsedDate);
        }
    };

    const handleInputBlur = () => {
        if (!inputValue) {
            onChange('');
            return;
        }

        const parsedDate = parseDate(inputValue);
        if (parsedDate) {
            const formattedDate = formatDate(parsedDate);
            setInputValue(formattedDate);
            onChange(formattedDate);
        } else {
            setInputValue(value || '');
        }
    };

    const handleDateSelect = (date: Date) => {
        const formattedDate = formatDate(date);
        setInputValue(formattedDate);
        onChange(formattedDate);
        setIsOpen(false);
    };

    const isDateDisabled = (date: Date): boolean => {
        if (minDate && date < new Date(minDate)) return true;
        if (maxDate && date > new Date(maxDate)) return true;
        return false;
    };

    const getDaysInMonth = (date: Date): Date[] => {
        const year = date.getFullYear();
        const month = date.getMonth();
        const firstDay = new Date(year, month, 1);
        const lastDay = new Date(year, month + 1, 0);
        const daysInMonth = lastDay.getDate();

        const days: Date[] = [];

        // Add empty cells for days before the first day of the month
        const firstDayOfWeek = firstDay.getDay();
        for (let i = 0; i < firstDayOfWeek; i++) {
            days.push(new Date(year, month, -firstDayOfWeek + i + 1));
        }

        // Add days of the current month
        for (let day = 1; day <= daysInMonth; day++) {
            days.push(new Date(year, month, day));
        }

        // Add empty cells for days after the last day of the month
        const remainingCells = 42 - days.length; // 6 rows × 7 days
        for (let i = 1; i <= remainingCells; i++) {
            days.push(new Date(year, month + 1, i));
        }

        return days;
    };

    const navigateMonth = (direction: 'prev' | 'next') => {
        setCurrentMonth(prev => {
            const newMonth = new Date(prev);
            if (direction === 'prev') {
                newMonth.setMonth(prev.getMonth() - 1);
            } else {
                newMonth.setMonth(prev.getMonth() + 1);
            }
            return newMonth;
        });
    };

    const monthNames = [
        'January', 'February', 'March', 'April', 'May', 'June',
        'July', 'August', 'September', 'October', 'November', 'December'
    ];

    const dayNames = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

    const baseInputClasses = 'block w-full rounded-md border-0 py-1.5 px-3 shadow-sm ring-1 ring-inset focus:ring-2 focus:ring-inset sm:text-sm sm:leading-6 disabled:cursor-not-allowed disabled:bg-gray-50 disabled:text-gray-500';
    const stateClasses = error
        ? 'text-red-900 ring-red-300 placeholder:text-red-300 focus:ring-red-500'
        : 'text-gray-900 ring-gray-300 placeholder:text-gray-400 focus:ring-blue-600';

    const inputClasses = `${baseInputClasses} ${stateClasses} ${className}`;

    return (
        <div className="relative" ref={containerRef}>
            <div className="relative">
                <input
                    ref={inputRef}
                    type="text"
                    className={inputClasses}
                    placeholder={placeholder}
                    value={inputValue}
                    onChange={handleInputChange}
                    onBlur={handleInputBlur}
                    onFocus={() => setIsOpen(true)}
                    disabled={disabled}
                    id={id}
                    name={name}
                />
                <button
                    type="button"
                    className="absolute inset-y-0 right-0 flex items-center pr-3 text-gray-400 hover:text-gray-600"
                    onClick={() => !disabled && setIsOpen(!isOpen)}
                    disabled={disabled}
                    tabIndex={-1}
                >
                    <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" strokeWidth="1.5" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M6.75 3v2.25M17.25 3v2.25m3 6.75H3m15.75-6.75v12A2.25 2.25 0 0116.5 19.5H7.5A2.25 2.25 0 015.25 17.25V5.25A2.25 2.25 0 017.5 3h9A2.25 2.25 0 0119.5 5.25z" />
                    </svg>
                </button>
            </div>

            {isOpen && (
                <div className="absolute z-10 mt-1 bg-white rounded-lg shadow-lg ring-1 ring-black ring-opacity-5 p-4 min-w-[280px]">
                    {/* Calendar Header */}
                    <div className="flex items-center justify-between mb-4">
                        <button
                            type="button"
                            className="p-1 hover:bg-gray-100 rounded-md"
                            onClick={() => navigateMonth('prev')}
                        >
                            <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" strokeWidth="1.5" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 19.5L8.25 12l7.5-7.5" />
                            </svg>
                        </button>

                        <h3 className="text-lg font-semibold text-gray-900">
                            {monthNames[currentMonth.getMonth()]} {currentMonth.getFullYear()}
                        </h3>

                        <button
                            type="button"
                            className="p-1 hover:bg-gray-100 rounded-md"
                            onClick={() => navigateMonth('next')}
                        >
                            <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" strokeWidth="1.5" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" d="M8.25 4.5l7.5 7.5-7.5 7.5" />
                            </svg>
                        </button>
                    </div>

                    {/* Day Names */}
                    <div className="grid grid-cols-7 gap-1 mb-2">
                        {dayNames.map(day => (
                            <div key={day} className="text-center text-sm font-medium text-gray-500 py-2">
                                {day}
                            </div>
                        ))}
                    </div>

                    {/* Calendar Days */}
                    <div className="grid grid-cols-7 gap-1">
                        {getDaysInMonth(currentMonth).map((date, index) => {
                            const isCurrentMonth = date.getMonth() === currentMonth.getMonth();
                            const isSelected = selectedDate &&
                                date.getDate() === selectedDate.getDate() &&
                                date.getMonth() === selectedDate.getMonth() &&
                                date.getFullYear() === selectedDate.getFullYear();
                            const isToday =
                                date.getDate() === new Date().getDate() &&
                                date.getMonth() === new Date().getMonth() &&
                                date.getFullYear() === new Date().getFullYear();
                            const isDisabled = isDateDisabled(date);

                            return (
                                <button
                                    key={index}
                                    type="button"
                                    className={`
                    w-8 h-8 text-sm rounded-md transition-colors
                    ${!isCurrentMonth
                                            ? 'text-gray-300 hover:text-gray-400'
                                            : isSelected
                                                ? 'bg-blue-600 text-white'
                                                : isToday
                                                    ? 'bg-blue-100 text-blue-600 hover:bg-blue-200'
                                                    : isDisabled
                                                        ? 'text-gray-300 cursor-not-allowed'
                                                        : 'text-gray-900 hover:bg-gray-100'
                                        }
                  `}
                                    onClick={() => !isDisabled && handleDateSelect(date)}
                                    disabled={isDisabled}
                                >
                                    {date.getDate()}
                                </button>
                            );
                        })}
                    </div>
                </div>
            )}
        </div>
    );
};

export default DatePicker;