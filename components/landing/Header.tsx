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

// Main site nav (homepage, blog, methodology, etc.)
const homepageNavLinks = [
  { label: "Browse Vehicles", href: "/vehicles/browse" },
  { label: "Pricing",         href: "/pricing" },
  { label: "Blog",            href: "/blog" },
  { label: "For Dealers",     href: "/dealers" },
];

// Tool-focused nav (copart, receipt, auction pages)
const toolNavLinks = [
  { label: "Receipt Check",      href: "/receipt" },
  { label: "Routine Fit",        href: "/routine" },
  { label: "Copart Arbitrage",   href: "/copart" },
  { label: "For Dealers",        href: "/dealers" },
];

const navLinkCls = "text-[0.8125rem] font-medium tracking-[-0.01em] text-white/50 hover:text-white/90 transition-colors";

export default function Header({ variant = "receipt", historyCount, onHistoryClick, regionSelector }: HeaderProps) {
  const { isAuthenticated, isDealer, logout } = useAuth();
  const [showLogin, setShowLogin] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [garageCount, setGarageCount] = useState(0);

  useEffect(() => {
    setGarageCount(totalGarageCount()); // eslint-disable-line react-hooks/set-state-in-effect
  }, []);

  const isHomepageVariant = variant === "homepage";
  const navLinks = isHomepageVariant ? homepageNavLinks : toolNavLinks;

  const GarageBadge = () => (
    <Link
      href={isAuthenticated ? "/workspace/garage" : "/shortlist"}
      className="flex items-center gap-1.5 text-sm font-medium text-white/50 hover:text-white/90 transition-colors"
    >
      <Bookmark className="w-4 h-4" />
      {isAuthenticated ? "My Garage" : "Garage"}
      {garageCount > 0 && (
        <span className="bg-[#00d97e]/20 text-[#00d97e] text-xs px-1.5 py-0.5 rounded-full font-medium">
          {garageCount}
        </span>
      )}
    </Link>
  );

  return (
    <>
      <nav className="sticky top-0 z-50 bg-[#0d1117]/90 backdrop-blur-md border-b border-white/[0.08]">
        <div className="max-w-7xl mx-auto px-4 py-2.5">
          <div className="flex items-center justify-between">
            <Link href="/" className="flex items-center">
              <Image src="/offo-logo.jpg" alt="OFFO" width={200} height={103} className="w-24 sm:w-28 md:w-36 lg:w-44 h-auto" priority />
            </Link>

            {/* Desktop nav — shown for both variants but with different link sets */}
            <div className="hidden md:flex items-center gap-5">
              {navLinks.map((link) => (
                <Link key={link.label} href={link.href} className={navLinkCls}>
                  {link.label}
                </Link>
              ))}

              {/* Receipt variant extras */}
              {!isHomepageVariant && (
                <>
                  {regionSelector}
                  {variant !== "compare" && (
                    <Link href="/deals" className={`${navLinkCls} hidden sm:inline`}>
                      Deal Watch
                    </Link>
                  )}
                  {onHistoryClick && (
                    <button
                      onClick={onHistoryClick}
                      className="flex items-center gap-1.5 text-sm text-white/50 hover:text-white/80 transition-colors"
                    >
                      <History className="w-4 h-4" />
                      History
                      {(historyCount ?? 0) > 0 && (
                        <span className="bg-white/[0.10] text-white/60 text-xs px-1.5 py-0.5 rounded-full">
                          {historyCount}
                        </span>
                      )}
                    </button>
                  )}
                </>
              )}

              {/* eslint-disable-next-line react-hooks/static-components */}
              <GarageBadge />

              {isAuthenticated && (
                <>
                  <Link
                    href="/workspace"
                    className="flex items-center gap-1.5 px-3 py-1.5 bg-[#00d97e]/15 border border-[#00d97e]/25 text-[#00d97e] rounded-lg text-sm font-medium hover:bg-[#00d97e]/25 transition-colors"
                  >
                    <User className="w-3.5 h-3.5" />
                    My Workspace
                  </Link>
                  {isDealer && (
                    <Link
                      href="/dealer"
                      className="flex items-center gap-1.5 px-3 py-1.5 bg-white/[0.06] border border-white/[0.10] text-white/70 rounded-lg text-sm font-medium hover:bg-white/[0.10] transition-colors"
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
                  className="text-sm font-medium text-white/40 hover:text-white/70 transition-colors"
                >
                  Sign out
                </button>
              ) : (
                <button
                  onClick={() => setShowLogin(true)}
                  className="text-sm font-medium text-[#00d97e] hover:text-[#00c970] transition-colors"
                >
                  Sign in
                </button>
              )}
            </div>

            {/* Mobile hamburger */}
            <button
              onClick={() => setMobileOpen(!mobileOpen)}
              className="md:hidden p-2 text-white/50 hover:text-white/90 transition-colors"
              aria-label="Toggle menu"
            >
              {mobileOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
            </button>
          </div>
        </div>

        {/* Mobile dropdown */}
        {mobileOpen && (
          <div className="md:hidden border-t border-white/[0.08] bg-[#0d1117]/95 backdrop-blur-md">
            <div className="px-4 py-4 space-y-1">
              {navLinks.map((link) => (
                <Link
                  key={link.label}
                  href={link.href}
                  onClick={() => setMobileOpen(false)}
                  className="block text-sm font-medium text-white/60 hover:text-white/90 py-2.5 border-b border-white/[0.05] last:border-0"
                >
                  {link.label}
                </Link>
              ))}

              <div className="pt-2">
                <Link
                  href={isAuthenticated ? "/workspace/garage" : "/shortlist"}
                  onClick={() => setMobileOpen(false)}
                  className="flex items-center gap-1.5 text-sm font-medium text-white/60 hover:text-white/90 py-2.5"
                >
                  <Bookmark className="w-4 h-4" />
                  {isAuthenticated ? "My Garage" : "Garage"}
                  {garageCount > 0 && (
                    <span className="bg-[#00d97e]/20 text-[#00d97e] text-xs px-1.5 py-0.5 rounded-full">
                      {garageCount}
                    </span>
                  )}
                </Link>
              </div>

              <div className="border-t border-white/[0.08] pt-3 space-y-2">
                {isAuthenticated && (
                  <>
                    <Link
                      href="/workspace"
                      onClick={() => setMobileOpen(false)}
                      className="flex items-center gap-1.5 px-3 py-2 bg-[#00d97e]/15 border border-[#00d97e]/25 text-[#00d97e] rounded-lg text-sm font-medium"
                    >
                      <User className="w-3.5 h-3.5" />
                      My Workspace
                    </Link>
                    {isDealer && (
                      <Link
                        href="/dealer"
                        onClick={() => setMobileOpen(false)}
                        className="flex items-center gap-1.5 px-3 py-2 bg-white/[0.06] border border-white/[0.10] text-white/70 rounded-lg text-sm font-medium"
                      >
                        <Building className="w-3.5 h-3.5" />
                        Dealer
                      </Link>
                    )}
                  </>
                )}

                {isAuthenticated ? (
                  <button
                    onClick={() => { logout(); setMobileOpen(false); }}
                    className="block text-sm font-medium text-white/40 hover:text-white/70 py-2"
                  >
                    Sign out
                  </button>
                ) : (
                  <button
                    onClick={() => { setShowLogin(true); setMobileOpen(false); }}
                    className="block text-sm font-medium text-[#00d97e] hover:text-[#00c970] py-2"
                  >
                    Sign in
                  </button>
                )}
              </div>
            </div>
          </div>
        )}
      </nav>
      <LoginModal isOpen={showLogin} onClose={() => setShowLogin(false)} context="sync" />
    </>
  );
}
