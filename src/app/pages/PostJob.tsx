import { useState } from 'react';
import { useNavigate } from 'react-router';
import { useForm } from 'react-hook-form';
import { apiCall } from '../lib/supabase';
import { toast } from 'sonner';
import { 
  Building2, MapPin, Globe, Upload, CheckCircle, Video,
  Linkedin, Facebook, Instagram, Twitter, ChevronRight, Check, Loader2
} from 'lucide-react';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Textarea } from '../components/ui/textarea';
import { Badge } from '../components/ui/badge';
import { Card, CardContent } from '../components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../components/ui/select';
import { Switch } from '../components/ui/switch';
import { Label } from '../components/ui/label';

interface PostJobFormValues {
  title: string;
  industry: string;
  category: string;
  employment_type: string;
  work_location: string;
  province: string;
  city: string;
  salary_min: number;
  salary_max: number;
  hide_salary: boolean;
  deadline: string;
  description: string;
  requirements: string;
  benefits: string;
  experience_level: string;
  qualification: string;
  positions: number;
  interview_type: string;
}

type ScreeningQuestion = {
   id: number;
   prompt: string;
   duration: '1min' | '2min' | '3min';
};

const INDUSTRY_OPTIONS = [
   { value: 'accounting-auditing', label: 'Accounting & Auditing' },
   { value: 'admin-office-support', label: 'Admin, Office & Support' },
   { value: 'agriculture-forestry-fishing', label: 'Agriculture, Forestry & Fishing' },
   { value: 'architecture-planning', label: 'Architecture & Planning' },
   { value: 'automotive', label: 'Automotive' },
   { value: 'banking-financial-services', label: 'Banking & Financial Services' },
   { value: 'construction-built-environment', label: 'Construction & Built Environment' },
   { value: 'consulting', label: 'Consulting' },
   { value: 'creative-media-advertising', label: 'Creative, Media & Advertising' },
   { value: 'customer-service-bpo', label: 'Customer Service & BPO' },
   { value: 'education-training', label: 'Education & Training' },
   { value: 'energy-utilities', label: 'Energy & Utilities' },
   { value: 'engineering', label: 'Engineering' },
   { value: 'fmcg-retail-wholesale', label: 'FMCG, Retail & Wholesale' },
   { value: 'government-public-sector', label: 'Government & Public Sector' },
   { value: 'healthcare-medical-pharmaceutical', label: 'Healthcare, Medical & Pharmaceutical' },
   { value: 'hospitality-tourism-events', label: 'Hospitality, Tourism & Events' },
   { value: 'hr-recruitment', label: 'HR & Recruitment' },
   { value: 'insurance', label: 'Insurance' },
   { value: 'it-telecommunications', label: 'IT & Telecommunications' },
   { value: 'legal-compliance', label: 'Legal & Compliance' },
   { value: 'logistics-transport-supply-chain', label: 'Logistics, Transport & Supply Chain' },
   { value: 'manufacturing-production', label: 'Manufacturing & Production' },
   { value: 'marketing-sales', label: 'Marketing & Sales' },
   { value: 'mining-resources', label: 'Mining & Resources' },
   { value: 'ngo-non-profit', label: 'NGO & Non-Profit' },
   { value: 'property-real-estate', label: 'Property & Real Estate' },
   { value: 'security-safety', label: 'Security & Safety' },
   { value: 'science-research', label: 'Science & Research' },
   { value: 'sports-fitness', label: 'Sports & Fitness' },
   { value: 'trade-services-artisan', label: 'Trade Services & Artisan' },
   { value: 'other', label: 'Other' },
];

