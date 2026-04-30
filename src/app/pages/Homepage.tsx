import { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router';
import { useAuth } from '../context/useAuth';
import { 
  Search, MapPin, Briefcase, Heart, CheckCircle, TrendingUp,
  Users, Building2, DollarSign, Code, Heart as HeartIcon,
  Stethoscope, Wrench, ShoppingCart, GraduationCap, Hammer,
  Coffee, Scale, LandPlot, Palette, Truck
} from 'lucide-react';
import { apiCall } from '../lib/supabase';
import { toast } from 'sonner';
import { resolveCompanyName } from '../lib/companyDisplay';

const industries = [
  { name: 'IT & Tech', icon: Code },
  { name: 'Finance & Accounting', icon: DollarSign },
  { name: 'Healthcare', icon: Stethoscope },
  { name: 'Engineering', icon: Wrench },
  { name: 'Sales & Marketing', icon: ShoppingCart },
  { name: 'Education', icon: GraduationCap },
  { name: 'Construction', icon: Hammer },
  { name: 'Hospitality', icon: Coffee },
  { name: 'Legal', icon: Scale },
  { name: 'Government', icon: LandPlot },
  { name: 'Creative & Design', icon: Palette },
  { name: 'Logistics', icon: Truck },
];

const popularTags = ['Remote', 'IT', 'Finance', 'Graduate', 'Durban', 'Cape Town'];

export default function Homepage() {
  const { user, profile } = useAuth();
  const navigate = useNavigate();
  const [searchKeyword, setSearchKeyword] = useState('');
  const [searchLocation, setSearchLocation] = useState('');
  const [searchIndustry, setSearchIndustry] = useState('');
  const [stats, setStats] = useState({ activeJobs: 0, seekers: 0, companies: 0 });
  const [featuredJobs, setFeaturedJobs] = useState<any[]>([]);
  const [savedJobs, setSavedJobs] = useState<Set<string>>(new Set());

  useEffect(() => {
    loadStats();
    loadFeaturedJobs();
  }, []);

  async function loadStats() {
    try {
      const data = await apiCall('/stats');
      setStats(data);
    } catch (error) {
      console.error('Error loading stats:', error);
    }
  }

  async function loadFeaturedJobs() {
    try {
      const { jobs } = await apiCall('/jobs');
      setFeaturedJobs(jobs.slice(0, 6));
    } catch (error) {
      console.error('Error loading featured jobs:', error);
    }
  }

  const handleSearch = () => {
    const params = new URLSearchParams();
    if (searchKeyword) params.set('search', searchKeyword);
    if (searchLocation) params.set('location', searchLocation);
    if (searchIndustry) params.set('industry', searchIndustry);
    navigate(`/jobs?${params.toString()}`);
  };

  const toggleSaveJob = async (jobId: string) => {
    try {
      if (savedJobs.has(jobId)) {
        await apiCall(`/saved-jobs/${jobId}`, { method: 'DELETE', requireAuth: true });
        setSavedJobs(prev => {
          const newSet = new Set(prev);
          newSet.delete(jobId);
          return newSet;
        });
        toast.success('Job removed from saved');
      } else {
        await apiCall('/saved-jobs', {
          requireAuth: true,
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
    <div className="w-full overflow-x-hidden">
      {/* Hero Section */}
      <section className="relative bg-gradient-to-r from-[var(--rf-navy)] to-[#0d3a5f] py-16 text-white sm:py-20">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="mb-10 text-center">
            <h1 className="mb-4 text-3xl font-bold leading-tight sm:text-4xl md:text-5xl">
              Find Work with a Friend by Your Side
            </h1>
            <p className="mx-auto max-w-3xl text-base text-gray-200 sm:text-lg md:text-xl">
              RecruitFriend connects thousands of South African job seekers with top employers every day.
            </p>
          </div>

          {/* Search Bar */}
          <div className="mx-auto max-w-4xl rounded-[var(--rf-radius-lg)] bg-white p-4 shadow-[var(--rf-modal-shadow)] sm:p-5">
            <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
              <div className="md:col-span-2">
                <div className="flex items-center space-x-2 border border-[var(--rf-border)] rounded-[var(--rf-radius-md)] px-4 py-3 bg-white">
                  <Search className="w-5 h-5 text-[var(--rf-muted)]" />
                  <input
                    type="text"
                    placeholder="Job Title or Keywords"
                    value={searchKeyword}
                    onChange={(e) => setSearchKeyword(e.target.value)}
                    onKeyPress={(e) => e.key === 'Enter' && handleSearch()}
                    className="flex-1 outline-none text-[var(--rf-text)]"
                  />
                </div>
              </div>
              <div>
                <div className="flex items-center space-x-2 border border-[var(--rf-border)] rounded-[var(--rf-radius-md)] px-4 py-3 bg-white">
                  <MapPin className="w-5 h-5 text-[var(--rf-muted)]" />
                  <input
                    type="text"
                    placeholder="Province"
                    value={searchLocation}
                    onChange={(e) => setSearchLocation(e.target.value)}
                    onKeyPress={(e) => e.key === 'Enter' && handleSearch()}
                    className="flex-1 outline-none text-[var(--rf-text)]"
                  />
                </div>
              </div>
              <button
                onClick={handleSearch}
                className="w-full rounded-[var(--rf-radius-md)] bg-[var(--rf-green)] px-6 py-3 font-semibold text-white transition-colors hover:bg-[#00B548] md:w-auto"
              >
                Find Jobs
              </button>
            </div>
            
            {/* Popular Tags */}
            <div className="mt-4 flex flex-wrap gap-2">
              {popularTags.map((tag) => (
                <button
                  key={tag}
                  onClick={() => {
                    setSearchKeyword(tag);
                    handleSearch();
                  }}
                  className="px-4 py-1.5 bg-gray-100 text-[var(--rf-text)] rounded-[var(--rf-radius-pill)] text-sm hover:bg-[var(--rf-green)] hover:text-white transition-colors"
                >
                  {tag}
                </button>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* Stats Bar */}
      {/* <section className="bg-white py-8 border-b border-[var(--rf-border)]">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-1 gap-4 text-center sm:grid-cols-2 md:grid-cols-4 md:gap-6">
            <div>
              <div className="text-3xl font-bold text-[var(--rf-navy)]">{stats.activeJobs.toLocaleString()}+</div>
              <div className="text-[var(--rf-muted)] text-sm mt-1">Jobs Available</div>
            </div>
            <div>
              <div className="text-3xl font-bold text-[var(--rf-navy)]">{stats.seekers.toLocaleString()}+</div>
              <div className="text-[var(--rf-muted)] text-sm mt-1">Registered Candidates</div>
            </div>
            <div>
              <div className="text-3xl font-bold text-[var(--rf-navy)]">{stats.companies.toLocaleString()}+</div>
              <div className="text-[var(--rf-muted)] text-sm mt-1">Hiring Companies</div>
            </div>
            <div>
              <div className="text-3xl font-bold text-[var(--rf-navy)]">R500M+</div>
              <div className="text-[var(--rf-muted)] text-sm mt-1">Salaries Posted</div>
            </div>
          </div>
        </div>
      </section> */}

      {/* Browse by Category */}
      <section className="py-16 bg-[var(--rf-bg)]">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <h2 className="mb-8 text-center text-2xl font-bold text-[var(--rf-navy)] sm:text-3xl">
            Explore Jobs by Industry
          </h2>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-6">
            {industries.map((industry) => {
              const Icon = industry.icon;
              return (
                <button
                  key={industry.name}
                  onClick={() => {
                    setSearchIndustry(industry.name);
                    navigate(`/jobs?industry=${encodeURIComponent(industry.name)}`);
                  }}
                  className="bg-white p-6 rounded-[var(--rf-radius-lg)] shadow-[var(--rf-card-shadow)] hover:shadow-lg transition-all hover:scale-105 flex flex-col items-center text-center group"
                >
                  <Icon className="w-8 h-8 text-[var(--rf-green)] mb-2 group-hover:scale-110 transition-transform" />
                  <span className="text-sm font-medium text-[var(--rf-text)]">{industry.name}</span>
                </button>
              );
            })}
          </div>
        </div>
      </section>

      {/* Featured Jobs */}
      <section className="py-16">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="mb-8 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <h2 className="flex items-center text-2xl font-bold text-[var(--rf-navy)] sm:text-3xl">
              Hot Jobs Right Now
            </h2>
            <Link to="/jobs" className="text-[var(--rf-green)] hover:underline font-semibold">
              View All →
            </Link>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {featuredJobs.map((job) => (
              <div
                key={job.id}
                className="bg-white rounded-[var(--rf-radius-lg)] shadow-[var(--rf-card-shadow)] hover:shadow-lg transition-shadow p-6 relative"
              >
                <button
                  onClick={() => toggleSaveJob(job.id)}
                  className="absolute top-4 right-4 p-2 hover:bg-gray-100 rounded-full transition-colors"
                >
                  <Heart
                    className={`w-5 h-5 ${savedJobs.has(job.id) ? 'fill-[var(--rf-orange)] text-[var(--rf-orange)]' : 'text-gray-400'}`}
                  />
                </button>
                
                <div className="mb-4">
                  <h3 className="text-lg font-bold text-[var(--rf-navy)] mb-2">{job.title}</h3>
                  <div className="flex flex-wrap items-center gap-2 text-[var(--rf-muted)] text-sm">
                    <Building2 className="w-4 h-4" />
                    <span>{resolveCompanyName(job?.employer, job?.company || 'Company Name')}</span>
                    <CheckCircle className="w-4 h-4 text-[var(--rf-green)]" />
                  </div>
                </div>

                <div className="space-y-2 mb-4">
                  <div className="flex flex-wrap items-center gap-2 text-sm text-[var(--rf-muted)]">
                    <MapPin className="w-4 h-4" />
                    <span>{job.location}</span>
                    {job.remoteType === 'remote' && (
                      <span className="px-2 py-0.5 bg-[var(--rf-green)] bg-opacity-10 text-[var(--rf-green)] rounded-[var(--rf-radius-pill)] text-xs font-semibold">
                        Remote
                      </span>
                    )}
                  </div>
                  {job.salaryMin && job.salaryMax && (
                    <div className="flex items-center space-x-2 text-sm text-[var(--rf-muted)]">
                      <DollarSign className="w-4 h-4" />
                      <span>R{job.salaryMin.toLocaleString()} - R{job.salaryMax.toLocaleString()}</span>
                    </div>
                  )}
                  <div className="flex items-center space-x-2">
                    <span className="px-3 py-1 bg-gray-100 text-[var(--rf-text)] rounded-[var(--rf-radius-pill)] text-xs font-medium">
                      {job.jobType || 'Full-time'}
                    </span>
                  </div>
                </div>

                <Link
                  to={`/jobs/${job.id}`}
                  className="block w-full text-center px-4 py-2 bg-[var(--rf-green)] text-white rounded-[var(--rf-radius-md)] hover:bg-[#00B548] transition-colors font-semibold"
                >
                  Apply
                </Link>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Dual CTA Banner */}
      <section className="py-16">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
            <div className="rounded-[var(--rf-radius-lg)] bg-[var(--rf-navy)] p-8 text-white shadow-[var(--rf-card-shadow)] sm:p-10">
              <Users className="w-12 h-12 mb-4 text-[var(--rf-green)]" />
              <h3 className="text-2xl font-bold mb-2">Looking for work?</h3>
              <p className="text-gray-200 mb-6">
                Create your profile and start applying to thousands of jobs today.
              </p>
              <Link
                to="/signup?type=seeker"
                className="inline-flex w-full justify-center rounded-[var(--rf-radius-pill)] bg-white px-8 py-3 font-semibold text-[var(--rf-navy)] transition-colors hover:bg-gray-100 sm:w-auto"
              >
                Register as Job Seeker
              </Link>
            </div>
            
            <div className="rounded-[var(--rf-radius-lg)] bg-[var(--rf-green)] p-8 text-white shadow-[var(--rf-card-shadow)] sm:p-10">
              <Building2 className="w-12 h-12 mb-4 text-white" />
              <h3 className="text-2xl font-bold mb-2">Looking for talent?</h3>
              <p className="text-green-100 mb-6">
                Post your job and connect with qualified South African talent.
              </p>
              <Link
                to={user ? (profile?.userType === 'employer' ? '/employer/post-job' : '/seeker/dashboard') : '/signup?type=employer'}
                className="inline-flex w-full justify-center rounded-[var(--rf-radius-pill)] bg-white px-8 py-3 font-semibold text-[var(--rf-green)] transition-colors hover:bg-gray-100 sm:w-auto"
              >
                {user && profile?.userType === 'employer' ? 'Post a Job' : 'Post a Job'}
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* Testimonials */}
      
    </div>
  );
}
