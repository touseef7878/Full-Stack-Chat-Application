import React, { createContext, useContext, useEffect, useState, useCallback } from 'react';
import { Session, SupabaseClient } from '@supabase/supabase-js';
import { supabase } from '@/lib/supabase'; // Import your Supabase client

interface SessionContextType {
  session: Session | null;
  supabase: SupabaseClient;
  signOut: () => Promise<void>;
  isGuest: boolean;
  loginAsGuest: () => Promise<void>;
}

const SessionContext = createContext<SessionContextType | undefined>(undefined);

export const useSession = () => {
  const context = useContext(SessionContext);
  if (context === undefined) {
    throw new Error('useSession must be used within a SessionContextProvider');
  }
  return context;
};

interface SessionContextProviderProps {
  children: React.ReactNode;
}

const SessionContextProvider: React.FC<SessionContextProviderProps> = ({ children }) => {
  const [session, setSession] = useState<Session | null>(null);
  const [isGuest, setIsGuest] = useState<boolean>(false);
  const [loading, setLoading] = useState(true);

  // Add signOut function
  const signOut = useCallback(async () => {
    const { error } = await supabase.auth.signOut();
    if (error) {
      console.error('Error signing out:', error.message);
    }
    setIsGuest(false);
    localStorage.removeItem('guestSession');
  }, []);

  // Add loginAsGuest function
  const loginAsGuest = useCallback(async () => {
    // Create a guest session with a temporary user ID
    const guestSession: Session = {
      user: {
        id: 'guest-' + Math.random().toString(36).substr(2, 9),
        email: null,
        user_metadata: {
          username: 'Guest User',
          first_name: 'Guest',
          last_name: 'User',
          avatar_url: null,
        },
        app_metadata: {},
        created_at: new Date().toISOString(),
      },
      expires_at: null,
      expires_in: null,
      access_token: 'guest-token',
      refresh_token: 'guest-refresh-token',
      token_type: 'bearer',
    };
    
    setSession(guestSession);
    setIsGuest(true);
    localStorage.setItem('guestSession', JSON.stringify(guestSession));
  }, []);

  useEffect(() => {
    // Check for existing guest session in localStorage
    const storedGuestSession = localStorage.getItem('guestSession');
    if (storedGuestSession) {
      try {
        const parsedSession = JSON.parse(storedGuestSession);
        setSession(parsedSession);
        setIsGuest(true);
        setLoading(false);
        return;
      } catch (e) {
        console.error('Error parsing guest session from localStorage:', e);
        localStorage.removeItem('guestSession');
      }
    }

    // Get initial session
    supabase.auth.getSession().then(({ data: { session } }) => {
      // Only set session if it's not a guest session (from localStorage)
      if (!session) {
        setSession(null);
        setIsGuest(false);
      } else {
        // If there's an actual session from Supabase, it means user is logged in normally
        setSession(session);
        setIsGuest(false);
      }
      setLoading(false);
    });

    // Listen for auth state changes
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      // If there's a guest session in localStorage, don't override it with null on logout
      const storedGuestSession = localStorage.getItem('guestSession');
      if (storedGuestSession && _event === 'SIGNED_OUT') {
        try {
          const parsedSession = JSON.parse(storedGuestSession);
          setSession(parsedSession);
          setIsGuest(true);
        } catch (e) {
          setSession(session);
          setIsGuest(false);
        }
      } else {
        setSession(session);
        setIsGuest(false);
      }
    });

    return () => {
      subscription.unsubscribe();
    };
  }, []);

  if (loading) {
    return <div className="flex items-center justify-center min-h-screen">Loading authentication...</div>;
  }

  return (
    <SessionContext.Provider value={{ session, supabase, signOut, isGuest, loginAsGuest }}>
      {children}
    </SessionContext.Provider>
  );
};

export default SessionContextProvider;