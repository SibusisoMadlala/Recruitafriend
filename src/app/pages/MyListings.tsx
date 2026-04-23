import { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router';
import { Filter, Eye, EyeOff, Users, Briefcase, Trash2 } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '../components/ui/button';
import { Badge } from '../components/ui/badge';
import { apiCall } from '../lib/supabase';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '../components/ui/alert-dialog';

interface Listing {
  id: string;
  title: string;
  employment_type: string | null;
  work_location: string | null;
  city: string | null;
  province: string | null;
  status: 'active' | 'closed' | 'draft';
  is_visible?: boolean;
  views: number;
  apps: number;
  created_at: string;
}

export default function MyListings() {
  const navigate = useNavigate();
  const [activeFilter, setActiveFilter] = useState('all');
  const [search, setSearch] = useState('');
  const [listings, setListings] = useState<Listing[]>([]);
  const [loading, setLoading] = useState(true);
  const [deleteListingId, setDeleteListingId] = useState<string | null>(null);

  useEffect(() => {
    loadListings();
  }, []);

  async function loadListings() {
    setLoading(true);
    try {
      const { jobs } = await apiCall('/employer/jobs');
      setListings(jobs || []);
    } catch (err: any) {
      toast.error(err.message || 'Failed to load listings');
    } finally {
      setLoading(false);
    }
  }

  async function toggleVisibility(job: Listing) {
    const next = !(job.is_visible ?? true);
    try {
      await apiCall(`/jobs/${job.id}`, { method: 'PUT', body: JSON.stringify({ is_visible: next }) });
      setListings(prev => prev.map(l => l.id === job.id ? { ...l, is_visible: next } : l));
      toast.success(`Listing is now ${next ? 'visible' : 'hidden'}`);
    } catch (err: any) {
      toast.error(err.message || 'Failed to update listing visibility');
    }
  }

  async function deleteListing(id: string) {
    try {
      await apiCall(`/jobs/${id}`, { method: 'DELETE' });
      setListings(prev => prev.filter(l => l.id !== id));
      toast.success('Listing deleted');
    } catch (err: any) {
      toast.error(err.message || 'Failed to delete listing');
    }
  }

  const getStatusStyle = (status: string) => {
    switch (status) {
      case 'active':  return 'bg-green-100 text-green-700';
      case 'closed':  return 'bg-yellow-100 text-yellow-700';
      case 'draft':   return 'bg-gray-100 text-gray-700';
      default:        return 'bg-gray-100 text-gray-700';
    }
  };

  const filtered = listings.filter(l => {
    const matchFilter = activeFilter === 'all' || l.status === activeFilter;
    const matchSearch = !search || l.title.toLowerCase().includes(search.toLowerCase());
    return matchFilter && matchSearch;
  });

  return (
    <div className="space-y-6">

      {/* Header */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 bg-white p-6 rounded-xl shadow-sm border border-gray-100 sticky top-0 z-10 backdrop-blur-lg bg-opacity-90">
        <div>
          <h1 className="text-2xl font-bold text-[#0A2540]">My Job Listings</h1>
          <p className="text-gray-500 text-sm">Manage your open positions and track performance.</p>
        </div>
        <Button
          className="bg-[#00C853] hover:bg-[#00B548] text-white shadow-lg shadow-green-500/20 transform transition-transform hover:-translate-y-0.5"
          onClick={() => navigate('/employer/post-job')}
        >
          + Post New Job
        </Button>
      </div>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-4 justify-between items-center bg-white p-2 rounded-lg border border-gray-100">
        <div className="flex gap-1 overflow-x-auto pb-1 sm:pb-0 w-full sm:w-auto">
          {['All', 'Active', 'Closed', 'Draft'].map(f => (
            <button
              key={f}
              onClick={() => setActiveFilter(f.toLowerCase())}
              className={`px-4 py-2 rounded-md text-sm font-medium transition-colors whitespace-nowrap ${
                activeFilter === f.toLowerCase()
                  ? 'bg-[#0A2540] text-white shadow-sm'
                  : 'text-gray-500 hover:text-[#0A2540] hover:bg-gray-50'
              }`}
            >
              {f}
              {f !== 'All' && (
                <span className="ml-1 text-xs opacity-70">
                  ({listings.filter(l => l.status === f.toLowerCase()).length})
                </span>
              )}
            </button>
          ))}
        </div>

        <div className="flex items-center gap-2 border border-gray-200 rounded-md px-3 py-2 bg-gray-50/50 focus-within:bg-white focus-within:ring-2 focus-within:ring-[#00C853]/20 transition-all w-full sm:w-auto">
          <Filter className="w-4 h-4 text-gray-400 flex-shrink-0" />
          <input
            type="text"
            placeholder="Search listings..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="bg-transparent border-none outline-none text-sm w-full placeholder-gray-400 text-[#0A2540]"
          />
        </div>
      </div>

      {/* Cards */}
      <div className="grid grid-cols-1 gap-4">
        {loading ? (
          Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="bg-white rounded-xl border border-gray-100 p-5 animate-pulse h-24" />
          ))
        ) : filtered.length > 0 ? (
          filtered.map(job => (
            <div key={job.id} className="bg-white rounded-xl shadow-sm border border-gray-100 p-5 transition-all hover:shadow-md hover:border-gray-200">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">

                {/* Left: title + meta */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-3 flex-wrap">
                    <h3 className="font-bold text-[#0A2540] text-lg">{job.title}</h3>
                    <span className={`px-2 py-0.5 rounded-full text-xs font-semibold capitalize ${getStatusStyle(job.status)}`}>
                      {job.status}
                    </span>
                    <span className={`px-2 py-0.5 rounded-full text-xs font-semibold ${(job.is_visible ?? true) ? 'bg-emerald-100 text-emerald-700' : 'bg-gray-200 text-gray-700'}`}>
                      {(job.is_visible ?? true) ? 'visible' : 'hidden'}
                    </span>
                  </div>
                  <div className="flex gap-3 mt-1 text-sm text-gray-500 flex-wrap">
                    {job.employment_type && <span>{job.employment_type}</span>}
                    {job.work_location && <span>· {job.work_location}</span>}
                    {job.city && <span>· {job.city}</span>}
                    {job.province && <span>· {job.province}</span>}
                    <span>· Posted {new Date(job.created_at).toLocaleDateString()}</span>
                  </div>
                </div>

                {/* Center: stats */}
                <div className="flex items-center gap-6 text-sm text-gray-600 flex-shrink-0">
                  <div className="flex items-center gap-1.5">
                    <Eye className="w-4 h-4 text-gray-400" />
                    <span className="font-semibold text-[#0A2540]">{job.views}</span>
                    <span>views</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <Users className="w-4 h-4 text-gray-400" />
                    <span className="font-semibold text-[#0A2540]">{job.apps}</span>
                    <span>applicants</span>
                  </div>
                </div>

                {/* Right: actions */}
                <div className="flex items-center gap-2 flex-shrink-0">
                  <Link to={`/employer/applicants/${job.id}`}>
                    <Button variant="outline" size="sm" className="text-xs border-gray-200">
                      <Users className="w-3.5 h-3.5 mr-1" /> View Applicants
                    </Button>
                  </Link>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="text-gray-500 hover:text-[#0A2540]"
                    title={(job.is_visible ?? true) ? 'Hide listing from job seekers' : 'Show listing to job seekers'}
                    onClick={() => toggleVisibility(job)}
                  >
                    {(job.is_visible ?? true)
                      ? <EyeOff className="w-4 h-4" />
                      : <Eye className="w-4 h-4 text-green-600" />
                    }
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="text-red-400 hover:text-red-600 hover:bg-red-50"
                    title="Delete listing"
                    onClick={() => setDeleteListingId(job.id)}
                  >
                    <Trash2 className="w-4 h-4" />
                  </Button>
                </div>
              </div>
            </div>
          ))
        ) : (
          <div className="flex flex-col items-center justify-center p-12 bg-white rounded-xl border-dashed border-2 border-gray-200">
            <div className="bg-gray-50 p-4 rounded-full mb-3">
              <Briefcase className="w-8 h-8 text-gray-300" />
            </div>
            <h3 className="text-lg font-bold text-[#0A2540]">No listings found</h3>
            <p className="text-gray-500 text-sm mb-4">
              {search ? 'No jobs match your search.' : "You haven't posted any jobs yet."}
            </p>
            <Button className="bg-[#00C853] hover:bg-[#00B548] text-white" onClick={() => navigate('/employer/post-job')}>
              Post a Job
            </Button>
          </div>
        )}
      </div>

      <AlertDialog open={Boolean(deleteListingId)} onOpenChange={(open) => !open && setDeleteListingId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete this listing?</AlertDialogTitle>
            <AlertDialogDescription>This action cannot be undone.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="bg-red-600 hover:bg-red-700"
              onClick={() => {
                if (!deleteListingId) return;
                void deleteListing(deleteListingId);
                setDeleteListingId(null);
              }}
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
