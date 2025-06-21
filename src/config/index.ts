/**
 * Configuration management for the Vega AI extension
 *
 * This file provides environment-specific configuration that gets
 * bundled into the extension at build time.
 */

export interface AppConfig {
  // Google OAuth Configuration
  google: {
    clientId: string;
    scopes: string[];
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
    debug: boolean;
  };

  // Feature Flags
  features: {
    enableAnalytics: boolean;
    enableErrorReporting: boolean;
    maxJobsPerSession: number;
  };
}

// Default configuration (fallback)
const defaultConfig: AppConfig = {
  google: {
    clientId: 'placeholder-client-id.apps.googleusercontent.com',
    scopes: ['openid'],
  },
  api: {
    baseUrl: 'https://localhost:8000/api',
    authEndpoint: '/auth',
    timeout: 30000,
    retryAttempts: 3,
  },
  extension: {
    name: 'Vega AI Job Capture',
    version: '0.1.0',
    environment: 'development',
    debug: true,
  },
  features: {
    enableAnalytics: false,
    enableErrorReporting: false,
    maxJobsPerSession: 50,
  },
};

// Environment-specific configurations
const configurations: Record<string, Partial<AppConfig>> = {
  development: {
    google: {
      clientId:
        '631098864265-nj8bkpn6copd0hnnqubl8a4iqabmd5ho.apps.googleusercontent.com',
      scopes: ['openid'],
    },
    api: {
      baseUrl: 'http://localhost:8000',
      authEndpoint: '/api/auth',
      timeout: 30000,
      retryAttempts: 3,
    },
    extension: {
      name: 'Vega AI Job Capture (Dev)',
      version: '0.1.0',
      environment: 'development',
      debug: true,
    },
    features: {
      enableAnalytics: false,
      enableErrorReporting: false,
      maxJobsPerSession: 10,
    },
  },

  production: {
    google: {
      clientId: 'YOUR_PROD_CLIENT_ID.apps.googleusercontent.com',
      scopes: ['openid'],
    },
    api: {
      baseUrl: 'https://api.vegaai.com/api',
      authEndpoint: '/auth',
      timeout: 30000,
      retryAttempts: 3,
    },
    extension: {
      name: 'Vega AI Job Capture',
      version: '0.1.0',
      environment: 'production',
      debug: false,
    },
    features: {
      enableAnalytics: true,
      enableErrorReporting: true,
      maxJobsPerSession: 100,
    },
  },
};

// Get environment from build process or default to development
const environment = process.env.APP_ENV || 'development';

// Merge default config with environment-specific config
const envConfig = configurations[environment] || {};
export const config: AppConfig = {
  ...defaultConfig,
  ...envConfig,
  google: { ...defaultConfig.google, ...envConfig.google },
  api: { ...defaultConfig.api, ...envConfig.api },
  extension: { ...defaultConfig.extension, ...envConfig.extension },
  features: { ...defaultConfig.features, ...envConfig.features },
};

// Export individual sections for convenience
export const googleConfig = config.google;
export const apiConfig = config.api;
export const extensionConfig = config.extension;
export const featureFlags = config.features;

export const isDevelopment = () =>
  config.extension.environment === 'development';
export const isProduction = () => config.extension.environment === 'production';

if (isDevelopment()) {
  console.log('🔧 Vega AI Extension Config:', {
    environment: config.extension.environment,
    apiBaseUrl: config.api.baseUrl,
    clientId: config.google.clientId,
    debug: config.extension.debug,
  });
}
