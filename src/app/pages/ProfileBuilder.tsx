import { useState, useEffect, useRef, type ChangeEvent } from 'react';
import { Link } from 'react-router';
import { Plus, Trash2, Link as LinkIcon, Save, ChevronRight, User, Briefcase, BookOpen, Award, Video, Loader2 } from 'lucide-react';
import { useForm } from 'react-hook-form';
import { useAuth } from '../context/useAuth';
import { apiCall } from '../lib/supabase';
import { toast } from 'sonner';
import { calculateProfileCompletion } from '../lib/profileCompletion';
import type { EducationItem, ExperienceItem } from '../types';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '../components/ui/dialog';

export default function ProfileBuilder() {
  const { user, profile, refreshProfile } = useAuth();
  const [activeSection, setActiveSection] = useState('personal');
  const [saving, setSaving] = useState(false);
  const [avatarUrl, setAvatarUrl] = useState('');
  const [workHistory, setWorkHistory] = useState<ExperienceItem[]>([]);
  const [educationHistory, setEducationHistory] = useState<EducationItem[]>([]);
  const [skills, setSkills] = useState<string[]>([]);
  const [skillInput, setSkillInput] = useState('');
  const avatarInputRef = useRef<HTMLInputElement | null>(null);
  const videoInputRef = useRef<HTMLInputElement | null>(null);
  const [videoIntroUrl, setVideoIntroUrl] = useState('');
  const [workDialogOpen, setWorkDialogOpen] = useState(false);
  const [educationDialogOpen, setEducationDialogOpen] = useState(false);
  const [newWorkRole, setNewWorkRole] = useState({ title: '', company: '', startDate: '2025-01' });
  const [newEducation, setNewEducation] = useState({ institution: '', degree: '', startDate: '2024-01' });

  const { register, reset, getValues } = useForm({
    defaultValues: {
      name: '', phone: '', location: '', headline: '', summary: '',
      linkedin: '', github: '', portfolio: '', twitter: '',
    }
  });

  useEffect(() => {
    if (!profile) return;

    reset({
      name: profile.name || '',
      phone: profile.phone || '',
      location: profile.location || '',
      headline: profile.headline || '',
      summary: profile.summary || '',
      linkedin: (profile.social_links as any)?.linkedin || '',
      github: (profile.social_links as any)?.github || '',
      portfolio: (profile.social_links as any)?.portfolio || '',
      twitter: (profile.social_links as any)?.twitter || '',
    });

    setAvatarUrl(profile.avatar_url || '');
    setSkills(Array.isArray(profile.skills) ? profile.skills.filter(Boolean) : []);
    setWorkHistory(Array.isArray(profile.experience) ? profile.experience : []);
    setEducationHistory(Array.isArray(profile.education) ? profile.education : []);
    const social = (profile.social_links as Record<string, string> | undefined) || {};
    setVideoIntroUrl(social.video_introduction || social.videoIntroduction || '');
  }, [profile, reset]);

  const saveProfile = async (extraUpdates?: Record<string, unknown>) => {
    const values = getValues();
    const currentSocialLinks = ((profile?.social_links as Record<string, string | undefined> | undefined) || {});
    setSaving(true);
    try {
      await apiCall('/auth/profile', {
        method: 'PUT',
        requireAuth: true,
        body: JSON.stringify({
          name: values.name,
          phone: values.phone,
          location: values.location,
          headline: values.headline,
          summary: values.summary,
          avatar_url: avatarUrl || null,
          skills,
          experience: workHistory,
          education: educationHistory,
          social_links: {
            ...currentSocialLinks,
            linkedin: values.linkedin,
            github: values.github,
            portfolio: values.portfolio,
            twitter: values.twitter,
            video_introduction: videoIntroUrl,
          },
          ...(extraUpdates || {}),
        }),
      });
      await refreshProfile?.();
      toast.success('Profile updated!');
    } catch (error: any) {
      toast.error(error.message || 'Failed to save profile');
    } finally {
      setSaving(false);
    }
  };

  const handleSave = async () => {
    await saveProfile();
  };

  const handleCancel = () => {
    if (!profile) return;

    reset({
      name: profile.name || '',
      phone: profile.phone || '',
      location: profile.location || '',
      headline: profile.headline || '',
      summary: profile.summary || '',
      linkedin: (profile.social_links as any)?.linkedin || '',
      github: (profile.social_links as any)?.github || '',
      portfolio: (profile.social_links as any)?.portfolio || '',
      twitter: (profile.social_links as any)?.twitter || '',
    });
    setAvatarUrl(profile.avatar_url || '');
    setSkills(Array.isArray(profile.skills) ? profile.skills.filter(Boolean) : []);
    setWorkHistory(Array.isArray(profile.experience) ? profile.experience : []);
    setEducationHistory(Array.isArray(profile.education) ? profile.education : []);
    const social = (profile.social_links as Record<string, string> | undefined) || {};
    setVideoIntroUrl(social.video_introduction || social.videoIntroduction || '');
    setSkillInput('');
    toast.info('Changes discarded.');
  };

  const triggerAvatarUpload = () => {
    avatarInputRef.current?.click();
  };

  const handleAvatarFileChange = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      toast.error('Please select an image file.');
      return;
    }

    const maxBytes = 2 * 1024 * 1024;
    if (file.size > maxBytes) {
      toast.error('Image is too large. Max size is 2MB.');
      return;
    }

    const reader = new FileReader();
    reader.onload = async () => {
      const nextUrl = typeof reader.result === 'string' ? reader.result : '';
      if (!nextUrl) {
        toast.error('Could not read selected image');
        return;
      }
      setAvatarUrl(nextUrl);
      await saveProfile({ avatar_url: nextUrl });
    };
    reader.onerror = () => toast.error('Failed to process selected image');
    reader.readAsDataURL(file);
  };

  const triggerVideoUpload = () => {
    videoInputRef.current?.click();
  };

  const handleVideoFileChange = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file) return;

    if (!file.type.startsWith('video/')) {
      toast.error('Please select a video file.');
      return;
    }

    const maxBytes = 50 * 1024 * 1024;
    if (file.size > maxBytes) {
      toast.error('Video is too large. Max size is 50MB.');
      return;
    }

    const reader = new FileReader();
    reader.onload = async () => {
      const nextUrl = typeof reader.result === 'string' ? reader.result : '';
      if (!nextUrl) {
        toast.error('Could not read selected video');
        return;
      }

      const values = getValues();
      const currentSocialLinks = ((profile?.social_links as Record<string, string | undefined> | undefined) || {});
      setVideoIntroUrl(nextUrl);
      await saveProfile({
        social_links: {
          ...currentSocialLinks,
          linkedin: values.linkedin,
          github: values.github,
          portfolio: values.portfolio,
          twitter: values.twitter,
          video_introduction: nextUrl,
        },
      });
    };
    reader.onerror = () => toast.error('Failed to process selected video');
    reader.readAsDataURL(file);
  };

  const addWorkRole = () => {
    if (!newWorkRole.title.trim() || !newWorkRole.company.trim()) {
      toast.error('Role title and company are required.');
      return;
    }

    setWorkHistory((prev) => [
      {
        id: crypto.randomUUID(),
        title: newWorkRole.title.trim(),
        company: newWorkRole.company.trim(),
        startDate: newWorkRole.startDate,
      },
      ...prev,
    ]);
    setNewWorkRole({ title: '', company: '', startDate: '2025-01' });
    setWorkDialogOpen(false);
  };

  const addEducation = () => {
    if (!newEducation.institution.trim() || !newEducation.degree.trim()) {
      toast.error('Institution and qualification are required.');
      return;
    }

    setEducationHistory((prev) => [
      {
        id: crypto.randomUUID(),
        institution: newEducation.institution.trim(),
        degree: newEducation.degree.trim(),
        startDate: newEducation.startDate,
      },
      ...prev,
    ]);
    setNewEducation({ institution: '', degree: '', startDate: '2024-01' });
    setEducationDialogOpen(false);
  };

  const addSkill = () => {
    const normalized = skillInput.trim();
    if (!normalized) return;

    setSkills((prev) => {
      if (prev.some((s) => s.toLowerCase() === normalized.toLowerCase())) {
        toast.info('Skill already added.');
        return prev;
      }
      return [...prev, normalized];
    });
    setSkillInput('');
  };

  const percent = calculateProfileCompletion(profile as any);

  const sections = [
    { id: 'personal', label: 'Personal Details', icon: User },
    { id: 'summary', label: 'Professional Summary', icon: Briefcase },
    { id: 'video', label: 'Video Introduction', icon: Video },
    { id: 'work', label: 'Work History', icon: Briefcase },
    { id: 'education', label: 'Education', icon: BookOpen },
    { id: 'skills', label: 'Skills', icon: Award },
    { id: 'social', label: 'Social Links', icon: LinkIcon },
  ];

  return (
    <div className="flex flex-col lg:flex-row gap-8">
      {/* Left Sidebar Navigation */}
      <div className="lg:w-1/4">
        <div className="bg-white rounded-[var(--rf-radius-lg)] shadow-[var(--rf-card-shadow)] p-2 sticky top-6">
          <div className="p-4 border-b border-gray-100 mb-2">
            <h2 className="font-bold text-[var(--rf-navy)] text-lg">My Profile</h2>
            <p className="text-xs text-[var(--rf-success)] font-semibold mt-1">{percent}% Complete</p>
            <div className="w-full bg-gray-200 rounded-full h-1.5 mt-2">
              <div className="bg-[var(--rf-success)] h-1.5 rounded-full" style={{ width: `${percent}%` }}></div>
            </div>
          </div>
          
          <nav className="space-y-1">
            {sections.map((section) => (
              <button
                key={section.id}
                onClick={() => setActiveSection(section.id)}
                className={`w-full flex items-center justify-between px-4 py-3 text-sm font-medium rounded-[var(--rf-radius-md)] transition-colors ${
                  activeSection === section.id
                    ? 'bg-[var(--rf-navy)] text-white shadow-md'
                    : 'text-gray-600 hover:bg-gray-50 text-[var(--rf-text)]'
                }`}
              >
                <div className="flex items-center">
                  <section.icon className={`w-4 h-4 mr-3 ${activeSection === section.id ? 'text-[var(--rf-green)]' : 'text-gray-400'}`} />
                  {section.label}
                </div>
                {activeSection === section.id && <ChevronRight className="w-4 h-4" />}
              </button>
            ))}
          </nav>
          
          
          <div className="p-4 mt-4 border-t border-gray-100">
             <Link to="/seeker/cv" className="block w-full text-center py-2 bg-gray-100 text-[var(--rf-navy)] font-bold text-sm rounded hover:bg-gray-200 transition-colors">
               Preview Profile
             </Link>
          </div>
        </div>
      </div>

      {/* Main Content Area */}
      <div className="lg:w-3/4 bg-white rounded-[var(--rf-radius-lg)] shadow-[var(--rf-card-shadow)] p-8">
        
        {activeSection === 'personal' && (
          <div className="space-y-6">
            <h2 className="text-2xl font-bold text-[var(--rf-navy)] border-b pb-4 mb-6">Personal Details</h2>
            
            <div className="flex items-start gap-6 mb-8">
              <button type="button" onClick={triggerAvatarUpload} className="relative group cursor-pointer text-left">
                <div className="w-24 h-24 rounded-full bg-gray-200 flex items-center justify-center overflow-hidden border-2 border-dashed border-gray-400 hover:border-[var(--rf-green)] transition-colors">
                  {avatarUrl ? (
                    <img src={avatarUrl} alt="Profile avatar" className="w-full h-full object-cover" />
                  ) : (
                    <User className="w-10 h-10 text-gray-400" />
                  )}
                </div>
                <div className="absolute inset-0 flex items-center justify-center bg-black bg-opacity-50 text-white text-xs rounded-full opacity-0 group-hover:opacity-100 transition-opacity">
                   Change
                </div>
              </button>
              <div>
                <h3 className="font-bold text-[var(--rf-navy)] mb-1">Profile Photo</h3>
                <p className="text-sm text-[var(--rf-muted)] mb-3">Upload a professional photo. Max size 2MB.</p>
                <button onClick={triggerAvatarUpload} className="px-3 py-1.5 border border-gray-300 rounded text-sm font-semibold hover:border-[var(--rf-green)] hover:text-[var(--rf-green)] transition-colors">
                  Upload From Device
                </button>
              </div>
            </div>
            <input ref={avatarInputRef} type="file" accept="image/*" className="hidden" onChange={handleAvatarFileChange} />

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <label className="block text-sm font-semibold text-[var(--rf-navy)] mb-2">First Name</label>
                <input type="text" className="w-full px-4 py-2 border rounded-[var(--rf-radius-md)] focus:outline-none focus:border-[var(--rf-green)]" {...register('name')} placeholder="Full Name" />
              </div>
              <div>
                <label className="block text-sm font-semibold text-[var(--rf-navy)] mb-2">Email Address</label>
                <input type="email" className="w-full px-4 py-2 border rounded-[var(--rf-radius-md)] bg-gray-50 text-gray-500 cursor-not-allowed" defaultValue={user?.email || ''} disabled />
              </div>
              <div>
                <label className="block text-sm font-semibold text-[var(--rf-navy)] mb-2">Phone Number</label>
                <input type="tel" className="w-full px-4 py-2 border rounded-[var(--rf-radius-md)] focus:outline-none focus:border-[var(--rf-green)]" placeholder="+27 00 000 0000" {...register('phone')} />
              </div>
              <div>
                <label className="block text-sm font-semibold text-[var(--rf-navy)] mb-2">Location</label>
                <input type="text" className="w-full px-4 py-2 border rounded-[var(--rf-radius-md)] focus:outline-none focus:border-[var(--rf-green)]" placeholder="City, Country" {...register('location')} />
              </div>
              <div>
                <label className="block text-sm font-semibold text-[var(--rf-navy)] mb-2">Headline</label>
                <input type="text" className="w-full px-4 py-2 border rounded-[var(--rf-radius-md)] focus:outline-none focus:border-[var(--rf-green)]" placeholder="e.g. Senior React Developer" {...register('headline')} />
              </div>
            </div>
            <div className="flex justify-end mt-6">
              <button onClick={handleSave} disabled={saving} className="flex items-center gap-2 px-6 py-2.5 bg-[var(--rf-green)] text-white rounded-[var(--rf-radius-md)] font-semibold hover:bg-[#00B548] transition-colors disabled:opacity-50">
                {saving ? <><Loader2 className="w-4 h-4 animate-spin" /> Saving...</> : <><Save className="w-4 h-4" /> Save Changes</>}
              </button>
            </div>
          </div>
        )}

        {activeSection === 'summary' && (
          <div className="space-y-6">
            <h2 className="text-2xl font-bold text-[var(--rf-navy)] border-b pb-4 mb-6">Professional Summary</h2>
            <div className="bg-blue-50 border border-blue-100 p-4 rounded-[var(--rf-radius-md)] mb-4">
              <p className="text-sm text-blue-800">
                <strong>Tip:</strong> Introduce yourself, highlight your key achievements, and explain what you're looking for.
              </p>
            </div>
            <textarea
              className="w-full h-48 p-4 border rounded-[var(--rf-radius-md)] focus:outline-none focus:border-[var(--rf-green)]"
              placeholder="I am a passionate developer with..."
              {...register('summary')}
            ></textarea>
            <div className="flex justify-between items-center mt-2">
              <span className="text-xs text-gray-400">Write 2-3 sentences about your experience and goals.</span>
              <button onClick={handleSave} disabled={saving} className="flex items-center gap-2 px-6 py-2.5 bg-[var(--rf-green)] text-white rounded-[var(--rf-radius-md)] font-semibold hover:bg-[#00B548] transition-colors disabled:opacity-50">
                {saving ? <><Loader2 className="w-4 h-4 animate-spin" /> Saving...</> : <><Save className="w-4 h-4" /> Save Changes</>}
              </button>
            </div>
          </div>
        )}
        
        {activeSection === 'video' && (
           <div className="space-y-6">
             <h2 className="text-2xl font-bold text-[var(--rf-navy)] border-b pb-4 mb-6">Video Introduction</h2>
             <p className="text-[var(--rf-text)] mb-4">
               Stand out to employers with a short 60-second video introduction.
             </p>
             
             <div className="border-2 border-dashed border-gray-300 rounded-[var(--rf-radius-lg)] p-8 text-center bg-gray-50 hover:bg-white hover:border-[var(--rf-green)] transition-all">
               <div className="w-16 h-16 bg-[var(--rf-navy)] rounded-full flex items-center justify-center mx-auto mb-4 text-white">
                 <Video className="w-8 h-8" />
               </div>
               <h3 className="font-bold text-lg text-[var(--rf-navy)] mb-2">Upload Your Intro Video</h3>
               <p className="text-sm text-[var(--rf-muted)] mb-6">MP4, WebM formats supported (Max 50MB)</p>

               {videoIntroUrl ? (
                 <div className="max-w-2xl mx-auto mb-5 overflow-hidden rounded-[var(--rf-radius-md)] border border-gray-200 bg-black">
                   <video
                     src={videoIntroUrl}
                     controls
                     className="w-full h-auto max-h-[380px]"
                     preload="metadata"
                   />
                 </div>
               ) : (
                 <p className="text-sm text-gray-500 italic mb-5">No video uploaded yet.</p>
               )}

               <div className="flex flex-wrap items-center justify-center gap-3">
                 <button onClick={triggerVideoUpload} className="px-6 py-2 bg-[var(--rf-green)] text-white font-bold rounded shadow-lg hover:shadow-xl hover:bg-[#00B548] transition-all">
                   {videoIntroUrl ? 'Replace Video' : 'Upload Video'}
                 </button>
                 {videoIntroUrl ? (
                   <button
                     onClick={async () => {
                       const values = getValues();
                       const currentSocialLinks = ((profile?.social_links as Record<string, string | undefined> | undefined) || {});
                       setVideoIntroUrl('');
                       await saveProfile({
                         social_links: {
                           ...currentSocialLinks,
                           linkedin: values.linkedin,
                           github: values.github,
                           portfolio: values.portfolio,
                           twitter: values.twitter,
                           video_introduction: '',
                         },
                       });
                     }}
                     className="px-6 py-2 border border-red-200 text-red-600 font-semibold rounded hover:bg-red-50 transition-colors"
                   >
                     Remove Video
                   </button>
                 ) : null}
               </div>
               <input ref={videoInputRef} type="file" accept="video/mp4,video/webm,video/quicktime" className="hidden" onChange={handleVideoFileChange} />
             </div>
           </div>
        )}
        
         {activeSection === 'work' && (
           <div className="space-y-6">
             <div className="flex justify-between items-center border-b pb-4 mb-6">
                <h2 className="text-2xl font-bold text-[var(--rf-navy)]">Work History</h2>
                <button onClick={() => setWorkDialogOpen(true)} className="flex items-center text-sm font-bold text-[var(--rf-green)] border border-[var(--rf-green)] px-3 py-1.5 rounded hover:bg-green-50 transition-colors">
                  <Plus className="w-4 h-4 mr-1" /> Add Role
                </button>
             </div>
             
             {workHistory.length === 0 ? (
               <div className="bg-gray-50 border border-gray-100 rounded-[var(--rf-radius-lg)] p-6 text-center py-12">
                 <Briefcase className="w-12 h-12 text-gray-300 mx-auto mb-3" />
                 <h3 className="text-gray-600 font-semibold mb-1">No work history added</h3>
                 <p className="text-sm text-gray-400 mb-4">Add your past roles to showcase your experience.</p>
                 <button onClick={() => setWorkDialogOpen(true)} className="text-[var(--rf-green)] font-bold text-sm hover:underline">Add your first role</button>
               </div>
             ) : (
               <div className="space-y-3">
                 {workHistory.map((role) => (
                   <div key={role.id || `${role.company}-${role.title}-${role.startDate}`} className="bg-gray-50 border border-gray-100 rounded-[var(--rf-radius-md)] p-4 flex items-start justify-between gap-4">
                     <div>
                       <h3 className="font-semibold text-[var(--rf-navy)]">{role.title}</h3>
                       <p className="text-sm text-[var(--rf-muted)]">{role.company}</p>
                       <p className="text-xs text-gray-500 mt-1">{role.startDate || 'Start date not set'} {role.endDate ? `→ ${role.endDate}` : '→ Present'}</p>
                     </div>
                     <button onClick={() => setWorkHistory((prev) => prev.filter((item) => item !== role))} className="text-red-500 hover:text-red-600 text-sm font-semibold inline-flex items-center">
                       <Trash2 className="w-4 h-4 mr-1" /> Remove
                     </button>
                   </div>
                 ))}
               </div>
             )}
           </div>
        )}
        
         {activeSection === 'education' && (
           <div className="space-y-6">
             <div className="flex justify-between items-center border-b pb-4 mb-6">
                <h2 className="text-2xl font-bold text-[var(--rf-navy)]">Education</h2>
                <button onClick={() => setEducationDialogOpen(true)} className="flex items-center text-sm font-bold text-[var(--rf-green)] border border-[var(--rf-green)] px-3 py-1.5 rounded hover:bg-green-50 transition-colors">
                  <Plus className="w-4 h-4 mr-1" /> Add Education
                </button>
             </div>
             
             {educationHistory.length === 0 ? (
               <div className="bg-gray-50 border border-gray-100 rounded-[var(--rf-radius-lg)] p-6 text-center py-12">
                 <BookOpen className="w-12 h-12 text-gray-300 mx-auto mb-3" />
                 <h3 className="text-gray-600 font-semibold mb-1">No education added</h3>
                 <p className="text-sm text-gray-400 mb-4">Add your educational background.</p>
                 <button onClick={() => setEducationDialogOpen(true)} className="text-[var(--rf-green)] font-bold text-sm hover:underline">Add your first degree</button>
               </div>
             ) : (
               <div className="space-y-3">
                 {educationHistory.map((edu) => (
                   <div key={edu.id || `${edu.institution}-${edu.degree}-${edu.startDate}`} className="bg-gray-50 border border-gray-100 rounded-[var(--rf-radius-md)] p-4 flex items-start justify-between gap-4">
                     <div>
                       <h3 className="font-semibold text-[var(--rf-navy)]">{edu.degree}</h3>
                       <p className="text-sm text-[var(--rf-muted)]">{edu.institution}</p>
                       <p className="text-xs text-gray-500 mt-1">{edu.startDate || 'Start date not set'} {edu.endDate ? `→ ${edu.endDate}` : ''}</p>
                     </div>
                     <button onClick={() => setEducationHistory((prev) => prev.filter((item) => item !== edu))} className="text-red-500 hover:text-red-600 text-sm font-semibold inline-flex items-center">
                       <Trash2 className="w-4 h-4 mr-1" /> Remove
                     </button>
                   </div>
                 ))}
               </div>
             )}
           </div>
        )}
        
        {activeSection === 'skills' && (
           <div className="space-y-6">
             <h2 className="text-2xl font-bold text-[var(--rf-navy)] border-b pb-4 mb-6">Skills & Tools</h2>
             
             <div>
               <label className="block text-sm font-semibold text-[var(--rf-navy)] mb-2">Add Skills</label>
               <div className="flex gap-2 mb-4">
                 <input
                   type="text"
                   value={skillInput}
                   onChange={(e) => setSkillInput(e.target.value)}
                   onKeyDown={(e) => {
                     if (e.key === 'Enter') {
                       e.preventDefault();
                       addSkill();
                     }
                   }}
                   placeholder="e.g. React, Python, Project Management"
                   className="flex-1 px-4 py-2 border rounded-[var(--rf-radius-md)] focus:outline-none focus:border-[var(--rf-green)]"
                 />
                 <button onClick={addSkill} className="px-4 py-2 bg-[var(--rf-navy)] text-white font-bold rounded">Add</button>
               </div>
               
               <div className="flex flex-wrap gap-2">
                 {skills.length === 0 ? (
                   <p className="text-gray-400 italic text-sm">No skills added yet.</p>
                 ) : (
                   skills.map((skill) => (
                     <span key={skill} className="inline-flex items-center px-3 py-1 rounded-full bg-gray-100 text-sm text-[var(--rf-navy)]">
                       {skill}
                       <button onClick={() => setSkills((prev) => prev.filter((s) => s !== skill))} className="ml-2 text-gray-500 hover:text-red-500" aria-label={`Remove ${skill}`}>
                         ×
                       </button>
                     </span>
                   ))
                 )}
               </div>
             </div>
           </div>
        )}

        {activeSection === 'social' && (
          <div className="space-y-6">
            <h2 className="text-2xl font-bold text-[var(--rf-navy)] border-b pb-4 mb-6">Social Links</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <label className="block text-sm font-semibold text-[var(--rf-navy)] mb-2">LinkedIn</label>
                <input type="url" className="w-full px-4 py-2 border rounded-[var(--rf-radius-md)] focus:outline-none focus:border-[var(--rf-green)]" placeholder="https://linkedin.com/in/username" {...register('linkedin')} />
              </div>
              <div>
                <label className="block text-sm font-semibold text-[var(--rf-navy)] mb-2">GitHub</label>
                <input type="url" className="w-full px-4 py-2 border rounded-[var(--rf-radius-md)] focus:outline-none focus:border-[var(--rf-green)]" placeholder="https://github.com/username" {...register('github')} />
              </div>
              <div>
                <label className="block text-sm font-semibold text-[var(--rf-navy)] mb-2">Portfolio</label>
                <input type="url" className="w-full px-4 py-2 border rounded-[var(--rf-radius-md)] focus:outline-none focus:border-[var(--rf-green)]" placeholder="https://yourportfolio.com" {...register('portfolio')} />
              </div>
              <div>
                <label className="block text-sm font-semibold text-[var(--rf-navy)] mb-2">X / Twitter</label>
                <input type="url" className="w-full px-4 py-2 border rounded-[var(--rf-radius-md)] focus:outline-none focus:border-[var(--rf-green)]" placeholder="https://x.com/username" {...register('twitter')} />
              </div>
            </div>
            <div className="flex justify-end mt-6">
              <button onClick={handleSave} disabled={saving} className="flex items-center gap-2 px-6 py-2.5 bg-[var(--rf-green)] text-white rounded-[var(--rf-radius-md)] font-semibold hover:bg-[#00B548] transition-colors disabled:opacity-50">
                {saving ? <><Loader2 className="w-4 h-4 animate-spin" /> Saving...</> : <><Save className="w-4 h-4" /> Save Links</>}
              </button>
            </div>
          </div>
        )}

        {/* Buttons */}
        <Dialog open={workDialogOpen} onOpenChange={setWorkDialogOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Add Work Role</DialogTitle>
              <DialogDescription>Add your latest role details.</DialogDescription>
            </DialogHeader>
            <div className="space-y-3">
              <input value={newWorkRole.title} onChange={(e) => setNewWorkRole((prev) => ({ ...prev, title: e.target.value }))} placeholder="Role title" className="w-full px-3 py-2 border rounded-md" />
              <input value={newWorkRole.company} onChange={(e) => setNewWorkRole((prev) => ({ ...prev, company: e.target.value }))} placeholder="Company" className="w-full px-3 py-2 border rounded-md" />
              <input value={newWorkRole.startDate} onChange={(e) => setNewWorkRole((prev) => ({ ...prev, startDate: e.target.value }))} placeholder="YYYY-MM" className="w-full px-3 py-2 border rounded-md" />
            </div>
            <DialogFooter>
              <button onClick={() => setWorkDialogOpen(false)} className="px-4 py-2 border rounded-md">Cancel</button>
              <button onClick={addWorkRole} className="px-4 py-2 bg-[var(--rf-green)] text-white rounded-md">Add Role</button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        <Dialog open={educationDialogOpen} onOpenChange={setEducationDialogOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Add Education</DialogTitle>
              <DialogDescription>Add your latest education details.</DialogDescription>
            </DialogHeader>
            <div className="space-y-3">
              <input value={newEducation.institution} onChange={(e) => setNewEducation((prev) => ({ ...prev, institution: e.target.value }))} placeholder="Institution" className="w-full px-3 py-2 border rounded-md" />
              <input value={newEducation.degree} onChange={(e) => setNewEducation((prev) => ({ ...prev, degree: e.target.value }))} placeholder="Degree / Qualification" className="w-full px-3 py-2 border rounded-md" />
              <input value={newEducation.startDate} onChange={(e) => setNewEducation((prev) => ({ ...prev, startDate: e.target.value }))} placeholder="YYYY-MM" className="w-full px-3 py-2 border rounded-md" />
            </div>
            <DialogFooter>
              <button onClick={() => setEducationDialogOpen(false)} className="px-4 py-2 border rounded-md">Cancel</button>
              <button onClick={addEducation} className="px-4 py-2 bg-[var(--rf-green)] text-white rounded-md">Add Education</button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        <div className="mt-8 pt-6 border-t border-gray-100 flex justify-end gap-4">
          <button onClick={handleCancel} className="px-6 py-2 border border-gray-300 text-gray-600 font-semibold rounded hover:bg-gray-50 transition-colors">
            Cancel
          </button>
          <button onClick={handleSave} disabled={saving} className="px-6 py-2 bg-[var(--rf-navy)] text-white font-bold rounded flex items-center hover:bg-opacity-90 transition-opacity disabled:opacity-50">
            <Save className="w-4 h-4 mr-2" />
            {saving ? 'Saving...' : 'Save Changes'}
          </button>
        </div>

      </div>
    </div>
  );
}
