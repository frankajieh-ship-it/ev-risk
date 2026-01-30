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
        // For returning users with valid session, INITIAL_SESSION is the only event
        // SIGNED_IN only fires on fresh logins via magic link callback
        // So if we have a valid session here, set isReady: true
        setState((prev) => ({
          ...prev,
          session,
          user: session?.user ?? null,
          isAuthenticated: !!session?.user,
          isLoading: false,
          isReady: !!session?.user, // Ready if we have a valid user
        }));
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
