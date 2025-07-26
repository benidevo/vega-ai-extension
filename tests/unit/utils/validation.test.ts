import {
  validatePassword,
  validateUsername,
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
    expect(validatePassword('a'.repeat(64)).isValid).toBe(true);
  });
});

describe('validateUsername', () => {
  it('should require username', () => {
    const result = validateUsername('');
    expect(result.isValid).toBe(false);
    expect(result.error).toBe('Username is required');
  });

  it('should enforce minimum length', () => {
    const result = validateUsername('ab');
    expect(result.isValid).toBe(false);
    expect(result.error).toBe('Username must be at least 3 characters long');
  });

  it('should enforce maximum length', () => {
    const result = validateUsername('a'.repeat(51));
    expect(result.isValid).toBe(false);
    expect(result.error).toBe('Username must be 50 characters or less');
  });

  it('should reject invalid characters', () => {
    const result = validateUsername('user@name');
    expect(result.isValid).toBe(false);
    expect(result.error).toBe(
      'Username can only contain letters, numbers, periods, underscores, and hyphens'
    );
  });

  it('should accept valid usernames', () => {
    expect(validateUsername('user123').isValid).toBe(true);
    expect(validateUsername('user_name').isValid).toBe(true);
    expect(validateUsername('user-name').isValid).toBe(true);
    expect(validateUsername('user.name').isValid).toBe(true);
    expect(validateUsername('abc').isValid).toBe(true);
    expect(validateUsername('a'.repeat(50)).isValid).toBe(true);
  });

  it('should trim whitespace', () => {
    expect(validateUsername('  user123  ').isValid).toBe(true);
  });
});
