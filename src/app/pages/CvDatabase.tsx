// TEMP: CV database access is open while Recruitfriend is testing.
// Do not permanently remove subscription logic — re-enable gating after testing.

import { useEffect, useMemo, useState } from 'react';
import { Search, MapPin, Briefcase, User, FileText, MessageSquare, Loader2, ChevronRight } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { toast } from 'sonner';
import { useNavigate } from 'react-router';

type Candidate = {
  id: string;
  name: string | null;
  email: string;
  headline: string | null;
  summary: string | null;
  cv_ai_summary: string | null;
  location: string | null;
  avatar_url: string | null;
  skills: string[];
  cv_job_titles: string[];
  cv_qualifications: string[];
  cv_years_experience: number | null;
};

const ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'.split('');

export default function CvDatabase() {
  const navigate = useNavigate();
  const [candidates, setCandidates] = useState<Candidate[]>([]);
  const [loading, setLoading]       = useState(true);
  const [search, setSearch]         = useState('');
  const [activeLetter, setActiveLetter] = useState<string | null>(null);

  useEffect(() => { load(); }, []);

  async function load() {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('id, name, email, headline, summary, cv_ai_summary, location, avatar_url, skills, cv_job_titles, cv_qualifications, cv_years_experience')
        .eq('user_type', 'seeker')
        .eq('has_cv', true)
        .order('name', { ascending: true });
      if (error) throw error;
      setCandidates((data ?? []) as Candidate[]);
    } catch (err: any) {
      toast.error('Failed to load CV database: ' + (err?.message || 'Unknown error'));
    } finally {
      setLoading(false);
    }
  }

  const q = search.toLowerCase().trim();

  const filtered = useMemo(() => {
    let list = candidates;
    if (activeLetter) {
      list = list.filter(c => (c.name || '').toUpperCase().startsWith(activeLetter));
    }
    if (q) {
      list = list.filter(c => {
        const fields = [
          c.name, c.headline, c.location, c.summary, c.cv_ai_summary,
          ...(c.skills ?? []),
          ...(c.cv_job_titles ?? []),
          ...(c.cv_qualifications ?? []),
        ];
        return fields.some(f => f?.toLowerCase().includes(q));
      });
    }
    return list;
  }, [candidates, q, activeLetter]);

  // Group by first letter
  const grouped = useMemo(() => {
    const map = new Map<string, Candidate[]>();
    for (const c of filtered) {
      const letter = (c.name || '?')[0].toUpperCase();
      if (!map.has(letter)) map.set(letter, []);
      map.get(letter)!.push(c);
    }
    return map;
  }, [filtered]);

  const availableLetters = useMemo(() =>
    new Set(candidates.map(c => (c.name || '?')[0].toUpperCase()))
  , [candidates]);

  function startChat(candidateId: string) {
    // Navigate to talent search which has messaging, or trigger a chat
    navigate(`/employer/talent-search?chat=${candidateId}`);
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="bg-[#0A2540] text-white p-8 rounded-xl relative overflow-hidden shadow-lg">
        <div className="relative z-10">
          <h1 className="text-3xl font-bold mb-1">CV Database</h1>
          <p className="text-blue-200 text-sm mb-5">
            {candidates.length} candidate{candidates.length !== 1 ? 's' : ''} with uploaded CVs
          </p>
          <div className="flex gap-2 max-w-2xl">
            <div className="relative flex-1">
              <Search className="absolute left-4 top-3.5 w-5 h-5 text-gray-400" />
              <input
                value={search}
                onChange={e => setSearch(e.target.value)}
                placeholder="Search CVs by name, skills, job title, location or experience…"
                className="w-full pl-12 pr-4 h-12 rounded-lg bg-white text-[#0A2540] text-sm outline-none"
              />
            </div>
            {search && (
              <button
                onClick={() => setSearch('')}
                className="h-12 px-5 bg-white/10 hover:bg-white/20 text-white rounded-lg text-sm font-medium"
              >
                Clear
              </button>
            )}
          </div>
        </div>
        <div className="absolute right-0 top-0 bottom-0 w-1/3 bg-gradient-to-l from-white/5 to-transparent pointer-events-none" />
      </div>

      {/* Alphabet filter */}
      <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-4">
        <div className="flex flex-wrap gap-1">
          <button
            onClick={() => setActiveLetter(null)}
            className={`px-3 py-1.5 rounded-md text-sm font-semibold transition-colors ${!activeLetter ? 'bg-[#0A2540] text-white' : 'text-gray-500 hover:bg-gray-100'}`}
          >
            All
          </button>
          {ALPHABET.map(letter => (
            <button
              key={letter}
              onClick={() => setActiveLetter(activeLetter === letter ? null : letter)}
              disabled={!availableLetters.has(letter)}
              className={`w-8 h-8 rounded-md text-sm font-semibold transition-colors ${
                activeLetter === letter
                  ? 'bg-[#0A2540] text-white'
                  : availableLetters.has(letter)
                  ? 'text-[#0A2540] hover:bg-blue-50'
                  : 'text-gray-200 cursor-default'
              }`}
            >
              {letter}
            </button>
          ))}
        </div>
      </div>

      {/* Results */}
      {loading ? (
        <div className="flex items-center justify-center py-20 bg-white rounded-xl border border-gray-100">
          <Loader2 className="w-6 h-6 animate-spin text-[#0A2540] mr-3" />
          <span className="text-gray-500 text-sm">Loading CV database…</span>
        </div>
      ) : filtered.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 bg-white rounded-xl border-2 border-dashed border-gray-100">
          <FileText className="w-12 h-12 text-gray-200 mb-4" />
          <h3 className="font-bold text-[#0A2540] text-lg mb-1">No candidates found</h3>
          <p className="text-gray-400 text-sm">
            {candidates.length === 0
              ? 'No candidates have uploaded CVs yet.'
              : 'Try a different search or letter filter.'}
          </p>
        </div>
      ) : (
        <div className="space-y-8">
          {Array.from(grouped.entries()).sort(([a], [b]) => a.localeCompare(b)).map(([letter, group]) => (
            <div key={letter}>
              {/* Letter heading */}
              <div className="flex items-center gap-3 mb-4">
                <div className="w-10 h-10 rounded-full bg-[#0A2540] flex items-center justify-center flex-shrink-0">
                  <span className="text-white font-bold text-lg">{letter}</span>
                </div>
                <div className="flex-1 h-px bg-gray-200" />
              </div>

              {/* Candidate cards */}
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {group.map(c => {
                  const skills = Array.isArray(c.skills) ? c.skills : [];
                  const titles = Array.isArray(c.cv_job_titles) ? c.cv_job_titles : [];
                  const initials = (c.name || 'C').split(' ').map(p => p[0]).join('').slice(0, 2).toUpperCase();
                  const displaySummary = c.cv_ai_summary || c.summary || '';

                  return (
                    <div key={c.id} className="bg-white rounded-xl border border-gray-100 shadow-sm hover:shadow-md transition-all p-5 flex flex-col gap-3">
                      {/* Top row */}
                      <div className="flex items-start gap-3">
                        <div className="w-12 h-12 rounded-full bg-[#0A2540] flex items-center justify-center flex-shrink-0">
                          {c.avatar_url ? (
                            <img src={c.avatar_url} alt={c.name || ''} className="w-12 h-12 rounded-full object-cover" />
                          ) : (
                            <span className="text-white font-bold text-sm">{initials}</span>
                          )}
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="font-bold text-[#0A2540] truncate">{c.name || 'Unknown'}</p>
                          <p className="text-sm text-gray-500 truncate">{c.headline || titles[0] || 'Candidate'}</p>
                          {c.location && (
                            <div className="flex items-center gap-1 mt-1">
                              <MapPin className="w-3 h-3 text-gray-400 flex-shrink-0" />
                              <span className="text-xs text-gray-400 truncate">{c.location}</span>
                            </div>
                          )}
                        </div>
                      </div>

                      {/* Experience */}
                      {c.cv_years_experience != null && (
                        <div className="flex items-center gap-1.5">
                          <Briefcase className="w-3.5 h-3.5 text-gray-400" />
                          <span className="text-xs text-gray-500">{c.cv_years_experience} year{c.cv_years_experience !== 1 ? 's' : ''} experience</span>
                        </div>
                      )}

                      {/* Summary snippet */}
                      {displaySummary && (
                        <p className="text-xs text-gray-500 line-clamp-2 leading-relaxed">{displaySummary}</p>
                      )}

                      {/* Skills */}
                      {skills.length > 0 && (
                        <div className="flex flex-wrap gap-1.5">
                          {skills.slice(0, 4).map((s, i) => (
                            <span key={i} className="px-2 py-0.5 bg-blue-50 text-blue-700 text-xs font-medium rounded-full border border-blue-100">{s}</span>
                          ))}
                          {skills.length > 4 && (
                            <span className="px-2 py-0.5 bg-gray-50 text-gray-400 text-xs rounded-full">+{skills.length - 4}</span>
                          )}
                        </div>
                      )}

                      {/* Buttons */}
                      <div className="flex gap-2 mt-auto pt-1">
                        <button
                          onClick={() => navigate(`/employer/talent-search?profile=${c.id}`)}
                          className="flex-1 flex items-center justify-center gap-1.5 py-2 bg-[#0A2540] text-white text-xs font-semibold rounded-lg hover:bg-[#0d2f50] transition-colors"
                        >
                          <User className="w-3.5 h-3.5" /> View Profile
                        </button>
                        <button
                          onClick={() => startChat(c.id)}
                          className="flex items-center justify-center gap-1.5 px-3 py-2 border border-gray-200 text-gray-600 text-xs font-semibold rounded-lg hover:bg-gray-50 transition-colors"
                        >
                          <MessageSquare className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      )}

      {!loading && filtered.length > 0 && (
        <p className="text-center text-xs text-gray-400 pb-4">
          Showing {filtered.length} of {candidates.length} candidates
        </p>
      )}
    </div>
  );
}
