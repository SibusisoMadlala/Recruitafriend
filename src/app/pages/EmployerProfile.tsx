import { useEffect, useMemo, useRef, useState, type ChangeEvent } from 'react';
import { 
   Building2, MapPin, Globe, Upload, Linkedin, Facebook, Instagram, Twitter, Loader2, ExternalLink, CheckCircle2
} from 'lucide-react';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Textarea } from '../components/ui/textarea';
import { Badge } from '../components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '../components/ui/card';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '../components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../components/ui/select';
import { Switch } from '../components/ui/switch';
import { Label } from '../components/ui/label';
import { useAuth } from '../context/useAuth';
import { apiCall } from '../lib/supabase';
import { toast } from 'sonner';

type EmployerMeta = {
   registrationNumber: string;
   industry: string;
   companySize: string;
   locations: string[];
   cultureTags: string[];
   dayInLife: string;
   bbbeeLevel: string;
   bbbeeVerified: boolean;
};

type CompanyForm = {
   name: string;
   headline: string;
   summary: string;
   location: string;
   avatarUrl: string;
   website: string;
   linkedin: string;
   facebook: string;
   instagram: string;
   twitter: string;
   registrationNumber: string;
   industry: string;
   companySize: string;
   locationsText: string;
   cultureTags: string[];
   dayInLife: string;
   bbbeeLevel: string;
   bbbeeVerified: boolean;
};

const defaultEmployerMeta: EmployerMeta = {
   registrationNumber: '',
   industry: '',
   companySize: '',
   locations: [],
   cultureTags: [],
   dayInLife: '',
   bbbeeLevel: 'not-rated',
   bbbeeVerified: false,
};

const presetCultureTags = ['Remote-friendly', 'Flexible hours', 'Learning & Dev', 'Diversity focused', 'Wellness benefits'];

function isValidUrl(value: string) {
   if (!value.trim()) return true;
   return /^https?:\/\//i.test(value.trim()) || /^data:image\//i.test(value.trim());
}

