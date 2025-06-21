/**
 * Base interface for all background services
 */
export interface IService {
  /**
   * Initialize the service
   */
  initialize(): Promise<void>;

  /**
   * Cleanup and destroy the service
   */
  destroy(): Promise<void>;
}
