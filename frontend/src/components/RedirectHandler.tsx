import React, { useEffect, useRef } from 'react';
import { useParams } from 'react-router-dom';
import { API_REDIRECT_BASE_URL } from '../utils/constant';
import { redirectTracker } from '../utils/redirectTracker';

const RedirectHandler: React.FC = () => {
  const { shortCode } = useParams<{ shortCode: string }>();
  const hasRedirected = useRef(false);

  useEffect(() => {
    const handleRedirect = () => {
      if (!shortCode) {
        console.log('RedirectHandler: No shortCode provided');
        return;
      }

      // Prevent double execution in React StrictMode using ref
      if (hasRedirected.current) {
        console.log('RedirectHandler: Skipping redirect (ref check - already redirected)');
        return;
      }

      // Prevent duplicate redirects globally using tracker
      if (!redirectTracker.shouldRedirect(shortCode)) {
        console.log('RedirectHandler: Skipping redirect (tracker check - duplicate blocked)');
        return;
      }

      hasRedirected.current = true;
      redirectTracker.markRedirected(shortCode);

      console.log('RedirectHandler: Starting redirect for', shortCode);

      // Simply redirect to the backend endpoint
      // The backend will handle the 301 redirect and analytics tracking
      window.location.href = `${API_REDIRECT_BASE_URL}/${shortCode}`;
    };

    handleRedirect();
  }, [shortCode]);


  if (shortCode) {
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
            Redirecting...
          </h2>
          <p className="text-gray-600 leading-relaxed">
            You will be redirected to your destination shortly.
          </p>
        </div>
      </div>
    );
  }

  return null;
};

export default RedirectHandler;
