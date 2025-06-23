import { Logger } from '@/utils/logger';

interface Connection {
  port: chrome.runtime.Port;
  tabId?: number;
  timestamp: number;
}

/**
 * Manages persistent connections between content scripts and service worker
 * Helps prevent service worker from going inactive due to lost connections
 */
export class ConnectionManager {
  private static instance: ConnectionManager;
  private logger = new Logger('ConnectionManager');
  private connections = new Map<string, Connection>();
  private reconnectAttempts = new Map<string, number>();
  private readonly MAX_RECONNECT_ATTEMPTS = 3;

  private constructor() {}

  static getInstance(): ConnectionManager {
    if (!ConnectionManager.instance) {
      ConnectionManager.instance = new ConnectionManager();
    }
    return ConnectionManager.instance;
  }

  initialize(): void {
    chrome.runtime.onConnect.addListener(port => {
      this.handleNewConnection(port);
    });

    // Periodically clean up stale connections
    setInterval(() => {
      this.cleanupStaleConnections();
    }, 60000); // Every minute

    this.logger.info('Connection manager initialized');
  }

  private handleNewConnection(port: chrome.runtime.Port): void {
    const connectionId = this.generateConnectionId(port);

    this.connections.set(connectionId, {
      port,
      tabId: port.sender?.tab?.id,
      timestamp: Date.now(),
    });

    this.logger.debug(`New connection established: ${connectionId}`);

    port.onDisconnect.addListener(() => {
      this.handleDisconnection(connectionId);
    });

    // Handle messages
    port.onMessage.addListener(message => {
      this.handleMessage(connectionId, message);
    });

    // Send acknowledgment
    port.postMessage({ type: 'CONNECTION_ACK', connectionId });
  }

  private handleDisconnection(connectionId: string): void {
    const connection = this.connections.get(connectionId);

    if (connection) {
      this.logger.info(`Connection disconnected: ${connectionId}`);
      this.connections.delete(connectionId);

      // Check if it was an unexpected disconnection
      if (chrome.runtime.lastError) {
        this.logger.error(
          `Disconnection error: ${chrome.runtime.lastError.message}`,
          chrome.runtime.lastError
        );
      }
    }
  }

  private handleMessage(
    connectionId: string,
    message: { type: string; [key: string]: unknown }
  ): void {
    const connection = this.connections.get(connectionId);

    if (connection) {
      // Update timestamp to show activity
      connection.timestamp = Date.now();

      // Handle ping messages to keep connection alive
      if (message.type === 'PING') {
        connection.port.postMessage({ type: 'PONG', timestamp: Date.now() });
      }
    }
  }

  private cleanupStaleConnections(): void {
    const now = Date.now();
    const staleThreshold = 5 * 60 * 1000; // 5 minutes

    for (const [connectionId, connection] of this.connections.entries()) {
      if (now - connection.timestamp > staleThreshold) {
        this.logger.warn(`Cleaning up stale connection: ${connectionId}`);

        try {
          connection.port.disconnect();
        } catch {
          // Port might already be disconnected
        }

        this.connections.delete(connectionId);
      }
    }
  }

  private generateConnectionId(port: chrome.runtime.Port): string {
    const tabId = port.sender?.tab?.id || 'unknown';
    const timestamp = Date.now();
    return `${port.name}-${tabId}-${timestamp}`;
  }

  broadcast(message: { type: string; [key: string]: unknown }): void {
    for (const [connectionId, connection] of this.connections.entries()) {
      try {
        connection.port.postMessage(message);
      } catch (error) {
        this.logger.error(`Failed to send message to ${connectionId}`, error);
        this.connections.delete(connectionId);
      }
    }
  }

  getActiveConnectionCount(): number {
    return this.connections.size;
  }

  destroy(): void {
    for (const connection of this.connections.values()) {
      try {
        connection.port.disconnect();
      } catch {
        // Ignore errors during cleanup
      }
    }

    this.connections.clear();
    this.reconnectAttempts.clear();
    this.logger.info('Connection manager destroyed');
  }
}

export const connectionManager = ConnectionManager.getInstance();
