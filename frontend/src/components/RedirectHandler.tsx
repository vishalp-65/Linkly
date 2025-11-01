import React, { useEffect, useState } from 'react';
import { useParams, Navigate } from 'react-router-dom';
import { useGetUrlByShortCodeQuery } from '../services/api';

const RedirectHandler: React.FC = () => {
  const { shortCode } = useParams<{ shortCode: string }>();
  const [redirecting, setRedirecting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const {
    data: urlData,
    error: queryError,
    isLoading,
  } = useGetUrlByShortCodeQuery(shortCode!, {
    skip: !shortCode,
  });

  useEffect(() => {
    if (urlData?.data?.long_url && !redirecting) {
      setRedirecting(true);
      // Redirect to the long URL
      window.location.href = urlData.data.long_url;
    }
  }, [urlData, redirecting]);

  useEffect(() => {
    if (queryError) {
      if ('status' in queryError) {
        switch (queryError.status) {
          case 404:
            setError('Short URL not found');
            break;
          case 410:
            setError('Short URL has expired');
            break;
          default:
            setError('Failed to resolve short URL');
        }
      } else {
        setError('Network error occurred');
      }
    }
  }, [queryError]);

  // If there's an error, redirect to 404 page
  if (error) {
    return <Navigate to="/404" replace />;
  }

  // Show loading state while resolving the short URL
  if (isLoading || redirecting) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-gray-50 via-blue-50 to-indigo-100 flex items-center justify-center">
        <div className="max-w-md w-full text-center">
          <div className="mb-8">
            <div className="relative">
              <div className="animate-spin rounded-full h-16 w-16 border-4 border-gray-200 mx-auto"></div>
              <div className="animate-spin rounded-full h-16 w-16 border-4 border-blue-600 border-t-transparent absolute top-0 left-1/2 transform -translate-x-1/2"></div>
            </div>
          </div>

          <h2 className="text-2xl font-semibold text-gray-800 mb-3">
            {redirecting ? 'Redirecting...' : 'Resolving URL...'}
          </h2>
          <p className="text-gray-600 leading-relaxed">
            {redirecting
              ? 'You will be redirected to your destination shortly.'
              : 'Please wait while we resolve your short URL.'}
          </p>

          {shortCode && (
            <div className="mt-6 p-4 bg-white/70 backdrop-blur-sm rounded-lg border border-gray-200">
              <p className="text-sm text-gray-500 mb-1">Short Code:</p>
              <p className="font-mono text-lg text-blue-600">{shortCode}</p>
            </div>
          )}
        </div>
      </div>
    );
  }

  return null;
};

export default RedirectHandler;
