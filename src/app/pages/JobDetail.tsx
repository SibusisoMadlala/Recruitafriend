import { useState, useEffect } from 'react';
import { useParams, Link, useNavigate } from 'react-router';
import { useAuth } from '../context/useAuth';
import { apiCall } from '../lib/supabase';
import { resolveHideWebsite } from '../lib/companyDisplay';
import { toast } from 'sonner';
import {
  MapPin, DollarSign, Briefcase, Calendar, Clock, Building2,
  Share2, Flag, CheckCircle, Heart, Loader2, Globe
} from 'lucide-react';

export default function JobDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { user, profile, loading: authLoading } = useAuth();
  const [job, setJob] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [applying, setApplying] = useState(false);
  const [togglingSave, setTogglingSave] = useState(false);
  const [isSaved, setIsSaved] = useState(false);
  const [activeTab, setActiveTab] = useState('overview');
  const [coverLetter, setCoverLetter] = useState('');
  const [screeningAnswers, setScreeningAnswers] = useState<Record<string, string>>({});

  const toDisplayLabel = (value: unknown, fallback = 'Not specified') => {
    const normalized = String(value || '').trim();
    if (!normalized) return fallback;
    return normalized
      .replace(/[_-]+/g, ' ')
      .replace(/\s+/g, ' ')
      .replace(/\b\w/g, (char) => char.toUpperCase());
  };

  const normalizeUrl = (value: unknown) => {
    const raw = String(value || '').trim();
    if (!raw) return '';
    return /^https?:\/\//i.test(raw) ? raw : `https://${raw}`;
  };

  useEffect(() => {
    loadJob();
  }, [id]);

  useEffect(() => {
    if (!id || !user) {
      setIsSaved(false);
      return;
    }

    loadSavedState();
  }, [id, user]);

  async function loadJob() {
    try {
      const { job: fetchedJob } = await apiCall(`/jobs/${id}`);
      setJob(fetchedJob);
    } catch (error) {
      console.error('Error loading job:', error);
      toast.error('Failed to load job details');
    } finally {
      setLoading(false);
    }
  }

  async function loadSavedState() {
    try {
      const { jobs: savedJobs } = await apiCall('/saved-jobs', { requireAuth: true });
      const savedIds = new Set(
        ((savedJobs || []) as Array<{ id?: string }>).map((savedJob) => String(savedJob.id || ''))
      );
      setIsSaved(savedIds.has(String(id)));
    } catch {
      setIsSaved(false);
    }
  }

  const isSeeker = !authLoading && !!user && !!(profile?.userType === 'seeker' || (profile as any)?.user_type === 'seeker');

  async function handleToggleSave() {
    if (!id) return;
    setTogglingSave(true);
    try {
      if (isSaved) {
        await apiCall(`/saved-jobs/${id}`, { method: 'DELETE', requireAuth: true });
        setIsSaved(false);
        toast.success('Job removed from saved');
      } else {
        await apiCall('/saved-jobs', {
          requireAuth: true,
          method: 'POST',
          body: JSON.stringify({ jobId: id }),
        });
        setIsSaved(true);
        toast.success('Job saved successfully');
      }
    } catch {
      toast.error('Please login to save jobs');
    } finally {
      setTogglingSave(false);
    }
  }

  async function handleShareJob() {
    if (!job || !id) return;
    const shareUrl = `${window.location.origin}/jobs/${id}`;
    try {
      if (navigator.share) {
        await navigator.share({
          title: job.title,
          text: `Check out this role: ${job.title}`,
          url: shareUrl,
        });
        return;
      }

      await navigator.clipboard.writeText(shareUrl);
      toast.success('Job link copied to clipboard');
    } catch (error: any) {
      if (error?.name === 'AbortError') return;
      toast.error('Unable to share this job right now');
    }
  }

  async function handleReportListing() {
    if (!job || !id) return;

    const reportUrl = `${window.location.origin}/jobs/${id}`;
    const subject = `Report listing: ${job.title}`;
    const body = [
      `Job title: ${job.title}`,
      `Job link: ${reportUrl}`,
      '',
      'Please describe the issue with this listing:',
    ].join('\n');

    const mailtoLink = `mailto:support@recruitfriend.co.za?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;

    try {
      window.location.href = mailtoLink;
      await navigator.clipboard.writeText(reportUrl);
      toast.success('Report email opened. Job link copied to clipboard.');
    } catch {
      toast.info('Report email opened. Please include the job link and issue details.');
    }
  }

  async function handleQuickApply() {
    if (!user) {
      toast.error('Please login to apply');
      navigate('/login?redirect=' + encodeURIComponent(window.location.pathname));
      return;
    }

    if (!isSeeker) {
      toast.error('Only job seekers can apply to jobs');
      return;
    }

    const screeningPayload = screeningQuestions.map((question, index) => {
      const key = String(question.id || index);
      return {
        question_id: key,
        question: question.prompt,
        duration: question.duration,
        answer: String(screeningAnswers[key] || '').trim(),
      };
    });

    if (screeningPayload.some((entry) => !entry.answer)) {
      toast.error('Please answer all interview questions before applying.');
      return;
    }

    setApplying(true);
    try {
      await apiCall('/applications', {
        requireAuth: true,
        method: 'POST',
        body: JSON.stringify({
          jobId: id,
          coverLetter: '',
          customLetter: false,
          screeningAnswers: screeningPayload,
        }),
      });
      toast.success('Application submitted successfully!');
      navigate('/seeker/dashboard');
    } catch (error: any) {
      toast.error(error.message || 'Failed to apply');
    } finally {
      setApplying(false);
    }
  }

  async function handleCustomApply() {
    if (!user) {
      toast.error('Please login to apply');
      navigate('/login');
      return;
    }

    const screeningPayload = screeningQuestions.map((question, index) => {
      const key = String(question.id || index);
      return {
        question_id: key,
        question: question.prompt,
        duration: question.duration,
        answer: String(screeningAnswers[key] || '').trim(),
      };
    });

    if (screeningPayload.some((entry) => !entry.answer)) {
      toast.error('Please answer all interview questions before applying.');
      return;
    }

    setApplying(true);
    try {
      await apiCall('/applications', {
        requireAuth: true,
        method: 'POST',
        body: JSON.stringify({
          jobId: id,
          coverLetter,
          customLetter: true,
          screeningAnswers: screeningPayload,
        }),
      });
      toast.success('Application submitted successfully!');
      navigate('/seeker/dashboard');
    } catch (error: any) {
      toast.error(error.message || 'Failed to apply');
    } finally {
      setApplying(false);
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-[var(--rf-green)]" />
      </div>
    );
  }

  if (!job) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <h2 className="text-2xl font-bold text-[var(--rf-navy)] mb-2">Job Not Found</h2>
          <Link to="/jobs" className="text-[var(--rf-green)] hover:underline">
            Browse all jobs
          </Link>
        </div>
      </div>
    );
  }

  const employer = (job?.employer && typeof job.employer === 'object') ? job.employer : {};
  const employerSocial = (employer.social_links && typeof employer.social_links === 'object')
    ? employer.social_links
    : {};
  const employerMeta = (employerSocial.employer && typeof employerSocial.employer === 'object')
    ? employerSocial.employer
    : {};

  const hideCompanyName = Boolean(employerMeta.hideCompanyName);
  const hideWebsite = Boolean(employerMeta.hideWebsite);

  const companyName = hideCompanyName
    ? 'RecruitFriend'
    : String(
        employer.name
          || employerSocial.company_name
          || employerSocial.companyName
          || job.company
          || 'Hiring Company'
      ).trim();
  const companyHeadline = String(employer.headline || '').trim();
  const companySummary = String(employer.summary || '').trim();
  const companyIndustry = String(employerMeta.industry || job.industry || '').trim();
  const companySize = String(employerMeta.companySize || '').trim();
  const registrationNumber = String(employerMeta.registrationNumber || '').trim();
  const bbbeeLevelRaw = String(employerMeta.bbbeeLevel || '').trim();
  const bbbeeLevel = bbbeeLevelRaw && bbbeeLevelRaw !== 'not-rated' ? `Level ${bbbeeLevelRaw}` : 'Not rated';
  const bbbeeVerified = Boolean(employerMeta.bbbeeVerified);
  const dayInLife = String(employerMeta.dayInLife || '').trim();
  const cultureTags = Array.isArray(employerMeta.cultureTags)
    ? employerMeta.cultureTags.filter((tag: unknown): tag is string => typeof tag === 'string' && tag.trim().length > 0)
    : [];

  const rawLocations = Array.isArray(employerMeta.locations)
    ? employerMeta.locations.filter((location: unknown): location is string => typeof location === 'string' && location.trim().length > 0)
    : [];
  const primaryLocation = String(employer.location || job.location || [job.city, job.province].filter(Boolean).join(', ') || '').trim();
  const companyLocations = Array.from(new Set([primaryLocation, ...rawLocations].filter(Boolean)));

  const companyLinks = [
    { label: 'Website', url: hideWebsite ? '' : normalizeUrl(employerSocial.website) },
    { label: 'LinkedIn', url: normalizeUrl(employerSocial.linkedin) },
    { label: 'Facebook', url: normalizeUrl(employerSocial.facebook) },
    { label: 'Instagram', url: normalizeUrl(employerSocial.instagram) },
    { label: 'X / Twitter', url: normalizeUrl(employerSocial.twitter) },
  ].filter((item) => item.url);

  const companyLogo = hideCompanyName ? '' : String(
    employer.avatar_url
      || employerSocial.logo
      || employerSocial.logoUrl
      || employerSocial.companyLogo
      || employerMeta.logo
      || ''
  ).trim();

  const postedDateRaw = job.created_at || job.createdAt;
  const postedDate = postedDateRaw ? new Date(postedDateRaw) : null;
  const postedDateLabel = postedDate && !Number.isNaN(postedDate.getTime())
    ? postedDate.toLocaleDateString()
    : 'Recently';

  const roleLocation = String(
    job.location || [job.city, job.province].filter(Boolean).join(', ') || 'South Africa'
  ).trim();

  const employmentTypeLabel = toDisplayLabel(job.employment_type || job.jobType, 'Full-time');
  const isRemoteRole = String(job.work_location || job.remoteType || '').toLowerCase() === 'remote';
  const salaryMin = Number(job.salary_min ?? job.salaryMin ?? 0);
  const salaryMax = Number(job.salary_max ?? job.salaryMax ?? 0);
  const screeningQuestions = Array.isArray((job as any)?.screening_questions)
    ? (job as any).screening_questions
        .map((question: any, index: number) => ({
          id: String(question?.id ?? index),
          prompt: String(question?.prompt || '').trim(),
          duration: String(question?.duration || '1min').trim(),
        }))
        .filter((question: { id: string; prompt: string; duration: string }) => question.prompt.length > 0)
    : [];
  const seekerIntroVideoUrl = String(
    (profile as any)?.social_links?.video_introduction ||
      (profile as any)?.social_links?.videoIntroduction ||
      ''
  ).trim();

  const requirementsList = Array.isArray(job.requirements)
    ? job.requirements.filter((item: unknown): item is string => typeof item === 'string' && item.trim().length > 0)
    : [];
  const benefitsList = Array.isArray(job.benefits)
    ? job.benefits.filter((item: unknown): item is string => typeof item === 'string' && item.trim().length > 0)
    : [];

  const companyInitial = String(companyName || 'C').trim().charAt(0).toUpperCase() || 'C';

  return (
    <div className="bg-[var(--rf-bg)] min-h-screen py-8">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Breadcrumb */}
        <div className="text-sm text-[var(--rf-muted)] mb-6">
          <Link to="/" className="hover:text-[var(--rf-green)]">Home</Link>
          <span className="mx-2">&gt;</span>
          <Link to="/jobs" className="hover:text-[var(--rf-green)]">Jobs</Link>
          <span className="mx-2">&gt;</span>
          <span>{job.title}</span>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Main Content */}
          <div className="lg:col-span-2">
            <div className="bg-white rounded-[var(--rf-radius-lg)] shadow-[var(--rf-card-shadow)] overflow-hidden">
              {/* Company Banner */}
              <div className="h-32 bg-gradient-to-r from-[var(--rf-navy)] to-[#0d3a5f] relative">
                <div className="absolute -bottom-8 left-6">
                  <div className="w-20 h-20 bg-white rounded-[var(--rf-radius-md)] shadow-lg flex items-center justify-center overflow-hidden">
                    {companyLogo ? (
                      <img src={companyLogo} alt={`${companyName} logo`} className="w-full h-full object-cover" />
                    ) : (
                      <div className="flex h-full w-full items-center justify-center bg-gray-100 text-2xl font-bold text-[var(--rf-navy)]">
                        {companyInitial}
                      </div>
                    )}
                  </div>
                </div>
              </div>

              <div className="p-6 pt-12">
                <div className="flex justify-between items-start mb-4">
                  <div>
                    <h1 className="text-3xl font-bold text-[var(--rf-navy)] mb-2">{job.title}</h1>
                    <div className="flex items-center space-x-2 text-[var(--rf-muted)] mb-2">
                      <Building2 className="w-5 h-5" />
                      <span className="font-semibold">{companyName}</span>
                      <CheckCircle className="w-5 h-5 text-[var(--rf-green)]" />
                    </div>
                    <div className="flex flex-wrap gap-3 text-sm text-[var(--rf-muted)]">
                      <span className="flex items-center">
                        <MapPin className="w-4 h-4 mr-1" />
                        {roleLocation}
                      </span>
                      <span className="flex items-center">
                        <Calendar className="w-4 h-4 mr-1" />
                        Posted {postedDateLabel}
                      </span>
                      <span className="flex items-center">
                        <Clock className="w-4 h-4 mr-1" />
                        Deadline: {job.deadline ? new Date(job.deadline).toLocaleDateString() : 'Open'}
                      </span>
                    </div>
                  </div>
                  <button
                    onClick={handleToggleSave}
                    disabled={togglingSave}
                    className="p-2 hover:bg-gray-100 rounded-full transition-colors disabled:opacity-60"
                    aria-label={isSaved ? 'Remove from favourites' : 'Add to favourites'}
                  >
                    <Heart className={`w-6 h-6 ${isSaved ? 'fill-[var(--rf-orange)] text-[var(--rf-orange)]' : 'text-gray-400'}`} />
                  </button>
                </div>

                {/* Badges */}
                <div className="flex flex-wrap gap-2 mb-6">
                  <span className="px-4 py-1.5 bg-gray-100 text-[var(--rf-text)] rounded-[var(--rf-radius-pill)] text-sm font-medium">
                    {employmentTypeLabel}
                  </span>
                  {isRemoteRole && (
                    <span className="px-4 py-1.5 bg-[var(--rf-green)] bg-opacity-10 text-[var(--rf-green)] rounded-[var(--rf-radius-pill)] text-sm font-semibold">
                      Remote
                    </span>
                  )}
                  {job.eePosition && (
                    <span className="px-4 py-1.5 bg-blue-100 text-blue-700 rounded-[var(--rf-radius-pill)] text-sm font-semibold">
                      EE Position
                    </span>
                  )}
                </div>

                {/* Tabs */}
                <div className="border-b border-[var(--rf-border)] mb-6">
                  <div className="flex space-x-6">
                    {['overview', 'requirements', 'benefits'].map((tab) => (
                      <button
                        key={tab}
                        onClick={() => setActiveTab(tab)}
                        className={`pb-3 font-semibold capitalize ${
                          activeTab === tab
                            ? 'text-[var(--rf-green)] border-b-2 border-[var(--rf-green)]'
                            : 'text-[var(--rf-muted)] hover:text-[var(--rf-text)]'
                        }`}
                      >
                        {tab}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Tab Content */}
                <div className="prose max-w-none">
                  {activeTab === 'overview' && (
                    <div>
                      <h3 className="text-lg font-bold text-[var(--rf-navy)] mb-3">Job Description</h3>
                      <p className="text-[var(--rf-muted)] whitespace-pre-line">
                        {job.description || 'No description provided.'}
                      </p>
                      
                      {job.skills && job.skills.length > 0 && (
                        <div className="mt-6">
                          <h4 className="text-md font-bold text-[var(--rf-navy)] mb-3">Required Skills</h4>
                          <div className="flex flex-wrap gap-2">
                            {job.skills.map((skill: string, index: number) => (
                              <span
                                key={index}
                                className="px-3 py-1.5 bg-[var(--rf-green)] bg-opacity-10 text-[var(--rf-green)] rounded-[var(--rf-radius-pill)] text-sm font-medium"
                              >
                                {skill}
                              </span>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  )}
                  
                  {activeTab === 'requirements' && (
                    <div>
                      <h3 className="text-lg font-bold text-[var(--rf-navy)] mb-3">Requirements</h3>
                      {requirementsList.length > 0 ? (
                        <ul className="list-disc space-y-2 pl-5 text-[var(--rf-muted)]">
                          {requirementsList.map((item) => (
                            <li key={item}>{item}</li>
                          ))}
                        </ul>
                      ) : (
                        <p className="text-[var(--rf-muted)]">Requirements will be discussed during the interview process.</p>
                      )}
                    </div>
                  )}
                  
                  {activeTab === 'benefits' && (
                    <div>
                      <h3 className="text-lg font-bold text-[var(--rf-navy)] mb-3">Benefits</h3>
                      {benefitsList.length > 0 ? (
                        <ul className="list-disc space-y-2 pl-5 text-[var(--rf-muted)]">
                          {benefitsList.map((item) => (
                            <li key={item}>{item}</li>
                          ))}
                        </ul>
                      ) : (
                        <p className="text-[var(--rf-muted)]">Competitive salary and benefits package.</p>
                      )}
                    </div>
                  )}
                </div>

                {/* Share */}
                <div className="mt-8 pt-6 border-t border-[var(--rf-border)]">
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-semibold text-[var(--rf-text)]">Share this job:</span>
                    <div className="flex space-x-3">
                      <button
                        onClick={handleShareJob}
                        className="p-2 hover:bg-gray-100 rounded-full transition-colors"
                        aria-label="Share this job"
                      >
                        <Share2 className="w-5 h-5 text-[var(--rf-muted)]" />
                      </button>
                    </div>
                  </div>
                  <button
                    onClick={handleReportListing}
                    className="text-xs text-[var(--rf-muted)] hover:text-[var(--rf-error)] mt-4 flex items-center"
                  >
                    <Flag className="w-3 h-3 mr-1" />
                    Report listing
                  </button>
                </div>
              </div>
            </div>
          </div>

          {/* Sidebar */}
          <div className="lg:col-span-1">
            <div className="space-y-6 lg:sticky lg:top-20">
              {/* Apply Card */}
              <div className="bg-white rounded-[var(--rf-radius-lg)] shadow-[var(--rf-card-shadow)] p-6">
                <h3 className="text-lg font-bold text-[var(--rf-navy)] mb-4">Apply for this Job</h3>
                
                {salaryMin > 0 && salaryMax > 0 && (
                  <div className="mb-6 p-4 bg-[var(--rf-green)] bg-opacity-10 rounded-[var(--rf-radius-md)]">
                    <div className="text-sm text-[var(--rf-muted)] mb-1">Salary Range</div>
                    <div className="text-2xl font-bold text-[var(--rf-navy)]">
                      R{salaryMin.toLocaleString()} - R{salaryMax.toLocaleString()}
                    </div>
                    <div className="text-xs text-[var(--rf-muted)]">per month</div>
                  </div>
                )}

                {authLoading ? (
                  <div className="flex justify-center py-6">
                    <Loader2 className="w-6 h-6 animate-spin text-[var(--rf-green)]" />
                  </div>
                ) : isSeeker ? (
                  <div className="space-y-3">
                    {seekerIntroVideoUrl && (
                      <div className="rounded-[var(--rf-radius-md)] border border-[var(--rf-border)] p-3">
                        <div className="mb-2 text-xs font-semibold uppercase tracking-wide text-[var(--rf-muted)]">Your intro video</div>
                        <video
                          src={seekerIntroVideoUrl}
                          controls
                          className="w-full rounded-[var(--rf-radius-md)] border border-gray-200"
                          preload="metadata"
                        />
                      </div>
                    )}

                    {screeningQuestions.length > 0 && (
                      <div className="space-y-3 rounded-[var(--rf-radius-md)] border border-[var(--rf-border)] bg-gray-50 p-3">
                        <div className="text-sm font-semibold text-[var(--rf-navy)]">Interview Questions</div>
                        <p className="text-xs text-[var(--rf-muted)]">Answer the questions below before submitting your application.</p>
                        <div className="space-y-3">
                          {screeningQuestions.map((question, index) => (
                            <div key={question.id} className="space-y-1.5">
                              <label className="block text-xs font-semibold text-[var(--rf-text)]">
                                Q{index + 1}. {question.prompt}
                                {question.duration ? (
                                  <span className="ml-1 text-[var(--rf-muted)] font-normal">({question.duration})</span>
                                ) : null}
                              </label>
                              <textarea
                                value={screeningAnswers[question.id] || ''}
                                onChange={(e) =>
                                  setScreeningAnswers((prev) => ({
                                    ...prev,
                                    [question.id]: e.target.value,
                                  }))
                                }
                                placeholder="Type your answer"
                                rows={3}
                                className="w-full border border-[var(--rf-border)] rounded-[var(--rf-radius-md)] p-2.5 text-sm outline-none focus:ring-2 focus:ring-[var(--rf-green)]"
                              />
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    <button
                      onClick={handleQuickApply}
                      disabled={applying}
                      className="w-full py-3 bg-[var(--rf-orange)] text-white rounded-[var(--rf-radius-md)] hover:bg-[#E55C2E] transition-colors font-semibold disabled:opacity-50"
                    >
                      {applying ? 'Applying...' : 'Quick Apply'}
                    </button>
                    
                    <div className="border-t border-[var(--rf-border)] pt-3">
                      <textarea
                        value={coverLetter}
                        onChange={(e) => setCoverLetter(e.target.value)}
                        placeholder="Add a custom cover letter (optional)..."
                        className="w-full border border-[var(--rf-border)] rounded-[var(--rf-radius-md)] p-3 text-sm outline-none focus:ring-2 focus:ring-[var(--rf-green)] mb-3"
                        rows={4}
                      />
                      <button
                        onClick={handleCustomApply}
                        disabled={applying}
                        className="w-full py-3 bg-[var(--rf-green)] text-white rounded-[var(--rf-radius-md)] hover:bg-[#00B548] transition-colors font-semibold disabled:opacity-50"
                      >
                        {applying ? 'Applying...' : 'Apply with Custom Letter'}
                      </button>
                    </div>
                  </div>
                ) : user && profile ? (
                  <div className="text-center p-4 bg-gray-50 rounded-[var(--rf-radius-md)]">
                    <p className="text-sm text-[var(--rf-muted)]">
                      Employer accounts cannot apply for jobs.
                    </p>
                  </div>
                ) : (
                  <div className="text-center p-4 bg-gray-50 rounded-[var(--rf-radius-md)]">
                    <p className="text-sm text-[var(--rf-muted)] mb-3">
                      Please login as a job seeker to apply
                    </p>
                    <Link
                      to={`/login?redirect=${encodeURIComponent(window.location.pathname)}`}
                      className="inline-block px-6 py-2 bg-[var(--rf-green)] text-white rounded-[var(--rf-radius-md)] hover:bg-[#00B548] transition-colors font-semibold"
                    >
                      Login
                    </Link>
                  </div>
                )}
              </div>

              {/* Company Info Card */}
              <div className="bg-white rounded-[var(--rf-radius-lg)] shadow-[var(--rf-card-shadow)] p-5 sm:p-6">
                <h3 className="text-lg font-bold text-[var(--rf-navy)] mb-4">Company Profile</h3>
                <div className="space-y-5 text-sm min-w-0">
                  <div className="flex items-start gap-3 rounded-[var(--rf-radius-md)] border border-[var(--rf-border)] p-3">
                    <div className="h-12 w-12 shrink-0 overflow-hidden rounded-md border border-gray-200 bg-gray-50">
                      {companyLogo ? (
                        <img src={companyLogo} alt={`${companyName} logo`} className="h-full w-full object-cover" />
                      ) : (
                        <div className="flex h-full w-full items-center justify-center text-base font-bold text-[var(--rf-navy)]">
                          {companyInitial}
                        </div>
                      )}
                    </div>
                    <div className="min-w-0">
                      <div className="font-semibold text-[var(--rf-text)] text-base break-words">{companyName}</div>
                      <p className="mt-1 text-xs text-[var(--rf-muted)]">Hiring company</p>
                    </div>
                  </div>

                  <div>
                    {companyHeadline && <p className="mt-1 text-[var(--rf-muted)]">{companyHeadline}</p>}
                    {bbbeeVerified && (
                      <span className="inline-flex mt-2 items-center rounded-full bg-green-50 px-2.5 py-1 text-xs font-semibold text-green-700">
                        Verified business
                      </span>
                    )}
                  </div>

                  {(companySummary || dayInLife) && (
                    <div className="space-y-2 border-t border-[var(--rf-border)] pt-4">
                      <div>
                        <div className="text-xs uppercase tracking-wide text-[var(--rf-muted)]">About</div>
                        <p className="mt-1 whitespace-pre-line text-[var(--rf-text)]">{companySummary || 'No company overview shared yet.'}</p>
                      </div>
                      {dayInLife && (
                        <div>
                          <div className="text-xs uppercase tracking-wide text-[var(--rf-muted)]">Day in the life</div>
                          <p className="mt-1 whitespace-pre-line text-[var(--rf-text)]">{dayInLife}</p>
                        </div>
                      )}
                    </div>
                  )}

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 border-t border-[var(--rf-border)] pt-4">
                    <div>
                      <div className="text-xs uppercase tracking-wide text-[var(--rf-muted)]">Industry</div>
                      <div className="font-semibold text-[var(--rf-text)]">{companyIndustry || 'Not specified'}</div>
                    </div>
                    <div>
                      <div className="text-xs uppercase tracking-wide text-[var(--rf-muted)]">Company size</div>
                      <div className="font-semibold text-[var(--rf-text)]">{companySize || 'Not specified'}</div>
                    </div>
                    <div>
                      <div className="text-xs uppercase tracking-wide text-[var(--rf-muted)]">Registration number</div>
                      <div className="font-semibold text-[var(--rf-text)]">{registrationNumber || 'Not shared'}</div>
                    </div>
                    <div>
                      <div className="text-xs uppercase tracking-wide text-[var(--rf-muted)]">B-BBEE</div>
                      <div className="font-semibold text-[var(--rf-text)]">{bbbeeLevel}</div>
                    </div>
                  </div>

                  {companyLocations.length > 0 && (
                    <div className="border-t border-[var(--rf-border)] pt-4">
                      <div className="text-xs uppercase tracking-wide text-[var(--rf-muted)] mb-2">Locations</div>
                      <ul className="space-y-1">
                        {companyLocations.map((location) => (
                          <li key={location} className="text-[var(--rf-text)]">• {location}</li>
                        ))}
                      </ul>
                    </div>
                  )}

                  {cultureTags.length > 0 && (
                    <div className="border-t border-[var(--rf-border)] pt-4">
                      <div className="text-xs uppercase tracking-wide text-[var(--rf-muted)] mb-2">Culture</div>
                      <div className="flex flex-wrap gap-2">
                        {cultureTags.map((tag) => (
                          <span key={tag} className="rounded-full bg-gray-100 px-2.5 py-1 text-xs font-medium text-[var(--rf-text)]">
                            {tag}
                          </span>
                        ))}
                      </div>
                    </div>
                  )}

                  {companyLinks.length > 0 && (
                    <div className="border-t border-[var(--rf-border)] pt-4">
                      <div className="text-xs uppercase tracking-wide text-[var(--rf-muted)] mb-2">Company links</div>
                      <div className="space-y-2">
                        {companyLinks.map((link) => (
                          <a
                            key={link.label}
                            href={link.url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex max-w-full items-center text-[var(--rf-green)] hover:underline break-all"
                          >
                            <Globe className="mr-1.5 h-3.5 w-3.5" />
                            {link.label}
                          </a>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
