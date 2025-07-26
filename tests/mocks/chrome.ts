export const mockChrome: any = {
  runtime: {
    onMessage: {
      addListener: jest.fn(),
      removeListener: jest.fn(),
    },
    onConnect: {
      addListener: jest.fn(),
    },
    sendMessage: jest.fn(() => Promise.resolve()),
    getURL: jest.fn(
      (path: string) => `chrome-extension://test-extension-id/${path}`
    ),
    lastError: null as chrome.runtime.LastError | null,
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
    query: jest.fn((query, callback) => callback([])),
    sendMessage: jest.fn(
      (tabId: number, message: any, callback?: (response: any) => void) => {
        if (callback) {
          callback(undefined);
          return undefined;
        } else {
          return Promise.resolve();
        }
      }
    ),
    create: jest.fn(),
    update: jest.fn(),
  },
  alarms: {
    create: jest.fn(),
    clear: jest.fn(),
    onAlarm: {
      addListener: jest.fn(),
    },
  },
};

export const resetChromeMocks = () => {
  mockChrome.runtime.lastError = null;

  const clearMocks = (obj: any) => {
    Object.values(obj).forEach(value => {
      if (typeof value === 'function' && 'mockClear' in value) {
        (value as jest.Mock).mockClear();
      } else if (typeof value === 'object' && value !== null) {
        clearMocks(value);
      }
    });
  };

  clearMocks(mockChrome);
};

export const chrome = mockChrome;

(global as any).chrome = mockChrome;
