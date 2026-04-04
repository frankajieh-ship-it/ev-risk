"use client";

import { useEffect } from "react";
import Link from "next/link";
import Header from "@/components/landing/Header";
import Footer from "@/components/landing/Footer";

interface ErrorProps {
  error: Error & { digest?: string };
  reset: () => void;
}

export default function GlobalError({ error, reset }: ErrorProps) {
  useEffect(() => {
    // Log to console so it appears in Netlify/Logtail function logs
    console.error("[GlobalError]", error.message, error.digest ?? "");
  }, [error]);

  return (
    <div className="min-h-screen flex flex-col bg-gray-50">
      <Header />
      <main className="flex-1 flex items-center justify-center px-4 py-24">
        <div className="max-w-md w-full text-center space-y-6">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-red-100 mb-2">
            <svg className="w-8 h-8 text-red-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z" />
            </svg>
          </div>
          <h1 className="text-2xl font-bold text-gray-900">Something went wrong</h1>
          <p className="text-gray-600 text-sm leading-relaxed">
            We hit an unexpected error. Our team has been notified. You can try again or head back to the homepage.
          </p>
          {error.digest && (
            <p className="text-xs text-gray-400 font-mono">Error ID: {error.digest}</p>
          )}
          <div className="flex flex-col sm:flex-row gap-3 justify-center pt-2">
            <button
              onClick={reset}
              className="px-5 py-2.5 bg-blue-600 hover:bg-blue-700 text-white text-sm font-semibold rounded-xl transition-colors"
            >
              Try again
            </button>
            <Link
              href="/"
              className="px-5 py-2.5 bg-white border border-gray-200 hover:border-gray-300 text-gray-700 text-sm font-semibold rounded-xl transition-colors"
            >
              Back to homepage
            </Link>
          </div>
        </div>
      </main>
      <Footer />
    </div>
  );
}
