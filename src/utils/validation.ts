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
    notes: job.notes?.trim(),
  };
}

/**
 * Validation result interface
 */
export interface ValidationResult {
  isValid: boolean;
  error?: string;
}

/**
 * Validates password according to requirements
 * @param password - The password to validate
 * @returns Validation result with error message if invalid
 */
export function validatePassword(password: string): ValidationResult {
  if (!password) {
    return { isValid: false, error: 'Password is required' };
  }

  if (password.length < 8) {
    return {
      isValid: false,
      error: 'Password must be at least 8 characters long',
    };
  }

  if (password.length > 64) {
    return { isValid: false, error: 'Password must be 64 characters or less' };
  }

  return { isValid: true };
}

/**
 * Validates username according to requirements
 * @param username - The username to validate (can be email or username)
 * @returns Validation result with error message if invalid
 */
export function validateUsername(username: string): ValidationResult {
  if (!username) {
    return { isValid: false, error: 'Username or email is required' };
  }

  const trimmed = username.trim();

  if (trimmed.length < 3) {
    return {
      isValid: false,
      error: 'Username must be at least 3 characters long',
    };
  }

  if (trimmed.length > 100) {
    return { isValid: false, error: 'Username must be 100 characters or less' };
  }

  const emailPattern = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;
  if (emailPattern.test(trimmed)) {
    return { isValid: true };
  }

  const usernamePattern = /^[a-zA-Z0-9._-]+$/;
  if (!usernamePattern.test(trimmed)) {
    return {
      isValid: false,
      error:
        'Please enter a valid email address or username (letters, numbers, periods, underscores, and hyphens only)',
    };
  }

  return { isValid: true };
}

/**
 * Validates host input for backend configuration
 * @param host - The host to validate
 * @returns Validation result with error message if invalid
 */
export function validateHost(host: string): ValidationResult {
  if (!host) {
    return { isValid: false, error: 'Host is required' };
  }

  const trimmed = host.trim();

  if (trimmed.length < 1) {
    return { isValid: false, error: 'Host cannot be empty' };
  }

  // Basic pattern for hostname with optional port
  // Allows: localhost, localhost:8080, api.example.com, 192.168.1.1:3000
  const hostPattern =
    /^([a-zA-Z0-9]([a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?\.)*[a-zA-Z0-9]([a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?(:\d{1,5})?$/;
  const ipPattern = /^(\d{1,3}\.){3}\d{1,3}(:\d{1,5})?$/;

  if (
    !hostPattern.test(trimmed) &&
    !ipPattern.test(trimmed) &&
    trimmed !== 'localhost' &&
    !trimmed.startsWith('localhost:')
  ) {
    return {
      isValid: false,
      error:
        'Invalid host format. Use format like localhost:8080 or api.example.com',
    };
  }

  // Check port range if port is specified
  if (trimmed.includes(':')) {
    const port = parseInt(trimmed.split(':').pop() || '0');
    if (isNaN(port) || port < 1 || port > 65535) {
      return {
        isValid: false,
        error: 'Port must be between 1 and 65535',
      };
    }
  }

  return { isValid: true };
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
      'utm_source',
      'utm_medium',
      'utm_campaign',
      'utm_term',
      'utm_content',
      'fbclid',
      'gclid',
      'msclkid',
      'ref',
      'refId',
      'trk',
      'trackingId',
      'WT.mc_id',
      'pk_campaign',
      'pk_source',
      'pk_medium',
    ];

    trackingParams.forEach(param => {
      urlObj.searchParams.delete(param);
    });

    if (
      urlObj.hostname.includes('linkedin.com') &&
      urlObj.pathname.includes('/jobs/view/')
    ) {
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
