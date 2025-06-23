import { Logger } from '@/utils/logger';

/**
 * Service to keep the extension's service worker active
 * Uses Chrome alarms API to periodically wake up the service worker
 */
export class KeepAliveService {
  private static instance: KeepAliveService;
  private logger = new Logger('KeepAliveService');
  private readonly ALARM_NAME = 'keep-alive';
  private readonly ALARM_INTERVAL_MINUTES = 0.5; // 30 seconds

  private constructor() {}

  static getInstance(): KeepAliveService {
    if (!KeepAliveService.instance) {
      KeepAliveService.instance = new KeepAliveService();
    }
    return KeepAliveService.instance;
  }

  async initialize(): Promise<void> {
    await chrome.alarms.clear(this.ALARM_NAME);

    await chrome.alarms.create(this.ALARM_NAME, {
      periodInMinutes: this.ALARM_INTERVAL_MINUTES,
      delayInMinutes: 0,
    });

    chrome.alarms.onAlarm.addListener(alarm => {
      if (alarm.name === this.ALARM_NAME) {
        this.handleKeepAlive();
      }
    });

    this.logger.info('Keep-alive service initialized');
  }

  private handleKeepAlive(): void {
    // Simple ping to keep service worker active
    this.logger.debug('Keep-alive ping');

    // Perform a simple storage operation to ensure activity
    chrome.storage.local.get(['lastPing'], _result => {
      chrome.storage.local.set({ lastPing: Date.now() });
    });
  }

  async destroy(): Promise<void> {
    await chrome.alarms.clear(this.ALARM_NAME);
    this.logger.info('Keep-alive service destroyed');
  }
}

export const keepAliveService = KeepAliveService.getInstance();
