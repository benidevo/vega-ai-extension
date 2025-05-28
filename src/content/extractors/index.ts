import { JobListing } from '@/types';
import { IJobExtractor } from './IJobExtractor';
import { LinkedInExtractor } from './linkedin';
import { isValidJobListing, sanitizeJobListing } from '../../utils/validation';

const extractors: IJobExtractor[] = [
  new LinkedInExtractor()
];

/**
 * Main extractor function that determines which extractor to use
 */
export function extractJobData(): JobListing | null {
  const currentUrl = window.location.href;

  for (const extractor of extractors) {
    if (extractor.canExtract(currentUrl)) {
      console.log(`Using ${extractor.siteName} extractor`);

      try {
        const jobData = extractor.extract(document);

        if (jobData && isValidJobListing(jobData)) {
          return sanitizeJobListing(jobData);
        } else {
          console.warn('Ascentio: Extracted job data failed validation:', jobData);
          return null;
        }
      } catch (error) {
        console.error(`Ascentio: Error in ${extractor.siteName} extractor:`, error);
        return null;
      }
    }
  }

  console.log('No suitable extractor found for URL:', currentUrl);
  return null;
}

/**
 * Check if current page is a supported job listing
 */
export function isSupportedJobPage(): boolean {
  const currentUrl = window.location.href;
  return extractors.some(extractor => extractor.canExtract(currentUrl));
}