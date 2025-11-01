import React, { useState, useRef, useEffect, useCallback } from 'react';
import DatePicker from '../common/DatePicker';
import { presets } from '../../utils/DummyAnalyticsData';

export interface DateRange {
    start: string;
    end: string;
    label?: string;
}

interface DateRangePickerProps {
    value: DateRange;
    onChange: (range: DateRange) => void;
    className?: string;
    disabled?: boolean;
}

const DateRangePicker: React.FC<DateRangePickerProps> = ({
    value,
    onChange,
    className = '',
    disabled = false
}) => {
    const [isOpen, setIsOpen] = useState(false);
    const [selectedPreset, setSelectedPreset] = useState<string>('custom');
    const containerRef = useRef<HTMLDivElement>(null);

    // Check if current value matches any preset
    useEffect(() => {
        const matchingPreset = presets.find(preset => {
            const presetValue = preset.getValue();
            return presetValue.start === value.start && presetValue.end === value.end;
        });

        setSelectedPreset(matchingPreset?.key || 'custom');
    }, [value]);

    // Close dropdown when clicking outside
    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
                setIsOpen(false);
            }
        };

        if (isOpen) {
            document.addEventListener('mousedown', handleClickOutside);
        }
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, [isOpen]);

    const handlePresetSelect = useCallback((preset: typeof presets[0]) => {
        const newRange = preset.getValue();
        setSelectedPreset(preset.key);
        onChange(newRange);
        setIsOpen(false);
    }, [onChange]);

    const handleCustomDateChange = useCallback((field: 'start' | 'end', date: string) => {
        const newRange = { ...value, [field]: date, label: undefined };
        setSelectedPreset('custom');
        onChange(newRange);
    }, [value, onChange]);

    const formatDisplayValue = () => {
        if (value.label) return value.label;

        const startDate = new Date(value.start);
        const endDate = new Date(value.end);

        if (value.start === value.end) {
            return startDate.toLocaleDateString();
        }

        return `${startDate.toLocaleDateString()} - ${endDate.toLocaleDateString()}`;
    };

    const isValidRange = value.start && value.end && value.start <= value.end;

    return (
        <div className={`relative ${className}`} ref={containerRef}>
            {/* Trigger Button */}
            <button
                type="button"
                onClick={() => !disabled && setIsOpen(!isOpen)}
                disabled={disabled}
                className={`
                    flex items-center justify-between w-full px-3 py-2 text-sm bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm
                    ${disabled
                        ? 'cursor-not-allowed bg-gray-50 dark:bg-gray-900 text-gray-500 dark:text-gray-600'
                        : 'hover:bg-gray-50 dark:hover:bg-gray-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500'
                    }
                    ${!isValidRange ? 'border-red-300 dark:border-red-700 text-red-900 dark:text-red-400' : 'text-gray-900 dark:text-white'}
                `}
            >
                <div className="flex items-center gap-2">
                    <svg className="w-4 h-4 text-gray-400 dark:text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                    </svg>
                    <span className="truncate">
                        {isValidRange ? formatDisplayValue() : 'Select date range'}
                    </span>
                </div>
                <svg className={`w-4 h-4 text-gray-400 dark:text-gray-500 transition-transform ${isOpen ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                </svg>
            </button>

            {/* Dropdown */}
            {isOpen && (
                <div className="absolute z-50 mt-1 w-full min-w-[320px] bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg shadow-lg">
                    <div className="p-4">
                        {/* Preset Options */}
                        <div className="mb-4">
                            <h4 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Quick Select</h4>
                            <div className="grid grid-cols-2 gap-2">
                                {presets.map((preset) => (
                                    <button
                                        key={preset.key}
                                        type="button"
                                        onClick={() => handlePresetSelect(preset)}
                                        className={`
                                            px-3 py-2 text-sm rounded-md text-left transition-colors
                                            ${selectedPreset === preset.key
                                                ? 'bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 border border-blue-200 dark:border-blue-700'
                                                : 'bg-gray-50 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-600 border border-transparent'
                                            }
                                        `}
                                    >
                                        {preset.label}
                                    </button>
                                ))}
                            </div>
                        </div>

                        {/* Custom Date Range */}
                        <div className="border-t border-gray-200 dark:border-gray-700 pt-4">
                            <h4 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-3">Custom Range</h4>
                            <div className="space-y-3">
                                <div>
                                    <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">
                                        Start Date
                                    </label>
                                    <DatePicker
                                        value={value.start}
                                        onChange={(date) => handleCustomDateChange('start', date)}
                                        placeholder="Start date"
                                        maxDate={value.end || undefined}
                                        className="w-full"
                                    />
                                </div>
                                <div>
                                    <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">
                                        End Date
                                    </label>
                                    <DatePicker
                                        value={value.end}
                                        onChange={(date) => handleCustomDateChange('end', date)}
                                        placeholder="End date"
                                        minDate={value.start || undefined}
                                        className="w-full"
                                    />
                                </div>
                            </div>
                        </div>

                        {/* Actions */}
                        <div className="flex justify-end gap-2 mt-4 pt-4 border-t border-gray-200 dark:border-gray-700">
                            <button
                                type="button"
                                onClick={() => setIsOpen(false)}
                                className="px-3 py-1.5 text-sm text-gray-600 dark:text-gray-400 hover:text-gray-800 dark:hover:text-gray-200 transition-colors"
                            >
                                Cancel
                            </button>
                            <button
                                type="button"
                                onClick={() => setIsOpen(false)}
                                disabled={!isValidRange}
                                className={`
                                    px-3 py-1.5 text-sm rounded-md transition-colors
                                    ${isValidRange
                                        ? 'bg-blue-600 dark:bg-blue-700 text-white hover:bg-blue-700 dark:hover:bg-blue-600'
                                        : 'bg-gray-300 dark:bg-gray-700 text-gray-500 dark:text-gray-600 cursor-not-allowed'
                                    }
                                `}
                            >
                                Apply
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default DateRangePicker;