export interface JobListing {
  title: string;
  company: string;
  location: string;
  description: string;
  jobType?:
    | 'full_time'
    | 'part_time'
    | 'contract'
    | 'intern'
    | 'remote'
    | 'freelance';
  applicationUrl?: string;
  sourceUrl: string;
  notes?: string;
}

export interface AuthToken {
  access_token: string;
  refresh_token: string;
  expires_at: number;
}

export type AuthProviderType = 'password';
