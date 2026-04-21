import { createClient } from '@supabase/supabase-js';
import { projectId, publicAnonKey } from '/utils/supabase/info';
import { requestTalentSearchFromService } from '../services/talentSearchService';

const supabaseUrl = `https://${projectId}.supabase.co`;

type SupabaseClientInstance = ReturnType<typeof createClient>;

const globalSupabase = globalThis as typeof globalThis & {
  __recruitfriendSupabase__?: SupabaseClientInstance;
};

export const supabase =
  globalSupabase.__recruitfriendSupabase__ ??
  createClient(supabaseUrl, publicAnonKey);

if (!globalSupabase.__recruitfriendSupabase__) {
  globalSupabase.__recruitfriendSupabase__ = supabase;
}

function normalizeAppOrigin(candidate: string) {
  const trimmed = String(candidate || '').trim();
  if (!trimmed) return '';

  try {
    const url = new URL(trimmed);
    url.pathname = '/';
    url.search = '';
    url.hash = '';
    return url.toString().replace(/\/$/, '');
  } catch {
    return '';
  }
}

export function getAppOrigin() {
  const configuredOrigin = normalizeAppOrigin(import.meta.env.VITE_PUBLIC_APP_URL || '');
  if (configuredOrigin) {
    return configuredOrigin;
  }

  if (typeof window !== 'undefined') {
    return normalizeAppOrigin(window.location.origin);
  }

  return '';
}

export function buildAppUrl(path = '/') {
  const baseOrigin = getAppOrigin();
  const normalizedPath = path.startsWith('/') ? path : `/${path}`;

  if (!baseOrigin) {
    return normalizedPath;
  }

  return new URL(normalizedPath, `${baseOrigin}/`).toString();
}

export const serverUrl = `${supabaseUrl}/functions/v1/make-server-bca21fd3`;

type ApiCallOptions = RequestInit & {
  requireAuth?: boolean;
  accessTokenOverride?: string;
  bypassInterceptors?: boolean;
};

const EMPLOYER_STATUS_VALUES = ['pending_review', 'needs_info', 'approved', 'rejected', 'suspended'] as const;

function resolveUserTypeFromProfile(profileLike: Record<string, unknown> | null | undefined, fallback?: unknown) {
  return String(profileLike?.userType || profileLike?.user_type || fallback || 'seeker').trim().toLowerCase() as 'seeker' | 'employer' | 'admin';
}

function buildFallbackProfile(effectiveUser: NonNullable<Awaited<ReturnType<typeof supabase.auth.getUser>>['data']['user']>) {
  const userType = resolveUserTypeFromProfile(null, effectiveUser.user_metadata?.userType);
  return {
    id: effectiveUser.id,
    email: effectiveUser.email || '',
    name: effectiveUser.user_metadata?.name || effectiveUser.email?.split('@')[0] || 'User',
    user_type: userType,
    userType: userType,
    employer_status: userType === 'employer' ? 'pending_review' : null,
    subscription: userType === 'employer' ? 'starter' : 'free',
    updated_at: new Date().toISOString(),
  };
}

function normalizeEmployerStatus(rawStatus: unknown) {
  const normalized = String(rawStatus || '').trim().toLowerCase();
  if ((EMPLOYER_STATUS_VALUES as readonly string[]).includes(normalized)) {
    return normalized as (typeof EMPLOYER_STATUS_VALUES)[number];
  }
  return 'pending_review';
}

function buildEmployerDeniedMessage(status: ReturnType<typeof normalizeEmployerStatus>) {
  if (status === 'needs_info') return 'Your onboarding requires additional information before access can be granted.';
  if (status === 'rejected') return 'Your onboarding submission was rejected. Please review guidance and resubmit.';
  if (status === 'suspended') return 'Your employer account is currently suspended.';
  return 'Your onboarding is pending review.';
}

async function assertApprovedEmployer(userId: string) {
  const { data: profile, error } = await supabase
    .from('profiles')
    .select('user_type, employer_status')
    .eq('id', userId)
    .maybeSingle();

  if (error) throw new Error(error.message);
  if (!profile || profile.user_type !== 'employer') {
    throw new Error('Not authorized');
  }

  const status = normalizeEmployerStatus(profile.employer_status);
  if (status !== 'approved') {
    throw new Error(buildEmployerDeniedMessage(status));
  }
}

async function assertEmployer(userId: string) {
  const { data: profile, error } = await supabase
    .from('profiles')
    .select('user_type')
    .eq('id', userId)
    .maybeSingle();

  if (error) throw new Error(error.message);
  if (!profile || profile.user_type !== 'employer') {
    throw new Error('Forbidden');
  }
}

async function assertAdmin(userId: string) {
  const { data: profile, error } = await supabase
    .from('profiles')
    .select('user_type')
    .eq('id', userId)
    .maybeSingle();

  if (error) throw new Error(error.message);
  if (!profile || profile.user_type !== 'admin') {
    throw new Error('Forbidden');
  }
}

function isProfilesPolicyRecursionError(error: { message?: string | null; code?: string | null } | null | undefined) {
  if (!error) return false;
  const code = String(error.code || '').toUpperCase();
  const message = String(error.message || '');
  return code === '42P17' || /infinite recursion detected in policy for relation\s+"profiles"/i.test(message);
}

function getEndpointPath(endpoint: string) {
  return endpoint.split('?')[0] || endpoint;
}

function isPublicEndpoint(endpoint: string, method: string) {
  const normalizedMethod = method.toUpperCase();
  const path = getEndpointPath(endpoint);

  // Registration does not require a user session — allow it through without a JWT.
  if (normalizedMethod === 'POST' && path === '/auth/signup') return true;
  if (normalizedMethod === 'POST' && path === '/auth/recover-password') return true;

  if (normalizedMethod !== 'GET') return false;

  return path === '/stats' || path === '/jobs' || /^\/jobs\/[^/]+$/.test(path);
}

function isLikelyJwt(token: string | undefined | null) {
  if (!token) return false;
  const parts = token.split('.');
  const jwtPart = /^[A-Za-z0-9_=-]+$/;
  return parts.length === 3 && parts.every((p) => p.length > 0 && jwtPart.test(p));
}

export function isSessionNotFoundError(error: unknown) {
  if (!error || typeof error !== 'object') return false;
  const maybeError = error as { code?: string; message?: string };
  const code = String(maybeError.code || '').toLowerCase();
  const message = String(maybeError.message || '');
  return (
    code === 'session_not_found' ||
    /session from session_id claim in jwt does not exist/i.test(message)
  );
}

async function clearLocalAuthSession() {
  await supabase.auth.signOut({ scope: 'local' }).catch(() => {});
}

