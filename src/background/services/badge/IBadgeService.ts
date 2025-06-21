import { IService } from '../IService';

/**
 * Badge service interface for managing extension badge
 */
export interface IBadgeService extends IService {
  /**
   * Set badge text
   */
  setText(text: string): Promise<void>;

  /**
   * Set badge background color
   */
  setColor(color: string): Promise<void>;

  /**
   * Clear badge
   */
  clear(): Promise<void>;

  /**
   * Show success state
   */
  showSuccess(text?: string): Promise<void>;

  /**
   * Show error state
   */
  showError(text?: string): Promise<void>;
}

/**
 * Badge colors
 */
export const BadgeColors = {
  SUCCESS: '#4CAF50',
  ERROR: '#F44336',
} as const;