const JOB_CATEGORY_OPTIONS = [
   { value: 'accounting-finance', label: 'Accounting & Finance' },
   { value: 'administration', label: 'Administration' },
   { value: 'business-analysis', label: 'Business Analysis' },
   { value: 'call-centre', label: 'Call Centre' },
   { value: 'construction', label: 'Construction' },
   { value: 'customer-support', label: 'Customer Support' },
   { value: 'data-analytics', label: 'Data & Analytics' },
   { value: 'design-ux-ui', label: 'Design (UX/UI/Graphic)' },
   { value: 'driver-delivery', label: 'Driver & Delivery' },
   { value: 'education-teaching', label: 'Education & Teaching' },
   { value: 'engineering-technical', label: 'Engineering & Technical' },
   { value: 'executive-management', label: 'Executive Management' },
   { value: 'healthcare-nursing', label: 'Healthcare & Nursing' },
   { value: 'hospitality-catering', label: 'Hospitality & Catering' },
   { value: 'hr-payroll', label: 'HR & Payroll' },
   { value: 'legal', label: 'Legal' },
   { value: 'logistics-warehousing', label: 'Logistics & Warehousing' },
   { value: 'maintenance-repairs', label: 'Maintenance & Repairs' },
   { value: 'marketing-digital', label: 'Marketing & Digital' },
   { value: 'operations', label: 'Operations' },
   { value: 'procurement', label: 'Procurement' },
   { value: 'product-management', label: 'Product Management' },
   { value: 'project-management', label: 'Project Management' },
   { value: 'quality-assurance', label: 'Quality Assurance' },
   { value: 'research-development', label: 'Research & Development' },
   { value: 'retail-sales-assistant', label: 'Retail Sales Assistant' },
   { value: 'sales-business-development', label: 'Sales & Business Development' },
   { value: 'security', label: 'Security' },
   { value: 'software-development', label: 'Software Development' },
   { value: 'system-network-admin', label: 'System & Network Administration' },
   { value: 'trade-artisan', label: 'Trade & Artisan' },
   { value: 'writing-content', label: 'Writing & Content' },
   { value: 'other', label: 'Other' },
];

const PROVINCE_OPTIONS = [
   { value: 'ec', label: 'Eastern Cape' },
   { value: 'fs', label: 'Free State' },
   { value: 'gp', label: 'Gauteng' },
   { value: 'kzn', label: 'KwaZulu-Natal' },
   { value: 'lp', label: 'Limpopo' },
   { value: 'mp', label: 'Mpumalanga' },
   { value: 'nc', label: 'Northern Cape' },
   { value: 'nw', label: 'North West' },
   { value: 'wc', label: 'Western Cape' },
];

const EXPERIENCE_LEVEL_OPTIONS = [
   { value: 'internship', label: 'Internship / Learnership' },
   { value: 'entry-level', label: 'Entry Level (0-1 years)' },
   { value: 'junior', label: 'Junior (1-2 years)' },
   { value: 'mid-level', label: 'Mid-Level (3-5 years)' },
   { value: 'senior', label: 'Senior (5-8 years)' },
   { value: 'lead', label: 'Lead (8+ years)' },
   { value: 'manager', label: 'Manager' },
   { value: 'director', label: 'Director / Head of Department' },
   { value: 'executive', label: 'Executive (C-Suite)' },
];

const QUALIFICATION_OPTIONS = [
   { value: 'none', label: 'No Formal Qualification' },
   { value: 'grade10', label: 'Grade 10' },
   { value: 'grade12-matric', label: 'Grade 12 / Matric' },
   { value: 'certificate', label: 'Certificate' },
   { value: 'higher-certificate', label: 'Higher Certificate' },
   { value: 'national-diploma', label: 'National Diploma' },
   { value: 'advanced-diploma', label: 'Advanced Diploma' },
   { value: 'bachelors-degree', label: "Bachelor's Degree" },
   { value: 'btech', label: 'BTech' },
   { value: 'postgraduate-diploma', label: 'Postgraduate Diploma' },
   { value: 'honours', label: 'Honours Degree' },
   { value: 'masters', label: "Master's Degree" },
   { value: 'doctorate', label: 'Doctorate (PhD)' },
   { value: 'professional-certification', label: 'Professional Certification' },
   { value: 'trade-test', label: 'Trade Test / Artisan Qualification' },
];

