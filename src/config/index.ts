/**
 * Configuration management for the Vega AI extension
 *
 * This file provides environment-specific configuration that gets
 * bundled into the extension at build time.
 */

export interface AppConfig {
  auth: {
    providers: {
      google: {
        clientId: string;
        scopes: string[];
        apiEndpoint: string;
      };
      password: {
        apiBaseUrl: string;
      };
    };
    defaultProvider: 'google' | 'password';
  };

  // API Configuration
  api: {
    baseUrl: string;
    authEndpoint: string;
    timeout: number;
    retryAttempts: number;
  };

  // Extension Configuration
  extension: {
    name: string;
    version: string;
    environment: 'development' | 'production';
    deploymentMode: 'opensource' | 'marketplace';
    debug: boolean;
  };

  // Feature Flags
  features: {
    enableAnalytics: boolean;
    enableErrorReporting: boolean;
    maxJobsPerSession: number;
    enableGoogleAuth: boolean;
    enableDynamicHost: boolean;
  };
}

// Get environment from build process
const environment = process.env.APP_ENV || 'development';
const googleClientId =
  process.env.GOOGLE_CLIENT_ID || 'YOUR_GOOGLE_CLIENT_ID_HERE';
const appVersion = process.env.APP_VERSION || '0.0.0';

// Base configuration - will be customized based on backend mode at runtime
const configurations: Record<string, AppConfig> = {
  development: {
    auth: {
      providers: {
        google: {
          clientId: googleClientId,
          scopes: ['openid', 'email', 'profile'],
          apiEndpoint: '/api/auth/google',
        },
        password: {
          apiBaseUrl: 'http://localhost:8765', // Will be overridden by settings
        },
      },
      defaultProvider: 'password',
    },
    api: {
      baseUrl: 'http://localhost:8765', // Will be overridden by settings
      authEndpoint: '/api/auth',
      timeout: 30000,
      retryAttempts: 3,
    },
    extension: {
      name: 'Vega AI Job Capture (Dev)',
      version: appVersion,
      environment: 'development',
      deploymentMode: 'opensource', // Not used anymore
      debug: true,
    },
    features: {
      enableAnalytics: false,
      enableErrorReporting: false,
      maxJobsPerSession: 10,
      enableGoogleAuth: true, // Always available, UI decides when to show
      enableDynamicHost: true, // Always allow switching
    },
  },

  production: {
    auth: {
      providers: {
        google: {
          clientId: googleClientId,
          scopes: ['openid', 'email', 'profile'],
          apiEndpoint: '/api/auth/google',
        },
        password: {
          apiBaseUrl: 'http://localhost:8765', // Will be overridden by settings
        },
      },
      defaultProvider: 'password',
    },
    api: {
      baseUrl: 'http://localhost:8765', // Will be overridden by settings
      authEndpoint: '/api/auth',
      timeout: 30000,
      retryAttempts: 3,
    },
    extension: {
      name: 'Vega AI Job Capture',
      version: appVersion,
      environment: 'production',
      deploymentMode: 'opensource', // Not used anymore
      debug: false,
    },
    features: {
      enableAnalytics: true,
      enableErrorReporting: true,
      maxJobsPerSession: 100,
      enableGoogleAuth: true, // Always available, UI decides when to show
      enableDynamicHost: true, // Always allow switching
    },
  },
};

// Get the configuration for the current environment
export const config: AppConfig =
  (configurations[environment] as AppConfig) ||
  (configurations.development as AppConfig);

// Export individual sections for convenience
export const authConfig = config.auth;
export const apiConfig = config.api;

export const isDevelopment = () =>
  config.extension.environment === 'development';

export const isMarketplaceMode = () =>
  config.extension.deploymentMode === 'marketplace';

// Config logging removed for production security
