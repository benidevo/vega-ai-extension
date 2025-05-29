import { JobListing } from '@/types';

/**
 * Validates that a job listing contains the required fields
 * @param job - The job listing to validate
 * @returns True if valid, false otherwise
 */
export function isValidJobListing(job: Partial<JobListing>): job is JobListing {
  return !!(
    job.title &&
    job.company &&
    job.location &&
    typeof job.title === 'string' &&
    typeof job.company === 'string' &&
    typeof job.location === 'string' &&
    job.title.trim().length > 0 &&
    job.company.trim().length > 0 &&
    job.location.trim().length > 0
  );
}

/**
 * Sanitizes a job listing by trimming whitespace and ensuring data integrity
 * @param job - The job listing to sanitize
 * @returns The sanitized job listing
 */
export function sanitizeJobListing(job: JobListing): JobListing {
  return {
    ...job,
    title: job.title.trim(),
    company: job.company.trim(),
    location: job.location.trim(),
    description: (job.description || '').trim(),
    sourceUrl: job.sourceUrl.trim(),
    applicationUrl: job.applicationUrl?.trim(),
    notes: job.notes?.trim()
  };
}

/**
 * Cleans a URL by removing tracking parameters and ensuring it's valid
 * @param url - The URL to clean
 * @returns The cleaned URL
 */
export function cleanUrl(url: string): string {
  try {
    const urlObj = new URL(url);

    const trackingParams = [
      'utm_source', 'utm_medium', 'utm_campaign', 'utm_term', 'utm_content',
      'fbclid', 'gclid', 'msclkid', 'ref', 'refId', 'trk', 'trackingId',
      'WT.mc_id', 'pk_campaign', 'pk_source', 'pk_medium'
    ];

    trackingParams.forEach(param => {
      urlObj.searchParams.delete(param);
    });

    if (urlObj.hostname.includes('linkedin.com') && urlObj.pathname.includes('/jobs/view/')) {
      const pathParts = urlObj.pathname.split('/');
      const jobIdIndex = pathParts.indexOf('view') + 1;
      if (jobIdIndex > 0 && pathParts[jobIdIndex]) {
        return `${urlObj.origin}/jobs/view/${pathParts[jobIdIndex]}`;
      }
    }

    return urlObj.toString();
  } catch {
    return url;
  }
}