import { useState } from 'react';
import { Search, MapPin, Briefcase, Loader2, Sparkles, User, MessageSquare, ChevronRight } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { toast } from 'sonner';
import { useNavigate } from 'react-router';

type MatchResult = {
  id: string;
  name: string | null;
  headline: string | null;
  cv_ai_summary: string | null;
  summary: string | null;
  location: string | null;
  avatar_url: string | null;
  skills: string[];
  cv_job_titles: string[];
  cv_years_experience: number | null;
  match_score: number;
  explanation: string;
};

const EXAMPLE_QUERIES = [
  'Boilermaker Johannesburg stainless steel 5 years',
  'I need a trade tested electrician in Cape Town with mining experience',
  'Senior HR Officer Durban SABPP registered',
  'Driver with PDP licence and 3 years experience in Gauteng',
  'Receptionist Pretoria with medical practice experience',
];

function ScoreBadge({ score }: { score: number }) {
  const color = score >= 80 ? '#16a34a' : score >= 60 ? '#1d4ed8' : '#d97706';
  const bg    = score >= 80 ? '#dcfce7' : score >= 60 ? '#dbeafe' : '#fef3c7';
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '4px 10px', borderRadius: 99, background: bg, border: `1.5px solid ${color}` }}>
      <span style={{ fontSize: 15, fontWeight: 800, color }}>{score}%</span>
      <span style={{ fontSize: 11, fontWeight: 600, color }}>Match</span>
    </div>
  );
}

