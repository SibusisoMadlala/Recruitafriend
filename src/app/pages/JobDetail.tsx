import { useState, useEffect } from 'react';
import { useParams, Link, useNavigate } from 'react-router';
import { useAuth } from '../context/useAuth';
import { apiCall } from '../lib/supabase';
import { toast } from 'sonner';
import {
  MapPin, DollarSign, Briefcase, Calendar, Clock, Building2,
  Share2, Flag, CheckCircle, Heart, Loader2
} from 'lucide-react';

export default function JobDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { user, profile, loading: authLoading } = useAuth();
  const [job, setJob] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [applying, setApplying] = useState(false);
  const [activeTab, setActiveTab] = useState('overview');
  const [coverLetter, setCoverLetter] = useState('');

  useEffect(() => {
    loadJob();
  }, [id]);

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

  const isSeeker = !authLoading && !!user && !!(profile?.userType === 'seeker' || (profile as any)?.user_type === 'seeker');

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

    setApplying(true);
    try {
      await apiCall('/applications', {
        method: 'POST',
        body: JSON.stringify({
          jobId: id,
          coverLetter: '',
          customLetter: false,
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

    setApplying(true);
    try {
      await apiCall('/applications', {
        method: 'POST',
        body: JSON.stringify({
          jobId: id,
          coverLetter,
          customLetter: true,
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
                  <div className="w-20 h-20 bg-white rounded-[var(--rf-radius-md)] shadow-lg flex items-center justify-center">
                    <Building2 className="w-10 h-10 text-[var(--rf-green)]" />
                  </div>
                </div>
              </div>

              <div className="p-6 pt-12">
                <div className="flex justify-between items-start mb-4">
                  <div>
                    <h1 className="text-3xl font-bold text-[var(--rf-navy)] mb-2">{job.title}</h1>
                    <div className="flex items-center space-x-2 text-[var(--rf-muted)] mb-2">
                      <Building2 className="w-5 h-5" />
                      <span className="font-semibold">{job.company || 'Company Name'}</span>
                      <CheckCircle className="w-5 h-5 text-[var(--rf-green)]" />
                    </div>
                    <div className="flex flex-wrap gap-3 text-sm text-[var(--rf-muted)]">
                      <span className="flex items-center">
                        <MapPin className="w-4 h-4 mr-1" />
                        {job.location}
                      </span>
                      <span className="flex items-center">
                        <Calendar className="w-4 h-4 mr-1" />
                        Posted {new Date(job.createdAt).toLocaleDateString()}
                      </span>
                      <span className="flex items-center">
                        <Clock className="w-4 h-4 mr-1" />
                        Deadline: {job.deadline ? new Date(job.deadline).toLocaleDateString() : 'Open'}
                      </span>
                    </div>
                  </div>
                  <button className="p-2 hover:bg-gray-100 rounded-full transition-colors">
                    <Heart className="w-6 h-6 text-gray-400" />
                  </button>
                </div>

                {/* Badges */}
                <div className="flex flex-wrap gap-2 mb-6">
                  <span className="px-4 py-1.5 bg-gray-100 text-[var(--rf-text)] rounded-[var(--rf-radius-pill)] text-sm font-medium">
                    {job.jobType || 'Full-time'}
                  </span>
                  {job.remoteType === 'remote' && (
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
                      <p className="text-[var(--rf-muted)]">
                        {job.requirements || 'Requirements will be discussed during the interview process.'}
                      </p>
                    </div>
                  )}
                  
                  {activeTab === 'benefits' && (
                    <div>
                      <h3 className="text-lg font-bold text-[var(--rf-navy)] mb-3">Benefits</h3>
                      <p className="text-[var(--rf-muted)]">
                        {job.benefits || 'Competitive salary and benefits package.'}
                      </p>
                    </div>
                  )}
                </div>

                {/* Share */}
                <div className="mt-8 pt-6 border-t border-[var(--rf-border)]">
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-semibold text-[var(--rf-text)]">Share this job:</span>
                    <div className="flex space-x-3">
                      <button className="p-2 hover:bg-gray-100 rounded-full transition-colors">
                        <Share2 className="w-5 h-5 text-[var(--rf-muted)]" />
                      </button>
                    </div>
                  </div>
                  <button className="text-xs text-[var(--rf-muted)] hover:text-[var(--rf-error)] mt-4 flex items-center">
                    <Flag className="w-3 h-3 mr-1" />
                    Report listing
                  </button>
                </div>
              </div>
            </div>
          </div>

          {/* Sidebar */}
          <div className="lg:col-span-1">
            <div className="sticky top-20 space-y-6">
              {/* Apply Card */}
              <div className="bg-white rounded-[var(--rf-radius-lg)] shadow-[var(--rf-card-shadow)] p-6">
                <h3 className="text-lg font-bold text-[var(--rf-navy)] mb-4">Apply for this Job</h3>
                
                {job.salaryMin && job.salaryMax && (
                  <div className="mb-6 p-4 bg-[var(--rf-green)] bg-opacity-10 rounded-[var(--rf-radius-md)]">
                    <div className="text-sm text-[var(--rf-muted)] mb-1">Salary Range</div>
                    <div className="text-2xl font-bold text-[var(--rf-navy)]">
                      R{job.salaryMin.toLocaleString()} - R{job.salaryMax.toLocaleString()}
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
              <div className="bg-white rounded-[var(--rf-radius-lg)] shadow-[var(--rf-card-shadow)] p-6">
                <h3 className="text-lg font-bold text-[var(--rf-navy)] mb-4">Company Info</h3>
                <div className="space-y-3">
                  <div>
                    <div className="text-sm text-[var(--rf-muted)]">Company</div>
                    <div className="font-semibold text-[var(--rf-text)]">{job.company || 'Company Name'}</div>
                  </div>
                  <div>
                    <div className="text-sm text-[var(--rf-muted)]">Industry</div>
                    <div className="font-semibold text-[var(--rf-text)]">{job.industry || 'Various'}</div>
                  </div>
                  <div>
                    <div className="text-sm text-[var(--rf-muted)]">Website</div>
                    <a href="#" className="font-semibold text-[var(--rf-green)] hover:underline">
                      View website
                    </a>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
