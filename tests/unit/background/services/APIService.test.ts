import { APIService } from '../../../../src/background/services/api/APIService';

jest.mock('../../../../src/utils/logger', () => ({
  apiLogger: {
    info: jest.fn(),
    error: jest.fn(),
    warn: jest.fn(),
    debug: jest.fn(),
    time: jest.fn(async (_label, fn) => await fn()),
  },
}));

global.fetch = jest.fn();

describe('APIService', () => {
  let apiService: APIService;

  beforeEach(() => {
    jest.clearAllMocks();

    const config = {
      baseUrl: 'http://localhost:8765',
      authEndpoint: '/api/auth',
      timeout: 30000,
      retryAttempts: 3,
    };
    apiService = new APIService(config);
  });

  describe('saveJob', () => {
    const mockJob = {
      title: 'Software Engineer',
      company: 'Tech Corp',
      location: 'San Francisco, CA',
      description: 'Job description',
      sourceUrl: 'https://example.com/job/123',
    };

    it('should save job successfully', async () => {
      const mockResponse = {
        id: '123',
        job: mockJob,
        createdAt: '2024-01-01T00:00:00Z',
      };

      (global.fetch as jest.Mock).mockResolvedValue({
        ok: true,
        json: jest.fn().mockResolvedValue(mockResponse),
      });

      await apiService.initialize();
      const result = await apiService.saveJob(mockJob);

      expect(global.fetch).toHaveBeenCalledWith(
        'http://localhost:8765/api/jobs',
        expect.objectContaining({
          method: 'POST',
          headers: expect.objectContaining({
            'Content-Type': 'application/json',
          }),
          body: JSON.stringify(mockJob),
        })
      );
      expect(result).toEqual(mockResponse);
    });

    it('should include auth token when set', async () => {
      const mockToken = 'test-auth-token';
      apiService.setAuthToken(mockToken);

      (global.fetch as jest.Mock).mockResolvedValue({
        ok: true,
        json: jest.fn().mockResolvedValue({
          id: '123',
          job: mockJob,
          createdAt: '2024-01-01',
        }),
      });

      await apiService.initialize();
      await apiService.saveJob(mockJob);

      expect(global.fetch).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({
          headers: expect.objectContaining({
            Authorization: `Bearer ${mockToken}`,
          }),
        })
      );
    });

    it('should handle API errors', async () => {
      const errorResponse = { message: 'Bad request' };
      (global.fetch as jest.Mock).mockResolvedValue({
        ok: false,
        status: 400,
        statusText: 'Bad Request',
        json: jest.fn().mockResolvedValue(errorResponse),
      });

      await apiService.initialize();
      await expect(apiService.saveJob(mockJob)).rejects.toMatchObject({
        code: 'API_ERROR',
        message: 'Bad request',
      });
    });

    it('should handle network errors', async () => {
      const networkError = new Error('Network error');
      (global.fetch as jest.Mock).mockRejectedValue(networkError);

      await apiService.initialize();
      await expect(apiService.saveJob(mockJob)).rejects.toMatchObject({
        code: 'NETWORK_ERROR',
        message: 'Connection error: Network error',
      });
    });
  });

  describe('initialize', () => {
    it('should initialize successfully', async () => {
      await expect(apiService.initialize()).resolves.not.toThrow();
    });
  });

  describe('destroy', () => {
    it('should destroy successfully', async () => {
      await apiService.initialize();
      await expect(apiService.destroy()).resolves.not.toThrow();
    });
  });
});
