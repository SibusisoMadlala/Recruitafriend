import { Hono } from 'npm:hono';
import { cors } from 'npm:hono/cors';
import { logger } from 'npm:hono/logger';
import { createClient } from 'npm:@supabase/supabase-js@2';

const app = new Hono();

// Middleware
app.use('*', cors());
app.use('*', logger(console.log));

// Supabase service-role client â€” bypasses RLS (all server-side operations)
const supabaseUrl = Deno.env.get('SUPABASE_URL') || '';
const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || '';

function getDb() {
  return createClient(supabaseUrl, supabaseServiceKey);
}

// Helper to get authenticated user
async function getAuthUser(authHeader: string | null) {
  if (!authHeader) return null;
  if (!authHeader.startsWith('Bearer ')) return null;
  const token = authHeader.split(' ')[1];
  if (!token || token.split('.').length !== 3) return null;

  const db = getDb();
  const { data: { user }, error } = await db.auth.getUser(token);
  if (error || !user) return null;
  return user;
}

async function requireSeeker(authHeader: string | null) {
  const user = await getAuthUser(authHeader);
  if (!user) return { error: 'Unauthorized', code: 401 as const, user: null };

  const db = getDb();
  const { data: profile } = await db.from('profiles').select('user_type').eq('id', user.id).single();
  if (!profile || profile.user_type !== 'seeker') {
    return { error: 'Forbidden', code: 403 as const, user: null };
  }

  return { error: null, code: 200 as const, user };
}

// ============== AUTH ROUTES ==============

// Sign up â€” profile row created automatically by handle_new_user() DB trigger
app.post('/make-server-bca21fd3/auth/signup', async (c) => {
  try {
    const { email, password, name, userType } = await c.req.json();

    const db = getDb();
    const { data, error } = await db.auth.admin.createUser({
      email,
      password,
      user_metadata: { name, userType },
      email_confirm: true,
    });

    if (error) {
      console.error('Signup error:', error);
      return c.json({ error: error.message }, 400);
    }

    return c.json({ user: data.user });
  } catch (error) {
    console.error('Signup error:', error);
    return c.json({ error: 'Signup failed' }, 500);
  }
});

// Get current user profile
app.get('/make-server-bca21fd3/auth/profile', async (c) => {
  try {
    const user = await getAuthUser(c.req.header('Authorization'));
    if (!user) return c.json({ error: 'Unauthorized' }, 401);

    const db = getDb();
    const { data: profile, error } = await db
      .from('profiles')
      .select('*')
      .eq('id', user.id)
      .maybeSingle();

    if (error && error.code !== 'PGRST116') throw error;

    if (profile) return c.json({ profile });

    const fallbackProfile = {
      id: user.id,
      email: user.email || '',
      name: user.user_metadata?.name || user.email?.split('@')[0] || 'User',
      user_type: (user.user_metadata?.userType || 'seeker') as 'seeker' | 'employer',
      subscription: user.user_metadata?.userType === 'employer' ? 'starter' : 'free',
      updated_at: new Date().toISOString(),
    };

    const { data: createdProfile, error: createError } = await db
      .from('profiles')
      .upsert(fallbackProfile, { onConflict: 'id' })
      .select('*')
      .single();

    if (createError) throw createError;
    return c.json({ profile: createdProfile });
  } catch (error) {
    console.error('Get profile error:', error);
    return c.json({ error: 'Failed to get profile' }, 500);
  }
});

// Update user profile
app.put('/make-server-bca21fd3/auth/profile', async (c) => {
  try {
    const user = await getAuthUser(c.req.header('Authorization'));
    if (!user) return c.json({ error: 'Unauthorized' }, 401);

    const updates = await c.req.json();
    const db = getDb();

    const { data: existingProfile } = await db
      .from('profiles')
      .select('id, email, user_type')
      .eq('id', user.id)
      .maybeSingle();

    if (!existingProfile) {
      const { error: ensureError } = await db
        .from('profiles')
        .upsert({
          id: user.id,
          email: user.email || '',
          name: user.user_metadata?.name || user.email?.split('@')[0] || 'User',
          user_type: (user.user_metadata?.userType || 'seeker') as 'seeker' | 'employer',
          subscription: user.user_metadata?.userType === 'employer' ? 'starter' : 'free',
          updated_at: new Date().toISOString(),
        }, { onConflict: 'id' });

      if (ensureError) throw ensureError;
    }

    const { data: profile, error } = await db
      .from('profiles')
      .update({ ...updates, updated_at: new Date().toISOString() })
      .eq('id', user.id)
      .select()
      .single();

    if (error) throw error;
    return c.json({ profile });
  } catch (error) {
    console.error('Update profile error:', error);
    return c.json({ error: 'Failed to update profile' }, 500);
  }
});

