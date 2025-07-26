import {
  validatePassword,
  validateUsername,
  validateHost,
  isValidJobListing,
  sanitizeJobListing,
  cleanUrl,
} from '../../../src/utils/validation';
import { JobListing } from '../../../src/types';

describe('validatePassword', () => {
  it('should require password', () => {
    const result = validatePassword('');
    expect(result.isValid).toBe(false);
    expect(result.error).toBe('Password is required');
  });

  it('should enforce minimum length', () => {
    const result = validatePassword('1234567');
    expect(result.isValid).toBe(false);
    expect(result.error).toBe('Password must be at least 8 characters long');
  });

  it('should enforce maximum length', () => {
    const result = validatePassword('a'.repeat(65));
    expect(result.isValid).toBe(false);
    expect(result.error).toBe('Password must be 64 characters or less');
  });

  it('should accept valid passwords', () => {
    expect(validatePassword('password123').isValid).toBe(true);
    expect(validatePassword('a'.repeat(8)).isValid).toBe(true);
  });
});

describe('validateUsername', () => {
  it('should require username', () => {
    const result = validateUsername('');
    expect(result.isValid).toBe(false);
    expect(result.error).toBe('Username is required');
  });

  it('should enforce minimum length', () => {
    const result = validateUsername('ab');
    expect(result.isValid).toBe(false);
    expect(result.error).toBe('Username must be at least 3 characters long');
  });

  it('should enforce maximum length', () => {
    const result = validateUsername('a'.repeat(51));
    expect(result.isValid).toBe(false);
    expect(result.error).toBe('Username must be 50 characters or less');
  });

  it('should reject invalid characters', () => {
    const result = validateUsername('user@name');
    expect(result.isValid).toBe(false);
    expect(result.error).toBe(
      'Username can only contain letters, numbers, periods, underscores, and hyphens'
    );
  });

  it('should accept valid usernames', () => {
    expect(validateUsername('user123').isValid).toBe(true);
    expect(validateUsername('user_name').isValid).toBe(true);
    expect(validateUsername('user-name').isValid).toBe(true);
    expect(validateUsername('user.name').isValid).toBe(true);
  });

  it('should trim whitespace', () => {
    expect(validateUsername('  user123  ').isValid).toBe(true);
  });
});

describe('validateHost', () => {
  it('should require host', () => {
    const result = validateHost('');
    expect(result.isValid).toBe(false);
    expect(result.error).toBe('Host is required');
  });

  it('should reject empty host after trimming', () => {
    const result = validateHost('   ');
    expect(result.isValid).toBe(false);
    expect(result.error).toBe('Host cannot be empty');
  });

  it('should accept localhost', () => {
    expect(validateHost('localhost').isValid).toBe(true);
    expect(validateHost('localhost:8080').isValid).toBe(true);
    expect(validateHost('localhost:3000').isValid).toBe(true);
  });

  it('should accept valid hostnames', () => {
    expect(validateHost('api.example.com').isValid).toBe(true);
    expect(validateHost('example.com').isValid).toBe(true);
    expect(validateHost('subdomain.example.com').isValid).toBe(true);
    expect(validateHost('api-v2.example.com').isValid).toBe(true);
  });

  it('should accept IP addresses', () => {
    expect(validateHost('192.168.1.1').isValid).toBe(true);
    expect(validateHost('127.0.0.1:8080').isValid).toBe(true);
  });

  it('should accept hosts with valid ports', () => {
    expect(validateHost('example.com:80').isValid).toBe(true);
    expect(validateHost('example.com:65535').isValid).toBe(true);
  });

  it('should reject invalid port numbers', () => {
    let result = validateHost('example.com:0');
    expect(result.isValid).toBe(false);
    expect(result.error).toBe('Port must be between 1 and 65535');

    result = validateHost('example.com:65536');
    expect(result.isValid).toBe(false);
    expect(result.error).toBe('Port must be between 1 and 65535');

    result = validateHost('example.com:99999');
    expect(result.isValid).toBe(false);
    expect(result.error).toBe('Port must be between 1 and 65535');
  });

  it('should reject invalid host formats', () => {
    const result = validateHost('invalid host');
    expect(result.isValid).toBe(false);
    expect(result.error).toBe(
      'Invalid host format. Use format like localhost:8080 or api.example.com'
    );
  });

  it('should reject hosts with special characters', () => {
    expect(validateHost('example@com').isValid).toBe(false);
    expect(validateHost('example com').isValid).toBe(false);
  });
});

