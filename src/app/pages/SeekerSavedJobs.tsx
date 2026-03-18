import { useEffect, useMemo, useState } from 'react';
import { Heart, MapPin, DollarSign, Briefcase, Trash2, Share2, ArrowRight, Loader2 } from 'lucide-react';
import { Link } from 'react-router';
import { toast } from 'sonner';
import { apiCall } from '../lib/supabase';
import type { Application, Job } from '../types';

export default function SeekerSavedJobs() {
  const [filter, setFilter] = useState('all');
  const [jobs, setJobs] = useState<Job[]>([]);
  const [appliedJobIds, setAppliedJobIds] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);
  const [workingJobId, setWorkingJobId] = useState<string | null>(null);

  useEffect(() => {
    loadSavedJobs();
  }, []);

  async function loadSavedJobs() {
    setLoading(true);
    try {
      const [{ jobs: saved }, { applications }] = await Promise.all([
        apiCall('/saved-jobs', { requireAuth: true }),
        apiCall('/applications/my', { requireAuth: true }),
      ]);

      setJobs((saved || []) as Job[]);
      const appRows = (applications || []) as Application[];
      setAppliedJobIds(new Set(appRows.map((a) => a.job_id)));
    } catch (error: any) {
      toast.error(error.message || 'Failed to load saved jobs');
    } finally {
      setLoading(false);
    }
  }

  async function handleRemove(jobId: string) {
    setWorkingJobId(jobId);
    try {
      await apiCall(`/saved-jobs/${jobId}`, { method: 'DELETE' });
      setJobs((prev) => prev.filter((j) => j.id !== jobId));
      toast.success('Removed from saved jobs');
    } catch (error: any) {
      toast.error(error.message || 'Failed to remove saved job');
    } finally {
      setWorkingJobId(null);
    }
  }

  async function handleApply(jobId: string) {
    setWorkingJobId(jobId);
    try {
      await apiCall('/applications', {
        method: 'POST',
        body: JSON.stringify({ jobId }),
      });
      setAppliedJobIds((prev) => new Set([...prev, jobId]));
      toast.success('Application submitted');
    } catch (error: any) {
      toast.error(error.message || 'Failed to apply');
    } finally {
      setWorkingJobId(null);
    }
  }

  async function handleShare(job: Job) {
    const shareUrl = `${window.location.origin}/jobs/${job.id}`;
    try {
      if (navigator.share) {
        await navigator.share({
          title: job.title,
          text: `Check out this role: ${job.title}`,
          url: shareUrl,
        });
      } else {
        await navigator.clipboard.writeText(shareUrl);
        toast.success('Job link copied to clipboard');
      }
    } catch {
      toast.error('Unable to share this job right now');
    }
  }

  const filteredJobs = useMemo(() => {
    if (filter === 'all') return jobs;
    if (filter === 'applied') return jobs.filter((j) => appliedJobIds.has(j.id));
    if (filter === 'not-applied') return jobs.filter((j) => !appliedJobIds.has(j.id));
    if (filter === 'expiring-soon') {
      const now = Date.now();
      const oneWeek = 7 * 24 * 60 * 60 * 1000;
      return jobs.filter((j: any) => {
        const updated = j.updated_at ? new Date(j.updated_at).getTime() : now;
        return now - updated < oneWeek;
      });
    }
    return jobs;
  }, [filter, jobs, appliedJobIds]);

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <h1 className="text-3xl font-bold text-[var(--rf-navy)]">Saved Jobs</h1>
        
        <div className="flex items-center space-x-2 bg-white px-2 py-1 rounded-[var(--rf-radius-md)] shadow-sm border border-[var(--rf-border)]">
          {['All', 'Applied', 'Not Applied', 'Expiring Soon'].map((f) => {
             const key = f.toLowerCase().replace(' ', '-');
             return (
              <button
                key={key}
                onClick={() => setFilter(key)}
                className={`px-3 py-1.5 text-sm font-medium rounded-[var(--rf-radius-sm)] transition-colors ${
                  filter === key 
                    ? 'bg-[var(--rf-navy)] text-white' 
                    : 'text-[var(--rf-muted)] hover:bg-gray-100'
                }`}
              >
                {f}
              </button>
             );
          })}
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {loading && (
          <div className="col-span-full text-center py-20 bg-white rounded-[var(--rf-radius-lg)] shadow-[var(--rf-card-shadow)]">
            <Loader2 className="w-6 h-6 animate-spin mx-auto mb-3 text-[var(--rf-green)]" />
            <p className="text-[var(--rf-muted)]">Loading saved jobs...</p>
          </div>
        )}

        {!loading && filteredJobs.map((job) => (
          <div key={job.id} className="bg-white rounded-[var(--rf-radius-lg)] shadow-[var(--rf-card-shadow)] overflow-hidden relative group border border-transparent">
            <div className="p-6">
              <div className="flex justify-between items-start mb-4">
                <div className="w-12 h-12 bg-gray-100 rounded-[var(--rf-radius-md)] flex items-center justify-center font-bold text-[var(--rf-navy)]">
                   {(job.employer?.name || 'C').charAt(0)}
                </div>
                <div className="flex space-x-2">
                  <button onClick={() => handleShare(job)} className="text-gray-400 hover:text-[var(--rf-navy)] p-1"><Share2 className="w-4 h-4" /></button>
                  <button disabled={workingJobId === job.id} onClick={() => handleRemove(job.id)} className="text-gray-400 hover:text-red-500 p-1 disabled:opacity-60"><Trash2 className="w-4 h-4" /></button>
                </div>
              </div>
              
              <h3 className="font-bold text-[var(--rf-navy)] text-lg mb-1 leading-tight group-hover:text-[var(--rf-green)] transition-colors">
                {job.title}
              </h3>
              <p className="text-sm font-medium text-[var(--rf-muted)] mb-4">{job.employer?.name || 'Company'}</p>
              
              <div className="space-y-2 mb-4">
                <div className="flex items-center text-sm text-[var(--rf-text)]">
                   <MapPin className="w-4 h-4 mr-2 text-gray-400" />
                   {[job.city, job.province].filter(Boolean).join(', ') || 'South Africa'}
                </div>
                <div className="flex items-center text-sm text-[var(--rf-text)]">
                   <DollarSign className="w-4 h-4 mr-2 text-gray-400" />
                   {(job.salary_min || job.salary_max) ? `R${job.salary_min || 0} - R${job.salary_max || 0}` : 'Negotiable'}
                </div>
                 <div className="flex items-center text-sm text-[var(--rf-text)]">
                   <Briefcase className="w-4 h-4 mr-2 text-gray-400" />
                   {job.employment_type || 'Full-time'}
                </div>
              </div>
              
              <div className="flex items-center justify-between pt-4 border-t border-gray-100">
                <span className="text-xs text-[var(--rf-muted)]">Saved recently</span>
                <span className="text-xs font-semibold text-[var(--rf-muted)]">
                   {new Date(job.created_at).toLocaleDateString()}
                </span>
              </div>
            </div>
            
            <div className="bg-gray-50 px-6 py-3 border-t border-[var(--rf-border)] flex items-center justify-between">
              {appliedJobIds.has(job.id) ? (
                <span className="text-sm font-semibold text-[var(--rf-navy)] flex items-center">
                   <span className="w-2 h-2 bg-blue-500 rounded-full mr-2"></span> Applied
                </span>
              ) : (
                <button disabled={workingJobId === job.id} onClick={() => handleApply(job.id)} className="w-full bg-[var(--rf-green)] text-white font-semibold py-2 rounded-[var(--rf-radius-md)] hover:bg-[#00B548] transition-colors text-sm disabled:opacity-60">
                  Apply Now
                </button>
              )}
            </div>
          </div>
        ))}
        
        {/* Empty State possibility */}
        {!loading && filteredJobs.length === 0 && (
           <div className="col-span-full text-center py-20 bg-white rounded-[var(--rf-radius-lg)] shadow-[var(--rf-card-shadow)]">
              <Heart className="w-16 h-16 text-gray-200 mx-auto mb-4" />
              <h3 className="text-xl font-bold text-[var(--rf-navy)] mb-2">No saved jobs yet</h3>
              <p className="text-[var(--rf-muted)] mb-6">Browse jobs and tap the heart icon to save them for later.</p>
              <Link to="/jobs" className="inline-flex items-center px-6 py-3 bg-[var(--rf-green)] text-white rounded-[var(--rf-radius-md)] font-semibold hover:bg-[#00B548] transition-colors">
                 Find Jobs <ArrowRight className="ml-2 w-4 h-4" />
              </Link>
           </div>
        )}
      </div>
    </div>
  );
}