// ============== JOB ROUTES ==============

// Get all jobs (with filters + pagination)
app.get('/make-server-bca21fd3/jobs', async (c) => {
  try {
    const { search, location, jobType, minSalary, maxSalary, industry } = c.req.query();
    const page = Math.max(1, parseInt(c.req.query('page') || '1'));
    const limit = Math.min(100, Math.max(1, parseInt(c.req.query('limit') || '20')));
    const offset = (page - 1) * limit;

    const db = getDb();
    let query = db
      .from('jobs')
      .select('*, employer:profiles!jobs_employer_id_fkey(id, name, avatar_url)', { count: 'exact' })
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
    if (error) throw error;

    return c.json({ jobs: jobs || [], count: jobs?.length || 0, totalCount: count || 0 });
  } catch (error) {
    console.error('Get jobs error:', error);
    return c.json({ error: 'Failed to get jobs' }, 500);
  }
});

// Get job by ID
app.get('/make-server-bca21fd3/jobs/:id', async (c) => {
  try {
    const id = c.req.param('id');
    const db = getDb();

    const { data: job, error } = await db
      .from('jobs')
      .select('*, employer:profiles!jobs_employer_id_fkey(id, name, avatar_url, location)')
      .eq('id', id)
      .single();

    if (error || !job) return c.json({ error: 'Job not found' }, 404);

    // Increment views
    await db.from('jobs').update({ views: (job.views || 0) + 1 }).eq('id', id);

    return c.json({ job });
  } catch (error) {
    console.error('Get job error:', error);
    return c.json({ error: 'Failed to get job' }, 500);
  }
});

// Create job (employer only)
app.post('/make-server-bca21fd3/jobs', async (c) => {
  try {
    const user = await getAuthUser(c.req.header('Authorization'));
    if (!user) return c.json({ error: 'Unauthorized' }, 401);

    const db = getDb();
    const { data: profile } = await db
      .from('profiles')
      .select('user_type')
      .eq('id', user.id)
      .single();

    if (profile?.user_type !== 'employer') {
      return c.json({ error: 'Only employers can post jobs' }, 403);
    }

    const jobData = await c.req.json();
    const { data: job, error } = await db
      .from('jobs')
      .insert({ ...jobData, employer_id: user.id, status: 'active', views: 0 })
      .select()
      .single();

    if (error) throw error;
    return c.json({ job });
  } catch (error) {
    console.error('Create job error:', error);
    return c.json({ error: 'Failed to create job' }, 500);
  }
});

// Update job
app.put('/make-server-bca21fd3/jobs/:id', async (c) => {
  try {
    const user = await getAuthUser(c.req.header('Authorization'));
    if (!user) return c.json({ error: 'Unauthorized' }, 401);

    const id = c.req.param('id');
    const updates = await c.req.json();
    const db = getDb();

    const { data: job, error } = await db
      .from('jobs')
      .update({ ...updates, updated_at: new Date().toISOString() })
      .eq('id', id)
      .eq('employer_id', user.id)
      .select()
      .single();

    if (error) throw error;
    if (!job) return c.json({ error: 'Job not found or not authorized' }, 404);
    return c.json({ job });
  } catch (error) {
    console.error('Update job error:', error);
    return c.json({ error: 'Failed to update job' }, 500);
  }
});

