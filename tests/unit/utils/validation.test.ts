import {
  validatePassword,
  validateUsername,
  validateHost,
} from '../../../src/utils/validation';

describe('validatePassword', () => {
  it('should require password', () => {
    const result = validatePassword('');
    expect(result.isValid).toBe(false);
    expect(result.error).toBe('Password is required');
  });

  it('should enforce minimum length', () => {
    const result = validatePassword('1234567');
    expect(result.isValid).toBe(false);
    expect(result.error).toBe('Password must be at least 8 characters long');
  });

  it('should enforce maximum length', () => {
    const result = validatePassword('a'.repeat(65));
    expect(result.isValid).toBe(false);
    expect(result.error).toBe('Password must be 64 characters or less');
  });

  it('should accept valid passwords', () => {
    expect(validatePassword('password123').isValid).toBe(true);
    expect(validatePassword('a'.repeat(8)).isValid).toBe(true);
  });
});

describe('validateUsername', () => {
  it('should require username', () => {
    const result = validateUsername('');
    expect(result.isValid).toBe(false);
    expect(result.error).toBe('Username or email is required');
  });

  it('should enforce minimum length', () => {
    const result = validateUsername('ab');
    expect(result.isValid).toBe(false);
    expect(result.error).toBe('Username must be at least 3 characters long');
  });

  it('should enforce maximum length', () => {
    const result = validateUsername('a'.repeat(101));
    expect(result.isValid).toBe(false);
    expect(result.error).toBe('Username must be 100 characters or less');
  });

  it('should reject invalid characters in usernames', () => {
    const result = validateUsername('user!name');
    expect(result.isValid).toBe(false);
    expect(result.error).toBe(
      'Use a valid email or username (letters, numbers, . _ - only)'
    );
  });

  it('should reject incomplete email addresses', () => {
    const result = validateUsername('user@');
    expect(result.isValid).toBe(false);
    expect(result.error).toBe(
      'Use a valid email or username (letters, numbers, . _ - only)'
    );
  });

  it('should accept valid usernames', () => {
    expect(validateUsername('user123').isValid).toBe(true);
    expect(validateUsername('user_name').isValid).toBe(true);
    expect(validateUsername('user-name').isValid).toBe(true);
    expect(validateUsername('user.name').isValid).toBe(true);
  });

  it('should accept valid email addresses', () => {
    expect(validateUsername('user@example.com').isValid).toBe(true);
    expect(validateUsername('john.doe@company.org').isValid).toBe(true);
    expect(validateUsername('test+tag@email.co.uk').isValid).toBe(true);
    expect(validateUsername('user123@test-domain.com').isValid).toBe(true);
  });

  it('should trim whitespace', () => {
    expect(validateUsername('  user123  ').isValid).toBe(true);
  });
});

describe('validateHost', () => {
  it('should require host', () => {
    const result = validateHost('');
    expect(result.isValid).toBe(false);
    expect(result.error).toBe('Host is required');
  });

  it('should reject empty host after trimming', () => {
    const result = validateHost('   ');
    expect(result.isValid).toBe(false);
    expect(result.error).toBe('Host cannot be empty');
  });

  it('should accept localhost', () => {
    expect(validateHost('localhost').isValid).toBe(true);
    expect(validateHost('localhost:8080').isValid).toBe(true);
    expect(validateHost('localhost:3000').isValid).toBe(true);
  });

  it('should accept valid hostnames', () => {
    expect(validateHost('api.example.com').isValid).toBe(true);
    expect(validateHost('example.com').isValid).toBe(true);
    expect(validateHost('subdomain.example.com').isValid).toBe(true);
    expect(validateHost('api-v2.example.com').isValid).toBe(true);
  });

  it('should accept IP addresses', () => {
    expect(validateHost('192.168.1.1').isValid).toBe(true);
    expect(validateHost('127.0.0.1:8080').isValid).toBe(true);
  });

  it('should accept hosts with valid ports', () => {
    expect(validateHost('example.com:80').isValid).toBe(true);
    expect(validateHost('example.com:65535').isValid).toBe(true);
  });

  it('should reject invalid port numbers', () => {
    let result = validateHost('example.com:0');
    expect(result.isValid).toBe(false);
    expect(result.error).toBe('Port must be between 1 and 65535');

    result = validateHost('example.com:65536');
    expect(result.isValid).toBe(false);
    expect(result.error).toBe('Port must be between 1 and 65535');

    result = validateHost('example.com:99999');
    expect(result.isValid).toBe(false);
    expect(result.error).toBe('Port must be between 1 and 65535');
  });

  it('should reject invalid host formats', () => {
    const result = validateHost('invalid host');
    expect(result.isValid).toBe(false);
    expect(result.error).toBe(
      'Invalid host. Use host:port or a domain (e.g. localhost:8080)'
    );
  });

  it('should reject hosts with special characters', () => {
    expect(validateHost('example@com').isValid).toBe(false);
    expect(validateHost('example com').isValid).toBe(false);
  });
});
