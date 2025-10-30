import { JobListing } from '@/types';
import { IJobReader } from './IJobReader';
import { cleanUrl } from '../../utils/validation';
import { Logger } from '@/utils/logger';

export class LinkedInJobReader implements IJobReader {
  siteName = 'LinkedIn';
  private logger = new Logger('LinkedInJobReader');

  canRead(url: string): boolean {
    if (url.includes('linkedin.com/jobs/view/')) return true;

    if (url.includes('linkedin.com')) {
      const hasJobElements = !!(
        document.querySelector('[data-view-name="job-detail-page"]') ||
        document.querySelector('[data-view-name="job-card"]') ||
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
    const container = doc.querySelector('[data-view-name="job-detail-page"]');

    if (!container) {
      this.logger.warn(
        'Job detail page container not found, trying legacy selectors'
      );
      return this.readFromDOMLegacy(doc, url);
    }

    const title = this.extractTitleByClass(doc) || 'Unknown Position';
    const company = this.extractCompanyByClass(doc) || 'Unknown Company';
    const location = this.extractLocationByClass(doc) || 'Unknown Location';
    const description = this.extractDescription(doc);

    return {
      title,
      company,
      location,
      description: this.getDescriptionOrFallback(
        description,
        title,
        company,
        location
      ),
      sourceUrl: cleanUrl(url),
      jobType: this.determineJobTypeSmart(doc),
    };
  }

  private extractTitleByClass(doc: Document): string {
    const titleSelectors = [
      '.job-details-jobs-unified-top-card__job-title',
      '.jobs-unified-top-card__job-title',
      'h1.jobs-unified-top-card__job-title',
      '.top-card-layout__title',
      '.topcard__title',
      '[data-view-name="job-detail-page"] h1:first-of-type',
      '.job-view-layout h1',
      'main h1:first-of-type',
      'h1:first-of-type',
    ];

    for (const selector of titleSelectors) {
      const element = doc.querySelector(selector);
      if (element) {
        const text = this.getText(element);
        if (
          text.length >= 5 &&
          text.length <= 150 &&
          !text.toLowerCase().includes('about the') &&
          !text.toLowerCase().includes('unlock') &&
          !text.toLowerCase().includes('application status')
        ) {
          return text;
        }
      }
    }
    return '';
  }

  private extractCompanyByClass(doc: Document): string {
    const companySelectors = [
      '[data-view-name="job-detail-page"] a[href*="/company/"]:first-of-type',
      '.job-details-jobs-unified-top-card__company-name',
      '.jobs-unified-top-card__company-name',
    ];

    for (const selector of companySelectors) {
      const element = doc.querySelector(selector);
      if (element) {
        const text = this.getText(element);
        if (text.length >= 2 && text.length <= 100) {
          return text;
        }
      }
    }
    return '';
  }

  private extractLocationByClass(doc: Document): string {
    const locationSelectors = [
      '.job-details-jobs-unified-top-card__bullet',
      '.jobs-unified-top-card__bullet',
      '[data-view-name="job-detail-page"] .jobs-unified-top-card__primary-description',
    ];

    for (const selector of locationSelectors) {
      const element = doc.querySelector(selector);
      if (element) {
        const text = this.getText(element);
        if (text.length >= 2 && text.length <= 100) {
          return text;
        }
      }
    }
    return '';
  }

  private extractDescription(doc: Document): string {
    const container = doc.querySelector('[data-view-name="job-detail-page"]');
    if (!container) {
      // Try legacy selectors
      const legacyDesc =
        this.getText(doc.querySelector('.jobs-description__content')) ||
        this.getText(doc.querySelector('.jobs-description-content__text'));
      return this.cleanupDescription(legacyDesc);
    }

    const allDivs = container.querySelectorAll('div');
    let bestCandidate = '';
    let bestScore = 0;

    allDivs.forEach(el => {
      const text = this.getText(el);

      // Skip if too short or too long
      if (text.length < 200 || text.length > 10000) return;

      // Skip if it contains company or job listing sections
      if (
        text.includes('About the company') ||
        text.includes('More jobs') ||
        text.includes('Similar jobs') ||
        text.includes('followersFollow') ||
        text.includes('People also viewed')
      ) {
        return;
      }

      let score = 0;

      // Starts with "About the job" is a strong indicator
      if (text.startsWith('About the job')) {
        score += 100;
      }

      // Contains job description keywords
      const keywords = [
        'responsibilities',
        'requirements',
        'qualifications',
        'experience',
        'skills',
        'role',
        'position',
        'required',
        'preferred',
        'looking for',
        'seeking',
        'will be',
        'you will',
        'must have',
        'should have',
      ];

      keywords.forEach(keyword => {
        if (text.toLowerCase().includes(keyword)) {
          score += 5;
        }
      });

      // Optimal length range
      if (text.length >= 500 && text.length <= 5000) {
        score += 10;
      }

      // Prefer leaf-ish elements (not deep containers)
      const childDivs = el.querySelectorAll('div');
      if (childDivs.length < 5) {
        score += 10;
      }

      if (score > bestScore) {
        bestScore = score;
        bestCandidate = text;
      }
    });

    return this.cleanupDescription(bestCandidate);
  }

  private determineJobTypeSmart(
    doc: Document
  ): JobListing['jobType'] | undefined {
    // Get all visible text content
    const bodyText = doc.body.textContent?.toLowerCase() || '';

    // Job type indicators with patterns
    const typePatterns = {
      full_time: ['full-time', 'full time', 'fulltime', 'permanent'],
      part_time: ['part-time', 'part time', 'parttime'],
      contract: ['contract', 'contractor', 'fixed-term', 'temporary', 'temp'],
      intern: ['intern', 'internship', 'co-op', 'coop'],
      freelance: [
        'freelance',
        'freelancer',
        'consultant',
        'independent contractor',
      ],
      remote: [
        'remote',
        'work from home',
        'wfh',
        'fully remote',
        '100% remote',
      ],
    };

    // Score each type
    const scores: Record<string, number> = {};

    for (const [type, patterns] of Object.entries(typePatterns)) {
      scores[type] = 0;
      patterns.forEach(pattern => {
        const regex = new RegExp(`\\b${pattern}\\b`, 'gi');
        const matches = bodyText.match(regex);
        if (matches) {
          scores[type] += matches.length;
        }
      });
    }

    // Find the type with highest score
    const maxScore = Math.max(...Object.values(scores));
    if (maxScore === 0) return undefined;

    const detectedType = Object.entries(scores).find(
      ([, score]) => score === maxScore
    )?.[0];

    return detectedType as JobListing['jobType'];
  }

  private readFromDOMLegacy(doc: Document, url: string): JobListing | null {
    const title =
      this.getText(
        doc.querySelector('.job-details-jobs-unified-top-card__job-title') ||
          doc.querySelector('.jobs-unified-top-card__job-title')
      ) || 'Unknown Position';

    const company =
      this.getText(
        doc.querySelector('.job-details-jobs-unified-top-card__company-name') ||
          doc.querySelector('.jobs-unified-top-card__company-name')
      ) || 'Unknown Company';

    const location =
      this.getText(
        doc.querySelector('.job-details-jobs-unified-top-card__bullet') ||
          doc.querySelector('.jobs-unified-top-card__bullet')
      ) || 'Unknown Location';

    const description = this.cleanupDescription(
      this.getText(
        doc.querySelector('.jobs-description__content') ||
          doc.querySelector('.jobs-description-content__text')
      )
    );

    return {
      title,
      company,
      location,
      description: this.getDescriptionOrFallback(
        description,
        title,
        company,
        location
      ),
      sourceUrl: cleanUrl(url),
      jobType: this.determineJobTypeSmart(doc),
    };
  }

  private getDescriptionOrFallback(
    description: string,
    title: string,
    company: string,
    location: string
  ): string {
    return description && description.trim().length > 0
      ? description
      : `${title} at ${company}\nLocation: ${location}\n\nNo detailed description available. Please visit the source URL for more information.`;
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
}
