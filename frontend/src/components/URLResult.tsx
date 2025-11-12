import React, { useEffect, useRef, useState } from 'react';
import Button from './common/Button';
import { QR_CODE_GENERATOR_URL } from '../utils/constant';
import { useFocusRestore, useKeyboardNavigation } from '../hooks/useKeyboardNavigation';
import { getFocusableElements } from '../utils/keyboard';

export interface URLResultData {
  shortUrl: string;
  originalUrl: string;
  customAlias?: string;
  expiryDate?: string;
  createdAt: string;
}

interface ModalProps {
  isOpen: boolean;
  onClose: () => void;
  closeOnOverlayClick?: boolean;
  title?: string;
  closeOnEscape?: boolean;
}

export interface URLResultProps {
  result: URLResultData;
  modalProps: ModalProps;
  onShowToast: (message: string, type: 'success' | 'error') => void;
}

const URLResult: React.FC<URLResultProps> = ({ result, onShowToast, modalProps }) => {
  const { isOpen, onClose, closeOnEscape = true, title = "Success! Your Link is Ready 🎉" } = modalProps;
  const [copied, setCopied] = useState(false);
  const modalRef = useRef<HTMLDivElement | null>(null);

  const handleCopyToClipboard = async () => {
    try {
      await navigator.clipboard.writeText(result.shortUrl);
      setCopied(true);
      onShowToast('Short URL copied to clipboard!', 'success');
      setTimeout(() => setCopied(false), 2000);
    } catch (error) {
      onShowToast('Failed to copy URL to clipboard', 'error');
    }
  };

  // Use keyboard navigation hook for focus trapping and escape handling
  const { containerRef } = useKeyboardNavigation({
    trapFocus: isOpen,
    handleEscape: closeOnEscape ? onClose : undefined,
  });

  // Use focus restore hook
  useFocusRestore(isOpen);

  // Combine refs for keyboard navigation
  useEffect(() => {
    if (modalRef.current && containerRef) {
      (containerRef as React.MutableRefObject<HTMLElement | null>).current = modalRef.current;
    }
  }, [containerRef]);

  useEffect(() => {
    if (isOpen) {
      // Focus the modal and prevent body scroll
      setTimeout(() => {
        const focusableElements = modalRef.current ? getFocusableElements(modalRef.current) : [];
        if (focusableElements.length > 0) {
          focusableElements[0].focus();
        } else {
          modalRef.current?.focus();
        }
      }, 0);

      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = 'unset';
    }

    return () => {
      document.body.style.overflow = 'unset';
    };
  }, [isOpen]);

  // Close modal on Escape key and prevent background scroll
  useEffect(() => {
    if (!isOpen) return;

    // Prevent background scroll
    const originalOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';

    if (closeOnEscape) {
      const handleKeyDown = (e: KeyboardEvent) => {
        if (e.key === 'Escape') onClose();
      };
      window.addEventListener('keydown', handleKeyDown);
      return () => {
        window.removeEventListener('keydown', handleKeyDown);
        document.body.style.overflow = originalOverflow;
      };
    }

    return () => {
      document.body.style.overflow = originalOverflow;
    };
  }, [isOpen, closeOnEscape, onClose]);


  if (!isOpen) return null;

  const generateQRCodeUrl = (url: string) => {
    const encodedUrl = encodeURIComponent(url);
    return `${QR_CODE_GENERATOR_URL}${encodedUrl}`;
  };

  const handleShare = (platform: string) => {
    const shareUrl = result.shortUrl;
    const shareText = `Check out this link: ${shareUrl}`;
    const shareLinks = {
      twitter: `https://twitter.com/intent/tweet?text=${encodeURIComponent(shareText)}`,
      facebook: `https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(shareUrl)}`,
      linkedin: `https://www.linkedin.com/sharing/share-offsite/?url=${encodeURIComponent(shareUrl)}`,
      whatsapp: `https://wa.me/?text=${encodeURIComponent(shareText)}`,
    };

    const link = shareLinks[platform as keyof typeof shareLinks];
    if (link) {
      window.open(link, '_blank', 'width=600,height=400');
    }
  };

  const handleDownloadQR = () => {
    const qrUrl = generateQRCodeUrl(result.shortUrl);
    const link = document.createElement('a');
    link.href = qrUrl;
    link.download = `qr-code-${result.customAlias || 'short-url'}.png`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    onShowToast('QR Code downloaded!', 'success');
  };

  const socialPlatforms = [
    { name: 'twitter', color: 'bg-[#1DA1F2] hover:bg-[#1a8cd8]', icon: 'fa-twitter' },
    { name: 'facebook', color: 'bg-[#1877F2] hover:bg-[#1665d8]', icon: 'fa-facebook-f' },
    { name: 'linkedin', color: 'bg-[#0077B5] hover:bg-[#006399]', icon: 'fa-linkedin-in' },
    { name: 'whatsapp', color: 'bg-[#25D366] hover:bg-[#20bd5a]', icon: 'fa-whatsapp' },
  ];

  const InfoRow = ({ label, value, valueClassName = '' }: { label: string; value: string; valueClassName?: string }) => (
    <div className="flex flex-col sm:flex-row sm:items-center gap-1 sm:gap-3 py-2">
      <span className="font-medium text-gray-700 dark:text-gray-300 text-sm sm:text-base min-w-fit">
        {label}:
      </span>
      <span className={`text-sm sm:text-base break-all ${valueClassName || 'text-gray-600 dark:text-gray-400'}`}>
        {value}
      </span>
    </div>
  );

  return (
    <div className='fixed inset-0 z-50 overflow-y-auto py-4 backdrop-blur-lg'>
      <div className="w-full max-w-4xl mx-auto px-3">
        <div
          ref={modalRef}
          className="relative bg-white dark:bg-gray-800 rounded-xl shadow-lg dark:shadow-gray-900/50 overflow-hidden transition-all duration-300 border border-gray-100 dark:border-gray-700"
        >
          {/* Close button inside modal */}
          <button
            type="button"
            className="absolute top-4 right-4 cursor-pointer sm:top-5 sm:right-5 z-10 flex items-center justify-center w-8 h-8 sm:w-10 sm:h-10 rounded-full bg-gray-100 hover:bg-gray-200 dark:bg-gray-700 dark:hover:bg-gray-600 text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200 transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 dark:focus:ring-offset-gray-800 shadow-sm hover:shadow-md active:scale-95"
            onClick={onClose}
            aria-label="Close modal"
          >
            <svg
              className="h-4 w-4 sm:h-6 sm:w-6 transition-transform group-hover:rotate-90 duration-200"
              fill="none"
              viewBox="0 0 24 24"
              strokeWidth="2"
              stroke="currentColor"
              aria-hidden="true"
            >
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>

          {/* Header */}
          <div className="bg-gradient-to-br from-green-50 to-emerald-50 dark:from-green-900/20 dark:to-emerald-900/20 px-4 sm:px-6 py-6 sm:py-8 text-center border-b border-green-100 dark:border-green-800/30">
            <div className="inline-flex items-center justify-center mb-4">
              <div className="relative">
                <div className="absolute inset-0 bg-green-400 dark:bg-green-500 rounded-full blur-xl opacity-40 animate-pulse"></div>
                <div className="relative bg-gradient-to-br from-green-400 to-emerald-500 dark:from-green-500 dark:to-emerald-600 rounded-full p-3 sm:p-4 shadow-lg">
                  <svg
                    className="w-7 h-7 sm:w-9 sm:h-9 text-white"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2.5}
                      d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"
                    />
                  </svg>
                </div>
              </div>
            </div>
            <h3 className="text-lg sm:text-xl font-bold text-gray-800 dark:text-gray-100 mb-2">
              {title}
            </h3>
            <p className="text-xs sm:text-sm text-gray-600 dark:text-gray-400">
              Share it anywhere, anytime
            </p>
          </div>

          {/* Body with Details + QR side by side */}
          <div className="flex flex-col lg:flex-row">
            {/* Left Content (Short URL + Details) */}
            <div className="flex-1 border-b lg:border-b-0 lg:border-r border-gray-100 dark:border-gray-700">
              {/* Short URL */}
              <div className="px-4 sm:px-6 py-5 sm:py-6 bg-gradient-to-br from-blue-50/50 to-indigo-50/50 dark:from-blue-900/10 dark:to-indigo-900/10">
                <div className="flex flex-row items-start sm:items-center gap-3 sm:gap-4">
                  <div className="flex-1 min-w-0 w-full">
                    <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-2 uppercase tracking-wide">
                      Your Short URL
                    </label>
                    <a
                      href={result.shortUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="block text-lg sm:text-xl font-semibold text-blue-600 dark:text-blue-400 hover:text-blue-700 dark:hover:text-blue-300 transition-colors break-all group"
                      title="Click to open in new tab"
                    >
                      <span className="group-hover:underline">{result.shortUrl}</span>
                      <svg
                        className="inline-block w-4 h-4 ml-1 opacity-0 group-hover:opacity-100 transition-opacity"
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={2}
                          d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14"
                        />
                      </svg>
                    </a>
                  </div>

                  <button
                    type="button"
                    onClick={handleCopyToClipboard}
                    className={`flex-shrink-0 cursor-pointer px-1.5 py-1 rounded-lg font-medium text-sm transition-all duration-200 shadow-sm ${copied
                      ? 'bg-green-500 text-white'
                      : 'bg-blue-600 hover:bg-blue-700 text-white hover:shadow-md active:scale-95'
                      }`}
                    title="Copy to clipboard"
                  >
                    <span className="flex items-center gap-2">
                      {copied ? (
                        <>
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
                          </svg>
                        </>
                      ) : (
                        <>
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path
                              strokeLinecap="round"
                              strokeLinejoin="round"
                              strokeWidth={2}
                              d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z"
                            />
                          </svg>
                        </>
                      )}
                    </span>
                  </button>
                </div>
              </div>

              {/* Link Details */}
              <div className="px-4 sm:px-6 py-5 sm:py-6 space-y-1">
                <h4 className="text-sm font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-3">
                  Link Details
                </h4>
                <InfoRow
                  label="Original URL"
                  value={result.originalUrl}
                  valueClassName="text-gray-600 dark:text-gray-400 font-mono text-xs sm:text-sm"
                />
                {result.customAlias && (
                  <InfoRow
                    label="Custom Alias"
                    value={result.customAlias}
                    valueClassName="text-blue-600 dark:text-blue-400 font-mono font-semibold"
                  />
                )}
                {result.expiryDate && (
                  <InfoRow
                    label="Expires"
                    value={new Date(result.expiryDate).toLocaleDateString('en-US', {
                      year: 'numeric',
                      month: 'long',
                      day: 'numeric'
                    })}
                    valueClassName="text-orange-600 dark:text-orange-400 font-medium"
                  />
                )}
                <InfoRow
                  label="Created"
                  value={new Date(result.createdAt).toLocaleDateString('en-US', {
                    year: 'numeric',
                    month: 'long',
                    day: 'numeric',
                    hour: '2-digit',
                    minute: '2-digit'
                  })}
                />
              </div>
            </div>

            {/* Right Content (QR Code) */}
            <div className="flex justify-center items-center lg:w-1/2 px-4 sm:px-6 py-6 bg-gradient-to-br from-gray-50 to-slate-50 dark:from-gray-800/50 dark:to-slate-800/50">
              <div className="flex flex-col items-center space-y-4">
                <div className="text-center">
                  <h4 className="text-base sm:text-lg font-semibold text-gray-800 dark:text-gray-200 mb-1">
                    QR Code
                  </h4>
                  <p className="text-xs sm:text-sm text-gray-500 dark:text-gray-400">
                    Scan to share instantly
                  </p>
                </div>
                <div className="relative group">
                  <div className="absolute inset-0 bg-gradient-to-br from-blue-400 to-purple-400 dark:from-blue-500 dark:to-purple-500 rounded-2xl blur-xl opacity-20 group-hover:opacity-30 transition-opacity"></div>
                  <div className="relative bg-white dark:bg-gray-900 p-4 sm:p-5 rounded-2xl shadow-lg dark:shadow-gray-900/50 border-2 border-gray-200 dark:border-gray-700 group-hover:border-blue-300 dark:group-hover:border-blue-600 transition-colors">
                    <img
                      src={generateQRCodeUrl(result.shortUrl)}
                      alt="QR Code for shortened URL"
                      className="w-32 h-32 sm:w-40 sm:h-40"
                      loading="lazy"
                    />
                  </div>
                </div>

                <Button
                  variant="secondary"
                  size="sm"
                  onClick={handleDownloadQR}
                  className="flex items-center gap-2 px-5 py-2.5 shadow-sm hover:shadow-md transition-all"
                >
                  <svg className="w-4 h-4 sm:w-5 sm:h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4"
                    />
                  </svg>
                  <span className="text-sm sm:text-base font-medium">Download QR Code</span>
                </Button>
              </div>
            </div>
          </div>

          {/* Social Share Section (unchanged) */}
          <div className="px-4 sm:px-6 py-5 sm:py-6 bg-gradient-to-br from-indigo-50/50 to-purple-50/50 dark:from-indigo-900/10 dark:to-purple-900/10">
            <div className="text-center mb-4">
              <h4 className="text-sm sm:text-base font-semibold text-gray-700 dark:text-gray-300 mb-1">
                Share Your Link
              </h4>
              <p className="text-xs text-gray-500 dark:text-gray-400">
                Choose your favorite platform
              </p>
            </div>

            <div className="flex flex-wrap justify-center items-center gap-3 sm:gap-4">
              {socialPlatforms.map((platform) => (
                <button
                  key={platform.name}
                  onClick={() => handleShare(platform.name)}
                  className={`group relative w-11 h-11 sm:w-12 sm:h-12 rounded-full ${platform.color} flex items-center justify-center text-white cursor-pointer transition-all duration-200 shadow-md hover:shadow-lg active:scale-95`}
                  title={`Share on ${platform.name.charAt(0).toUpperCase() + platform.name.slice(1)}`}
                  aria-label={`Share on ${platform.name}`}
                >
                  <i className={`fab ${platform.icon} text-base sm:text-lg`}></i>
                  <span className="absolute -bottom-8 left-1/2 -translate-x-1/2 bg-gray-900 dark:bg-gray-700 text-white text-xs px-2 py-1 rounded opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap pointer-events-none">
                    {platform.name.charAt(0).toUpperCase() + platform.name.slice(1)}
                  </span>
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );

};

export default URLResult;