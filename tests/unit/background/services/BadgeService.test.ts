import { BadgeService } from '@/background/services/badge/BadgeService';
import { BadgeColors } from '@/background/services/badge/IBadgeService';
import { mockChrome, resetChromeMocks } from '../../../mocks/chrome';

describe('BadgeService', () => {
  let badgeService: BadgeService;

  beforeEach(() => {
    jest.clearAllMocks();
    resetChromeMocks();
    jest.useFakeTimers();
    badgeService = new BadgeService();

    mockChrome.action.setBadgeText = jest.fn((details, callback) => {
      callback?.();
    });
    mockChrome.action.setBadgeBackgroundColor = jest.fn((details, callback) => {
      callback?.();
    });
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  describe('initialize', () => {
    it('should initialize and clear badge', async () => {
      await badgeService.initialize();

      expect(mockChrome.action.setBadgeText).toHaveBeenCalledWith(
        { text: '' },
        expect.any(Function)
      );
    });
  });

  describe('destroy', () => {
    it('should clear badge and reset state', async () => {
      await badgeService.initialize();
      jest.clearAllMocks();

      await badgeService.destroy();

      expect(mockChrome.action.setBadgeText).toHaveBeenCalledWith(
        { text: '' },
        expect.any(Function)
      );

      await badgeService.initialize();
      expect(mockChrome.action.setBadgeText).toHaveBeenCalled();
    });
  });

  describe('setText', () => {
    it('should set badge text', async () => {
      await badgeService.setText('5');

      expect(mockChrome.action.setBadgeText).toHaveBeenCalledWith(
        { text: '5' },
        expect.any(Function)
      );
    });

    it('should handle chrome runtime errors', async () => {
      mockChrome.runtime.lastError = { message: 'Badge error' };
      mockChrome.action.setBadgeText = jest.fn((details, callback) => {
        callback?.();
      });

      await expect(badgeService.setText('5')).rejects.toThrow('Badge error');

      mockChrome.runtime.lastError = null;
    });
  });

  describe('setColor', () => {
    it('should set badge color', async () => {
      await badgeService.setColor('#FF0000');

      expect(mockChrome.action.setBadgeBackgroundColor).toHaveBeenCalledWith(
        { color: '#FF0000' },
        expect.any(Function)
      );
    });

    it('should handle chrome runtime errors', async () => {
      mockChrome.runtime.lastError = { message: 'Color error' };
      mockChrome.action.setBadgeBackgroundColor = jest.fn(
        (details, callback) => {
          callback?.();
        }
      );

      await expect(badgeService.setColor('#FF0000')).rejects.toThrow(
        'Color error'
      );

      mockChrome.runtime.lastError = null;
    });
  });

  describe('showSuccess', () => {
    it('should show success with default text', async () => {
      await badgeService.showSuccess();

      expect(mockChrome.action.setBadgeBackgroundColor).toHaveBeenCalledWith(
        { color: BadgeColors.SUCCESS },
        expect.any(Function)
      );
      expect(mockChrome.action.setBadgeText).toHaveBeenCalledWith(
        { text: '✓' },
        expect.any(Function)
      );
    });

    it('should show success with custom text', async () => {
      await badgeService.showSuccess('OK');

      expect(mockChrome.action.setBadgeText).toHaveBeenCalledWith(
        { text: 'OK' },
        expect.any(Function)
      );
    });

    it('should auto-clear after 3 seconds', async () => {
      await badgeService.showSuccess();
      jest.clearAllMocks();

      jest.advanceTimersByTime(3000);

      expect(mockChrome.action.setBadgeText).toHaveBeenCalledWith(
        { text: '' },
        expect.any(Function)
      );
    });
  });

  describe('showError', () => {
    it('should show error with default text', async () => {
      await badgeService.showError();

      expect(mockChrome.action.setBadgeBackgroundColor).toHaveBeenCalledWith(
        { color: BadgeColors.ERROR },
        expect.any(Function)
      );
      expect(mockChrome.action.setBadgeText).toHaveBeenCalledWith(
        { text: '!' },
        expect.any(Function)
      );
    });

    it('should show error with custom text', async () => {
      await badgeService.showError('ERR');

      expect(mockChrome.action.setBadgeText).toHaveBeenCalledWith(
        { text: 'ERR' },
        expect.any(Function)
      );
    });

    it('should auto-clear after 5 seconds', async () => {
      await badgeService.showError();
      jest.clearAllMocks();

      jest.advanceTimersByTime(5000);

      expect(mockChrome.action.setBadgeText).toHaveBeenCalledWith(
        { text: '' },
        expect.any(Function)
      );
    });
  });
});
