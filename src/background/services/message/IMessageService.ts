import { IService } from '../IService';

/**
 * Message service interface for Chrome extension messaging
 */
export interface IMessageService extends IService {
  /**
   * Register a message handler
   */
  on(type: string, handler: MessageHandler): void;

  /**
   * Remove a message handler
   */
  off(type: string, handler?: MessageHandler): void;

  /**
   * Send message to a specific tab
   */
  sendToTab(tabId: number, message: ExtensionMessage): Promise<any>;
}

/**
 * Message handler type
 */
export type MessageHandler = (
  message: ExtensionMessage,
  sender: chrome.runtime.MessageSender,
  sendResponse: (response?: any) => void
) => boolean | void;

/**
 * Extension message interface
 */
export interface ExtensionMessage {
  type: string;
  payload?: any;
  error?: string;
}

/**
 * Common message types
 */
export enum MessageType {
  // Job-related messages
  JOB_EXTRACTED = 'JOB_EXTRACTED',
  SAVE_JOB = 'SAVE_JOB',

  // Auth-related messages
  LOGIN = 'LOGIN',
  LOGOUT = 'LOGOUT'
}
