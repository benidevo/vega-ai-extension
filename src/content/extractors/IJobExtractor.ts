import { JobListing } from '@/types';

/**
 * Interface for extracting job listings from web pages.
 * Implementations should define extraction logic for specific sites.
 */
export interface IJobExtractor {
  canExtract(url: string): boolean;
  extract(document: Document, url?: string): JobListing | null;
  siteName: string;
}
