import * as fs from 'fs';
import * as path from 'path';

import { MessageType } from '@/background/services/message/IMessageService';

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

describe('capture form job URL', () => {
  const signedIn = (): Store => ({
    userSettings: { apiHost: 'localhost:8765', apiProtocol: 'http' },
    authToken: 'token',
  });

  const urlInput = () => document.getElementById('job-url') as HTMLInputElement;

  async function openCapture(store: Store, tabUrl: string) {
    const mocks = await openPopup(store);
    (chrome.tabs.query as jest.Mock).mockResolvedValue([{ url: tabUrl }]);
    (document.getElementById('capture-btn') as HTMLButtonElement).click();
    await flush();
    return mocks;
  }

  function fillRequired() {
    const set = (id: string, value: string) => {
      const el = document.getElementById(id) as HTMLInputElement;
      el.value = value;
      el.dispatchEvent(new Event('input'));
    };
    set('job-title', 'Engineer');
    set('job-company', 'Acme');
    set('job-location', 'Remote');
    set('job-description', 'Build things');
  }

  const save = async () => {
    (document.getElementById('save-job-btn') as HTMLButtonElement).click();
    await flush();
  };

  it('prefills the field with the current tab URL', async () => {
    await openCapture(signedIn(), 'https://example.com/jobs/42');

    expect(urlInput().value).toBe('https://example.com/jobs/42');
  });

  it('saves the edited URL instead of the tab URL', async () => {
    const { sendMessage } = await openCapture(
      signedIn(),
      'https://example.com/jobs/42'
    );
    fillRequired();
    urlInput().value = 'https://careers.example.com/apply/42';
    (chrome.tabs.query as jest.Mock).mockResolvedValue([
      { url: 'https://linkedin.com/jobs/view/999' },
    ]);
    await save();

    expect(sendMessage).toHaveBeenCalledWith({
      type: MessageType.SAVE_JOB,
      payload: expect.objectContaining({
        sourceUrl: 'https://careers.example.com/apply/42',
      }),
    });
  });

  it('leaves the field empty on a browser-internal page and blocks the save', async () => {
    const { sendMessage } = await openCapture(
      signedIn(),
      'chrome://extensions'
    );
    expect(urlInput().value).toBe('');

    fillRequired();
    await save();

    expect(sendMessage).not.toHaveBeenCalledWith(
      expect.objectContaining({ type: MessageType.SAVE_JOB })
    );
    expect(urlInput().classList.contains('border-red-500')).toBe(true);
  });

  it('blocks the save and highlights the field for an invalid URL', async () => {
    const { sendMessage } = await openCapture(
      signedIn(),
      'https://example.com/jobs/42'
    );
    fillRequired();
    urlInput().value = 'javascript:alert(1)';
    await save();

    expect(sendMessage).not.toHaveBeenCalledWith(
      expect.objectContaining({ type: MessageType.SAVE_JOB })
    );
    expect(urlInput().classList.contains('border-red-500')).toBe(true);
  });
});
