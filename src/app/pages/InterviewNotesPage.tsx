import { useEffect, useState, useMemo } from 'react';
import { useNavigate } from 'react-router';
import {
  Search, Download, Copy, Mail, Check, ArrowLeft, Sparkles,
  ChevronRight, Calendar, User, Briefcase, Loader2,
} from 'lucide-react';
import { supabase } from '../lib/supabase';
import { toast } from 'sonner';

type AiNote = {
  id: string;
  created_at: string;
  interview_date: string | null;
  candidate_name: string | null;
  job_title: string | null;
  summary: string | null;
  key_points: string[];
  skills: string[];
  qualifications: string[];
  experience: string[];
  strengths: string[];
  concerns: string[];
  action_items: string[];
  recommendation: string | null;
  salary_expectations: string | null;
  availability: string | null;
  score_communication: number | null;
  score_technical: number | null;
  score_experience_relevance: number | null;
  score_confidence: number | null;
  score_overall: number | null;
};

function ScoreBar({ label, value }: { label: string; value: number | null }) {
  if (value === null) return null;
  const color = value >= 80 ? '#16a34a' : value >= 60 ? '#1d4ed8' : '#d97706';
  return (
    <div style={{ marginBottom: 10 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
        <span style={{ color: '#374151', fontSize: 13 }}>{label}</span>
        <span style={{ color, fontSize: 13, fontWeight: 700 }}>{value}/100</span>
      </div>
      <div style={{ height: 8, background: '#e5e7eb', borderRadius: 4 }}>
        <div style={{ height: '100%', width: `${value}%`, background: color, borderRadius: 4, transition: 'width 0.8s ease' }} />
      </div>
    </div>
  );
}

function BulletList({ items }: { items: string[] }) {
  if (!items.length) return <p style={{ color: '#9ca3af', fontStyle: 'italic', fontSize: 13, margin: '4px 0' }}>None identified</p>;
  return (
    <ul style={{ margin: '6px 0 0', paddingLeft: 18 }}>
      {items.map((item, i) => (
        <li key={i} style={{ marginBottom: 4, color: '#374151', fontSize: 13, lineHeight: 1.6 }}>{item}</li>
      ))}
    </ul>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div style={{ marginBottom: 20 }}>
      <h3 style={{ fontSize: 12, fontWeight: 700, color: '#1d4ed8', textTransform: 'uppercase', letterSpacing: '0.05em', margin: '0 0 8px', paddingBottom: 4, borderBottom: '2px solid #dbeafe' }}>
        {title}
      </h3>
      {children}
    </div>
  );
}

export default function InterviewNotesPage() {
  const navigate = useNavigate();
  const [notes, setNotes]         = useState<AiNote[]>([]);
  const [loading, setLoading]     = useState(true);
  const [search, setSearch]       = useState('');
  const [selected, setSelected]   = useState<AiNote | null>(null);
  const [copied, setCopied]       = useState(false);

  useEffect(() => {
    loadNotes();
  }, []);

  async function loadNotes() {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('interview_ai_notes')
        .select('*')
        .order('created_at', { ascending: false });
      if (error) throw error;
      setNotes(data ?? []);
      if (data?.length) setSelected(data[0]);
    } catch (err: any) {
      toast.error('Failed to load interview notes: ' + (err?.message || 'Unknown error'));
    } finally {
      setLoading(false);
    }
  }

  const q = search.toLowerCase().trim();
  const filtered = useMemo(() => {
    if (!q) return notes;
    return notes.filter(n => {
      const fields = [
        n.candidate_name,
        n.job_title,
        n.summary,
        n.recommendation,
        ...(n.skills ?? []),
        ...(n.key_points ?? []),
        ...(n.experience ?? []),
        ...(n.strengths ?? []),
        ...(n.action_items ?? []),
      ];
      return fields.some(f => f?.toLowerCase().includes(q));
    });
  }, [notes, q]);

  function buildText(n: AiNote): string {
    const arr = (label: string, items: string[]) =>
      items.length ? `\n${label}\n${items.map(i => `• ${i}`).join('\n')}` : '';
    return [
      `AI INTERVIEW NOTES`,
      `==================`,
      `Candidate: ${n.candidate_name || 'N/A'}`,
      `Position:  ${n.job_title || 'N/A'}`,
      `Date:      ${n.interview_date ? new Date(n.interview_date).toLocaleDateString('en-ZA') : new Date(n.created_at).toLocaleDateString('en-ZA')}`,
      `\nSUMMARY\n${n.summary ?? ''}`,
      arr('SKILLS', n.skills),
      arr('QUALIFICATIONS', n.qualifications),
      arr('EXPERIENCE', n.experience),
      arr('STRENGTHS', n.strengths),
      arr('CONCERNS', n.concerns),
      arr('ACTION ITEMS', n.action_items),
      `\nRECOMMENDATION\n${n.recommendation ?? ''}`,
      n.salary_expectations && n.salary_expectations !== 'Not discussed' ? `\nSALARY EXPECTATIONS\n${n.salary_expectations}` : '',
      n.availability && n.availability !== 'Not discussed' ? `\nAVAILABILITY\n${n.availability}` : '',
      `\nAI SCORES`,
      `Communication:        ${n.score_communication ?? 'N/A'}/100`,
      `Technical Knowledge:  ${n.score_technical ?? 'N/A'}/100`,
      `Experience Relevance: ${n.score_experience_relevance ?? 'N/A'}/100`,
      `Confidence:           ${n.score_confidence ?? 'N/A'}/100`,
      `Overall Suitability:  ${n.score_overall ?? 'N/A'}/100`,
    ].join('\n');
  }

  function copyNote(n: AiNote) {
    navigator.clipboard.writeText(buildText(n)).then(() => {
      setCopied(true);
      toast.success('Notes copied!');
      setTimeout(() => setCopied(false), 2500);
    });
  }

  function emailNote(n: AiNote) {
    const sub = encodeURIComponent(`Interview Notes — ${n.candidate_name || 'Candidate'} — ${n.job_title || 'Position'}`);
    const body = encodeURIComponent(buildText(n));
    window.open(`mailto:?subject=${sub}&body=${body}`);
  }

  function printNote(n: AiNote) {
    const bar = (v: number | null) => {
      if (v === null) return '<span style="color:#9ca3af">N/A</span>';
      const c = v >= 80 ? '#16a34a' : v >= 60 ? '#1d4ed8' : '#d97706';
      return `<div style="display:flex;align-items:center;gap:10px;margin:3px 0">
        <div style="flex:1;height:8px;background:#e5e7eb;border-radius:4px">
          <div style="width:${v}%;height:100%;background:${c};border-radius:4px"></div>
        </div>
        <span style="font-size:12px;font-weight:700;color:${c};min-width:44px">${v}/100</span>
      </div>`;
    };
    const ul = (items: string[]) => items.length
      ? `<ul style="margin:6px 0 0;padding-left:18px">${items.map(i => `<li style="margin:3px 0;font-size:13px">${i}</li>`).join('')}</ul>`
      : `<p style="color:#9ca3af;font-style:italic;margin:4px 0;font-size:13px">None identified</p>`;
    const sec = (title: string, body: string) =>
      `<div style="margin-bottom:18px">
        <h3 style="font-size:12px;font-weight:700;color:#1d4ed8;border-bottom:2px solid #dbeafe;padding-bottom:4px;margin:0 0 8px;text-transform:uppercase;letter-spacing:.05em">${title}</h3>
        ${body}
      </div>`;
    const date = n.interview_date
      ? new Date(n.interview_date).toLocaleDateString('en-ZA', { day: 'numeric', month: 'long', year: 'numeric' })
      : new Date(n.created_at).toLocaleDateString('en-ZA', { day: 'numeric', month: 'long', year: 'numeric' });
    const w = window.open('', '_blank', 'width=820,height=1000');
    if (!w) { toast.error('Allow pop-ups to download PDF.'); return; }
    w.document.write(`<!DOCTYPE html><html><head><meta charset="utf-8">
      <title>Interview Notes — ${n.candidate_name}</title>
      <style>
        body{font-family:Arial,sans-serif;color:#111;margin:0;padding:32px;font-size:13px;line-height:1.6;max-width:760px;margin:0 auto}
        p{margin:3px 0}
        @media print{.noprint{display:none}body{padding:20px}}
      </style></head><body>
      <div style="display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:24px;border-bottom:3px solid #1d4ed8;padding-bottom:16px">
        <div>
          <h1 style="color:#1d4ed8;font-size:20px;margin:0 0 4px">AI Interview Notes</h1>
          <p style="color:#6b7280;font-size:12px;margin:0">Generated by RecruitFriend AI · Confidential</p>
        </div>
        <button class="noprint" onclick="window.print()" style="padding:8px 16px;background:#1d4ed8;color:#fff;border:none;border-radius:6px;cursor:pointer;font-size:13px;font-weight:700">⬇ Save as PDF</button>
      </div>
      <div style="background:#eff6ff;border-left:4px solid #1d4ed8;padding:12px 16px;margin-bottom:24px;border-radius:0 8px 8px 0">
        <p><strong>Candidate:</strong> ${n.candidate_name || 'N/A'}</p>
        <p><strong>Position:</strong> ${n.job_title || 'N/A'}</p>
        <p><strong>Interview Date:</strong> ${date}</p>
      </div>
      ${sec('Summary', `<p style="line-height:1.8">${n.summary ?? ''}</p>`)}
      ${n.skills?.length ? sec('Skills Identified', ul(n.skills)) : ''}
      ${n.qualifications?.length ? sec('Qualifications', ul(n.qualifications)) : ''}
      ${n.experience?.length ? sec('Experience', ul(n.experience)) : ''}
      ${n.strengths?.length ? sec('Strengths', ul(n.strengths)) : ''}
      ${n.concerns?.length ? sec('Concerns', ul(n.concerns)) : ''}
      ${n.action_items?.length ? sec('Action Items', ul(n.action_items)) : ''}
      ${sec('Recommendation', `<p>${n.recommendation ?? ''}</p>`)}
      ${n.salary_expectations && n.salary_expectations !== 'Not discussed' ? sec('Salary Expectations', `<p>${n.salary_expectations}</p>`) : ''}
      ${n.availability && n.availability !== 'Not discussed' ? sec('Availability', `<p>${n.availability}</p>`) : ''}
      <div style="margin-bottom:20px">
        <h3 style="font-size:12px;font-weight:700;color:#1d4ed8;border-bottom:2px solid #dbeafe;padding-bottom:4px;margin:0 0 12px;text-transform:uppercase;letter-spacing:.05em">AI Candidate Scores</h3>
        <p style="margin:8px 0 2px"><strong>Communication</strong></p>${bar(n.score_communication)}
        <p style="margin:8px 0 2px"><strong>Technical Knowledge</strong></p>${bar(n.score_technical)}
        <p style="margin:8px 0 2px"><strong>Experience Relevance</strong></p>${bar(n.score_experience_relevance)}
        <p style="margin:8px 0 2px"><strong>Confidence</strong></p>${bar(n.score_confidence)}
        <p style="margin:8px 0 2px"><strong>Overall Suitability</strong></p>${bar(n.score_overall)}
      </div>
    </body></html>`);
    w.document.close();
    w.focus();
    setTimeout(() => w.print(), 400);
  }

  const fmtDate = (s: string | null) =>
    s ? new Date(s).toLocaleDateString('en-ZA', { day: 'numeric', month: 'short', year: 'numeric' }) : '—';

  return (
    <div style={{ minHeight: '100vh', background: '#f0f4f8', fontFamily: 'system-ui, sans-serif' }}>
      {/* Header */}
      <div style={{ background: '#0A2540', borderBottom: '1px solid rgba(255,255,255,0.08)', padding: '16px 24px', display: 'flex', alignItems: 'center', gap: 16 }}>
        <button
          onClick={() => navigate('/employer/interviews')}
          style={{ display: 'flex', alignItems: 'center', gap: 6, background: 'none', border: 'none', color: 'rgba(255,255,255,0.6)', cursor: 'pointer', fontSize: 13, padding: 0 }}
        >
          <ArrowLeft size={16} /> Back
        </button>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <Sparkles size={18} color="#60a5fa" />
          <span style={{ color: '#fff', fontWeight: 700, fontSize: 17 }}>AI Interview Notes</span>
        </div>
        <div style={{ marginLeft: 'auto', color: 'rgba(255,255,255,0.5)', fontSize: 12 }}>
          {notes.length} {notes.length === 1 ? 'interview' : 'interviews'}
        </div>
      </div>

      {loading ? (
        <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: 300 }}>
          <Loader2 size={32} color="#1d4ed8" style={{ animation: 'rfSpin 1s linear infinite' }} />
          <style>{`@keyframes rfSpin{to{transform:rotate(360deg)}}`}</style>
        </div>
      ) : (
        <div style={{ display: 'flex', height: 'calc(100vh - 65px)', overflow: 'hidden' }}>

          {/* ── Left: list ── */}
          <div style={{ width: 320, flexShrink: 0, background: '#fff', borderRight: '1px solid #e5e7eb', display: 'flex', flexDirection: 'column' }}>
            {/* Search */}
            <div style={{ padding: 14, borderBottom: '1px solid #e5e7eb' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, background: '#f9fafb', border: '1px solid #e5e7eb', borderRadius: 8, padding: '8px 12px' }}>
                <Search size={14} color="#9ca3af" />
                <input
                  value={search}
                  onChange={e => setSearch(e.target.value)}
                  placeholder="Search candidate, skills, keywords…"
                  style={{ flex: 1, border: 'none', background: 'none', outline: 'none', fontSize: 13, color: '#111' }}
                />
              </div>
            </div>

            {/* Notes list */}
            <div style={{ flex: 1, overflowY: 'auto' }}>
              {filtered.length === 0 ? (
                <div style={{ padding: 24, textAlign: 'center' }}>
                  <Sparkles size={32} color="#d1d5db" style={{ marginBottom: 12 }} />
                  <p style={{ color: '#9ca3af', fontSize: 13, margin: 0 }}>
                    {notes.length === 0
                      ? 'No AI interview notes yet. Use the AI Notes button during a video call.'
                      : 'No notes match your search.'}
                  </p>
                </div>
              ) : (
                filtered.map(note => {
                  const isActive = selected?.id === note.id;
                  const score = note.score_overall;
                  const scoreColor = score !== null ? (score >= 80 ? '#16a34a' : score >= 60 ? '#1d4ed8' : '#d97706') : '#9ca3af';
                  return (
                    <div
                      key={note.id}
                      onClick={() => setSelected(note)}
                      style={{
                        padding: '14px 16px',
                        borderBottom: '1px solid #f3f4f6',
                        cursor: 'pointer',
                        background: isActive ? '#eff6ff' : 'transparent',
                        borderLeft: isActive ? '3px solid #1d4ed8' : '3px solid transparent',
                        transition: 'background 0.15s',
                      }}
                    >
                      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 8 }}>
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <p style={{ margin: '0 0 2px', fontWeight: 700, fontSize: 13, color: '#111', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                            {note.candidate_name || 'Unknown Candidate'}
                          </p>
                          <p style={{ margin: '0 0 4px', fontSize: 12, color: '#6b7280', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                            {note.job_title || 'Unknown Position'}
                          </p>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                            <Calendar size={10} color="#9ca3af" />
                            <span style={{ fontSize: 11, color: '#9ca3af' }}>{fmtDate(note.interview_date || note.created_at)}</span>
                          </div>
                        </div>
                        {score !== null && (
                          <div style={{ flexShrink: 0, width: 36, height: 36, borderRadius: '50%', border: `2px solid ${scoreColor}`, display: 'flex', alignItems: 'center', justifyContent: 'center', background: `${scoreColor}15` }}>
                            <span style={{ fontSize: 10, fontWeight: 800, color: scoreColor }}>{score}</span>
                          </div>
                        )}
                      </div>
                      {note.skills?.slice(0, 3).map((s, i) => (
                        <span key={i} style={{ display: 'inline-block', background: '#dbeafe', color: '#1d4ed8', fontSize: 10, fontWeight: 600, borderRadius: 99, padding: '2px 7px', marginRight: 4, marginTop: 6 }}>{s}</span>
                      ))}
                    </div>
                  );
                })
              )}
            </div>
          </div>

          {/* ── Right: detail ── */}
          <div style={{ flex: 1, overflowY: 'auto', background: '#f9fafb' }}>
            {!selected ? (
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '100%', gap: 12 }}>
                <Sparkles size={48} color="#d1d5db" />
                <p style={{ color: '#9ca3af', fontSize: 15, margin: 0 }}>Select a note to view details</p>
              </div>
            ) : (
              <div style={{ maxWidth: 760, margin: '0 auto', padding: 28 }}>
                {/* Action bar */}
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 24, flexWrap: 'wrap' }}>
                  <button
                    onClick={() => printNote(selected)}
                    style={{ display: 'flex', alignItems: 'center', gap: 6, background: '#1d4ed8', border: 'none', color: '#fff', borderRadius: 8, padding: '9px 16px', cursor: 'pointer', fontSize: 13, fontWeight: 700 }}
                  >
                    <Download size={14} /> Download PDF
                  </button>
                  <button
                    onClick={() => copyNote(selected)}
                    style={{ display: 'flex', alignItems: 'center', gap: 6, background: copied ? '#dcfce7' : '#fff', border: `1px solid ${copied ? '#16a34a' : '#e5e7eb'}`, color: copied ? '#16a34a' : '#374151', borderRadius: 8, padding: '9px 16px', cursor: 'pointer', fontSize: 13, fontWeight: 600 }}
                  >
                    {copied ? <Check size={14} /> : <Copy size={14} />} {copied ? 'Copied!' : 'Copy Notes'}
                  </button>
                  <button
                    onClick={() => emailNote(selected)}
                    style={{ display: 'flex', alignItems: 'center', gap: 6, background: '#fff', border: '1px solid #e5e7eb', color: '#374151', borderRadius: 8, padding: '9px 16px', cursor: 'pointer', fontSize: 13, fontWeight: 600 }}
                  >
                    <Mail size={14} /> Email Notes
                  </button>
                </div>

                {/* Candidate header card */}
                <div style={{ background: '#fff', border: '1px solid #e5e7eb', borderRadius: 12, padding: 20, marginBottom: 20, boxShadow: '0 1px 4px rgba(0,0,0,0.05)' }}>
                  <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', flexWrap: 'wrap', gap: 12 }}>
                    <div>
                      <h1 style={{ margin: '0 0 6px', fontSize: 20, fontWeight: 800, color: '#111' }}>
                        {selected.candidate_name || 'Unknown Candidate'}
                      </h1>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 4 }}>
                        <Briefcase size={13} color="#6b7280" />
                        <span style={{ fontSize: 14, color: '#374151' }}>{selected.job_title || 'Unknown Position'}</span>
                      </div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                        <Calendar size={13} color="#6b7280" />
                        <span style={{ fontSize: 13, color: '#6b7280' }}>{fmtDate(selected.interview_date || selected.created_at)}</span>
                      </div>
                    </div>
                    {selected.score_overall !== null && (
                      <div style={{ textAlign: 'center' }}>
                        <div style={{
                          width: 72, height: 72, borderRadius: '50%',
                          background: selected.score_overall >= 80 ? '#dcfce7' : selected.score_overall >= 60 ? '#dbeafe' : '#fef3c7',
                          border: `3px solid ${selected.score_overall >= 80 ? '#16a34a' : selected.score_overall >= 60 ? '#1d4ed8' : '#d97706'}`,
                          display: 'flex', alignItems: 'center', justifyContent: 'center',
                        }}>
                          <span style={{ fontSize: 20, fontWeight: 800, color: selected.score_overall >= 80 ? '#16a34a' : selected.score_overall >= 60 ? '#1d4ed8' : '#d97706' }}>
                            {selected.score_overall}
                          </span>
                        </div>
                        <p style={{ margin: '4px 0 0', fontSize: 10, color: '#9ca3af', fontWeight: 600 }}>OVERALL</p>
                      </div>
                    )}
                  </div>
                </div>

                {/* Main content */}
                <div style={{ background: '#fff', border: '1px solid #e5e7eb', borderRadius: 12, padding: 24, marginBottom: 20, boxShadow: '0 1px 4px rgba(0,0,0,0.05)' }}>
                  {selected.summary && (
                    <Section title="Summary">
                      <p style={{ margin: 0, color: '#374151', fontSize: 13, lineHeight: 1.8 }}>{selected.summary}</p>
                    </Section>
                  )}
                  <Section title="Skills Identified"><BulletList items={selected.skills ?? []} /></Section>
                  <Section title="Qualifications"><BulletList items={selected.qualifications ?? []} /></Section>
                  <Section title="Experience"><BulletList items={selected.experience ?? []} /></Section>
                  <Section title="Strengths"><BulletList items={selected.strengths ?? []} /></Section>
                  {(selected.concerns?.length ?? 0) > 0 && (
                    <Section title="Concerns"><BulletList items={selected.concerns ?? []} /></Section>
                  )}
                  <Section title="Action Items"><BulletList items={selected.action_items ?? []} /></Section>

                  {selected.recommendation && (
                    <div style={{ background: '#f0fdf4', border: '1px solid #bbf7d0', borderRadius: 8, padding: '12px 16px', marginTop: 4 }}>
                      <p style={{ margin: '0 0 4px', fontSize: 11, fontWeight: 700, color: '#16a34a', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Recommendation</p>
                      <p style={{ margin: 0, color: '#111', fontSize: 14, lineHeight: 1.6 }}>{selected.recommendation}</p>
                    </div>
                  )}
                </div>

                {/* Extra fields */}
                {((selected.salary_expectations && selected.salary_expectations !== 'Not discussed') ||
                  (selected.availability && selected.availability !== 'Not discussed')) && (
                  <div style={{ background: '#fff', border: '1px solid #e5e7eb', borderRadius: 12, padding: 24, marginBottom: 20, boxShadow: '0 1px 4px rgba(0,0,0,0.05)' }}>
                    {selected.salary_expectations && selected.salary_expectations !== 'Not discussed' && (
                      <Section title="Salary Expectations">
                        <p style={{ margin: 0, color: '#374151', fontSize: 13 }}>{selected.salary_expectations}</p>
                      </Section>
                    )}
                    {selected.availability && selected.availability !== 'Not discussed' && (
                      <Section title="Availability / Notice Period">
                        <p style={{ margin: 0, color: '#374151', fontSize: 13 }}>{selected.availability}</p>
                      </Section>
                    )}
                  </div>
                )}

                {/* AI Scores */}
                <div style={{ background: '#fff', border: '1px solid #e5e7eb', borderRadius: 12, padding: 24, marginBottom: 20, boxShadow: '0 1px 4px rgba(0,0,0,0.05)' }}>
                  <h3 style={{ fontSize: 12, fontWeight: 700, color: '#1d4ed8', textTransform: 'uppercase', letterSpacing: '0.05em', margin: '0 0 16px', paddingBottom: 4, borderBottom: '2px solid #dbeafe' }}>
                    AI Candidate Scores
                  </h3>
                  <ScoreBar label="Communication" value={selected.score_communication} />
                  <ScoreBar label="Technical Knowledge" value={selected.score_technical} />
                  <ScoreBar label="Experience Relevance" value={selected.score_experience_relevance} />
                  <ScoreBar label="Confidence" value={selected.score_confidence} />
                  <ScoreBar label="Overall Suitability" value={selected.score_overall} />
                </div>

                {/* Skills tags */}
                {(selected.skills?.length ?? 0) > 0 && (
                  <div style={{ marginBottom: 20 }}>
                    <p style={{ margin: '0 0 8px', fontSize: 12, fontWeight: 600, color: '#6b7280', textTransform: 'uppercase', letterSpacing: '0.04em' }}>All Skills</p>
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                      {selected.skills!.map((s, i) => (
                        <span key={i} style={{ background: '#dbeafe', color: '#1d4ed8', fontSize: 12, fontWeight: 600, borderRadius: 99, padding: '4px 12px' }}>{s}</span>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      )}
      <style>{`@keyframes rfSpin{to{transform:rotate(360deg)}}`}</style>
    </div>
  );
}