// Get employer's jobs
app.get('/make-server-bca21fd3/employer/jobs', async (c) => {
  try {
    const user = await getAuthUser(c.req.header('Authorization'));
    if (!user) return c.json({ error: 'Unauthorized' }, 401);

    const db = getDb();
    const { data: jobs, error } = await db
      .from('jobs')
      .select('*')
      .eq('employer_id', user.id)
      .order('created_at', { ascending: false });

    if (error) throw error;
    return c.json({ jobs: jobs || [] });
  } catch (error) {
    console.error('Get employer jobs error:', error);
    return c.json({ error: 'Failed to get jobs' }, 500);
  }
});

// Get employer stats
app.get('/make-server-bca21fd3/employer/stats', async (c) => {
  try {
    const user = await getAuthUser(c.req.header('Authorization'));
    if (!user) return c.json({ error: 'Unauthorized' }, 401);

    const db = getDb();

    const { count: activeListings } = await db
      .from('jobs')
      .select('*', { count: 'exact', head: true })
      .eq('employer_id', user.id)
      .eq('status', 'active');

    const { data: employerJobs } = await db
      .from('jobs')
      .select('id')
      .eq('employer_id', user.id);

    const jobIds = (employerJobs || []).map((j: { id: string }) => j.id);
    const safeIds = jobIds.length ? jobIds : ['00000000-0000-0000-0000-000000000000'];

    const { count: totalApplications } = await db
      .from('applications')
      .select('*', { count: 'exact', head: true })
      .in('job_id', safeIds);

    const { count: shortlisted } = await db
      .from('applications')
      .select('*', { count: 'exact', head: true })
      .in('job_id', safeIds)
      .eq('status', 'shortlisted');

    const todayStart = new Date(); todayStart.setHours(0, 0, 0, 0);
    const todayEnd = new Date(); todayEnd.setHours(23, 59, 59, 999);

    const { count: interviewsToday } = await db
      .from('applications')
      .select('*', { count: 'exact', head: true })
      .in('job_id', safeIds)
      .eq('status', 'interview')
      .gte('updated_at', todayStart.toISOString())
      .lte('updated_at', todayEnd.toISOString());

    return c.json({
      activeListings: activeListings || 0,
      totalApplications: totalApplications || 0,
      shortlisted: shortlisted || 0,
      interviewsToday: interviewsToday || 0,
      cvViews: 0,
    });
  } catch (error) {
    console.error('Get employer stats error:', error);
    return c.json({ error: 'Failed to get stats' }, 500);
  }
});

// ============== APPLICATION ROUTES ==============

// Apply to job
app.post('/make-server-bca21fd3/applications', async (c) => {
  try {
    const user = await getAuthUser(c.req.header('Authorization'));
    if (!user) return c.json({ error: 'Unauthorized' }, 401);

    const { jobId, coverLetter, customLetter } = await c.req.json();
    const db = getDb();

    const { data: application, error } = await db
      .from('applications')
      .insert({ job_id: jobId, seeker_id: user.id, cover_letter: coverLetter, custom_letter: customLetter, status: 'applied' })
      .select()
      .single();

    if (error) throw error;
    return c.json({ application });
  } catch (error) {
    console.error('Apply to job error:', error);
    return c.json({ error: 'Failed to apply to job' }, 500);
  }
});

// Get user's applications
app.get('/make-server-bca21fd3/applications/my', async (c) => {
  try {
    const user = await getAuthUser(c.req.header('Authorization'));
    if (!user) return c.json({ error: 'Unauthorized' }, 401);

    const db = getDb();
    const { data: applications, error } = await db
      .from('applications')
      .select('*, job:jobs(id, title, city, province, employment_type, employer:profiles!jobs_employer_id_fkey(name, avatar_url))')
      .eq('seeker_id', user.id)
      .order('created_at', { ascending: false });

    if (error) throw error;

    const normalized = (applications || []).map((app: Record<string, unknown>) => {
      const job = app.job as Record<string, unknown> | null;
      const employer = (job?.employer as Record<string, unknown> | null);
      return { ...app, job_title: job?.title || '', company: employer?.name || '' };
    });

    return c.json({ applications: normalized });
  } catch (error) {
    console.error('Get applications error:', error);
    return c.json({ error: 'Failed to get applications' }, 500);
  }
});

