import React, { useState, useEffect } from 'react';
import { supabase, apiCall } from '../lib/supabase';
import { User } from '@supabase/supabase-js';
import { AuthContext, UserProfile } from './auth-context';

function isProfilesPolicyRecursionError(error: unknown) {
  if (!error || typeof error !== 'object') return false;
  const maybeError = error as { code?: string; message?: string };
  const code = String(maybeError.code || '').toUpperCase();
  const message = String(maybeError.message || '');
  return code === '42P17' || /infinite recursion detected in policy for relation\s+"profiles"/i.test(message);
}

function normalizeEmployerStatus(rawStatus: unknown, userType: unknown) {
  if (String(userType || '') !== 'employer') return null;
  const normalized = String(rawStatus || '').trim().toLowerCase();
  if (['pending_review', 'needs_info', 'approved', 'rejected', 'suspended'].includes(normalized)) {
    return normalized as 'pending_review' | 'needs_info' | 'approved' | 'rejected' | 'suspended';
  }
  return 'pending_review';
}

function resolveUserType(profileLike: Record<string, any> | null | undefined, authUser?: User | null) {
  return (profileLike?.userType ?? profileLike?.user_type ?? authUser?.user_metadata?.userType ?? 'seeker') as UserProfile['userType'];
}

function normalizeProfile(profileLike: Record<string, any>, authUser?: User | null) {
  const userType = resolveUserType(profileLike, authUser);
  return {
    ...profileLike,
    userType,
    user_type: profileLike.user_type ?? userType,
    employer_status: normalizeEmployerStatus(profileLike.employer_status, userType),
  } as UserProfile;
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);

  async function fetchProfile(accessTokenOverride?: string) {
    try {
      const { profile: userProfile } = await apiCall('/auth/profile', {
        requireAuth: true,
        accessTokenOverride,
      });
      const { data: { user: authUser } } = await supabase.auth.getUser(accessTokenOverride);
      const normalizedProfile = normalizeProfile(userProfile, authUser);
      setProfile(normalizedProfile);
      return normalizedProfile;
    } catch (error: any) {
      const msg = String(error?.message || '');
      const isPolicyRecursion = /infinite recursion detected in policy for relation\s+"profiles"|42P17/i.test(msg);
      const isExpectedAuthTransition = /Invalid JWT|Not authenticated|401|Missing authorization header/.test(msg) || isPolicyRecursion;

      if (/Missing authorization header|Invalid JWT/.test(msg) || isPolicyRecursion) {
        const { data: { user: authUser } } = await supabase.auth.getUser();
        if (authUser) {
          let profileRow: any = null;

          if (!isPolicyRecursion) {
            const { data, error: profileError } = await supabase
              .from('profiles')
              .select('*')
              .eq('id', authUser.id)
              .maybeSingle();

            if (!isProfilesPolicyRecursionError(profileError)) {
              profileRow = data;
            }
          }

          const normalized = profileRow
            ? normalizeProfile(profileRow, authUser)
            : {
                id: authUser.id,
                email: authUser.email || '',
                name: authUser.user_metadata?.name || authUser.email?.split('@')[0] || 'User',
                userType: (authUser.user_metadata?.userType || 'seeker') as 'seeker' | 'employer' | 'admin',
                user_type: (authUser.user_metadata?.userType || 'seeker') as 'seeker' | 'employer' | 'admin',
                employer_status: normalizeEmployerStatus(null, authUser.user_metadata?.userType || 'seeker'),
                subscription: authUser.user_metadata?.userType === 'employer' ? 'starter' : 'free',
              };

          setProfile(normalized as UserProfile);
          return normalized as UserProfile;
        }
      }

      if (!isExpectedAuthTransition) {
        console.error('Error fetching profile:', error);
      }

      // Do NOT sign out here — transient JWT errors (especially right after login)
      // must not trigger a hard logout. Trust onAuthStateChange as the authoritative
      // source of session validity; it will fire SIGNED_OUT if the session truly ends.

      setProfile(null);
      return null;
    }
  }

  useEffect(() => {
    // onAuthStateChange fires INITIAL_SESSION on attach, which covers the
    // initial session check. Using a separate getSession() call creates a
    // race condition where a stale empty-session response can arrive after
    // signIn and overwrite the signed-in user with null.
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null);
      if (session?.user) {
        fetchProfile(session.access_token).finally(() => setLoading(false));
      } else {
        setProfile(null);
        setLoading(false);
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
    if (!data.user) {
      throw new Error('Sign in failed: missing user session');
    }

    // onAuthStateChange fires SIGNED_IN and handles setUser + fetchProfile.
    // We still need profile data here for Login.tsx to decide which dashboard
    // to navigate to, so read it directly without duplicating state updates.
    const token = data.session?.access_token;
    let resolvedProfile: UserProfile | null = null;
    let profileRow: any = null;

    try {
      const { profile: apiProfile } = await apiCall('/auth/profile', {
        requireAuth: true,
        accessTokenOverride: token,
      });
      profileRow = apiProfile;
    } catch (apiProfileError: any) {
      const { data: profileData, error: profileError } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', data.user.id)
        .maybeSingle();

      if (profileError && !isProfilesPolicyRecursionError(profileError)) {
        throw profileError;
      }

      if (!isProfilesPolicyRecursionError(apiProfileError)) {
        console.warn('Falling back to direct profile lookup after auth/profile bootstrap failed:', apiProfileError);
      }

      profileRow = profileData;
    }

    if (profileRow) {
      resolvedProfile = normalizeProfile(profileRow, data.user);
    } else {
      resolvedProfile = {
        id: data.user.id,
        email: data.user.email || '',
        name: data.user.user_metadata?.name || data.user.email?.split('@')[0] || 'User',
        userType: (data.user.user_metadata?.userType || 'seeker') as 'seeker' | 'employer' | 'admin',
        user_type: (data.user.user_metadata?.userType || 'seeker') as 'seeker' | 'employer' | 'admin',
        employer_status: normalizeEmployerStatus(null, data.user.user_metadata?.userType || 'seeker'),
        subscription: data.user.user_metadata?.userType === 'employer' ? 'starter' : 'free',
      } as UserProfile;
    }

    void token; // token used by onAuthStateChange
    return { user: data.user, profile: resolvedProfile };
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
