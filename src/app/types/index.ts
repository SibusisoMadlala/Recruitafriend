// Central TypeScript interfaces for RecruitFriend

export interface UserProfile {
  id: string;
  email: string;
  name: string;
  user_type: 'seeker' | 'employer' | 'admin';
  /** Legacy camelCase alias used by existing components */
  userType?: 'seeker' | 'employer' | 'admin';
  employer_status?: 'pending_review' | 'needs_info' | 'approved' | 'rejected' | 'suspended' | null;
  subscription: string;
  headline?: string;
  summary?: string;
  phone?: string;
  location?: string;
  avatar_url?: string;
  skills?: string[];
  experience?: ExperienceItem[];
  education?: EducationItem[];
  social_links?: SocialLinks;
  created_at?: string;
  updated_at?: string;
}

export interface ExperienceItem {
  id?: string;
  company: string;
  title: string;
  startDate: string;
  endDate?: string;
  current?: boolean;
  description?: string;
}

export interface EducationItem {
  id?: string;
  institution: string;
  degree: string;
  field?: string;
  startDate: string;
  endDate?: string;
}

export interface SocialLinks {
  linkedin?: string;
  github?: string;
  portfolio?: string;
  twitter?: string;
  video_introduction?: string;
}

export interface Job {
  id: string;
  employer_id: string;
  title: string;
  industry?: string;
  category?: string;
  employment_type?: string;
  work_location?: string;
  province?: string;
  city?: string;
  salary_min?: number;
  salary_max?: number;
  description?: string;
  requirements?: string[];
  benefits?: string[];
  interview_type?: string;
  status: 'active' | 'closed' | 'draft';
  views: number;
  created_at: string;
  updated_at?: string;
  employer?: Partial<UserProfile>;
}

export interface Application {
  id: string;
  job_id: string;
  seeker_id: string;
  cover_letter?: string;
  custom_letter?: string;
  status: 'applied' | 'viewed' | 'shortlisted' | 'interview' | 'offer' | 'rejected';
  notes?: string;
  created_at: string;
  updated_at?: string;
  /** Populated via join */
  job?: Partial<Job>;
  /** Populated via join */
  seeker?: Partial<UserProfile>;
  /** Flattened from join for convenience */
  job_title?: string;
  company?: string;
}

export interface SavedJob {
  id: string;
  seeker_id: string;
  job_id: string;
  created_at: string;
  job?: Job;
}

export interface EmployerStats {
  activeListings: number;
  totalApplications: number;
  shortlisted: number;
  interviewsToday: number;
  cvViews: number;
}

export interface JobAlert {
  id: string;
  seeker_id: string;
  keywords: string;
  location?: string;
  min_salary?: number;
  frequency: 'daily' | 'weekly' | 'immediately';
  types: string[];
  active: boolean;
  next_dispatch_at?: string | null;
  last_dispatched_at?: string | null;
  last_dispatch_status?: string | null;
  last_dispatch_error?: string | null;
  created_at: string;
  updated_at?: string;
}

export interface CVSettings {
  seeker_id?: string;
  template: 'classic' | 'modern' | 'bold';
  visibility: boolean;
  last_synced_at?: string | null;
  updated_at?: string;
}

export interface CVFile {
  id: string;
  seeker_id: string;
  file_name: string;
  file_size: number;
  created_at: string;
  updated_at: string;
}

export interface Referral {
  id: string;
  referrer_id: string;
  referee_email?: string;
  status: 'invited' | 'signed_up' | 'hired';
  invite_email_status?: 'not_sent' | 'pending' | 'sent' | 'failed' | null;
  invite_email_sent_at?: string | null;
  invite_email_last_error?: string | null;
  invite_email_attempt_count?: number;
  payout: number;
  created_at: string;
  updated_at?: string;
}

export interface PaginatedResponse<T> {
  data: T[];
  totalCount: number;
  page: number;
  limit: number;
}
