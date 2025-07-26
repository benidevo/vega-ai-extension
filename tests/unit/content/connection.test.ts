import { ContentConnection } from '@/content/connection';
import { mockChrome, resetChromeMocks } from '../../mocks/chrome';

jest.mock('@/utils/logger', () => ({
  Logger: jest.fn().mockImplementation(() => ({
    info: jest.fn(),
    error: jest.fn(),
    warn: jest.fn(),
    debug: jest.fn(),
  })),
}));

describe('ContentConnection', () => {
  let contentConnection: ContentConnection;
  let mockPort: chrome.runtime.Port;

  beforeEach(() => {
    jest.clearAllMocks();
    resetChromeMocks();
    jest.useFakeTimers();

    mockPort = {
      name: 'content-script',
      postMessage: jest.fn(),
      disconnect: jest.fn(),
      onDisconnect: {
        addListener: jest.fn(),
      },
      onMessage: {
        addListener: jest.fn(),
      },
    } as any;

    mockChrome.runtime.id = 'test-extension-id';
    mockChrome.runtime.connect = jest.fn().mockReturnValue(mockPort);

    contentConnection = new ContentConnection();
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  describe('connect', () => {
    it('should establish connection to service worker', () => {
      contentConnection.connect();

      expect(mockChrome.runtime.connect).toHaveBeenCalledWith({
        name: 'content-script',
      });
      expect(mockPort.onDisconnect.addListener).toHaveBeenCalled();
      expect(mockPort.onMessage.addListener).toHaveBeenCalled();
    });

    it('should not connect if already connected', () => {
      contentConnection.connect();
      jest.clearAllMocks();

      contentConnection.connect();

      expect(mockChrome.runtime.connect).not.toHaveBeenCalled();
    });

    it('should handle connection errors', () => {
      mockChrome.runtime.connect = jest.fn().mockImplementation(() => {
        throw new Error('Connection failed');
      });

      contentConnection.connect();

      expect(mockChrome.runtime.connect).toHaveBeenCalled();
      expect(jest.getTimerCount()).toBe(1);
    });

    it('should handle extension context invalidated error', () => {
      mockChrome.runtime.connect = jest.fn().mockImplementation(() => {
        throw new Error('Extension context invalidated');
      });

      contentConnection.connect();

      expect(mockChrome.runtime.connect).toHaveBeenCalled();
      expect(jest.getTimerCount()).toBe(0);
    });

    it('should not connect if extension context is invalid', () => {
      mockChrome.runtime.id = undefined;

      contentConnection.connect();

      expect(mockChrome.runtime.connect).not.toHaveBeenCalled();
    });
  });

  describe('disconnect', () => {
    it('should disconnect and cleanup', () => {
      contentConnection.connect();
      contentConnection.disconnect();

      expect(mockPort.disconnect).toHaveBeenCalled();
      expect(jest.getTimerCount()).toBe(0);
    });
  });

  describe('sendMessage', () => {
    it('should send message when connected', () => {
      contentConnection.connect();
      const message = { type: 'TEST_MESSAGE', data: 'test' };

      contentConnection.sendMessage(message);

      expect(mockPort.postMessage).toHaveBeenCalledWith(message);
    });

    it('should attempt to connect if not connected', () => {
      const message = { type: 'TEST_MESSAGE', data: 'test' };

      contentConnection.sendMessage(message);

      expect(mockChrome.runtime.connect).toHaveBeenCalled();

      jest.advanceTimersByTime(500);

      expect(mockPort.postMessage).toHaveBeenCalledWith(message);
    });

    it('should handle send errors', () => {
      contentConnection.connect();
      mockPort.postMessage = jest.fn().mockImplementation(() => {
        throw new Error('Send failed');
      });

      const message = { type: 'TEST_MESSAGE', data: 'test' };
      contentConnection.sendMessage(message);

      expect(mockPort.postMessage).toHaveBeenCalled();
      expect(jest.getTimerCount()).toBeGreaterThan(0);
    });

    it('should handle extension context invalidated during send', () => {
      contentConnection.connect();
      mockPort.postMessage = jest.fn().mockImplementation(() => {
        throw new Error('Extension context invalidated');
      });

      const message = { type: 'TEST_MESSAGE', data: 'test' };
      contentConnection.sendMessage(message);

      expect(mockPort.postMessage).toHaveBeenCalled();
      expect(mockPort.disconnect).toHaveBeenCalled();
    });

    it('should not send message if context is invalid', () => {
      contentConnection.connect();
      mockChrome.runtime.id = undefined;

      const message = { type: 'TEST_MESSAGE', data: 'test' };
      contentConnection.sendMessage(message);

      expect(mockPort.postMessage).not.toHaveBeenCalled();
    });
  });

  describe('ping mechanism', () => {
    it('should start ping interval on connect', () => {
      contentConnection.connect();

      expect(jest.getTimerCount()).toBeGreaterThan(0);

      jest.advanceTimersByTime(20000);

      expect(mockPort.postMessage).toHaveBeenCalledWith({ type: 'PING' });
    });

    it('should handle ping errors', () => {
      contentConnection.connect();
      mockPort.postMessage = jest.fn().mockImplementation(message => {
        if (message.type === 'PING') {
          throw new Error('Ping failed');
        }
      });

      jest.advanceTimersByTime(20000);

      expect(mockPort.postMessage).toHaveBeenCalledWith({ type: 'PING' });
      expect(jest.getTimerCount()).toBeGreaterThan(1);
    });

    it('should stop ping on context invalidation', () => {
      contentConnection.connect();
      jest.clearAllMocks();

      mockChrome.runtime.id = undefined;

      jest.advanceTimersByTime(20000);

      expect(mockPort.postMessage).not.toHaveBeenCalled();
      expect(mockPort.disconnect).toHaveBeenCalled();
    });
  });

  describe('disconnect handler', () => {
    it('should handle disconnect and schedule reconnect', () => {
      let disconnectHandler: any;
      mockPort.onDisconnect.addListener = jest.fn(handler => {
        disconnectHandler = handler;
      });

      contentConnection.connect();
      disconnectHandler();

      expect(jest.getTimerCount()).toBeGreaterThan(0);

      jest.advanceTimersByTime(1000);

      expect(mockChrome.runtime.connect).toHaveBeenCalledTimes(2);
    });

    it('should handle disconnect with runtime error', () => {
      let disconnectHandler: any;
      mockPort.onDisconnect.addListener = jest.fn(handler => {
        disconnectHandler = handler;
      });

      contentConnection.connect();
      mockChrome.runtime.lastError = { message: 'Connection lost' };

      disconnectHandler();

      expect(jest.getTimerCount()).toBeGreaterThan(0);
      mockChrome.runtime.lastError = null;
    });
  });

  describe('message handler', () => {
    it('should handle CONNECTION_ACK message', () => {
      let messageHandler: any;
      mockPort.onMessage.addListener = jest.fn(handler => {
        messageHandler = handler;
      });

      contentConnection.connect();
      messageHandler({ type: 'CONNECTION_ACK' });

      expect(mockPort.onMessage.addListener).toHaveBeenCalled();
    });

    it('should handle PONG message', () => {
      let messageHandler: any;
      mockPort.onMessage.addListener = jest.fn(handler => {
        messageHandler = handler;
      });

      contentConnection.connect();
      messageHandler({ type: 'PONG' });

      expect(mockPort.onMessage.addListener).toHaveBeenCalled();
    });
  });

  describe('isValidContext', () => {
    it('should return true when context is valid', () => {
      expect(contentConnection.isValidContext()).toBe(true);
    });

    it('should return false when runtime id is missing', () => {
      mockChrome.runtime.id = undefined;
      expect(contentConnection.isValidContext()).toBe(false);
    });

    it('should return false after context invalidation', () => {
      contentConnection.connect();
      mockPort.postMessage = jest.fn().mockImplementation(() => {
        throw new Error('Extension context invalidated');
      });

      contentConnection.sendMessage({ type: 'TEST' });

      expect(contentConnection.isValidContext()).toBe(false);
    });
  });

  describe('reconnect mechanism', () => {
    it('should not reconnect if context is invalid', () => {
      let disconnectHandler: any;
      mockPort.onDisconnect.addListener = jest.fn(handler => {
        disconnectHandler = handler;
      });

      contentConnection.connect();
      mockChrome.runtime.id = undefined;

      disconnectHandler();
      jest.advanceTimersByTime(1000);

      expect(mockChrome.runtime.connect).toHaveBeenCalledTimes(1);
    });

    it('should not schedule multiple reconnects', () => {
      contentConnection.connect();
      mockChrome.runtime.connect = jest.fn().mockImplementation(() => {
        throw new Error('Connection failed');
      });

      contentConnection.connect();
      jest.clearAllMocks();

      contentConnection.sendMessage({ type: 'TEST' });
      contentConnection.sendMessage({ type: 'TEST2' });

      expect(jest.getTimerCount()).toBe(1);
    });
  });
});
