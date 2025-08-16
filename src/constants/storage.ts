export const STORAGE_KEYS = {
  AUTH_TOKEN: 'authToken',
  USER_DATA: 'userData',
  USER_CONSENT: 'userConsent',
  CONSENT_TIMESTAMP: 'consentTimestamp',
  SAVED_JOBS: 'savedJobs',
  JOB_CACHE: 'jobCache',
  USER_PREFERENCES: 'userPreferences',
  EXTENSION_SETTINGS: 'extensionSettings',
} as const;

export type StorageKey = (typeof STORAGE_KEYS)[keyof typeof STORAGE_KEYS];
