import { createContext } from 'react';
import { User } from '@supabase/supabase-js';

export interface UserProfile {
  id: string;
  email: string;
  name: string;
  userType: 'seeker' | 'employer';
  subscription: string;
  [key: string]: any;
}

export interface AuthContextType {
  user: User | null;
  profile: UserProfile | null;
  loading: boolean;
  signIn: (email: string, password: string) => Promise<{ user: User; profile: UserProfile | null }>;
  signUp: (email: string, password: string, name: string, userType: 'seeker' | 'employer') => Promise<void>;
  signOut: () => Promise<void>;
  refreshProfile: () => Promise<void>;
}

const fallbackAuthContext: AuthContextType = {
  user: null,
  profile: null,
  loading: true,
  signIn: async () => {
    throw new Error('AuthProvider not ready. Please retry in a moment.');
  },
  signUp: async () => {
    throw new Error('AuthProvider not ready. Please retry in a moment.');
  },
  signOut: async () => {},
  refreshProfile: async () => {},
};

export const AuthContext = createContext<AuthContextType>(fallbackAuthContext);
AuthContext.displayName = 'AuthContext';