// Get applications for a job (employer)
app.get('/make-server-bca21fd3/jobs/:jobId/applications', async (c) => {
  try {
    const user = await getAuthUser(c.req.header('Authorization'));
    if (!user) return c.json({ error: 'Unauthorized' }, 401);

    const jobId = c.req.param('jobId');
    const db = getDb();

    const { data: job } = await db.from('jobs').select('employer_id').eq('id', jobId).single();
    if (!job || job.employer_id !== user.id) return c.json({ error: 'Not authorized' }, 403);

    // Step 1: fetch applications (no join — avoid FK hint ambiguity)
    const { data: applications, error } = await db
      .from('applications')
      .select('id, job_id, seeker_id, cover_letter, custom_letter, status, notes, created_at, updated_at')
      .eq('job_id', jobId)
      .order('created_at', { ascending: false });

    if (error) throw error;
    if (!applications || applications.length === 0) return c.json({ applications: [] });

    // Step 2: fetch seeker profiles for all applicants in one query
    const seekerIds = [...new Set(applications.map((a: any) => a.seeker_id))];
    console.log('Fetching profiles for seekerIds:', seekerIds);

    const { data: profiles, error: profilesErr } = await db
      .from('profiles')
      .select('id, name, email, headline, avatar_url, skills, location, phone, summary, experience, education, social_links')
      .in('id', seekerIds);

    if (profilesErr) {
      console.error('Error fetching profiles:', profilesErr);
      throw profilesErr;
    }

    console.log('Fetched profiles count:', (profiles || []).length);

    const profileMap: Record<string, any> = {};
    (profiles || []).forEach((p: any) => { profileMap[p.id] = p; });
    
    console.log('ProfileMap keys:', Object.keys(profileMap));

    // Enrich applications with seeker profiles; fallback to minimal profile if missing
    const enriched = applications.map((a: any) => {
      let seeker = profileMap[a.seeker_id];
      
      if (!seeker) {
        console.warn(`Seeker profile missing for ID ${a.seeker_id}, will be fetched separately by client`);
      }
      
      return {
        ...a,
        seeker: seeker || null,
      };
    });

    return c.json({ applications: enriched });
  } catch (error) {
    console.error('Get job applications error:', error);
    return c.json({ error: 'Failed to get applications' }, 500);
  }
});

// Get a seeker's profile by ID (employer use — to populate applicant profile dialog)
app.get('/make-server-bca21fd3/employer/seeker/:seekerId', async (c) => {
  try {
    const user = await getAuthUser(c.req.header('Authorization'));
    if (!user) return c.json({ error: 'Unauthorized' }, 401);

    const seekerId = c.req.param('seekerId');
    const db = getDb();

    // Verify caller is an employer
    const { data: callerProfile } = await db.from('profiles').select('user_type').eq('id', user.id).single();
    if (!callerProfile || callerProfile.user_type !== 'employer') {
      return c.json({ error: 'Not authorized' }, 403);
    }

    const { data: profile, error } = await db
      .from('profiles')
      .select('id, name, email, headline, avatar_url, skills, location, phone, summary, experience, education, social_links')
      .eq('id', seekerId)
      .single();

    if (error || !profile) return c.json({ error: 'Profile not found' }, 404);
    return c.json({ profile });
  } catch (error) {
    console.error('Get seeker profile error:', error);
    return c.json({ error: 'Failed to get seeker profile' }, 500);
  }
});

// Update application status
app.put('/make-server-bca21fd3/applications/:id', async (c) => {
  try {
    const user = await getAuthUser(c.req.header('Authorization'));
    if (!user) return c.json({ error: 'Unauthorized' }, 401);

    const id = c.req.param('id');
    const { status, notes } = await c.req.json();
    const db = getDb();

    const { data: appRecord } = await db.from('applications').select('job_id, seeker_id, status').eq('id', id).single();
    if (!appRecord) return c.json({ error: 'Application not found' }, 404);

    const { data: job } = await db.from('jobs').select('employer_id').eq('id', appRecord.job_id).single();

    const isEmployer = !!job && job.employer_id === user.id;
    const isSeekerOwner = appRecord.seeker_id === user.id;

    if (!isEmployer && !isSeekerOwner) return c.json({ error: 'Not authorized' }, 403);

    if (isSeekerOwner && status !== 'rejected') {
      return c.json({ error: 'Seekers can only withdraw applications' }, 403);
    }

    const { data: application, error } = await db
      .from('applications')
      .update({ status, notes, updated_at: new Date().toISOString() })
      .eq('id', id)
      .select()
      .single();

    if (error) throw error;
    return c.json({ application });
  } catch (error) {
    console.error('Update application error:', error);
    return c.json({ error: 'Failed to update application' }, 500);
  }
});

