import { APIService } from '../../../../src/background/services/api/APIService';
import { apiLogger } from '../../../../src/utils/logger';

jest.mock('../../../../src/utils/logger', () => ({
  apiLogger: {
    info: jest.fn(),
    error: jest.fn(),
    warn: jest.fn(),
    debug: jest.fn(),
    time: jest.fn(),
  },
}));

global.fetch = jest.fn();

describe('APIService', () => {
  let apiService: APIService;

  beforeEach(() => {
    jest.clearAllMocks();
    jest.resetAllMocks();
    (global.fetch as jest.Mock).mockClear();
    jest.useFakeTimers();

    (apiLogger.time as jest.Mock).mockImplementation((label, fn) => fn());

    const config = {
      baseUrl: 'http://localhost:8765',
      authEndpoint: '/api/auth',
      timeout: 30000,
      retryAttempts: 3,
      retryDelays: {
        base: 1000,
        max: 8000,
        jitterPercent: 25,
      },
    };
    apiService = new APIService(config);
  });

  afterEach(() => {
    jest.useRealTimers();
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

      (global.fetch as jest.Mock).mockImplementation(() => {
        return Promise.resolve({
          ok: true,
          json: jest.fn().mockResolvedValue(mockResponse),
        });
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
          signal: expect.any(AbortSignal),
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

  describe('retry logic', () => {
    const mockJob = {
      title: 'Software Engineer',
      company: 'Tech Corp',
      location: 'San Francisco, CA',
      description: 'Job description',
      sourceUrl: 'https://example.com/job/123',
    };

    beforeEach(async () => {
      await apiService.initialize();
    });

    it('should retry on network errors with exponential backoff', async () => {
      const networkError = new Error('Network error');
      (global.fetch as jest.Mock)
        .mockRejectedValueOnce(networkError)
        .mockRejectedValueOnce(networkError)
        .mockResolvedValueOnce({
          ok: true,
          json: jest.fn().mockResolvedValue({
            id: '123',
            job: mockJob,
            createdAt: '2024-01-01',
          }),
        });

      const savePromise = apiService.saveJob(mockJob);

      expect(global.fetch).toHaveBeenCalledTimes(1);

      await jest.advanceTimersByTimeAsync(1500);
      expect(global.fetch).toHaveBeenCalledTimes(2);

      await jest.advanceTimersByTimeAsync(2500);
      expect(global.fetch).toHaveBeenCalledTimes(3);

      const result = await savePromise;
      expect(result.id).toBe('123');
    });

    it('should respect maximum retry attempts', async () => {
      const networkError = new Error('Network error');
      (global.fetch as jest.Mock).mockRejectedValue(networkError);

      const savePromise = apiService.saveJob(mockJob);

      const rejectPromise = expect(savePromise).rejects.toMatchObject({
        code: 'NETWORK_ERROR',
        message: expect.stringContaining('Connection error'),
      });

      for (let i = 0; i < 3; i++) {
        await jest.advanceTimersByTimeAsync(10000);
      }

      await rejectPromise;
      expect(global.fetch).toHaveBeenCalledTimes(3);
    }, 10000);

    it('should apply jitter to retry delays', async () => {
      const mockRandom = jest.spyOn(Math, 'random');
      mockRandom.mockReturnValueOnce(0);
      mockRandom.mockReturnValueOnce(1);

      const networkError = new Error('Network error');
      (global.fetch as jest.Mock)
        .mockRejectedValueOnce(networkError)
        .mockRejectedValueOnce(networkError)
        .mockResolvedValueOnce({
          ok: true,
          json: jest.fn().mockResolvedValue({
            id: '123',
            job: mockJob,
            createdAt: '2024-01-01',
          }),
        });

      const savePromise = apiService.saveJob(mockJob);

      await jest.advanceTimersByTimeAsync(750);
      expect(global.fetch).toHaveBeenCalledTimes(2);

      await jest.advanceTimersByTimeAsync(2500);
      expect(global.fetch).toHaveBeenCalledTimes(3);

      await savePromise;
      mockRandom.mockRestore();
    });

    it('should cap retry delay at maximum configured value', async () => {
      const networkError = new Error('Network error');
      (global.fetch as jest.Mock).mockRejectedValue(networkError);

      const testConfig = {
        baseUrl: 'http://localhost:8765',
        authEndpoint: '/api/auth',
        timeout: 30000,
        retryAttempts: 5,
        retryDelays: {
          base: 1000,
          max: 2000,
          jitterPercent: 0,
        },
      };
      const testService = new APIService(testConfig);
      await testService.initialize();

      const savePromise = testService.saveJob(mockJob);

      const rejectPromise = expect(savePromise).rejects.toMatchObject({
        code: 'NETWORK_ERROR',
      });

      await jest.advanceTimersByTimeAsync(1000);
      await jest.advanceTimersByTimeAsync(2000);
      await jest.advanceTimersByTimeAsync(2000);
      await jest.advanceTimersByTimeAsync(2000);

      await rejectPromise;
      expect(global.fetch).toHaveBeenCalledTimes(5);
    }, 10000);

    it('should retry on 5xx server errors', async () => {
      (global.fetch as jest.Mock)
        .mockResolvedValueOnce({
          ok: false,
          status: 503,
          statusText: 'Service Unavailable',
          json: jest.fn().mockResolvedValue({
            code: 'API_ERROR',
            message: 'Service Unavailable',
            details: { status: 503 },
          }),
        })
        .mockResolvedValueOnce({
          ok: true,
          json: jest.fn().mockResolvedValue({
            id: '123',
            job: mockJob,
            createdAt: '2024-01-01',
          }),
        });

      const savePromise = apiService.saveJob(mockJob);

      await jest.advanceTimersByTimeAsync(1500);

      const result = await savePromise;
      expect(result.id).toBe('123');
      expect(global.fetch).toHaveBeenCalledTimes(2);
    }, 10000);

    it('should not retry on 4xx client errors', async () => {
      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: false,
        status: 400,
        statusText: 'Bad Request',
        json: jest.fn().mockResolvedValue({
          code: 'API_ERROR',
          message: 'Invalid request',
        }),
      });

      await expect(apiService.saveJob(mockJob)).rejects.toMatchObject({
        code: 'API_ERROR',
        message: 'Invalid request',
      });
      expect(global.fetch).toHaveBeenCalledTimes(1);
    });

    it('should retry on timeout errors', async () => {
      const abortError = new Error('Request aborted');
      abortError.name = 'AbortError';

      (global.fetch as jest.Mock)
        .mockRejectedValueOnce(abortError)
        .mockResolvedValueOnce({
          ok: true,
          json: jest.fn().mockResolvedValue({
            id: '123',
            job: mockJob,
            createdAt: '2024-01-01',
          }),
        });

      const savePromise = apiService.saveJob(mockJob);

      await jest.advanceTimersByTimeAsync(1500);

      const result = await savePromise;
      expect(result.id).toBe('123');
      expect(global.fetch).toHaveBeenCalledTimes(2);
    });
  });
});
