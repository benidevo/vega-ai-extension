import * as fs from 'fs';
import * as path from 'path';

jest.mock('@/styles/main.css', () => ({}));

jest.mock('@/utils/logger', () => ({
  Logger: jest.fn().mockImplementation(() => ({
    info: jest.fn(),
    error: jest.fn(),
    warn: jest.fn(),
    debug: jest.fn(),
  })),
}));

type Store = Record<string, unknown>;

const html = fs.readFileSync(
  path.resolve(__dirname, '../../../src/popup/index.html'),
  'utf8'
);
const body = html.slice(html.indexOf('<body'), html.indexOf('</html>'));

const flush = (ms = 50) => new Promise(resolve => setTimeout(resolve, ms));

function setupChrome(store: Store) {
  const sendMessage = jest.fn().mockResolvedValue({ success: true });
  (global as any).chrome = {
    runtime: {
      getManifest: () => ({ version: '1.4.1' }),
      onMessage: { addListener: jest.fn() },
      sendMessage,
      lastError: null,
    },
    storage: {
      local: {
        get: jest.fn(async (keys: string | string[]) => {
          const list = Array.isArray(keys) ? keys : [keys];
          return Object.fromEntries(
            list.filter(k => k in store).map(k => [k, store[k]])
          );
        }),
        set: jest.fn(async (items: Store) => {
          Object.assign(store, items);
        }),
        remove: jest.fn(async (keys: string | string[]) => {
          [keys].flat().forEach(k => delete store[k]);
        }),
      },
    },
    tabs: {
      query: jest.fn().mockResolvedValue([{ url: 'https://example.com' }]),
      onUpdated: { addListener: jest.fn() },
      onActivated: { addListener: jest.fn() },
    },
  };
  return { sendMessage };
}

async function openPopup(store: Store) {
  document.body.innerHTML = body.replace(/<script[\s\S]*?<\/script>/g, '');
  const mocks = setupChrome(store);
  jest.isolateModules(() => {
    require('@/popup/index');
  });
  document.dispatchEvent(new Event('DOMContentLoaded'));
  await flush();
  return mocks;
}

const visible = (id: string) =>
  !document.getElementById(id)!.classList.contains('hidden');

describe('popup server setup', () => {
  it('opens settings on a fresh profile with an empty host and no hosted option', async () => {
    await openPopup({});

    expect(visible('settings-view')).toBe(true);
    expect(visible('back-btn')).toBe(false);
    expect(
      (document.getElementById('custom-host') as HTMLInputElement).value
    ).toBe('');
    expect(document.body.textContent).not.toMatch(/cloud|benidevo/i);
    expect(document.getElementById('backend-cloud')).toBeNull();
  });

  it('shows setup for a stored cloud profile and drops its login', async () => {
    const store: Store = {
      userSettings: {
        apiHost: 'vega.benidevo.com',
        apiProtocol: 'https',
        backendMode: 'cloud',
      },
      authToken: 'old',
      authTokenData: { access_token: 'old' },
      authProvider: 'password',
    };
    await openPopup(store);

    expect(visible('settings-view')).toBe(true);
    expect(visible('back-btn')).toBe(false);
    expect(store.authToken).toBeUndefined();
    expect(store.authTokenData).toBeUndefined();
    expect(store.authProvider).toBeUndefined();
    expect(store.userSettings).toEqual({ apiHost: '', apiProtocol: 'http' });
  });

  it('keeps a self-hosted profile signed in and skips setup', async () => {
    const store: Store = {
      userSettings: {
        apiHost: 'localhost:8765',
        apiProtocol: 'http',
        backendMode: 'local',
      },
      authToken: 'keep',
    };
    await openPopup(store);

    expect(visible('settings-view')).toBe(false);
    expect(store.authToken).toBe('keep');
    expect(store.userSettings).toMatchObject({
      apiHost: 'localhost:8765',
      apiProtocol: 'http',
    });
  });

  it('saves a server from the first-run prompt and moves to login', async () => {
    const store: Store = {};
    const { sendMessage } = await openPopup(store);

    const host = document.getElementById('custom-host') as HTMLInputElement;
    host.value = 'localhost:8765';
    host.dispatchEvent(new Event('input'));
    (document.getElementById('save-settings-btn') as HTMLButtonElement).click();
    await flush(600);

    expect(store.userSettings).toEqual({
      apiHost: 'localhost:8765',
      apiProtocol: 'http',
    });
    expect(sendMessage).toHaveBeenCalledWith({ type: 'RELOAD_SETTINGS' });
    expect(visible('settings-view')).toBe(false);
    expect(document.getElementById('password-login-btn')).not.toBeNull();
    expect(document.getElementById('cta')!.innerHTML).toContain(
      'vega-ai#self-hosted-quick-start'
    );
  });

  it('rejects an empty host on save and test connection', async () => {
    const store: Store = {};
    const { sendMessage } = await openPopup(store);
    global.fetch = jest.fn();

    const host = document.getElementById('custom-host') as HTMLInputElement;
    host.dispatchEvent(new Event('input'));
    (document.getElementById('save-settings-btn') as HTMLButtonElement).click();
    (
      document.getElementById('test-connection-btn') as HTMLButtonElement
    ).click();
    await flush();

    expect(store.userSettings).toBeUndefined();
    expect(sendMessage).not.toHaveBeenCalledWith({ type: 'RELOAD_SETTINGS' });
    expect(global.fetch).not.toHaveBeenCalled();
  });
});
