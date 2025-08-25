import { PasswordAuthService } from '@/background/services/auth/PasswordAuthService';

jest.mock('@/utils/logger', () => ({
  authLogger: {
    info: jest.fn(),
    error: jest.fn(),
    warn: jest.fn(),
    debug: jest.fn(),
  },
}));

global.fetch = jest.fn();

describe('PasswordAuthService', () => {
  let authService: PasswordAuthService;
  const apiBaseUrl = 'http://localhost:8765';

  beforeEach(() => {
    jest.clearAllMocks();
    (global.fetch as jest.Mock).mockReset();
    authService = new PasswordAuthService(apiBaseUrl);
  });

  describe('type', () => {
    it('should have password type', () => {
      expect(authService.type).toBe('password');
    });
  });

  describe('authenticate', () => {
    it('should authenticate with valid credentials', async () => {
      const mockResponse = {
        token: 'access-token',
        refresh_token: 'refresh-token',
      };

      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        json: async () => mockResponse,
      });

      const result = await authService.authenticate({
        username: 'testuser',
        password: 'testpass',
      });

      expect(global.fetch).toHaveBeenCalledWith(
        `${apiBaseUrl}/api/auth/login`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ username: 'testuser', password: 'testpass' }),
        }
      );

      expect(result).toEqual({
        access_token: 'access-token',
        refresh_token: 'refresh-token',
        expires_at: expect.any(Number),
      });
    });

    it('should throw error when credentials are missing', async () => {
      await expect(authService.authenticate()).rejects.toThrow(
        'Username and password are required for password authentication'
      );
    });

    it('should throw error when username is missing', async () => {
      await expect(
        authService.authenticate({ username: '', password: 'pass' })
      ).rejects.toThrow('Username and password are required');
    });

    it('should throw error when password is missing', async () => {
      await expect(
        authService.authenticate({ username: 'user', password: '' })
      ).rejects.toThrow('Username and password are required');
    });

    it('should handle 401 unauthorized error', async () => {
      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: false,
        status: 401,
        json: async () => ({ error: 'Unauthorized' }),
      });

      await expect(
        authService.authenticate({ username: 'user', password: 'wrong' })
      ).rejects.toThrow(
        'Invalid username or password. Please check your credentials.'
      );
    });

    it('should handle 404 not found error', async () => {
      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: false,
        status: 404,
        json: async () => ({ error: 'Not found' }),
      });

      await expect(
        authService.authenticate({ username: 'user', password: 'pass' })
      ).rejects.toThrow(
        'Authentication service not found. Please check your backend configuration.'
      );
    });

    it('should handle 500+ server errors', async () => {
      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: false,
        status: 500,
        json: async () => ({ error: 'Internal server error' }),
      });

      await expect(
        authService.authenticate({ username: 'user', password: 'pass' })
      ).rejects.toThrow('Server error. Please try again later.');
    });

    it('should handle other HTTP errors with error message', async () => {
      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: false,
        status: 400,
        json: async () => ({ error: 'Bad request details' }),
      });

      await expect(
        authService.authenticate({ username: 'user', password: 'pass' })
      ).rejects.toThrow('Bad request details');
    });

    it('should handle HTTP errors with message field', async () => {
      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: false,
        status: 400,
        json: async () => ({ message: 'Invalid request format' }),
      });

      await expect(
        authService.authenticate({ username: 'user', password: 'pass' })
      ).rejects.toThrow('Invalid request format');
    });

    it('should handle HTTP errors without error details', async () => {
      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: false,
        status: 400,
        json: async () => ({}),
      });

      await expect(
        authService.authenticate({ username: 'user', password: 'pass' })
      ).rejects.toThrow('Unable to sign in. Please try again.');
    });

    it('should handle JSON parse errors', async () => {
      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: false,
        status: 400,
        json: async () => {
          throw new Error('Invalid JSON');
        },
      });

      await expect(
        authService.authenticate({ username: 'user', password: 'pass' })
      ).rejects.toThrow('Authentication failed');
    });

    it('should handle missing token in response', async () => {
      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        json: async () => ({ refresh_token: 'refresh' }),
      });

      await expect(
        authService.authenticate({ username: 'user', password: 'pass' })
      ).rejects.toThrow('Incomplete response from server. Please try again.');
    });

    it('should handle missing refresh_token in response', async () => {
      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        json: async () => ({ token: 'access' }),
      });

      await expect(
        authService.authenticate({ username: 'user', password: 'pass' })
      ).rejects.toThrow('Incomplete response from server. Please try again.');
    });

    it('should handle network errors', async () => {
      (global.fetch as jest.Mock).mockRejectedValueOnce(
        new Error('Network error')
      );

      await expect(
        authService.authenticate({ username: 'user', password: 'pass' })
      ).rejects.toThrow(
        'Cannot connect to local backend. Please ensure your local Vega server is running.'
      );
    });

    it('should handle non-Error exceptions', async () => {
      (global.fetch as jest.Mock).mockRejectedValueOnce('String error');

      await expect(
        authService.authenticate({ username: 'user', password: 'pass' })
      ).rejects.toThrow(
        'Cannot connect to local backend. Please ensure your local Vega server is running.'
      );
    });
  });

  describe('refreshTokens', () => {
    it('should refresh tokens successfully', async () => {
      const mockResponse = {
        token: 'new-access-token',
      };

      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        json: async () => mockResponse,
      });

      const result = await authService.refreshTokens('refresh-token');

      expect(global.fetch).toHaveBeenCalledWith(
        `${apiBaseUrl}/api/auth/refresh`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ refresh_token: 'refresh-token' }),
        }
      );

      expect(result).toEqual({
        access_token: 'new-access-token',
        refresh_token: 'refresh-token',
        expires_at: expect.any(Number),
      });
    });

    it('should handle 401 unauthorized during refresh', async () => {
      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: false,
        status: 401,
      });

      await expect(authService.refreshTokens('refresh-token')).rejects.toThrow(
        'Your session has expired. Please sign in again.'
      );
    });

    it('should handle other HTTP errors during refresh', async () => {
      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: false,
        status: 500,
      });

      await expect(authService.refreshTokens('refresh-token')).rejects.toThrow(
        'Unable to refresh your session. Please sign in again.'
      );
    });

    it('should handle network errors during refresh', async () => {
      (global.fetch as jest.Mock).mockRejectedValueOnce(
        new Error('Network error')
      );

      await expect(authService.refreshTokens('refresh-token')).rejects.toThrow(
        'Network error'
      );
    });
  });

  describe('validateAuth', () => {
    it('should return true for valid token', async () => {
      const result = await authService.validateAuth('valid-token');
      expect(result).toBe(true);
    });

    it('should return false for invalid tokens', async () => {
      expect(await authService.validateAuth('')).toBe(false);
      expect(await authService.validateAuth(null as any)).toBe(false);
      expect(await authService.validateAuth(undefined as any)).toBe(false);
    });
  });
});
