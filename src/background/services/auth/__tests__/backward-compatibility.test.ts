import { PasswordAuthService } from '../PasswordAuthService';

global.fetch = jest.fn();

describe('PasswordAuthService Backward Compatibility', () => {
  let authService: PasswordAuthService;
  const mockApiUrl = 'https://api.example.com';

  beforeEach(() => {
    authService = new PasswordAuthService(mockApiUrl);
    jest.clearAllMocks();
  });

  describe('Login Response Handling', () => {
    it('should handle old API format without expires_at', async () => {
      const oldApiResponse = {
        token: 'access_token_123',
        refresh_token: 'refresh_token_456',
      };

      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        json: async () => oldApiResponse,
      });

      const result = await authService.authenticate({
        username: 'test',
        password: 'password',
      });

      expect(result.access_token).toBe('access_token_123');
      expect(result.refresh_token).toBe('refresh_token_456');
      expect(result.expires_at).toBeGreaterThan(Date.now());
      expect(result.expires_at).toBeLessThanOrEqual(Date.now() + 3600 * 1000);
    });

    it('should handle new API format with expires_at', async () => {
      const expirationUnixTime = Math.floor(Date.now() / 1000) + 7200; // 2 hours from now
      const newApiResponse = {
        token: 'access_token_123',
        refresh_token: 'refresh_token_456',
        expires_at: expirationUnixTime,
      };

      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        json: async () => newApiResponse,
      });

      const result = await authService.authenticate({
        username: 'test',
        password: 'password',
      });

      expect(result.access_token).toBe('access_token_123');
      expect(result.refresh_token).toBe('refresh_token_456');
      expect(result.expires_at).toBe(expirationUnixTime * 1000);
    });
  });

  describe('Refresh Token Response Handling', () => {
    it('should handle old refresh API format (no new refresh_token)', async () => {
      const oldRefreshResponse = {
        token: 'new_access_token_789',
      };

      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        json: async () => oldRefreshResponse,
      });

      const result = await authService.refreshTokens('old_refresh_token');

      expect(result.access_token).toBe('new_access_token_789');
      expect(result.refresh_token).toBe('old_refresh_token');
      expect(result.expires_at).toBeGreaterThan(Date.now());
    });

    it('should handle new refresh API format with token rotation', async () => {
      const expirationUnixTime = Math.floor(Date.now() / 1000) + 3600;
      const newRefreshResponse = {
        token: 'new_access_token_789',
        refresh_token: 'new_refresh_token_101',
        expires_at: expirationUnixTime,
      };

      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        json: async () => newRefreshResponse,
      });

      const result = await authService.refreshTokens('old_refresh_token');

      expect(result.access_token).toBe('new_access_token_789');
      expect(result.refresh_token).toBe('new_refresh_token_101');
      expect(result.expires_at).toBe(expirationUnixTime * 1000);
    });
  });

  describe('Token Validation', () => {
    it('should validate tokens using verify endpoint', async () => {
      const token = 'valid_token_123';

      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        json: async () => ({ valid: true, user_id: 1, username: 'test' }),
      });

      const isValid = await authService.validateAuth(token);
      expect(isValid).toBe(true);
      expect(global.fetch).toHaveBeenCalledWith(
        `${mockApiUrl}/api/auth/verify`,
        {
          method: 'GET',
          headers: {
            Authorization: `Bearer ${token}`,
          },
        }
      );
    });

    it('should return false for invalid tokens via verify endpoint', async () => {
      const token = 'invalid_token';

      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: false,
        status: 401,
      });

      const isValid = await authService.validateAuth(token);
      expect(isValid).toBe(false);
    });

    it('should fallback to basic validation when verify endpoint fails', async () => {
      const jwtToken =
        'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIxMjM0NTY3ODkwIiwibmFtZSI6IkpvaG4gRG9lIiwiaWF0IjoxNTE2MjM5MDIyfQ.SflKxwRJSMeKKF2QT4fwpMeJf36POk6yJV_adQssw5c';

      (global.fetch as jest.Mock).mockRejectedValueOnce(
        new Error('Network error')
      );

      const isValid = await authService.validateAuth(jwtToken);
      expect(isValid).toBe(true); // Falls back to basic JWT check
    });

    it('should reject empty tokens', async () => {
      const isValid = await authService.validateAuth('');
      expect(isValid).toBe(false);
    });

    it('should reject whitespace-only tokens', async () => {
      const isValid = await authService.validateAuth('   ');
      expect(isValid).toBe(false);
    });
  });
});
