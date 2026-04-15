export interface ValidationResult {
  isValid: boolean;
  error?: string;
}

export function validatePassword(password: string): ValidationResult {
  if (!password) {
    return { isValid: false, error: 'Password is required' };
  }

  if (password.length < 8) {
    return {
      isValid: false,
      error: 'Password must be at least 8 characters long',
    };
  }

  if (password.length > 64) {
    return { isValid: false, error: 'Password must be 64 characters or less' };
  }

  return { isValid: true };
}

export function validateUsername(username: string): ValidationResult {
  if (!username) {
    return { isValid: false, error: 'Username or email is required' };
  }

  const trimmed = username.trim();

  if (trimmed.length < 3) {
    return {
      isValid: false,
      error: 'Username must be at least 3 characters long',
    };
  }

  if (trimmed.length > 100) {
    return { isValid: false, error: 'Username must be 100 characters or less' };
  }

  const emailPattern = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;
  if (emailPattern.test(trimmed)) {
    return { isValid: true };
  }

  const usernamePattern = /^[a-zA-Z0-9._-]+$/;
  if (!usernamePattern.test(trimmed)) {
    return {
      isValid: false,
      error: 'Use a valid email or username (letters, numbers, . _ - only)',
    };
  }

  return { isValid: true };
}

export function validateHost(host: string): ValidationResult {
  if (!host) {
    return { isValid: false, error: 'Host is required' };
  }

  const trimmed = host.trim();

  if (trimmed.length < 1) {
    return { isValid: false, error: 'Host cannot be empty' };
  }

  // Basic pattern for hostname with optional port
  // Allows: localhost, localhost:8080, api.example.com, 192.168.1.1:3000
  const hostPattern =
    /^([a-zA-Z0-9]([a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?\.)*[a-zA-Z0-9]([a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?(:\d{1,5})?$/;
  const ipPattern = /^(\d{1,3}\.){3}\d{1,3}(:\d{1,5})?$/;

  if (
    !hostPattern.test(trimmed) &&
    !ipPattern.test(trimmed) &&
    trimmed !== 'localhost' &&
    !trimmed.startsWith('localhost:')
  ) {
    return {
      isValid: false,
      error: 'Invalid host. Use host:port or a domain (e.g. localhost:8080)',
    };
  }

  // Check port range if port is specified
  if (trimmed.includes(':')) {
    const port = parseInt(trimmed.split(':').pop() || '0');
    if (isNaN(port) || port < 1 || port > 65535) {
      return {
        isValid: false,
        error: 'Port must be between 1 and 65535',
      };
    }
  }

  return { isValid: true };
}
