import { useState, useCallback } from 'react';
import { Sparkles, Loader2, Plus, Trash2, Download, Save, ChevronLeft, ChevronRight, Eye, EyeOff } from 'lucide-react';
import { supabase, apiCall } from '../lib/supabase';
import { useAuth } from '../context/useAuth';
import { toast } from 'sonner';

// ─── Types ───────────────────────────────────────────────────────────────────
type WorkEntry  = { company: string; title: string; start: string; end: string; current: boolean; description: string };
type EduEntry   = { institution: string; qualification: string; year: string };
type RefEntry   = { name: string; company: string; phone: string; email: string };

type CvData = {
  targetRole:    string;
  firstName:     string;
  lastName:      string;
  email:         string;
  phone:         string;
  location:      string;
  linkedin:      string;
  summary:       string;
  work:          WorkEntry[];
  education:     EduEntry[];
  skills:        string;
  certifications:string;
  languages:     string;
  references:    RefEntry[];
  template:      'modern-blue' | 'executive' | 'minimal';
};

const TEMPLATES: { id: CvData['template']; label: string; desc: string }[] = [
  { id: 'modern-blue', label: 'Modern Blue Professional', desc: 'Clean blue sidebar layout' },
  { id: 'executive',   label: 'Executive Corporate',      desc: 'Bold header, formal styling' },
  { id: 'minimal',     label: 'Minimal Black & White',    desc: 'Clean, ATS-friendly layout' },
];

const TARGET_ROLES = [
  'Receptionist', 'Driver', 'Administrator', 'Sales Representative',
  'HR Officer', 'Electrician', 'Boilermaker', 'Engineer', 'Nurse',
  'Accountant', 'Teacher', 'Security Officer', 'IT Technician',
  'Project Manager', 'Welder', 'Plumber', 'Mechanic',
];

const STEPS = ['Template', 'Personal Info', 'Summary', 'Experience', 'Education', 'Skills', 'References', 'Preview'];

