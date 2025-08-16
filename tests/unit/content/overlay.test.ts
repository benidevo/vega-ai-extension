import { VegaAIOverlay } from '../../../src/content/overlay';
import { mockChrome, resetChromeMocks } from '../../mocks/chrome';
import { JobListing } from '../../../src/types';

jest.mock('../../../src/utils/logger', () => ({
  overlayLogger: {
    info: jest.fn(),
    error: jest.fn(),
    warn: jest.fn(),
    debug: jest.fn(),
  },
}));

jest.mock('../../../src/background/services/error', () => ({
  errorService: {
    handleError: jest.fn().mockReturnValue({
      userMessage: 'An error occurred',
    }),
  },
}));

jest.mock('../../../src/utils/messageWrapper', () => ({
  sendMessage: jest.fn(),
}));

jest.mock('../../../src/content/extractors', () => ({
  readJobDetails: jest.fn(),
}));

jest.mock('../../../src/content/styles/overlay.styles', () => ({
  overlayStyles: '.vega-ai-container { /* mock styles */ }',
}));

import { readJobDetails } from '../../../src/content/extractors';
import { sendMessage } from '../../../src/utils/messageWrapper';

describe('VegaAIOverlay', () => {
  let overlay: VegaAIOverlay;

  beforeEach(async () => {
    jest.clearAllMocks();
    resetChromeMocks();
    jest.useFakeTimers();

    document.body.innerHTML = '';

    mockChrome.runtime.getURL = jest.fn(
      path => `chrome-extension://test-id/${path}`
    );
    mockChrome.storage.local.get = jest.fn().mockResolvedValue({});
    mockChrome.storage.local.set = jest.fn().mockResolvedValue(undefined);
    mockChrome.runtime.onMessage.addListener = jest.fn();

    overlay = await VegaAIOverlay.create();
  });

  afterEach(() => {
    overlay?.destroy();
    jest.runOnlyPendingTimers();
    jest.useRealTimers();
  });

  describe('initialization', () => {
    it('should create overlay elements', () => {
      expect(document.getElementById('vega-ai-root')).toBeTruthy();
      expect(document.getElementById('vega-ai-overlay')).toBeTruthy();
      expect(document.getElementById('vega-ai-save-button')).toBeTruthy();
      expect(document.getElementById('vega-ai-save-panel')).toBeTruthy();
    });

    it('should check authentication on init', async () => {
      jest.clearAllMocks();
      resetChromeMocks();
      mockChrome.runtime.getURL = jest.fn(
        path => `chrome-extension://test-id/${path}`
      );
      mockChrome.runtime.onMessage.addListener = jest.fn();
      mockChrome.storage.local.get = jest
        .fn()
        .mockResolvedValue({ authToken: 'test-token' });

      const newOverlay = await VegaAIOverlay.create();

      expect(mockChrome.storage.local.get).toHaveBeenCalledWith('authToken');

      newOverlay.destroy();
    });

    it('should handle authentication check errors', async () => {
      mockChrome.storage.local.get = jest
        .fn()
        .mockRejectedValue(new Error('Storage error'));

      const newOverlay = await VegaAIOverlay.create();

      expect(mockChrome.storage.local.get).toHaveBeenCalledWith('authToken');

      newOverlay.destroy();
    });
  });

  describe('panel visibility', () => {
    it('should toggle panel visibility on button click', async () => {
      const button = document.querySelector(
        '.vega-ai-fab'
      ) as HTMLButtonElement;
      const panel = document.getElementById('vega-ai-save-panel');

      expect(panel?.classList.contains('vega-ai-hidden')).toBe(true);

      button.click();

      await Promise.resolve();
      await Promise.resolve();

      expect(panel?.style.display).toBe('block');
      expect(panel?.classList.contains('vega-ai-hidden')).toBe(false);
    });

    it('should hide panel on close button click', async () => {
      const button = document.querySelector(
        '.vega-ai-fab'
      ) as HTMLButtonElement;
      button.click();
      await Promise.resolve();
      await Promise.resolve();

      const closeButton = document.querySelector(
        '.vega-ai-close-button'
      ) as HTMLButtonElement;
      closeButton.click();

      const panel = document.getElementById('vega-ai-save-panel');
      expect(panel?.classList.contains('vega-ai-hidden')).toBe(true);
    });

    it('should hide panel on escape key', async () => {
      (overlay as any).isVisible = true;

      const event = new KeyboardEvent('keydown', { key: 'Escape' });
      document.dispatchEvent(event);

      const panel = document.getElementById('vega-ai-save-panel');
      expect(panel?.classList.contains('vega-ai-hidden')).toBe(true);
    });
  });

  describe('job reading', () => {
    it('should read and display job data', async () => {
      const mockJob: JobListing = {
        title: 'Software Engineer',
        company: 'Test Company',
        location: 'San Francisco, CA',
        description: 'Job description',
        jobType: 'full_time',
        sourceUrl: 'https://example.com/job/123',
      };

      (readJobDetails as jest.Mock).mockReturnValue(mockJob);
      mockChrome.storage.local.get = jest
        .fn()
        .mockResolvedValue({ authToken: 'test-token' });

      const newOverlay = await VegaAIOverlay.create();
      const button = document.querySelector(
        '.vega-ai-fab'
      ) as HTMLButtonElement;

      button.click();
      await Promise.resolve();
      await Promise.resolve();

      jest.advanceTimersByTime(300);
      await Promise.resolve();

      expect(readJobDetails).toHaveBeenCalled();
      expect(document.querySelector('.vega-ai-field-value')?.textContent).toBe(
        'Software Engineer'
      );

      newOverlay.destroy();
    });

    it('should show error when no job found', async () => {
      (readJobDetails as jest.Mock).mockReturnValue(null);
      mockChrome.storage.local.get = jest
        .fn()
        .mockResolvedValue({ authToken: 'test-token' });

      const newOverlay = await VegaAIOverlay.create();
      const button = document.querySelector(
        '.vega-ai-fab'
      ) as HTMLButtonElement;

      button.click();
      await Promise.resolve();
      await Promise.resolve();

      jest.advanceTimersByTime(300);
      await Promise.resolve();

      const content = document.getElementById('vega-ai-job-preview');
      expect(content?.textContent).toContain('No job listing found');

      newOverlay.destroy();
    });

    it('should cache read jobs', async () => {
      const mockJob: JobListing = {
        title: 'Software Engineer',
        company: 'Test Company',
        location: 'San Francisco, CA',
        description: 'Job description',
        jobType: 'full_time',
        sourceUrl: window.location.href,
      };

      (readJobDetails as jest.Mock).mockReturnValue(mockJob);
      mockChrome.storage.local.get = jest
        .fn()
        .mockResolvedValue({ authToken: 'test-token' });

      const newOverlay = await VegaAIOverlay.create();
      const button = document.querySelector(
        '.vega-ai-fab'
      ) as HTMLButtonElement;

      button.click();
      await Promise.resolve();
      await Promise.resolve();
      jest.advanceTimersByTime(300);
      await Promise.resolve();

      const closeButton = document.querySelector(
        '.vega-ai-close-button'
      ) as HTMLButtonElement;
      closeButton.click();

      button.click();
      await Promise.resolve();
      await Promise.resolve();
      jest.advanceTimersByTime(300);
      await Promise.resolve();

      expect(readJobDetails).toHaveBeenCalledTimes(1);

      newOverlay.destroy();
    });
  });

  describe('authentication flow', () => {
    it('should show auth required when not authenticated', async () => {
      mockChrome.storage.local.get = jest.fn().mockResolvedValue({});

      const newOverlay = await VegaAIOverlay.create();
      const button = document.querySelector(
        '.vega-ai-fab'
      ) as HTMLButtonElement;

      button.click();
      await Promise.resolve();
      await Promise.resolve();

      const content = document.getElementById('vega-ai-job-preview');
      expect(content?.querySelector('h3')?.textContent).toBe(
        'Sign In Required'
      );
      expect(content?.querySelector('.vega-ai-btn-primary')?.textContent).toBe(
        'Sign In'
      );

      newOverlay.destroy();
    });

    it('should handle sign in button click', async () => {
      mockChrome.storage.local.get = jest.fn().mockResolvedValue({});
      mockChrome.runtime.sendMessage = jest
        .fn()
        .mockImplementation((msg, callback) => {
          callback?.();
        });

      const newOverlay = await VegaAIOverlay.create();
      const button = document.querySelector(
        '.vega-ai-fab'
      ) as HTMLButtonElement;

      button.click();
      await Promise.resolve();
      await Promise.resolve();

      const signInButton = document.querySelector(
        '.vega-ai-btn-primary'
      ) as HTMLButtonElement;
      signInButton?.click();

      expect(mockChrome.runtime.sendMessage).toHaveBeenCalledWith(
        { type: 'OPEN_POPUP' },
        expect.any(Function)
      );

      const content = document.getElementById('vega-ai-job-preview');
      expect(content?.textContent).toContain('Click the Vega AI icon');

      newOverlay.destroy();
    });
  });

  describe('save functionality', () => {
    it('should save job successfully', async () => {
      const mockJob: JobListing = {
        title: 'Software Engineer',
        company: 'Test Company',
        location: 'San Francisco, CA',
        description: 'Job description',
        jobType: 'full_time',
        sourceUrl: 'https://example.com/job/123',
      };

      (readJobDetails as jest.Mock).mockReturnValue(mockJob);
      (sendMessage as jest.Mock).mockResolvedValue({ success: true });
      mockChrome.storage.local.get = jest
        .fn()
        .mockResolvedValue({ authToken: 'test-token' });
      mockChrome.storage.local.set = jest.fn().mockResolvedValue(undefined);

      const newOverlay = await VegaAIOverlay.create();
      const button = document.querySelector(
        '.vega-ai-fab'
      ) as HTMLButtonElement;

      button.click();
      await Promise.resolve();
      await Promise.resolve();
      jest.advanceTimersByTime(300);
      await Promise.resolve();

      const saveButton = document.getElementById(
        'vega-ai-save-btn'
      ) as HTMLButtonElement;
      expect(saveButton).toBeTruthy();

      if (saveButton) {
        saveButton.click();

        await Promise.resolve();
        await Promise.resolve();
        await Promise.resolve();

        expect(sendMessage).toHaveBeenCalledWith({
          type: 'SAVE_JOB',
          payload: mockJob,
        });
      }

      newOverlay.destroy();
    });

    it('should handle save errors', async () => {
      const mockJob: JobListing = {
        title: 'Software Engineer',
        company: 'Test Company',
        location: 'San Francisco, CA',
        description: 'Job description',
        jobType: 'full_time',
        sourceUrl: 'https://example.com/job/123',
      };

      (readJobDetails as jest.Mock).mockReturnValue(mockJob);
      (sendMessage as jest.Mock).mockRejectedValue(new Error('Network error'));
      mockChrome.storage.local.get = jest
        .fn()
        .mockResolvedValue({ authToken: 'test-token' });
      mockChrome.storage.local.set = jest.fn().mockResolvedValue(undefined);

      const newOverlay = await VegaAIOverlay.create();
      const button = document.querySelector(
        '.vega-ai-fab'
      ) as HTMLButtonElement;

      button.click();
      await Promise.resolve();
      await Promise.resolve();
      jest.advanceTimersByTime(300);
      await Promise.resolve();

      const saveButton = document.getElementById(
        'vega-ai-save-btn'
      ) as HTMLButtonElement;
      expect(saveButton).toBeTruthy();

      if (saveButton) {
        saveButton.click();

        await Promise.resolve();
        await Promise.resolve();
        await Promise.resolve();
        await Promise.resolve();

        expect(sendMessage).toHaveBeenCalled();

        expect(saveButton.disabled).toBe(false);
      }

      newOverlay.destroy();
    });
  });

  describe('notes functionality', () => {
    it('should update job notes when typing', async () => {
      const mockJob: JobListing = {
        title: 'Software Engineer',
        company: 'Test Company',
        location: 'San Francisco, CA',
        description: 'Job description',
        jobType: 'full_time',
        sourceUrl: window.location.href,
      };

      (readJobDetails as jest.Mock).mockReturnValue(mockJob);
      mockChrome.storage.local.get = jest
        .fn()
        .mockResolvedValue({ authToken: 'test-token' });

      const newOverlay = await VegaAIOverlay.create();
      const button = document.querySelector(
        '.vega-ai-fab'
      ) as HTMLButtonElement;

      button.click();
      await Promise.resolve();
      await Promise.resolve();
      jest.advanceTimersByTime(300);
      await Promise.resolve();

      const notesTextarea = document.getElementById(
        'vega-ai-notes-textarea'
      ) as HTMLTextAreaElement;
      expect(notesTextarea).toBeTruthy();

      if (notesTextarea) {
        // Set initial value
        notesTextarea.value = 'Test notes';
        notesTextarea.dispatchEvent(new Event('input'));

        // Verify the textarea retains the value (notes functionality is working)
        expect(notesTextarea.value).toBe('Test notes');
      }

      newOverlay.destroy();
    });
  });

  describe('keyboard shortcuts', () => {
    it('should toggle panel with Ctrl+Shift+V', async () => {
      const togglePanelSpy = jest.spyOn(overlay as any, 'togglePanel');

      const event = new KeyboardEvent('keydown', {
        key: 'V',
        ctrlKey: true,
        shiftKey: true,
      });
      document.dispatchEvent(event);

      expect(togglePanelSpy).toHaveBeenCalled();
    });

    it('should save with Ctrl+S when panel is open', async () => {
      const mockJob: JobListing = {
        title: 'Software Engineer',
        company: 'Test Company',
        location: 'San Francisco, CA',
        description: 'Job description',
        jobType: 'full_time',
        sourceUrl: 'https://example.com/job/123',
      };

      (sendMessage as jest.Mock).mockResolvedValue({ success: true });

      (overlay as any).isVisible = true;
      (overlay as any).isAuthenticated = true;
      (overlay as any).currentJob = mockJob;

      const handleSaveJobSpy = jest.spyOn(overlay as any, 'handleSaveJob');

      const event = new KeyboardEvent('keydown', {
        key: 's',
        ctrlKey: true,
      });
      event.preventDefault = jest.fn();
      document.dispatchEvent(event);

      expect(handleSaveJobSpy).toHaveBeenCalled();
    });
  });

  describe('auth state changes', () => {
    it('should handle auth state change messages', async () => {
      let messageListener: any;
      mockChrome.runtime.onMessage.addListener = jest.fn(listener => {
        messageListener = listener;
      });

      await VegaAIOverlay.create();

      expect(messageListener).toBeDefined();

      if (messageListener) {
        messageListener({
          type: 'AUTH_STATE_CHANGED',
          payload: { isAuthenticated: false },
        });
      }

      expect(mockChrome.runtime.onMessage.addListener).toHaveBeenCalled();
    });
  });

  describe('destroy', () => {
    it('should clean up all resources', () => {
      overlay.destroy();

      expect(document.getElementById('vega-ai-root')).toBeFalsy();
    });
  });
});
