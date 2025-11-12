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

const DateRangePicker: React.FC<DateRangePickerProps> = ({ value, onChange, className = '', disabled = false }) => {
    const [isOpen, setIsOpen] = useState(false);
    const [selectedPreset, setSelectedPreset] = useState<string>('custom');
    const containerRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        const matchingPreset = presets.find(preset => {
            const presetValue = preset.getValue();
            return presetValue.start === value.start && presetValue.end === value.end;
        });
        setSelectedPreset(matchingPreset?.key || 'custom');
    }, [value]);

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
        if (value.start === value.end) return startDate.toLocaleDateString();
        return `${startDate.toLocaleDateString()} - ${endDate.toLocaleDateString()}`;
    };

    const isValidRange = value.start && value.end && value.start <= value.end;

    return (
        <div className={`relative ${className}`} ref={containerRef}>
            <button
                type="button"
                onClick={() => !disabled && setIsOpen(!isOpen)}
                disabled={disabled}
                className={`flex items-center justify-between w-full px-4 py-2.5 text-sm bg-white dark:bg-gray-800 border rounded-lg shadow-sm transition-all duration-200 ${disabled
                        ? 'cursor-not-allowed bg-gray-50 dark:bg-gray-900 text-gray-400 dark:text-gray-600 border-gray-200 dark:border-gray-700'
                        : 'hover:bg-gray-50 dark:hover:bg-gray-700 focus:outline-none focus:ring-2 focus:ring-blue-500 dark:focus:ring-blue-600 focus:border-transparent border-gray-300 dark:border-gray-600'
                    } ${!isValidRange ? 'border-red-300 dark:border-red-700' : ''}`}
            >
                <div className="flex items-center gap-2.5">
                    <svg className="w-4 h-4 text-gray-500 dark:text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                    </svg>
                    <span className={`truncate font-medium ${!isValidRange ? 'text-red-600 dark:text-red-400' : 'text-gray-900 dark:text-white'}`}>
                        {isValidRange ? formatDisplayValue() : 'Select date range'}
                    </span>
                </div>
                <svg className={`w-4 h-4 text-gray-500 dark:text-gray-400 transition-transform duration-200 ${isOpen ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                </svg>
            </button>

            {isOpen && (
                <div className="absolute z-50 mt-2 w-full sm:w-96 bg-white dark:bg-gray-800 rounded-xl shadow-2xl dark:shadow-gray-900/50 border border-gray-200 dark:border-gray-700 overflow-hidden animate-scale-in">
                    <div className="p-5">
                        {/* Header */}
                        <div className="mb-4">
                            <h4 className="text-sm font-semibold text-gray-900 dark:text-white mb-1">Select Date Range</h4>
                            <p className="text-xs text-gray-600 dark:text-gray-400">Choose a preset or custom range</p>
                        </div>

                        {/* Preset Options */}
                        <div className="mb-5">
                            <label className="text-xs font-medium text-gray-700 dark:text-gray-300 uppercase tracking-wide mb-2 block">
                                Quick Select
                            </label>
                            <div className="grid grid-cols-2 gap-2">
                                {presets.map((preset) => (
                                    <button
                                        key={preset.key}
                                        type="button"
                                        onClick={() => handlePresetSelect(preset)}
                                        className={`px-3 py-2.5 text-sm rounded-lg text-left transition-all duration-200 ${selectedPreset === preset.key
                                                ? 'bg-gradient-to-r from-blue-600 to-indigo-600 text-white shadow-md transform scale-[1.02]'
                                                : 'bg-gray-50 dark:bg-gray-700/50 text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 border border-transparent hover:border-gray-300 dark:hover:border-gray-600'
                                            }`}
                                    >
                                        {preset.label}
                                    </button>
                                ))}
                            </div>
                        </div>

                        {/* Custom Date Range */}
                        <div className="pt-5 border-t border-gray-200 dark:border-gray-700">
                            <label className="text-xs font-medium text-gray-700 dark:text-gray-300 uppercase tracking-wide mb-3 block">
                                Custom Range
                            </label>
                            <div className="space-y-3">
                                <div>
                                    <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1.5">
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
                                    <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1.5">
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
                        <div className="flex justify-end gap-2 mt-5 pt-5 border-t border-gray-200 dark:border-gray-700">
                            <button
                                type="button"
                                onClick={() => setIsOpen(false)}
                                className="px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
                            >
                                Cancel
                            </button>
                            <button
                                type="button"
                                onClick={() => setIsOpen(false)}
                                disabled={!isValidRange}
                                className={`px-4 py-2 text-sm font-medium rounded-lg transition-all duration-200 ${isValidRange
                                        ? 'bg-gradient-to-r from-blue-600 to-indigo-600 text-white hover:from-blue-700 hover:to-indigo-700 shadow-md hover:shadow-lg active:scale-95'
                                        : 'bg-gray-200 dark:bg-gray-700 text-gray-400 dark:text-gray-600 cursor-not-allowed'
                                    }`}
                            >
                                Apply
                            </button>
                        </div>
                    </div>
                </div>
            )}

            <style>{`
                @keyframes scale-in {
                    from {
                        opacity: 0;
                        transform: scale(0.95) translateY(-10px);
                    }
                    to {
                        opacity: 1;
                        transform: scale(1) translateY(0);
                    }
                }
                .animate-scale-in {
                    animation: scale-in 0.15s ease-out;
                }
            `}</style>
        </div>
    );
};

export default DateRangePicker;