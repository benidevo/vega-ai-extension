import '@testing-library/jest-dom';
import { chrome } from './mocks/chrome';

// Mock Chrome API globally
global.chrome = chrome as any;

// Mock console methods to reduce noise in tests
global.console = {
  ...console,
  log: jest.fn(),
  error: jest.fn(),
  warn: jest.fn(),
  info: jest.fn(),
  debug: jest.fn(),
};

