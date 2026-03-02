"use client";

import { useState, type ReactNode } from "react";
import Link from "next/link";
import { History } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import LoginModal from "@/components/LoginModal";

interface HeaderProps {
  historyCount?: number;
  onHistoryClick?: () => void;
  regionSelector?: ReactNode;
}

export default function Header({ historyCount, onHistoryClick, regionSelector }: HeaderProps) {
  const { isAuthenticated, logout } = useAuth();
  const [showLogin, setShowLogin] = useState(false);

  return (
    <>
      <nav className="sticky top-0 z-50 bg-white/80 backdrop-blur-md border-b border-gray-100">
        <div className="max-w-7xl mx-auto px-4 py-3">
          <div className="flex items-center justify-between">
            <Link href="/" className="text-2xl font-bold bg-gradient-to-r from-blue-600 to-green-600 bg-clip-text text-transparent">
              OFFO
            </Link>

            <div className="flex items-center gap-4">
              {regionSelector}
              <span
                className="text-sm font-medium text-gray-400 cursor-default hidden sm:inline"
                title="Coming soon"
              >
                Deal Watch
              </span>
              {onHistoryClick && (
                <button
                  onClick={onHistoryClick}
                  className="flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-700 transition-colors"
                >
                  <History className="w-4 h-4" />
                  History
                  {(historyCount ?? 0) > 0 && (
                    <span className="bg-gray-200 text-gray-600 text-xs px-1.5 py-0.5 rounded-full">
                      {historyCount}
                    </span>
                  )}
                </button>
              )}
              {isAuthenticated ? (
                <button
                  onClick={() => logout()}
                  className="text-sm font-medium text-gray-500 hover:text-gray-700 transition-colors"
                >
                  Sign out
                </button>
              ) : (
                <button
                  onClick={() => setShowLogin(true)}
                  className="text-sm font-medium text-blue-600 hover:text-blue-700 transition-colors"
                >
                  Sign in
                </button>
              )}
            </div>
          </div>
        </div>
      </nav>
      <LoginModal isOpen={showLogin} onClose={() => setShowLogin(false)} />
    </>
  );
}
