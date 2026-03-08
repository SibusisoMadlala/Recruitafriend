import { Hono } from 'npm:hono';
import { cors } from 'npm:hono/cors';
import { logger } from 'npm:hono/logger';
import { createClient } from 'npm:@supabase/supabase-js@2';
import * as kv from './kv_store.tsx';

const app = new Hono();

// Middleware
app.use('*', cors());
app.use('*', logger(console.log));

// Supabase clients
const supabaseUrl = Deno.env.get('SUPABASE_URL') || '';
const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || '';
const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY') || '';

// Helper to get authenticated user
async function getAuthUser(authHeader: string | null) {
  if (!authHeader) return null;
  const token = authHeader.split(' ')[1];
  const supabase = createClient(supabaseUrl, supabaseServiceKey);
  const { data: { user }, error } = await supabase.auth.getUser(token);
  if (error || !user) return null;
  return user;
}

// ============== AUTH ROUTES ==============

// Sign up
app.post('/make-server-bca21fd3/auth/signup', async (c) => {
  try {
    const { email, password, name, userType } = await c.req.json();
    
    const supabase = createClient(supabaseUrl, supabaseServiceKey);
    const { data, error } = await supabase.auth.admin.createUser({
      email,
      password,
      user_metadata: { name, userType },
      // Automatically confirm the user's email since an email server hasn't been configured
      email_confirm: true
    });
    
    if (error) {
      console.error('Signup error:', error);
      return c.json({ error: error.message }, 400);
    }
    
    // Create user profile in KV store
    await kv.set(`user:${data.user.id}`, {
      id: data.user.id,
      email,
      name,
      userType,
      createdAt: new Date().toISOString(),
      subscription: userType === 'seeker' ? 'FREE' : 'STARTER'
    });
    
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
    if (!user) {
      return c.json({ error: 'Unauthorized' }, 401);
    }
    
    const profile = await kv.get(`user:${user.id}`);
    return c.json({ profile });
  } catch (error) {
    console.error('Get profile error:', error);
    return c.json({ error: 'Failed to get profile' }, 500);
  }
});

// Update user profile
app.put('/make-server-bca21fd3/auth/profile', async (c) => {
  try {
    const user = await getAuthUser(c.req.header('Authorization'));
    if (!user) {
      return c.json({ error: 'Unauthorized' }, 401);
    }
    
    const updates = await c.req.json();
    const currentProfile = await kv.get(`user:${user.id}`);
    
    const updatedProfile = {
      ...currentProfile,
      ...updates,
      id: user.id,
      updatedAt: new Date().toISOString()
    };
    
    await kv.set(`user:${user.id}`, updatedProfile);
    return c.json({ profile: updatedProfile });
  } catch (error) {
    console.error('Update profile error:', error);
    return c.json({ error: 'Failed to update profile' }, 500);
  }
});

// ============== JOB ROUTES ==============

// Get all jobs (with filters)
app.get('/make-server-bca21fd3/jobs', async (c) => {
  try {
    const { search, location, jobType, minSalary, maxSalary, industry } = c.req.query();
    
    const allJobs = await kv.getByPrefix('job:');
    let jobs = allJobs.filter(job => job.status === 'active');
    
    // Apply filters
    if (search) {
      const searchLower = search.toLowerCase();
      jobs = jobs.filter(job => 
        job.title?.toLowerCase().includes(searchLower) ||
        job.description?.toLowerCase().includes(searchLower)
      );
    }
    
    if (location) {
      jobs = jobs.filter(job => job.location?.toLowerCase().includes(location.toLowerCase()));
    }
    
    if (jobType) {
      jobs = jobs.filter(job => job.jobType === jobType);
    }
    
    if (industry) {
      jobs = jobs.filter(job => job.industry === industry);
    }
    
    if (minSalary) {
      jobs = jobs.filter(job => job.salaryMax >= parseInt(minSalary));
    }
    
    if (maxSalary) {
      jobs = jobs.filter(job => job.salaryMin <= parseInt(maxSalary));
    }
    
    // Sort by date (newest first)
    jobs.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
    
    return c.json({ jobs, count: jobs.length });
  } catch (error) {
    console.error('Get jobs error:', error);
    return c.json({ error: 'Failed to get jobs' }, 500);
  }
});

