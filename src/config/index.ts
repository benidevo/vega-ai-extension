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

// Get environment and deployment mode from build process
const environment = process.env.APP_ENV || 'development';
const deploymentMode = process.env.DEPLOYMENT_MODE || 'opensource';
const enableOAuth = process.env.ENABLE_OAUTH === 'true';
const googleClientId =
  process.env.GOOGLE_CLIENT_ID || 'YOUR_GOOGLE_CLIENT_ID_HERE';
const defaultApiBaseUrl = 'http://localhost:8765';
const appVersion = process.env.APP_VERSION || '0.0.0';

// Environment-specific configurations
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
          apiBaseUrl: defaultApiBaseUrl,
        },
      },
      defaultProvider: enableOAuth ? 'google' : 'password',
    },
    api: {
      baseUrl: defaultApiBaseUrl,
      authEndpoint: '/api/auth',
      timeout: 30000,
      retryAttempts: 3,
    },
    extension: {
      name: 'Vega AI Job Capture (Dev)',
      version: appVersion,
      environment: 'development',
      deploymentMode: deploymentMode as 'opensource' | 'marketplace',
      debug: true,
    },
    features: {
      enableAnalytics: false,
      enableErrorReporting: false,
      maxJobsPerSession: 10,
      enableGoogleAuth: enableOAuth,
      enableDynamicHost: deploymentMode === 'marketplace',
    },
  },

  production: {
    auth: {
      providers: {
        google: {
          clientId: deploymentMode === 'opensource' ? googleClientId : '',
          scopes: ['openid', 'email', 'profile'],
          apiEndpoint: '/api/auth/google',
        },
        password: {
          apiBaseUrl: defaultApiBaseUrl,
        },
      },
      defaultProvider:
        enableOAuth && deploymentMode === 'opensource' ? 'google' : 'password',
    },
    api: {
      baseUrl: defaultApiBaseUrl,
      authEndpoint: '/api/auth',
      timeout: 30000,
      retryAttempts: 3,
    },
    extension: {
      name: 'Vega AI Job Capture',
      version: appVersion,
      environment: 'production',
      deploymentMode: deploymentMode as 'opensource' | 'marketplace',
      debug: false,
    },
    features: {
      enableAnalytics: true,
      enableErrorReporting: true,
      maxJobsPerSession: 100,
      enableGoogleAuth: enableOAuth && deploymentMode === 'opensource',
      enableDynamicHost: deploymentMode === 'marketplace',
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

if (isDevelopment()) {
  console.log('🔧 Vega AI Extension Config:', {
    environment: config.extension.environment,
    deploymentMode: config.extension.deploymentMode,
    apiBaseUrl: config.api.baseUrl,
    authProviders: Object.keys(config.auth.providers),
    defaultProvider: config.auth.defaultProvider,
    googleAuthEnabled: config.features.enableGoogleAuth,
    dynamicHostEnabled: config.features.enableDynamicHost,
    debug: config.extension.debug,
  });
}
