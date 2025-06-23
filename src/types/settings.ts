export interface UserSettings {
  apiHost: string;
  apiProtocol: 'http' | 'https';
}

export const DEFAULT_SETTINGS: UserSettings = {
  apiHost: 'localhost:8765',
  apiProtocol: 'http',
};
