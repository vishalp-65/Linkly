import React, { useState } from 'react';
import Button from './common/Button';
import { QR_CODE_GENERATOR_URL } from '../utils/constant';

export interface URLResultData {
  shortUrl: string;
  originalUrl: string;
  customAlias?: string;
  expiryDate?: string;
  createdAt: string;
}

export interface URLResultProps {
  result: URLResultData;
  onShowToast: (message: string, type: 'success' | 'error') => void;
}

const URLResult: React.FC<URLResultProps> = ({ result, onShowToast }) => {
  const [copied, setCopied] = useState(false);

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

  const generateQRCodeUrl = (url: string) => {
    const encodedUrl = encodeURIComponent(url);
    return `${QR_CODE_GENERATOR_URL}${encodedUrl}`;
  };

  const handleShare = (platform: string) => {
    const shareUrl = result.shortUrl;
    const shareText = `Check out this link: ${shareUrl}`;
    let shareLink = '';

    switch (platform) {
      case 'twitter':
        shareLink = `https://twitter.com/intent/tweet?text=${encodeURIComponent(shareText)}`;
        break;
      case 'facebook':
        shareLink = `https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(shareUrl)}`;
        break;
      case 'linkedin':
        shareLink = `https://www.linkedin.com/sharing/share-offsite/?url=${encodeURIComponent(shareUrl)}`;
        break;
      case 'whatsapp':
        shareLink = `https://wa.me/?text=${encodeURIComponent(shareText)}`;
        break;
      default:
        return;
    }

    window.open(shareLink, '_blank', 'width=600,height=400');
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

  return (
    <div className="space-y-4 p-2 w-full bg-white dark:bg-gray-800 transition-all duration-300">
      {/* Header */}
      <div className="text-center">
        <div className="flex items-center justify-center mb-3">
          <div className="bg-green-100 dark:bg-green-900/30 rounded-full p-3 shadow-sm">
            <svg
              className="w-8 h-8 text-green-600 dark:text-green-400"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"
              />
            </svg>
          </div>
        </div>
        <p className="text-sm text-gray-600 dark:text-gray-400">
          Your shortened link is ready!
        </p>
      </div>

      {/* Clickable short URL */}
      <div className="flex items-center justify-center gap-3">
        <a
          href={result.shortUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="text-xl font-semibold text-blue-600 dark:text-blue-400 hover:underline break-all cursor-pointer"
          title="Click to open"
        >
          {result.shortUrl}
        </a>
        <button
          type="button"
          onClick={handleCopyToClipboard}
          title="Copy to clipboard"
          className="flex-shrink-0"
        >
          {copied ? (
            <svg
              className="h-5 w-5 text-green-600"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M5 13l4 4L19 7"
              />
            </svg>
          ) : (
            <svg
              className="h-5 w-5 text-gray-600 hover:text-gray-800 dark:text-gray-400 dark:hover:text-gray-200"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z"
              />
            </svg>
          )}
        </button>
      </div>
      {copied && (
        <p className="text-center text-sm text-green-500 mt-1">
          Copied to clipboard!
        </p>
      )}

      {/* Details */}
      <div className="pt-4 border-t border-gray-200 dark:border-gray-700 space-y-3 text-sm">
        <div className="flex justify-start gap-2">
          <span className="font-medium text-gray-700 dark:text-gray-300">
            Original URL:
          </span>
          <span className="text-gray-600 dark:text-gray-400 break-all text-right truncate text-nowrap">
            {result.originalUrl}
          </span>
        </div>
        {result.customAlias && (
          <div className="flex justify-start gap-2">
            <span className="font-medium text-gray-700 dark:text-gray-300">
              Custom alias:
            </span>
            <span className="text-blue-600 dark:text-blue-400 font-mono">
              {result.customAlias}
            </span>
          </div>
        )}
        {result.expiryDate && (
          <div className="flex justify-start gap-2">
            <span className="font-medium text-gray-700 dark:text-gray-300">
              Expires:
            </span>
            <span className="text-gray-600 dark:text-gray-400">
              {new Date(result.expiryDate).toLocaleDateString()}
            </span>
          </div>
        )}
        <div className="flex justify-start gap-2">
          <span className="font-medium text-gray-700 dark:text-gray-300">
            Created:
          </span>
          <span className="text-gray-600 dark:text-gray-400">
            {new Date(result.createdAt).toLocaleDateString()}
          </span>
        </div>
      </div>

      {/* QR Code */}
      <div className="flex flex-col items-center space-y-3 bg-gradient-to-br from-gray-50 to-gray-100 dark:from-gray-700 dark:to-gray-800 rounded-lg p-4 shadow-inner">
        <h4 className="text-sm font-medium text-gray-700 dark:text-gray-300">
          QR Code
        </h4>
        <div className="bg-white dark:bg-gray-900 p-4 rounded-lg border border-gray-200 dark:border-gray-600 shadow-sm">
          <img
            src={generateQRCodeUrl(result.shortUrl)}
            alt="QR Code"
            className="w-32 h-32"
            loading="lazy"
          />
        </div>
        <p className="text-xs text-gray-500 dark:text-gray-400 text-center">
          Scan with your phone to open the link
        </p>
        <Button
          variant="secondary"
          size="sm"
          onClick={handleDownloadQR}
          className="flex items-center gap-2"
        >
          <svg
            className="w-4 h-4"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4"
            />
          </svg>
          Download QR Code
        </Button>
      </div>

      {/* Social Icons */}
      <div className="flex justify-center items-center gap-5 pt-4 border-t border-gray-200 dark:border-gray-700">
        <div
          onClick={() => handleShare('twitter')}
          className="w-10 h-10 rounded-full bg-[#1DA1F2] flex items-center justify-center text-white cursor-pointer hover:scale-110 transition"
        >
          <i className="fab fa-twitter text-lg"></i>
        </div>
        <div
          onClick={() => handleShare('facebook')}
          className="w-10 h-10 rounded-full bg-[#1877F2] flex items-center justify-center text-white cursor-pointer hover:scale-110 transition"
        >
          <i className="fab fa-facebook-f text-lg"></i>
        </div>
        <div
          onClick={() => handleShare('linkedin')}
          className="w-10 h-10 rounded-full bg-[#0077B5] flex items-center justify-center text-white cursor-pointer hover:scale-110 transition"
        >
          <i className="fab fa-linkedin-in text-lg"></i>
        </div>
        <div
          onClick={() => handleShare('whatsapp')}
          className="w-10 h-10 rounded-full bg-[#25D366] flex items-center justify-center text-white cursor-pointer hover:scale-110 transition"
        >
          <i className="fab fa-whatsapp text-lg"></i>
        </div>
      </div>
    </div>
  );
};

export default URLResult;