describe('isValidJobListing', () => {
  it('should validate required fields', () => {
    const validJob: JobListing = {
      title: 'Software Engineer',
      company: 'Tech Corp',
      location: 'San Francisco',
      description: 'Job description',
      sourceUrl: 'https://example.com/job/123',
    };
    expect(isValidJobListing(validJob)).toBe(true);
  });

  it('should reject missing required fields', () => {
    expect(
      isValidJobListing({
        company: 'Tech Corp',
        location: 'San Francisco',
        sourceUrl: 'https://example.com/job/123',
      })
    ).toBe(false);

    expect(
      isValidJobListing({
        title: 'Software Engineer',
        location: 'San Francisco',
        sourceUrl: 'https://example.com/job/123',
      })
    ).toBe(false);

    expect(
      isValidJobListing({
        title: 'Software Engineer',
        company: 'Tech Corp',
        sourceUrl: 'https://example.com/job/123',
      })
    ).toBe(false);
  });

  it('should reject empty or whitespace-only strings', () => {
    expect(
      isValidJobListing({
        title: '',
        company: 'Tech Corp',
        location: 'San Francisco',
        sourceUrl: 'https://example.com/job/123',
      })
    ).toBe(false);

    expect(
      isValidJobListing({
        title: '   ',
        company: 'Tech Corp',
        location: 'San Francisco',
        sourceUrl: 'https://example.com/job/123',
      })
    ).toBe(false);
  });

  it('should reject non-string values', () => {
    const job = {
      title: 123 as any,
      company: 'Tech Corp',
      location: 'San Francisco',
      sourceUrl: 'https://example.com/job/123',
    };
    expect(isValidJobListing(job)).toBe(false);
  });

  it('should accept optional fields', () => {
    const job: JobListing = {
      title: 'Software Engineer',
      company: 'Tech Corp',
      location: 'San Francisco',
      sourceUrl: 'https://example.com/job/123',
      description: 'Job description',
      jobType: 'full_time',
      applicationUrl: 'https://example.com/apply',
      notes: 'My notes',
    };
    expect(isValidJobListing(job)).toBe(true);
  });
});

describe('sanitizeJobListing', () => {
  it('should trim all string fields', () => {
    const job: JobListing = {
      title: '  Software Engineer  ',
      company: '  Tech Corp  ',
      location: '  San Francisco  ',
      description: '  Job description  ',
      sourceUrl: '  https://example.com/job/123  ',
      applicationUrl: '  https://example.com/apply  ',
      notes: '  My notes  ',
    };

    const sanitized = sanitizeJobListing(job);

    expect(sanitized.title).toBe('Software Engineer');
    expect(sanitized.company).toBe('Tech Corp');
    expect(sanitized.location).toBe('San Francisco');
    expect(sanitized.description).toBe('Job description');
    expect(sanitized.sourceUrl).toBe('https://example.com/job/123');
    expect(sanitized.applicationUrl).toBe('https://example.com/apply');
    expect(sanitized.notes).toBe('My notes');
  });

  it('should handle missing optional fields', () => {
    const job: JobListing = {
      title: 'Software Engineer',
      company: 'Tech Corp',
      location: 'San Francisco',
      description: '',
      sourceUrl: 'https://example.com/job/123',
    };

    const sanitized = sanitizeJobListing(job);

    expect(sanitized.description).toBe('');
    expect(sanitized.applicationUrl).toBeUndefined();
    expect(sanitized.notes).toBeUndefined();
  });

  it('should preserve jobType', () => {
    const job: JobListing = {
      title: 'Software Engineer',
      company: 'Tech Corp',
      location: 'San Francisco',
      description: 'Job description',
      sourceUrl: 'https://example.com/job/123',
      jobType: 'full_time',
    };

    const sanitized = sanitizeJobListing(job);
    expect(sanitized.jobType).toBe('full_time');
  });
});

describe('cleanUrl', () => {
  it('should remove tracking parameters (UTM, pk_*, etc)', () => {
    expect(
      cleanUrl(
        'https://example.com/job?utm_source=google&utm_medium=cpc&utm_campaign=jobs'
      )
    ).toBe('https://example.com/job');

    expect(
      cleanUrl(
        'https://example.com/job?pk_campaign=test&pk_source=email&pk_medium=link&id=123'
      )
    ).toBe('https://example.com/job?id=123');
  });

  it('should preserve non-tracking parameters', () => {
    const url =
      'https://example.com/job?id=123&category=tech&utm_source=google';
    const cleaned = cleanUrl(url);
    expect(cleaned).toBe('https://example.com/job?id=123&category=tech');
  });

  it('should handle LinkedIn job URLs', () => {
    expect(
      cleanUrl(
        'https://www.linkedin.com/jobs/view/123456789?refId=abc&trackingId=xyz'
      )
    ).toBe('https://www.linkedin.com/jobs/view/123456789');

    expect(
      cleanUrl(
        'https://www.linkedin.com/jobs/view/123456789/extra/path?param=value'
      )
    ).toBe('https://www.linkedin.com/jobs/view/123456789');
  });

  it('should handle invalid URLs gracefully', () => {
    const url = 'not-a-valid-url';
    const cleaned = cleanUrl(url);
    expect(cleaned).toBe('not-a-valid-url');
  });

  it('should handle URLs without parameters', () => {
    const url = 'https://example.com/job';
    const cleaned = cleanUrl(url);
    expect(cleaned).toBe('https://example.com/job');
  });

  it('should handle URLs with fragments', () => {
    const url = 'https://example.com/job?utm_source=test#section';
    const cleaned = cleanUrl(url);
    expect(cleaned).toBe('https://example.com/job#section');
  });
});
