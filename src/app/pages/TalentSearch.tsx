import { useCallback, useEffect, useMemo, useState } from 'react';
import { CheckCircle, MapPin, Search, Video, Briefcase, Loader2, Mail } from 'lucide-react';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Avatar, AvatarFallback } from '../components/ui/avatar';
import { Card, CardContent } from '../components/ui/card';
import { Checkbox } from '../components/ui/checkbox';
import { apiCall } from '../lib/supabase';
import { toast } from 'sonner';
import { useAuth } from '../context/useAuth';

type ExperienceLevel = 'entry' | 'junior' | 'mid' | 'senior';

interface Candidate {
   id: string;
   name: string;
   email: string;
   headline: string;
   summary: string;
   location: string;
   avatar_url: string | null;
   skills: string[];
   yearsOfExperience: number;
   experienceLevel: ExperienceLevel;
   video_introduction: string | null;
}

const EXPERIENCE_LEVEL_OPTIONS: Array<{ label: string; value: ExperienceLevel }> = [
   { label: 'Entry Level', value: 'entry' },
   { label: 'Junior (1-2y)', value: 'junior' },
   { label: 'Mid-Level (3-5y)', value: 'mid' },
   { label: 'Senior (5+y)', value: 'senior' },
];

function normalizeSubscription(value: unknown) {
   return String(value || '').trim().toLowerCase();
}

function formatExperience(level: ExperienceLevel, years: number) {
   if (Number.isFinite(years) && years > 0) {
      const rounded = Math.round(years * 10) / 10;
      return `${rounded}y experience`;
   }

   const map: Record<ExperienceLevel, string> = {
      entry: 'Entry level',
      junior: 'Junior',
      mid: 'Mid-level',
      senior: 'Senior',
   };

   return map[level] || 'Experience not specified';
}

