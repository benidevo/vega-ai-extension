import { KeepAliveService } from '@/background/services/KeepAliveService';
import { mockChrome, resetChromeMocks } from '../../../mocks/chrome';

jest.mock('@/utils/logger', () => ({
  Logger: jest.fn().mockImplementation(() => ({
    info: jest.fn(),
    error: jest.fn(),
    warn: jest.fn(),
    debug: jest.fn(),
  })),
}));

mockChrome.storage.local.get = jest.fn((keys, callback) => callback?.({}));
mockChrome.storage.local.set = jest.fn((data, callback) => callback?.());

describe('KeepAliveService', () => {
  let keepAliveService: KeepAliveService;
  let alarmListener: any;

  beforeEach(() => {
    jest.clearAllMocks();
    resetChromeMocks();
    (KeepAliveService as any).instance = undefined;
    keepAliveService = KeepAliveService.getInstance();

    mockChrome.alarms.onAlarm.addListener.mockImplementation(
      (listener: any) => {
        alarmListener = listener;
      }
    );
  });

  describe('initialize', () => {
    it('should clear existing alarm and create new one', async () => {
      await keepAliveService.initialize();

      expect(mockChrome.alarms.clear).toHaveBeenCalledWith('keep-alive');
      expect(mockChrome.alarms.create).toHaveBeenCalledWith('keep-alive', {
        periodInMinutes: 0.5,
        delayInMinutes: 0,
      });
      expect(mockChrome.alarms.onAlarm.addListener).toHaveBeenCalledWith(
        expect.any(Function)
      );
    });
  });

  describe('handleKeepAlive', () => {
    beforeEach(async () => {
      await keepAliveService.initialize();
    });

    it('should handle keep-alive alarm', () => {
      const alarm = { name: 'keep-alive' };
      alarmListener(alarm);

      expect(mockChrome.storage.local.get).toHaveBeenCalledWith(
        ['lastPing'],
        expect.any(Function)
      );
      expect(mockChrome.storage.local.set).toHaveBeenCalledWith({
        lastPing: expect.any(Number),
      });
    });

    it('should ignore alarms with different names', () => {
      const alarm = { name: 'different-alarm' };
      alarmListener(alarm);

      expect(mockChrome.storage.local.get).not.toHaveBeenCalled();
    });
  });

  describe('destroy', () => {
    it('should clear the alarm', async () => {
      await keepAliveService.destroy();

      expect(mockChrome.alarms.clear).toHaveBeenCalledWith('keep-alive');
    });
  });
});
