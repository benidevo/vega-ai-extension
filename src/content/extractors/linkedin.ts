import { JobListing } from '@/types';
import { IJobReader } from './IJobReader';
import {
  cleanUrl,
  isValidJobListing,
  sanitizeJobListing,
} from '../../utils/validation';
import { Logger } from '@/utils/logger';

export class LinkedInJobReader implements IJobReader {
  siteName = 'LinkedIn';
  private logger = new Logger('LinkedInJobReader');

  canRead(url: string): boolean {
    if (url.includes('linkedin.com/jobs/view/')) return true;

    if (url.includes('linkedin.com')) {
      const hasJobElements = !!(
        document.querySelector('.jobs-unified-top-card') ||
        document.querySelector('.job-details-jobs-unified-top-card') ||
        document.querySelector('[data-job-id]')
      );
      return hasJobElements;
    }

    return false;
  }

  readJobDetails(document: Document, url?: string): JobListing | null {
    try {
      return this.readFromDOM(document, url || window.location.href);
    } catch (error) {
      this.logger.error('Error reading LinkedIn job data', error);
      return null;
    }
  }

  private readFromDOM(doc: Document, url: string): JobListing | null {
    const title = this.getText(
      doc.querySelector(
        '.job-details-jobs-unified-top-card__job-title, .jobs-unified-top-card__job-title, h1.jobs-unified-top-card__job-title'
      )
    );
    const company = this.getText(
      doc.querySelector(
        '.job-details-jobs-unified-top-card__company-name, .jobs-unified-top-card__company-name, .job-details-jobs-unified-top-card__primary-description a'
      )
    );

    const locationSelectors = [
      '.job-details-jobs-unified-top-card__primary-description-container span:nth-child(1)',
      '.jobs-unified-top-card__primary-description span',
      '[class*="job-details-jobs-unified-top-card__primary-description"]',
    ];

    let location = '';
    for (const selector of locationSelectors) {
      const element = doc.querySelector(selector);
      if (element) {
        const text = this.getText(element);
        if (
          text &&
          !text.includes('applicants') &&
          !text.includes('Easy Apply')
        ) {
          location =
            text
              .split('·')
              .map(s => s.trim())
              .find(s => s.length > 0) || text;
          break;
        }
      }
    }

    const description = this.cleanupDescription(
      this.getText(
        doc.querySelector(
          '.jobs-description__content, .jobs-description-content__text'
        )
      )
    );

    if (!title || !company) {
      return null;
    }

    const sourceUrl = cleanUrl(url);

    const jobListing: JobListing = {
      title,
      company,
      location: location || 'Unknown Location',
      description: description || '',
      sourceUrl,
      jobType: this.determineJobType(doc),
    };

    if (!isValidJobListing(jobListing)) {
      this.logger.error('Invalid job listing read', jobListing);
      return null;
    }

    return sanitizeJobListing(jobListing);
  }

  private getText(element: Element | null): string {
    return element?.textContent?.trim() || '';
  }

  private cleanupDescription(description: string): string {
    if (!description) return '';

    let cleaned = description.replace(/^About\s+the\s+job\s*/i, '').trim();
    // eslint-disable-next-line no-regex-spaces
    cleaned = cleaned.replace(/  /g, '\n');

    return cleaned;
  }

  private determineJobType(doc: Document): JobListing['jobType'] | undefined {
    const jobTypeSelectors = [
      '.job-details-jobs-unified-top-card__job-insight-view-model-secondary',
      '.jobs-unified-top-card__job-insight',
      '.jobs-details-top-card__job-info',
      '[class*="job-details"] span',
    ];

    let jobTypeText = '';
    for (const selector of jobTypeSelectors) {
      const elements = doc.querySelectorAll(selector);
      elements.forEach(element => {
        jobTypeText += ' ' + this.getText(element).toLowerCase();
      });
    }

    if (
      jobTypeText.includes('full-time') ||
      jobTypeText.includes('full time') ||
      jobTypeText.includes('fulltime')
    ) {
      return 'full_time';
    }
    if (
      jobTypeText.includes('part-time') ||
      jobTypeText.includes('part time') ||
      jobTypeText.includes('parttime')
    ) {
      return 'part_time';
    }
    if (
      jobTypeText.includes('contract') ||
      jobTypeText.includes('contractor') ||
      jobTypeText.includes('fixed-term')
    ) {
      return 'contract';
    }
    if (
      jobTypeText.includes('intern') ||
      jobTypeText.includes('internship') ||
      jobTypeText.includes('co-op')
    ) {
      return 'intern';
    }
    if (
      jobTypeText.includes('freelance') ||
      jobTypeText.includes('freelancer') ||
      jobTypeText.includes('consultant')
    ) {
      return 'freelance';
    }
    if (
      jobTypeText.includes('remote') ||
      jobTypeText.includes('work from home') ||
      jobTypeText.includes('wfh')
    ) {
      return 'remote';
    }

    return undefined;
  }
}
