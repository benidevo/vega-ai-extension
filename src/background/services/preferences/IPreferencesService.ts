import { IService } from '../IService';

/**
 * Preferences service interface for automated job searches
 */
export interface IPreferencesService extends IService {
  /**
   * Run automated job searches based on user preferences
   */
  runAutomatedSearch(): Promise<void>;

  /**
   * Check if a search is currently in progress
   */
  isSearchInProgress(): boolean;
}