// Get job by ID
app.get('/make-server-bca21fd3/jobs/:id', async (c) => {
  try {
    const id = c.req.param('id');
    const job = await kv.get(`job:${id}`);
    
    if (!job) {
      return c.json({ error: 'Job not found' }, 404);
    }
    
    // Increment views
    job.views = (job.views || 0) + 1;
    await kv.set(`job:${id}`, job);
    
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
    if (!user) {
      return c.json({ error: 'Unauthorized' }, 401);
    }
    
    const profile = await kv.get(`user:${user.id}`);
    if (profile.userType !== 'employer') {
      return c.json({ error: 'Only employers can post jobs' }, 403);
    }
    
    const jobData = await c.req.json();
    const jobId = crypto.randomUUID();
    
    const job = {
      ...jobData,
      id: jobId,
      employerId: user.id,
      status: 'active',
      views: 0,
      applications: 0,
      createdAt: new Date().toISOString()
    };
    
    await kv.set(`job:${jobId}`, job);
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
    if (!user) {
      return c.json({ error: 'Unauthorized' }, 401);
    }
    
    const id = c.req.param('id');
    const job = await kv.get(`job:${id}`);
    
    if (!job) {
      return c.json({ error: 'Job not found' }, 404);
    }
    
    if (job.employerId !== user.id) {
      return c.json({ error: 'Not authorized to update this job' }, 403);
    }
    
    const updates = await c.req.json();
    const updatedJob = {
      ...job,
      ...updates,
      updatedAt: new Date().toISOString()
    };
    
    await kv.set(`job:${id}`, updatedJob);
    return c.json({ job: updatedJob });
  } catch (error) {
    console.error('Update job error:', error);
    return c.json({ error: 'Failed to update job' }, 500);
  }
});

// Get employer's jobs
app.get('/make-server-bca21fd3/employer/jobs', async (c) => {
  try {
    const user = await getAuthUser(c.req.header('Authorization'));
    if (!user) {
      return c.json({ error: 'Unauthorized' }, 401);
    }
    
    const allJobs = await kv.getByPrefix('job:');
    const jobs = allJobs.filter(job => job.employerId === user.id);
    
    return c.json({ jobs });
  } catch (error) {
    console.error('Get employer jobs error:', error);
    return c.json({ error: 'Failed to get jobs' }, 500);
  }
});

// ============== APPLICATION ROUTES ==============

// Apply to job
app.post('/make-server-bca21fd3/applications', async (c) => {
  try {
    const user = await getAuthUser(c.req.header('Authorization'));
    if (!user) {
      return c.json({ error: 'Unauthorized' }, 401);
    }
    
    const { jobId, coverLetter, customLetter } = await c.req.json();
    const applicationId = crypto.randomUUID();
    
    const application = {
      id: applicationId,
      jobId,
      seekerId: user.id,
      coverLetter,
      customLetter,
      status: 'applied',
      createdAt: new Date().toISOString()
    };
    
    await kv.set(`application:${applicationId}`, application);
    
    // Update job application count
    const job = await kv.get(`job:${jobId}`);
    if (job) {
      job.applications = (job.applications || 0) + 1;
      await kv.set(`job:${jobId}`, job);
    }
    
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
    if (!user) {
      return c.json({ error: 'Unauthorized' }, 401);
    }
    
    const allApplications = await kv.getByPrefix('application:');
    const applications = allApplications.filter(app => app.seekerId === user.id);
    
    // Fetch job details for each application
    const applicationsWithJobs = await Promise.all(
      applications.map(async (app) => {
        const job = await kv.get(`job:${app.jobId}`);
        return { ...app, job };
      })
    );
    
    return c.json({ applications: applicationsWithJobs });
  } catch (error) {
    console.error('Get applications error:', error);
    return c.json({ error: 'Failed to get applications' }, 500);
  }
});

// Get applications for a job (employer)
app.get('/make-server-bca21fd3/jobs/:jobId/applications', async (c) => {
  try {
    const user = await getAuthUser(c.req.header('Authorization'));
    if (!user) {
      return c.json({ error: 'Unauthorized' }, 401);
    }
    
    const jobId = c.req.param('jobId');
    const job = await kv.get(`job:${jobId}`);
    
    if (!job || job.employerId !== user.id) {
      return c.json({ error: 'Not authorized' }, 403);
    }
    
    const allApplications = await kv.getByPrefix('application:');
    const applications = allApplications.filter(app => app.jobId === jobId);
    
    // Fetch seeker details
    const applicationsWithSeekers = await Promise.all(
      applications.map(async (app) => {
        const seeker = await kv.get(`user:${app.seekerId}`);
        return { ...app, seeker };
      })
    );
    
    return c.json({ applications: applicationsWithSeekers });
  } catch (error) {
    console.error('Get job applications error:', error);
    return c.json({ error: 'Failed to get applications' }, 500);
  }
});

