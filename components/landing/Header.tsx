"use client";

import { useState, useEffect, type ReactNode } from "react";
import Link from "next/link";
import Image from "next/image";
import { History, Menu, X, User, Building, Bookmark } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { totalGarageCount } from "@/lib/anon-garage";
import LoginModal from "@/components/LoginModal";

interface HeaderProps {
  variant?: "receipt" | "homepage" | "compare";
  historyCount?: number;
  onHistoryClick?: () => void;
  regionSelector?: ReactNode;
}

const navLinks = [
  { label: "Analyze a Car",  href: "/receipt",  isScroll: false },
  { label: "EV Routine Fit", href: "/routine",  isScroll: false },
  { label: "Auction Bidder", href: "/copart",   isScroll: false },
  { label: "Compare",        href: "/compare",  isScroll: false },
  { label: "Blog",           href: "/blog",     isScroll: false },
];

export default function Header({ variant = "receipt", historyCount, onHistoryClick, regionSelector }: HeaderProps) {
  const { isAuthenticated, isDealer, logout } = useAuth();
  const [showLogin, setShowLogin] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [garageCount, setGarageCount] = useState(0);

  // Read garage count from localStorage on mount (client-only)
  useEffect(() => {
    setGarageCount(totalGarageCount());
  }, []);

  const handleScrollClick = (e: React.MouseEvent<HTMLAnchorElement>, href: string) => {
    e.preventDefault();
    const el = document.querySelector(href);
    if (el) el.scrollIntoView({ behavior: "smooth" });
    setMobileOpen(false);
  };

  const GarageBadge = () => (
    <Link
      href={isAuthenticated ? "/workspace/garage" : "/shortlist"}
      className="flex items-center gap-1.5 text-sm font-medium text-gray-600 hover:text-gray-900 transition-colors"
    >
      <Bookmark className="w-4 h-4" />
      {isAuthenticated ? "My Garage" : "Garage"}
      {garageCount > 0 && (
        <span className="bg-blue-100 text-blue-700 text-xs px-1.5 py-0.5 rounded-full font-medium">
          {garageCount}
        </span>
      )}
    </Link>
  );

  return (
    <>
      <nav className="sticky top-0 z-50 bg-white/80 backdrop-blur-md border-b border-gray-100">
        <div className="max-w-7xl mx-auto px-4 py-3">
          <div className="flex items-center justify-between">
            <Link href="/" className="flex items-center">
              <Image src="/offo-logo.jpg" alt="OFFO" width={200} height={103} className="w-24 sm:w-28 md:w-36 lg:w-44 h-auto" priority />
            </Link>

            {variant === "homepage" ? (
              <>
                {/* Desktop nav */}
                <div className="hidden md:flex items-center gap-6">
                  {navLinks.map((link) =>
                    link.isScroll ? (
                      <a
                        key={link.label}
                        href={link.href}
                        onClick={(e) => handleScrollClick(e, link.href)}
                        className="text-sm font-medium text-gray-600 hover:text-gray-900 transition-colors"
                      >
                        {link.label}
                      </a>
                    ) : (
                      <Link
                        key={link.label}
                        href={link.href}
                        className="text-sm font-medium text-gray-600 hover:text-gray-900 transition-colors"
                      >
                        {link.label}
                      </Link>
                    )
                  )}

                  <GarageBadge />

                  {isAuthenticated && (
                    <>
                      <Link
                        href="/hub"
                        className="flex items-center gap-1.5 px-3 py-1.5 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 transition-colors"
                      >
                        <User className="w-3.5 h-3.5" />
                        My Garage
                      </Link>
                      {isDealer && (
                        <Link
                          href="/dealer"
                          className="flex items-center gap-1.5 px-3 py-1.5 bg-green-600 text-white rounded-lg text-sm font-medium hover:bg-green-700 transition-colors"
                        >
                          <Building className="w-3.5 h-3.5" />
                          Dealer
                        </Link>
                      )}
                    </>
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
                  <Link
                    href="/dealers"
                    className="text-xs text-gray-400 hover:text-gray-600 transition-colors"
                  >
                    For dealers →
                  </Link>
                </div>

                {/* Mobile hamburger */}
                <button
                  onClick={() => setMobileOpen(!mobileOpen)}
                  className="md:hidden p-2 text-gray-600 hover:text-gray-900 transition-colors"
                  aria-label="Toggle menu"
                >
                  {mobileOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
                </button>
              </>
            ) : (
              /* Receipt variant — existing behavior */
              <div className="flex items-center gap-4">
                {regionSelector}
                {variant !== "compare" && (
                  <span
                    className="text-sm font-medium text-gray-400 cursor-default hidden sm:inline"
                    title="Coming soon"
                  >
                    Deal Watch
                  </span>
                )}
                <GarageBadge />
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
            )}
          </div>
        </div>

        {/* Mobile dropdown — homepage variant only */}
        {variant === "homepage" && mobileOpen && (
          <div className="md:hidden border-t border-gray-100 bg-white/95 backdrop-blur-md">
            <div className="px-4 py-4 space-y-3">
              {navLinks.map((link) =>
                link.isScroll ? (
                  <a
                    key={link.label}
                    href={link.href}
                    onClick={(e) => handleScrollClick(e, link.href)}
                    className="block text-sm font-medium text-gray-700 hover:text-gray-900 py-2"
                  >
                    {link.label}
                  </a>
                ) : (
                  <Link
                    key={link.label}
                    href={link.href}
                    onClick={() => setMobileOpen(false)}
                    className="block text-sm font-medium text-gray-700 hover:text-gray-900 py-2"
                  >
                    {link.label}
                  </Link>
                )
              )}

              <Link
                href={isAuthenticated ? "/workspace/garage" : "/shortlist"}
                onClick={() => setMobileOpen(false)}
                className="flex items-center gap-1.5 text-sm font-medium text-gray-700 hover:text-gray-900 py-2"
              >
                <Bookmark className="w-4 h-4" />
                {isAuthenticated ? "My Garage" : "Garage"}
                {garageCount > 0 && (
                  <span className="bg-blue-100 text-blue-700 text-xs px-1.5 py-0.5 rounded-full">
                    {garageCount}
                  </span>
                )}
              </Link>

              <div className="border-t border-gray-100 pt-3">
                {isAuthenticated && (
                  <div className="flex flex-col gap-2 mb-3">
                    <Link
                      href="/hub"
                      onClick={() => setMobileOpen(false)}
                      className="flex items-center gap-1.5 px-3 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium"
                    >
                      <User className="w-3.5 h-3.5" />
                      My Garage
                    </Link>
                    {isDealer && (
                      <Link
                        href="/dealer"
                        onClick={() => setMobileOpen(false)}
                        className="flex items-center gap-1.5 px-3 py-2 bg-green-600 text-white rounded-lg text-sm font-medium"
                      >
                        <Building className="w-3.5 h-3.5" />
                        Dealer
                      </Link>
                    )}
                  </div>
                )}

                {isAuthenticated ? (
                  <button
                    onClick={() => { logout(); setMobileOpen(false); }}
                    className="text-sm font-medium text-gray-500 hover:text-gray-700 py-2"
                  >
                    Sign out
                  </button>
                ) : (
                  <button
                    onClick={() => { setShowLogin(true); setMobileOpen(false); }}
                    className="text-sm font-medium text-blue-600 hover:text-blue-700 py-2"
                  >
                    Sign in
                  </button>
                )}
                <Link
                  href="/dealers"
                  onClick={() => setMobileOpen(false)}
                  className="block text-xs text-gray-400 hover:text-gray-600 py-1"
                >
                  For dealers →
                </Link>
              </div>
            </div>
          </div>
        )}
      </nav>
      <LoginModal isOpen={showLogin} onClose={() => setShowLogin(false)} context="sync" />
    </>
  );
}
