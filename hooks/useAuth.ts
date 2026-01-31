/**
 * useAuth Hook
 *
 * Manages user authentication state for magic link flow.
 * Provides login, logout, and session management.
 */

import { useState, useEffect, useCallback } from "react";
import {
  sendMagicLink,
  getSession,
  getUser,
  signOut,
  onAuthStateChange,
  isSupabaseAuthConfigured,
  getSupabaseAuthClient,
  type User,
  type Session,
} from "@/lib/supabase-auth";

interface AuthState {
  user: User | null;
  session: Session | null;
  isLoading: boolean;
  isAuthenticated: boolean;
  isConfigured: boolean;
  isReady: boolean; // True when auth is fully validated (after SIGNED_IN)
}

interface UseAuthReturn extends AuthState {
  login: (email: string) => Promise<{ success: boolean; error?: string }>;
  logout: () => Promise<{ success: boolean; error?: string }>;
  refreshSession: () => Promise<void>;
}

export function useAuth(): UseAuthReturn {
  const [state, setState] = useState<AuthState>({
    user: null,
    session: null,
    isLoading: true,
    isAuthenticated: false,
    isConfigured: false,
    isReady: false,
  });

  // Check initial session on mount
  useEffect(() => {
    const configured = isSupabaseAuthConfigured();
    setState((prev) => ({ ...prev, isConfigured: configured }));

    if (!configured) {
      setState((prev) => ({ ...prev, isLoading: false }));
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

      if (event === "SIGNED_IN" || event === "TOKEN_REFRESHED") {
        // Token is fully validated - safe to make API calls
        setState((prev) => ({
          ...prev,
          session,
          user: session?.user ?? null,
          isAuthenticated: !!session?.user,
          isLoading: false,
          isReady: true,
        }));
      } else if (event === "INITIAL_SESSION") {
        // For returning users, INITIAL_SESSION fires with the stored session
        // But after magic link redirect, the token might not be fully validated yet
        // We need to refresh the session to ensure the token is valid before API calls
        if (session?.user) {
          console.log("[useAuth] INITIAL_SESSION with user, refreshing session to validate token...");

          // Set basic state but NOT ready yet
          setState((prev) => ({
            ...prev,
            session,
            user: session?.user ?? null,
            isAuthenticated: true,
            isLoading: false,
            isReady: false, // Wait for refresh to complete
          }));

          // Trigger a session refresh to ensure token is valid on Supabase backend
          const client = getSupabaseAuthClient();
          if (client) {
            client.auth.refreshSession().then(({ data, error }) => {
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
      }));
    }
    return result;
  }, []);

  /**
   * Refresh session manually
   */
  const refreshSession = useCallback(async () => {
    const [session, user] = await Promise.all([getSession(), getUser()]);
    setState((prev) => ({
      ...prev,
      session,
      user,
      isAuthenticated: !!user,
    }));
  }, []);

  return {
    ...state,
    login,
    logout,
    refreshSession,
  };
}
