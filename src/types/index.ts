/**
 * Job listing data interface
 */
export interface JobListing {
  title: string;
  company: string;
  location: string;
  description: string;
  jobType?: 'full_time' | 'part_time' | 'contract' | 'intern' | 'remote' | 'freelance';
  applicationUrl?: string;
  sourceUrl: string;
  skills?: string[];
  experienceLevel?: string;
  notes?: string;
  status?: 'applied' | 'interested';
}

/**
 * User profile interface
 */
export interface UserProfile {
  id: string;
  name: string;
  email: string;
  avatar?: string;
}