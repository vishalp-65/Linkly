import React from 'react';
import URLShortenerForm from '../components/URLShortenerForm';

const HomePage: React.FC = () => {
  return (
    <main className="min-h-screen bg-gradient-to-br from-gray-100 via-blue-100/70 to-indigo-100 dark:from-gray-900 dark:via-blue-900 dark:to-indigo-900" id="main-content">
      {/* Hero Section */}
      <section className="relative overflow-hidden" aria-labelledby="hero-heading">
        <div className="max-w-7xl lg:flex lg:flex-row xl:flex kl:flex xl:flex-row items-center gap-8 justify-between flex flex-col mx-auto px-4 sm:px-6 lg:px-8 pt-20 pb-16">
          <header className="text-center w-3xl">
            <h1 id="hero-heading" className="text-4xl md:text-6xl font-bold text-gray-900 dark:text-gray-100 mb-6">
              Shorten Your URLs
              <span className="block text-transparent bg-clip-text bg-gradient-to-r from-blue-600 to-purple-600 dark:from-blue-400 dark:to-purple-400">
                Share Anywhere
              </span>
            </h1>
            <p className="text-xl text-gray-600 dark:text-gray-300 mb-12 max-w-3xl mx-auto leading-relaxed">
              Transform long, complex URLs into short, shareable links. Track clicks,
              analyze performance, and manage all your links in one place.
            </p>
          </header>

          {/* URL Shortener Form */}
          <div className="max-w-3xl md:w-2xl sm:w-xl mx-auto">
            <URLShortenerForm />
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="py-10" aria-labelledby="cta-heading">
        <div className="max-w-4xl mx-auto text-center px-4 sm:px-6 lg:px-8">
          <h2 id="cta-heading" className="text-3xl font-bold text-gray-900 dark:text-gray-100 mb-4">
            Ready to Get Started?
          </h2>
          <p className="text-xl text-gray-600 dark:text-gray-300 mb-8">
            Join thousands of users who trust Linkly for their URL shortening needs
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <a
              href="/register"
              className="inline-flex items-center justify-center px-8 py-3 border border-transparent text-base font-medium rounded-lg text-white bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700 transition-all duration-200 shadow-lg hover:shadow-xl"
              aria-describedby="cta-heading"
            >
              Sign Up Free
            </a>
            <a
              href="/login"
              className="inline-flex items-center justify-center px-8 py-3 border border-gray-300 text-base font-medium rounded-lg text-gray-700 bg-white hover:bg-gray-50 transition-all duration-200 shadow-md hover:shadow-lg"
              aria-describedby="cta-heading"
            >
              Sign In
            </a>
          </div>
        </div>
      </section>

      {/* Features Section */}
      <section className="py-16 bg-white/50 dark:bg-gray-800/50 backdrop-blur-sm" aria-labelledby="features-heading">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <header className="text-center mb-16">
            <h2 id="features-heading" className="text-3xl font-bold text-gray-900 dark:text-gray-100 mb-4">
              Why Choose Linkly?
            </h2>
            <p className="text-gray-600 dark:text-gray-300 max-w-2xl mx-auto">
              Powerful features to help you manage and track your shortened URLs
            </p>
          </header>

          <div className="grid md:grid-cols-3 gap-8" role="list">
            {/* Feature 1 */}
            <article className="text-center p-6 rounded-2xl bg-white dark:bg-gray-800 shadow-lg border border-gray-100 dark:border-gray-700" role="listitem">
              <div className="w-16 h-16 bg-gradient-to-br from-blue-100 to-blue-200 dark:from-blue-800 dark:to-blue-700 rounded-2xl flex items-center justify-center mx-auto mb-4">
                <svg className="w-8 h-8 text-blue-600 dark:text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1" />
                </svg>
              </div>
              <h3 className="text-xl font-semibold text-gray-900 dark:text-gray-100 mb-2">
                Lightning Fast
              </h3>
              <p className="text-gray-600 dark:text-gray-300">
                Generate short URLs instantly with our optimized infrastructure
              </p>
            </article>

            {/* Feature 2 */}
            <article className="text-center p-6 rounded-2xl bg-white dark:bg-gray-800 shadow-lg border border-gray-100 dark:border-gray-700" role="listitem">
              <div className="w-16 h-16 bg-gradient-to-br from-green-100 to-green-200 dark:from-green-800 dark:to-green-700 rounded-2xl flex items-center justify-center mx-auto mb-4">
                <svg className="w-8 h-8 text-green-600 dark:text-green-400" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                </svg>
              </div>
              <h3 className="text-xl font-semibold text-gray-900 dark:text-gray-100 mb-2">
                Detailed Analytics
              </h3>
              <p className="text-gray-600 dark:text-gray-300">
                Track clicks, geographic data, and user engagement in real-time
              </p>
            </article>

            {/* Feature 3 */}
            <article className="text-center p-6 rounded-2xl bg-white dark:bg-gray-800 shadow-lg border border-gray-100 dark:border-gray-700" role="listitem">
              <div className="w-16 h-16 bg-gradient-to-br from-purple-100 to-purple-200 dark:from-purple-800 dark:to-purple-700 rounded-2xl flex items-center justify-center mx-auto mb-4">
                <svg className="w-8 h-8 text-purple-600 dark:text-purple-400" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                </svg>
              </div>
              <h3 className="text-xl font-semibold text-gray-900 dark:text-gray-100 mb-2">
                Secure & Reliable
              </h3>
              <p className="text-gray-600 dark:text-gray-300">
                Enterprise-grade security with 99.9% uptime guarantee
              </p>
            </article>
          </div>
        </div>
      </section>
    </main>
  );
};

export default HomePage;
