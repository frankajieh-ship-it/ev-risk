"use client";

import { Suspense, useEffect } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import { useEventTracking } from "@/hooks/useEventTracking";

export default function ExtensionPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen bg-gray-50 flex items-center justify-center">
          <div className="text-sm text-gray-400">Loading...</div>
        </div>
      }
    >
      <ExtensionContent />
    </Suspense>
  );
}

function ExtensionContent() {
  const searchParams = useSearchParams();
  const { trackEvent } = useEventTracking();
  const justInstalled = searchParams.get("installed") === "true";

  useEffect(() => {
    trackEvent("extension_install_page_viewed", {
      just_installed: justInstalled,
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div className="min-h-screen bg-gray-50 py-12 px-4">
      <div className="max-w-lg mx-auto">
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-16 h-16 bg-indigo-100 rounded-2xl mb-4">
            <svg
              className="w-8 h-8 text-indigo-600"
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

          {justInstalled ? (
            <>
              <h1 className="text-2xl font-bold text-gray-900 mb-2">
                You&apos;re all set
              </h1>
              <p className="text-sm text-gray-600">
                The OFFO extension is installed. Head to CarGurus to check your
                first EV deal.
              </p>
            </>
          ) : (
            <>
              <h1 className="text-2xl font-bold text-gray-900 mb-2">
                OFFO Chrome Extension
              </h1>
              <p className="text-sm text-gray-600">
                One-click deal check on CarGurus EV listings.
              </p>
            </>
          )}
        </div>

        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6 sm:p-8 mb-6">
          <h2 className="text-sm font-semibold text-gray-900 mb-4">
            How it works
          </h2>
          <ol className="space-y-4">
            <li className="flex gap-3">
              <span className="flex-shrink-0 w-6 h-6 bg-indigo-100 text-indigo-600 rounded-full flex items-center justify-center text-xs font-bold">
                1
              </span>
              <div>
                <p className="text-sm font-medium text-gray-800">
                  Browse CarGurus
                </p>
                <p className="text-xs text-gray-500 mt-0.5">
                  Visit any EV listing on cargurus.com
                </p>
              </div>
            </li>
            <li className="flex gap-3">
              <span className="flex-shrink-0 w-6 h-6 bg-indigo-100 text-indigo-600 rounded-full flex items-center justify-center text-xs font-bold">
                2
              </span>
              <div>
                <p className="text-sm font-medium text-gray-800">
                  See the OFFO badge
                </p>
                <p className="text-xs text-gray-500 mt-0.5">
                  A &quot;Check this deal&quot; badge appears on EV listings
                </p>
              </div>
            </li>
            <li className="flex gap-3">
              <span className="flex-shrink-0 w-6 h-6 bg-indigo-100 text-indigo-600 rounded-full flex items-center justify-center text-xs font-bold">
                3
              </span>
              <div>
                <p className="text-sm font-medium text-gray-800">
                  Get your receipt
                </p>
                <p className="text-xs text-gray-500 mt-0.5">
                  Click the badge for risk flags, fair price, and must-ask
                  questions
                </p>
              </div>
            </li>
          </ol>
        </div>

        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6 sm:p-8 mb-6">
          <h2 className="text-sm font-semibold text-gray-900 mb-3">
            Supported sites
          </h2>
          <div className="flex items-center gap-2">
            <span className="inline-flex items-center px-2.5 py-1 bg-green-50 text-green-700 text-xs font-medium rounded-full">
              CarGurus
            </span>
            <span className="inline-flex items-center px-2.5 py-1 bg-gray-100 text-gray-500 text-xs font-medium rounded-full">
              AutoTrader (coming soon)
            </span>
          </div>
          <p className="text-xs text-gray-400 mt-3">
            Only EV and plug-in hybrid listings are detected.
          </p>
        </div>

        {!justInstalled && (
          <div className="text-center">
            <a
              href="#"
              className="inline-block px-6 py-3 bg-indigo-600 text-white text-sm font-medium rounded-lg hover:bg-indigo-700 transition-colors"
            >
              Add to Chrome
            </a>
            <p className="text-xs text-gray-400 mt-2">
              Free. No account required.
            </p>
          </div>
        )}

        <div className="text-center mt-8">
          <Link
            href="/receipt"
            className="text-sm text-gray-500 hover:text-gray-700 transition-colors"
          >
            &larr; Back to OFFO
          </Link>
        </div>
      </div>
    </div>
  );
}
