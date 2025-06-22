/**
 * Configuration management for the Vega AI extension
 *
 * This file provides environment-specific configuration that gets
 * bundled into the extension at build time.
 */

export interface AppConfig {
  // Authentication Configuration
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
    debug: boolean;
  };

  // Feature Flags
  features: {
    enableAnalytics: boolean;
    enableErrorReporting: boolean;
    maxJobsPerSession: number;
    enableGoogleAuth: boolean;
  };
}

// Default configuration (fallback)
const defaultConfig: AppConfig = {
  auth: {
    providers: {
      google: {
        clientId: 'placeholder-client-id.apps.googleusercontent.com',
        scopes: ['openid'],
        apiEndpoint: '/api/auth',
      },
      password: {
        apiBaseUrl: 'https://localhost:8000',
      },
    },
    defaultProvider: 'google',
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
    enableGoogleAuth: false,
  },
};

// Environment-specific configurations
const configurations: Record<string, Partial<AppConfig>> = {
  development: {
    auth: {
      providers: {
        google: {
          clientId:
            '631098864265-nj8bkpn6copd0hnnqubl8a4iqabmd5ho.apps.googleusercontent.com',
          scopes: ['openid'],
          apiEndpoint: '/api/auth',
        },
        password: {
          apiBaseUrl: 'http://localhost:8000',
        },
      },
      defaultProvider: 'google',
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
      enableGoogleAuth: false,
    },
  },

  production: {
    auth: {
      providers: {
        google: {
          clientId: 'YOUR_PROD_CLIENT_ID.apps.googleusercontent.com',
          scopes: ['openid'],
          apiEndpoint: '/api/auth',
        },
        password: {
          apiBaseUrl: 'https://api.vegaai.com',
        },
      },
      defaultProvider: 'google',
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
      enableGoogleAuth: false,
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

if (isDevelopment()) {
  console.log('🔧 Vega AI Extension Config:', {
    environment: config.extension.environment,
    apiBaseUrl: config.api.baseUrl,
    authProviders: Object.keys(config.auth.providers),
    defaultProvider: config.auth.defaultProvider,
    debug: config.extension.debug,
  });
}