function decodeJwtPayload(token: string) {
  try {
    const [, payloadPart] = token.split('.');
    if (!payloadPart) return null;
    const base64 = payloadPart.replace(/-/g, '+').replace(/_/g, '/');
    const padded = base64 + '='.repeat((4 - (base64.length % 4)) % 4);
    const binString = atob(padded);
    // Convert binary string to UTF-8
    const bytes = new Uint8Array(binString.length);
    for (let i = 0; i < binString.length; i++) bytes[i] = binString.charCodeAt(i);
    const json = new TextDecoder().decode(bytes);
    return JSON.parse(json) as { exp?: number; iss?: string };
  } catch {
    return null;
  }
}

function decodeJwtHeader(token: string) {
  try {
    const [headerPart] = token.split('.');
    if (!headerPart) return null;
    const base64 = headerPart.replace(/-/g, '+').replace(/_/g, '/');
    const padded = base64 + '='.repeat((4 - (base64.length % 4)) % 4);
    const binString = atob(padded);
    const bytes = new Uint8Array(binString.length);
    for (let i = 0; i < binString.length; i++) bytes[i] = binString.charCodeAt(i);
    const json = new TextDecoder().decode(bytes);
    return JSON.parse(json) as { alg?: string; typ?: string };
  } catch {
    return null;
  }
}

function shouldRefreshToken(token: string | undefined) {
  if (!isLikelyJwt(token)) return true;

  const payload = decodeJwtPayload(token);
  if (!payload) return true;

  const expectedIssuer = `https://${projectId}.supabase.co/auth/v1`;
  if (payload.iss && payload.iss !== expectedIssuer && payload.iss !== 'supabase') return true;

  if (!payload.exp) return true;
  const now = Math.floor(Date.now() / 1000);
  // Refresh slightly early to avoid races around expiry.
  return payload.exp <= now + 30;
}

async function parseErrorResponse(response: Response) {
  const text = await response.text().catch(() => '');
  let parsed: { error?: string; message?: string } = {};
  try {
    parsed = text ? JSON.parse(text) : {};
  } catch {
    parsed = {};
  }

  const message =
    parsed.error ||
    parsed.message ||
    `Request failed (${response.status})${text ? `: ${text.slice(0, 180)}` : ''}`;

  return { message, text };
}

