import { useEffect, useState } from 'react';
import { Link } from 'react-router';
import { Bell, Shield, Wallet, Users, Layout, Mail, Link as LinkIcon, Loader2, Trash2 } from 'lucide-react';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Switch } from '../components/ui/switch';
import { Separator } from '../components/ui/separator';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '../components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../components/ui/select';
import { Textarea } from '../components/ui/textarea';
import { Badge } from '../components/ui/badge';
import { useAuth } from '../context/useAuth';
import { apiCall, supabase } from '../lib/supabase';
import { toast } from 'sonner';

type EmployerSettingsState = {
   security: {
      twoFactorEnabled: boolean;
   };
   jobDefaults: {
      defaultJobType: string;
      autoCloseDays: number;
      includeVideoAssessment: boolean;
   };
   team: {
      invites: string[];
   };
   notifications: {
      newApplicantEmail: boolean;
      interviewReminders: boolean;
      weeklyDigest: boolean;
      productUpdates: boolean;
   };
   templates: {
      applicationReceived: string;
      interviewInvite: string;
      rejectionNote: string;
   };
   integrations: {
      googleCalendar: boolean;
      zoom: boolean;
      msTeams: boolean;
      webhookUrl: string;
   };
};

const defaultSettings: EmployerSettingsState = {
   security: {
      twoFactorEnabled: false,
   },
   jobDefaults: {
      defaultJobType: 'full-time',
      autoCloseDays: 30,
      includeVideoAssessment: false,
   },
   team: {
      invites: [],
   },
   notifications: {
      newApplicantEmail: true,
      interviewReminders: true,
      weeklyDigest: true,
      productUpdates: false,
   },
   templates: {
      applicationReceived: 'Hi {{candidate_name}}, thank you for applying to {{job_title}} at {{company_name}}.',
      interviewInvite: 'Hi {{candidate_name}}, we would like to invite you to interview for {{job_title}}.',
      rejectionNote: 'Hi {{candidate_name}}, thank you for your interest. We are moving forward with other applicants at this stage.',
   },
   integrations: {
      googleCalendar: false,
      zoom: false,
      msTeams: false,
      webhookUrl: '',
   },
};

