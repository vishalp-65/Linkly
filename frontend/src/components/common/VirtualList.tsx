import React, { useState, useRef, useMemo, useCallback } from 'react';

interface VirtualListProps<T> {
    items: T[];
    itemHeight: number;
    containerHeight: number;
    renderItem: (item: T, index: number) => React.ReactNode;
    overscan?: number;
    className?: string;
}

function VirtualList<T>({
    items,
    itemHeight,
    containerHeight,
    renderItem,
    overscan = 5,
    className = '',
}: VirtualListProps<T>) {
    const [scrollTop, setScrollTop] = useState(0);
    const scrollElementRef = useRef<HTMLDivElement>(null);

    const handleScroll = useCallback((e: React.UIEvent<HTMLDivElement>) => {
        setScrollTop(e.currentTarget.scrollTop);
    }, []);

    const { visibleItems, totalHeight, offsetY } = useMemo(() => {
        const containerItemCount = Math.ceil(containerHeight / itemHeight);
        const startIndex = Math.floor(scrollTop / itemHeight);
        const endIndex = Math.min(
            startIndex + containerItemCount + overscan,
            items.length - 1
        );

        const visibleStartIndex = Math.max(0, startIndex - overscan);
        const visibleEndIndex = endIndex;

        return {
            visibleItems: items.slice(visibleStartIndex, visibleEndIndex + 1).map((item, index) => ({
                item,
                index: visibleStartIndex + index,
            })),
            totalHeight: items.length * itemHeight,
            offsetY: visibleStartIndex * itemHeight,
        };
    }, [items, itemHeight, scrollTop, containerHeight, overscan]);

    return (
        <div
            ref={scrollElementRef}
            className={`overflow-auto ${className}`}
            style={{ height: containerHeight }}
            onScroll={handleScroll}
        >
            <div style={{ height: totalHeight, position: 'relative' }}>
                <div style={{ transform: `translateY(${offsetY}px)` }}>
                    {visibleItems.map(({ item, index }) => (
                        <div key={index} style={{ height: itemHeight }}>
                            {renderItem(item, index)}
                        </div>
                    ))}
                </div>
            </div>
        </div>
    );
}

export default React.memo(VirtualList) as typeof VirtualList;