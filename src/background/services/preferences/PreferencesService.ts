import { IPreferencesService } from './IPreferencesService';
import { IAPIService } from '../api/IAPIService';
import { JobSearchPreference } from '@/types';
import { errorService } from '../error';
import { Logger } from '@/utils/logger';

const logger = new Logger('PreferencesService');

export class PreferencesService implements IPreferencesService {
  private searchInProgress = false;
  private isInitialized = false;

  constructor(private apiService: IAPIService) {}

  async initialize(): Promise<void> {
    if (this.isInitialized) return;
    this.isInitialized = true;
    logger.info('PreferencesService initialized');
  }

  async destroy(): Promise<void> {
    this.searchInProgress = false;
    this.isInitialized = false;
    logger.info('PreferencesService destroyed');
  }

  async runAutomatedSearch(): Promise<void> {
    if (this.searchInProgress) {
      logger.info('Search already in progress, skipping');
      return;
    }

    try {
      this.searchInProgress = true;
      logger.info('Starting automated job search');

      const response = await this.apiService.getActivePreferences();
      if (!response || response.preferences.length === 0) {
        logger.info('No active preferences found or quota exhausted');
        return;
      }

      const { preferences } = response;
      logger.info(`Found ${preferences.length} active preferences`);

      for (const preference of preferences) {
        try {
          await this.searchForPreference(preference);
          // Wait between searches to avoid rate limiting
          await this.delay(5000);
        } catch (error) {
          // Log error but continue with other preferences
          errorService.handleError(error, {
            action: 'search_for_preference',
            preferenceId: preference.id,
          });
        }
      }

      logger.info('Automated search completed');
    } catch (error) {
      errorService.handleError(error, {
        action: 'run_automated_search',
      });
    } finally {
      this.searchInProgress = false;
    }
  }

  isSearchInProgress(): boolean {
    return this.searchInProgress;
  }

  private async searchForPreference(
    preference: JobSearchPreference
  ): Promise<void> {
    logger.info(
      `Searching for preference: ${preference.job_title} in ${preference.location}`,
      {
        preferenceId: preference.id,
      }
    );

    let tabId: number | undefined;

    try {
      // Create a background tab for the search
      const tab = await chrome.tabs.create({
        url: this.buildSearchUrl(preference),
        active: false,
        pinned: true,
      });

      if (!tab.id) {
        throw new Error('Failed to create search tab');
      }

      tabId = tab.id;

      // Wait for the tab to load
      await this.waitForTabLoad(tabId);

      // Extract search results
      const jobsFound = await this.extractSearchResults(tabId, preference);

      // Record results with the API
      await this.apiService.recordSearchResults(preference.id, jobsFound);

      logger.info(`Search completed for preference ${preference.id}`, {
        jobsFound,
      });
    } catch (error) {
      logger.error('Search failed for preference', error, {
        preferenceId: preference.id,
      });
      throw error;
    } finally {
      // Always clean up the tab
      if (tabId !== undefined) {
        try {
          await chrome.tabs.remove(tabId);
        } catch (error) {
          logger.warn('Failed to close tab', { tabId, error });
        }
      }
    }
  }

  private buildSearchUrl(preference: JobSearchPreference): string {
    const params = new URLSearchParams({
      keywords: preference.job_title,
      location: preference.location,
      f_TPR: this.getTimeFilter(preference.max_age),
      sortBy: 'DD', // Sort by date
    });

    return `https://www.linkedin.com/jobs/search/?${params.toString()}`;
  }

  private getTimeFilter(maxAgeSeconds: number): string {
    // LinkedIn time filters
    if (maxAgeSeconds <= 86400) return 'r86400'; // Past 24 hours
    if (maxAgeSeconds <= 604800) return 'r604800'; // Past week
    if (maxAgeSeconds <= 2592000) return 'r2592000'; // Past month
    return ''; // Any time
  }

  private async waitForTabLoad(tabId: number): Promise<void> {
    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        chrome.tabs.onUpdated.removeListener(listener);
        reject(new Error('Tab load timeout'));
      }, 30000); // 30 second timeout

      const listener = (
        tabIdUpdated: number,
        changeInfo: chrome.tabs.TabChangeInfo
      ) => {
        if (tabIdUpdated === tabId && changeInfo.status === 'complete') {
          clearTimeout(timeout);
          chrome.tabs.onUpdated.removeListener(listener);
          // Give the page a moment to render dynamic content
          setTimeout(resolve, 2000);
        }
      };

      chrome.tabs.onUpdated.addListener(listener);
    });
  }

  private async extractSearchResults(
    tabId: number,
    preference: JobSearchPreference
  ): Promise<number> {
    try {
      // Send message to content script to extract results
      const response = await chrome.tabs.sendMessage(tabId, {
        type: 'EXTRACT_SEARCH_RESULTS',
        payload: {
          preferenceId: preference.id,
          maxAge: preference.max_age,
          jobTitle: preference.job_title,
          location: preference.location,
        },
      });

      return response?.jobsFound || 0;
    } catch (error) {
      logger.error('Failed to extract search results', error);
      return 0;
    }
  }

  private delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}
