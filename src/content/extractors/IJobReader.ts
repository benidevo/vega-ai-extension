import { JobListing } from '@/types';

export interface IJobReader {
  canRead(url: string): boolean;
  readJobDetails(document: Document, url?: string): JobListing | null;
  siteName: string;
}