export default function EmployerProfile() {
   const { profile, refreshProfile } = useAuth();
   const logoInputRef = useRef<HTMLInputElement | null>(null);
   const [activeTab, setActiveTab] = useState('identity');
   const [previewOpen, setPreviewOpen] = useState(false);
   const [saving, setSaving] = useState(false);
   const [newTag, setNewTag] = useState('');
   const [form, setForm] = useState<CompanyForm>({
      name: '',
      headline: '',
      summary: '',
      location: '',
      avatarUrl: '',
      website: '',
      linkedin: '',
      facebook: '',
      instagram: '',
      twitter: '',
      registrationNumber: '',
      industry: '',
      companySize: '',
      locationsText: '',
      cultureTags: [],
      dayInLife: '',
      bbbeeLevel: 'not-rated',
      bbbeeVerified: false,
   });

   useEffect(() => {
      if (!profile) return;

      const social = ((profile.social_links as Record<string, any> | undefined) || {}) as Record<string, any>;
      const employer = (social.employer || defaultEmployerMeta) as EmployerMeta;

      setForm({
         name: profile.name || '',
         headline: profile.headline || '',
         summary: profile.summary || '',
         location: profile.location || '',
         avatarUrl: profile.avatar_url || '',
         website: social.website || '',
         linkedin: social.linkedin || '',
         facebook: social.facebook || '',
         instagram: social.instagram || '',
         twitter: social.twitter || '',
         registrationNumber: employer.registrationNumber || '',
         industry: employer.industry || '',
         companySize: employer.companySize || '',
         locationsText: Array.isArray(employer.locations) ? employer.locations.join('\n') : '',
         cultureTags: Array.isArray(employer.cultureTags) ? employer.cultureTags : [],
         dayInLife: employer.dayInLife || '',
         bbbeeLevel: employer.bbbeeLevel || 'not-rated',
         bbbeeVerified: Boolean(employer.bbbeeVerified),
      });
   }, [profile]);

   const completion = useMemo(() => {
      const checks = [
         Boolean(form.name.trim()),
         Boolean(form.avatarUrl.trim()),
         Boolean(form.headline.trim()),
         Boolean(form.summary.trim()),
         Boolean(form.location.trim()),
         Boolean(form.industry.trim()),
         Boolean(form.companySize.trim()),
         Boolean(form.website.trim()),
         Boolean(form.linkedin.trim()),
         Boolean(form.cultureTags.length),
         Boolean(form.dayInLife.trim()),
         form.bbbeeLevel !== 'not-rated',
      ];

      const filled = checks.filter(Boolean).length;
      return Math.round((filled / checks.length) * 100);
   }, [form]);

   const companyLocations = useMemo(() => {
      const parsed = form.locationsText
         .split('\n')
         .map((item) => item.trim())
         .filter(Boolean);

      if (form.location.trim() && !parsed.some((item) => item.toLowerCase() === form.location.trim().toLowerCase())) {
         return [form.location.trim(), ...parsed];
      }

      return parsed;
   }, [form.location, form.locationsText]);

   const socialLinks = useMemo(() => (
      [
         { label: 'Website', value: form.website, icon: Globe },
         { label: 'LinkedIn', value: form.linkedin, icon: Linkedin },
         { label: 'Facebook', value: form.facebook, icon: Facebook },
         { label: 'Instagram', value: form.instagram, icon: Instagram },
         { label: 'X / Twitter', value: form.twitter, icon: Twitter },
      ].filter((item) => item.value.trim())
   ), [form.website, form.linkedin, form.facebook, form.instagram, form.twitter]);

   const bbbeeLabel = form.bbbeeLevel === 'not-rated' ? 'Not rated' : `Level ${form.bbbeeLevel}`;

   const updateForm = <K extends keyof CompanyForm>(key: K, value: CompanyForm[K]) => {
      setForm((prev) => ({ ...prev, [key]: value }));
   };

   const saveProfile = async () => {
      if (!form.name.trim()) {
         toast.error('Company name is required');
         setActiveTab('identity');
         return;
      }

      const urlFields = [
         { label: 'Website', value: form.website },
         { label: 'LinkedIn', value: form.linkedin },
         { label: 'Facebook', value: form.facebook },
         { label: 'Instagram', value: form.instagram },
         { label: 'Twitter / X', value: form.twitter },
         { label: 'Logo URL', value: form.avatarUrl },
      ];

      const badUrl = urlFields.find((entry) => !isValidUrl(entry.value));
      if (badUrl) {
         toast.error(`${badUrl.label} must start with http:// or https://`);
         return;
      }

      const locations = form.locationsText
         .split('\n')
         .map((item) => item.trim())
         .filter(Boolean);

      const employerMeta: EmployerMeta = {
         registrationNumber: form.registrationNumber.trim(),
         industry: form.industry,
         companySize: form.companySize,
         locations,
         cultureTags: form.cultureTags,
         dayInLife: form.dayInLife.trim(),
         bbbeeLevel: form.bbbeeLevel,
         bbbeeVerified: form.bbbeeVerified,
      };

      const nextSocialLinks = {
         ...(((profile?.social_links as Record<string, any> | undefined) || {}) as Record<string, any>),
         website: form.website.trim(),
         linkedin: form.linkedin.trim(),
         facebook: form.facebook.trim(),
         instagram: form.instagram.trim(),
         twitter: form.twitter.trim(),
         employer: employerMeta,
      };

      setSaving(true);
      try {
         await apiCall('/auth/profile', {
            method: 'PUT',
            requireAuth: true,
            body: JSON.stringify({
               name: form.name.trim(),
               headline: form.headline.trim(),
               summary: form.summary.trim(),
               location: form.location.trim(),
               avatar_url: form.avatarUrl.trim() || null,
               social_links: nextSocialLinks,
            }),
         });

         await refreshProfile?.();
         toast.success('Company profile saved');
      } catch (error: any) {
         toast.error(error?.message || 'Failed to save company profile');
      } finally {
         setSaving(false);
      }
   };

   const addTag = () => {
      const normalized = newTag.trim();
      if (!normalized) return;
      setForm((prev) => {
         if (prev.cultureTags.some((tag) => tag.toLowerCase() === normalized.toLowerCase())) return prev;
         return { ...prev, cultureTags: [...prev.cultureTags, normalized] };
      });
      setNewTag('');
   };

   const togglePresetTag = (tag: string) => {
      setForm((prev) => {
         const exists = prev.cultureTags.some((item) => item.toLowerCase() === tag.toLowerCase());
         if (exists) {
            return { ...prev, cultureTags: prev.cultureTags.filter((item) => item.toLowerCase() !== tag.toLowerCase()) };
         }
         return { ...prev, cultureTags: [...prev.cultureTags, tag] };
      });
   };

   const removeTag = (tag: string) => {
      setForm((prev) => ({
         ...prev,
         cultureTags: prev.cultureTags.filter((item) => item !== tag),
      }));
   };

   const triggerLogoUpload = () => {
      logoInputRef.current?.click();
   };

   const handleLogoFileChange = (event: ChangeEvent<HTMLInputElement>) => {
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
      reader.onload = () => {
         const result = typeof reader.result === 'string' ? reader.result : '';
         if (!result) {
            toast.error('Could not read selected image');
            return;
         }
         updateForm('avatarUrl', result);
      };
      reader.onerror = () => toast.error('Failed to process selected image');
      reader.readAsDataURL(file);
   };
  
  return (
    <div className="max-w-5xl mx-auto space-y-8 pb-20">
      
      {/* Header */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-6">
        <div className="flex items-start gap-6">
           {/* Company Logo */}
           <div className="w-28 h-28 bg-gray-100 rounded-lg flex items-center justify-center border-2 border-dashed border-gray-300 overflow-hidden flex-shrink-0 shadow-sm">
              {form.avatarUrl ? (
                 <img src={form.avatarUrl} alt="Company logo" className="w-full h-full object-cover" />
              ) : (
                 <Building2 className="w-12 h-12 text-gray-400" />
              )}
           </div>
           <div>
              <h1 className="text-3xl font-bold text-[#0A2540]">Company Profile</h1>
              <p className="text-gray-500">Manage your company branding and information.</p>
              {form.avatarUrl && (
                 <p className="text-xs text-gray-400 mt-2">Logo uploaded • Click Identity tab to change</p>
              )}
           </div>
        </div>
        <Button
          variant="outline"
          className="border-[#0A2540] text-[#0A2540] hover:bg-gray-50"
               onClick={() => setPreviewOpen(true)}
        >
           <EyeIcon className="w-4 h-4 mr-2" /> Preview as Candidate
        </Button>
      </div>

      {/* Completion Bar */}
      <Card className="bg-blue-50 border-blue-100">
        <CardContent className="p-6 flex items-center gap-6">
           <div className="relative w-16 h-16 flex-shrink-0">
              <svg className="w-full h-full transform -rotate-90">
                 <circle cx="32" cy="32" r="28" stroke="currentColor" strokeWidth="4" fill="transparent" className="text-blue-200" />
                 <circle
                   cx="32"
                   cy="32"
                   r="28"
                   stroke="currentColor"
                   strokeWidth="4"
                   fill="transparent"
                   strokeDasharray="175.9"
                   strokeDashoffset={175.9 - (175.9 * completion) / 100}
                   className="text-[#00C853]"
                 />
              </svg>
              <div className="absolute inset-0 flex items-center justify-center font-bold text-[#0A2540]">{completion}%</div>
           </div>
           <div>
              <h3 className="font-bold text-[#0A2540] mb-1">Profile {completion}% Complete</h3>
              <p className="text-sm text-gray-600">Complete your profile to build trust and attract better-fit candidates.</p>
           </div>
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-8">
        
        {/* Navigation */}
        <div className="lg:col-span-1 space-y-2">
           {['Identity', 'About', 'Locations', 'Culture', 'B-BBEE'].map((tab) => (
             <button
               key={tab}
               onClick={() => setActiveTab(tab.toLowerCase())}
               className={`w-full text-left px-4 py-3 rounded-lg font-medium transition-colors ${
                 activeTab === tab.toLowerCase() 
                   ? 'bg-[#0A2540] text-white shadow-md' 
                   : 'text-gray-600 hover:bg-white hover:shadow-sm'
               }`}
             >
               {tab}
             </button>
           ))}
        </div>

        {/* Content Area */}
        <div className="lg:col-span-3 space-y-6">
           
           {/* Section: Identity */}
           {activeTab === 'identity' && (
             <Card className="border-none shadow-sm">
               <CardHeader>
                 <CardTitle className="text-[#0A2540]">Company Identity</CardTitle>
                 <CardDescription>Basic information about your organization.</CardDescription>
               </CardHeader>
               <CardContent className="space-y-6">
                  
                  {/* Logo Upload */}
                  <div className="flex items-center gap-6">
                               <div className="w-24 h-24 bg-gray-100 rounded-full flex items-center justify-center border-2 border-dashed border-gray-300 overflow-hidden">
                                    {form.avatarUrl ? (
                                       <img src={form.avatarUrl} alt="Company logo" className="w-full h-full object-cover" />
                                    ) : (
                                       <Upload className="w-8 h-8 text-gray-400" />
                                    )}
                     </div>
                     <div>
                                    <Button
                                       variant="outline"
                                       size="sm"
                                       className="mb-2"
                                       onClick={triggerLogoUpload}
                                    >
                                       Upload Logo From Device
                                    </Button>
                        <input ref={logoInputRef} type="file" accept="image/*" className="hidden" onChange={handleLogoFileChange} />
                        <p className="text-xs text-gray-400">Recommended: 400x400px PNG or JPG.</p>
                     </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                     <div className="space-y-2">
                        <Label>Company Name</Label>
                        <Input
                          placeholder="e.g. Acme Corp"
                          value={form.name}
                          onChange={(e) => updateForm('name', e.target.value)}
                        />
                     </div>
                     <div className="space-y-2">
                        <Label>Registration Number</Label>
                        <Input
                          placeholder="Optional"
                          value={form.registrationNumber}
                          onChange={(e) => updateForm('registrationNumber', e.target.value)}
                        />
                     </div>
                     <div className="space-y-2">
                        <Label>Industry</Label>
                        <Select value={form.industry} onValueChange={(v) => updateForm('industry', v)}>
                           <SelectTrigger>
                              <SelectValue placeholder="Select Industry" />
                           </SelectTrigger>
                           <SelectContent>
                              <SelectItem value="it">Information Technology</SelectItem>
                              <SelectItem value="finance">Finance</SelectItem>
                              <SelectItem value="healthcare">Healthcare</SelectItem>
                              <SelectItem value="education">Education</SelectItem>
                              <SelectItem value="retail">Retail</SelectItem>
                              <SelectItem value="manufacturing">Manufacturing</SelectItem>
                           </SelectContent>
                        </Select>
                     </div>
                     <div className="space-y-2">
                        <Label>Company Size</Label>
                        <Select value={form.companySize} onValueChange={(v) => updateForm('companySize', v)}>
                           <SelectTrigger>
                              <SelectValue placeholder="Select Size" />
                           </SelectTrigger>
                           <SelectContent>
                              <SelectItem value="1-10">1-10 Employees</SelectItem>
                              <SelectItem value="11-50">11-50 Employees</SelectItem>
                              <SelectItem value="51-200">51-200 Employees</SelectItem>
                              <SelectItem value="201-500">201-500 Employees</SelectItem>
                              <SelectItem value="500+">500+ Employees</SelectItem>
                           </SelectContent>
                        </Select>
                     </div>
                  </div>

                  <div className="space-y-2">
                     <Label>Website & Socials</Label>
                     <div className="grid grid-cols-1 gap-3">
                        <div className="relative">
                           <Globe className="absolute left-3 top-2.5 h-4 w-4 text-gray-400" />
                                        <Input
                                           className="pl-9"
                                           placeholder="https://website.com"
                                           value={form.website}
                                           onChange={(e) => updateForm('website', e.target.value)}
                                        />
                        </div>
                        <div className="relative">
                           <Linkedin className="absolute left-3 top-2.5 h-4 w-4 text-gray-400" />
                                        <Input
                                           className="pl-9"
                                           placeholder="LinkedIn URL"
                                           value={form.linkedin}
                                           onChange={(e) => updateForm('linkedin', e.target.value)}
                                        />
                                    </div>
                                    <div className="relative">
                                        <Facebook className="absolute left-3 top-2.5 h-4 w-4 text-gray-400" />
                                        <Input
                                           className="pl-9"
                                           placeholder="Facebook URL"
                                           value={form.facebook}
                                           onChange={(e) => updateForm('facebook', e.target.value)}
                                        />
                                    </div>
                                    <div className="relative">
                                        <Instagram className="absolute left-3 top-2.5 h-4 w-4 text-gray-400" />
                                        <Input
                                           className="pl-9"
                                           placeholder="Instagram URL"
                                           value={form.instagram}
                                           onChange={(e) => updateForm('instagram', e.target.value)}
                                        />
                                    </div>
                                    <div className="relative">
                                        <Twitter className="absolute left-3 top-2.5 h-4 w-4 text-gray-400" />
                                        <Input
                                           className="pl-9"
                                           placeholder="X / Twitter URL"
                                           value={form.twitter}
                                           onChange={(e) => updateForm('twitter', e.target.value)}
                                        />
                        </div>
                     </div>
                  </div>

                           <Button disabled={saving} onClick={saveProfile} className="bg-[#00C853] hover:bg-[#00B548] text-white w-full md:w-auto">
                               {saving ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> Saving...</> : 'Save Changes'}
                  </Button>
               </CardContent>
             </Card>
           )}

                {/* Section: About */}
                {activeTab === 'about' && (
                   <Card className="border-none shadow-sm">
                      <CardHeader>
                         <CardTitle className="text-[#0A2540]">About Company</CardTitle>
                         <CardDescription>Tell candidates who you are and what you value.</CardDescription>
                      </CardHeader>
                      <CardContent className="space-y-6">
                         <div className="space-y-2">
                            <Label>Company Headline</Label>
                            <Input
                               placeholder="e.g. Building Africa's most trusted hiring marketplace"
                               value={form.headline}
                               onChange={(e) => updateForm('headline', e.target.value)}
                            />
                         </div>
                         <div className="space-y-2">
                            <Label>Company Overview</Label>
                            <Textarea
                               className="min-h-[180px]"
                               placeholder="Share your mission, values and what your company does."
                               value={form.summary}
                               onChange={(e) => updateForm('summary', e.target.value)}
                            />
                         </div>
                         <Button disabled={saving} onClick={saveProfile} className="bg-[#00C853] hover:bg-[#00B548] text-white">
                            {saving ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> Saving...</> : 'Save Changes'}
                         </Button>
                      </CardContent>
                   </Card>
                )}

                {/* Section: Locations */}
                {activeTab === 'locations' && (
                   <Card className="border-none shadow-sm">
                      <CardHeader>
                         <CardTitle className="text-[#0A2540]">Locations</CardTitle>
                         <CardDescription>Add your HQ and branch locations (one per line).</CardDescription>
                      </CardHeader>
                      <CardContent className="space-y-6">
                         <div className="space-y-2">
                            <Label>Primary Location</Label>
                            <div className="relative">
                               <MapPin className="absolute left-3 top-2.5 h-4 w-4 text-gray-400" />
                               <Input
                                  className="pl-9"
                                  placeholder="e.g. Johannesburg, Gauteng"
                                  value={form.location}
                                  onChange={(e) => updateForm('location', e.target.value)}
                               />
                            </div>
                         </div>

                         <div className="space-y-2">
                            <Label>All Locations</Label>
                            <Textarea
                               className="min-h-[150px]"
                               placeholder={'Johannesburg, Gauteng\nCape Town, Western Cape'}
                               value={form.locationsText}
                               onChange={(e) => updateForm('locationsText', e.target.value)}
                            />
                            <p className="text-xs text-gray-500">Tip: Add one office per line.</p>
                         </div>

                         <Button disabled={saving} onClick={saveProfile} className="bg-[#00C853] hover:bg-[#00B548] text-white">
                            {saving ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> Saving...</> : 'Save Changes'}
                         </Button>
                      </CardContent>
                   </Card>
                )}

           {/* Section: Culture */}
           {activeTab === 'culture' && (
             <Card className="border-none shadow-sm">
                <CardHeader>
                   <CardTitle className="text-[#0A2540]">Culture & Benefits</CardTitle>
                   <CardDescription>What makes your company a great place to work?</CardDescription>
                </CardHeader>
                <CardContent className="space-y-6">
                   <div className="space-y-4">
                      <Label>Culture Tags</Label>
                      <div className="flex flex-wrap gap-2">
                                     {presetCultureTags.map(tag => (
                                          <Badge
                                             key={tag}
                                             variant={form.cultureTags.some((item) => item.toLowerCase() === tag.toLowerCase()) ? 'default' : 'secondary'}
                                             className="cursor-pointer hover:bg-gray-200 px-3 py-1"
                                             onClick={() => togglePresetTag(tag)}
                                          >
                               {tag}
                            </Badge>
                         ))}
                      </div>
                                 <div className="flex gap-2">
                                    <Input
                                       placeholder="Add custom tag"
                                       value={newTag}
                                       onChange={(e) => setNewTag(e.target.value)}
                                       onKeyDown={(e) => {
                                          if (e.key === 'Enter') {
                                             e.preventDefault();
                                             addTag();
                                          }
                                       }}
                                    />
                                    <Button type="button" variant="outline" onClick={addTag}>Add</Button>
                                 </div>
                                 <div className="flex flex-wrap gap-2">
                                    {form.cultureTags.map((tag) => (
                                       <Badge key={tag} variant="outline" className="cursor-pointer" onClick={() => removeTag(tag)}>
                                          {tag} ×
                                       </Badge>
                                    ))}
                                 </div>
                   </div>

                   <div className="space-y-2">
                      <Label>A day in the life description</Label>
                      <Textarea 
                        placeholder="Describe what a typical day looks like..." 
                        className="min-h-[150px]"
                                    value={form.dayInLife}
                                    onChange={(e) => updateForm('dayInLife', e.target.value)}
                      />
                   </div>

                            <Button disabled={saving} onClick={saveProfile} className="bg-[#00C853] hover:bg-[#00B548] text-white">
                               {saving ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> Saving...</> : 'Save Changes'}
                            </Button>
                </CardContent>
             </Card>
           )}

                {/* Section: B-BBEE */}
                {activeTab === 'b-bbee' && (
                   <Card className="border-none shadow-sm">
                      <CardHeader>
                         <CardTitle className="text-[#0A2540]">B-BBEE Information</CardTitle>
                         <CardDescription>Share your company empowerment status for candidate and partner visibility.</CardDescription>
                      </CardHeader>
                      <CardContent className="space-y-6">
                         <div className="space-y-2">
                            <Label>B-BBEE Level</Label>
                            <Select value={form.bbbeeLevel} onValueChange={(v) => updateForm('bbbeeLevel', v)}>
                               <SelectTrigger>
                                  <SelectValue placeholder="Select level" />
                               </SelectTrigger>
                               <SelectContent>
                                  <SelectItem value="not-rated">Not rated</SelectItem>
                                  <SelectItem value="1">Level 1</SelectItem>
                                  <SelectItem value="2">Level 2</SelectItem>
                                  <SelectItem value="3">Level 3</SelectItem>
                                  <SelectItem value="4">Level 4</SelectItem>
                                  <SelectItem value="5">Level 5</SelectItem>
                                  <SelectItem value="6">Level 6</SelectItem>
                                  <SelectItem value="7">Level 7</SelectItem>
                                  <SelectItem value="8">Level 8</SelectItem>
                               </SelectContent>
                            </Select>
                         </div>

                         <div className="flex items-center justify-between border rounded-md p-4">
                            <div>
                               <h4 className="font-medium text-[#0A2540]">Verified certificate on file</h4>
                               <p className="text-sm text-gray-500">Toggle this once your latest certificate has been validated internally.</p>
                            </div>
                            <Switch checked={form.bbbeeVerified} onCheckedChange={(v) => updateForm('bbbeeVerified', v)} />
                         </div>

                         <Button disabled={saving} onClick={saveProfile} className="bg-[#00C853] hover:bg-[#00B548] text-white">
                            {saving ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> Saving...</> : 'Save Changes'}
                         </Button>
                      </CardContent>
                   </Card>
                )}

        </div>
      </div>

      <Dialog open={previewOpen} onOpenChange={setPreviewOpen}>
         <DialogContent className="max-w-5xl max-h-[90vh] overflow-y-auto p-0">
            <DialogHeader className="px-6 pt-6 pb-0">
               <DialogTitle>Candidate Preview</DialogTitle>
               <DialogDescription>
                  This preview uses your current company profile draft, including unsaved edits.
               </DialogDescription>
            </DialogHeader>

            <div className="px-6 pb-6">
               <div className="mt-4 overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-sm">
                  <div className="h-36 bg-gradient-to-r from-[#0A2540] to-[#0f4c75] relative">
                     <div className="absolute -bottom-10 left-6 flex h-24 w-24 items-center justify-center overflow-hidden rounded-2xl border-4 border-white bg-white shadow-lg">
                        {form.avatarUrl ? (
                           <img src={form.avatarUrl} alt="Company logo preview" className="h-full w-full object-cover" />
                        ) : (
                           <Building2 className="h-10 w-10 text-[#00C853]" />
                        )}
                     </div>
                  </div>

                  <div className="px-6 pb-6 pt-14">
                     <div className="flex flex-col gap-6 lg:flex-row lg:items-start lg:justify-between">
                        <div className="min-w-0 flex-1">
                           <div className="flex flex-wrap items-center gap-3">
                              <h2 className="text-3xl font-bold text-[#0A2540]">{form.name.trim() || 'Your Company Name'}</h2>
                              {form.bbbeeVerified ? (
                                 <span className="inline-flex items-center gap-1 rounded-full bg-green-50 px-3 py-1 text-xs font-semibold text-green-700">
                                    <CheckCircle2 className="h-3.5 w-3.5" /> Verified business
                                 </span>
                              ) : null}
                           </div>
                           <p className="mt-2 text-base text-gray-600">
                              {form.headline.trim() || 'Your headline will appear here for candidates.'}
                           </p>

                           <div className="mt-4 flex flex-wrap gap-4 text-sm text-gray-500">
                              {form.location.trim() ? (
                                 <span className="inline-flex items-center gap-1.5"><MapPin className="h-4 w-4" /> {form.location.trim()}</span>
                              ) : null}
                              {form.industry.trim() ? (
                                 <span className="inline-flex items-center gap-1.5"><Building2 className="h-4 w-4" /> {form.industry}</span>
                              ) : null}
                              {form.companySize.trim() ? <span>{form.companySize} employees</span> : null}
                              <span>{bbbeeLabel}</span>
                           </div>
                        </div>

                        {socialLinks.length > 0 ? (
                           <div className="grid gap-2 rounded-xl border border-gray-200 bg-gray-50 p-4 text-sm min-w-[240px]">
                              <p className="font-semibold text-[#0A2540]">Company links</p>
                              {socialLinks.map((link) => {
                                 const Icon = link.icon;
                                 return (
                                    <a
                                       key={link.label}
                                       href={link.value}
                                       target="_blank"
                                       rel="noopener noreferrer"
                                       className="inline-flex items-center justify-between gap-3 rounded-lg bg-white px-3 py-2 text-gray-700 transition-colors hover:bg-gray-100 hover:text-[#0A2540]"
                                    >
                                       <span className="inline-flex items-center gap-2 min-w-0">
                                          <Icon className="h-4 w-4 flex-shrink-0" />
                                          <span className="truncate">{link.label}</span>
                                       </span>
                                       <ExternalLink className="h-4 w-4 flex-shrink-0" />
                                    </a>
                                 );
                              })}
                           </div>
                        ) : null}
                     </div>

                     <div className="mt-8 grid gap-6 lg:grid-cols-[1.5fr_1fr]">
                        <div className="space-y-6">
                           <section>
                              <h3 className="text-lg font-semibold text-[#0A2540]">About the company</h3>
                              <p className="mt-2 whitespace-pre-line text-sm leading-6 text-gray-600">
                                 {form.summary.trim() || 'Your company overview will appear here for candidates once added.'}
                              </p>
                           </section>

                           <section>
                              <h3 className="text-lg font-semibold text-[#0A2540]">Culture & benefits</h3>
                              {form.cultureTags.length > 0 ? (
                                 <div className="mt-3 flex flex-wrap gap-2">
                                    {form.cultureTags.map((tag) => (
                                       <Badge key={tag} variant="secondary" className="rounded-full px-3 py-1 text-xs">
                                          {tag}
                                       </Badge>
                                    ))}
                                 </div>
                              ) : (
                                 <p className="mt-2 text-sm text-gray-500">No culture tags added yet.</p>
                              )}

                              <p className="mt-4 whitespace-pre-line text-sm leading-6 text-gray-600">
                                 {form.dayInLife.trim() || 'Describe a day in the life at your company so candidates know what to expect.'}
                              </p>
                           </section>
                        </div>

                        <div className="space-y-4">
                           <section className="rounded-xl border border-gray-200 bg-gray-50 p-4">
                              <h3 className="text-base font-semibold text-[#0A2540]">Company snapshot</h3>
                              <dl className="mt-4 space-y-3 text-sm">
                                 <div>
                                    <dt className="text-gray-500">Industry</dt>
                                    <dd className="font-medium text-[#0A2540]">{form.industry || 'Not specified'}</dd>
                                 </div>
                                 <div>
                                    <dt className="text-gray-500">Company size</dt>
                                    <dd className="font-medium text-[#0A2540]">{form.companySize || 'Not specified'}</dd>
                                 </div>
                                 <div>
                                    <dt className="text-gray-500">Registration number</dt>
                                    <dd className="font-medium text-[#0A2540]">{form.registrationNumber || 'Not shared'}</dd>
                                 </div>
                                 <div>
                                    <dt className="text-gray-500">B-BBEE status</dt>
                                    <dd className="font-medium text-[#0A2540]">
                                       {bbbeeLabel}{form.bbbeeVerified ? ' • Verified' : ''}
                                    </dd>
                                 </div>
                              </dl>
                           </section>

                           <section className="rounded-xl border border-gray-200 bg-gray-50 p-4">
                              <h3 className="text-base font-semibold text-[#0A2540]">Locations</h3>
                              {companyLocations.length > 0 ? (
                                 <ul className="mt-3 space-y-2 text-sm text-gray-600">
                                    {companyLocations.map((location) => (
                                       <li key={location} className="inline-flex items-start gap-2">
                                          <MapPin className="mt-0.5 h-4 w-4 flex-shrink-0 text-[#00C853]" />
                                          <span>{location}</span>
                                       </li>
                                    ))}
                                 </ul>
                              ) : (
                                 <p className="mt-3 text-sm text-gray-500">No locations added yet.</p>
                              )}
                           </section>
                        </div>
                     </div>
                  </div>
               </div>
            </div>
         </DialogContent>
      </Dialog>
    </div>
  );
}

function EyeIcon(props: any) {
  return (
    <svg
      {...props}
      xmlns="http://www.w3.org/2000/svg"
      width="24"
      height="24"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M2 12s3-7 10-7 10 7 10 7-3 7-10 7-10-7-10-7Z" />
      <circle cx="12" cy="12" r="3" />
    </svg>
  )
}
