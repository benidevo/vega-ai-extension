export const chrome: any = {
  runtime: {
    onMessage: {
      addListener: jest.fn(),
      removeListener: jest.fn(),
    },
    sendMessage: jest.fn(),
    getURL: jest.fn((path: string) => `chrome-extension://test-extension-id/${path}`),
    lastError: null,
    id: 'test-extension-id',
  },
  storage: {
    local: {
      get: jest.fn(),
      set: jest.fn(),
      remove: jest.fn(),
      clear: jest.fn(),
    },
    sync: {
      get: jest.fn(),
      set: jest.fn(),
      remove: jest.fn(),
      clear: jest.fn(),
    },
  },
  identity: {
    getAuthToken: jest.fn(),
    removeCachedAuthToken: jest.fn(),
    clearAllCachedAuthTokens: jest.fn(),
    getRedirectURL: jest.fn(() => 'https://test-extension-id.chromiumapp.org/'),
    launchWebAuthFlow: jest.fn(),
  },
  action: {
    setBadgeText: jest.fn(),
    setBadgeBackgroundColor: jest.fn(),
    setBadgeTextColor: jest.fn(),
  },
  tabs: {
    query: jest.fn(),
    sendMessage: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
  },
};
