export type BackendMode = 'cloud' | 'local';

export interface UserSettings {
  apiHost: string;
  apiProtocol: 'http' | 'https';
  backendMode: BackendMode;
}

export const DEFAULT_SETTINGS: UserSettings = {
  apiHost: 'localhost:8765',
  apiProtocol: 'http',
  backendMode: 'cloud', // Default to cloud mode
};

export const BACKEND_CONFIGS = {
  cloud: {
    apiHost: 'vega.benidevo.com',
    apiProtocol: 'https' as const,
    enableOAuth: true,
  },
  local: {
    apiHost: 'localhost:8765',
    apiProtocol: 'http' as const,
    enableOAuth: false,
  },
};