// ============== REFERRAL ROUTES (stub â€” future migration) ==============

app.post('/make-server-bca21fd3/referrals', async (c) => {
  try {
    const auth = await requireSeeker(c.req.header('Authorization'));
    if (!auth.user) return c.json({ error: auth.error }, auth.code);

    const { refereeEmail } = await c.req.json();
    const db = getDb();

    const { data: referral, error } = await db
      .from('referrals')
      .insert({ referrer_id: auth.user.id, referee_email: refereeEmail || null, status: 'invited', payout: 0 })
      .select()
      .single();

    if (error) throw error;
    return c.json({ referral });
  } catch (error) {
    console.error('Create referral error:', error);
    return c.json({ error: 'Failed to create referral' }, 500);
  }
});

app.get('/make-server-bca21fd3/referrals/my', async (c) => {
  try {
    const auth = await requireSeeker(c.req.header('Authorization'));
    if (!auth.user) return c.json({ error: auth.error }, auth.code);

    const db = getDb();
    const { data: referrals, error } = await db
      .from('referrals')
      .select('*')
      .eq('referrer_id', auth.user.id)
      .order('created_at', { ascending: false });

    if (error) throw error;

    const rows = referrals || [];
    const total = rows.reduce((sum: number, r: Record<string, unknown>) => sum + Number(r.payout || 0), 0);
    const pending = rows
      .filter((r: Record<string, unknown>) => r.status !== 'hired')
      .reduce((sum: number, r: Record<string, unknown>) => sum + Number(r.payout || 0), 0);
    const available = Math.max(0, total - pending);

    return c.json({
      referralLink: `https://recruitfriend.co.za/ref/${auth.user.id.slice(0, 8)}`,
      referrals: rows,
      stats: { active: rows.filter((r: Record<string, unknown>) => r.status !== 'hired').length },
      earnings: { total, pending, available },
    });
  } catch (error) {
    console.error('Get referrals error:', error);
    return c.json({ error: 'Failed to get referrals' }, 500);
  }
});

// ============== ALERTS ==============

app.get('/make-server-bca21fd3/alerts', async (c) => {
  try {
    const auth = await requireSeeker(c.req.header('Authorization'));
    if (!auth.user) return c.json({ error: auth.error }, auth.code);

    const db = getDb();
    const { data: alerts, error } = await db
      .from('job_alerts')
      .select('*')
      .eq('seeker_id', auth.user.id)
      .order('created_at', { ascending: false });

    if (error) throw error;
    return c.json({ alerts: alerts || [] });
  } catch (error) {
    console.error('Get alerts error:', error);
    return c.json({ error: 'Failed to get alerts' }, 500);
  }
});

app.post('/make-server-bca21fd3/alerts', async (c) => {
  try {
    const auth = await requireSeeker(c.req.header('Authorization'));
    if (!auth.user) return c.json({ error: auth.error }, auth.code);

    const { keywords, location, minSalary, frequency, types, active } = await c.req.json();
    if (!keywords || typeof keywords !== 'string' || !keywords.trim()) {
      return c.json({ error: 'Keywords are required' }, 400);
    }

    const db = getDb();
    const { data: alert, error } = await db
      .from('job_alerts')
      .insert({
        seeker_id: auth.user.id,
        keywords: keywords.trim(),
        location: location || null,
        min_salary: minSalary || null,
        frequency: (frequency || 'daily').toLowerCase(),
        types: Array.isArray(types) ? types : [],
        active: active ?? true,
      })
      .select()
      .single();

    if (error) throw error;
    return c.json({ alert });
  } catch (error) {
    console.error('Create alert error:', error);
    return c.json({ error: 'Failed to create alert' }, 500);
  }
});

