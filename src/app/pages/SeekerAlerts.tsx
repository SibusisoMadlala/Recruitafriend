import { useEffect, useState } from 'react';
import { Bell, MapPin, Clock, Trash2, Edit2, Plus, Loader2 } from 'lucide-react';
import { Link } from 'react-router';
import { toast } from 'sonner';
import { apiCall } from '../lib/supabase';
import type { JobAlert } from '../types';
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

export default function SeekerAlerts() {
  const [alerts, setAlerts] = useState<JobAlert[]>([]);
  const [loading, setLoading] = useState(true);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [workingId, setWorkingId] = useState<string | null>(null);
  const [deleteAlertId, setDeleteAlertId] = useState<string | null>(null);
  const [form, setForm] = useState({
    keywords: '',
    location: 'All of South Africa',
    minSalary: '',
    frequency: 'daily',
  });

  useEffect(() => {
    loadAlerts();
  }, []);

  async function loadAlerts() {
    setLoading(true);
    try {
      const { alerts: rows } = await apiCall('/alerts');
      setAlerts(rows || []);
    } catch (error: any) {
      toast.error(error.message || 'Failed to load alerts');
    } finally {
      setLoading(false);
    }
  }

  async function createAlert() {
    if (!form.keywords.trim()) {
      toast.error('Keywords are required');
      return;
    }
    try {
      const { alert } = await apiCall('/alerts', {
        method: 'POST',
        body: JSON.stringify({
          keywords: form.keywords,
          location: form.location,
          minSalary: form.minSalary ? Number(form.minSalary) : null,
          frequency: form.frequency,
          types: [],
          active: true,
        }),
      });
      setAlerts((prev) => [alert, ...prev]);
      setForm({ keywords: '', location: 'All of South Africa', minSalary: '', frequency: 'daily' });
      toast.success('Alert created');
    } catch (error: any) {
      toast.error(error.message || 'Failed to create alert');
    }
  }

  async function updateAlert(id: string, patch: Partial<JobAlert>) {
    setWorkingId(id);
    try {
      const payload: any = {};
      if (patch.keywords !== undefined) payload.keywords = patch.keywords;
      if (patch.location !== undefined) payload.location = patch.location;
      if (patch.min_salary !== undefined) payload.minSalary = patch.min_salary;
      if (patch.frequency !== undefined) payload.frequency = patch.frequency;
      if (patch.active !== undefined) payload.active = patch.active;
      if (patch.types !== undefined) payload.types = patch.types;

      const { alert } = await apiCall(`/alerts/${id}`, {
        method: 'PUT',
        body: JSON.stringify(payload),
      });

      setAlerts((prev) => prev.map((a) => (a.id === id ? alert : a)));
      setEditingId(null);
      toast.success('Alert updated');
    } catch (error: any) {
      toast.error(error.message || 'Failed to update alert');
    } finally {
      setWorkingId(null);
    }
  }

  async function deleteAlert(id: string) {
    setWorkingId(id);
    try {
      await apiCall(`/alerts/${id}`, { method: 'DELETE' });
      setAlerts((prev) => prev.filter((a) => a.id !== id));
      toast.success('Alert deleted');
    } catch (error: any) {
      toast.error(error.message || 'Failed to delete alert');
    } finally {
      setWorkingId(null);
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between mb-2">
        <h1 className="text-3xl font-bold text-[var(--rf-navy)]">Job Alerts</h1>
      </div>

      {/* Create New Alert */}
      <div className="bg-white rounded-[var(--rf-radius-lg)] shadow-[var(--rf-card-shadow)] border-l-4 border-[var(--rf-green)] p-6">
         <h3 className="text-lg font-bold text-[var(--rf-navy)] mb-4 flex items-center">
           <Plus className="w-5 h-5 mr-2 bg-[var(--rf-green)] text-white rounded-full p-0.5" />
           Create New Alert
         </h3>
         <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4 items-end">
           <div className="lg:col-span-1">
             <label className="block text-xs font-semibold text-[var(--rf-muted)] mb-1">Keywords</label>
             <input value={form.keywords} onChange={(e) => setForm((prev) => ({ ...prev, keywords: e.target.value }))} type="text" placeholder="e.g. React Developer" className="w-full border border-[var(--rf-border)] rounded-[var(--rf-radius-md)] px-3 py-2 text-sm focus:outline-none focus:border-[var(--rf-green)]" />
           </div>
           <div className="lg:col-span-1">
             <label className="block text-xs font-semibold text-[var(--rf-muted)] mb-1">Location</label>
             <select value={form.location} onChange={(e) => setForm((prev) => ({ ...prev, location: e.target.value }))} className="w-full border border-[var(--rf-border)] rounded-[var(--rf-radius-md)] px-3 py-2 text-sm focus:outline-none focus:border-[var(--rf-green)]">
               <option>All of South Africa</option>
               <option>Gauteng</option>
               <option>Western Cape</option>
               <option>Remote</option>
             </select>
           </div>
           <div className="lg:col-span-1">
             <label className="block text-xs font-semibold text-[var(--rf-muted)] mb-1">Min Salary</label>
             <div className="relative">
               <span className="absolute left-3 top-2 text-gray-400 text-sm">R</span>
               <input value={form.minSalary} onChange={(e) => setForm((prev) => ({ ...prev, minSalary: e.target.value }))} type="number" placeholder="25000" className="w-full border border-[var(--rf-border)] rounded-[var(--rf-radius-md)] pl-6 pr-3 py-2 text-sm focus:outline-none focus:border-[var(--rf-green)]" />
             </div>
           </div>
           <div className="lg:col-span-1">
             <label className="block text-xs font-semibold text-[var(--rf-muted)] mb-1">Frequency</label>
             <select value={form.frequency} onChange={(e) => setForm((prev) => ({ ...prev, frequency: e.target.value }))} className="w-full border border-[var(--rf-border)] rounded-[var(--rf-radius-md)] px-3 py-2 text-sm focus:outline-none focus:border-[var(--rf-green)]">
               <option value="daily">Daily</option>
               <option value="weekly">Weekly</option>
               <option value="immediately">Immediately</option>
             </select>
           </div>
           <div>
             <button onClick={createAlert} className="w-full bg-[var(--rf-green)] text-white font-semibold py-2 px-4 rounded-[var(--rf-radius-md)] hover:bg-[#00B548] transition-colors text-sm">
               Create Alert
             </button>
           </div>
         </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Active Alerts List */}
        <div className="lg:col-span-2 space-y-4">
           <h3 className="font-bold text-[var(--rf-navy)] text-lg">My Active Alerts</h3>
           {loading ? (
             <div className="text-center py-12 bg-white rounded-[var(--rf-radius-lg)]">
               <Loader2 className="w-6 h-6 text-[var(--rf-green)] animate-spin mx-auto mb-3" />
               <p className="text-gray-500">Loading alerts...</p>
             </div>
           ) : alerts.length === 0 ? (
             <div className="text-center py-12 bg-white rounded-[var(--rf-radius-lg)]">
               <Bell className="w-12 h-12 text-gray-300 mx-auto mb-3" />
               <p className="text-gray-500">No alerts yet — create one above!</p>
             </div>
           ) : (
             alerts.map(alert => (
               <div key={alert.id} className={`bg-white rounded-[var(--rf-radius-lg)] shadow-[var(--rf-card-shadow)] p-5 flex items-center justify-between border-l-4 ${alert.active ? 'border-[var(--rf-green)]' : 'border-gray-300'}`}>
                 <div>
                   <div className="flex items-center mb-1">
                     {editingId === alert.id ? (
                       <input className="border rounded px-2 py-1 text-sm" value={alert.keywords} onChange={(e) => setAlerts((prev) => prev.map((a) => a.id === alert.id ? { ...a, keywords: e.target.value } : a))} />
                     ) : (
                       <h4 className={`font-bold text-lg ${alert.active ? 'text-[var(--rf-navy)]' : 'text-gray-400'}`}>{alert.keywords}</h4>
                     )}
                     {!alert.active && <span className="ml-2 px-2 py-0.5 bg-gray-100 text-gray-500 text-xs rounded-full">Paused</span>}
                   </div>
                   <div className="flex items-center text-sm text-[var(--rf-muted)] space-x-3 mb-3">
                     <span className="flex items-center"><MapPin className="w-3 h-3 mr-1" /> {alert.location || 'All locations'}</span>
                     <span className="flex items-center"><Clock className="w-3 h-3 mr-1" /> {alert.frequency}</span>
                   </div>
                   <div className="flex gap-2">
                     {(alert.types || []).map((t) => (
                       <span key={t} className="px-2 py-1 bg-blue-50 text-blue-700 text-xs rounded-md font-medium">{t}</span>
                     ))}
                   </div>
                 </div>
                 
                 <div className="flex flex-col items-end gap-3">
                    <div className="flex items-center space-x-2">
                      <button onClick={() => editingId === alert.id ? updateAlert(alert.id, { keywords: alert.keywords }) : setEditingId(alert.id)} className="p-2 text-gray-400 hover:text-[var(--rf-navy)] hover:bg-gray-100 rounded-full transition-colors">
                        <Edit2 className="w-4 h-4" />
                      </button>
                      <button disabled={workingId === alert.id} onClick={() => setDeleteAlertId(alert.id)} className="p-2 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded-full transition-colors disabled:opacity-60"><Trash2 className="w-4 h-4" /></button>
                      
                      <div className="ml-2 relative inline-block w-10 align-middle select-none transition duration-200 ease-in">
                          <input type="checkbox" checked={alert.active} onChange={(e) => updateAlert(alert.id, { active: e.target.checked })} className="toggle-checkbox absolute block w-5 h-5 rounded-full bg-white border-4 appearance-none cursor-pointer checked:right-0 checked:border-[var(--rf-green)]" />
                          <label className={`toggle-label block overflow-hidden h-5 rounded-full cursor-pointer ${alert.active ? 'bg-[var(--rf-green)]' : 'bg-gray-300'}`}></label>
                      </div>
                    </div>
                    
                    {alert.active && (
                       <span className="text-xs font-semibold text-[var(--rf-green)] bg-green-50 px-2 py-1 rounded-full">
                         Active
                       </span>
                    )}
                 </div>
               </div>
             ))
           )}
        </div>

        {/* Recent Emails */}
        <div className="lg:col-span-1">
          <div className="bg-white rounded-[var(--rf-radius-lg)] shadow-[var(--rf-card-shadow)] p-6 sticky top-6">
            <h3 className="font-bold text-[var(--rf-navy)] mb-4">Recent Alert Emails</h3>
            <div className="space-y-4">
              {[1, 2, 3, 4, 5].map((i) => (
                <div key={i} className="flex items-start pb-3 border-b border-gray-100 last:border-0 last:pb-0">
                  <div className="bg-blue-100 p-2 rounded-full mr-3 text-blue-600">
                    <Bell className="w-4 h-4" />
                  </div>
                  <div>
                    <h5 className="text-sm font-semibold text-[var(--rf-navy)]">React Developer Alert</h5>
                    <p className="text-xs text-[var(--rf-muted)] mb-1">Sent: Mar {10-i}, 2026</p>
                    <Link to="/jobs?search=react" className="text-xs text-[var(--rf-green)] font-semibold hover:underline">
                      View 5 new jobs →
                    </Link>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      <AlertDialog open={Boolean(deleteAlertId)} onOpenChange={(open) => !open && setDeleteAlertId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete this alert?</AlertDialogTitle>
            <AlertDialogDescription>This action cannot be undone.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="bg-red-600 hover:bg-red-700"
              onClick={() => {
                if (!deleteAlertId) return;
                void deleteAlert(deleteAlertId);
                setDeleteAlertId(null);
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
