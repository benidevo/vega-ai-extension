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
  notes?: string;
}