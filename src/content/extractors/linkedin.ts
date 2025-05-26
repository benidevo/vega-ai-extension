import { JobListing } from '@/types';
import { IJobExtractor } from './IJobExtractor';

/**
 * Extracts job listing information from LinkedIn job pages.
 *
 * Implements the `IJobExtractor` interface to provide methods for detecting LinkedIn job URLs,
 * extracting job data from structured data (`application/ld+json`) or directly from the DOM,
 * and mapping LinkedIn-specific fields to a normalized `JobListing` format.
 * It handles both structured data and fallback DOM parsing for robustness.
 */
export class LinkedInExtractor implements IJobExtractor {
  siteName = 'LinkedIn';

  canExtract(url: string): boolean {
    return url.includes('linkedin.com/jobs/view/');
  }

  /**
   * Extracts job listing information from a LinkedIn job document.
   * Attempts to use structured data first, falling back to DOM extraction if necessary.
   * @param document - The HTML document to extract job data from.
   * @returns The extracted JobListing object, or null if extraction fails.
   */
  extract(document: Document): JobListing | null {
    try {
      const structuredData = this.extractStructuredData(document);
      if (structuredData) return structuredData;

      return this.extractFromDOM(document);
    } catch (error) {
      console.error('Error extracting LinkedIn job data:', error);
      return null;
    }
  }

  private extractStructuredData(doc: Document): JobListing | null {
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
            sourceUrl: window.location.href,
            jobType: this.mapJobType(data.employmentType),
            experienceLevel: data.experienceRequirements?.minimumLevel || undefined,
            skills: data.skills || [],
          };
        }
      } catch (e) {
        console.error('Error parsing LinkedIn structured data:', e);
      }
    }
    return null;
  }

  private extractFromDOM(doc: Document): JobListing | null {
    // Try multiple selectors for better compatibility
    const title = this.getText(doc.querySelector('.job-details-jobs-unified-top-card__job-title, .jobs-unified-top-card__job-title, h1.jobs-unified-top-card__job-title'));
    const company = this.getText(doc.querySelector('.job-details-jobs-unified-top-card__company-name, .jobs-unified-top-card__company-name, .job-details-jobs-unified-top-card__primary-description a'));
    
    // Location can be in multiple places
    const locationSelectors = [
      '.job-details-jobs-unified-top-card__bullet',
      '.jobs-unified-top-card__bullet',
      '.job-details-jobs-unified-top-card__primary-description-container span:nth-child(2)',
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

    return {
      title,
      company,
      location: location || 'Unknown Location',
      description: description || '',
      sourceUrl: window.location.href,
      jobType: this.extractJobType(doc),
      experienceLevel: this.extractExperienceLevel(doc),
      skills: this.extractSkills(doc),
    };
  }

  private getText(element: Element | null): string {
    return element?.textContent?.trim() || '';
  }

  private mapJobType(employmentType: string | undefined): JobListing['jobType'] | undefined {
    if (!employmentType) return undefined;

    const typeMap: Record<string, JobListing['jobType']> = {
      'FULL_TIME': 'full_time',
      'PART_TIME': 'part_time',
      'CONTRACTOR': 'contract',
      'INTERN': 'intern',
      'FREELANCE': 'freelance'
    };

    return typeMap[employmentType.toUpperCase()];
  }

  private extractJobType(doc: Document): JobListing['jobType'] | undefined {
    const jobTypeElement = doc.querySelector('.job-details-jobs-unified-top-card__job-insight-view-model-secondary');
    const text = this.getText(jobTypeElement).toLowerCase();

    if (text.includes('full-time') || text.includes('full time')) return 'full_time';
    if (text.includes('part-time') || text.includes('part time')) return 'part_time';
    if (text.includes('contract')) return 'contract';
    if (text.includes('intern')) return 'intern';
    if (text.includes('freelance')) return 'freelance';
    if (text.includes('remote')) return 'remote';

    return undefined;
  }

  private extractExperienceLevel(doc: Document): string | undefined {
    const expElement = doc.querySelector('.job-details-jobs-unified-top-card__job-insight-view-model-secondary');
    const text = this.getText(expElement);

    if (text.includes('Entry level')) return 'Entry Level';
    if (text.includes('Mid-Senior level')) return 'Mid-Senior Level';
    if (text.includes('Senior level')) return 'Senior Level';
    if (text.includes('Associate')) return 'Associate';
    if (text.includes('Director')) return 'Director';

    return undefined;
  }

  private extractSkills(doc: Document): string[] {
    const skills: string[] = [];
    
    // Try multiple selectors for skills
    const skillSelectors = [
      '.job-details-how-you-match__skill-item',
      '[data-test-job-skill-pill]',
      '.jobs-unified-top-card__job-insight span',
      '.job-details-how-you-match__skills-item-subtitle',
      'button[aria-label*="skill"]',
      '[class*="skill-pill"]'
    ];
    
    for (const selector of skillSelectors) {
      const skillElements = doc.querySelectorAll(selector);
      if (skillElements.length > 0) {
        skillElements.forEach(element => {
          const skill = this.getText(element);
          if (skill && skill.length > 1 && skill.length < 50 && !skills.includes(skill)) {
            skills.push(skill);
          }
        });
        if (skills.length > 0) break;
      }
    }
    
    // Also look for skills in job insights section
    const insightElements = doc.querySelectorAll('.jobs-unified-top-card__job-insight');
    insightElements.forEach(element => {
      const text = this.getText(element);
      if (text.includes('skill') && text.includes(',')) {
        // Extract comma-separated skills
        const skillPart = text.split(':').pop() || '';
        const extractedSkills = skillPart.split(',').map(s => s.trim()).filter(s => s.length > 1 && s.length < 30);
        extractedSkills.forEach(skill => {
          if (!skills.includes(skill)) skills.push(skill);
        });
      }
    });
    
    return skills.slice(0, 10); // Limit to 10 skills
  }
}