// ─── CV HTML generator ───────────────────────────────────────────────────────
function buildCvHtml(cv: CvData): string {
  const fullName = `${cv.firstName} ${cv.lastName}`.trim();
  const skillList = cv.skills.split(/[,\n]+/).map(s => s.trim()).filter(Boolean);
  const certList  = cv.certifications.split(/[,\n]+/).map(s => s.trim()).filter(Boolean);
  const langList  = cv.languages.split(/[,\n]+/).map(s => s.trim()).filter(Boolean);

  const sec = (title: string, body: string) =>
    `<div class="section"><div class="section-title">${title}</div>${body}</div>`;

  const workHtml = cv.work.map(w => `
    <div class="entry">
      <div class="entry-header">
        <strong>${w.title}</strong>
        <span class="entry-date">${w.start}${w.end || w.current ? ' – ' + (w.current ? 'Present' : w.end) : ''}</span>
      </div>
      <div class="entry-sub">${w.company}</div>
      ${w.description ? `<p class="entry-desc">${w.description.replace(/\n/g, '<br>')}</p>` : ''}
    </div>`).join('');

  const eduHtml = cv.education.map(e => `
    <div class="entry">
      <div class="entry-header">
        <strong>${e.qualification}</strong>
        <span class="entry-date">${e.year}</span>
      </div>
      <div class="entry-sub">${e.institution}</div>
    </div>`).join('');

  const refHtml = cv.references.length
    ? cv.references.map(r => `
        <div class="entry">
          <strong>${r.name}</strong>
          <div class="entry-sub">${r.company}</div>
          ${r.phone ? `<div class="entry-sub">${r.phone}</div>` : ''}
          ${r.email ? `<div class="entry-sub">${r.email}</div>` : ''}
        </div>`).join('')
    : '<p style="color:#9ca3af;font-style:italic">Available on request</p>';

  const tagsHtml = (items: string[]) =>
    items.map(s => `<span class="tag">${s}</span>`).join('');

  if (cv.template === 'modern-blue') {
    return `<html><head><meta charset="utf-8"><style>
      *{box-sizing:border-box;margin:0;padding:0}
      body{font-family:Arial,sans-serif;font-size:13px;color:#111;display:flex;min-height:100vh}
      .sidebar{width:220px;background:#0A2540;color:#fff;padding:28px 20px;flex-shrink:0}
      .sidebar h1{font-size:18px;font-weight:800;line-height:1.3;margin-bottom:4px;color:#fff}
      .sidebar .role{font-size:11px;color:#93c5fd;margin-bottom:20px}
      .sidebar .contact-item{font-size:11px;color:#cbd5e1;margin-bottom:6px;word-break:break-all}
      .sidebar-section{margin-bottom:20px}
      .sidebar-section-title{font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:.08em;color:#93c5fd;margin-bottom:8px;border-bottom:1px solid rgba(255,255,255,0.15);padding-bottom:4px}
      .tag-sidebar{display:inline-block;background:rgba(255,255,255,0.1);color:#e2e8f0;border-radius:4px;padding:2px 8px;font-size:10px;margin:2px}
      .main{flex:1;padding:32px 28px}
      .name-block{margin-bottom:24px;border-bottom:3px solid #0A2540;padding-bottom:16px}
      .section{margin-bottom:22px}
      .section-title{font-size:12px;font-weight:700;text-transform:uppercase;letter-spacing:.06em;color:#0A2540;border-bottom:2px solid #dbeafe;padding-bottom:4px;margin-bottom:10px}
      .entry{margin-bottom:12px}
      .entry-header{display:flex;justify-content:space-between;align-items:flex-start;gap:8px}
      .entry-date{font-size:11px;color:#6b7280;white-space:nowrap;flex-shrink:0}
      .entry-sub{font-size:11px;color:#6b7280;margin:2px 0}
      .entry-desc{font-size:12px;color:#374151;margin-top:5px;line-height:1.6}
      .summary-text{font-size:13px;color:#374151;line-height:1.8}
      @media print{body{-webkit-print-color-adjust:exact;print-color-adjust:exact}.sidebar{background:#0A2540!important}}
    </style></head><body>
    <div class="sidebar">
      <h1>${fullName || 'Your Name'}</h1>
      ${cv.targetRole ? `<div class="role">${cv.targetRole}</div>` : ''}
      <div class="sidebar-section">
        <div class="sidebar-section-title">Contact</div>
        ${cv.email ? `<div class="contact-item">✉ ${cv.email}</div>` : ''}
        ${cv.phone ? `<div class="contact-item">📞 ${cv.phone}</div>` : ''}
        ${cv.location ? `<div class="contact-item">📍 ${cv.location}</div>` : ''}
        ${cv.linkedin ? `<div class="contact-item">in ${cv.linkedin}</div>` : ''}
      </div>
      ${skillList.length ? `<div class="sidebar-section"><div class="sidebar-section-title">Skills</div>${skillList.map(s=>`<span class="tag-sidebar">${s}</span>`).join('')}</div>` : ''}
      ${langList.length ? `<div class="sidebar-section"><div class="sidebar-section-title">Languages</div>${langList.map(s=>`<span class="tag-sidebar">${s}</span>`).join('')}</div>` : ''}
      ${certList.length ? `<div class="sidebar-section"><div class="sidebar-section-title">Certifications</div>${certList.map(s=>`<div class="contact-item">• ${s}</div>`).join('')}</div>` : ''}
    </div>
    <div class="main">
      ${cv.summary ? sec('Professional Summary', `<p class="summary-text">${cv.summary}</p>`) : ''}
      ${cv.work.length ? sec('Work Experience', workHtml) : ''}
      ${cv.education.length ? sec('Education', eduHtml) : ''}
      ${sec('References', refHtml)}
    </div></body></html>`;
  }

  if (cv.template === 'executive') {
    return `<html><head><meta charset="utf-8"><style>
      *{box-sizing:border-box;margin:0;padding:0}
      body{font-family:Georgia,serif;font-size:13px;color:#111;padding:40px;max-width:800px}
      .header{text-align:center;border-bottom:3px double #111;padding-bottom:20px;margin-bottom:24px}
      .header h1{font-size:26px;font-weight:700;letter-spacing:.08em;text-transform:uppercase;margin-bottom:4px}
      .header .role{font-size:14px;color:#555;letter-spacing:.05em;margin-bottom:10px}
      .header .contact{font-size:11px;color:#555;display:flex;justify-content:center;gap:16px;flex-wrap:wrap}
      .section{margin-bottom:22px}
      .section-title{font-size:12px;font-weight:700;text-transform:uppercase;letter-spacing:.1em;border-bottom:1.5px solid #111;padding-bottom:4px;margin-bottom:10px}
      .entry{margin-bottom:12px}
      .entry-header{display:flex;justify-content:space-between;align-items:flex-start;gap:8px}
      .entry-date{font-size:11px;color:#555;white-space:nowrap}
      .entry-sub{font-size:11px;color:#555;font-style:italic;margin:2px 0}
      .entry-desc{font-size:12px;color:#333;margin-top:5px;line-height:1.7}
      .summary-text{font-size:13px;color:#333;line-height:1.9}
      .tag{display:inline-block;border:1px solid #ccc;border-radius:3px;padding:1px 8px;font-size:11px;margin:2px}
      @media print{body{padding:24px}}
    </style></head><body>
    <div class="header">
      <h1>${fullName || 'Your Name'}</h1>
      ${cv.targetRole ? `<div class="role">${cv.targetRole}</div>` : ''}
      <div class="contact">
        ${cv.email ? `<span>✉ ${cv.email}</span>` : ''}
        ${cv.phone ? `<span>📞 ${cv.phone}</span>` : ''}
        ${cv.location ? `<span>📍 ${cv.location}</span>` : ''}
        ${cv.linkedin ? `<span>in ${cv.linkedin}</span>` : ''}
      </div>
    </div>
    ${cv.summary ? sec('Professional Summary', `<p class="summary-text">${cv.summary}</p>`) : ''}
    ${cv.work.length ? sec('Professional Experience', workHtml) : ''}
    ${cv.education.length ? sec('Education & Qualifications', eduHtml) : ''}
    ${skillList.length ? sec('Core Skills', `<div style="display:flex;flex-wrap:wrap;gap:4px">${tagsHtml(skillList)}</div>`) : ''}
    ${certList.length ? sec('Certifications', `<div style="display:flex;flex-wrap:wrap;gap:4px">${tagsHtml(certList)}</div>`) : ''}
    ${langList.length ? sec('Languages', `<div style="display:flex;flex-wrap:wrap;gap:4px">${tagsHtml(langList)}</div>`) : ''}
    ${sec('References', refHtml)}
    </body></html>`;
  }

  // minimal
  return `<html><head><meta charset="utf-8"><style>
    *{box-sizing:border-box;margin:0;padding:0}
    body{font-family:Arial,sans-serif;font-size:12px;color:#111;padding:36px;max-width:780px}
    h1{font-size:22px;font-weight:800;margin-bottom:2px}
    .role{font-size:13px;color:#555;margin-bottom:8px}
    .contact{font-size:11px;color:#555;display:flex;gap:14px;flex-wrap:wrap;margin-bottom:20px;padding-bottom:12px;border-bottom:2px solid #111}
    .section{margin-bottom:18px}
    .section-title{font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:.08em;color:#111;margin-bottom:8px;border-bottom:1px solid #ccc;padding-bottom:3px}
    .entry{margin-bottom:10px}
    .entry-header{display:flex;justify-content:space-between;align-items:flex-start;gap:8px}
    .entry-date{font-size:10px;color:#777;white-space:nowrap}
    .entry-sub{font-size:10px;color:#666;margin:1px 0}
    .entry-desc{font-size:11px;color:#333;margin-top:4px;line-height:1.6}
    .summary-text{font-size:12px;color:#333;line-height:1.8}
    .tags{display:flex;flex-wrap:wrap;gap:3px}
    .tag{font-size:10px;padding:1px 7px;border:1px solid #ccc;border-radius:3px}
    @media print{body{padding:20px}}
  </style></head><body>
  <h1>${fullName || 'Your Name'}</h1>
  ${cv.targetRole ? `<div class="role">${cv.targetRole}</div>` : ''}
  <div class="contact">
    ${cv.email ? `<span>✉ ${cv.email}</span>` : ''}
    ${cv.phone ? `<span>📞 ${cv.phone}</span>` : ''}
    ${cv.location ? `<span>📍 ${cv.location}</span>` : ''}
    ${cv.linkedin ? `<span>in ${cv.linkedin}</span>` : ''}
  </div>
  ${cv.summary ? sec('Summary', `<p class="summary-text">${cv.summary}</p>`) : ''}
  ${cv.work.length ? sec('Experience', workHtml) : ''}
  ${cv.education.length ? sec('Education', eduHtml) : ''}
  ${skillList.length ? sec('Skills', `<div class="tags">${tagsHtml(skillList)}</div>`) : ''}
  ${certList.length ? sec('Certifications', `<div class="tags">${tagsHtml(certList)}</div>`) : ''}
  ${langList.length ? sec('Languages', `<div class="tags">${tagsHtml(langList)}</div>`) : ''}
  ${sec('References', refHtml)}
  </body></html>`;
}

