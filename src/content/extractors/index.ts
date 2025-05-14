import { JobListing } from '@/types';

/**
 * Detects which job site the user is currently on
 */
export function detectJobSite(url: string): string | null {
  if (url.includes('linkedin.com/jobs')) {
    return 'linkedin';
  } else if (url.includes('indeed.com/viewjob') || url.includes('indeed.com/job')) {
    return 'indeed';
  }
  return null;
}

/**
 * Main function to extract job data based on site
 */
export function extractJobData(site: string, doc: Document): JobListing | null {
  switch (site) {
    case 'linkedin':
      return extractLinkedInJobData(doc);
    case 'indeed':
      return extractIndeedJobData(doc);
    default:
      return null;
  }
}

/**
 * Extract LinkedIn job data
 */
function extractLinkedInJobData(doc: Document): JobListing {
  // Try structured data first
  const structuredData = extractStructuredData(doc);
  if (structuredData) return structuredData;
  
  // Fall back to DOM parsing
  const titleElement = doc.querySelector('.job-details-jobs-unified-top-card__job-title');
  const companyElement = doc.querySelector('.job-details-jobs-unified-top-card__company-name');
  const locationElement = doc.querySelector('.job-details-jobs-unified-top-card__bullet');
  const descriptionElement = doc.querySelector('.jobs-description__content');

  return {
    title: getText(titleElement) || 'Unknown Title',
    company: getText(companyElement) || 'Unknown Company',
    location: getText(locationElement) || 'Unknown Location',
    description: getText(descriptionElement) || '',
    url: window.location.href,
    source: 'linkedin',
    extractedAt: new Date().toISOString()
  };
}

/**
 * Extract Indeed job data
 */
function extractIndeedJobData(doc: Document): JobListing {
  // Try structured data first
  const structuredData = extractStructuredData(doc);
  if (structuredData) return structuredData;
  
  // Fall back to DOM parsing
  const titleElement = doc.querySelector('[data-testid="jobsearch-JobInfoHeader-title"]');
  const companyElement = doc.querySelector('[data-testid="inlineCompanyName"]');
  const locationElement = doc.querySelector('[data-testid="jobsearch-JobInfoHeader-companyLocation"]');
  const descriptionElement = doc.querySelector('#jobDescriptionText');

  return {
    title: getText(titleElement) || 'Unknown Title',
    company: getText(companyElement) || 'Unknown Company',
    location: getText(locationElement) || 'Unknown Location',
    description: getText(descriptionElement) || '',
    url: window.location.href,
    source: 'indeed',
    extractedAt: new Date().toISOString()
  };
}

/**
 * Extract structured data if available
 */
function extractStructuredData(doc: Document): JobListing | null {
  const scripts = doc.querySelectorAll('script[type="application/ld+json"]');
  for (const script of scripts) {
    try {
      const data = JSON.parse(script.textContent || '{}');
      if (data['@type'] === 'JobPosting') {
        return {
          title: data.title || '',
          company: data.hiringOrganization?.name || '',
          location: data.jobLocation?.address?.addressLocality || '',
          description: data.description || '',
          url: window.location.href,
          source: window.location.hostname.includes('linkedin') ? 'linkedin' : 'indeed',
          extractedAt: new Date().toISOString()
        };
      }
    } catch (e) {
      console.error('Error parsing structured data:', e);
    }
  }
  return null;
}

/**
 * Helper to safely get text content from elements
 */
function getText(element: Element | null): string {
  return element?.textContent?.trim() || '';
}