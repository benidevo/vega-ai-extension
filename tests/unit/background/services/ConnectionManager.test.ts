import { ConnectionManager } from '@/background/services/ConnectionManager';
import { mockChrome, resetChromeMocks } from '../../../mocks/chrome';

jest.mock('@/utils/logger', () => ({
  Logger: jest.fn().mockImplementation(() => ({
    info: jest.fn(),
    error: jest.fn(),
    warn: jest.fn(),
    debug: jest.fn(),
  })),
}));

describe('ConnectionManager', () => {
  let connectionManager: ConnectionManager;
  let connectListener: any;
  let mockPort: chrome.runtime.Port;

  beforeEach(() => {
    jest.clearAllMocks();
    resetChromeMocks();
    jest.useFakeTimers();

    (ConnectionManager as any).instance = undefined;
    connectionManager = ConnectionManager.getInstance();

    mockPort = {
      name: 'test-port',
      sender: {
        tab: { id: 123, url: 'https://example.com' },
        id: 'ext-123',
      },
      onDisconnect: {
        addListener: jest.fn(),
      },
      onMessage: {
        addListener: jest.fn(),
      },
      postMessage: jest.fn(),
      disconnect: jest.fn(),
    } as any;

    mockChrome.runtime.onConnect.addListener.mockImplementation(
      (listener: any) => {
        connectListener = listener;
      }
    );
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  describe('initialize', () => {
    it('should set up connection listener and cleanup interval', () => {
      connectionManager.initialize();

      expect(mockChrome.runtime.onConnect.addListener).toHaveBeenCalledWith(
        expect.any(Function)
      );

      expect(jest.getTimerCount()).toBe(1);
    });
  });

  describe('handleNewConnection', () => {
    beforeEach(() => {
      connectionManager.initialize();
    });

    it('should add new connection', () => {
      connectListener(mockPort);

      const connections = (connectionManager as any).connections;
      expect(connections.size).toBe(1);

      const connectionId = Array.from(connections.keys())[0];
      const connection = connections.get(connectionId);

      expect(connection).toMatchObject({
        port: mockPort,
        tabId: 123,
        timestamp: expect.any(Number),
      });
    });

    it('should handle connection without tab ID', () => {
      const portWithoutTab = {
        ...mockPort,
        sender: { id: 'ext-123' },
      };

      connectListener(portWithoutTab);

      const connections = (connectionManager as any).connections;
      const connection = Array.from(connections.values())[0] as any;

      expect(connection.tabId).toBeUndefined();
    });

    it('should set up disconnect handler', () => {
      connectListener(mockPort);

      expect(mockPort.onDisconnect.addListener).toHaveBeenCalledWith(
        expect.any(Function)
      );
    });

    it('should remove connection on disconnect', () => {
      let disconnectHandler: any;
      (mockPort.onDisconnect.addListener as jest.Mock).mockImplementation(
        (handler: any) => {
          disconnectHandler = handler;
        }
      );

      connectListener(mockPort);

      const connections = (connectionManager as any).connections;
      expect(connections.size).toBe(1);

      disconnectHandler();

      expect(connections.size).toBe(0);
    });
  });

  describe('cleanupStaleConnections', () => {
    beforeEach(() => {
      connectionManager.initialize();
    });

    it('should remove stale connections', () => {
      const now = Date.now();
      const stalePort = { ...mockPort, name: 'stale-port' };
      const freshPort = { ...mockPort, name: 'fresh-port' };

      const connections = (connectionManager as any).connections;
      connections.set('stale-connection', {
        port: stalePort,
        tabId: 1,
        timestamp: now - 6 * 60 * 1000, // 6 minutes ago
      });
      connections.set('fresh-connection', {
        port: freshPort,
        tabId: 2,
        timestamp: now - 2 * 60 * 1000, // 2 minutes ago
      });

      jest.advanceTimersByTime(60000);

      expect(connections.size).toBe(1);
      expect(connections.has('fresh-connection')).toBe(true);
      expect(connections.has('stale-connection')).toBe(false);
    });

    it('should disconnect stale ports', () => {
      const stalePort = {
        ...mockPort,
        name: 'stale-port',
        disconnect: jest.fn(),
      };

      const connections = (connectionManager as any).connections;
      connections.set('stale-connection', {
        port: stalePort,
        tabId: 1,
        timestamp: Date.now() - 6 * 60 * 1000,
      });

      jest.advanceTimersByTime(60000);

      expect(stalePort.disconnect).toHaveBeenCalled();
    });

    it('should handle disconnect errors gracefully', () => {
      const stalePort = {
        ...mockPort,
        name: 'stale-port',
        disconnect: jest.fn().mockImplementation(() => {
          throw new Error('Disconnect error');
        }),
      };

      const connections = (connectionManager as any).connections;
      connections.set('stale-connection', {
        port: stalePort,
        tabId: 1,
        timestamp: Date.now() - 6 * 60 * 1000,
      });

      expect(() => jest.advanceTimersByTime(60000)).not.toThrow();
      expect(connections.size).toBe(0);
    });
  });

  describe('broadcast', () => {
    beforeEach(() => {
      connectionManager.initialize();
    });

    it('should send message to all connections', () => {
      const port1 = { ...mockPort, postMessage: jest.fn() };
      const port2 = { ...mockPort, postMessage: jest.fn(), name: 'port2' };

      connectListener(port1);
      connectListener(port2);

      const message = { type: 'TEST', data: 'broadcast' };
      connectionManager.broadcast(message);

      expect(port1.postMessage).toHaveBeenCalledWith(message);
      expect(port2.postMessage).toHaveBeenCalledWith(message);
    });

    it('should handle postMessage errors gracefully', () => {
      const port2 = { ...mockPort, postMessage: jest.fn(), name: 'port2' };
      connectListener(port2);

      const port1 = {
        ...mockPort,
        postMessage: jest.fn(),
        name: 'port1',
      };
      connectListener(port1);

      port1.postMessage.mockImplementation(msg => {
        if (msg.type === 'TEST') {
          throw new Error('Post error');
        }
      });

      const message = { type: 'TEST', data: 'broadcast' };

      expect(() => connectionManager.broadcast(message)).not.toThrow();

      expect(port2.postMessage).toHaveBeenCalledWith(message);
    });

    it('should remove failed connections', () => {
      const port1 = {
        ...mockPort,
        postMessage: jest.fn(),
      };

      connectListener(port1);

      port1.postMessage.mockImplementation(msg => {
        if (msg.type === 'TEST') {
          throw new Error('Post error');
        }
      });

      const message = { type: 'TEST', data: 'broadcast' };
      connectionManager.broadcast(message);

      const connections = (connectionManager as any).connections;
      expect(connections.size).toBe(0);
    });
  });

  describe('getActiveConnectionCount', () => {
    beforeEach(() => {
      connectionManager.initialize();
    });

    it('should return the number of active connections', () => {
      expect(connectionManager.getActiveConnectionCount()).toBe(0);

      connectListener(mockPort);
      expect(connectionManager.getActiveConnectionCount()).toBe(1);

      connectListener({ ...mockPort, name: 'port2' } as any);
      expect(connectionManager.getActiveConnectionCount()).toBe(2);
    });

    it('should update count when connections disconnect', () => {
      let disconnectHandler: any;
      (mockPort.onDisconnect.addListener as jest.Mock).mockImplementation(
        (handler: any) => {
          disconnectHandler = handler;
        }
      );

      connectListener(mockPort);
      expect(connectionManager.getActiveConnectionCount()).toBe(1);

      disconnectHandler();
      expect(connectionManager.getActiveConnectionCount()).toBe(0);
    });
  });

  describe('handleMessage', () => {
    beforeEach(() => {
      connectionManager.initialize();
    });

    it('should handle ping messages', () => {
      const port = {
        ...mockPort,
        postMessage: jest.fn(),
        onMessage: {
          addListener: jest.fn(),
        },
      };

      let messageHandler: any;
      port.onMessage.addListener = jest.fn(handler => {
        messageHandler = handler;
      });

      connectListener(port);

      messageHandler({ type: 'PING' });

      expect(port.postMessage).toHaveBeenCalledWith({
        type: 'PONG',
        timestamp: expect.any(Number),
      });
    });

    it('should update connection timestamp on message', () => {
      const port = {
        ...mockPort,
        onMessage: {
          addListener: jest.fn(),
        },
      };

      let messageHandler: any;
      port.onMessage.addListener = jest.fn(handler => {
        messageHandler = handler;
      });

      connectListener(port);

      const connections = (connectionManager as any).connections;
      const connectionId = Array.from(connections.keys())[0];
      const originalTimestamp = connections.get(connectionId).timestamp;

      jest.advanceTimersByTime(100);
      messageHandler({ type: 'SOME_MESSAGE' });

      const updatedTimestamp = connections.get(connectionId).timestamp;
      expect(updatedTimestamp).toBeGreaterThan(originalTimestamp);
    });
  });
});
