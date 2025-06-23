/**
 * Configuration management for the Vega AI extension
 *
 * This file provides environment-specific configuration that gets
 * bundled into the extension at build time.
 */

export interface AppConfig {
  // Authentication Configuration (optional)
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

// Default configuration (fallback)
const defaultConfig: AppConfig = {
  auth: {
    providers: {
      google: {
        clientId: 'your-google-client-id.apps.googleusercontent.com',
        scopes: ['openid', 'email', 'profile'],
        apiEndpoint: '/api/auth/google',
      },
      password: {
        apiBaseUrl: 'http://localhost:8765',
      },
    },
    defaultProvider: 'password',
  },
  api: {
    baseUrl: 'http://localhost:8765',
    authEndpoint: '/api/auth',
    timeout: 30000,
    retryAttempts: 3,
  },
  extension: {
    name: 'Vega AI Job Capture',
    version: '0.1.0',
    environment: environment as 'development' | 'production',
    deploymentMode: deploymentMode as 'opensource' | 'marketplace',
    debug: true,
  },
  features: {
    enableAnalytics: false,
    enableErrorReporting: false,
    maxJobsPerSession: 50,
    enableGoogleAuth: false,
    enableDynamicHost: deploymentMode === 'marketplace',
  },
};

// Environment-specific configurations
const configurations: Record<string, Partial<AppConfig>> = {
  development: {
    auth: {
      providers: {
        google: {
          clientId:
            '723024681965-pptqjhqv96n7g26dn43qlrntij2v5qnf.apps.googleusercontent.com',
          scopes: ['openid', 'email', 'profile'],
          apiEndpoint: '/api/auth/google',
        },
        password: {
          apiBaseUrl: 'http://localhost:8765',
        },
      },
      defaultProvider: enableOAuth ? 'google' : 'password',
    },
    extension: {
      name: 'Vega AI Job Capture (Dev)',
      version: '0.1.0',
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
          clientId:
            deploymentMode === 'opensource'
              ? '723024681965-pptqjhqv96n7g26dn43qlrntij2v5qnf.apps.googleusercontent.com'
              : '', // No OAuth for marketplace
          scopes: ['openid', 'email', 'profile'],
          apiEndpoint: '/api/auth/google',
        },
        password: {
          apiBaseUrl: 'http://localhost:8765', // Default for all builds
        },
      },
      defaultProvider:
        enableOAuth && deploymentMode === 'opensource' ? 'google' : 'password',
    },
    api: {
      baseUrl: 'http://localhost:8765', // Default for all builds
      authEndpoint: '/api/auth',
      timeout: 30000,
      retryAttempts: 3,
    },
    extension: {
      name: 'Vega AI Job Capture',
      version: '0.1.0',
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

// Merge default config with environment-specific config
const envConfig = configurations[environment] || {};
export const config: AppConfig = {
  ...defaultConfig,
  ...envConfig,
  auth: {
    ...defaultConfig.auth,
    ...envConfig.auth,
    providers: {
      ...defaultConfig.auth.providers,
      ...envConfig.auth?.providers,
      google: {
        ...defaultConfig.auth.providers.google,
        ...envConfig.auth?.providers?.google,
      },
      password: {
        ...defaultConfig.auth.providers.password,
        ...envConfig.auth?.providers?.password,
      },
    },
  },
  api: { ...defaultConfig.api, ...envConfig.api },
  extension: { ...defaultConfig.extension, ...envConfig.extension },
  features: { ...defaultConfig.features, ...envConfig.features },
};

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
