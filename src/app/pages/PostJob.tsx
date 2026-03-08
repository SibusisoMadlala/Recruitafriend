import { useState } from 'react';
import { useNavigate, Link } from 'react-router';
import { useAuth } from '../context/AuthContext';
import { apiCall } from '../lib/supabase';
import { toast } from 'sonner';
import { ArrowLeft, ArrowRight, Loader2 } from 'lucide-react';

const steps = ['Job Details', 'Requirements', 'Interview Setup', 'Preview & Publish'];

export default function PostJob() {
  const navigate = useNavigate();
  const { profile } = useAuth();
  const [currentStep, setCurrentStep] = useState(0);
  const [loading, setLoading] = useState(false);
  
  const [formData, setFormData] = useState({
    title: '',
    industry: '',
    jobType: 'Full-time',
    location: '',
    remoteType: 'onsite',
    salaryMin: '',
    salaryMax: '',
    description: '',
    requirements: '',
    skills: '',
    experienceLevel: 'Mid Level',
  });

  const handleInputChange = (e: React.TargetEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  const handleNext = () => {
    if (currentStep < steps.length - 1) {
      setCurrentStep(currentStep + 1);
    }
  };

  const handleBack = () => {
    if (currentStep > 0) {
      setCurrentStep(currentStep - 1);
    }
  };

  const handleSubmit = async () => {
    setLoading(true);
    try {
      const jobData = {
        ...formData,
        company: profile?.name,
        salaryMin: parseInt(formData.salaryMin) || null,
        salaryMax: parseInt(formData.salaryMax) || null,
        skills: formData.skills.split(',').map(s => s.trim()).filter(Boolean),
      };

      await apiCall('/jobs', {
        method: 'POST',
        body: JSON.stringify(jobData),
      });

      toast.success('Job posted successfully!');
      navigate('/employer/dashboard');
    } catch (error: any) {
      toast.error(error.message || 'Failed to post job');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[var(--rf-bg)] py-8">
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
        <Link to="/employer/dashboard" className="flex items-center text-[var(--rf-green)] hover:underline mb-6">
          <ArrowLeft className="w-4 h-4 mr-2" />
          Back to Dashboard
        </Link>

        <div className="bg-white rounded-[var(--rf-radius-lg)] shadow-[var(--rf-card-shadow)] p-8">
          {/* Progress Indicator */}
          <div className="mb-8">
            <div className="flex items-center justify-between mb-4">
              {steps.map((step, index) => (
                <div key={step} className="flex items-center">
                  <div className={`flex items-center justify-center w-10 h-10 rounded-full ${
                    index <= currentStep ? 'bg-[var(--rf-green)] text-white' : 'bg-gray-200 text-gray-500'
                  }`}>
                    {index + 1}
                  </div>
                  {index < steps.length - 1 && (
                    <div className={`w-16 h-1 mx-2 ${
                      index < currentStep ? 'bg-[var(--rf-green)]' : 'bg-gray-200'
                    }`} />
                  )}
                </div>
              ))}
            </div>
            <div className="flex justify-between text-sm">
              {steps.map((step, index) => (
                <span key={step} className={`${index <= currentStep ? 'text-[var(--rf-navy)] font-semibold' : 'text-[var(--rf-muted)]'}`}>
                  {step}
                </span>
              ))}
            </div>
          </div>

          {/* Step 1: Job Details */}
          {currentStep === 0 && (
            <div className="space-y-4">
              <h2 className="text-2xl font-bold text-[var(--rf-navy)] mb-4">Job Details</h2>
              
              <div>
                <label className="block text-sm font-medium text-[var(--rf-text)] mb-2">Job Title *</label>
                <input
                  type="text"
                  name="title"
                  required
                  value={formData.title}
                  onChange={handleInputChange}
                  className="w-full border border-[var(--rf-border)] rounded-[var(--rf-radius-md)] px-4 py-2 focus:outline-none focus:ring-2 focus:ring-[var(--rf-green)]"
                  placeholder="e.g., Senior Software Developer"
                />
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-[var(--rf-text)] mb-2">Industry *</label>
                  <input
                    type="text"
                    name="industry"
                    required
                    value={formData.industry}
                    onChange={handleInputChange}
                    className="w-full border border-[var(--rf-border)] rounded-[var(--rf-radius-md)] px-4 py-2 focus:outline-none focus:ring-2 focus:ring-[var(--rf-green)]"
                    placeholder="e.g., IT & Tech"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-[var(--rf-text)] mb-2">Job Type *</label>
                  <select
                    name="jobType"
                    value={formData.jobType}
                    onChange={handleInputChange}
                    className="w-full border border-[var(--rf-border)] rounded-[var(--rf-radius-md)] px-4 py-2 focus:outline-none focus:ring-2 focus:ring-[var(--rf-green)]"
                  >
                    <option>Full-time</option>
                    <option>Part-time</option>
                    <option>Contract</option>
                    <option>Internship</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-[var(--rf-text)] mb-2">Location *</label>
                <input
                  type="text"
                  name="location"
                  required
                  value={formData.location}
                  onChange={handleInputChange}
                  className="w-full border border-[var(--rf-border)] rounded-[var(--rf-radius-md)] px-4 py-2 focus:outline-none focus:ring-2 focus:ring-[var(--rf-green)]"
                  placeholder="e.g., Johannesburg, Gauteng"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-[var(--rf-text)] mb-2">Work Type *</label>
                <div className="flex space-x-4">
                  {['onsite', 'remote', 'hybrid'].map((type) => (
                    <label key={type} className="flex items-center">
                      <input
                        type="radio"
                        name="remoteType"
                        value={type}
                        checked={formData.remoteType === type}
                        onChange={handleInputChange}
                        className="mr-2"
                      />
                      <span className="capitalize">{type}</span>
                    </label>
                  ))}
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-[var(--rf-text)] mb-2">Salary Min (ZAR)</label>
                  <input
                    type="number"
                    name="salaryMin"
                    value={formData.salaryMin}
                    onChange={handleInputChange}
                    className="w-full border border-[var(--rf-border)] rounded-[var(--rf-radius-md)] px-4 py-2"
                    placeholder="30000"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-[var(--rf-text)] mb-2">Salary Max (ZAR)</label>
                  <input
                    type="number"
                    name="salaryMax"
                    value={formData.salaryMax}
                    onChange={handleInputChange}
                    className="w-full border border-[var(--rf-border)] rounded-[var(--rf-radius-md)] px-4 py-2"
                    placeholder="50000"
                  />
                </div>
              </div>
            </div>
          )}

          {/* Step 2: Requirements */}
          {currentStep === 1 && (
            <div className="space-y-4">
              <h2 className="text-2xl font-bold text-[var(--rf-navy)] mb-4">Requirements</h2>
              
              <div>
                <label className="block text-sm font-medium text-[var(--rf-text)] mb-2">Job Description *</label>
                <textarea
                  name="description"
                  required
                  value={formData.description}
                  onChange={handleInputChange}
                  rows={6}
                  className="w-full border border-[var(--rf-border)] rounded-[var(--rf-radius-md)] px-4 py-2 focus:outline-none focus:ring-2 focus:ring-[var(--rf-green)]"
                  placeholder="Describe the role, responsibilities, and what the candidate will do..."
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-[var(--rf-text)] mb-2">Requirements</label>
                <textarea
                  name="requirements"
                  value={formData.requirements}
                  onChange={handleInputChange}
                  rows={4}
                  className="w-full border border-[var(--rf-border)] rounded-[var(--rf-radius-md)] px-4 py-2 focus:outline-none focus:ring-2 focus:ring-[var(--rf-green)]"
                  placeholder="List the requirements, qualifications, and experience needed..."
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-[var(--rf-text)] mb-2">Skills (comma-separated)</label>
                <input
                  type="text"
                  name="skills"
                  value={formData.skills}
                  onChange={handleInputChange}
                  className="w-full border border-[var(--rf-border)] rounded-[var(--rf-radius-md)] px-4 py-2 focus:outline-none focus:ring-2 focus:ring-[var(--rf-green)]"
                  placeholder="e.g., React, Node.js, TypeScript"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-[var(--rf-text)] mb-2">Experience Level</label>
                <select
                  name="experienceLevel"
                  value={formData.experienceLevel}
                  onChange={handleInputChange}
                  className="w-full border border-[var(--rf-border)] rounded-[var(--rf-radius-md)] px-4 py-2 focus:outline-none focus:ring-2 focus:ring-[var(--rf-green)]"
                >
                  <option>Entry Level</option>
                  <option>Mid Level</option>
                  <option>Senior Level</option>
                  <option>Executive</option>
                </select>
              </div>
            </div>
          )}

          {/* Step 3: Interview Setup */}
          {currentStep === 2 && (
            <div className="space-y-4">
              <h2 className="text-2xl font-bold text-[var(--rf-navy)] mb-4">Interview Setup</h2>
              <p className="text-[var(--rf-muted)] mb-6">How would you like to interview candidates?</p>
              
              <div className="space-y-3">
                <label className="block p-4 border-2 border-[var(--rf-border)] rounded-[var(--rf-radius-md)] cursor-pointer hover:border-[var(--rf-green)] transition-colors">
                  <input type="radio" name="interviewType" className="mr-3" defaultChecked />
                  <span className="font-semibold">📋 Standard Apply Only</span>
                  <p className="text-sm text-[var(--rf-muted)] ml-7 mt-1">Candidates apply with CV and cover letter</p>
                </label>
                
                <label className="block p-4 border-2 border-[var(--rf-border)] rounded-[var(--rf-radius-md)] cursor-pointer hover:border-[var(--rf-green)] transition-colors">
                  <input type="radio" name="interviewType" className="mr-3" />
                  <span className="font-semibold">📹 Live Video Interview</span>
                  <p className="text-sm text-[var(--rf-muted)] ml-7 mt-1">Schedule video interviews after reviewing applications</p>
                </label>
                
                <label className="block p-4 border-2 border-[var(--rf-border)] rounded-[var(--rf-radius-md)] cursor-pointer hover:border-[var(--rf-green)] transition-colors">
                  <input type="radio" name="interviewType" className="mr-3" />
                  <span className="font-semibold">🎬 On-Demand Video Assessment</span>
                  <p className="text-sm text-[var(--rf-muted)] ml-7 mt-1">Candidates record video answers to your questions</p>
                </label>
              </div>
            </div>
          )}

          {/* Step 4: Preview & Publish */}
          {currentStep === 3 && (
            <div className="space-y-4">
              <h2 className="text-2xl font-bold text-[var(--rf-navy)] mb-4">Preview & Publish</h2>
              
              <div className="border border-[var(--rf-border)] rounded-[var(--rf-radius-lg)] p-6 bg-gray-50">
                <h3 className="text-xl font-bold text-[var(--rf-navy)] mb-2">{formData.title || 'Job Title'}</h3>
                <p className="text-[var(--rf-muted)] mb-4">{profile?.name || 'Your Company'} • {formData.location || 'Location'}</p>
                <p className="text-[var(--rf-text)] whitespace-pre-line">{formData.description || 'Job description will appear here'}</p>
              </div>

              <div className="bg-[var(--rf-green)] bg-opacity-10 rounded-[var(--rf-radius-lg)] p-6">
                <h3 className="text-lg font-bold text-[var(--rf-navy)] mb-4">Choose Your Package</h3>
                <div className="space-y-3">
                  <label className="block p-4 bg-white border-2 border-[var(--rf-border)] rounded-[var(--rf-radius-md)] cursor-pointer hover:border-[var(--rf-green)] transition-colors">
                    <input type="radio" name="package" className="mr-3" defaultChecked />
                    <span className="font-semibold">FREE - Standard Listing</span>
                  </label>
                  
                  <label className="block p-4 bg-white border-2 border-[var(--rf-border)] rounded-[var(--rf-radius-md)] cursor-pointer hover:border-[var(--rf-green)] transition-colors">
                    <input type="radio" name="package" className="mr-3" />
                    <span className="font-semibold">GROWTH - R299 (Featured for 30 days)</span>
                  </label>
                  
                  <label className="block p-4 bg-white border-2 border-[var(--rf-border)] rounded-[var(--rf-radius-md)] cursor-pointer hover:border-[var(--rf-green)] transition-colors">
                    <input type="radio" name="package" className="mr-3" />
                    <span className="font-semibold">PREMIUM - R599 (Top of search results)</span>
                  </label>
                </div>
              </div>
            </div>
          )}

          {/* Navigation Buttons */}
          <div className="flex justify-between mt-8 pt-6 border-t border-[var(--rf-border)]">
            <button
              onClick={handleBack}
              disabled={currentStep === 0}
              className="px-6 py-2 border border-[var(--rf-border)] text-[var(--rf-text)] rounded-[var(--rf-radius-md)] hover:bg-gray-50 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Back
            </button>
            
            {currentStep < steps.length - 1 ? (
              <button
                onClick={handleNext}
                className="px-6 py-2 bg-[var(--rf-green)] text-white rounded-[var(--rf-radius-md)] hover:bg-[#00B548] transition-colors flex items-center"
              >
                Next
                <ArrowRight className="w-4 h-4 ml-2" />
              </button>
            ) : (
              <button
                onClick={handleSubmit}
                disabled={loading}
                className="px-6 py-2 bg-[var(--rf-green)] text-white rounded-[var(--rf-radius-md)] hover:bg-[#00B548] transition-colors disabled:opacity-50 flex items-center"
              >
                {loading ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    Publishing...
                  </>
                ) : (
                  'Publish Job'
                )}
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
