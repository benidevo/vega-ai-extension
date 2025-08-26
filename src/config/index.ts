export interface AppConfig {
  auth: {
    providers: {
      password: {
        apiBaseUrl: string;
      };
    };
    defaultProvider: 'password';
  };

  api: {
    baseUrl: string;
    authEndpoint: string;
    timeout: number;
    retryAttempts: number;
    retryDelays: {
      base: number;
      max: number;
      jitterPercent: number;
    };
  };

  extension: {
    name: string;
    version: string;
    environment: 'development' | 'production';
    deploymentMode: 'opensource';
    debug: boolean;
  };

  features: {
    enableAnalytics: boolean;
    enableErrorReporting: boolean;
    maxJobsPerSession: number;
    enableDynamicHost: boolean;
  };
}

const environment = process.env.APP_ENV || 'development';
const appVersion = process.env.APP_VERSION || '0.0.0';

const configurations: Record<string, AppConfig> = {
  development: {
    auth: {
      providers: {
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
      retryDelays: {
        base: 1000,
        max: 8000,
        jitterPercent: 25,
      },
    },
    extension: {
      name: 'Vega AI Job Capture (Dev)',
      version: appVersion,
      environment: 'development',
      deploymentMode: 'opensource',
      debug: true,
    },
    features: {
      enableAnalytics: false,
      enableErrorReporting: false,
      maxJobsPerSession: 10,
      enableDynamicHost: true,
    },
  },

  production: {
    auth: {
      providers: {
        password: {
          apiBaseUrl: 'https://vega.benidevo.com',
        },
      },
      defaultProvider: 'password',
    },
    api: {
      baseUrl: 'https://vega.benidevo.com',
      authEndpoint: '/api/auth',
      timeout: 30000,
      retryAttempts: 3,
      retryDelays: {
        base: 1000,
        max: 8000,
        jitterPercent: 25,
      },
    },
    extension: {
      name: 'Vega AI Job Capture',
      version: appVersion,
      environment: 'production',
      deploymentMode: 'opensource',
      debug: false,
    },
    features: {
      enableAnalytics: true,
      enableErrorReporting: true,
      maxJobsPerSession: 100,
      enableDynamicHost: true,
    },
  },
};

export const config: AppConfig =
  (configurations[environment] as AppConfig) ||
  (configurations.development as AppConfig);

export const authConfig = config.auth;
export const apiConfig = config.api;

export const isDevelopment = () =>
  config.extension.environment === 'development';
