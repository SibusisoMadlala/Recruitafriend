import { useEffect, useRef, useState, type ChangeEvent } from 'react';
import { useAuth } from '../context/useAuth';
import { FileText, Upload, Eye, Edit2, Trash2, Loader2, CheckCircle2 } from 'lucide-react';
import { apiCall, supabase } from '../lib/supabase';
import { toast } from 'sonner';
import type { CVFile, CVSettings } from '../types';
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
  const [dragging, setDragging] = useState(false);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const [editingFile, setEditingFile] = useState<CVFile | null>(null);
  const [editFileName, setEditFileName] = useState('');
  const [deleteFileId, setDeleteFileId] = useState<string | null>(null);

  useEffect(() => {
    loadCVData();
  }, []);

  async function loadCVData() {
    setLoading(true);
    try {
      const [{ settings: settingsData }, { files: fileRows }] = await Promise.all([
        apiCall('/cv/settings', { requireAuth: true }),
        apiCall('/cv/files', { requireAuth: true }),
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
      toast.error(error.message || 'Failed to load CV data');
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
        requireAuth: true,
        method: 'PUT',
        body: JSON.stringify({ template: payload.template, visibility: payload.visibility }),
      });
      setSettings((prev) => ({ ...prev, ...updated }));
    } catch (error: any) {
      setSettings(previous);
      toast.error(error.message || 'Failed to update CV settings');
    } finally {
      setSaving(false);
    }
  }

  const triggerFilePicker = () => fileInputRef.current?.click();

  async function handleFileUpload(file: File) {
    const allowed = ['application/pdf', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'];
    if (!allowed.includes(file.type)) {
      toast.error('Please upload a PDF or DOCX file.');
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      toast.error('File is too large. Max size is 5 MB.');
      return;
    }

    if (!profile?.id) {
      toast.error('Unable to upload CV before profile is ready. Please refresh and try again.');
      return;
    }

    try {
      const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, '_');
      const storageBucket = 'seeker-cvs';
      const storagePath = `${profile.id}/${Date.now()}-${safeName}`;

      const { error: uploadError } = await supabase.storage
        .from(storageBucket)
        .upload(storagePath, file, {
          cacheControl: '3600',
          upsert: false,
          contentType: file.type || undefined,
        });

      if (uploadError) {
        throw uploadError;
      }

      const { file: createdFile } = await apiCall('/cv/files', {
        requireAuth: true,
        method: 'POST',
        body: JSON.stringify({
          fileName: file.name,
          size: file.size,
          storageBucket,
          storagePath,
          mimeType: file.type || null,
        }),
      });
      setFiles((prev) => [createdFile, ...prev]);
      toast.success('CV uploaded successfully');
    } catch (error: any) {
      const errorMessage = error?.message || 'Failed to upload CV';
      toast.error(errorMessage);
      return;
    }
  }

  async function createFile(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (file) await handleFileUpload(file);
  }

  function openEditFile(file: CVFile) {
    setEditingFile(file);
    setEditFileName(file.file_name);
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
        requireAuth: true,
        method: 'PUT',
        body: JSON.stringify({ fileName: normalizedName, size: editingFile.file_size }),
      });
      setFiles((prev) => prev.map((f) => (f.id === editingFile.id ? updated : f)));
      toast.success('CV renamed');
      setEditingFile(null);
    } catch (error: any) {
      toast.error(error.message || 'Failed to rename CV');
    }
  }

  async function deleteFile(fileId: string) {
    try {
      await apiCall(`/cv/files/${fileId}`, { method: 'DELETE', requireAuth: true });
      setFiles((prev) => prev.filter((f) => f.id !== fileId));
      toast.success('CV deleted');
    } catch (error: any) {
      toast.error(error.message || 'Failed to delete CV');
    }
  }

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      {/* Page header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-[var(--rf-navy)]">My CV</h1>
          <p className="text-sm text-[var(--rf-muted)] mt-0.5">Upload and manage your CVs. Employers see your most recent upload.</p>
        </div>
        <button
          onClick={triggerFilePicker}
          className="flex items-center gap-2 px-4 py-2 bg-[var(--rf-green)] text-white text-sm font-semibold rounded-[var(--rf-radius-md)] hover:bg-[#00B548] transition-colors shadow-sm"
        >
          <Upload className="w-4 h-4" />
          Upload CV
        </button>
      </div>

      {/* Drop zone */}
      <div
        className={`bg-white rounded-[var(--rf-radius-lg)] shadow-[var(--rf-card-shadow)] p-8 border-2 border-dashed transition-colors ${dragging ? 'border-[var(--rf-green)] bg-green-50' : 'border-gray-200'}`}
        onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
        onDragLeave={() => setDragging(false)}
        onDrop={(e) => {
          e.preventDefault();
          setDragging(false);
          const file = e.dataTransfer.files?.[0];
          if (file) void handleFileUpload(file);
        }}
      >
        <div className="flex flex-col items-center text-center">
          <div className="w-14 h-14 rounded-full bg-green-50 flex items-center justify-center mb-4">
            <Upload className="w-7 h-7 text-[var(--rf-green)]" />
          </div>
          <p className="text-[var(--rf-navy)] font-semibold mb-1">Drag & drop your CV here</p>
          <p className="text-sm text-[var(--rf-muted)] mb-4">PDF or DOCX, up to 5 MB</p>
          <button
            onClick={triggerFilePicker}
            className="px-5 py-2 bg-[var(--rf-navy)] text-white text-sm font-semibold rounded-[var(--rf-radius-md)] hover:bg-[#0d2f50] transition-colors"
          >
            Browse Files
          </button>
        </div>
        <input
          ref={fileInputRef}
          type="file"
          accept=".pdf,.docx,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
          className="hidden"
          onChange={createFile}
        />
      </div>

      {/* Uploaded files list */}
      <div className="bg-white rounded-[var(--rf-radius-lg)] shadow-[var(--rf-card-shadow)] p-6">
        <h2 className="font-bold text-[var(--rf-navy)] mb-4">Uploaded CVs</h2>
        {loading ? (
          <div className="flex items-center justify-center py-8 text-[var(--rf-muted)]">
            <Loader2 className="w-5 h-5 animate-spin mr-2" />
            Loading your CVs…
          </div>
        ) : files.length === 0 ? (
          <div className="text-center py-10">
            <FileText className="w-10 h-10 text-gray-300 mx-auto mb-3" />
            <p className="text-sm text-[var(--rf-muted)]">No CVs uploaded yet.</p>
            <p className="text-xs text-gray-400 mt-1">Upload one above to get started.</p>
          </div>
        ) : (
          <ul className="divide-y divide-gray-100">
            {files.map((file, index) => (
              <li key={file.id} className="flex items-center gap-4 py-3 first:pt-0 last:pb-0">
                <FileText className="w-8 h-8 text-red-500 flex-shrink-0" />
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 min-w-0">
                    <p className="text-sm font-semibold text-[var(--rf-navy)] truncate">{file.file_name}</p>
                    {index === 0 && (
                      <span className="flex-shrink-0 inline-flex items-center gap-1 text-[10px] font-bold text-[var(--rf-green)] bg-green-50 border border-green-200 px-1.5 py-0.5 rounded-full">
                        <CheckCircle2 className="w-3 h-3" /> Active
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-[var(--rf-muted)] mt-0.5">
                    {(file.file_size / (1024 * 1024)).toFixed(1)} MB • Updated {new Date(file.updated_at).toLocaleDateString()}
                  </p>
                </div>
                <div className="flex items-center gap-1 flex-shrink-0">
                  <button onClick={() => openEditFile(file)} className="p-1.5 hover:bg-gray-100 rounded text-gray-500 transition-colors" title="Rename">
                    <Edit2 className="w-4 h-4" />
                  </button>
                  <button onClick={() => setDeleteFileId(file.id)} className="p-1.5 hover:bg-red-50 rounded text-red-400 transition-colors" title="Delete">
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>

      {/* CV Visibility */}
      <div className="bg-white rounded-[var(--rf-radius-lg)] shadow-[var(--rf-card-shadow)] p-6">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Eye className="w-5 h-5 text-[var(--rf-green)]" />
            <h2 className="font-bold text-[var(--rf-navy)]">CV Visibility</h2>
          </div>
          <div className="relative inline-block w-10 align-middle select-none">
            <input
              type="checkbox"
              name="cv-visibility"
              id="cv-visibility-toggle"
              checked={settings.visibility}
              onChange={(e) => saveSettings({ visibility: e.target.checked })}
              disabled={saving}
              className="toggle-checkbox absolute block w-5 h-5 rounded-full bg-white border-4 appearance-none cursor-pointer checked:right-0 checked:border-[var(--rf-green)]"
            />
            <label htmlFor="cv-visibility-toggle" className="toggle-label block overflow-hidden h-5 rounded-full bg-gray-300 cursor-pointer" />
          </div>
        </div>
        <p className="text-sm text-[var(--rf-muted)] mt-2">
          Allow employers to discover your profile and CV in Talent Search.
        </p>
      </div>

      {/* Rename dialog */}
      <Dialog open={Boolean(editingFile)} onOpenChange={(open) => !open && setEditingFile(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Rename CV</DialogTitle>
            <DialogDescription>Update the display name for this file.</DialogDescription>
          </DialogHeader>
          <input
            value={editFileName}
            onChange={(e) => setEditFileName(e.target.value)}
            className="w-full border rounded px-3 py-2"
            placeholder="File name"
          />
          <DialogFooter>
            <button onClick={() => setEditingFile(null)} className="px-4 py-2 border rounded-md">Cancel</button>
            <button onClick={saveEditedFile} className="px-4 py-2 bg-[var(--rf-green)] text-white rounded-md">Save</button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete confirm dialog */}
      <AlertDialog open={Boolean(deleteFileId)} onOpenChange={(open) => !open && setDeleteFileId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete this CV?</AlertDialogTitle>
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
  );
}