export default function EmployerSettings() {
   const { user, profile, refreshProfile } = useAuth();
  const [activeTab, setActiveTab] = useState('account');
   const [savingTab, setSavingTab] = useState<string | null>(null);
   const [teamInviteEmail, setTeamInviteEmail] = useState('');
   const [settings, setSettings] = useState<EmployerSettingsState>(defaultSettings);
   const [passwords, setPasswords] = useState({
      currentPassword: '',
      newPassword: '',
      confirmPassword: '',
   });

   useEffect(() => {
      const social = ((profile?.social_links as Record<string, any> | undefined) || {}) as Record<string, any>;
      const stored = (social.employerSettings || {}) as Partial<EmployerSettingsState>;

      setSettings({
         security: {
            ...defaultSettings.security,
            ...(stored.security || {}),
         },
         jobDefaults: {
            ...defaultSettings.jobDefaults,
            ...(stored.jobDefaults || {}),
         },
         team: {
            ...defaultSettings.team,
            ...(stored.team || {}),
            invites: Array.isArray(stored.team?.invites) ? stored.team!.invites : defaultSettings.team.invites,
         },
         notifications: {
            ...defaultSettings.notifications,
            ...(stored.notifications || {}),
         },
         templates: {
            ...defaultSettings.templates,
            ...(stored.templates || {}),
         },
         integrations: {
            ...defaultSettings.integrations,
            ...(stored.integrations || {}),
         },
      });
   }, [profile]);

   async function saveSettings(nextSettings: EmployerSettingsState, tab: string, message: string) {
      if (!profile) {
         toast.error('Profile not loaded yet. Please try again.');
         return;
      }

      setSavingTab(tab);
      try {
         const socialLinks = {
            ...(((profile.social_links as Record<string, any> | undefined) || {}) as Record<string, any>),
            employerSettings: nextSettings,
         };

         await apiCall('/auth/profile', {
            method: 'PUT',
            requireAuth: true,
            body: JSON.stringify({
               social_links: socialLinks,
            }),
         });

         setSettings(nextSettings);
         await refreshProfile?.();
         toast.success(message);
      } catch (error: any) {
         toast.error(error?.message || 'Failed to save settings');
      } finally {
         setSavingTab(null);
      }
   }

   async function handleAccountSave() {
      const changingPassword = Boolean(passwords.currentPassword || passwords.newPassword || passwords.confirmPassword);

      if (changingPassword) {
         if (!passwords.currentPassword.trim()) {
            toast.error('Current password is required to change your password');
            return;
         }
         if (passwords.newPassword.length < 8) {
            toast.error('New password must be at least 8 characters');
            return;
         }
         if (passwords.newPassword !== passwords.confirmPassword) {
            toast.error('New password and confirm password must match');
            return;
         }
      }

      setSavingTab('account');
      try {
         if (changingPassword) {
            const { error } = await supabase.auth.updateUser({ password: passwords.newPassword });
            if (error) throw error;
            setPasswords({ currentPassword: '', newPassword: '', confirmPassword: '' });
         }

         await saveSettings(settings, 'account', changingPassword ? 'Security settings and password updated' : 'Security settings updated');
      } finally {
         setSavingTab(null);
      }
   }

   async function handleDefaultsSave() {
      const autoCloseDays = Number(settings.jobDefaults.autoCloseDays);
      if (Number.isNaN(autoCloseDays) || autoCloseDays < 0) {
         toast.error('Auto-close days must be 0 or greater');
         return;
      }

      await saveSettings(
         {
            ...settings,
            jobDefaults: {
               ...settings.jobDefaults,
               autoCloseDays,
            },
         },
         'defaults',
         'Job default settings saved'
      );
   }

   async function handleNotificationsSave() {
      await saveSettings(settings, 'notifications', 'Notification preferences saved');
   }

   async function handleTemplatesSave() {
      await saveSettings(settings, 'templates', 'Email templates saved');
   }

   async function handleIntegrationsSave() {
      if (settings.integrations.webhookUrl && !/^https?:\/\//i.test(settings.integrations.webhookUrl)) {
         toast.error('Webhook URL must start with http:// or https://');
         return;
      }
      await saveSettings(settings, 'integrations', 'Integration preferences saved');
   }

   async function handleTeamSave() {
      await saveSettings(settings, 'team', 'Team invite list saved');
   }

   function addTeamInvite() {
      const email = teamInviteEmail.trim().toLowerCase();
      if (!email) return;

      if (!/^\S+@\S+\.\S+$/.test(email)) {
         toast.error('Enter a valid email address');
         return;
      }

      if (settings.team.invites.includes(email)) {
         toast.info('That email is already in the invite list');
         return;
      }

      setSettings((prev) => ({
         ...prev,
         team: {
            ...prev.team,
            invites: [...prev.team.invites, email],
         },
      }));
      setTeamInviteEmail('');
   }

   function removeTeamInvite(email: string) {
      setSettings((prev) => ({
         ...prev,
         team: {
            ...prev.team,
            invites: prev.team.invites.filter((item) => item !== email),
         },
      }));
   }
  
  return (
    <div className="max-w-5xl mx-auto space-y-8 pb-20">
      
      {/* Header */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
           <h1 className="text-3xl font-bold text-[#0A2540]">Settings</h1>
           <p className="text-gray-500">Manage your account preferences and integrations.</p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-8">
        
        {/* Navigation */}
        <div className="lg:col-span-1 space-y-2">
           {[
             { id: 'account', label: 'Account', icon: Shield },
             { id: 'team', label: 'Team', icon: Users },
             { id: 'notifications', label: 'Notifications', icon: Bell },
             { id: 'defaults', label: 'Job Defaults', icon: Layout },
             { id: 'templates', label: 'Email Templates', icon: Mail },
             { id: 'integrations', label: 'Integrations', icon: LinkIcon },
             { id: 'billing', label: 'Billing', icon: Wallet },
           ].map((tab) => (
             <button
               key={tab.id}
               onClick={() => setActiveTab(tab.id)}
               className={`w-full text-left px-4 py-3 rounded-lg font-medium transition-colors flex items-center space-x-3 ${
                 activeTab === tab.id 
                   ? 'bg-[#0A2540] text-white shadow-md' 
                   : 'text-gray-600 hover:bg-white hover:shadow-sm'
               }`}
             >
               <tab.icon className="w-5 h-5" />
               <span>{tab.label}</span>
             </button>
           ))}
        </div>

        {/* Content Area */}
        <div className="lg:col-span-3 space-y-6">
           
           {/* Section: Account */}
           {activeTab === 'account' && (
             <Card className="border-none shadow-sm">
               <CardHeader>
                 <CardTitle className="text-[#0A2540]">Account Security</CardTitle>
                 <CardDescription>Update your login credentials.</CardDescription>
               </CardHeader>
               <CardContent className="space-y-6">
                  
                  <div className="grid grid-cols-1 gap-4">
                     <div className="space-y-2">
                        <label className="text-sm font-medium text-gray-700">Email Address</label>
                        <div className="flex gap-2">
                                       <Input value={user?.email || profile?.email || ''} disabled />
                                       <Button variant="outline" onClick={() => toast.info('Email verification is managed by your auth provider.')}>Verify</Button>
                        </div>
                     </div>
                     <Separator className="my-2" />
                     <div className="space-y-2">
                        <label className="text-sm font-medium text-gray-700">Current Password</label>
                                    <Input
                                       type="password"
                                       value={passwords.currentPassword}
                                       onChange={(e) => setPasswords((prev) => ({ ...prev, currentPassword: e.target.value }))}
                                    />
                     </div>
                     <div className="space-y-2">
                        <label className="text-sm font-medium text-gray-700">New Password</label>
                                    <Input
                                       type="password"
                                       value={passwords.newPassword}
                                       onChange={(e) => setPasswords((prev) => ({ ...prev, newPassword: e.target.value }))}
                                    />
                     </div>
                     <div className="space-y-2">
                        <label className="text-sm font-medium text-gray-700">Confirm Password</label>
                                    <Input
                                       type="password"
                                       value={passwords.confirmPassword}
                                       onChange={(e) => setPasswords((prev) => ({ ...prev, confirmPassword: e.target.value }))}
                                    />
                     </div>
                  </div>

                  <div className="flex items-center justify-between py-4">
                     <div className="space-y-0.5">
                        <label className="text-base font-medium text-gray-900">Two-factor Authentication</label>
                        <p className="text-sm text-gray-500">Secure your account with 2FA.</p>
                     </div>
                               <Switch
                                  checked={settings.security.twoFactorEnabled}
                                  onCheckedChange={(v) => setSettings((prev) => ({
                                     ...prev,
                                     security: { ...prev.security, twoFactorEnabled: v },
                                  }))}
                               />
                  </div>

                  <div className="pt-6 border-t border-gray-100">
                               <Button
                                  variant="destructive"
                                  className="bg-red-50 text-red-600 hover:bg-red-100 border-none shadow-none"
                                  onClick={() => toast.error('Account deactivation requires support approval and is not yet self-service.')}
                               >
                        Deactivate Account
                     </Button>
                  </div>

                           <Button disabled={savingTab === 'account'} onClick={handleAccountSave} className="bg-[#00C853] hover:bg-[#00B548] text-white">
                               {savingTab === 'account' ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> Saving...</> : 'Save Changes'}
                  </Button>
               </CardContent>
             </Card>
           )}

                {/* Section: Team */}
                {activeTab === 'team' && (
                   <Card className="border-none shadow-sm">
                      <CardHeader>
                         <CardTitle className="text-[#0A2540]">Team Access</CardTitle>
                         <CardDescription>Manage teammate invite list for your employer account.</CardDescription>
                      </CardHeader>
                      <CardContent className="space-y-6">
                         <div className="flex gap-2">
                            <Input
                               placeholder="teammember@company.com"
                               value={teamInviteEmail}
                               onChange={(e) => setTeamInviteEmail(e.target.value)}
                               onKeyDown={(e) => {
                                  if (e.key === 'Enter') {
                                     e.preventDefault();
                                     addTeamInvite();
                                  }
                               }}
                            />
                            <Button type="button" variant="outline" onClick={addTeamInvite}>Add</Button>
                         </div>
                         <div className="flex flex-wrap gap-2">
                            {settings.team.invites.length === 0 ? (
                               <p className="text-sm text-gray-500">No team invites added yet.</p>
                            ) : (
                               settings.team.invites.map((email) => (
                                  <Badge key={email} variant="secondary" className="flex items-center gap-2">
                                     {email}
                                     <button type="button" onClick={() => removeTeamInvite(email)} className="text-gray-500 hover:text-red-500">
                                        <Trash2 className="w-3.5 h-3.5" />
                                     </button>
                                  </Badge>
                               ))
                            )}
                         </div>
                         <Button disabled={savingTab === 'team'} onClick={handleTeamSave} className="bg-[#00C853] hover:bg-[#00B548] text-white">
                            {savingTab === 'team' ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> Saving...</> : 'Save Team List'}
                         </Button>
                      </CardContent>
                   </Card>
                )}

                {/* Section: Notifications */}
                {activeTab === 'notifications' && (
                   <Card className="border-none shadow-sm">
                      <CardHeader>
                         <CardTitle className="text-[#0A2540]">Notifications</CardTitle>
                         <CardDescription>Choose which updates you want to receive.</CardDescription>
                      </CardHeader>
                      <CardContent className="space-y-6">
                         {[
                            { key: 'newApplicantEmail', label: 'New applicant email alerts' },
                            { key: 'interviewReminders', label: 'Interview reminders' },
                            { key: 'weeklyDigest', label: 'Weekly recruiting digest' },
                            { key: 'productUpdates', label: 'Product and feature updates' },
                         ].map((item) => (
                            <div key={item.key} className="flex items-center justify-between py-2 border-b last:border-0">
                               <span className="text-sm text-gray-800">{item.label}</span>
                               <Switch
                                  checked={settings.notifications[item.key as keyof EmployerSettingsState['notifications']]}
                                  onCheckedChange={(v) => setSettings((prev) => ({
                                     ...prev,
                                     notifications: {
                                        ...prev.notifications,
                                        [item.key]: v,
                                     },
                                  }))}
                               />
                            </div>
                         ))}
                         <Button disabled={savingTab === 'notifications'} onClick={handleNotificationsSave} className="bg-[#00C853] hover:bg-[#00B548] text-white">
                            {savingTab === 'notifications' ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> Saving...</> : 'Save Preferences'}
                         </Button>
                      </CardContent>
                   </Card>
                )}

           {/* Section: Job Defaults */}
           {activeTab === 'defaults' && (
             <Card className="border-none shadow-sm">
                <CardHeader>
                   <CardTitle className="text-[#0A2540]">Job Listing Defaults</CardTitle>
                   <CardDescription>Set default values for new job posts.</CardDescription>
                </CardHeader>
                <CardContent className="space-y-6">
                   <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div className="space-y-2">
                         <label className="text-sm font-medium text-gray-700">Default Job Type</label>
                                     <Select
                                        value={settings.jobDefaults.defaultJobType}
                                        onValueChange={(v) => setSettings((prev) => ({
                                           ...prev,
                                           jobDefaults: { ...prev.jobDefaults, defaultJobType: v },
                                        }))}
                                     >
                            <SelectTrigger>
                               <SelectValue placeholder="Select Type" />
                            </SelectTrigger>
                            <SelectContent>
                               <SelectItem value="full-time">Full-time</SelectItem>
                               <SelectItem value="contract">Contract</SelectItem>
                                              <SelectItem value="part-time">Part-time</SelectItem>
                                              <SelectItem value="internship">Internship</SelectItem>
                            </SelectContent>
                         </Select>
                      </div>
                      <div className="space-y-2">
                         <label className="text-sm font-medium text-gray-700">Auto-close listings after (days)</label>
                                     <Input
                                        type="number"
                                        min={0}
                                        placeholder="0 = Never"
                                        value={settings.jobDefaults.autoCloseDays}
                                        onChange={(e) => setSettings((prev) => ({
                                           ...prev,
                                           jobDefaults: {
                                              ...prev.jobDefaults,
                                              autoCloseDays: Number(e.target.value || 0),
                                           },
                                        }))}
                                     />
                      </div>
                   </div>

                   <div className="flex items-center justify-between py-4">
                      <div className="space-y-0.5">
                         <label className="text-base font-medium text-gray-900">Always include video assessment</label>
                         <p className="text-sm text-gray-500">Enable video screening by default.</p>
                      </div>
                                 <Switch
                                    checked={settings.jobDefaults.includeVideoAssessment}
                                    onCheckedChange={(v) => setSettings((prev) => ({
                                       ...prev,
                                       jobDefaults: { ...prev.jobDefaults, includeVideoAssessment: v },
                                    }))}
                                 />
                   </div>

                            <Button disabled={savingTab === 'defaults'} onClick={handleDefaultsSave} className="bg-[#00C853] hover:bg-[#00B548] text-white">
                               {savingTab === 'defaults' ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> Saving...</> : 'Save Changes'}
                            </Button>
                </CardContent>
             </Card>
           )}

                {/* Section: Email Templates */}
                {activeTab === 'templates' && (
                   <Card className="border-none shadow-sm">
                      <CardHeader>
                         <CardTitle className="text-[#0A2540]">Email Templates</CardTitle>
                         <CardDescription>Customize communication defaults for your hiring pipeline.</CardDescription>
                      </CardHeader>
                      <CardContent className="space-y-6">
                         <div className="space-y-2">
                            <label className="text-sm font-medium text-gray-700">Application Received</label>
                            <Textarea
                               className="min-h-[100px]"
                               value={settings.templates.applicationReceived}
                               onChange={(e) => setSettings((prev) => ({
                                  ...prev,
                                  templates: { ...prev.templates, applicationReceived: e.target.value },
                               }))}
                            />
                         </div>
                         <div className="space-y-2">
                            <label className="text-sm font-medium text-gray-700">Interview Invite</label>
                            <Textarea
                               className="min-h-[100px]"
                               value={settings.templates.interviewInvite}
                               onChange={(e) => setSettings((prev) => ({
                                  ...prev,
                                  templates: { ...prev.templates, interviewInvite: e.target.value },
                               }))}
                            />
                         </div>
                         <div className="space-y-2">
                            <label className="text-sm font-medium text-gray-700">Rejection Note</label>
                            <Textarea
                               className="min-h-[100px]"
                               value={settings.templates.rejectionNote}
                               onChange={(e) => setSettings((prev) => ({
                                  ...prev,
                                  templates: { ...prev.templates, rejectionNote: e.target.value },
                               }))}
                            />
                         </div>
                         <Button disabled={savingTab === 'templates'} onClick={handleTemplatesSave} className="bg-[#00C853] hover:bg-[#00B548] text-white">
                            {savingTab === 'templates' ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> Saving...</> : 'Save Templates'}
                         </Button>
                      </CardContent>
                   </Card>
                )}

                {/* Section: Integrations */}
                {activeTab === 'integrations' && (
                   <Card className="border-none shadow-sm">
                      <CardHeader>
                         <CardTitle className="text-[#0A2540]">Integrations</CardTitle>
                         <CardDescription>Store your preferred integration settings and endpoints.</CardDescription>
                      </CardHeader>
                      <CardContent className="space-y-6">
                         <div className="space-y-4">
                            <div className="flex items-center justify-between">
                               <span className="text-sm font-medium text-gray-800">Google Calendar</span>
                               <Switch
                                  checked={settings.integrations.googleCalendar}
                                  onCheckedChange={(v) => setSettings((prev) => ({
                                     ...prev,
                                     integrations: { ...prev.integrations, googleCalendar: v },
                                  }))}
                               />
                            </div>
                            <div className="flex items-center justify-between">
                               <span className="text-sm font-medium text-gray-800">Zoom</span>
                               <Switch
                                  checked={settings.integrations.zoom}
                                  onCheckedChange={(v) => setSettings((prev) => ({
                                     ...prev,
                                     integrations: { ...prev.integrations, zoom: v },
                                  }))}
                               />
                            </div>
                            <div className="flex items-center justify-between">
                               <span className="text-sm font-medium text-gray-800">Microsoft Teams</span>
                               <Switch
                                  checked={settings.integrations.msTeams}
                                  onCheckedChange={(v) => setSettings((prev) => ({
                                     ...prev,
                                     integrations: { ...prev.integrations, msTeams: v },
                                  }))}
                               />
                            </div>
                         </div>
                         <div className="space-y-2">
                            <label className="text-sm font-medium text-gray-700">Custom webhook URL</label>
                            <Input
                               placeholder="https://example.com/recruit/webhook"
                               value={settings.integrations.webhookUrl}
                               onChange={(e) => setSettings((prev) => ({
                                  ...prev,
                                  integrations: { ...prev.integrations, webhookUrl: e.target.value },
                               }))}
                            />
                         </div>
                         <Button disabled={savingTab === 'integrations'} onClick={handleIntegrationsSave} className="bg-[#00C853] hover:bg-[#00B548] text-white">
                            {savingTab === 'integrations' ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> Saving...</> : 'Save Integrations'}
                         </Button>
                      </CardContent>
                   </Card>
                )}

                {/* Section: Billing */}
                {activeTab === 'billing' && (
                   <Card className="border-none shadow-sm">
                      <CardHeader>
                         <CardTitle className="text-[#0A2540]">Billing & Plan</CardTitle>
                         <CardDescription>Manage your active subscription and billing preferences.</CardDescription>
                      </CardHeader>
                      <CardContent className="space-y-4">
                         <div className="p-4 rounded-lg border bg-gray-50 flex items-center justify-between">
                            <div>
                               <p className="text-sm text-gray-500">Current plan</p>
                               <p className="text-lg font-semibold text-[#0A2540] uppercase">{profile?.subscription || 'STARTER'}</p>
                            </div>
                            <Link to="/employer/subscriptions">
                               <Button className="bg-[#0A2540] hover:bg-[#081f36] text-white">Manage Plan</Button>
                            </Link>
                         </div>
                         <p className="text-sm text-gray-500">
                            Billing checkout and invoices are managed in the subscription section.
                         </p>
                      </CardContent>
                   </Card>
                )}

        </div>
      </div>
    </div>
  );
}
