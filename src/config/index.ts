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
    debug: boolean;
  };

  // Feature Flags
  features: {
    enableAnalytics: boolean;
    enableErrorReporting: boolean;
    maxJobsPerSession: number;
    enableGoogleAuth: boolean; // Optional: Set to true to enable Google OAuth
  };
}

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
    defaultProvider: 'password', // Default to password auth
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
    environment: 'development',
    debug: true,
  },
  features: {
    enableAnalytics: false,
    enableErrorReporting: false,
    maxJobsPerSession: 50,
    enableGoogleAuth: false, // Disabled by default
  },
};

// Environment-specific configurations
const configurations: Record<string, Partial<AppConfig>> = {
  development: {
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
      enableGoogleAuth: false, // Disabled in dev - use prod build to test OAuth
    },
  },

  production: {
    auth: {
      providers: {
        google: {
          clientId: 'your-prod-google-client-id.apps.googleusercontent.com', // Replace with your production client ID
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
      environment: 'production',
      debug: false,
    },
    features: {
      enableAnalytics: true,
      enableErrorReporting: true,
      maxJobsPerSession: 100,
      enableGoogleAuth: false, // Set to true to enable Google OAuth (requires client ID setup)
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
    googleAuthEnabled: config.features.enableGoogleAuth,
    debug: config.extension.debug,
  });
}
