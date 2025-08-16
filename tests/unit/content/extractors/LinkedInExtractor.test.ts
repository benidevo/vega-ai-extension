import { LinkedInJobReader } from '../../../../src/content/extractors/linkedin';
import { JobListing } from '../../../../src/types';

jest.mock('../../../../src/utils/validation', () => ({
  cleanUrl: jest.fn((url: string) => url),
  isValidJobListing: jest.fn(() => true),
  sanitizeJobListing: jest.fn((listing: JobListing) => listing),
}));

describe('LinkedInJobReader', () => {
  let reader: LinkedInJobReader;
  let mockDocument: Document;

  beforeEach(() => {
    reader = new LinkedInJobReader();
    mockDocument = document.implementation.createHTMLDocument();
  });

  describe('canRead', () => {
    it('should return true for LinkedIn job view URLs', () => {
      expect(
        reader.canRead('https://www.linkedin.com/jobs/view/123456789')
      ).toBe(true);
      expect(
        reader.canRead('https://linkedin.com/jobs/view/987654321?tracking=abc')
      ).toBe(true);
    });

    it('should return false for non-job LinkedIn URLs', () => {
      expect(reader.canRead('https://www.linkedin.com/feed/')).toBe(false);
      expect(reader.canRead('https://www.linkedin.com/in/john-doe')).toBe(
        false
      );
      expect(reader.canRead('https://www.linkedin.com/jobs/search/')).toBe(
        false
      );
    });

    it('should return false for non-LinkedIn URLs', () => {
      expect(reader.canRead('https://www.indeed.com/job/123')).toBe(false);
      expect(reader.canRead('https://www.google.com')).toBe(false);
    });
  });

  describe('readJobDetails', () => {
    it('should read job data from LinkedIn job page', () => {
      mockDocument.body.innerHTML = `
        <div>
          <h1 class="jobs-unified-top-card__job-title">Senior Software Engineer</h1>
          <a class="jobs-unified-top-card__company-name">Tech Corp</a>
          <span class="jobs-unified-top-card__primary-description">
            <span>San Francisco, CA · Remote</span>
          </span>
          <div class="jobs-description__content">
            <p>We are looking for a talented engineer to join our team...</p>
          </div>
          <div class="jobs-unified-top-card__job-insight">
            <span>Full-time</span>
          </div>
        </div>
      `;

      const result = reader.readJobDetails(
        mockDocument,
        'https://www.linkedin.com/jobs/view/123456789'
      );

      expect(result).toEqual({
        title: 'Senior Software Engineer',
        company: 'Tech Corp',
        location: 'San Francisco, CA',
        description:
          'We are looking for a talented engineer to join our team...',
        sourceUrl: 'https://www.linkedin.com/jobs/view/123456789',
        jobType: 'full_time',
      });
    });

    it('should handle alternative DOM structures', () => {
      mockDocument.body.innerHTML = `
        <div>
          <h1 class="job-details-jobs-unified-top-card__job-title">Product Manager</h1>
          <div class="job-details-jobs-unified-top-card__company-name">Startup Inc</div>
          <div class="job-details-jobs-unified-top-card__primary-description-container">
            <span>New York, NY</span>
          </div>
          <div class="jobs-description-content__text">
            Leading product development...
          </div>
        </div>
      `;

      const result = reader.readJobDetails(
        mockDocument,
        'https://www.linkedin.com/jobs/view/123456789'
      );

      expect(result).toEqual({
        title: 'Product Manager',
        company: 'Startup Inc',
        location: 'New York, NY',
        description: 'Leading product development...',
        sourceUrl: 'https://www.linkedin.com/jobs/view/123456789',
        jobType: undefined,
      });
    });

    it('should return null when required fields are missing', () => {
      mockDocument.body.innerHTML = `
        <div>
          <a class="jobs-unified-top-card__company-name">Tech Corp</a>
        </div>
      `;

      expect(
        reader.readJobDetails(
          mockDocument,
          'https://www.linkedin.com/jobs/view/123456789'
        )
      ).toBeNull();

      mockDocument.body.innerHTML = `
        <div>
          <h1 class="jobs-unified-top-card__job-title">Software Engineer</h1>
        </div>
      `;

      expect(
        reader.readJobDetails(
          mockDocument,
          'https://www.linkedin.com/jobs/view/123456789'
        )
      ).toBeNull();
    });

    it('should read various job types correctly', () => {
      const jobTypeTests = [
        { text: 'Full-time position', expected: 'full_time' },
        { text: 'Part time opportunity', expected: 'part_time' },
        { text: 'Contract role', expected: 'contract' },
        { text: 'Summer internship', expected: 'intern' },
        { text: 'Freelance project', expected: 'freelance' },
        { text: 'Remote work available', expected: 'remote' },
      ];

      jobTypeTests.forEach(({ text, expected }) => {
        mockDocument.body.innerHTML = `
          <div>
            <h1 class="jobs-unified-top-card__job-title">Job Title</h1>
            <a class="jobs-unified-top-card__company-name">Company</a>
            <div class="jobs-unified-top-card__job-insight">${text}</div>
          </div>
        `;

        const result = reader.readJobDetails(
          mockDocument,
          'https://www.linkedin.com/jobs/view/123456789'
        );
        expect(result?.jobType).toBe(expected);
      });
    });

    it('should handle extraction errors gracefully', () => {
      const consoleSpy = jest.spyOn(console, 'error').mockImplementation();

      const errorDocument = {
        querySelector: jest.fn(() => {
          throw new Error('DOM error');
        }),
      } as any;

      const result = reader.readJobDetails(
        errorDocument,
        'https://www.linkedin.com/jobs/view/123456789'
      );

      expect(result).toBeNull();
      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining('Error reading LinkedIn job data'),
        expect.any(Error)
      );

      consoleSpy.mockRestore();
    });

    it('should handle location extraction with complex text', () => {
      mockDocument.body.innerHTML = `
        <div>
          <h1 class="jobs-unified-top-card__job-title">Designer</h1>
          <a class="jobs-unified-top-card__company-name">Design Co</a>
          <div class="job-details-jobs-unified-top-card__primary-description-container">
            <span>London, UK</span>
            <span>50 applicants</span>
          </div>
        </div>
      `;

      const result = reader.readJobDetails(
        mockDocument,
        'https://www.linkedin.com/jobs/view/123456789'
      );
      expect(result?.location).toBe('London, UK');
    });

    it('should use fallback location when not found', () => {
      mockDocument.body.innerHTML = `
        <div>
          <h1 class="jobs-unified-top-card__job-title">Engineer</h1>
          <a class="jobs-unified-top-card__company-name">Tech Co</a>
        </div>
      `;

      const result = reader.readJobDetails(
        mockDocument,
        'https://www.linkedin.com/jobs/view/123456789'
      );
      expect(result?.location).toBe('Unknown Location');
    });
  });

  describe('siteName', () => {
    it('should return LinkedIn as site name', () => {
      expect(reader.siteName).toBe('LinkedIn');
    });
  });
});
