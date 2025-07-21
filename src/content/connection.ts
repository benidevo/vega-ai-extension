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
  private isContextValid = true;

  connect(): void {
    if (this.isConnected) return;

    // Check if extension context is still valid
    if (!this.checkContextValidity()) {
      this.logger.warn('Extension context is invalid, cannot connect');
      this.cleanup();
      return;
    }

    try {
      this.port = chrome.runtime.connect({ name: 'content-script' });
      this.isConnected = true;

      this.setupEventHandlers();
      this.startPingInterval();

      this.logger.info('Connected to service worker');
    } catch (error) {
      // Check if it's a context invalidated error
      if (
        error instanceof Error &&
        error.message.includes('Extension context invalidated')
      ) {
        this.logger.warn('Extension context invalidated during connection');
        this.isContextValid = false;
        this.cleanup();
      } else {
        this.logger.error('Failed to connect to service worker', error);
        this.scheduleReconnect();
      }
    }
  }

  private checkContextValidity(): boolean {
    try {
      // chrome.runtime.id is undefined when context is invalidated
      if (!chrome.runtime?.id) {
        this.isContextValid = false;
        return false;
      }
      return true;
    } catch (error) {
      // Any error accessing chrome.runtime means context is invalid
      this.isContextValid = false;
      return false;
    }
  }

  private setupEventHandlers(): void {
    if (!this.port) return;

    this.port.onDisconnect.addListener(() => {
      this.isConnected = false;
      this.stopPingInterval();

      const error = chrome.runtime.lastError;
      if (error) {
        const errorMessage =
          typeof error === 'object' && error.message
            ? error.message
            : typeof error === 'string'
              ? error
              : 'Unknown error';
        this.logger.error('Disconnected from service worker', errorMessage);
      } else {
        this.logger.info('Disconnected from service worker');
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
      // Check context validity before sending ping
      if (!this.checkContextValidity()) {
        this.logger.warn('Context invalidated during ping interval');
        this.cleanup();
        return;
      }

      if (this.isConnected && this.port) {
        try {
          this.port.postMessage({ type: 'PING' });
        } catch (error) {
          if (
            error instanceof Error &&
            error.message.includes('Extension context invalidated')
          ) {
            this.logger.warn('Extension context invalidated during ping');
            this.isContextValid = false;
            this.cleanup();
          } else {
            this.logger.error('Failed to send ping', error);
            this.isConnected = false;
            this.scheduleReconnect();
          }
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

    // Don't attempt to reconnect if context is invalid
    if (!this.isContextValid) {
      this.logger.info('Skipping reconnect - context is invalid');
      return;
    }

    this.reconnectTimer = window.setTimeout(() => {
      this.reconnectTimer = null;

      // Check context validity before attempting reconnect
      if (!this.checkContextValidity()) {
        this.logger.warn('Context invalidated, stopping reconnection attempts');
        this.cleanup();
        return;
      }

      this.logger.info('Attempting to reconnect...');
      this.connect();
    }, this.RECONNECT_DELAY);
  }

  sendMessage(message: { type: string; [key: string]: unknown }): void {
    // Check context validity first
    if (!this.checkContextValidity()) {
      this.logger.warn('Cannot send message - extension context is invalid');
      this.cleanup();
      return;
    }

    if (!this.isConnected || !this.port) {
      this.logger.warn('Not connected, attempting to connect...');
      this.connect();

      setTimeout(() => {
        if (this.isConnected && this.port && this.checkContextValidity()) {
          try {
            this.port.postMessage(message);
          } catch (error) {
            this.handleMessageError(error);
          }
        }
      }, 500);
      return;
    }

    try {
      this.port.postMessage(message);
    } catch (error) {
      this.handleMessageError(error);
    }
  }

  private handleMessageError(error: unknown): void {
    if (
      error instanceof Error &&
      error.message.includes('Extension context invalidated')
    ) {
      this.logger.warn('Extension context invalidated while sending message');
      this.isContextValid = false;
      this.cleanup();
    } else {
      this.logger.error('Failed to send message', error);
      this.isConnected = false;
      this.scheduleReconnect();
    }
  }

  disconnect(): void {
    this.cleanup();
    this.logger.info('Disconnected');
  }

  private cleanup(): void {
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

    // If context is invalid, notify that cleanup is complete
    if (!this.isContextValid) {
      this.logger.info('Cleaned up due to invalid extension context');
    }
  }

  isValidContext(): boolean {
    return this.isContextValid && this.checkContextValidity();
  }
}

export const contentConnection = new ContentConnection();
