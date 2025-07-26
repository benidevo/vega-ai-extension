import { MessageService } from '@/background/services/message/MessageService';
import { ExtensionMessage } from '@/background/services/message/IMessageService';
import { mockChrome, resetChromeMocks } from '../../../mocks/chrome';

jest.mock('@/utils/logger', () => ({
  Logger: jest.fn().mockImplementation(() => ({
    info: jest.fn(),
    error: jest.fn(),
    warn: jest.fn(),
    debug: jest.fn(),
  })),
}));

describe('MessageService', () => {
  let messageService: MessageService;
  let messageListener: any;

  beforeEach(() => {
    jest.clearAllMocks();
    resetChromeMocks();
    messageService = new MessageService();

    mockChrome.runtime.onMessage.addListener.mockImplementation(
      (listener: any) => {
        messageListener = listener;
      }
    );
  });

  describe('initialize', () => {
    it('should initialize and add message listener', async () => {
      await messageService.initialize();

      expect(mockChrome.runtime.onMessage.addListener).toHaveBeenCalledWith(
        expect.any(Function)
      );
    });
  });

  describe('destroy', () => {
    it('should remove message listener and clear handlers', async () => {
      await messageService.initialize();

      const handler = jest.fn();
      messageService.on('TEST_TYPE', handler);

      await messageService.destroy();

      expect(mockChrome.runtime.onMessage.removeListener).toHaveBeenCalledWith(
        messageListener
      );

      const handlers = (messageService as any).handlers;
      expect(handlers.size).toBe(0);
    });
  });

  describe('on', () => {
    beforeEach(async () => {
      await messageService.initialize();
    });

    it('should register a message handler', () => {
      const handler = jest.fn();
      messageService.on('TEST_TYPE', handler);

      const handlers = (messageService as any).handlers.get('TEST_TYPE');
      expect(handlers).toBeDefined();
      expect(handlers.has(handler)).toBe(true);
    });

    it('should register multiple handlers for same type', () => {
      const handler1 = jest.fn();
      const handler2 = jest.fn();

      messageService.on('TEST_TYPE', handler1);
      messageService.on('TEST_TYPE', handler2);

      const handlers = (messageService as any).handlers.get('TEST_TYPE');
      expect(handlers.size).toBe(2);
      expect(handlers.has(handler1)).toBe(true);
      expect(handlers.has(handler2)).toBe(true);
    });

    it('should register handlers for different types', () => {
      const handler1 = jest.fn();
      const handler2 = jest.fn();

      messageService.on('TYPE_1', handler1);
      messageService.on('TYPE_2', handler2);

      expect((messageService as any).handlers.get('TYPE_1').has(handler1)).toBe(
        true
      );
      expect((messageService as any).handlers.get('TYPE_2').has(handler2)).toBe(
        true
      );
    });
  });

  describe('off', () => {
    beforeEach(async () => {
      await messageService.initialize();
    });

    it('should remove a specific handler', () => {
      const handler1 = jest.fn();
      const handler2 = jest.fn();

      messageService.on('TEST_TYPE', handler1);
      messageService.on('TEST_TYPE', handler2);
      messageService.off('TEST_TYPE', handler1);

      const handlers = (messageService as any).handlers.get('TEST_TYPE');
      expect(handlers.size).toBe(1);
      expect(handlers.has(handler1)).toBe(false);
      expect(handlers.has(handler2)).toBe(true);
    });

    it('should remove the Set when last handler is removed', () => {
      const handler = jest.fn();
      messageService.on('TEST_TYPE', handler);
      messageService.off('TEST_TYPE', handler);

      expect((messageService as any).handlers.has('TEST_TYPE')).toBe(false);
    });
  });

  describe('sendToTab', () => {
    beforeEach(async () => {
      await messageService.initialize();
    });

    it('should send message to tab successfully', async () => {
      const tabId = 123;
      const message: ExtensionMessage = {
        type: 'TEST_MESSAGE',
        payload: { data: 'test' },
      };
      const mockResponse = { success: true };

      (mockChrome.tabs.sendMessage as jest.Mock).mockImplementation(
        (_tabId: number, _message: any, callback?: (response: any) => void) => {
          callback?.(mockResponse);
        }
      );

      const response = await messageService.sendToTab(tabId, message);

      expect(mockChrome.tabs.sendMessage).toHaveBeenCalledWith(
        tabId,
        message,
        expect.any(Function)
      );
      expect(response).toEqual(mockResponse);
    });

    it('should handle chrome runtime errors', async () => {
      const tabId = 123;
      const message: ExtensionMessage = {
        type: 'TEST_MESSAGE',
        payload: { data: 'test' },
      };

      mockChrome.runtime.lastError = { message: 'Tab not found' };
      (mockChrome.tabs.sendMessage as jest.Mock).mockImplementation(
        (_tabId: number, _message: any, callback?: (response: any) => void) => {
          callback?.(undefined);
        }
      );

      await expect(messageService.sendToTab(tabId, message)).rejects.toThrow(
        'Tab not found'
      );

      mockChrome.runtime.lastError = null;
    });
  });

  describe('message handling', () => {
    beforeEach(async () => {
      await messageService.initialize();
    });

    it('should handle messages with registered handlers', () => {
      const handler = jest.fn().mockReturnValue(false);
      const sendResponse = jest.fn();
      const message: ExtensionMessage = {
        type: 'TEST_TYPE',
        payload: { data: 'test' },
      };
      const sender = { tab: { id: 123 } } as chrome.runtime.MessageSender;

      messageService.on('TEST_TYPE', handler);

      const result = messageListener(message, sender, sendResponse);

      expect(handler).toHaveBeenCalledWith(message, sender, sendResponse);
      expect(result).toBe(false);
    });

    it('should handle async handlers', () => {
      const handler = jest.fn().mockReturnValue(true); // Return true for async
      const sendResponse = jest.fn();
      const message: ExtensionMessage = {
        type: 'ASYNC_TYPE',
        payload: { data: 'test' },
      };
      const sender = {} as chrome.runtime.MessageSender;

      messageService.on('ASYNC_TYPE', handler);

      const result = messageListener(message, sender, sendResponse);

      expect(handler).toHaveBeenCalledWith(message, sender, sendResponse);
      expect(result).toBe(true);
    });

    it('should handle multiple handlers for same message type', () => {
      const handler1 = jest.fn().mockReturnValue(false);
      const handler2 = jest.fn().mockReturnValue(true); // One async handler
      const sendResponse = jest.fn();
      const message: ExtensionMessage = {
        type: 'MULTI_TYPE',
        payload: { data: 'test' },
      };
      const sender = {} as chrome.runtime.MessageSender;

      messageService.on('MULTI_TYPE', handler1);
      messageService.on('MULTI_TYPE', handler2);

      const result = messageListener(message, sender, sendResponse);

      expect(handler1).toHaveBeenCalled();
      expect(handler2).toHaveBeenCalled();
      expect(result).toBe(true);
    });

    it('should handle messages with no registered handlers', () => {
      const sendResponse = jest.fn();
      const message: ExtensionMessage = {
        type: 'UNHANDLED_TYPE',
        payload: { data: 'test' },
      };
      const sender = {} as chrome.runtime.MessageSender;

      const result = messageListener(message, sender, sendResponse);

      expect(result).toBe(false);
      expect(sendResponse).not.toHaveBeenCalled();
    });

    it('should handle handler errors', () => {
      const handler = jest.fn().mockImplementation(() => {
        throw new Error('Handler error');
      });
      const sendResponse = jest.fn();
      const message: ExtensionMessage = {
        type: 'ERROR_TYPE',
        payload: { data: 'test' },
      };
      const sender = {} as chrome.runtime.MessageSender;

      messageService.on('ERROR_TYPE', handler);

      const result = messageListener(message, sender, sendResponse);

      expect(handler).toHaveBeenCalled();
      expect(sendResponse).toHaveBeenCalledWith({
        error: 'Handler error',
      });
      expect(result).toBe(false);
    });

    it('should continue processing other handlers after one fails', () => {
      const handler1 = jest.fn().mockImplementation(() => {
        throw new Error('Handler 1 error');
      });
      const handler2 = jest.fn().mockReturnValue(false);
      const sendResponse = jest.fn();
      const message: ExtensionMessage = {
        type: 'PARTIAL_ERROR_TYPE',
        payload: { data: 'test' },
      };
      const sender = {} as chrome.runtime.MessageSender;

      messageService.on('PARTIAL_ERROR_TYPE', handler1);
      messageService.on('PARTIAL_ERROR_TYPE', handler2);

      messageListener(message, sender, sendResponse);

      expect(handler1).toHaveBeenCalled();
      expect(handler2).toHaveBeenCalled();
      expect(sendResponse).toHaveBeenCalledWith({
        error: 'Handler 1 error',
      });
    });
  });
});
