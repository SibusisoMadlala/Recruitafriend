import React, { createContext, useContext, useState, useEffect } from 'react';
import { supabase, apiCall } from '../lib/supabase';
import { User } from '@supabase/supabase-js';

interface UserProfile {
  id: string;
  email: string;
  name: string;
  userType: 'seeker' | 'employer';
  subscription: string;
  [key: string]: any;
}

interface AuthContextType {
  user: User | null;
  profile: UserProfile | null;
  loading: boolean;
  signIn: (email: string, password: string) => Promise<void>;
  signUp: (email: string, password: string, name: string, userType: 'seeker' | 'employer') => Promise<void>;
  signOut: () => Promise<void>;
  refreshProfile: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);

  async function fetchProfile() {
    try {
      const { profile: userProfile } = await apiCall('/auth/profile');
      setProfile(userProfile);
    } catch (error) {
      console.error('Error fetching profile:', error);
      setProfile(null);
    }
  }

  useEffect(() => {
    // Check active session
    supabase.auth.getSession().then(({ data: { session } }) => {
      setUser(session?.user ?? null);
      if (session?.user) {
        fetchProfile();
      }
      setLoading(false);
    });

    // Listen for auth changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null);
      if (session?.user) {
        fetchProfile();
      } else {
        setProfile(null);
      }
    });

    return () => subscription.unsubscribe();
  }, []);

  async function signIn(email: string, password: string) {
    const { data, error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });
    
    if (error) throw error;
    setUser(data.user);
    await fetchProfile();
  }

  async function signUp(email: string, password: string, name: string, userType: 'seeker' | 'employer') {
    // Create user via backend
    await apiCall('/auth/signup', {
      method: 'POST',
      body: JSON.stringify({ email, password, name, userType }),
    });
    
    // Sign in the new user
    await signIn(email, password);
  }

  async function signOut() {
    await supabase.auth.signOut();
    setUser(null);
    setProfile(null);
  }

  async function refreshProfile() {
    await fetchProfile();
  }

  return (
    <AuthContext.Provider value={{ 
      user, 
      profile, 
      loading, 
      signIn, 
      signUp, 
      signOut,
      refreshProfile 
    }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
