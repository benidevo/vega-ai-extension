import { IMessageService, MessageHandler, ExtensionMessage } from './IMessageService';

export class MessageService implements IMessageService {
  private handlers: Map<string, Set<MessageHandler>> = new Map();
  private isInitialized = false;
  private messageListener: any;

  async initialize(): Promise<void> {
    if (this.isInitialized) return;

    // Create the main message listener
    this.messageListener = (
      message: ExtensionMessage,
      sender: chrome.runtime.MessageSender,
      sendResponse: (response?: any) => void
    ) => {
      const handlers = this.handlers.get(message.type);
      if (!handlers || handlers.size === 0) {
        return false;
      }

      let isAsync = false;

      handlers.forEach(handler => {
        try {
          const result = handler(message, sender, sendResponse);
          if (result === true) {
            isAsync = true;
          }
        } catch (error) {
          console.error(`Error in message handler for ${message.type}:`, error);
          sendResponse({ error: error instanceof Error ? error.message : 'Handler error' });
        }
      });

      return isAsync;
    };

    // Add the listener to Chrome runtime
    chrome.runtime.onMessage.addListener(this.messageListener);

    this.isInitialized = true;
  }

  async destroy(): Promise<void> {
    if (this.messageListener) {
      chrome.runtime.onMessage.removeListener(this.messageListener);
    }
    this.handlers.clear();
    this.isInitialized = false;
  }

  on(type: string, handler: MessageHandler): void {
    if (!this.handlers.has(type)) {
      this.handlers.set(type, new Set());
    }
    this.handlers.get(type)!.add(handler);
  }

  off(type: string, handler?: MessageHandler): void {
    if (!handler) {
      // Remove all handlers for this type
      this.handlers.delete(type);
    } else {
      // Remove specific handler
      const handlers = this.handlers.get(type);
      if (handlers) {
        handlers.delete(handler);
        if (handlers.size === 0) {
          this.handlers.delete(type);
        }
      }
    }
  }

  async sendToTab(tabId: number, message: ExtensionMessage): Promise<any> {
    return new Promise((resolve, reject) => {
      chrome.tabs.sendMessage(tabId, message, (response) => {
        if (chrome.runtime.lastError) {
          reject(new Error(chrome.runtime.lastError.message));
        } else {
          resolve(response);
        }
      });
    });
  }

}

/**
 * Utility function to create a message
 */
export function createMessage(type: string, payload?: any, error?: string): ExtensionMessage {
  return { type, payload, error };
}