// ─── Component ───────────────────────────────────────────────────────────────
const emptyWork  = (): WorkEntry  => ({ company: '', title: '', start: '', end: '', current: false, description: '' });
const emptyEdu   = (): EduEntry   => ({ institution: '', qualification: '', year: '' });
const emptyRef   = (): RefEntry   => ({ name: '', company: '', phone: '', email: '' });

export default function CvBuilder() {
  const { profile } = useAuth();

  const [step, setStep] = useState(0);
  const [showPreview, setShowPreview] = useState(false);
  const [rewriting, setRewriting]     = useState<string | null>(null);
  const [saving, setSaving]           = useState(false);

  const [cv, setCv] = useState<CvData>({
    targetRole: '',
    firstName:  profile?.name?.split(' ')[0] || '',
    lastName:   profile?.name?.split(' ').slice(1).join(' ') || '',
    email:      profile?.email || '',
    phone:      profile?.phone || '',
    location:   profile?.location || '',
    linkedin:   '',
    summary:    profile?.summary || '',
    work:       [emptyWork()],
    education:  [emptyEdu()],
    skills:     Array.isArray(profile?.skills) ? (profile.skills as string[]).join(', ') : '',
    certifications: '',
    languages:  '',
    references: [],
    template:   'modern-blue',
  });

  const set = useCallback(<K extends keyof CvData>(key: K, value: CvData[K]) => {
    setCv(prev => ({ ...prev, [key]: value }));
  }, []);

  async function aiRewrite(field: 'summary' | 'skills' | string, currentText: string, workIdx?: number) {
    if (!currentText.trim()) { toast.error('Enter some text first, then click AI Improve.'); return; }
    setRewriting(field);
    try {
      const data = await apiCall('/ai/cv-improve', {
        method: 'POST',
        body: JSON.stringify({ text: currentText, section: field, targetRole: cv.targetRole }),
      });
      if (data.error) throw new Error(data.error);
      const improved: string = data.improved;
      if (field === 'summary') set('summary', improved);
      else if (field === 'skills') set('skills', improved);
      else if (field.startsWith('work-') && workIdx !== undefined) {
        const updated = [...cv.work];
        updated[workIdx] = { ...updated[workIdx], description: improved };
        set('work', updated);
      }
      toast.success('AI improved your text!');
    } catch (err: any) {
      toast.error('AI rewrite failed: ' + (err?.message || 'Unknown error'));
    } finally {
      setRewriting(null);
    }
  }

  async function saveToProfile() {
    setSaving(true);
    try {
      const skillsArr = cv.skills.split(/[,\n]+/).map(s => s.trim()).filter(Boolean);
      const { error } = await supabase.from('profiles').update({
        name:     `${cv.firstName} ${cv.lastName}`.trim(),
        headline: cv.targetRole || undefined,
        summary:  cv.summary || undefined,
        skills:   skillsArr,
        phone:    cv.phone || undefined,
        location: cv.location || undefined,
        updated_at: new Date().toISOString(),
      }).eq('id', profile?.id);
      if (error) throw error;
      toast.success('CV saved to your profile!');
    } catch (err: any) {
      toast.error('Failed to save: ' + (err?.message || 'Unknown error'));
    } finally {
      setSaving(false);
    }
  }

  function printCv() {
    const html = buildCvHtml(cv);
    const w = window.open('', '_blank', 'width=900,height=1100');
    if (!w) { toast.error('Allow pop-ups to download PDF.'); return; }
    w.document.write(`<!DOCTYPE html><html><head><meta charset="utf-8">
      <style>@media print{.noprint{display:none}}</style></head><body>
      <div class="noprint" style="padding:12px 20px;background:#0A2540;display:flex;gap:10px;align-items:center">
        <button onclick="window.print()" style="background:#00C853;color:#fff;border:none;padding:8px 20px;border-radius:6px;font-weight:700;cursor:pointer;font-size:14px">⬇ Save as PDF</button>
        <span style="color:#fff;font-size:13px">or use your browser's print dialog → Save as PDF</span>
      </div>
      <iframe id="cv-frame" style="width:100%;height:calc(100vh - 50px);border:none"></iframe>
      <script>
        const frame = document.getElementById('cv-frame');
        frame.contentDocument.open();
        frame.contentDocument.write(${JSON.stringify(html)});
        frame.contentDocument.close();
      </script>
      </body></html>`);
    w.document.close();
  }

  const AiBtn = ({ onClick, label }: { onClick: () => void; label: string }) => (
    <button
      onClick={onClick}
      disabled={!!rewriting}
      className="flex items-center gap-1.5 px-3 py-1.5 bg-blue-50 text-blue-700 text-xs font-semibold rounded-lg border border-blue-200 hover:bg-blue-100 transition-colors disabled:opacity-50"
    >
      {rewriting === label ? <Loader2 className="w-3 h-3 animate-spin" /> : <Sparkles className="w-3 h-3" />}
      AI Improve
    </button>
  );

  const inputCls = "w-full border border-gray-200 rounded-lg px-3 py-2.5 text-sm text-[#0A2540] outline-none focus:border-blue-400 focus:ring-1 focus:ring-blue-400";
  const labelCls = "block text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1.5";

  // ─── Step content ─────────────────────────────────────────────────────────
  function renderStep() {
    switch (step) {
      case 0: return (
        <div className="space-y-6">
          <div>
            <label className={labelCls}>Target Role (optional)</label>
            <select value={cv.targetRole} onChange={e => set('targetRole', e.target.value)} className={inputCls}>
              <option value="">Select a role…</option>
              {TARGET_ROLES.map(r => <option key={r} value={r}>{r}</option>)}
            </select>
            <p className="text-xs text-gray-400 mt-1.5">AI will optimise your CV for this role.</p>
          </div>
          <div>
            <label className={labelCls}>Template</label>
            <div className="grid gap-3 sm:grid-cols-3">
              {TEMPLATES.map(t => (
                <button
                  key={t.id}
                  onClick={() => set('template', t.id)}
                  className={`p-4 rounded-xl border-2 text-left transition-all ${cv.template === t.id ? 'border-blue-500 bg-blue-50' : 'border-gray-200 hover:border-blue-200'}`}
                >
                  <div className="w-full h-16 rounded-lg mb-3 flex items-center justify-center text-2xl"
                    style={{ background: t.id === 'modern-blue' ? '#0A2540' : t.id === 'executive' ? '#f8f5f0' : '#f9fafb', border: t.id !== 'modern-blue' ? '1px solid #e5e7eb' : 'none' }}>
                    {t.id === 'modern-blue' ? '🔵' : t.id === 'executive' ? '🏛️' : '⬜'}
                  </div>
                  <p className="font-semibold text-sm text-[#0A2540]">{t.label}</p>
                  <p className="text-xs text-gray-400 mt-0.5">{t.desc}</p>
                </button>
              ))}
            </div>
          </div>
        </div>
      );

      case 1: return (
        <div className="grid gap-4 sm:grid-cols-2">
          {[['First Name','firstName'],['Last Name','lastName'],['Email','email'],['Phone','phone'],['Location','location'],['LinkedIn URL','linkedin']].map(([label, key]) => (
            <div key={key}>
              <label className={labelCls}>{label}</label>
              <input value={(cv as any)[key]} onChange={e => set(key as keyof CvData, e.target.value as any)} className={inputCls} placeholder={label} />
            </div>
          ))}
        </div>
      );

      case 2: return (
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <label className={labelCls}>Professional Summary</label>
            <AiBtn onClick={() => aiRewrite('summary', cv.summary)} label="summary" />
          </div>
          <textarea
            value={cv.summary}
            onChange={e => set('summary', e.target.value)}
            placeholder="e.g. I answered phones and booked appointments…  (AI will rewrite it professionally)"
            rows={6}
            className={`${inputCls} resize-none`}
          />
          <p className="text-xs text-gray-400">Write naturally — click AI Improve to make it professional.</p>
        </div>
      );

      case 3: return (
        <div className="space-y-6">
          {cv.work.map((w, i) => (
            <div key={i} className="bg-gray-50 rounded-xl p-4 border border-gray-200 space-y-3">
              <div className="flex items-center justify-between">
                <p className="text-sm font-semibold text-[#0A2540]">Position {i + 1}</p>
                {cv.work.length > 1 && (
                  <button onClick={() => set('work', cv.work.filter((_, idx) => idx !== i))} className="text-red-400 hover:text-red-600">
                    <Trash2 className="w-4 h-4" />
                  </button>
                )}
              </div>
              <div className="grid gap-3 sm:grid-cols-2">
                <div>
                  <label className={labelCls}>Job Title</label>
                  <input value={w.title} onChange={e => { const u=[...cv.work]; u[i]={...u[i],title:e.target.value}; set('work',u); }} className={inputCls} placeholder="Boilermaker" />
                </div>
                <div>
                  <label className={labelCls}>Company</label>
                  <input value={w.company} onChange={e => { const u=[...cv.work]; u[i]={...u[i],company:e.target.value}; set('work',u); }} className={inputCls} placeholder="ABC Mining Ltd" />
                </div>
                <div>
                  <label className={labelCls}>Start Date</label>
                  <input value={w.start} onChange={e => { const u=[...cv.work]; u[i]={...u[i],start:e.target.value}; set('work',u); }} className={inputCls} placeholder="Jan 2020" />
                </div>
                <div>
                  <label className={labelCls}>End Date</label>
                  <div className="flex gap-2 items-center">
                    <input value={w.end} onChange={e => { const u=[...cv.work]; u[i]={...u[i],end:e.target.value}; set('work',u); }} disabled={w.current} className={`${inputCls} flex-1`} placeholder="Dec 2023" />
                    <label className="flex items-center gap-1.5 text-xs text-gray-500 whitespace-nowrap cursor-pointer">
                      <input type="checkbox" checked={w.current} onChange={e => { const u=[...cv.work]; u[i]={...u[i],current:e.target.checked}; set('work',u); }} />
                      Current
                    </label>
                  </div>
                </div>
              </div>
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <label className={labelCls}>Description</label>
                  <AiBtn onClick={() => aiRewrite(`work-${i}`, w.description, i)} label={`work-${i}`} />
                </div>
                <textarea
                  value={w.description}
                  onChange={e => { const u=[...cv.work]; u[i]={...u[i],description:e.target.value}; set('work',u); }}
                  placeholder="Describe your responsibilities and achievements…"
                  rows={3}
                  className={`${inputCls} resize-none`}
                />
              </div>
            </div>
          ))}
          <button onClick={() => set('work', [...cv.work, emptyWork()])} className="flex items-center gap-2 text-sm font-semibold text-blue-600 hover:text-blue-800">
            <Plus className="w-4 h-4" /> Add Position
          </button>
        </div>
      );

      case 4: return (
        <div className="space-y-5">
          {cv.education.map((e, i) => (
            <div key={i} className="bg-gray-50 rounded-xl p-4 border border-gray-200 space-y-3">
              <div className="flex items-center justify-between">
                <p className="text-sm font-semibold text-[#0A2540]">Education {i + 1}</p>
                {cv.education.length > 1 && (
                  <button onClick={() => set('education', cv.education.filter((_, idx) => idx !== i))} className="text-red-400 hover:text-red-600">
                    <Trash2 className="w-4 h-4" />
                  </button>
                )}
              </div>
              <div className="grid gap-3 sm:grid-cols-3">
                <div className="sm:col-span-2">
                  <label className={labelCls}>Qualification</label>
                  <input value={e.qualification} onChange={ev => { const u=[...cv.education]; u[i]={...u[i],qualification:ev.target.value}; set('education',u); }} className={inputCls} placeholder="National Trade Certificate: Boilermaker" />
                </div>
                <div>
                  <label className={labelCls}>Year</label>
                  <input value={e.year} onChange={ev => { const u=[...cv.education]; u[i]={...u[i],year:ev.target.value}; set('education',u); }} className={inputCls} placeholder="2018" />
                </div>
                <div className="sm:col-span-3">
                  <label className={labelCls}>Institution</label>
                  <input value={e.institution} onChange={ev => { const u=[...cv.education]; u[i]={...u[i],institution:ev.target.value}; set('education',u); }} className={inputCls} placeholder="Tshwane University of Technology" />
                </div>
              </div>
            </div>
          ))}
          <button onClick={() => set('education', [...cv.education, emptyEdu()])} className="flex items-center gap-2 text-sm font-semibold text-blue-600 hover:text-blue-800">
            <Plus className="w-4 h-4" /> Add Education
          </button>
        </div>
      );

      case 5: return (
        <div className="space-y-5">
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <label className={labelCls}>Skills (comma-separated)</label>
              <AiBtn onClick={() => aiRewrite('skills', cv.skills)} label="skills" />
            </div>
            <textarea value={cv.skills} onChange={e => set('skills', e.target.value)} placeholder="Welding, Stainless Steel Fabrication, Plant Maintenance…" rows={3} className={`${inputCls} resize-none`} />
          </div>
          <div>
            <label className={labelCls}>Certifications (comma-separated)</label>
            <textarea value={cv.certifications} onChange={e => set('certifications', e.target.value)} placeholder="Trade Tested Boilermaker, First Aid Level 3…" rows={2} className={`${inputCls} resize-none`} />
          </div>
          <div>
            <label className={labelCls}>Languages (comma-separated)</label>
            <input value={cv.languages} onChange={e => set('languages', e.target.value)} placeholder="English, Zulu, Afrikaans" className={inputCls} />
          </div>
        </div>
      );

      case 6: return (
        <div className="space-y-5">
          {cv.references.length === 0 ? (
            <div className="text-center py-8 bg-gray-50 rounded-xl border-2 border-dashed border-gray-200">
              <p className="text-gray-400 text-sm mb-3">No references added — CV will show "Available on request"</p>
              <button onClick={() => set('references', [emptyRef()])} className="flex items-center gap-2 text-sm font-semibold text-blue-600 hover:text-blue-800 mx-auto">
                <Plus className="w-4 h-4" /> Add Reference
              </button>
            </div>
          ) : (
            <>
              {cv.references.map((r, i) => (
                <div key={i} className="bg-gray-50 rounded-xl p-4 border border-gray-200 space-y-3">
                  <div className="flex items-center justify-between">
                    <p className="text-sm font-semibold text-[#0A2540]">Reference {i + 1}</p>
                    <button onClick={() => set('references', cv.references.filter((_, idx) => idx !== i))} className="text-red-400 hover:text-red-600">
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                  <div className="grid gap-3 sm:grid-cols-2">
                    {[['Full Name','name'],['Company','company'],['Phone','phone'],['Email','email']].map(([label, key]) => (
                      <div key={key}>
                        <label className={labelCls}>{label}</label>
                        <input value={(r as any)[key]} onChange={e => { const u=[...cv.references]; u[i]={...u[i],[key]:e.target.value}; set('references',u); }} className={inputCls} placeholder={label} />
                      </div>
                    ))}
                  </div>
                </div>
              ))}
              <button onClick={() => set('references', [...cv.references, emptyRef()])} className="flex items-center gap-2 text-sm font-semibold text-blue-600 hover:text-blue-800">
                <Plus className="w-4 h-4" /> Add Another
              </button>
            </>
          )}
        </div>
      );

      case 7: return (
        <div className="space-y-4">
          <p className="text-sm text-gray-500">Your CV is ready. Preview it below, then download or save.</p>
          <div className="rounded-xl overflow-hidden border border-gray-200 shadow-inner" style={{ height: 600 }}>
            <iframe
              srcDoc={buildCvHtml(cv)}
              title="CV Preview"
              style={{ width: '100%', height: '100%', border: 'none' }}
            />
          </div>
          <div className="flex flex-wrap gap-3">
            <button onClick={printCv} className="flex items-center gap-2 px-5 py-2.5 bg-[#0A2540] text-white text-sm font-bold rounded-xl hover:bg-[#0d2f50] transition-colors">
              <Download className="w-4 h-4" /> Download PDF
            </button>
            <button onClick={saveToProfile} disabled={saving} className="flex items-center gap-2 px-5 py-2.5 bg-[#00C853] text-white text-sm font-bold rounded-xl hover:bg-[#00B548] transition-colors disabled:opacity-60">
              {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
              {saving ? 'Saving…' : 'Save to Profile'}
            </button>
          </div>
        </div>
      );

      default: return null;
    }
  }

  return (
    <div className="max-w-5xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold text-[#0A2540]">AI CV Builder</h1>
          <p className="text-sm text-gray-500 mt-0.5">Build a professional CV with AI writing assistance</p>
        </div>
        <div className="flex gap-2">
          <button onClick={() => setShowPreview(!showPreview)} className="flex items-center gap-2 px-4 py-2 border border-gray-200 text-gray-600 text-sm font-medium rounded-lg hover:bg-gray-50">
            {showPreview ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
            {showPreview ? 'Hide' : 'Preview'}
          </button>
          <button onClick={printCv} className="flex items-center gap-2 px-4 py-2 bg-[#0A2540] text-white text-sm font-semibold rounded-lg hover:bg-[#0d2f50]">
            <Download className="w-4 h-4" /> Download PDF
          </button>
        </div>
      </div>

      <div className={`flex gap-6 ${showPreview ? 'flex-col lg:flex-row' : ''}`}>
        {/* Form side */}
        <div className={showPreview ? 'flex-1 min-w-0' : 'w-full'}>
          {/* Steps */}
          <div className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
            {/* Step bar */}
            <div className="flex overflow-x-auto border-b border-gray-100">
              {STEPS.map((s, i) => (
                <button
                  key={i}
                  onClick={() => setStep(i)}
                  className={`flex-shrink-0 px-4 py-3 text-xs font-semibold whitespace-nowrap transition-colors border-b-2 ${
                    step === i ? 'border-[#0A2540] text-[#0A2540] bg-blue-50' : 'border-transparent text-gray-400 hover:text-gray-600'
                  }`}
                >
                  {i + 1}. {s}
                </button>
              ))}
            </div>

            {/* Step content */}
            <div className="p-6">{renderStep()}</div>

            {/* Navigation */}
            <div className="flex justify-between p-5 border-t border-gray-100 bg-gray-50">
              <button
                onClick={() => setStep(s => Math.max(0, s - 1))}
                disabled={step === 0}
                className="flex items-center gap-1.5 px-5 py-2.5 border border-gray-200 text-gray-600 text-sm font-semibold rounded-lg hover:bg-white disabled:opacity-40 transition-colors"
              >
                <ChevronLeft className="w-4 h-4" /> Back
              </button>
              {step < STEPS.length - 1 ? (
                <button
                  onClick={() => setStep(s => Math.min(STEPS.length - 1, s + 1))}
                  className="flex items-center gap-1.5 px-5 py-2.5 bg-[#0A2540] text-white text-sm font-bold rounded-lg hover:bg-[#0d2f50] transition-colors"
                >
                  Next <ChevronRight className="w-4 h-4" />
                </button>
              ) : (
                <button onClick={printCv} className="flex items-center gap-1.5 px-5 py-2.5 bg-[#00C853] text-white text-sm font-bold rounded-lg hover:bg-[#00B548]">
                  <Download className="w-4 h-4" /> Download PDF
                </button>
              )}
            </div>
          </div>
        </div>

        {/* Live preview */}
        {showPreview && (
          <div className="w-full lg:w-[420px] flex-shrink-0">
            <div className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden sticky top-4">
              <div className="flex items-center gap-2 px-4 py-3 border-b border-gray-100 bg-gray-50">
                <Eye className="w-4 h-4 text-gray-400" />
                <span className="text-xs font-semibold text-gray-500">Live Preview</span>
              </div>
              <iframe
                srcDoc={buildCvHtml(cv)}
                title="CV Preview"
                style={{ width: '100%', height: 600, border: 'none', transform: 'scale(0.75)', transformOrigin: 'top left', width: '133%', height: 800 }}
              />
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
