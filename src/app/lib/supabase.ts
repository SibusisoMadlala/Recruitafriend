import { createClient } from '@supabase/supabase-js';
import { projectId, publicAnonKey } from '/utils/supabase/info';

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

export const serverUrl = `${supabaseUrl}/functions/v1/make-server-bca21fd3`;

type ApiCallOptions = RequestInit & {
  requireAuth?: boolean;
  accessTokenOverride?: string;
};

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

  if (normalizedMethod !== 'GET') return false;

  return path === '/stats' || path === '/jobs' || /^\/jobs\/[^/]+$/.test(path);
}

function isLikelyJwt(token: string | undefined | null) {
  if (!token) return false;
  const parts = token.split('.');
  const jwtPart = /^[A-Za-z0-9_=-]+$/;
  return parts.length === 3 && parts.every((p) => p.length > 0 && jwtPart.test(p));
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
  const { requireAuth = false, accessTokenOverride, ...requestOptions } = options;
  const { data: { session } } = await supabase.auth.getSession();
  let token = accessTokenOverride ?? session?.access_token;
  const method = (requestOptions.method || 'GET').toString().toUpperCase();
  const normalizedEndpoint = getEndpointPath(endpoint);

  // Resolve effective user for interceptors.
  // During auth transition just after signIn, session may briefly be null
  // while accessTokenOverride carries the fresh token — derive user from it.
  let effectiveUser = session?.user ?? null;
  if (!effectiveUser && token && isLikelyJwt(token)) {
    const { data: { user: tokenUser } } = await supabase.auth.getUser(token);
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

  // ----- Supabase Edge Function Edge-case Intercepts -----
  // Kong API gateway has issues verifying newly issued ES256 session tokens, throwing "Invalid JWT".
  // To avoid breaking authenticated features, we intercept and run native equivalent queries here.
  if (effectiveUser && method === 'GET' && endpoint.includes('/employer/stats')) {
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
  if (method === 'GET' && normalizedEndpoint === '/jobs') {
    const page = Math.max(1, parseInt(new URLSearchParams(endpoint.split('?')[1]).get('page') || '1'));
    const limit = Math.min(100, Math.max(1, parseInt(new URLSearchParams(endpoint.split('?')[1]).get('limit') || '20')));
    const offset = (page - 1) * limit;
    const search = new URLSearchParams(endpoint.split('?')[1]).get('search');
    const location = new URLSearchParams(endpoint.split('?')[1]).get('location');
    const jobType = new URLSearchParams(endpoint.split('?')[1]).get('jobType');
    const minSalary = new URLSearchParams(endpoint.split('?')[1]).get('minSalary');
    const maxSalary = new URLSearchParams(endpoint.split('?')[1]).get('maxSalary');
    const industry = new URLSearchParams(endpoint.split('?')[1]).get('industry');

    let query = supabase
      .from('jobs')
      .select('*', { count: 'exact' })
      .eq('status', 'active')
      .order('created_at', { ascending: false })
      .range(offset, offset + limit - 1);

    if (search) {
      query = query.or(`title.ilike.%${search}%,description.ilike.%${search}%`);
    }
    if (location) {
      query = query.or(`city.ilike.%${location}%,province.ilike.%${location}%`);
    }
    if (jobType) {
      query = query.eq('employment_type', jobType);
    }
    if (industry) {
      query = query.eq('industry', industry);
    }
    if (minSalary) {
      query = query.gte('salary_max', parseInt(minSalary));
    }
    if (maxSalary) {
      query = query.lte('salary_min', parseInt(maxSalary));
    }

    const { data: jobs, error, count } = await query;
    if (error) throw new Error(error.message);

    // Fetch employer profiles separately to avoid FK relationship issues
    if (jobs && jobs.length > 0) {
      const employerIds = [...new Set((jobs as Record<string, unknown>[]).map(j => (j as any).employer_id))];
      const { data: profiles } = await supabase
        .from('profiles')
        .select('id, name, avatar_url')
        .in('id', employerIds);

      const profileMap: Record<string, Record<string, unknown>> = {};
      (profiles || []).forEach((p: Record<string, unknown>) => {
        profileMap[p.id as string] = p;
      });

      const enriched = (jobs as Record<string, unknown>[]).map((j: any) => ({
        ...j,
        employer: profileMap[j.employer_id] || null,
      }));

      return { jobs: enriched, count: jobs.length || 0, totalCount: count || 0 };
    }

    return { jobs: jobs || [], count: jobs?.length || 0, totalCount: count || 0 };
  }
  if (method === 'GET' && /^\/jobs\/[^/]+$/.test(normalizedEndpoint)) {
    const jobId = normalizedEndpoint.split('/').pop();
    if (!jobId) throw new Error('jobId is required');

    const { data: job, error } = await supabase
      .from('jobs')
      .select('*')
      .eq('id', jobId)
      .eq('status', 'active')
      .maybeSingle();

    if (error) throw new Error(error.message);
    if (!job) throw new Error('Job not found');

    // Fetch employer profile
    const { data: employer } = await supabase
      .from('profiles')
      .select('id, name, avatar_url, location')
      .eq('id', (job as any).employer_id)
      .maybeSingle();

    // Increment views
    const currentViews = (job as any).views || 0;
    await supabase.from('jobs').update({ views: currentViews + 1 }).eq('id', jobId).maybeSingle();

    return { job: { ...job, employer: employer || null } };
  }
  if (effectiveUser && method === 'GET' && endpoint.includes('/employer/jobs')) {
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
  if (effectiveUser && method === 'POST' && normalizedEndpoint === '/jobs') {
    const title = String(requestBody.title || '').trim();
    if (!title) throw new Error('Job title is required');
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
  if (effectiveUser && method === 'POST' && endpoint.includes('/applications')) {
    const jobId = String(requestBody.jobId || requestBody.job_id || '').trim();
    if (!jobId) throw new Error('jobId is required');

    const { data, error } = await supabase
      .from('applications')
      .insert({
        job_id: jobId,
        seeker_id: effectiveUser.id,
        cover_letter: (requestBody.coverLetter as string | undefined) || (requestBody.cover_letter as string | undefined) || '',
        custom_letter: Boolean(requestBody.customLetter ?? requestBody.custom_letter),
        status: 'applied',
      })
      .select()
      .single();

    if (error) throw new Error(error.message);
    return { application: data };
  }
  if (effectiveUser && method === 'PUT' && /^\/applications\/[^/]+$/.test(normalizedEndpoint)) {
    const appId = normalizedEndpoint.split('/').pop();
    if (!appId) throw new Error('Application id is required');

    const requestedStatus = String(requestBody.status || '').trim().toLowerCase();
    const requestedNotes = requestBody.notes;

    const { data: appRecord, error: appError } = await supabase
      .from('applications')
      .select('id, job_id, seeker_id')
      .eq('id', appId)
      .maybeSingle();

    if (appError) throw new Error(appError.message);
    if (!appRecord) throw new Error('Application not found');

    const { data: job, error: jobError } = await supabase
      .from('jobs')
      .select('employer_id')
      .eq('id', appRecord.job_id)
      .maybeSingle();

    if (jobError) throw new Error(jobError.message);

    const isEmployer = !!job && job.employer_id === effectiveUser.id;
    const isSeekerOwner = appRecord.seeker_id === effectiveUser.id;

    if (!isEmployer && !isSeekerOwner) throw new Error('Not authorized');
    if (isSeekerOwner && requestedStatus && requestedStatus !== 'rejected') {
      throw new Error('Seekers can only withdraw applications');
    }

    const payload: Record<string, unknown> = { updated_at: new Date().toISOString() };
    if (requestedStatus) payload.status = requestedStatus;
    if (requestedNotes !== undefined) payload.notes = requestedNotes;

    const { data: application, error: updateError } = await supabase
      .from('applications')
      .update(payload)
      .eq('id', appId)
      .select()
      .single();

    if (updateError) throw new Error(updateError.message);
    return { application };
  }
  if (effectiveUser && method === 'GET' && normalizedEndpoint === '/auth/profile') {
    const fallbackProfile = {
      id: effectiveUser.id,
      email: effectiveUser.email || '',
      name: effectiveUser.user_metadata?.name || effectiveUser.email?.split('@')[0] || 'User',
      user_type: (effectiveUser.user_metadata?.userType || 'seeker') as 'seeker' | 'employer',
      subscription: effectiveUser.user_metadata?.userType === 'employer' ? 'starter' : 'free',
      updated_at: new Date().toISOString(),
    };

    const { data: profile, error } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', effectiveUser.id)
      .maybeSingle();

    if (isProfilesPolicyRecursionError(error)) {
      return { profile: fallbackProfile };
    }

    if (error && error.code !== 'PGRST116') throw new Error(error.message);
    if (profile) return { profile };

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
      id: effectiveUser.id,
      email: effectiveUser.email || '',
      name: effectiveUser.user_metadata?.name || effectiveUser.email?.split('@')[0] || 'User',
      user_type: (effectiveUser.user_metadata?.userType || 'seeker') as 'seeker' | 'employer',
      subscription: effectiveUser.user_metadata?.userType === 'employer' ? 'starter' : 'free',
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
  if (effectiveUser && method === 'GET' && normalizedEndpoint === '/applications/my') {
    const { data: applications, error } = await supabase
      .from('applications')
      .select('*, job:jobs(id, title, city, province, employment_type)')
      .eq('seeker_id', effectiveUser.id)
      .order('created_at', { ascending: false });

    if (error) throw new Error(error.message);

    const normalized = (applications || []).map((app: Record<string, unknown>) => {
      const job = app.job as Record<string, unknown> | null;
      return { ...app, job_title: job?.title || '', company: '' };
    });

    return { applications: normalized };
  }
  if (effectiveUser && method === 'GET' && /^\/jobs\/[^/]+\/applications$/.test(normalizedEndpoint)) {
    const jobId = normalizedEndpoint.split('/')[2];
    if (!jobId) throw new Error('jobId is required');

    // Verify the user owns this job
    const { data: job, error: jobError } = await supabase
      .from('jobs')
      .select('employer_id')
      .eq('id', jobId)
      .maybeSingle();

    if (jobError) throw new Error(jobError.message);
    if (!job || job.employer_id !== effectiveUser.id) {
      throw new Error('Not authorized to view applications for this job');
    }

    // Fetch applications for this job
    const { data: applications, error: appError } = await supabase
      .from('applications')
      .select('id, job_id, seeker_id, cover_letter, custom_letter, status, notes, created_at, updated_at')
      .eq('job_id', jobId)
      .order('created_at', { ascending: false });

    if (appError) throw new Error(appError.message);
    if (!applications || applications.length === 0) return { applications: [] };

    // Fetch seeker profiles for all applicants
    const seekerIds = [...new Set((applications || []).map((a: Record<string, unknown>) => a.seeker_id as string))];
    const { data: profiles, error: profileError } = await supabase
      .from('profiles')
      .select('id, name, email, headline, avatar_url, skills, location, phone, summary, experience, education, social_links')
      .in('id', seekerIds);

    if (profileError) throw new Error(profileError.message);

    // Build profile map and enrich applications
    const profileMap: Record<string, Record<string, unknown>> = {};
    (profiles || []).forEach((p: Record<string, unknown>) => {
      profileMap[p.id as string] = p;
    });

    const enriched = (applications || []).map((a: Record<string, unknown>) => ({
      ...a,
      seeker: profileMap[a.seeker_id as string] || null,
    }));

    return { applications: enriched };
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

  const canSkipAuthHeader = !requireAuth && isPublicEndpoint(endpoint, method);

  if ((requireAuth || (token && token !== publicAnonKey)) && shouldRefreshToken(token)) {
    // Avoid calling .refreshSession() repeatedly on every fast api trigger and respect the gotrue locks.
    // getSession() above already tries to proactively refresh if needed and gives us a valid token.
    // If it's *still* expired here, it means we are truly out of bounds and have an invalid offline token.
    token = session?.access_token ?? accessTokenOverride;
    if (!token || shouldRefreshToken(token)) {
      await supabase.auth.signOut({ scope: 'local' }).catch(() => {});
      throw new Error('Not authenticated');
    }
  }

  if (requireAuth && !isLikelyJwt(token)) {
    await supabase.auth.signOut({ scope: 'local' }).catch(() => {});
    throw new Error('Not authenticated');
  }

  // Non-public endpoints should never be called with the anon JWT.
  // If we don't have a valid user token at this point, fail fast so callers
  // can redirect to login instead of hitting server routes with an invalid JWT.
  if (!canSkipAuthHeader && !isLikelyJwt(token)) {
    await supabase.auth.signOut({ scope: 'local' }).catch(() => {});
    throw new Error('Not authenticated');
  }

  const request = async (withAuth: boolean, overrideToken?: string) => {
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      apikey: publicAnonKey,
      ...((requestOptions.headers as Record<string, string> | undefined) || {}),
    };

    const activeToken = overrideToken ?? token ?? publicAnonKey;
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

  const withAuth = !canSkipAuthHeader && isLikelyJwt(token);
  let response = await request(withAuth);

  if (!response.ok) {
    const { message, text } = await parseErrorResponse(response);
    const authHeaderMissing = response.status === 401 && /Missing authorization header/i.test(text || message);
    const invalidJwt = response.status === 401 && /Invalid JWT/i.test(text || message);
    const shouldRetryAuth = invalidJwt || authHeaderMissing;

    if (shouldRetryAuth) {
      // Try once with the latest session token in case of token rotation races.
      const { data: { session: retrySession } } = await supabase.auth.getSession();
      const retryToken = retrySession?.access_token;
      if (isLikelyJwt(retryToken)) {
        token = retryToken;
        response = await request(true, retryToken);
        if (response.ok) return response.json();
      }

      if (!requireAuth && canSkipAuthHeader) {
        response = await request(false);
        if (response.ok) return response.json();
      }

      if (!canSkipAuthHeader) {
        await supabase.auth.signOut({ scope: 'local' }).catch(() => {});
        throw new Error('Not authenticated');
      }

      const retry = await parseErrorResponse(response);
      throw new Error(retry.message || 'Invalid JWT');
    }

    throw new Error(message);
  }

  return response.json();
}