app.put('/make-server-bca21fd3/alerts/:id', async (c) => {
  try {
    const auth = await requireSeeker(c.req.header('Authorization'));
    if (!auth.user) return c.json({ error: auth.error }, auth.code);

    const id = c.req.param('id');
    const { keywords, location, minSalary, frequency, types, active } = await c.req.json();
    const payload: Record<string, unknown> = { updated_at: new Date().toISOString() };

    if (keywords !== undefined) payload.keywords = String(keywords).trim();
    if (location !== undefined) payload.location = location || null;
    if (minSalary !== undefined) payload.min_salary = minSalary || null;
    if (frequency !== undefined) payload.frequency = String(frequency).toLowerCase();
    if (types !== undefined) payload.types = Array.isArray(types) ? types : [];
    if (active !== undefined) payload.active = !!active;

    const db = getDb();
    const { data: alert, error } = await db
      .from('job_alerts')
      .update(payload)
      .eq('id', id)
      .eq('seeker_id', auth.user.id)
      .select()
      .single();

    if (error) throw error;
    return c.json({ alert });
  } catch (error) {
    console.error('Update alert error:', error);
    return c.json({ error: 'Failed to update alert' }, 500);
  }
});

app.delete('/make-server-bca21fd3/alerts/:id', async (c) => {
  try {
    const auth = await requireSeeker(c.req.header('Authorization'));
    if (!auth.user) return c.json({ error: auth.error }, auth.code);

    const id = c.req.param('id');
    const db = getDb();
    const { error } = await db.from('job_alerts').delete().eq('id', id).eq('seeker_id', auth.user.id);
    if (error) throw error;

    return c.json({ success: true });
  } catch (error) {
    console.error('Delete alert error:', error);
    return c.json({ error: 'Failed to delete alert' }, 500);
  }
});

// ============== CV SETTINGS & FILES ==============

app.get('/make-server-bca21fd3/cv/settings', async (c) => {
  try {
    const auth = await requireSeeker(c.req.header('Authorization'));
    if (!auth.user) return c.json({ error: auth.error }, auth.code);

    const db = getDb();
    const { data, error } = await db.from('cv_settings').select('*').eq('seeker_id', auth.user.id).single();
    if (error && error.code !== 'PGRST116') throw error;

    return c.json({ settings: data || { template: 'classic', visibility: true, last_synced_at: null } });
  } catch (error) {
    console.error('Get cv settings error:', error);
    return c.json({ error: 'Failed to get CV settings' }, 500);
  }
});

app.put('/make-server-bca21fd3/cv/settings', async (c) => {
  try {
    const auth = await requireSeeker(c.req.header('Authorization'));
    if (!auth.user) return c.json({ error: auth.error }, auth.code);

    const { template, visibility } = await c.req.json();
    const db = getDb();
    const { data, error } = await db
      .from('cv_settings')
      .upsert({
        seeker_id: auth.user.id,
        template: template || 'classic',
        visibility: visibility ?? true,
        updated_at: new Date().toISOString(),
      }, { onConflict: 'seeker_id' })
      .select()
      .single();

    if (error) throw error;
    return c.json({ settings: data });
  } catch (error) {
    console.error('Update cv settings error:', error);
    return c.json({ error: 'Failed to update CV settings' }, 500);
  }
});

app.post('/make-server-bca21fd3/cv/settings/sync', async (c) => {
  try {
    const auth = await requireSeeker(c.req.header('Authorization'));
    if (!auth.user) return c.json({ error: auth.error }, auth.code);

    const now = new Date().toISOString();
    const db = getDb();
    const { data, error } = await db
      .from('cv_settings')
      .upsert({
        seeker_id: auth.user.id,
        last_synced_at: now,
        updated_at: now,
      }, { onConflict: 'seeker_id' })
      .select()
      .single();

    if (error) throw error;
    return c.json({ synced: true, settings: data });
  } catch (error) {
    console.error('Sync cv settings error:', error);
    return c.json({ error: 'Failed to sync CV settings' }, 500);
  }
});

