import { JobListing } from '@/types';
import { IJobExtractor } from './IJobExtractor';
import { LinkedInExtractor } from './linkedin';
import { isValidJobListing, sanitizeJobListing } from '../../utils/validation';
import { Logger } from '@/utils/logger';

const extractorLogger = new Logger('Extractors');

const extractors: IJobExtractor[] = [new LinkedInExtractor()];

/**
 * Main extractor function that determines which extractor to use
 */
export function extractJobData(): JobListing | null {
  const currentUrl = window.location.href;

  for (const extractor of extractors) {
    if (extractor.canExtract(currentUrl)) {
      try {
        const jobData = extractor.extract(document);

        if (jobData && isValidJobListing(jobData)) {
          return sanitizeJobListing(jobData);
        } else {
          extractorLogger.warn('Extracted job data failed validation', {
            jobData,
          });
          return null;
        }
      } catch (error) {
        extractorLogger.error(
          `Error in ${extractor.siteName} extractor`,
          error
        );
        return null;
      }
    }
  }

  return null;
}

/**
 * Check if current page is a supported job listing
 */
export function isSupportedJobPage(): boolean {
  const currentUrl = window.location.href;
  return extractors.some(extractor => extractor.canExtract(currentUrl));
}
