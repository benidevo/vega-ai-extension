import { Logger } from '@/utils/logger';

/**
 * Manages persistent connection from content script to service worker
 */
export class ContentConnection {
  private port: chrome.runtime.Port | null = null;
  private logger = new Logger('ContentConnection');
  private reconnectTimer: number | null = null;
  private isConnected = false;
  private readonly RECONNECT_DELAY = 1000; // 1 second
  private readonly PING_INTERVAL = 20000; // 20 seconds
  private pingTimer: number | null = null;

  connect(): void {
    if (this.isConnected) return;

    try {
      this.port = chrome.runtime.connect({ name: 'content-script' });
      this.isConnected = true;

      this.setupEventHandlers();
      this.startPingInterval();

      this.logger.info('Connected to service worker');
    } catch (error) {
      this.logger.error('Failed to connect to service worker', error);
      this.scheduleReconnect();
    }
  }

  private setupEventHandlers(): void {
    if (!this.port) return;

    this.port.onDisconnect.addListener(() => {
      this.isConnected = false;
      this.stopPingInterval();

      if (chrome.runtime.lastError) {
        this.logger.error(
          'Disconnected from service worker',
          chrome.runtime.lastError
        );
      }

      this.scheduleReconnect();
    });

    this.port.onMessage.addListener(message => {
      if (message.type === 'CONNECTION_ACK') {
        this.logger.debug('Connection acknowledged');
      } else if (message.type === 'PONG') {
        this.logger.debug('Received pong');
      }
    });
  }

  private startPingInterval(): void {
    this.stopPingInterval();

    this.pingTimer = window.setInterval(() => {
      if (this.isConnected && this.port) {
        try {
          this.port.postMessage({ type: 'PING' });
        } catch (error) {
          this.logger.error('Failed to send ping', error);
          this.isConnected = false;
          this.scheduleReconnect();
        }
      }
    }, this.PING_INTERVAL);
  }

  private stopPingInterval(): void {
    if (this.pingTimer !== null) {
      clearInterval(this.pingTimer);
      this.pingTimer = null;
    }
  }

  private scheduleReconnect(): void {
    if (this.reconnectTimer !== null) return;

    this.reconnectTimer = window.setTimeout(() => {
      this.reconnectTimer = null;
      this.logger.info('Attempting to reconnect...');
      this.connect();
    }, this.RECONNECT_DELAY);
  }

  sendMessage(message: { type: string; [key: string]: unknown }): void {
    if (!this.isConnected || !this.port) {
      this.logger.warn('Not connected, attempting to connect...');
      this.connect();

      setTimeout(() => {
        if (this.isConnected && this.port) {
          this.port.postMessage(message);
        }
      }, 500);
      return;
    }

    try {
      this.port.postMessage(message);
    } catch (error) {
      this.logger.error('Failed to send message', error);
      this.isConnected = false;
      this.scheduleReconnect();
    }
  }

  disconnect(): void {
    this.stopPingInterval();

    if (this.reconnectTimer !== null) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }

    if (this.port) {
      try {
        this.port.disconnect();
      } catch {
        // Ignore errors during cleanup
      }
      this.port = null;
    }

    this.isConnected = false;
    this.logger.info('Disconnected');
  }
}

export const contentConnection = new ContentConnection();
