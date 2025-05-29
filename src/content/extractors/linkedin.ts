import { JobListing } from '@/types';
import { IJobExtractor } from './IJobExtractor';
import { cleanUrl, isValidJobListing, sanitizeJobListing } from '../../utils/validation';

/**
 * Extracts job listing information from LinkedIn job pages.
 *
 * Implements the `IJobExtractor` interface to provide methods for detecting LinkedIn job URLs,
 * extracting job data from the DOM,
 * and mapping LinkedIn-specific fields to a normalized `JobListing` format.
 */
export class LinkedInExtractor implements IJobExtractor {
  siteName = 'LinkedIn';

  /**
   * Determines if the given URL points to a LinkedIn job view page.
   * @param url - The URL to check.
   * @returns True if the URL is a LinkedIn job view page, otherwise false.
   */
  canExtract(url: string): boolean {
    return url.includes('linkedin.com/jobs/view/');
  }

  /**
   * Extracts job listing information from a LinkedIn job document.
   * @param document - The HTML document to extract job data from.
   * @returns The extracted JobListing object, or null if extraction fails.
   */
  extract(document: Document): JobListing | null {
    try {
      return this.extractFromDOM(document);
    } catch (error) {
      console.error('Error extracting LinkedIn job data:', error);
      return null;
    }
  }

  private extractFromDOM(doc: Document): JobListing | null {
    const title = this.getText(doc.querySelector('.job-details-jobs-unified-top-card__job-title, .jobs-unified-top-card__job-title, h1.jobs-unified-top-card__job-title'));
    const company = this.getText(doc.querySelector('.job-details-jobs-unified-top-card__company-name, .jobs-unified-top-card__company-name, .job-details-jobs-unified-top-card__primary-description a'));

    const locationSelectors = [
      '.job-details-jobs-unified-top-card__primary-description-container span:nth-child(1)',
      '.jobs-unified-top-card__primary-description span',
      '[class*="job-details-jobs-unified-top-card__primary-description"]'
    ];

    let location = '';
    for (const selector of locationSelectors) {
      const element = doc.querySelector(selector);
      if (element) {
        const text = this.getText(element);
        // Extract location from text that might include other info
        if (text && !text.includes('applicants') && !text.includes('Easy Apply')) {
          location = text.split('·').map(s => s.trim()).find(s => s.length > 0) || text;
          break;
        }
      }
    }

    const description = this.getText(doc.querySelector('.jobs-description__content, .jobs-description-content__text'));

    if (!title || !company) {
      return null;
    }

    const sourceUrl = cleanUrl(window.location.href);

    const jobListing: JobListing = {
      title,
      company,
      location: location || 'Unknown Location',
      description: description || '',
      sourceUrl,
      jobType: this.extractJobType(doc),
    };

    if (!isValidJobListing(jobListing)) {
      console.error('Invalid job listing extracted:', jobListing);
      return null;
    }

    return sanitizeJobListing(jobListing);
  }

  private getText(element: Element | null): string {
    return element?.textContent?.trim() || '';
  }

  private extractJobType(doc: Document): JobListing['jobType'] | undefined {
    const jobTypeSelectors = [
      '.job-details-jobs-unified-top-card__job-insight-view-model-secondary',
      '.jobs-unified-top-card__job-insight',
      '.jobs-details-top-card__job-info',
      '[class*="job-details"] span'
    ];

    let jobTypeText = '';
    for (const selector of jobTypeSelectors) {
      const elements = doc.querySelectorAll(selector);
      elements.forEach(element => {
        jobTypeText += ' ' + this.getText(element).toLowerCase();
      });
    }

    if (jobTypeText.includes('full-time') || jobTypeText.includes('full time') || jobTypeText.includes('fulltime')) {
      return 'full_time';
    }
    if (jobTypeText.includes('part-time') || jobTypeText.includes('part time') || jobTypeText.includes('parttime')) {
      return 'part_time';
    }
    if (jobTypeText.includes('contract') || jobTypeText.includes('contractor') || jobTypeText.includes('fixed-term')) {
      return 'contract';
    }
    if (jobTypeText.includes('intern') || jobTypeText.includes('internship') || jobTypeText.includes('co-op')) {
      return 'intern';
    }
    if (jobTypeText.includes('freelance') || jobTypeText.includes('freelancer') || jobTypeText.includes('consultant')) {
      return 'freelance';
    }
    if (jobTypeText.includes('remote') || jobTypeText.includes('work from home') || jobTypeText.includes('wfh')) {
      return 'remote';
    }

    return undefined;
  }
}
