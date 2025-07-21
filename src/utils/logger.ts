export enum LogLevel {
  DEBUG = 0,
  INFO = 1,
  WARN = 2,
  ERROR = 3,
}

interface LogEntry {
  timestamp: number;
  level: LogLevel;
  context: string;
  message: string;
  data?: unknown;
  error?: Error;
}

export class Logger {
  private context: string;
  private static logLevel: LogLevel = LogLevel.INFO;
  private static logs: LogEntry[] = [];
  private static readonly MAX_LOGS = 1000;

  constructor(context: string) {
    this.context = context;
  }

  static setLogLevel(level: LogLevel): void {
    Logger.logLevel = level;
  }

  debug(message: string, data?: unknown): void {
    this.log(LogLevel.DEBUG, message, data);
  }

  info(message: string, data?: unknown): void {
    this.log(LogLevel.INFO, message, data);
  }

  warn(message: string, data?: unknown): void {
    this.log(LogLevel.WARN, message, data);
  }

  error(message: string, error?: unknown, data?: unknown): void {
    this.log(
      LogLevel.ERROR,
      message,
      data,
      error instanceof Error ? error : undefined
    );
  }

  private log(
    level: LogLevel,
    message: string,
    data?: unknown,
    error?: Error
  ): void {
    if (level < Logger.logLevel) {
      return;
    }

    const entry: LogEntry = {
      timestamp: Date.now(),
      level,
      context: this.context,
      message,
      data,
      error,
    };

    // Add to memory store
    Logger.logs.push(entry);

    // Keep only recent logs
    if (Logger.logs.length > Logger.MAX_LOGS) {
      Logger.logs = Logger.logs.slice(-Logger.MAX_LOGS);
    }

    // Console output in development or for warnings/errors
    if (process.env.NODE_ENV === 'development' || level >= LogLevel.WARN) {
      const prefix = `[Vega AI:${this.context}]`;
      const timestamp = new Date(entry.timestamp).toISOString();
      const logMessage = `${prefix} ${timestamp} ${message}`;

      switch (level) {
        case LogLevel.DEBUG:
          console.debug(logMessage, data);
          break;
        case LogLevel.INFO:
          console.log(logMessage, data);
          break;
        case LogLevel.WARN:
          console.warn(logMessage, data);
          break;
        case LogLevel.ERROR:
          console.error(logMessage, error || data);
          break;
      }
    }

    // Store in chrome storage for cross-context access
    if (
      typeof chrome !== 'undefined' &&
      chrome.storage &&
      chrome.storage.local
    ) {
      try {
        const promise = chrome.storage.local.set({
          vega_ai_logs: Logger.logs.slice(-100), // Store last 100 logs
        });
        // Only call catch if it's a promise (not in test environment)
        if (promise && typeof promise.catch === 'function') {
          promise.catch(() => {
            // Ignore storage errors
          });
        }
      } catch {
        // Ignore any errors in test environment
      }
    }
  }

  // Convenience method for timing operations
  time<T>(operation: string, fn: () => T | Promise<T>): T | Promise<T> {
    const start = performance.now();
    this.debug(`Starting ${operation}`);

    try {
      const result = fn();

      if (result instanceof Promise) {
        return result.then(
          value => {
            const duration = performance.now() - start;
            this.debug(`Completed ${operation}`, {
              duration: `${duration.toFixed(2)}ms`,
            });
            return value;
          },
          error => {
            const duration = performance.now() - start;
            this.error(`Failed ${operation}`, error, {
              duration: `${duration.toFixed(2)}ms`,
            });
            throw error;
          }
        );
      } else {
        const duration = performance.now() - start;
        this.debug(`Completed ${operation}`, {
          duration: `${duration.toFixed(2)}ms`,
        });
        return result;
      }
    } catch (error) {
      const duration = performance.now() - start;
      this.error(`Failed ${operation}`, error, {
        duration: `${duration.toFixed(2)}ms`,
      });
      throw error;
    }
  }
}

// Create default loggers for different contexts
export const contentLogger = new Logger('Content');
export const overlayLogger = new Logger('Overlay');
export const apiLogger = new Logger('API');
export const authLogger = new Logger('Auth');

if (process.env.NODE_ENV === 'development') {
  Logger.setLogLevel(LogLevel.DEBUG);
} else {
  Logger.setLogLevel(LogLevel.INFO);
}
