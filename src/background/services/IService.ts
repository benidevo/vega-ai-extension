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

/**
 * Service configuration interface
 */
export interface ServiceConfig {
  debug?: boolean;
  [key: string]: unknown;
}