// Update application status
app.put('/make-server-bca21fd3/applications/:id', async (c) => {
  try {
    const user = await getAuthUser(c.req.header('Authorization'));
    if (!user) {
      return c.json({ error: 'Unauthorized' }, 401);
    }
    
    const id = c.req.param('id');
    const application = await kv.get(`application:${id}`);
    
    if (!application) {
      return c.json({ error: 'Application not found' }, 404);
    }
    
    const job = await kv.get(`job:${application.jobId}`);
    if (job.employerId !== user.id) {
      return c.json({ error: 'Not authorized' }, 403);
    }
    
    const { status, notes } = await c.req.json();
    const updatedApplication = {
      ...application,
      status,
      notes,
      updatedAt: new Date().toISOString()
    };
    
    await kv.set(`application:${id}`, updatedApplication);
    return c.json({ application: updatedApplication });
  } catch (error) {
    console.error('Update application error:', error);
    return c.json({ error: 'Failed to update application' }, 500);
  }
});

// ============== REFERRAL ROUTES ==============

// Create referral
app.post('/make-server-bca21fd3/referrals', async (c) => {
  try {
    const user = await getAuthUser(c.req.header('Authorization'));
    if (!user) {
      return c.json({ error: 'Unauthorized' }, 401);
    }
    
    const { referredEmail, referredName } = await c.req.json();
    const referralId = crypto.randomUUID();
    
    const referral = {
      id: referralId,
      referrerId: user.id,
      referredEmail,
      referredName,
      status: 'pending',
      reward: 0,
      createdAt: new Date().toISOString()
    };
    
    await kv.set(`referral:${referralId}`, referral);
    return c.json({ referral });
  } catch (error) {
    console.error('Create referral error:', error);
    return c.json({ error: 'Failed to create referral' }, 500);
  }
});

// Get user's referrals
app.get('/make-server-bca21fd3/referrals/my', async (c) => {
  try {
    const user = await getAuthUser(c.req.header('Authorization'));
    if (!user) {
      return c.json({ error: 'Unauthorized' }, 401);
    }
    
    const allReferrals = await kv.getByPrefix('referral:');
    const referrals = allReferrals.filter(ref => ref.referrerId === user.id);
    
    const totalEarned = referrals.reduce((sum, ref) => sum + (ref.reward || 0), 0);
    const pending = referrals.filter(ref => ref.status === 'pending').reduce((sum, ref) => sum + (ref.reward || 0), 0);
    const available = referrals.filter(ref => ref.status === 'completed').reduce((sum, ref) => sum + (ref.reward || 0), 0);
    
    return c.json({ 
      referrals,
      earnings: {
        total: totalEarned,
        pending,
        available
      }
    });
  } catch (error) {
    console.error('Get referrals error:', error);
    return c.json({ error: 'Failed to get referrals' }, 500);
  }
});

// ============== SAVED JOBS ==============

// Save job
app.post('/make-server-bca21fd3/saved-jobs', async (c) => {
  try {
    const user = await getAuthUser(c.req.header('Authorization'));
    if (!user) {
      return c.json({ error: 'Unauthorized' }, 401);
    }
    
    const { jobId } = await c.req.json();
    const savedId = `saved:${user.id}:${jobId}`;
    
    await kv.set(savedId, {
      userId: user.id,
      jobId,
      createdAt: new Date().toISOString()
    });
    
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
    if (!user) {
      return c.json({ error: 'Unauthorized' }, 401);
    }
    
    const saved = await kv.getByPrefix(`saved:${user.id}:`);
    const jobs = await Promise.all(
      saved.map(async (s) => await kv.get(`job:${s.jobId}`))
    );
    
    return c.json({ jobs: jobs.filter(Boolean) });
  } catch (error) {
    console.error('Get saved jobs error:', error);
    return c.json({ error: 'Failed to get saved jobs' }, 500);
  }
});

// Delete saved job
app.delete('/make-server-bca21fd3/saved-jobs/:jobId', async (c) => {
  try {
    const user = await getAuthUser(c.req.header('Authorization'));
    if (!user) {
      return c.json({ error: 'Unauthorized' }, 401);
    }
    
    const jobId = c.req.param('jobId');
    await kv.del(`saved:${user.id}:${jobId}`);
    
    return c.json({ success: true });
  } catch (error) {
    console.error('Delete saved job error:', error);
    return c.json({ error: 'Failed to delete saved job' }, 500);
  }
});

// ============== STATS ==============

// Get platform stats
app.get('/make-server-bca21fd3/stats', async (c) => {
  try {
    const jobs = await kv.getByPrefix('job:');
    const users = await kv.getByPrefix('user:');
    const applications = await kv.getByPrefix('application:');
    
    const activeJobs = jobs.filter(job => job.status === 'active').length;
    const seekers = users.filter(user => user.userType === 'seeker').length;
    const employers = users.filter(user => user.userType === 'employer').length;
    
    return c.json({
      activeJobs,
      seekers,
      employers,
      companies: employers,
      totalApplications: applications.length
    });
  } catch (error) {
    console.error('Get stats error:', error);
    return c.json({ error: 'Failed to get stats' }, 500);
  }
});

console.log('RecruitFriend server starting...');
Deno.serve(app.fetch);