app.get('/make-server-bca21fd3/cv/files', async (c) => {
  try {
    const auth = await requireSeeker(c.req.header('Authorization'));
    if (!auth.user) return c.json({ error: auth.error }, auth.code);

    const db = getDb();
    const { data, error } = await db
      .from('cv_files')
      .select('*')
      .eq('seeker_id', auth.user.id)
      .order('updated_at', { ascending: false });

    if (error) throw error;
    return c.json({ files: data || [] });
  } catch (error) {
    console.error('Get cv files error:', error);
    return c.json({ error: 'Failed to get CV files' }, 500);
  }
});

app.post('/make-server-bca21fd3/cv/files', async (c) => {
  try {
    const auth = await requireSeeker(c.req.header('Authorization'));
    if (!auth.user) return c.json({ error: auth.error }, auth.code);

    const { fileName, size } = await c.req.json();
    if (!fileName || typeof fileName !== 'string') {
      return c.json({ error: 'fileName is required' }, 400);
    }

    const db = getDb();
    const { data, error } = await db
      .from('cv_files')
      .insert({ seeker_id: auth.user.id, file_name: fileName, file_size: Number(size) || 0 })
      .select()
      .single();

    if (error) throw error;
    return c.json({ file: data });
  } catch (error) {
    console.error('Create cv file error:', error);
    return c.json({ error: 'Failed to create CV file' }, 500);
  }
});

app.put('/make-server-bca21fd3/cv/files/:id', async (c) => {
  try {
    const auth = await requireSeeker(c.req.header('Authorization'));
    if (!auth.user) return c.json({ error: auth.error }, auth.code);

    const id = c.req.param('id');
    const { fileName, size } = await c.req.json();
    const db = getDb();
    const { data, error } = await db
      .from('cv_files')
      .update({
        file_name: fileName,
        file_size: Number(size) || 0,
        updated_at: new Date().toISOString(),
      })
      .eq('id', id)
      .eq('seeker_id', auth.user.id)
      .select()
      .single();

    if (error) throw error;
    return c.json({ file: data });
  } catch (error) {
    console.error('Update cv file error:', error);
    return c.json({ error: 'Failed to update CV file' }, 500);
  }
});

app.delete('/make-server-bca21fd3/cv/files/:id', async (c) => {
  try {
    const auth = await requireSeeker(c.req.header('Authorization'));
    if (!auth.user) return c.json({ error: auth.error }, auth.code);

    const id = c.req.param('id');
    const db = getDb();
    const { error } = await db
      .from('cv_files')
      .delete()
      .eq('id', id)
      .eq('seeker_id', auth.user.id);

    if (error) throw error;
    return c.json({ success: true });
  } catch (error) {
    console.error('Delete cv file error:', error);
    return c.json({ error: 'Failed to delete CV file' }, 500);
  }
});

// ============== SUBSCRIPTIONS ==============

app.post('/make-server-bca21fd3/subscriptions/change', async (c) => {
  try {
    const auth = await requireSeeker(c.req.header('Authorization'));
    if (!auth.user) return c.json({ error: auth.error }, auth.code);

    const { plan } = await c.req.json();
    const allowed = ['free', 'premium', 'professional'];
    const normalizedPlan = String(plan || '').toLowerCase();

    if (!allowed.includes(normalizedPlan)) {
      return c.json({ error: 'Invalid plan' }, 400);
    }

    const db = getDb();
    const { data: profile, error } = await db
      .from('profiles')
      .update({ subscription: normalizedPlan, updated_at: new Date().toISOString() })
      .eq('id', auth.user.id)
      .select('subscription')
      .single();

    if (error) throw error;
    return c.json({ subscription: profile.subscription, effectiveAt: new Date().toISOString() });
  } catch (error) {
    console.error('Change subscription error:', error);
    return c.json({ error: 'Failed to change subscription' }, 500);
  }
});

app.post('/make-server-bca21fd3/subscriptions/trial', async (c) => {
  try {
    const auth = await requireSeeker(c.req.header('Authorization'));
    if (!auth.user) return c.json({ error: auth.error }, auth.code);

    const trialEndsAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();
    const db = getDb();
    const { data: profile, error } = await db
      .from('profiles')
      .update({ subscription: 'premium_trial', updated_at: new Date().toISOString() })
      .eq('id', auth.user.id)
      .select('subscription')
      .single();

    if (error) throw error;
    return c.json({ subscription: profile.subscription, trialEndsAt });
  } catch (error) {
    console.error('Start subscription trial error:', error);
    return c.json({ error: 'Failed to start trial' }, 500);
  }
});

