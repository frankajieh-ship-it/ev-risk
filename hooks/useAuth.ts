/**
 * useAuth Hook
 *
 * Manages user authentication state for magic link flow.
 * Provides login, logout, and session management.
 */

import { useState, useEffect, useCallback, useRef } from "react";
import {
  sendMagicLink,
  getSession,
  getUser,
  signOut,
  onAuthStateChange,
  isSupabaseAuthConfigured,
  getSupabaseAuthClient,
  getUserRole,
  getUserDealerId,
  type User,
  type Session,
  type UserRole,
} from "@/lib/supabase-auth";

interface AuthState {
  user: User | null;
  session: Session | null;
  isLoading: boolean;
  isAuthenticated: boolean;
  isConfigured: boolean;
  isReady: boolean; // True when auth is fully validated (after SIGNED_IN)
  role: UserRole | null;
  dealerId: string | null;
}

interface UseAuthReturn extends AuthState {
  login: (email: string) => Promise<{ success: boolean; error?: string }>;
  logout: () => Promise<{ success: boolean; error?: string }>;
  refreshSession: () => Promise<void>;
  isDealer: boolean;
  isDealerAdmin: boolean;
}

export function useAuth(): UseAuthReturn {
  const configured = isSupabaseAuthConfigured();

  const [state, setState] = useState<AuthState>({
    user: null,
    session: null,
    isLoading: configured,
    isAuthenticated: false,
    isConfigured: configured,
    isReady: false,
    role: null,
    dealerId: null,
  });

  // Track when we're actively refreshing to avoid race conditions
  const isRefreshingRef = useRef(false);

  // Check initial session on mount
  useEffect(() => {
    if (!configured) {
      return;
    }

    const initSession = async () => {
      try {
        const [session, user] = await Promise.all([getSession(), getUser()]);
        setState({
          user,
          session,
          isLoading: false,
          isAuthenticated: !!user,
          isConfigured: true,
          isReady: false, // Don't set ready here - wait for SIGNED_IN event
          role: getUserRole(user),
          dealerId: getUserDealerId(user),
        });
      } catch (error) {
        console.error("Auth init error:", error);
        setState((prev) => ({ ...prev, isLoading: false }));
      }
    };

    initSession();

    // Subscribe to auth changes
    const unsubscribe = onAuthStateChange((event, session) => {
      console.log("[useAuth] Auth event:", event, session ? "with session" : "no session");

      if (event === "SIGNED_IN") {
        // Fresh login - token is fully validated
        const u = session?.user ?? null;
        setState((prev) => ({
          ...prev,
          session,
          user: u,
          isAuthenticated: !!u,
          isLoading: false,
          isReady: true,
          role: getUserRole(u),
          dealerId: getUserDealerId(u),
        }));
      } else if (event === "TOKEN_REFRESHED") {
        // Only set ready if we're NOT in the middle of our own refresh
        // (our refresh promise will handle setting isReady)
        if (!isRefreshingRef.current) {
          console.log("[useAuth] TOKEN_REFRESHED (not from our refresh), setting ready");
          const trUser = session?.user ?? null;
          setState((prev) => ({
            ...prev,
            session,
            user: trUser,
            isAuthenticated: !!trUser,
            isLoading: false,
            isReady: true,
            role: getUserRole(trUser),
            dealerId: getUserDealerId(trUser),
          }));
        } else {
          console.log("[useAuth] TOKEN_REFRESHED (during our refresh), ignoring - will wait for promise");
        }
      } else if (event === "INITIAL_SESSION") {
        // For returning users, INITIAL_SESSION fires with the stored session
        // But after magic link redirect, the token might not be fully validated yet
        // We need to refresh the session to ensure the token is valid before API calls
        if (session?.user) {
          console.log("[useAuth] INITIAL_SESSION with user, refreshing session to validate token...");

          // Set basic state but NOT ready yet
          const isUser = session?.user ?? null;
          setState((prev) => ({
            ...prev,
            session,
            user: isUser,
            isAuthenticated: true,
            isLoading: false,
            isReady: false, // Wait for refresh to complete
            role: getUserRole(isUser),
            dealerId: getUserDealerId(isUser),
          }));

          // Trigger a session refresh to ensure token is valid on Supabase backend
          const client = getSupabaseAuthClient();
          if (client) {
            isRefreshingRef.current = true;
            client.auth.refreshSession().then(({ data, error }) => {
              isRefreshingRef.current = false;
              if (error) {
                console.error("[useAuth] Session refresh failed:", error);
                // Still set ready since we have a session, API might work
                setState((prev) => ({
                  ...prev,
                  isReady: true,
                }));
              } else if (data?.session) {
                const refreshedSession = data.session;
                console.log("[useAuth] Session refreshed successfully, token validated");
                setState((prev) => ({
                  ...prev,
                  session: refreshedSession,
                  user: refreshedSession.user,
                  isAuthenticated: true,
                  isLoading: false,
                  isReady: true,
                  role: getUserRole(refreshedSession.user),
                  dealerId: getUserDealerId(refreshedSession.user),
                }));
              } else {
                // No session after refresh - user needs to re-authenticate
                console.log("[useAuth] No session after refresh");
                setState((prev) => ({
                  ...prev,
                  session: null,
                  user: null,
                  isAuthenticated: false,
                  isReady: true,
                }));
              }
            }).catch((networkErr) => {
              // Supabase unreachable (NXDOMAIN, timeout, 503) — degrade gracefully
              // instead of letting the unhandled rejection crash the page
              isRefreshingRef.current = false;
              console.error("[useAuth] Session refresh network error:", networkErr);
              setState((prev) => ({ ...prev, isReady: true }));
            });
          } else {
            // No client available, set ready anyway
            setState((prev) => ({
              ...prev,
              isReady: true,
            }));
          }
        } else {
          // No user in session, just update state
          setState((prev) => ({
            ...prev,
            session,
            user: null,
            isAuthenticated: false,
            isLoading: false,
            isReady: true,
          }));
        }
      } else if (event === "SIGNED_OUT") {
        setState((prev) => ({
          ...prev,
          session: null,
          user: null,
          isAuthenticated: false,
          isReady: false,
          role: null,
          dealerId: null,
        }));
      }
    });

    return () => {
      unsubscribe?.();
    };
  }, []);

  /**
   * Send magic link to email
   */
  const login = useCallback(async (email: string) => {
    return sendMagicLink(email);
  }, []);

  /**
   * Sign out
   */
  const logout = useCallback(async () => {
    const result = await signOut();
    if (result.success) {
      setState((prev) => ({
        ...prev,
        user: null,
        session: null,
        isAuthenticated: false,
        isReady: false,
        role: null,
        dealerId: null,
      }));
    }
    return result;
  }, []);

  /**
   * Refresh session manually
   */
  const refreshSession = useCallback(async () => {
    try {
      const [session, user] = await Promise.all([getSession(), getUser()]);
      setState((prev) => ({
        ...prev,
        session,
        user,
        isAuthenticated: !!user,
        role: getUserRole(user),
        dealerId: getUserDealerId(user),
      }));
    } catch (err) {
      console.error("[useAuth] refreshSession error:", err);
    }
  }, []);

  const isDealer = state.role === "dealer_admin" || state.role === "dealer_user";
  const isDealerAdmin = state.role === "dealer_admin";

  return {
    ...state,
    login,
    logout,
    refreshSession,
    isDealer,
    isDealerAdmin,
  };
}