// API helper
export async function apiCall(endpoint: string, options: ApiCallOptions = {}) {
  const { requireAuth = false, accessTokenOverride, bypassInterceptors = false, ...requestOptions } = options;
  const { data: { session }, error: sessionError } = await supabase.auth.getSession();
  if (isSessionNotFoundError(sessionError)) {
    await clearLocalAuthSession();
    throw new Error('Session expired. Please sign in again.');
  }
  let token = accessTokenOverride ?? session?.access_token;
  const method = (requestOptions.method || 'GET').toString().toUpperCase();
  const normalizedEndpoint = getEndpointPath(endpoint);
  const tokenAlg = token && isLikelyJwt(token)
    ? String(decodeJwtHeader(token)?.alg || '').toUpperCase()
    : '';
  const prefersDelegatedEs256 = tokenAlg === 'ES256';

  // Client-side table interceptors can fail in some environments when ES256 JWTs are
  // rejected by the auth gateway for direct PostgREST calls. Route through Edge API
  // with delegated auth in those cases.
  if (prefersDelegatedEs256 && !bypassInterceptors) {
    return apiCall(endpoint, { ...options, bypassInterceptors: true });
  }

  // Resolve effective user for interceptors.
  // During auth transition just after signIn, session may briefly be null
  // while accessTokenOverride carries the fresh token — derive user from it.
  let effectiveUser = session?.user ?? null;
  if (!effectiveUser && token && isLikelyJwt(token)) {
    const { data: { user: tokenUser }, error: tokenUserError } = await supabase.auth.getUser(token);
    if (isSessionNotFoundError(tokenUserError)) {
      await clearLocalAuthSession();
      throw new Error('Session expired. Please sign in again.');
    }
    effectiveUser = tokenUser;
  }

  const requestBody = (() => {
    if (typeof requestOptions.body !== 'string') return {} as Record<string, unknown>;
    try {
      return JSON.parse(requestOptions.body || '{}') as Record<string, unknown>;
    } catch {
      return {} as Record<string, unknown>;
    }
  })();

  if (!bypassInterceptors) {
  // ----- Supabase Edge Function Edge-case Intercepts -----
  // Kong API gateway has issues verifying newly issued ES256 session tokens, throwing "Invalid JWT".
  // To avoid breaking authenticated features, we intercept and run native equivalent queries here.
  if (effectiveUser && method === 'GET' && endpoint.includes('/employer/stats')) {
    await assertApprovedEmployer(effectiveUser.id);
    const { data: jobs } = await supabase.from('jobs').select('id, status').eq('employer_id', effectiveUser.id);
    const jobIds = (jobs || []).map((j: Record<string, unknown>) => j.id as string);
    const activeListings = (jobs || []).filter((j: Record<string, unknown>) => j.status === 'active').length;
    let totalApplications = 0;
    let shortlisted = 0;
    if (jobIds.length > 0) {
      const { data: apps } = await supabase.from('applications').select('status').in('job_id', jobIds);
      totalApplications = (apps || []).length;
      shortlisted = (apps || []).filter((a: Record<string, unknown>) =>
        ['shortlisted', 'interview', 'offer'].includes(a.status as string)
      ).length;
    }
    return { activeListings, totalApplications, shortlisted, interviewsToday: 0, cvViews: 0 };
  }
  // NOTE: Public /jobs and /jobs/:id are intentionally served by the edge endpoint
  // so employer identity (name/logo/profile fields) remains consistent.
  if (effectiveUser && method === 'GET' && endpoint.includes('/employer/jobs')) {
    await assertApprovedEmployer(effectiveUser.id);
    const { data: jobs } = await supabase.from('jobs').select('*').eq('employer_id', effectiveUser.id).order('created_at', { ascending: false });
    const jobIds = (jobs || []).map((j: Record<string, unknown>) => j.id as string);
    let appCounts: Record<string, number> = {};
    if (jobIds.length > 0) {
      const { data: apps } = await supabase.from('applications').select('job_id').in('job_id', jobIds);
      appCounts = (apps || []).reduce((acc: Record<string, number>, a: Record<string, unknown>) => {
        const jid = a.job_id as string;
        acc[jid] = (acc[jid] || 0) + 1;
        return acc;
      }, {});
    }
    const enriched = (jobs || []).map((j: Record<string, unknown>) => ({ ...j, apps: appCounts[j.id as string] || 0 }));
    return { jobs: enriched };
  }
  if (method === 'GET' && normalizedEndpoint === '/employer/talent-search') {
    if (!effectiveUser) {
      await supabase.auth.signOut({ scope: 'local' }).catch(() => {});
      throw new Error('Not authenticated');
    }

    // Prefer server endpoint first because it runs with service-role privileges and
    // is not constrained by client-side RLS visibility policy differences.
    try {
      const serverResponse = await requestTalentSearchFromService({
        serverUrl,
        endpoint,
        token,
        publicAnonKey,
        requestOptions,
      });

      if (serverResponse.ok) {
        return serverResponse.json();
      }

      const { message, text } = await parseErrorResponse(serverResponse);
      const authGateFailure = /Invalid JWT|Missing authorization header|UNAUTHORIZED_NO_AUTH_HEADER|UNAUTHORIZED_UNSUPPORTED_TOKEN_ALGORITHM|Unsupported JWT algorithm ES256|Unsupported JWT algorithm|unauthorized|not authorized|forbidden/i.test(
        `${message} ${text}`
      );

      // For non-auth failures, surface the server error directly.
      if (!authGateFailure) {
        throw new Error(message || 'Failed to search candidates');
      }
      // Otherwise continue to local fallback query below.
    } catch (serverError: any) {
      const msg = String(serverError?.message || '');
      const knownAuthGateError = /Invalid JWT|Missing authorization header|UNAUTHORIZED_NO_AUTH_HEADER|UNAUTHORIZED_UNSUPPORTED_TOKEN_ALGORITHM|Unsupported JWT algorithm ES256|Unsupported JWT algorithm|unauthorized|not authorized|forbidden/i.test(msg);
      if (!knownAuthGateError) {
        throw serverError;
      }
    }

    // Fallback path for environments where edge auth gateway rejects valid session JWTs.
    if (!effectiveUser) {
      throw new Error('Not authenticated');
    }
    await assertApprovedEmployer(effectiveUser.id);
    const params = new URLSearchParams(endpoint.split('?')[1] || '');
    const search = String(params.get('search') || '').trim().toLowerCase();
    const location = String(params.get('location') || '').trim();
    const hasVideo = ['true', '1', 'yes'].includes(String(params.get('hasVideo') || '').toLowerCase());
    const sort = String(params.get('sort') || 'relevance').toLowerCase();
    const page = Math.max(1, parseInt(params.get('page') || '1', 10) || 1);
    const limit = Math.min(100, Math.max(1, parseInt(params.get('limit') || '50', 10) || 50));
    const levelSet = new Set(
      String(params.get('levels') || '')
        .split(',')
        .map((l) => l.trim().toLowerCase())
        .filter(Boolean)
    );

    let actingUser = effectiveUser;
    if (!actingUser) {
      const { data: { user: delegatedUser }, error: delegatedUserError } = await supabase.auth.getUser(
        token && isLikelyJwt(token) ? token : undefined
      );
      if (isSessionNotFoundError(delegatedUserError)) {
        await clearLocalAuthSession();
        throw new Error('Session expired. Please sign in again.');
      }
      actingUser = delegatedUser;
    }
    if (!actingUser) {
      throw new Error('Not authenticated');
    }

    const { data: callerProfile, error: callerProfileError } = await supabase
      .from('profiles')
      .select('user_type')
      .eq('id', actingUser.id)
      .maybeSingle();
    if (callerProfileError) throw new Error(callerProfileError.message);
    if (!callerProfile || callerProfile.user_type !== 'employer') {
      throw new Error('Not authorized');
    }

    let query = supabase
      .from('profiles')
      .select('id, name, email, headline, summary, location, avatar_url, skills, experience, social_links, updated_at')
      .eq('user_type', 'seeker');

    if (search) {
      query = query.or(`name.ilike.%${search}%,headline.ilike.%${search}%,summary.ilike.%${search}%`);
    }

    if (location) {
      query = query.ilike('location', `%${location}%`);
    }

    const { data: profiles, error } = await query;
    if (error) throw new Error(error.message);

    const estimateYears = (experience: unknown) => {
      if (!Array.isArray(experience) || experience.length === 0) return 0;
      const now = Date.now();
      const parseMonth = (value: unknown) => {
        if (typeof value !== 'string' || !value.trim()) return null;
        const parsed = Date.parse(`${value}-01`);
        return Number.isNaN(parsed) ? null : parsed;
      };

      let months = 0;
      for (const item of experience) {
        if (!item || typeof item !== 'object') continue;
        const row = item as Record<string, unknown>;
        const start = parseMonth(row.startDate);
        const end = parseMonth(row.endDate) ?? now;
        if (!start || end < start) {
          months += 12;
          continue;
        }
        months += Math.max(1, Math.round((end - start) / (1000 * 60 * 60 * 24 * 30.4375)));
      }
      return Math.max(0, Math.round((months / 12) * 10) / 10);
    };

    const levelForYears = (years: number) => {
      if (years <= 1) return 'entry';
      if (years <= 2) return 'junior';
      if (years <= 5) return 'mid';
      return 'senior';
    };

    const candidates = (profiles || []).map((profile: Record<string, unknown>) => {
      const skills = Array.isArray(profile.skills)
        ? profile.skills.filter((s): s is string => typeof s === 'string' && s.trim().length > 0)
        : [];
      const yearsOfExperience = estimateYears(profile.experience);
      const socialLinks = (profile.social_links as Record<string, unknown> | null) || {};
      const video = (socialLinks.video_introduction || socialLinks.videoIntroduction) as string | undefined;

      return {
        id: profile.id as string,
        name: String(profile.name || 'Candidate'),
        email: String(profile.email || ''),
        headline: String(profile.headline || ''),
        summary: String(profile.summary || ''),
        location: String(profile.location || ''),
        avatar_url: (profile.avatar_url as string | null) || null,
        skills,
        yearsOfExperience,
        experienceLevel: levelForYears(yearsOfExperience),
        video_introduction: typeof video === 'string' && video.trim() ? video.trim() : null,
        updated_at: String(profile.updated_at || ''),
      };
    });

    const filtered = candidates.filter((candidate) => {
      const matchesVideo = !hasVideo || !!candidate.video_introduction;
      const matchesLevel = levelSet.size === 0 || levelSet.has(candidate.experienceLevel);

      const haystack = [
        candidate.name,
        candidate.headline,
        candidate.summary,
        candidate.location,
        ...candidate.skills,
      ]
        .map((value) => String(value || '').toLowerCase())
        .join(' ');

      const matchesSearch = !search || haystack.includes(search);
      return matchesVideo && matchesLevel && matchesSearch;
    });

    const sorted = [...filtered].sort((a, b) => {
      if (sort === 'newest') {
        return Date.parse(b.updated_at || '') - Date.parse(a.updated_at || '');
      }
      if (sort === 'name') {
        return a.name.localeCompare(b.name);
      }
      const aScore = (search ? a.skills.filter((s) => s.toLowerCase().includes(search)).length : 0) + (a.yearsOfExperience / 10);
      const bScore = (search ? b.skills.filter((s) => s.toLowerCase().includes(search)).length : 0) + (b.yearsOfExperience / 10);
      if (bScore !== aScore) return bScore - aScore;
      return Date.parse(b.updated_at || '') - Date.parse(a.updated_at || '');
    });

    const totalCount = sorted.length;
    const start = (page - 1) * limit;
    const paged = sorted.slice(start, start + limit);

    return { candidates: paged, count: paged.length, totalCount, page, limit };
  }
  if (effectiveUser && method === 'POST' && normalizedEndpoint === '/employer/onboarding/submissions') {
    await assertEmployer(effectiveUser.id);

    const { data: existingSubmission, error: existingSubmissionError } = await supabase
      .from('employer_onboarding_submissions')
      .select('id, status, submitted_at')
      .eq('employer_id', effectiveUser.id)
      .limit(1)
      .maybeSingle();

    if (existingSubmissionError) throw new Error(existingSubmissionError.message);
    if (existingSubmission) {
      throw new Error('Onboarding has already been submitted. It is pending admin review.');
    }

    const requiredTextFields: Array<[string, unknown]> = [
      ['companyName', requestBody.companyName],
      ['contactName', requestBody.contactName],
      ['contactEmail', requestBody.contactEmail],
      ['contactPhone', requestBody.contactPhone],
      ['addressLine1', requestBody.addressLine1],
      ['city', requestBody.city],
      ['province', requestBody.province],
    ];

    const missingFields = requiredTextFields
      .filter(([, value]) => !String(value || '').trim())
      .map(([field]) => field);

    const documentsInput = Array.isArray(requestBody.documents) ? requestBody.documents as Array<Record<string, unknown>> : [];
    const requiredDocTypes = ['registration_proof', 'tax_document'];
    const missingDocuments = requiredDocTypes.filter((requiredType) =>
      !documentsInput.some((doc) => String(doc.docType || '') === requiredType && String(doc.storagePath || '').trim())
    );

    if (missingFields.length > 0 || missingDocuments.length > 0) {
      throw new Error('Onboarding submission validation failed');
    }

    const { data: profile, error: profileError } = await supabase
      .from('profiles')
      .select('id, employer_status, email, name')
      .eq('id', effectiveUser.id)
      .single();
    if (profileError) throw new Error(profileError.message);

    const nextRevision = 1;
    const nowIso = new Date().toISOString();

    const { data: submission, error: submissionError } = await supabase
      .from('employer_onboarding_submissions')
      .insert({
        employer_id: effectiveUser.id,
        revision_no: nextRevision,
        status: 'pending_review',
        company_name: String(requestBody.companyName).trim(),
        registration_number: requestBody.registrationNumber ? String(requestBody.registrationNumber).trim() : null,
        tax_number: requestBody.taxNumber ? String(requestBody.taxNumber).trim() : null,
        company_website: requestBody.companyWebsite ? String(requestBody.companyWebsite).trim() : null,
        business_overview: requestBody.businessOverview ? String(requestBody.businessOverview).trim() : null,
        contact_name: String(requestBody.contactName).trim(),
        contact_email: String(requestBody.contactEmail).trim().toLowerCase(),
        contact_phone: String(requestBody.contactPhone).trim(),
        address_line1: String(requestBody.addressLine1).trim(),
        address_line2: requestBody.addressLine2 ? String(requestBody.addressLine2).trim() : null,
        city: String(requestBody.city).trim(),
        province: String(requestBody.province).trim(),
        postal_code: requestBody.postalCode ? String(requestBody.postalCode).trim() : null,
        country: requestBody.country ? String(requestBody.country).trim() : 'South Africa',
        submitted_at: nowIso,
        updated_at: nowIso,
      })
      .select('*')
      .single();
    if (submissionError) throw new Error(submissionError.message);

    const documentRows = documentsInput.map((doc) => ({
      submission_id: submission.id,
      employer_id: effectiveUser.id,
      doc_type: String(doc.docType || '').trim(),
      storage_bucket: String(doc.storageBucket || 'employer-onboarding').trim(),
      storage_path: String(doc.storagePath || '').trim(),
      original_file_name: doc.originalFileName ? String(doc.originalFileName) : null,
      mime_type: doc.mimeType ? String(doc.mimeType) : null,
      file_size_bytes: Number(doc.fileSizeBytes || 0) || null,
      verification_status: 'pending',
      updated_at: nowIso,
    }));

    if (documentRows.length > 0) {
      const { error: documentsError } = await supabase
        .from('employer_onboarding_documents')
        .upsert(documentRows, { onConflict: 'submission_id,doc_type' });
      if (documentsError) throw new Error(documentsError.message);
    }

    const { error: profileUpdateError } = await supabase
      .from('profiles')
      .update({
        employer_status: 'pending_review',
        reviewed_at: null,
        reviewed_by: null,
        updated_at: nowIso,
      })
      .eq('id', effectiveUser.id);
    if (profileUpdateError) throw new Error(profileUpdateError.message);

    return {
      submission,
      status: 'pending_review',
      missingFields: [],
      missingDocuments: [],
    };
  }
  if (effectiveUser && method === 'GET' && normalizedEndpoint === '/employer/onboarding/status') {
    await assertEmployer(effectiveUser.id);

    const [{ data: profile, error: profileError }, { data: latestSubmission, error: submissionError }, { data: latestAudit, error: auditError }] = await Promise.all([
      supabase
        .from('profiles')
        .select('id, name, email, employer_status, reviewed_at, reviewed_by, live_at')
        .eq('id', effectiveUser.id)
        .single(),
      supabase
        .from('employer_onboarding_submissions')
        .select('*')
        .eq('employer_id', effectiveUser.id)
        .order('revision_no', { ascending: false })
        .limit(1)
        .maybeSingle(),
      supabase
        .from('admin_onboarding_audit_log')
        .select('id, action, reason, metadata, created_at')
        .eq('target_employer_id', effectiveUser.id)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle(),
    ]);

    if (profileError) throw new Error(profileError.message);
    if (submissionError) throw new Error(submissionError.message);
    if (auditError) throw new Error(auditError.message);

    const currentStatus = normalizeEmployerStatus(profile?.employer_status);
    const guidance = {
      code:
        currentStatus === 'needs_info'
          ? 'EMPLOYER_ONBOARDING_NEEDS_INFO'
          : currentStatus === 'rejected'
            ? 'EMPLOYER_ONBOARDING_REJECTED'
            : currentStatus === 'suspended'
              ? 'EMPLOYER_ACCOUNT_SUSPENDED'
              : 'EMPLOYER_ONBOARDING_PENDING',
      message:
        currentStatus === 'needs_info'
          ? 'Your onboarding requires additional information before access can be granted.'
          : currentStatus === 'rejected'
            ? 'Your onboarding submission was rejected.'
            : currentStatus === 'suspended'
              ? 'Your employer account is currently suspended.'
              : 'Your onboarding is pending review.',
      guidance:
        currentStatus === 'needs_info'
          ? 'Please open your onboarding status page, review remediation notes, and resubmit the requested details.'
          : currentStatus === 'rejected'
            ? 'Review the rejection reason in your onboarding status page and submit a revised application when ready.'
            : currentStatus === 'suspended'
              ? 'Contact support or your account reviewer for reactivation guidance.'
              : 'You will gain access to employer operations once an admin approves your onboarding.',
    };

    return {
      employer_status: currentStatus,
      reviewed_at: profile?.reviewed_at || null,
      reviewed_by: profile?.reviewed_by || null,
      live_at: profile?.live_at || null,
      latest_submission: latestSubmission || null,
      latest_decision: latestAudit || null,
      guidance,
      remediation: {
        reviewer_notes: latestSubmission?.reviewer_notes || null,
        instructions: latestSubmission?.remediation_instructions || guidance.guidance,
      },
    };
  }
  if (effectiveUser && method === 'GET' && normalizedEndpoint === '/admin/onboarding/queue') {
    await assertAdmin(effectiveUser.id);

    const params = new URLSearchParams(endpoint.split('?')[1] || '');
    const statusFilter = String(params.get('status') || '').trim().toLowerCase();
    const minAgeHours = Math.max(0, parseInt(String(params.get('minAgeHours') || '0'), 10) || 0);

    let query = supabase
      .from('employer_onboarding_submissions')
      .select('id, employer_id, revision_no, status, company_name, contact_name, contact_email, submitted_at, updated_at, reviewer_notes, remediation_instructions')
      .order('submitted_at', { ascending: true });

    if ((EMPLOYER_STATUS_VALUES as readonly string[]).includes(statusFilter)) {
      query = query.eq('status', statusFilter);
    }

    const { data: rows, error } = await query;
    if (error) throw new Error(error.message);

    const now = Date.now();
    const filtered = (rows || []).filter((row: Record<string, unknown>) => {
      const submittedAt = Date.parse(String(row.submitted_at || ''));
      if (Number.isNaN(submittedAt)) return minAgeHours === 0;
      const ageHours = Math.floor((now - submittedAt) / (1000 * 60 * 60));
      return ageHours >= minAgeHours;
    });

    const employerIds = [...new Set(filtered.map((row: Record<string, unknown>) => String(row.employer_id || '')))].filter(Boolean);
    const { data: employerProfiles, error: employerError } = employerIds.length > 0
      ? await supabase.from('profiles').select('id, name, email, employer_status').in('id', employerIds)
      : { data: [] as Record<string, unknown>[], error: null };

    if (employerError) throw new Error(employerError.message);

    const employerMap: Record<string, Record<string, unknown>> = {};
    (employerProfiles || []).forEach((profile: Record<string, unknown>) => {
      employerMap[String(profile.id)] = profile;
    });

    const queue = filtered.map((row: Record<string, unknown>) => {
      const submittedAt = Date.parse(String(row.submitted_at || ''));
      const ageHours = Number.isNaN(submittedAt) ? null : Math.floor((now - submittedAt) / (1000 * 60 * 60));
      const employer = employerMap[String(row.employer_id)] || {};
      return {
        ...row,
        age_hours: ageHours,
        employer_name: employer.name || row.company_name || 'Employer',
        employer_email: employer.email || row.contact_email || null,
        employer_status: employer.employer_status || row.status,
      };
    });

    return { queue, count: queue.length };
  }
  if (effectiveUser && method === 'GET' && /^\/admin\/onboarding\/queue\/[^/]+$/.test(normalizedEndpoint)) {
    await assertAdmin(effectiveUser.id);
    const employerId = normalizedEndpoint.split('/').pop();
    if (!employerId) throw new Error('Employer id is required');

    const [{ data: submission, error: submissionError }, { data: documents, error: docsError }, { data: employer, error: employerError }] = await Promise.all([
      supabase
        .from('employer_onboarding_submissions')
        .select('*')
        .eq('employer_id', employerId)
        .order('revision_no', { ascending: false })
        .limit(1)
        .maybeSingle(),
      supabase
        .from('employer_onboarding_documents')
        .select('*')
        .eq('employer_id', employerId)
        .order('created_at', { ascending: false }),
      supabase
        .from('profiles')
        .select('id, name, email, employer_status, reviewed_at, reviewed_by')
        .eq('id', employerId)
        .maybeSingle(),
    ]);

    if (submissionError) throw new Error(submissionError.message);
    if (docsError) throw new Error(docsError.message);
    if (employerError) throw new Error(employerError.message);
    if (!submission) throw new Error('Onboarding submission not found');

    return {
      submission,
      documents: documents || [],
      employer: employer || null,
    };
  }
  if (effectiveUser && method === 'POST' && /^\/admin\/onboarding\/[^/]+\/decision$/.test(normalizedEndpoint)) {
    await assertAdmin(effectiveUser.id);
    const employerId = normalizedEndpoint.split('/')[3];
    if (!employerId) throw new Error('Employer id is required');

    const action = String(requestBody.action || '').trim().toLowerCase();
    const reason = String(requestBody.reason || '').trim();
    const reviewerNotes = requestBody.reviewerNotes ? String(requestBody.reviewerNotes).trim() : null;
    const remediationInstructions = requestBody.remediationInstructions ? String(requestBody.remediationInstructions).trim() : null;

    const actionToStatus: Record<string, typeof EMPLOYER_STATUS_VALUES[number]> = {
      approve: 'approved',
      reject: 'rejected',
      request_info: 'needs_info',
      suspend: 'suspended',
      reactivate: 'approved',
    };

    if (!Object.prototype.hasOwnProperty.call(actionToStatus, action)) {
      throw new Error('Invalid onboarding action');
    }
    if (['reject', 'request_info', 'suspend'].includes(action) && !reason) {
      throw new Error('Reason is required for this action');
    }

    const [{ data: targetProfile, error: targetError }, { data: latestSubmission, error: submissionError }] = await Promise.all([
      supabase.from('profiles').select('id, email, name, employer_status').eq('id', employerId).maybeSingle(),
      supabase
        .from('employer_onboarding_submissions')
        .select('*')
        .eq('employer_id', employerId)
        .order('revision_no', { ascending: false })
        .limit(1)
        .maybeSingle(),
    ]);

    if (targetError) throw new Error(targetError.message);
    if (submissionError) throw new Error(submissionError.message);
    if (!targetProfile) throw new Error('Employer not found');
    if (!latestSubmission) throw new Error('No onboarding submission found for employer');

    const statusTo = actionToStatus[action];
    const statusFrom = normalizeEmployerStatus(targetProfile.employer_status);
    const nowIso = new Date().toISOString();

    const profileUpdate: Record<string, unknown> = {
      employer_status: statusTo,
      reviewed_at: nowIso,
      reviewed_by: effectiveUser.id,
      updated_at: nowIso,
    };
    if (statusTo === 'approved') {
      profileUpdate.live_at = nowIso;
    }

    const { data: updatedProfile, error: profileError } = await supabase
      .from('profiles')
      .update(profileUpdate)
      .eq('id', employerId)
      .select('id, employer_status, reviewed_at, reviewed_by, live_at')
      .single();
    if (profileError) throw new Error(profileError.message);

    const { data: updatedSubmission, error: updateSubmissionError } = await supabase
      .from('employer_onboarding_submissions')
      .update({
        status: statusTo,
        reviewer_notes: reviewerNotes,
        remediation_instructions: remediationInstructions,
        decision_reason: reason || null,
        updated_at: nowIso,
      })
      .eq('id', latestSubmission.id)
      .select('*')
      .single();
    if (updateSubmissionError) throw new Error(updateSubmissionError.message);

    const { error: auditError } = await supabase
      .from('admin_onboarding_audit_log')
      .insert({
        actor_id: effectiveUser.id,
        target_employer_id: employerId,
        submission_id: latestSubmission.id,
        action,
        reason: reason || null,
        metadata: {
          status_from: statusFrom,
          status_to: statusTo,
          reviewer_notes: reviewerNotes,
          remediation_instructions: remediationInstructions,
        },
      });
    if (auditError) throw new Error(auditError.message);

    return {
      profile: updatedProfile,
      submission: updatedSubmission,
      transition: { from: statusFrom, to: statusTo, action },
    };
  }
  if (effectiveUser && method === 'POST' && normalizedEndpoint === '/jobs') {
    await assertApprovedEmployer(effectiveUser.id);
    const title = String(requestBody.title || '').trim();
    if (!title) throw new Error('Job title is required');
    const screeningQuestions = Array.isArray(requestBody.screening_questions)
      ? (requestBody.screening_questions as Array<Record<string, unknown>>)
          .map((question, index) => ({
            id: String(question.id ?? index),
            prompt: String(question.prompt || '').trim(),
            duration: String(question.duration || '1min').trim(),
          }))
          .filter((question) => question.prompt.length > 0)
      : [];

    const { data, error } = await supabase
      .from('jobs')
      .insert({
        employer_id: effectiveUser.id,
        title,
        industry: requestBody.industry || null,
        category: requestBody.category || null,
        employment_type: requestBody.employment_type || null,
        work_location: requestBody.work_location || null,
        province: requestBody.province || null,
        city: requestBody.city || null,
        salary_min: requestBody.salary_min ? Number(requestBody.salary_min) : null,
        salary_max: requestBody.salary_max ? Number(requestBody.salary_max) : null,
        description: requestBody.description || null,
        requirements: Array.isArray(requestBody.requirements) ? requestBody.requirements : [],
        benefits: Array.isArray(requestBody.benefits) ? requestBody.benefits : [],
        interview_type: requestBody.interview_type || null,
        screening_questions: screeningQuestions,
        status: 'active',
      })
      .select()
      .single();
    if (error) throw new Error(error.message);
    return { job: data };
  }
  if (effectiveUser && method === 'PUT' && /^\/jobs\/[^/]+$/.test(normalizedEndpoint)) {
    const jobId = normalizedEndpoint.split('/').pop();
    if (!jobId) throw new Error('jobId is required');
    const allowedStatuses = ['active', 'closed', 'draft'];
    const payload: Record<string, unknown> = { updated_at: new Date().toISOString() };
    if (requestBody.status && allowedStatuses.includes(String(requestBody.status))) {
      payload.status = requestBody.status;
    }
    if (requestBody.title !== undefined) payload.title = requestBody.title;
    if (requestBody.description !== undefined) payload.description = requestBody.description;
    const { data, error } = await supabase
      .from('jobs')
      .update(payload)
      .eq('id', jobId)
      .eq('employer_id', effectiveUser.id)
      .select()
      .single();
    if (error) throw new Error(error.message);
    return { job: data };
  }
  if (effectiveUser && method === 'DELETE' && /^\/jobs\/[^/]+$/.test(normalizedEndpoint)) {
    const jobId = normalizedEndpoint.split('/').pop();
    if (!jobId) throw new Error('jobId is required');
    const { error } = await supabase
      .from('jobs')
      .delete()
      .eq('id', jobId)
      .eq('employer_id', effectiveUser.id);
    if (error) throw new Error(error.message);
    return { success: true };
  }
  if (effectiveUser && method === 'POST' && normalizedEndpoint === '/saved-jobs') {
    const jobId = String(requestBody.jobId || requestBody.job_id || '').trim();
    if (!jobId) throw new Error('jobId is required');

    const { error } = await supabase
      .from('saved_jobs')
      .insert({ seeker_id: effectiveUser.id, job_id: jobId });

    if (error && error.code !== '23505') throw new Error(error.message);
    return { success: true };
  }
  if (effectiveUser && method === 'DELETE' && /^\/saved-jobs\/[^/]+$/.test(normalizedEndpoint)) {
    const jobId = normalizedEndpoint.split('/').pop();
    if (jobId) {
      const { error } = await supabase.from('saved_jobs').delete().match({ job_id: jobId, seeker_id: effectiveUser.id });
      if (error) throw new Error(error.message);
    }
    return { success: true };
  }
  // NOTE: /applications endpoints intentionally route through the Edge Function
  // so workflow emails, idempotency, and delivery metadata execute server-side.
  if (effectiveUser && method === 'GET' && normalizedEndpoint === '/auth/profile') {
    const fallbackProfile = buildFallbackProfile(effectiveUser);

    const { data: profile, error } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', effectiveUser.id)
      .maybeSingle();

    if (isProfilesPolicyRecursionError(error)) {
      return { profile: fallbackProfile };
    }

    if (error && error.code !== 'PGRST116') throw new Error(error.message);
    if (profile) {
      const userType = resolveUserTypeFromProfile(profile, effectiveUser.user_metadata?.userType);
      return {
        profile: {
          ...profile,
          user_type: profile.user_type ?? userType,
          userType,
          employer_status: userType === 'employer' ? normalizeEmployerStatus(profile.employer_status) : null,
        },
      };
    }

    const { data: createdProfile, error: createError } = await supabase
      .from('profiles')
      .upsert(fallbackProfile, { onConflict: 'id' })
      .select('*')
      .single();

    if (createError) throw new Error(createError.message);
    return { profile: createdProfile };
  }
  if (effectiveUser && method === 'PUT' && normalizedEndpoint === '/auth/profile') {
    const now = new Date().toISOString();
    const fallbackProfile = {
      ...buildFallbackProfile(effectiveUser),
      updated_at: now,
    };

    const { data: existingProfile } = await supabase
      .from('profiles')
      .select('id')
      .eq('id', effectiveUser.id)
      .maybeSingle();

    if (!existingProfile) {
      const { error: ensureError } = await supabase
        .from('profiles')
        .upsert(fallbackProfile, { onConflict: 'id' });
      if (ensureError) throw new Error(ensureError.message);
    }

    let updates: Record<string, unknown> = {};
    if (typeof requestOptions.body === 'string') {
      try {
        updates = JSON.parse(requestOptions.body || '{}');
      } catch {
        updates = {};
      }
    } else if (requestOptions.body && typeof requestOptions.body === 'object') {
      updates = requestOptions.body as Record<string, unknown>;
    }

    const { data: profile, error } = await supabase
      .from('profiles')
      .update({ ...updates, updated_at: now })
      .eq('id', effectiveUser.id)
      .select('*')
      .single();

    if (error) throw new Error(error.message);
    return { profile };
  }
  if (effectiveUser && method === 'GET' && normalizedEndpoint === '/saved-jobs') {
    const { data, error } = await supabase
      .from('saved_jobs')
      .select('*, job:jobs(*)')
      .eq('seeker_id', effectiveUser.id)
      .order('created_at', { ascending: false });

    if (error) throw new Error(error.message);
    const jobs = (data || []).map((s: Record<string, unknown>) => s.job).filter(Boolean);
    return { jobs };
  }
  if (effectiveUser && method === 'GET' && normalizedEndpoint === '/saved-jobs/count') {
    const { count, error } = await supabase
      .from('saved_jobs')
      .select('*', { count: 'exact', head: true })
      .eq('seeker_id', effectiveUser.id);

    if (error) throw new Error(error.message);
    return { count: count || 0 };
  }
  if (effectiveUser && method === 'GET' && normalizedEndpoint === '/profile/views') {
    return { views: 0 };
  }
  if (effectiveUser && method === 'POST' && normalizedEndpoint === '/referrals') {
    const refereeEmailRaw = String(requestBody.referee_email || requestBody.refereeEmail || '').trim().toLowerCase();

    const { data: referral, error } = await supabase
      .from('referrals')
      .insert({
        referrer_id: effectiveUser.id,
        referee_email: refereeEmailRaw || null,
        status: 'invited',
        payout: 0,
      })
      .select('*')
      .single();

    if (error) throw new Error(error.message);
    return { referral };
  }
  if (effectiveUser && method === 'GET' && normalizedEndpoint === '/referrals/my') {
    const { data: referrals, error } = await supabase
      .from('referrals')
      .select('*')
      .eq('referrer_id', effectiveUser.id)
      .order('created_at', { ascending: false });

    if (error) throw new Error(error.message);

    const rows = referrals || [];
    const total = rows.reduce((sum: number, r: Record<string, unknown>) => sum + Number(r.payout || 0), 0);
    const pending = rows
      .filter((r: Record<string, unknown>) => r.status !== 'hired')
      .reduce((sum: number, r: Record<string, unknown>) => sum + Number(r.payout || 0), 0);
    const available = Math.max(0, total - pending);

    return {
      referralLink: `https://recruitfriend.co.za/ref/${effectiveUser.id.slice(0, 8)}`,
      referrals: rows,
      stats: { active: rows.filter((r: Record<string, unknown>) => r.status !== 'hired').length },
      earnings: { total, pending, available },
    };
  }
  if (effectiveUser && method === 'GET' && normalizedEndpoint === '/alerts') {
    const { data: alerts, error } = await supabase
      .from('job_alerts')
      .select('*')
      .eq('seeker_id', effectiveUser.id)
      .order('created_at', { ascending: false });

    if (error) throw new Error(error.message);
    return { alerts: alerts || [] };
  }
  if (effectiveUser && method === 'POST' && normalizedEndpoint === '/alerts') {
    const keywords = String(requestBody.keywords || '').trim();
    if (!keywords) throw new Error('Keywords are required');

    const locationRaw = requestBody.location;
    const minSalaryRaw = requestBody.minSalary ?? requestBody.min_salary;
    const frequencyRaw = requestBody.frequency;
    const typesRaw = requestBody.types;
    const activeRaw = requestBody.active;

    const { data: alert, error } = await supabase
      .from('job_alerts')
      .insert({
        seeker_id: effectiveUser.id,
        keywords,
        location: locationRaw ? String(locationRaw) : null,
        min_salary:
          minSalaryRaw === undefined || minSalaryRaw === null || minSalaryRaw === ''
            ? null
            : Number(minSalaryRaw),
        frequency: String(frequencyRaw || 'daily').toLowerCase(),
        types: Array.isArray(typesRaw) ? typesRaw : [],
        active: activeRaw === undefined ? true : Boolean(activeRaw),
      })
      .select('*')
      .single();

    if (error) throw new Error(error.message);
    return { alert };
  }
  if (effectiveUser && method === 'PUT' && /^\/alerts\/[^/]+$/.test(normalizedEndpoint)) {
    const alertId = normalizedEndpoint.split('/').pop();
    if (!alertId) throw new Error('Alert id is required');

    const payload: Record<string, unknown> = { updated_at: new Date().toISOString() };

    if (requestBody.keywords !== undefined) payload.keywords = String(requestBody.keywords).trim();
    if (requestBody.location !== undefined) payload.location = requestBody.location || null;
    if (requestBody.minSalary !== undefined || requestBody.min_salary !== undefined) {
      const value = requestBody.minSalary ?? requestBody.min_salary;
      payload.min_salary = value === '' || value === null ? null : Number(value);
    }
    if (requestBody.frequency !== undefined) payload.frequency = String(requestBody.frequency).toLowerCase();
    if (requestBody.types !== undefined) payload.types = Array.isArray(requestBody.types) ? requestBody.types : [];
    if (requestBody.active !== undefined) payload.active = Boolean(requestBody.active);

    const { data: alert, error } = await supabase
      .from('job_alerts')
      .update(payload)
      .eq('id', alertId)
      .eq('seeker_id', effectiveUser.id)
      .select('*')
      .single();

    if (error) throw new Error(error.message);
    return { alert };
  }
  if (effectiveUser && method === 'DELETE' && /^\/alerts\/[^/]+$/.test(normalizedEndpoint)) {
    const alertId = normalizedEndpoint.split('/').pop();
    if (!alertId) throw new Error('Alert id is required');

    const { error } = await supabase
      .from('job_alerts')
      .delete()
      .eq('id', alertId)
      .eq('seeker_id', effectiveUser.id);

    if (error) throw new Error(error.message);
    return { success: true };
  }
  if (effectiveUser && method === 'GET' && normalizedEndpoint === '/cv/settings') {
    const { data, error } = await supabase
      .from('cv_settings')
      .select('*')
      .eq('seeker_id', effectiveUser.id)
      .maybeSingle();

    if (error && error.code !== 'PGRST116') throw new Error(error.message);
    return { settings: data || { template: 'classic', visibility: true, last_synced_at: null } };
  }
  if (effectiveUser && method === 'PUT' && normalizedEndpoint === '/cv/settings') {
    const template = String(requestBody.template || 'classic');
    const visibility = requestBody.visibility === undefined ? true : Boolean(requestBody.visibility);

    const { data, error } = await supabase
      .from('cv_settings')
      .upsert(
        {
          seeker_id: effectiveUser.id,
          template,
          visibility,
          updated_at: new Date().toISOString(),
        },
        { onConflict: 'seeker_id' }
      )
      .select('*')
      .single();

    if (error) throw new Error(error.message);
    return { settings: data };
  }
  if (effectiveUser && method === 'POST' && normalizedEndpoint === '/cv/settings/sync') {
    const now = new Date().toISOString();
    const { data: existing, error: existingError } = await supabase
      .from('cv_settings')
      .select('template, visibility')
      .eq('seeker_id', effectiveUser.id)
      .maybeSingle();

    if (existingError && existingError.code !== 'PGRST116') throw new Error(existingError.message);

    const { data, error } = await supabase
      .from('cv_settings')
      .upsert(
        {
          seeker_id: effectiveUser.id,
          template: existing?.template || 'classic',
          visibility: existing?.visibility ?? true,
          last_synced_at: now,
          updated_at: now,
        },
        { onConflict: 'seeker_id' }
      )
      .select('*')
      .single();

    if (error) throw new Error(error.message);
    return { synced: true, settings: data };
  }
  if (effectiveUser && method === 'GET' && normalizedEndpoint === '/cv/files') {
    const { data, error } = await supabase
      .from('cv_files')
      .select('*')
      .eq('seeker_id', effectiveUser.id)
      .order('updated_at', { ascending: false });

    if (error) throw new Error(error.message);
    return { files: data || [] };
  }
  if (effectiveUser && method === 'POST' && normalizedEndpoint === '/cv/files') {
    const fileName = String(requestBody.fileName || requestBody.file_name || '').trim();
    if (!fileName) throw new Error('fileName is required');
    const size = Number(requestBody.size ?? requestBody.file_size ?? 0) || 0;

    const { data, error } = await supabase
      .from('cv_files')
      .insert({ seeker_id: effectiveUser.id, file_name: fileName, file_size: size })
      .select('*')
      .single();

    if (error) throw new Error(error.message);
    return { file: data };
  }
  if (effectiveUser && method === 'PUT' && /^\/cv\/files\/[^/]+$/.test(normalizedEndpoint)) {
    const fileId = normalizedEndpoint.split('/').pop();
    if (!fileId) throw new Error('File id is required');

    const fileName = String(requestBody.fileName || requestBody.file_name || '').trim();
    if (!fileName) throw new Error('fileName is required');
    const size = Number(requestBody.size ?? requestBody.file_size ?? 0) || 0;

    const { data, error } = await supabase
      .from('cv_files')
      .update({ file_name: fileName, file_size: size, updated_at: new Date().toISOString() })
      .eq('id', fileId)
      .eq('seeker_id', effectiveUser.id)
      .select('*')
      .single();

    if (error) throw new Error(error.message);
    return { file: data };
  }
  if (effectiveUser && method === 'DELETE' && /^\/cv\/files\/[^/]+$/.test(normalizedEndpoint)) {
    const fileId = normalizedEndpoint.split('/').pop();
    if (!fileId) throw new Error('File id is required');

    const { error } = await supabase
      .from('cv_files')
      .delete()
      .eq('id', fileId)
      .eq('seeker_id', effectiveUser.id);

    if (error) throw new Error(error.message);
    return { success: true };
  }
  // -------------------------------------------------------
  }

  const canSkipAuthHeader = !requireAuth && isPublicEndpoint(endpoint, method);
  const prefersDelegatedJwt = method === 'GET' && /^\/employer\/seeker\/[^/]+\/cv\/latest$/.test(normalizedEndpoint);

  if ((requireAuth || (token && token !== publicAnonKey)) && shouldRefreshToken(token)) {
    // Avoid calling .refreshSession() repeatedly on every fast api trigger and respect the gotrue locks.
    // getSession() above already tries to proactively refresh if needed and gives us a valid token.
    // If it's *still* expired here, it means we are truly out of bounds and have an invalid offline token.
    token = session?.access_token ?? accessTokenOverride;
    if (!token || shouldRefreshToken(token)) {
      await clearLocalAuthSession();
      throw new Error('Not authenticated');
    }
  }

  if (requireAuth && !isLikelyJwt(token)) {
    await clearLocalAuthSession();
    throw new Error('Not authenticated');
  }

  // Non-public endpoints should never be called with the anon JWT.
  // If we don't have a valid user token at this point, fail fast so callers
  // can redirect to login instead of hitting server routes with an invalid JWT.
  if (!canSkipAuthHeader && !isLikelyJwt(token)) {
    await clearLocalAuthSession();
    throw new Error('Not authenticated');
  }

  const request = async (withAuth: boolean, overrideToken?: string) => {
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      apikey: publicAnonKey,
      ...((requestOptions.headers as Record<string, string> | undefined) || {}),
    };

    const activeToken = overrideToken ?? token ?? publicAnonKey;
    if (isLikelyJwt(activeToken)) {
      headers['x-rf-user-jwt'] = activeToken;
    }

    if (withAuth && isLikelyJwt(activeToken)) {
      headers.Authorization = `Bearer ${activeToken}`;
    } else {
      // Edge Functions may enforce JWT presence at the gateway.
      // Use anon JWT whenever user auth is not being sent.
      headers.Authorization = `Bearer ${publicAnonKey}`;
    }

    return fetch(`${serverUrl}${endpoint}`, {
      ...requestOptions,
      headers,
    });
  };

  const withAuth = !canSkipAuthHeader && isLikelyJwt(token) && !prefersDelegatedJwt && !prefersDelegatedEs256;
  let response = await request(withAuth);

  if (!response.ok) {
    const { message, text } = await parseErrorResponse(response);
    const authHeaderMissing = response.status === 401 && /Missing authorization header/i.test(text || message);
    const invalidJwt = /Invalid JWT/i.test(text || message);
    const unsupportedJwtAlgorithm = /UNAUTHORIZED_UNSUPPORTED_TOKEN_ALGORITHM|Unsupported JWT algorithm ES256|Unsupported JWT algorithm/i.test(text || message);
    const sessionNotFound = /session_not_found|session from session_id claim in jwt does not exist/i.test(text || message);
    const shouldRetryAuth = invalidJwt || authHeaderMissing || unsupportedJwtAlgorithm || sessionNotFound;

    if (shouldRetryAuth) {
      // Try once with the latest session token in case of token rotation races.
      const { data: { session: retrySession }, error: retrySessionError } = await supabase.auth.getSession();
      if (isSessionNotFoundError(retrySessionError)) {
        await clearLocalAuthSession();
        throw new Error('Session expired. Please sign in again.');
      }
      const retryToken = retrySession?.access_token;
      if (isLikelyJwt(retryToken)) {
        token = retryToken;
        const retryTokenAlg = String(decodeJwtHeader(retryToken)?.alg || '').toUpperCase();
        const retryPrefersDelegatedEs256 = retryTokenAlg === 'ES256';
        response = await request(!prefersDelegatedJwt && !retryPrefersDelegatedEs256, retryToken);
        if (response.ok) return response.json();

        // Fallback for gateways that reject ES256 Authorization tokens.
        // Keep user JWT in x-rf-user-jwt while using anon Authorization header.
        response = await request(false, retryToken);
        if (response.ok) return response.json();
      }

      if (!requireAuth && canSkipAuthHeader) {
        response = await request(false);
        if (response.ok) return response.json();
      }

      if (!canSkipAuthHeader) {
        await clearLocalAuthSession();
        throw new Error('Not authenticated');
      }

      const retry = await parseErrorResponse(response);
      throw new Error(retry.message || 'Invalid JWT');
    }

    throw new Error(message);
  }

  return response.json();
}