// ============== SAVED JOBS ==============

// Save job
app.post('/make-server-bca21fd3/saved-jobs', async (c) => {
  try {
    const user = await getAuthUser(c.req.header('Authorization'));
    if (!user) return c.json({ error: 'Unauthorized' }, 401);

    const { jobId } = await c.req.json();
    const db = getDb();

    const { error } = await db.from('saved_jobs').insert({ seeker_id: user.id, job_id: jobId });
    if (error) throw error;
    return c.json({ success: true });
  } catch (error) {
    console.error('Save job error:', error);
    return c.json({ error: 'Failed to save job' }, 500);
  }
});

// Get saved jobs
app.get('/make-server-bca21fd3/saved-jobs', async (c) => {
  try {
    const user = await getAuthUser(c.req.header('Authorization'));
    if (!user) return c.json({ error: 'Unauthorized' }, 401);

    const db = getDb();
    const { data, error } = await db
      .from('saved_jobs')
      .select('*, job:jobs(*)')
      .eq('seeker_id', user.id)
      .order('created_at', { ascending: false });

    if (error) throw error;
    const jobs = (data || []).map((s: Record<string, unknown>) => s.job).filter(Boolean);
    return c.json({ jobs });
  } catch (error) {
    console.error('Get saved jobs error:', error);
    return c.json({ error: 'Failed to get saved jobs' }, 500);
  }
});

// Get saved jobs count
app.get('/make-server-bca21fd3/saved-jobs/count', async (c) => {
  try {
    const user = await getAuthUser(c.req.header('Authorization'));
    if (!user) return c.json({ error: 'Unauthorized' }, 401);

    const db = getDb();
    const { count, error } = await db
      .from('saved_jobs')
      .select('*', { count: 'exact', head: true })
      .eq('seeker_id', user.id);

    if (error) throw error;
    return c.json({ count: count || 0 });
  } catch (error) {
    console.error('Get saved jobs count error:', error);
    return c.json({ error: 'Failed to get count' }, 500);
  }
});

// Delete saved job
app.delete('/make-server-bca21fd3/saved-jobs/:jobId', async (c) => {
  try {
    const user = await getAuthUser(c.req.header('Authorization'));
    if (!user) return c.json({ error: 'Unauthorized' }, 401);

    const jobId = c.req.param('jobId');
    const db = getDb();

    const { error } = await db.from('saved_jobs').delete().eq('seeker_id', user.id).eq('job_id', jobId);
    if (error) throw error;
    return c.json({ success: true });
  } catch (error) {
    console.error('Delete saved job error:', error);
    return c.json({ error: 'Failed to delete saved job' }, 500);
  }
});

// ============== PROFILE VIEWS (stub) ==============

app.get('/make-server-bca21fd3/profile/views', async (c) => {
  const user = await getAuthUser(c.req.header('Authorization'));
  if (!user) return c.json({ error: 'Unauthorized' }, 401);
  return c.json({ views: 0 });
});

// ============== PLATFORM STATS ==============

app.get('/make-server-bca21fd3/stats', async (c) => {
  try {
    const db = getDb();

    const [
      { count: activeJobs },
      { count: seekers },
      { count: employers },
      { count: totalApplications },
    ] = await Promise.all([
      db.from('jobs').select('*', { count: 'exact', head: true }).eq('status', 'active'),
      db.from('profiles').select('*', { count: 'exact', head: true }).eq('user_type', 'seeker'),
      db.from('profiles').select('*', { count: 'exact', head: true }).eq('user_type', 'employer'),
      db.from('applications').select('*', { count: 'exact', head: true }),
    ]);

    return c.json({
      activeJobs: activeJobs || 0,
      seekers: seekers || 0,
      employers: employers || 0,
      companies: employers || 0,
      totalApplications: totalApplications || 0,
    });
  } catch (error) {
    console.error('Get stats error:', error);
    return c.json({ error: 'Failed to get stats' }, 500);
  }
});

console.log('RecruitFriend server starting...');
Deno.serve(app.fetch);

