import React, { useState, useEffect } from 'react';
import { supabase, apiCall, buildAppUrl, isSessionNotFoundError } from '../lib/supabase';
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
      const { data: { user: authUser }, error: authUserError } = await supabase.auth.getUser(accessTokenOverride);
      if (isSessionNotFoundError(authUserError)) {
        await supabase.auth.signOut({ scope: 'local' }).catch(() => {});
        setProfile(null);
        return null;
      }
      const normalizedProfile = normalizeProfile(userProfile, authUser);
      setProfile(normalizedProfile);
      return normalizedProfile;
    } catch (error: any) {
      const msg = String(error?.message || '');
      const isPolicyRecursion = /infinite recursion detected in policy for relation\s+"profiles"|42P17/i.test(msg);
      const isSessionNotFound = isSessionNotFoundError(error) || /session_not_found|session from session_id claim in jwt does not exist/i.test(msg);
      const isExpectedAuthTransition = /Invalid JWT|Not authenticated|401|Missing authorization header|Session expired/.test(msg) || isPolicyRecursion || isSessionNotFound;

      if (isSessionNotFound) {
        await supabase.auth.signOut({ scope: 'local' }).catch(() => {});
        setProfile(null);
        return null;
      }

      if (/Missing authorization header|Invalid JWT/.test(msg) || isPolicyRecursion) {
        const { data: { user: authUser }, error: fallbackAuthUserError } = await supabase.auth.getUser();
        if (isSessionNotFoundError(fallbackAuthUserError)) {
          await supabase.auth.signOut({ scope: 'local' }).catch(() => {});
          setProfile(null);
          return null;
        }
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
      const sessionUser = session?.user ?? null;

      // Block unverified email users from being treated as signed-in.
      // email_confirmed_at is null when Supabase email confirmation is pending.
      // Google OAuth users always have email_confirmed_at set by the provider.
      if (sessionUser && !sessionUser.email_confirmed_at) {
        supabase.auth.signOut(); // triggers SIGNED_OUT which clears state
        setUser(null);
        setProfile(null);
        setLoading(false);
        return;
      }

      setUser(sessionUser);
      if (sessionUser) {
        fetchProfile(session!.access_token).finally(() => setLoading(false));
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

    const isEmailVerified = Boolean(data.user.email_confirmed_at);
    if (!isEmailVerified) {
      await supabase.auth.signOut();
      throw new Error('Please verify your email before signing in. Check your inbox for the verification link.');
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
    const emailRedirectTo = buildAppUrl('/login?verified=1');

    await apiCall('/auth/signup', {
      method: 'POST',
      body: JSON.stringify({ email, password, name, userType, emailRedirectTo }),
    });
  }

  async function signInWithGoogle(returnPath = '/login') {
    const safeReturnPath = returnPath.startsWith('/') ? returnPath : '/login';
    const redirectTo = buildAppUrl(safeReturnPath);

    const { error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: {
        redirectTo,
        queryParams: {
          prompt: 'select_account',
        },
      },
    });

    if (error) throw error;
  }

  async function signUpWithGoogle(returnPath = '/signup') {
    await signInWithGoogle(returnPath);
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
      signInWithGoogle,
      signUpWithGoogle,
      signOut,
      refreshProfile 
    }}>
      {children}
    </AuthContext.Provider>
  );
}
