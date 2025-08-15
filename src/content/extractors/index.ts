import { JobListing } from '@/types';
import { IJobReader } from './IJobReader';
import { LinkedInJobReader } from './linkedin';
import { isValidJobListing, sanitizeJobListing } from '../../utils/validation';
import { Logger } from '@/utils/logger';

const readerLogger = new Logger('JobReaders');

const readers: IJobReader[] = [new LinkedInJobReader()];

export function readJobDetails(): JobListing | null {
  const currentUrl = window.location.href;

  for (const reader of readers) {
    if (reader.canRead(currentUrl)) {
      try {
        const jobData = reader.readJobDetails(document);

        if (jobData && isValidJobListing(jobData)) {
          return sanitizeJobListing(jobData);
        } else {
          readerLogger.warn('Read job data failed validation', {
            jobData,
          });
          return null;
        }
      } catch (error) {
        readerLogger.error(`Error in ${reader.siteName} reader`, error);
        return null;
      }
    }
  }

  return null;
}

export function isSupportedJobPage(): boolean {
  const currentUrl = window.location.href;
  return readers.some(reader => reader.canRead(currentUrl));
}
