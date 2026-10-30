export interface UserSettings {
  apiHost: string;
  apiProtocol: 'http' | 'https';
}

// An empty host means no server has been configured yet.
export const DEFAULT_SETTINGS: UserSettings = {
  apiHost: '',
  apiProtocol: 'http',
};