export default function PostJob() {
  const navigate = useNavigate();
  const [step, setStep] = useState(1);
  const [submitting, setSubmitting] = useState(false);
   const [screeningQuestions, setScreeningQuestions] = useState<ScreeningQuestion[]>([
      { id: 1, prompt: '', duration: '1min' },
   ]);

  const { register, handleSubmit, getValues, setValue, watch, formState: { errors } } = useForm<PostJobFormValues>({
    defaultValues: { hide_salary: false, positions: 1, interview_type: 'video' }
  });

   const selectedInterviewType = watch('interview_type') || 'video';

   const addScreeningQuestion = () => {
      setScreeningQuestions((prev) => [
         ...prev,
         { id: Date.now(), prompt: '', duration: '1min' },
      ]);
   };

   const removeScreeningQuestion = (id: number) => {
      setScreeningQuestions((prev) => (prev.length > 1 ? prev.filter((q) => q.id !== id) : prev));
   };

   const updateScreeningQuestion = (id: number, patch: Partial<ScreeningQuestion>) => {
      setScreeningQuestions((prev) => prev.map((q) => (q.id === id ? { ...q, ...patch } : q)));
   };

  const onPublish = async (data: PostJobFormValues) => {
    setSubmitting(true);
    try {
      const requirementsArr = data.requirements
        ? data.requirements.split('\n').filter(Boolean)
        : [];
      const benefitsArr = data.benefits
        ? data.benefits.split('\n').filter(Boolean)
        : [];
         const normalizedScreeningQuestions = screeningQuestions
            .map((question) => ({
               id: question.id,
               prompt: String(question.prompt || '').trim(),
               duration: question.duration,
            }))
            .filter((question) => question.prompt.length > 0);

      await apiCall('/jobs', {
        method: 'POST',
        body: JSON.stringify({
          title: data.title,
          industry: data.industry,
          category: data.category,
          employment_type: data.employment_type,
          work_location: data.work_location,
          province: data.province,
          city: data.city,
          salary_min: data.salary_min ? Number(data.salary_min) : null,
          salary_max: data.salary_max ? Number(data.salary_max) : null,
          description: data.description,
          requirements: requirementsArr,
          benefits: benefitsArr,
          interview_type: data.interview_type,
               screening_questions: normalizedScreeningQuestions,
        }),
      });

      toast.success('Job posted successfully!');
      navigate('/employer/listings');
    } catch (error: any) {
      toast.error(error.message || 'Failed to post job');
    } finally {
      setSubmitting(false);
    }
  };
  
  const steps = [
    { id: 1, label: 'Job Details' },
    { id: 2, label: 'Description & Requirements' },
    { id: 3, label: 'Interview Setup' },
    { id: 4, label: 'Preview & Publish' },
  ];

  return (
      <div className="max-w-4xl mx-auto space-y-6 sm:space-y-8 pb-16 sm:pb-20">
      
      {/* Header */}
         <h1 className="text-2xl sm:text-3xl font-bold text-[#0A2540]">Post a New Job</h1>
      
      {/* Stepper */}
         <div className="overflow-x-auto pb-1">
            <div className="relative flex min-w-[640px] items-center justify-between">
               <div className="absolute left-0 right-0 top-1/2 h-1 bg-gray-200 -z-10 rounded-full"></div>
               <div 
                  className="absolute left-0 top-1/2 h-1 bg-[#00C853] -z-10 rounded-full transition-all duration-300"
                  style={{ width: `${((step - 1) / (steps.length - 1)) * 100}%` }}
               ></div>
               {steps.map((s) => (
                  <div key={s.id} className="flex flex-col items-center gap-2 bg-[#F5F7FA] px-2 z-10">
                     <div className={`
                        w-9 h-9 sm:w-10 sm:h-10 rounded-full flex items-center justify-center font-bold text-sm transition-colors border-2
                        ${step >= s.id 
                           ? 'bg-[#00C853] border-[#00C853] text-white' 
                           : 'bg-white border-gray-300 text-gray-400'}
                     `}>
                        {step > s.id ? <Check className="w-4 h-4 sm:w-5 sm:h-5" /> : s.id}
                     </div>
                     <span className={`text-[10px] sm:text-xs font-semibold whitespace-nowrap ${step >= s.id ? 'text-[#0A2540]' : 'text-gray-400'}`}>
                        {s.label}
                     </span>
                  </div>
               ))}
            </div>
      </div>

      {/* Form Content */}
      <Card className="border-none shadow-lg">
            <CardContent className="p-4 sm:p-6 lg:p-8">
          
          {/* STEP 1: Job Details */}
          {step === 1 && (
            <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4">
              <h2 className="text-xl font-bold text-[#0A2540] border-b pb-4">Step 1: Job Details</h2>
              
                     <div className="grid grid-cols-1 md:grid-cols-2 gap-4 sm:gap-6">
                        <div className="space-y-2 md:col-span-2">
                   <Label>Job Title *</Label>
                   <Input placeholder="e.g. Senior Software Engineer" className="text-lg font-medium" {...register('title', { required: 'Job Title is required' })} />
                   {errors.title && <p className="text-red-500 text-sm">{errors.title.message}</p>}
                </div>
                
                <div className="space-y-2">
                   <Label>Industry</Label>
                   <Select onValueChange={(v) => setValue('industry', v)}>
                      <SelectTrigger>
                         <SelectValue placeholder="Select Industry" />
                      </SelectTrigger>
                      <SelectContent>
                         {INDUSTRY_OPTIONS.map((option) => (
                           <SelectItem key={option.value} value={option.value}>{option.label}</SelectItem>
                         ))}
                      </SelectContent>
                   </Select>
                </div>

                <div className="space-y-2">
                   <Label>Job Category</Label>
                   <Select onValueChange={(v) => setValue('category', v)}>
                      <SelectTrigger>
                         <SelectValue placeholder="Select Category" />
                      </SelectTrigger>
                      <SelectContent>
                         {JOB_CATEGORY_OPTIONS.map((option) => (
                           <SelectItem key={option.value} value={option.value}>{option.label}</SelectItem>
                         ))}
                      </SelectContent>
                   </Select>
                </div>

                <div className="space-y-2">
                   <Label>Employment Type</Label>
                   <Select onValueChange={(v) => setValue('employment_type', v)}>
                      <SelectTrigger>
                         <SelectValue placeholder="Select Type" />
                      </SelectTrigger>
                      <SelectContent>
                         <SelectItem value="full-time">Full-time</SelectItem>
                         <SelectItem value="part-time">Part-time</SelectItem>
                         <SelectItem value="contract">Contract</SelectItem>
                         <SelectItem value="internship">Internship</SelectItem>
                      </SelectContent>
                   </Select>
                </div>

                <div className="space-y-2">
                   <Label>Work Location</Label>
                   <Select onValueChange={(v) => setValue('work_location', v)}>
                      <SelectTrigger>
                         <SelectValue placeholder="Select Location Type" />
                      </SelectTrigger>
                      <SelectContent>
                         <SelectItem value="onsite">On-site</SelectItem>
                         <SelectItem value="hybrid">Hybrid</SelectItem>
                         <SelectItem value="remote">Remote</SelectItem>
                      </SelectContent>
                   </Select>
                </div>

                <div className="space-y-2">
                    <Label>Province</Label>
                    <Select onValueChange={(v) => setValue('province', v)}>
                      <SelectTrigger>
                         <SelectValue placeholder="Select Province" />
                      </SelectTrigger>
                      <SelectContent>
                         {PROVINCE_OPTIONS.map((option) => (
                           <SelectItem key={option.value} value={option.value}>{option.label}</SelectItem>
                         ))}
                      </SelectContent>
                   </Select>
                </div>

                <div className="space-y-2">
                   <Label>City</Label>
                   <Input placeholder="e.g. Cape Town" {...register('city')} />
                </div>
                
               <div className="space-y-2 md:col-span-2">
                    <Label>Salary Range (ZAR)</Label>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
                       <Input type="number" placeholder="Min (e.g. 15000)" {...register('salary_min')} />
                       <Input type="number" placeholder="Max (e.g. 25000)" {...register('salary_max')} />
                    </div>
                    <div className="flex items-center space-x-2 mt-2">
                       <Switch id="hide-salary" onCheckedChange={(v) => setValue('hide_salary', v)} />
                       <Label htmlFor="hide-salary" className="font-normal text-gray-600">Don't display salary to candidates</Label>
                    </div>
                </div>

                <div className="space-y-2">
                    <Label>Application Deadline</Label>
                    <Input type="date" {...register('deadline')} />
                </div>

              </div>
            </div>
          )}

          {/* STEP 2: Description */}
          {step === 2 && (
            <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4">
              <h2 className="text-xl font-bold text-[#0A2540] border-b pb-4">Step 2: Description & Requirements</h2>
              
              <div className="space-y-4">
                 <div className="space-y-2">
                    <Label>Job Description *</Label>
                    <Textarea placeholder="Describe the role, responsibilities..." className="min-h-[200px]" {...register('description', { required: 'Description is required' })} />
                    {errors.description && <p className="text-red-500 text-sm">{errors.description.message}</p>}
                 </div>
                 
                 <div className="space-y-2">
                    <Label>Requirements (one per line)</Label>
                    <Textarea placeholder="List qualifications, experience, skills..." className="min-h-[150px]" {...register('requirements')} />
                 </div>

                 <div className="space-y-2">
                    <Label>Benefits (one per line, Optional)</Label>
                    <Textarea placeholder="Medical aid, pension..." className="min-h-[100px]" {...register('benefits')} />
                 </div>

                 <div className="grid grid-cols-1 md:grid-cols-2 gap-4 sm:gap-6 pt-4">
                    <div className="space-y-2">
                       <Label>Experience Level</Label>
                       <Select onValueChange={(v) => setValue('experience_level', v)}>
                          <SelectTrigger>
                             <SelectValue placeholder="Select Level" />
                          </SelectTrigger>
                          <SelectContent>
                             {EXPERIENCE_LEVEL_OPTIONS.map((option) => (
                               <SelectItem key={option.value} value={option.value}>{option.label}</SelectItem>
                             ))}
                          </SelectContent>
                       </Select>
                    </div>

                    <div className="space-y-2">
                       <Label>Minimum Qualification</Label>
                       <Select onValueChange={(v) => setValue('qualification', v)}>
                          <SelectTrigger>
                             <SelectValue placeholder="Select Qualification" />
                          </SelectTrigger>
                          <SelectContent>
                             {QUALIFICATION_OPTIONS.map((option) => (
                               <SelectItem key={option.value} value={option.value}>{option.label}</SelectItem>
                             ))}
                          </SelectContent>
                       </Select>
                    </div>

                    <div className="space-y-2">
                       <Label>Positions Available</Label>
                       <Input type="number" {...register('positions', { valueAsNumber: true })} />
                    </div>
                 </div>
              </div>
            </div>
          )}

          {/* STEP 3: Interview Setup */}
          {step === 3 && (
            <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4">
              <h2 className="text-xl font-bold text-[#0A2540] border-b pb-4">Step 3: Interview Setup</h2>
              
              <p className="text-gray-600 mb-4">How would you like to screen candidates?</p>
              
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
                 <div
                    className={`border rounded-xl p-4 hover:border-[#00C853] cursor-pointer transition-colors ${
                      selectedInterviewType === 'standard'
                        ? 'bg-blue-50/50 border-blue-300 ring-2 ring-blue-200'
                        : 'bg-white border-gray-200'
                    }`}
                    onClick={() => setValue('interview_type', 'standard', { shouldDirty: true })}
                 >
                    <div className="p-2 bg-blue-100 rounded-lg w-fit mb-3 text-blue-700">
                       <Building2 className="w-5 h-5" />
                    </div>
                    <h3 className="font-bold text-[#0A2540] mb-1">Standard Apply</h3>
                    <p className="text-xs text-gray-500">CV + Cover Letter only. Manual review.</p>
                 </div>

                 <div
                    className={`border rounded-xl p-4 hover:border-[#00C853] cursor-pointer transition-colors ${
                      selectedInterviewType === 'live'
                        ? 'bg-purple-50/50 border-purple-300 ring-2 ring-purple-200'
                        : 'bg-white border-gray-200'
                    }`}
                    onClick={() => setValue('interview_type', 'live', { shouldDirty: true })}
                 >
                    <div className="p-2 bg-purple-100 rounded-lg w-fit mb-3 text-purple-700">
                       <Video className="w-5 h-5" />
                    </div>
                    <h3 className="font-bold text-[#0A2540] mb-1">Live Interview</h3>
                    <p className="text-xs text-gray-500">Schedule video calls directly.</p>
                 </div>

                 <div
                    className={`rounded-xl p-4 cursor-pointer relative transition-colors ${
                      selectedInterviewType === 'video'
                        ? 'border-2 border-[#00C853] bg-green-50/30 ring-2 ring-green-100'
                        : 'border border-gray-200 bg-white hover:border-[#00C853]'
                    }`}
                    onClick={() => setValue('interview_type', 'video', { shouldDirty: true })}
                 >
                    {selectedInterviewType === 'video' && <div className="absolute top-2 right-2 text-yellow-500">★</div>}
                    <div className="p-2 bg-green-100 rounded-lg w-fit mb-3 text-green-700">
                       <CheckCircle className="w-5 h-5" />
                    </div>
                    <h3 className="font-bold text-[#0A2540] mb-1">Video Assessment</h3>
                    <p className="text-xs text-gray-500">Candidates record answers. Review anytime.</p>
                 </div>
              </div>

              <div className="space-y-4 border-t pt-6">
                 <h3 className="font-bold text-[#0A2540]">Screening Questions</h3>
                 {selectedInterviewType === 'standard' ? (
                   <p className="text-sm text-gray-500 bg-gray-50 border rounded-lg p-3">
                     Standard Apply selected — screening questions are optional and are typically used with Live Interview or Video Assessment.
                   </p>
                 ) : null}

                 <div className="space-y-3">
                    {screeningQuestions.map((question, index) => (
                      <div key={question.id} className="flex flex-col sm:flex-row gap-3 sm:gap-4">
                         <Input
                           placeholder={`Question ${index + 1} (e.g. Tell us about yourself)`}
                           className="flex-1"
                           value={question.prompt}
                           onChange={(e) => updateScreeningQuestion(question.id, { prompt: e.target.value })}
                         />
                         <Select
                           value={question.duration}
                           onValueChange={(v: ScreeningQuestion['duration']) => updateScreeningQuestion(question.id, { duration: v })}
                         >
                            <SelectTrigger className="w-full sm:w-[130px]">
                               <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                               <SelectItem value="1min">1 min</SelectItem>
                               <SelectItem value="2min">2 min</SelectItem>
                               <SelectItem value="3min">3 min</SelectItem>
                            </SelectContent>
                         </Select>
                         <Button
                           type="button"
                           variant="ghost"
                           size="icon"
                           onClick={() => removeScreeningQuestion(question.id)}
                           disabled={screeningQuestions.length === 1}
                           className="self-end sm:self-auto text-red-500 hover:bg-red-50 disabled:text-gray-300"
                         >
                           ×
                         </Button>
                      </div>
                    ))}
                 </div>
                 <Button
                   type="button"
                   variant="outline"
                   onClick={addScreeningQuestion}
                   className="border-dashed border-gray-300 text-gray-500 hover:text-[#00C853] hover:border-[#00C853]"
                 >
                    + Add Question
                 </Button>
              </div>
            </div>
          )}
          
          {/* STEP 4: Preview */}
          {step === 4 && (() => {
            const preview = getValues();
            const reqLines = preview.requirements ? preview.requirements.split('\n').filter(Boolean) : [];
            return (
            <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4">
              <h2 className="text-xl font-bold text-[#0A2540] border-b pb-4">Step 4: Preview & Publish</h2>
              
              <div className="bg-gray-50 p-4 sm:p-6 rounded-xl border border-gray-200">
                 <div className="flex flex-col gap-4 sm:flex-row sm:justify-between sm:items-start mb-4">
                    <div>
                       <h1 className="text-xl sm:text-2xl font-bold text-[#0A2540]">{preview.title || 'Untitled Job'}</h1>
                       <div className="flex gap-2 mt-2 flex-wrap">
                          {preview.employment_type && <Badge variant="secondary">{preview.employment_type}</Badge>}
                          {preview.work_location && <Badge variant="secondary">{preview.work_location}</Badge>}
                          {preview.city && <Badge variant="secondary">{preview.city}</Badge>}
                          {preview.province && <Badge variant="secondary">{preview.province}</Badge>}
                       </div>
                    </div>
                    <Button disabled className="bg-gray-300 text-white w-full sm:w-auto">Apply Now</Button>
                 </div>
                 <div className="prose max-w-none text-gray-600 space-y-4">
                    {preview.description && <p>{preview.description}</p>}
                    {reqLines.length > 0 && (
                      <>
                        <p><strong>Requirements:</strong></p>
                        <ul className="list-disc pl-5">{reqLines.map((r, i) => <li key={i}>{r}</li>)}</ul>
                      </>
                    )}
                    {!preview.hide_salary && (preview.salary_min || preview.salary_max) && (
                      <p><strong>Salary:</strong> R{preview.salary_min || 0} – R{preview.salary_max || 0} pm</p>
                    )}
                 </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 pt-6">
                 {/* Boost Options */}
                 <Card className="border-2 border-gray-100 hover:border-[#00C853] cursor-pointer transition-all">
                    <CardContent className="p-4 text-center">
                       <h3 className="font-bold text-[#0A2540] mb-2">Standard</h3>
                       <p className="text-2xl font-bold text-[#0A2540] mb-2">Free</p>
                       <p className="text-xs text-gray-500 mb-4">Standard placement</p>
                       <Button variant="outline" className="w-full">Select</Button>
                    </CardContent>
                 </Card>

                 <Card className="border-2 border-[#00C853] bg-green-50/10 cursor-pointer relative shadow-lg md:transform md:scale-105">
                    <div className="absolute top-0 left-1/2 -translate-x-1/2 -translate-y-1/2 bg-[#00C853] text-white text-[10px] font-bold px-2 py-0.5 rounded-full uppercase tracking-wide">Most Popular</div>
                    <CardContent className="p-4 text-center">
                       <h3 className="font-bold text-[#0A2540] mb-2">Featured</h3>
                       <p className="text-2xl font-bold text-[#00C853] mb-2">R299</p>
                       <p className="text-xs text-gray-500 mb-4">Top of search for 14 days</p>
                       <Button className="w-full bg-[#00C853] hover:bg-[#00B548] text-white">Select</Button>
                    </CardContent>
                 </Card>

                 <Card className="border-2 border-gray-100 hover:border-[#0A2540] cursor-pointer transition-all">
                    <CardContent className="p-4 text-center">
                       <h3 className="font-bold text-[#0A2540] mb-2">Premium</h3>
                       <p className="text-2xl font-bold text-[#0A2540] mb-2">R599</p>
                       <p className="text-xs text-gray-500 mb-4">Homepage feature slot</p>
                       <Button variant="outline" className="w-full border-[#0A2540] text-[#0A2540]">Select</Button>
                    </CardContent>
                 </Card>
              </div>

            </div>
            );
          })()}

          {/* Navigation Buttons */}
          <div className="flex flex-col-reverse sm:flex-row gap-3 sm:justify-between pt-8 mt-8 border-t border-gray-100">
             <Button 
               type="button"
               variant="outline" 
               onClick={() => setStep(s => Math.max(1, s - 1))}
               disabled={step === 1}
               className="w-full sm:w-auto"
             >
                Back
             </Button>
             
             {step < 4 ? (
               <Button 
                 type="button"
                         className="bg-[var(--rf-green)] hover:bg-[#00B548] text-white px-8 w-full sm:w-auto"
                 onClick={handleSubmit(() => setStep(s => Math.min(4, s + 1)))}
               >
                  Save & Continue <ChevronRight className="w-4 h-4 ml-2" />
               </Button>
             ) : (
               <Button
                 type="button"
                 disabled={submitting}
                         className="bg-[var(--rf-green)] hover:bg-[#00B548] text-white px-8 shadow-lg shadow-green-500/30 w-full sm:w-auto"
                 onClick={handleSubmit(onPublish)}
               >
                 {submitting ? (
                   <><Loader2 className="w-4 h-4 mr-2 animate-spin" />Publishing...</>
                 ) : (
                   'Publish Listing 🎉'
                 )}
               </Button>
             )}
          </div>

        </CardContent>
      </Card>

    </div>
  );
}