export default function AiTalentMatch() {
  const navigate  = useNavigate();
  const [query, setQuery]       = useState('');
  const [results, setResults]   = useState<MatchResult[]>([]);
  const [loading, setLoading]   = useState(false);
  const [searched, setSearched] = useState(false);

  async function runSearch() {
    const q = query.trim();
    if (!q) { toast.error('Enter a search query first.'); return; }
    setLoading(true);
    setSearched(true);
    try {
      const { data, error } = await supabase.functions.invoke('ai-talent-match', {
        body: { query: q },
      });
      if (error) throw new Error(error.message);
      setResults(data.results ?? []);
      if (!data.results?.length) toast('No matching candidates found for that query.');
    } catch (err: any) {
      toast.error('Search failed: ' + (err?.message || 'Unknown error'));
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="bg-[#0A2540] text-white p-8 rounded-xl relative overflow-hidden shadow-lg">
        <div className="relative z-10 max-w-3xl">
          <div className="flex items-center gap-3 mb-2">
            <Sparkles className="w-6 h-6 text-blue-300" />
            <h1 className="text-3xl font-bold">AI Talent Match</h1>
          </div>
          <p className="text-blue-200 text-sm mb-6">
            Search in plain English. AI reads every CV and ranks candidates by how well they match.
          </p>
          <div className="flex gap-2">
            <div className="relative flex-1">
              <Search className="absolute left-4 top-3.5 w-5 h-5 text-gray-400" />
              <input
                value={query}
                onChange={e => setQuery(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && runSearch()}
                placeholder="e.g. Boilermaker Johannesburg stainless steel 5 years experience…"
                className="w-full pl-12 pr-4 h-12 rounded-lg bg-white text-[#0A2540] text-sm outline-none"
              />
            </div>
            <button
              onClick={runSearch}
              disabled={loading}
              className="h-12 px-7 bg-[#00C853] hover:bg-[#00B548] text-white font-bold text-sm rounded-lg shadow-lg shadow-green-900/20 flex items-center gap-2 disabled:opacity-60"
            >
              {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />}
              {loading ? 'Matching…' : 'Match'}
            </button>
          </div>
        </div>
        <div className="absolute right-0 top-0 bottom-0 w-1/3 bg-gradient-to-l from-white/5 to-transparent pointer-events-none" />
      </div>

      {/* Example queries */}
      {!searched && (
        <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-5">
          <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-3">Example searches</p>
          <div className="flex flex-wrap gap-2">
            {EXAMPLE_QUERIES.map((ex, i) => (
              <button
                key={i}
                onClick={() => { setQuery(ex); }}
                className="px-3 py-1.5 bg-blue-50 text-blue-700 text-xs font-medium rounded-full border border-blue-100 hover:bg-blue-100 transition-colors flex items-center gap-1"
              >
                <ChevronRight className="w-3 h-3" /> {ex}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Loading state */}
      {loading && (
        <div className="flex flex-col items-center justify-center py-20 bg-white rounded-xl border border-gray-100">
          <div className="flex items-center gap-3 mb-3">
            <Sparkles className="w-6 h-6 text-blue-500 animate-pulse" />
            <Loader2 className="w-6 h-6 animate-spin text-[#0A2540]" />
          </div>
          <p className="text-gray-600 font-semibold">AI is reading CVs and ranking candidates…</p>
          <p className="text-gray-400 text-sm mt-1">This takes 5–15 seconds</p>
        </div>
      )}

      {/* Results */}
      {!loading && searched && (
        <>
          {results.length > 0 && (
            <div className="flex items-center justify-between">
              <p className="text-sm text-gray-500">
                <span className="font-semibold text-[#0A2540]">{results.length}</span> candidates matched
              </p>
              <p className="text-xs text-gray-400">Ranked by AI match score</p>
            </div>
          )}

          {results.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-20 bg-white rounded-xl border-2 border-dashed border-gray-100">
              <Sparkles className="w-12 h-12 text-gray-200 mb-4" />
              <h3 className="font-bold text-[#0A2540] text-lg mb-1">No matches found</h3>
              <p className="text-gray-400 text-sm">Try different keywords or broaden your search.</p>
            </div>
          ) : (
            <div className="space-y-4">
              {results.map((c, idx) => {
                const skills = Array.isArray(c.skills) ? c.skills : [];
                const initials = (c.name || 'C').split(' ').map(p => p[0]).join('').slice(0, 2).toUpperCase();
                const displaySummary = c.cv_ai_summary || c.summary || '';

                return (
                  <div key={c.id} className="bg-white rounded-xl border border-gray-100 shadow-sm hover:shadow-md transition-all p-5">
                    <div className="flex flex-col gap-4 sm:flex-row sm:items-start">
                      {/* Rank */}
                      <div className="flex-shrink-0 w-7 h-7 rounded-full bg-gray-100 flex items-center justify-center">
                        <span className="text-xs font-bold text-gray-400">#{idx + 1}</span>
                      </div>

                      {/* Avatar */}
                      <div className="w-12 h-12 rounded-full bg-[#0A2540] flex items-center justify-center flex-shrink-0">
                        {c.avatar_url ? (
                          <img src={c.avatar_url} alt={c.name || ''} className="w-12 h-12 rounded-full object-cover" />
                        ) : (
                          <span className="text-white font-bold text-sm">{initials}</span>
                        )}
                      </div>

                      {/* Info */}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-start justify-between gap-3 flex-wrap">
                          <div>
                            <h3 className="font-bold text-[#0A2540] text-base">{c.name || 'Unknown Candidate'}</h3>
                            <p className="text-sm text-gray-500">{c.headline || (Array.isArray(c.cv_job_titles) && c.cv_job_titles[0]) || 'Candidate'}</p>
                            <div className="flex flex-wrap items-center gap-3 mt-1.5 text-xs text-gray-400">
                              {c.location && (
                                <span className="flex items-center gap-1"><MapPin className="w-3 h-3" />{c.location}</span>
                              )}
                              {c.cv_years_experience != null && (
                                <span className="flex items-center gap-1"><Briefcase className="w-3 h-3" />{c.cv_years_experience}y experience</span>
                              )}
                            </div>
                          </div>
                          <ScoreBadge score={c.match_score} />
                        </div>

                        {/* AI Explanation */}
                        {c.explanation && (
                          <div className="mt-3 flex items-start gap-2 bg-blue-50 border border-blue-100 rounded-lg px-3 py-2">
                            <Sparkles className="w-3.5 h-3.5 text-blue-500 flex-shrink-0 mt-0.5" />
                            <p className="text-xs text-blue-700 leading-relaxed">{c.explanation}</p>
                          </div>
                        )}

                        {/* Summary */}
                        {displaySummary && (
                          <p className="mt-3 text-sm text-gray-600 line-clamp-2">{displaySummary}</p>
                        )}

                        {/* Skills */}
                        {skills.length > 0 && (
                          <div className="flex flex-wrap gap-1.5 mt-3">
                            {skills.slice(0, 6).map((s, i) => (
                              <span key={i} className="px-2 py-0.5 bg-blue-50 text-blue-700 text-xs font-medium rounded-full border border-blue-100">{s}</span>
                            ))}
                            {skills.length > 6 && (
                              <span className="px-2 py-0.5 bg-gray-50 text-gray-400 text-xs rounded-full">+{skills.length - 6}</span>
                            )}
                          </div>
                        )}

                        {/* Actions */}
                        <div className="flex gap-2 mt-4">
                          <button
                            onClick={() => navigate(`/employer/talent-search?profile=${c.id}`)}
                            className="flex items-center gap-1.5 px-4 py-2 bg-[#0A2540] text-white text-xs font-semibold rounded-lg hover:bg-[#0d2f50] transition-colors"
                          >
                            <User className="w-3.5 h-3.5" /> View Profile
                          </button>
                          <button
                            onClick={() => navigate(`/employer/talent-search?chat=${c.id}`)}
                            className="flex items-center gap-1.5 px-4 py-2 border border-gray-200 text-gray-600 text-xs font-semibold rounded-lg hover:bg-gray-50 transition-colors"
                          >
                            <MessageSquare className="w-3.5 h-3.5" /> Chat
                          </button>
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </>
      )}
    </div>
  );
}
