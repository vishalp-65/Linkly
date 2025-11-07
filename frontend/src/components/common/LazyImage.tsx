import React, { useState, useRef, useEffect, useCallback } from 'react';

interface LazyImageProps {
    src: string;
    alt: string;
    className?: string;
    placeholder?: string;
    fallback?: string;
    webpSrc?: string;
    onLoad?: () => void;
    onError?: () => void;
}

const LazyImage: React.FC<LazyImageProps> = React.memo(({
    src,
    alt,
    className = '',
    placeholder,
    fallback,
    webpSrc,
    onLoad,
    onError,
}) => {
    const [isLoaded, setIsLoaded] = useState(false);
    const [isInView, setIsInView] = useState(false);
    const [hasError, setHasError] = useState(false);
    const imgRef = useRef<HTMLImageElement>(null);
    const observerRef = useRef<IntersectionObserver | null>(null);

    // Intersection Observer for lazy loading
    useEffect(() => {
        const currentImg = imgRef.current;
        if (!currentImg) return;

        observerRef.current = new IntersectionObserver(
            (entries) => {
                entries.forEach((entry) => {
                    if (entry.isIntersecting) {
                        setIsInView(true);
                        observerRef.current?.unobserve(entry.target);
                    }
                });
            },
            {
                rootMargin: '50px', // Start loading 50px before the image comes into view
                threshold: 0.1,
            }
        );

        observerRef.current.observe(currentImg);

        return () => {
            if (observerRef.current && currentImg) {
                observerRef.current.unobserve(currentImg);
            }
        };
    }, []);

    const handleLoad = useCallback(() => {
        setIsLoaded(true);
        onLoad?.();
    }, [onLoad]);

    const handleError = useCallback(() => {
        setHasError(true);
        onError?.();
    }, [onError]);

    // Determine which source to use
    const imageSrc = hasError && fallback ? fallback : src;
    const shouldShowImage = isInView && !hasError;

    return (
        <div className={`relative overflow-hidden ${className}`} ref={imgRef}>
            {/* Placeholder */}
            {(!isLoaded || !shouldShowImage) && (
                <div className="absolute inset-0 bg-gray-200 animate-pulse flex items-center justify-center">
                    {placeholder ? (
                        <img src={placeholder} alt="" className="w-full h-full object-cover opacity-50" />
                    ) : (
                        <svg
                            className="w-8 h-8 text-gray-400"
                            fill="none"
                            stroke="currentColor"
                            viewBox="0 0 24 24"
                        >
                            <path
                                strokeLinecap="round"
                                strokeLinejoin="round"
                                strokeWidth={2}
                                d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z"
                            />
                        </svg>
                    )}
                </div>
            )}

            {/* Actual Image with WebP support */}
            {shouldShowImage && (
                <picture>
                    {webpSrc && (
                        <source srcSet={webpSrc} type="image/webp" />
                    )}
                    <img
                        src={imageSrc}
                        alt={alt}
                        className={`w-full h-full object-cover transition-opacity duration-300 ${isLoaded ? 'opacity-100' : 'opacity-0'
                            }`}
                        onLoad={handleLoad}
                        onError={handleError}
                        loading="lazy"
                    />
                </picture>
            )}

            {/* Error state */}
            {hasError && !fallback && (
                <div className="absolute inset-0 bg-gray-100 flex items-center justify-center">
                    <div className="text-center text-gray-500">
                        <svg
                            className="w-8 h-8 mx-auto mb-2"
                            fill="none"
                            stroke="currentColor"
                            viewBox="0 0 24 24"
                        >
                            <path
                                strokeLinecap="round"
                                strokeLinejoin="round"
                                strokeWidth={2}
                                d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
                            />
                        </svg>
                        <p className="text-xs">Failed to load image</p>
                    </div>
                </div>
            )}
        </div>
    );
});

LazyImage.displayName = 'LazyImage';

export default LazyImage;