import { useEffect, useMemo, useRef, useState, type ChangeEvent } from 'react';
import { useAuth } from '../context/useAuth';
import { FileText, Download, Upload, RefreshCcw, Eye, Edit2, Trash2, Loader2 } from 'lucide-react';
import { apiCall } from '../lib/supabase';
import { toast } from 'sonner';
import type { CVFile, CVSettings, EducationItem, ExperienceItem } from '../types';
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
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '../components/ui/dialog';

export default function SeekerCV() {
  const { profile } = useAuth();
  const [settings, setSettings] = useState<CVSettings>({ template: 'classic', visibility: true, last_synced_at: null });
  const [files, setFiles] = useState<CVFile[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const [editingFile, setEditingFile] = useState<CVFile | null>(null);
  const [editFileName, setEditFileName] = useState('');
  const [editFileSize, setEditFileSize] = useState('0');
  const [deleteFileId, setDeleteFileId] = useState<string | null>(null);

  const experienceHistory = useMemo<ExperienceItem[]>(() => {
    return Array.isArray(profile?.experience) ? profile.experience : [];
  }, [profile?.experience]);

  const educationHistory = useMemo<EducationItem[]>(() => {
    return Array.isArray(profile?.education) ? profile.education : [];
  }, [profile?.education]);

  const profileSkills = useMemo<string[]>(() => {
    return Array.isArray(profile?.skills)
      ? profile.skills.filter((skill: unknown): skill is string => typeof skill === 'string' && skill.trim().length > 0)
      : [];
  }, [profile?.skills]);

  const templateClasses = useMemo(() => {
    if (settings.template === 'modern') {
      return {
        wrapper: 'border-l-4 border-[var(--rf-green)]',
        name: 'tracking-tight',
        sectionHeading: 'text-[var(--rf-green)] border-b border-[var(--rf-green)]/30',
        skillChip: 'bg-green-50 text-green-700 border border-green-200',
      };
    }

    if (settings.template === 'bold') {
      return {
        wrapper: 'bg-gradient-to-b from-slate-50 to-white border border-slate-200',
        name: 'uppercase tracking-wide',
        sectionHeading: 'text-[#0A2540] border-b-2 border-[#0A2540]',
        skillChip: 'bg-[#0A2540] text-white border border-[#0A2540]',
      };
    }

    return {
      wrapper: '',
      name: '',
      sectionHeading: 'text-[var(--rf-navy)] border-b border-gray-200',
      skillChip: 'bg-gray-100 text-[var(--rf-navy)] border border-gray-200',
    };
  }, [settings.template]);

  useEffect(() => {
    loadCVData();
  }, []);

  async function loadCVData() {
    setLoading(true);
    try {
      const [{ settings: settingsData }, { files: fileRows }] = await Promise.all([
        apiCall('/cv/settings'),
        apiCall('/cv/files'),
      ]);
      if (settingsData) {
        setSettings({
          template: settingsData.template || 'classic',
          visibility: settingsData.visibility ?? true,
          last_synced_at: settingsData.last_synced_at || null,
        });
      }
      setFiles(fileRows || []);
    } catch (error: any) {
      toast.error(error.message || 'Failed to load CV settings');
    } finally {
      setLoading(false);
    }
  }

  async function saveSettings(next: Partial<CVSettings>) {
    setSaving(true);
    const previous = settings;
    setSettings((prev) => ({ ...prev, ...next }));
    try {
      const payload = { ...settings, ...next };
      const { settings: updated } = await apiCall('/cv/settings', {
        method: 'PUT',
        body: JSON.stringify({ template: payload.template, visibility: payload.visibility }),
      });
      setSettings((prev) => ({ ...prev, ...updated }));
      toast.success('CV settings updated');
    } catch (error: any) {
      setSettings(previous);
      toast.error(error.message || 'Failed to update CV settings');
    } finally {
      setSaving(false);
    }
  }

  async function syncFromProfile() {
    setSaving(true);
    try {
      const { settings: updated } = await apiCall('/cv/settings/sync', { method: 'POST' });
      setSettings((prev) => ({ ...prev, ...updated }));
      toast.success('CV synced from profile');
    } catch (error: any) {
      toast.error(error.message || 'Failed to sync CV');
    } finally {
      setSaving(false);
    }
  }

  function downloadCV() {
    const title = `${profile?.name || 'CV'} - RecruitFriend`;
    document.title = title;
    window.print();
    toast.success('Print dialog opened. Save as PDF to download.');
  }

  const triggerFilePicker = () => {
    fileInputRef.current?.click();
  };

  async function createFile(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file) return;

    const allowed = ['application/pdf', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'];
    if (!allowed.includes(file.type)) {
      toast.error('Please upload a PDF or DOCX file.');
      return;
    }

    const maxBytes = 5 * 1024 * 1024;
    if (file.size > maxBytes) {
      toast.error('File is too large. Max size is 5MB.');
      return;
    }

    try {
      const { file: createdFile } = await apiCall('/cv/files', {
        method: 'POST',
        body: JSON.stringify({ fileName: file.name, size: file.size }),
      });
      setFiles((prev) => [createdFile, ...prev]);
      toast.success('CV file uploaded');
    } catch (error: any) {
      toast.error(error.message || 'Failed to add CV file');
    }
  }

  function openEditFile(file: CVFile) {
    setEditingFile(file);
    setEditFileName(file.file_name);
    setEditFileSize(String(file.file_size));
  }

  async function saveEditedFile() {
    if (!editingFile) return;
    const normalizedName = editFileName.trim();
    if (!normalizedName) {
      toast.error('File name is required');
      return;
    }

    try {
      const { file: updated } = await apiCall(`/cv/files/${editingFile.id}`, {
        method: 'PUT',
        body: JSON.stringify({ fileName: normalizedName, size: Number(editFileSize) || 0 }),
      });
      setFiles((prev) => prev.map((f) => (f.id === editingFile.id ? updated : f)));
      toast.success('CV file updated');
      setEditingFile(null);
    } catch (error: any) {
      toast.error(error.message || 'Failed to update CV file');
    }
  }

  async function deleteFile(fileId: string) {
    try {
      await apiCall(`/cv/files/${fileId}`, { method: 'DELETE' });
      setFiles((prev) => prev.filter((f) => f.id !== fileId));
      toast.success('CV file deleted');
    } catch (error: any) {
      toast.error(error.message || 'Failed to delete CV file');
    }
  }

  const currentFile = useMemo(() => files[0], [files]);

  return (
    <div className="flex flex-col gap-4 lg:h-[calc(100vh-theme(spacing.16))] lg:flex-row lg:gap-6">
      {/* Left Panel: CV Preview */}
      <div className={`w-full bg-white rounded-[var(--rf-radius-lg)] shadow-[var(--rf-card-shadow)] p-4 sm:p-6 lg:w-3/5 lg:p-8 lg:overflow-y-auto relative transition-all ${templateClasses.wrapper}`}>
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none opacity-[0.03]">
          <span className="text-6xl sm:text-8xl lg:text-9xl font-bold -rotate-45 text-black">RecruitFriend</span>
        </div>
        
        {/* CV Header */}
        <div className="border-b-2 border-[var(--rf-navy)] pb-4 sm:pb-6 mb-6 sm:mb-8">
          <h1 className={`text-2xl sm:text-3xl lg:text-4xl font-bold text-[var(--rf-navy)] mb-2 ${templateClasses.name}`}>{profile?.name || 'Your Name'}</h1>
          <div className="text-[var(--rf-muted)] flex flex-wrap items-center gap-2 sm:gap-4 text-xs sm:text-sm">
            <span>{profile?.email || 'email@example.com'}</span>
            <span className="hidden sm:inline">•</span>
            <span>{profile?.phone || '+27 00 000 0000'}</span>
            <span className="hidden sm:inline">•</span>
            <span>{profile?.location || 'Location'}</span>
          </div>
          <p className="mt-3 text-xs text-gray-400">Template: {settings.template.charAt(0).toUpperCase() + settings.template.slice(1)}</p>
        </div>

        {/* CV Content Sections */}
        <div className="space-y-8">
          <section>
            <h3 className={`text-lg font-bold uppercase tracking-wider pb-2 mb-4 ${templateClasses.sectionHeading}`}>Professional Summary</h3>
            <p className="text-[var(--rf-text)] leading-relaxed">
              {profile?.summary || 'No summary added yet. Update your profile to see your summary here.'}
            </p>
          </section>

          <section>
            <h3 className={`text-lg font-bold uppercase tracking-wider pb-2 mb-4 ${templateClasses.sectionHeading}`}>Experience</h3>
            <div className="space-y-6">
              {experienceHistory.length > 0 ? (
                experienceHistory.map((exp, index) => (
                  <div key={exp.id || `${exp.company}-${exp.title}-${index}`}>
                    <p className="font-semibold text-[var(--rf-navy)]">{exp.title || 'Role'}</p>
                    <p className="text-sm text-gray-600">{exp.company || 'Company'}</p>
                    <p className="text-xs text-gray-500 mt-1">
                      {exp.startDate || 'Start date not set'} {exp.endDate ? `→ ${exp.endDate}` : '→ Present'}
                    </p>
                    {exp.description ? <p className="text-sm text-gray-600 mt-2">{exp.description}</p> : null}
                  </div>
                ))
              ) : (
                <p className="text-gray-400 italic">No experience added.</p>
              )}
            </div>
          </section>

          <section>
            <h3 className={`text-lg font-bold uppercase tracking-wider pb-2 mb-4 ${templateClasses.sectionHeading}`}>Education</h3>
            <div>
              {educationHistory.length > 0 ? (
                <div className="space-y-4">
                  {educationHistory.map((edu, index) => (
                    <div key={edu.id || `${edu.institution}-${edu.degree}-${index}`}>
                      <p className="font-semibold text-[var(--rf-navy)]">{edu.degree || 'Qualification'}</p>
                      <p className="text-sm text-gray-600">{edu.institution || 'Institution'}</p>
                      <p className="text-xs text-gray-500 mt-1">
                        {edu.startDate || 'Start date not set'} {edu.endDate ? `→ ${edu.endDate}` : ''}
                      </p>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-gray-400 italic">No education added.</p>
              )}
            </div>
          </section>

          <section>
            <h3 className={`text-lg font-bold uppercase tracking-wider pb-2 mb-4 ${templateClasses.sectionHeading}`}>Skills</h3>
            <div className="flex flex-wrap gap-2">
              {profileSkills.length > 0 ? (
                profileSkills.map((skill) => (
                  <span key={skill} className={`px-2.5 py-1 rounded-full text-xs ${templateClasses.skillChip}`}>
                    {skill}
                  </span>
                ))
              ) : (
                <p className="text-gray-400 italic">No skills added.</p>
              )}
            </div>
          </section>
        </div>
      </div>

      {/* Right Panel: Actions */}
      <div className="w-full space-y-4 sm:space-y-6 lg:w-2/5">
        <div className="bg-white rounded-[var(--rf-radius-lg)] shadow-[var(--rf-card-shadow)] p-6">
          <h3 className="font-bold text-[var(--rf-navy)] mb-4 flex items-center">
            <Download className="w-5 h-5 mr-2 text-[var(--rf-green)]" />
            Download Options
          </h3>
          <button onClick={downloadCV} className="w-full py-3 bg-[var(--rf-green)] text-white rounded-[var(--rf-radius-md)] hover:bg-[#00B548] transition-colors font-semibold shadow-sm mb-4">
            Download PDF
          </button>
          
          <h4 className="text-sm font-semibold text-[var(--rf-navy)] mb-3">Choose Template</h4>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
            <button onClick={() => saveSettings({ template: 'classic' })} className={`border-2 rounded p-2 text-center cursor-pointer ${settings.template === 'classic' ? 'border-[var(--rf-green)] bg-green-50' : 'border-gray-200 hover:border-[var(--rf-green)]'}`}>
              <div className="h-12 bg-gray-200 mb-2 rounded"></div>
              <span className="text-xs font-medium">Classic</span>
            </button>
            <button onClick={() => saveSettings({ template: 'modern' })} className={`border rounded p-2 text-center cursor-pointer ${settings.template === 'modern' ? 'border-[var(--rf-green)] bg-green-50' : 'border-gray-200 hover:border-[var(--rf-green)]'}`}>
              <div className="h-12 bg-gray-200 mb-2 rounded"></div>
              <span className="text-xs font-medium text-gray-500">Modern</span>
            </button>
            <button onClick={() => saveSettings({ template: 'bold' })} className={`border rounded p-2 text-center cursor-pointer ${settings.template === 'bold' ? 'border-[var(--rf-green)] bg-green-50' : 'border-gray-200 hover:border-[var(--rf-green)]'}`}>
              <div className="h-12 bg-gray-200 mb-2 rounded"></div>
              <span className="text-xs font-medium text-gray-500">Bold</span>
            </button>
          </div>
        </div>

        <div className="bg-white rounded-[var(--rf-radius-lg)] shadow-[var(--rf-card-shadow)] p-6">
          <h3 className="font-bold text-[var(--rf-navy)] mb-4 flex items-center">
            <Upload className="w-5 h-5 mr-2 text-[var(--rf-green)]" />
            Upload Your Own CV
          </h3>
          <button onClick={triggerFilePicker} className="w-full border-2 border-dashed border-gray-300 rounded-[var(--rf-radius-md)] p-6 text-center hover:border-[var(--rf-green)] transition-colors cursor-pointer bg-gray-50">
            <Upload className="w-8 h-8 text-gray-400 mx-auto mb-2" />
            <p className="text-sm text-[var(--rf-muted)]">
              Drag & drop or <span className="text-[var(--rf-green)] font-semibold">browse</span>
            </p>
            <p className="text-xs text-gray-400 mt-1">PDF or DOCX up to 5MB</p>
          </button>
          <input ref={fileInputRef} type="file" accept=".pdf,.docx,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document" className="hidden" onChange={createFile} />
          
          {/* Example Uploaded File */}
          <div className="mt-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between p-3 bg-gray-50 rounded border border-gray-100">
            <div className="flex items-center overflow-hidden min-w-0">
              <FileText className="w-8 h-8 text-red-500 mr-3 flex-shrink-0" />
              <div className="min-w-0">
                <p className="text-sm font-semibold text-[var(--rf-navy)] truncate">{currentFile?.file_name || 'No CV uploaded yet'}</p>
                <p className="text-xs text-[var(--rf-muted)]">
                  {currentFile ? `${(currentFile.file_size / (1024 * 1024)).toFixed(1)} MB • Updated ${new Date(currentFile.updated_at).toLocaleDateString()}` : 'Add a CV file to enable edit/delete'}
                </p>
              </div>
            </div>
            <div className="flex space-x-2 sm:ml-2 self-end sm:self-auto">
              <button disabled={!currentFile} onClick={() => currentFile && openEditFile(currentFile)} className="p-1 hover:bg-gray-200 rounded text-gray-500 disabled:opacity-50"><Edit2 className="w-4 h-4" /></button>
              <button disabled={!currentFile} onClick={() => currentFile && setDeleteFileId(currentFile.id)} className="p-1 hover:bg-red-100 rounded text-red-500 disabled:opacity-50"><Trash2 className="w-4 h-4" /></button>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-[var(--rf-radius-lg)] shadow-[var(--rf-card-shadow)] p-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-bold text-[var(--rf-navy)] flex items-center">
              <Eye className="w-5 h-5 mr-2 text-[var(--rf-green)]" />
              CV Visibility
            </h3>
            <div className="relative inline-block w-10 mr-2 align-middle select-none transition duration-200 ease-in">
                <input type="checkbox" name="toggle" id="toggle" checked={settings.visibility} onChange={(e) => saveSettings({ visibility: e.target.checked })} className="toggle-checkbox absolute block w-5 h-5 rounded-full bg-white border-4 appearance-none cursor-pointer checked:right-0 checked:border-[var(--rf-green)]" />
                <label htmlFor="toggle" className="toggle-label block overflow-hidden h-5 rounded-full bg-gray-300 cursor-pointer checked:bg-[var(--rf-green)]"></label>
            </div>
          </div>
          <p className="text-sm text-[var(--rf-muted)] mb-4">
            Allow employers to find your profile in Talent Search.
          </p>
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between text-xs text-[var(--rf-muted)] pt-4 border-t border-gray-100">
            <span>Last updated: {settings.last_synced_at ? new Date(settings.last_synced_at).toLocaleString() : 'Not synced yet'}</span>
            <button disabled={saving} onClick={syncFromProfile} className="flex items-center text-[var(--rf-green)] hover:underline font-semibold disabled:opacity-60 self-start sm:self-auto">
              <RefreshCcw className="w-3 h-3 mr-1" />
              Update from Profile
            </button>
          </div>
        </div>

        {loading && (
          <div className="bg-white rounded-[var(--rf-radius-lg)] shadow-[var(--rf-card-shadow)] p-6 text-center text-[var(--rf-muted)]">
            <Loader2 className="w-5 h-5 animate-spin inline mr-2" /> Loading CV settings...
          </div>
        )}

        <Dialog open={Boolean(editingFile)} onOpenChange={(open) => !open && setEditingFile(null)}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Edit CV File</DialogTitle>
              <DialogDescription>Update metadata for this file.</DialogDescription>
            </DialogHeader>
            <div className="space-y-3">
              <input value={editFileName} onChange={(e) => setEditFileName(e.target.value)} className="w-full border rounded px-3 py-2" placeholder="File name" />
              <input value={editFileSize} onChange={(e) => setEditFileSize(e.target.value)} className="w-full border rounded px-3 py-2" type="number" min={0} placeholder="File size in bytes" />
            </div>
            <DialogFooter>
              <button onClick={() => setEditingFile(null)} className="px-4 py-2 border rounded-md">Cancel</button>
              <button onClick={saveEditedFile} className="px-4 py-2 bg-[var(--rf-green)] text-white rounded-md">Save</button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        <AlertDialog open={Boolean(deleteFileId)} onOpenChange={(open) => !open && setDeleteFileId(null)}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Delete this CV file?</AlertDialogTitle>
              <AlertDialogDescription>This action cannot be undone.</AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancel</AlertDialogCancel>
              <AlertDialogAction
                className="bg-red-600 hover:bg-red-700"
                onClick={() => {
                  if (!deleteFileId) return;
                  void deleteFile(deleteFileId);
                  setDeleteFileId(null);
                }}
              >
                Delete
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </div>
    </div>
  );
}
