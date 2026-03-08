import { useState, useEffect } from 'react';
import { Link, useSearchParams } from 'react-router';
import { Search, MapPin, DollarSign, Briefcase, Building2, Heart, CheckCircle, SlidersHorizontal } from 'lucide-react';
import { apiCall } from '../lib/supabase';
import { toast } from 'sonner';

const jobTypes = ['Full-time', 'Part-time', 'Contract', 'Internship'];
const experienceLevels = ['Entry Level', 'Mid Level', 'Senior Level', 'Executive'];

export default function JobSearch() {
  const [searchParams, setSearchParams] = useSearchParams();
  const [jobs, setJobs] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [showFilters, setShowFilters] = useState(true);
  
  // Filters
  const [keyword, setKeyword] = useState(searchParams.get('search') || '');
  const [location, setLocation] = useState(searchParams.get('location') || '');
  const [jobType, setJobType] = useState(searchParams.get('jobType') || '');
  const [minSalary, setMinSalary] = useState(searchParams.get('minSalary') || '');
  const [maxSalary, setMaxSalary] = useState(searchParams.get('maxSalary') || '');
  const [savedJobs, setSavedJobs] = useState<Set<string>>(new Set());

  useEffect(() => {
    loadJobs();
  }, [searchParams]);

  async function loadJobs() {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (keyword) params.set('search', keyword);
      if (location) params.set('location', location);
      if (jobType) params.set('jobType', jobType);
      if (minSalary) params.set('minSalary', minSalary);
      if (maxSalary) params.set('maxSalary', maxSalary);
      
      const { jobs: fetchedJobs } = await apiCall(`/jobs?${params.toString()}`);
      setJobs(fetchedJobs);
    } catch (error) {
      console.error('Error loading jobs:', error);
      toast.error('Failed to load jobs');
    } finally {
      setLoading(false);
    }
  }

  const applyFilters = () => {
    const params = new URLSearchParams();
    if (keyword) params.set('search', keyword);
    if (location) params.set('location', location);
    if (jobType) params.set('jobType', jobType);
    if (minSalary) params.set('minSalary', minSalary);
    if (maxSalary) params.set('maxSalary', maxSalary);
    setSearchParams(params);
  };

  const clearFilters = () => {
    setKeyword('');
    setLocation('');
    setJobType('');
    setMinSalary('');
    setMaxSalary('');
    setSearchParams(new URLSearchParams());
  };

  const toggleSaveJob = async (jobId: string) => {
    try {
      if (savedJobs.has(jobId)) {
        await apiCall(`/saved-jobs/${jobId}`, { method: 'DELETE' });
        setSavedJobs(prev => {
          const newSet = new Set(prev);
          newSet.delete(jobId);
          return newSet;
        });
        toast.success('Job removed from saved');
      } else {
        await apiCall('/saved-jobs', {
          method: 'POST',
          body: JSON.stringify({ jobId }),
        });
        setSavedJobs(prev => new Set(prev).add(jobId));
        toast.success('Job saved successfully');
      }
    } catch (error) {
      toast.error('Please login to save jobs');
    }
  };

  return (
    <div className="bg-[var(--rf-bg)] min-h-screen py-8">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Header */}
        <div className="mb-6">
          <h1 className="text-3xl font-bold text-[var(--rf-navy)] mb-2">
            {jobs.length} Jobs Found
          </h1>
          <button
            onClick={() => setShowFilters(!showFilters)}
            className="md:hidden flex items-center space-x-2 text-[var(--rf-green)] font-semibold"
          >
            <SlidersHorizontal className="w-5 h-5" />
            <span>{showFilters ? 'Hide' : 'Show'} Filters</span>
          </button>
        </div>

        <div className="flex flex-col md:flex-row gap-6">
          {/* Filters Sidebar */}
          {showFilters && (
            <div className="md:w-80 flex-shrink-0">
              <div className="bg-white rounded-[var(--rf-radius-lg)] shadow-[var(--rf-card-shadow)] p-6 sticky top-20">
                <h3 className="text-lg font-bold text-[var(--rf-navy)] mb-4">
                  RecruitFriend Filter Panel
                </h3>

                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-[var(--rf-text)] mb-2">
                      Keywords
                    </label>
                    <div className="flex items-center border border-[var(--rf-border)] rounded-[var(--rf-radius-md)] px-3 py-2">
                      <Search className="w-4 h-4 text-[var(--rf-muted)] mr-2" />
                      <input
                        type="text"
                        value={keyword}
                        onChange={(e) => setKeyword(e.target.value)}
                        placeholder="Job title..."
                        className="flex-1 outline-none text-sm"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-[var(--rf-text)] mb-2">
                      Location
                    </label>
                    <div className="flex items-center border border-[var(--rf-border)] rounded-[var(--rf-radius-md)] px-3 py-2">
                      <MapPin className="w-4 h-4 text-[var(--rf-muted)] mr-2" />
                      <input
                        type="text"
                        value={location}
                        onChange={(e) => setLocation(e.target.value)}
                        placeholder="Province or city..."
                        className="flex-1 outline-none text-sm"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-[var(--rf-text)] mb-2">
                      Job Type
                    </label>
                    <select
                      value={jobType}
                      onChange={(e) => setJobType(e.target.value)}
                      className="w-full border border-[var(--rf-border)] rounded-[var(--rf-radius-md)] px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-[var(--rf-green)]"
                    >
                      <option value="">All Types</option>
                      {jobTypes.map((type) => (
                        <option key={type} value={type}>
                          {type}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-[var(--rf-text)] mb-2">
                      Salary Range (ZAR)
                    </label>
                    <div className="grid grid-cols-2 gap-2">
                      <input
                        type="number"
                        value={minSalary}
                        onChange={(e) => setMinSalary(e.target.value)}
                        placeholder="Min"
                        className="border border-[var(--rf-border)] rounded-[var(--rf-radius-md)] px-3 py-2 text-sm outline-none"
                      />
                      <input
                        type="number"
                        value={maxSalary}
                        onChange={(e) => setMaxSalary(e.target.value)}
                        placeholder="Max"
                        className="border border-[var(--rf-border)] rounded-[var(--rf-radius-md)] px-3 py-2 text-sm outline-none"
                      />
                    </div>
                  </div>

                  <button
                    onClick={applyFilters}
                    className="w-full py-3 bg-[var(--rf-green)] text-white rounded-[var(--rf-radius-md)] hover:bg-[#00B548] transition-colors font-semibold"
                  >
                    Apply Filters
                  </button>

                  <button
                    onClick={clearFilters}
                    className="w-full text-[var(--rf-green)] hover:underline text-sm font-semibold"
                  >
                    Clear All
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* Job Listings */}
          <div className="flex-1">
            {loading ? (
              <div className="text-center py-12">
                <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-[var(--rf-green)]"></div>
                <p className="text-[var(--rf-muted)] mt-4">Loading jobs...</p>
              </div>
            ) : jobs.length === 0 ? (
              <div className="bg-white rounded-[var(--rf-radius-lg)] shadow-[var(--rf-card-shadow)] p-12 text-center">
                <p className="text-[var(--rf-muted)] mb-4">No jobs found matching your criteria</p>
                <button
                  onClick={clearFilters}
                  className="px-6 py-2 bg-[var(--rf-green)] text-white rounded-[var(--rf-radius-md)] hover:bg-[#00B548] transition-colors"
                >
                  Clear Filters
                </button>
              </div>
            ) : (
              <div className="space-y-4">
                {jobs.map((job) => (
                  <div
                    key={job.id}
                    className="bg-white rounded-[var(--rf-radius-lg)] shadow-[var(--rf-card-shadow)] hover:shadow-lg transition-shadow p-6 relative"
                  >
                    {job.featured && (
                      <div className="absolute top-0 left-0 bg-[var(--rf-green)] text-white px-4 py-1 rounded-tl-[var(--rf-radius-lg)] rounded-br-[var(--rf-radius-md)] text-xs font-semibold">
                        Featured
                      </div>
                    )}
                    
                    <button
                      onClick={() => toggleSaveJob(job.id)}
                      className="absolute top-6 right-6 p-2 hover:bg-gray-100 rounded-full transition-colors"
                    >
                      <Heart
                        className={`w-5 h-5 ${savedJobs.has(job.id) ? 'fill-[var(--rf-orange)] text-[var(--rf-orange)]' : 'text-gray-400'}`}
                      />
                    </button>

                    <div className="flex items-start space-x-4 mb-4">
                      <div className="w-16 h-16 bg-gray-100 rounded-[var(--rf-radius-md)] flex items-center justify-center flex-shrink-0">
                        <Building2 className="w-8 h-8 text-[var(--rf-muted)]" />
                      </div>
                      
                      <div className="flex-1">
                        <Link to={`/jobs/${job.id}`} className="block">
                          <h3 className="text-xl font-bold text-[var(--rf-navy)] hover:text-[var(--rf-green)] transition-colors mb-1">
                            {job.title}
                          </h3>
                        </Link>
                        <div className="flex items-center space-x-2 text-[var(--rf-muted)] mb-2">
                          <span>{job.company || 'Company Name'}</span>
                          <CheckCircle className="w-4 h-4 text-[var(--rf-green)]" />
                        </div>
                        <div className="flex flex-wrap gap-2">
                          <span className="flex items-center text-sm text-[var(--rf-muted)]">
                            <MapPin className="w-4 h-4 mr-1" />
                            {job.location}
                          </span>
                          {job.salaryMin && job.salaryMax && (
                            <span className="flex items-center text-sm text-[var(--rf-muted)]">
                              <DollarSign className="w-4 h-4 mr-1" />
                              R{job.salaryMin.toLocaleString()} - R{job.salaryMax.toLocaleString()}
                            </span>
                          )}
                          <span className="px-3 py-1 bg-gray-100 text-[var(--rf-text)] rounded-[var(--rf-radius-pill)] text-xs font-medium">
                            {job.jobType || 'Full-time'}
                          </span>
                        </div>
                      </div>
                    </div>

                    <p className="text-[var(--rf-muted)] text-sm mb-4 line-clamp-2">
                      {job.description || 'Join our team and make an impact...'}
                    </p>

                    <div className="flex items-center justify-between">
                      <span className="text-xs text-[var(--rf-muted)]">
                        Posted {new Date(job.createdAt).toLocaleDateString()}
                      </span>
                      <div className="flex space-x-2">
                        <Link
                          to={`/jobs/${job.id}`}
                          className="px-6 py-2 bg-[var(--rf-orange)] text-white rounded-[var(--rf-radius-md)] hover:bg-[#E55C2E] transition-colors font-semibold"
                        >
                          Quick Apply
                        </Link>
                        <Link
                          to={`/jobs/${job.id}`}
                          className="px-6 py-2 border border-[var(--rf-green)] text-[var(--rf-green)] rounded-[var(--rf-radius-md)] hover:bg-[var(--rf-green)] hover:text-white transition-colors font-semibold"
                        >
                          View Job
                        </Link>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
