/**
 * Job listing data interface
 */
export interface JobListing {
  title: string;
  company: string;
  location: string;
  description: string;
  url: string;
  source: string;
  extractedAt: string;
  salary?: string;
  requirements?: string[];
  interestLevel?: 'high' | 'medium' | 'low';
  notes?: string;
  savedAt?: string;
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