export default function TalentSearch() {
    const { profile } = useAuth();
    const subscription = normalizeSubscription(profile?.subscription);
    const [isLocked, setIsLocked] = useState(
       subscription === 'starter' || subscription === 'free' || subscription === ''
    );

    const [query, setQuery] = useState('');
    const [locationFilter, setLocationFilter] = useState('');
    const [selectedLevels, setSelectedLevels] = useState<ExperienceLevel[]>([]);
    const [hasVideoOnly, setHasVideoOnly] = useState(false);
    const [sortBy, setSortBy] = useState<'relevance' | 'newest' | 'name'>('relevance');

    const [candidates, setCandidates] = useState<Candidate[]>([]);
    const [totalCount, setTotalCount] = useState(0);
    const [loading, setLoading] = useState(false);

    useEffect(() => {
       if (!profile) return;
       const current = normalizeSubscription(profile.subscription);
       const shouldLock = current === 'starter' || current === 'free' || current === '';
       setIsLocked(shouldLock);
    }, [profile]);

    const fetchCandidates = useCallback(async () => {
       if (isLocked) return;

       setLoading(true);
       try {
          const params = new URLSearchParams();
          if (query.trim()) params.set('search', query.trim());
          if (locationFilter.trim()) params.set('location', locationFilter.trim());
          if (selectedLevels.length > 0) params.set('levels', selectedLevels.join(','));
          if (hasVideoOnly) params.set('hasVideo', 'true');
          params.set('sort', sortBy);
          params.set('page', '1');
          params.set('limit', '50');

          const { candidates: rows = [], totalCount: total = 0 } = await apiCall(
             `/employer/talent-search?${params.toString()}`,
             { requireAuth: true }
          );

          setCandidates(rows);
          setTotalCount(total);
       } catch (error: any) {
          toast.error(error.message || 'Failed to search candidates');
       } finally {
          setLoading(false);
       }
    }, [hasVideoOnly, isLocked, locationFilter, query, selectedLevels, sortBy]);

    useEffect(() => {
       void fetchCandidates();
    }, [fetchCandidates]);

    const activeFiltersCount = useMemo(() => {
       return [
          query.trim().length > 0,
          locationFilter.trim().length > 0,
          selectedLevels.length > 0,
          hasVideoOnly,
       ].filter(Boolean).length;
    }, [hasVideoOnly, locationFilter, query, selectedLevels.length]);

    function toggleLevel(level: ExperienceLevel) {
       setSelectedLevels((prev) =>
          prev.includes(level) ? prev.filter((item) => item !== level) : [...prev, level]
       );
    }

    function clearFilters() {
       setQuery('');
       setLocationFilter('');
       setSelectedLevels([]);
       setHasVideoOnly(false);
       setSortBy('relevance');
    }

   return (
     <div className="space-y-6 h-full flex flex-col relative overflow-hidden">
        
        {/* Upgrade Overlay if Locked */}
        {isLocked && (
           <div className="absolute inset-0 bg-white/60 backdrop-blur-sm z-50 flex flex-col items-center justify-center text-center p-8">
              <div className="bg-white p-6 rounded-2xl shadow-xl max-w-md w-full border border-gray-100 ring-1 ring-black/5 animate-in fade-in zoom-in duration-500">
                 <div className="bg-green-50 w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4 text-[#00C853]">
                    <Search className="w-8 h-8" />
                 </div>
                 <h2 className="text-2xl font-bold text-[#0A2540] mb-2">Unlock Talent Search</h2>
                 <p className="text-gray-500 mb-6 px-4">
                    Upgrade to our <strong className="text-[#00C853]">Growth Plan</strong> to search our database of 48,000+ candidates and invite them to apply.
                 </p>
                 <ul className="text-left space-y-3 mb-8 bg-gray-50 p-4 rounded-lg text-sm text-gray-600">
                    <li className="flex items-center gap-2"><CheckCircle className="w-4 h-4 text-[#00C853]" /> Access full CV database</li>
                    <li className="flex items-center gap-2"><CheckCircle className="w-4 h-4 text-[#00C853]" /> Filter by skills & experience</li>
                    <li className="flex items-center gap-2"><CheckCircle className="w-4 h-4 text-[#00C853]" /> Watch video introductions</li>
                 </ul>
                 <div className="space-y-3">
                    <Button className="w-full bg-[#00C853] hover:bg-[#00B548] text-white shadow-lg shadow-green-500/20 py-6 text-lg">
                       Upgrade to Unlock
                    </Button>
                    <button onClick={() => setIsLocked(false)} className="text-sm text-gray-400 hover:text-gray-600 underline">
                       Preview (Demo Mode)
                    </button>
                 </div>
              </div>
           </div>
        )}

        {/* Header */}
        <div className="bg-[#0A2540] text-white p-8 rounded-xl relative overflow-hidden shadow-lg">
           <div className="relative z-10 max-w-3xl">
              <h1 className="text-3xl font-bold mb-2">Search Candidate Database</h1>
              <p className="text-blue-200 mb-6">Find the perfect talent from 48,000+ verified job seekers.</p>
              
              <div className="flex gap-2">
                 <div className="relative flex-1">
                    <Search className="absolute left-4 top-3.5 w-5 h-5 text-gray-400" />
                    <Input 
                      value={query}
                      onChange={(event) => setQuery(event.target.value)}
                      onKeyDown={(event) => {
                        if (event.key === 'Enter') {
                          event.preventDefault();
                          void fetchCandidates();
                        }
                      }}
                      placeholder="Search by skills, job title, qualifications..." 
                      className="pl-12 h-12 bg-white text-[#0A2540] border-none focus:ring-2 focus:ring-[#00C853]"
                    />
                 </div>
                 <Button onClick={() => void fetchCandidates()} className="h-12 px-8 bg-[#00C853] hover:bg-[#00B548] text-white font-bold text-base shadow-lg shadow-green-900/20">
                    Search
                 </Button>
              </div>
           </div>
           
           {/* Background Pattern */}
           <div className="absolute right-0 top-0 bottom-0 w-1/3 opacity-10 bg-gradient-to-l from-white to-transparent pointer-events-none"></div>
        </div>

        <div className="flex flex-col lg:flex-row gap-8 min-h-[500px]">
           
           {/* Filters Sidebar */}
           <div className="w-full lg:w-72 space-y-6 flex-shrink-0 bg-white p-6 rounded-xl border border-gray-100 h-fit sticky top-6 shadow-sm">
              <div className="flex items-center justify-between">
                 <h3 className="font-bold text-[#0A2540]">Filters</h3>
                 <button onClick={clearFilters} className="text-xs text-gray-500 hover:text-[#0A2540]">Clear All</button>
              </div>
              
              <div className="space-y-4">
                 <div className="space-y-2">
                    <label className="text-sm font-medium text-gray-700">Location</label>
                    <Input value={locationFilter} onChange={(event) => setLocationFilter(event.target.value)} placeholder="City or Province" />
                 </div>
                 
                 <div className="space-y-2">
                    <label className="text-sm font-medium text-gray-700">Experience Level</label>
                    <div className="space-y-2">
                       {EXPERIENCE_LEVEL_OPTIONS.map((level) => (
                          <div key={level} className="flex items-center space-x-2">
                             <Checkbox
                               id={level.value}
                               checked={selectedLevels.includes(level.value)}
                               onCheckedChange={() => toggleLevel(level.value)}
                             />
                             <label htmlFor={level.value} className="text-sm text-gray-600">{level.label}</label>
                          </div>
                       ))}
                    </div>
                 </div>

                 <div className="space-y-2">
                    <div className="flex items-center justify-between">
                       <label className="text-sm font-medium text-gray-700">Has Video Intro</label>
                       <Checkbox checked={hasVideoOnly} onCheckedChange={(checked) => setHasVideoOnly(Boolean(checked))} />
                    </div>
                 </div>

                 <Button onClick={() => void fetchCandidates()} className="w-full bg-[#0A2540] text-white hover:bg-[#081f36]">Apply Filters</Button>
              </div>
           </div>

           {/* Results Grid */}
           <div className="flex-1 space-y-4">
              <div className="flex justify-between items-center text-sm text-gray-500">
                         <span>Showing {candidates.length} of {totalCount} candidates {activeFiltersCount > 0 ? `(filtered)` : ''}</span>
                         <select
                              value={sortBy}
                              onChange={(event) => setSortBy(event.target.value as 'relevance' | 'newest' | 'name')}
                              className="bg-transparent border-none outline-none font-medium text-[#0A2540] cursor-pointer hover:bg-gray-50 rounded px-2 py-1"
                         >
                              <option value="relevance">Sort by: Relevance</option>
                              <option value="newest">Newest First</option>
                              <option value="name">Name (A-Z)</option>
                 </select>
              </div>

                     {loading ? (
                         <div className="flex items-center justify-center py-20 bg-white rounded-xl border border-gray-100">
                              <Loader2 className="w-6 h-6 animate-spin text-[#0A2540]" />
                              <span className="ml-3 text-sm text-gray-500">Searching candidates...</span>
                         </div>
                     ) : candidates.length > 0 ? (
                 candidates.map(candidate => (
                 <Card key={candidate.id} className="border-none shadow-sm hover:shadow-md transition-all hover:border-gray-200 group">
                    <CardContent className="p-6">
                                 <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                                    <div className="flex items-start gap-3">
                                       <Avatar className="h-12 w-12">
                                          <AvatarFallback className="bg-[#0A2540] text-white">
                                             {(candidate.name || 'C').split(' ').map((part) => part[0]).join('').slice(0, 2)}
                                          </AvatarFallback>
                                       </Avatar>
                                       <div>
                                          <h3 className="font-bold text-[#0A2540]">{candidate.name}</h3>
                                          <p className="text-sm text-gray-500">{candidate.headline || 'No headline provided'}</p>
                                          <div className="mt-2 flex flex-wrap items-center gap-3 text-xs text-gray-500">
                                             <span className="inline-flex items-center gap-1"><MapPin className="w-3.5 h-3.5" /> {candidate.location || 'South Africa'}</span>
                                             <span className="inline-flex items-center gap-1"><Briefcase className="w-3.5 h-3.5" /> {formatExperience(candidate.experienceLevel, candidate.yearsOfExperience)}</span>
                                             <span className="inline-flex items-center gap-1"><Mail className="w-3.5 h-3.5" /> {candidate.email || 'No email listed'}</span>
                                             {candidate.video_introduction ? (
                                                <span className="inline-flex items-center gap-1 text-[#00A651]"><Video className="w-3.5 h-3.5" /> Video intro</span>
                                             ) : null}
                                          </div>
                                       </div>
                                    </div>

                                    {candidate.video_introduction ? (
                                       <Button
                                          variant="outline"
                                          onClick={() => window.open(candidate.video_introduction as string, '_blank', 'noopener,noreferrer')}
                                       >
                                          Watch Intro
                                       </Button>
                                    ) : null}
                                 </div>

                                 {candidate.summary ? (
                                    <p className="mt-4 text-sm text-gray-600 line-clamp-3">{candidate.summary}</p>
                                 ) : null}

                                 <div className="mt-4 flex flex-wrap gap-2">
                                    {candidate.skills.length > 0 ? (
                                       candidate.skills.slice(0, 8).map((skill) => (
                                          <span key={`${candidate.id}-${skill}`} className="px-2 py-1 rounded-full text-xs bg-blue-50 text-blue-700 border border-blue-100">
                                             {skill}
                                          </span>
                                       ))
                                    ) : (
                                       <span className="text-xs text-gray-400">No skills listed</span>
                                    )}
                                 </div>
                    </CardContent>
                 </Card>
                 ))
               ) : (
                  <div className="flex flex-col items-center justify-center py-20 bg-white rounded-xl border-dashed border-2 border-gray-100">
                      <div className="bg-gray-50 p-4 rounded-full mb-4">
                         <Search className="w-8 h-8 text-gray-300" />
                      </div>
                      <h3 className="font-bold text-[#0A2540] text-lg mb-1">No candidates found</h3>
                      <p className="text-gray-500 text-sm">Try using different search terms or clearing filters.</p>
                  </div>
               )}
              
           </div>
        </div>
     </div>
   );
}
