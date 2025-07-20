import { PreferencesService } from '../../../../../src/background/services/preferences/PreferencesService';
import { IAPIService } from '../../../../../src/background/services/api/IAPIService';
import { ActivePreferencesResponse } from '../../../../../src/types';

// Mock logger
jest.mock('../../../../../src/utils/logger', () => ({
  Logger: jest.fn().mockImplementation(() => ({
    info: jest.fn(),
    error: jest.fn(),
    warn: jest.fn(),
    debug: jest.fn(),
  }))
}));

// Mock error service
jest.mock('../../../../../src/background/services/error', () => ({
  errorService: {
    handleError: jest.fn(),
  }
}));

// Mock chrome API
global.chrome = {
  tabs: {
    create: jest.fn(),
    remove: jest.fn(),
    sendMessage: jest.fn(),
    onUpdated: {
      addListener: jest.fn(),
      removeListener: jest.fn(),
    },
  },
} as any;

describe('PreferencesService', () => {
  let service: PreferencesService;
  let mockApiService: jest.Mocked<IAPIService>;

  beforeEach(() => {
    mockApiService = {
      initialize: jest.fn(),
      destroy: jest.fn(),
      saveJob: jest.fn(),
      setAuthToken: jest.fn(),
      getActivePreferences: jest.fn(),
      recordSearchResults: jest.fn(),
    };

    service = new PreferencesService(mockApiService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('initialize', () => {
    it('should initialize service', async () => {
      await service.initialize();
      expect(service.isSearchInProgress()).toBe(false);
    });
  });

  describe('runAutomatedSearch', () => {
    it('should skip if search is already in progress', async () => {
      const mockPreferences: ActivePreferencesResponse = {
        preferences: [
          {
            id: '123',
            user_id: 1,
            job_title: 'Software Engineer',
            location: 'San Francisco',
            max_age: 86400,
            is_active: true,
            created_at: '2024-01-01',
            updated_at: '2024-01-01',
          },
        ],
        quota_status: {
          search_runs: { used: 0, limit: 10, remaining: 10 },
          job_count: { used: 0, limit: 100, remaining: 100 },
          reset_at: '2024-01-02',
        },
      };

      mockApiService.getActivePreferences.mockResolvedValue(mockPreferences);

      // Start first search
      const firstSearch = service.runAutomatedSearch();

      // Try to start second search
      const secondSearch = service.runAutomatedSearch();

      // Second search should complete immediately
      await secondSearch;

      // API should only be called once
      expect(mockApiService.getActivePreferences).toHaveBeenCalledTimes(1);

      // Wait for first search to complete
      await firstSearch;
    });

    it('should handle no active preferences', async () => {
      mockApiService.getActivePreferences.mockResolvedValue(null);

      await service.runAutomatedSearch();

      expect(mockApiService.getActivePreferences).toHaveBeenCalledTimes(1);
      expect(chrome.tabs.create).not.toHaveBeenCalled();
    });

    it('should handle empty preferences', async () => {
      const mockResponse: ActivePreferencesResponse = {
        preferences: [],
        quota_status: {
          search_runs: { used: 0, limit: 10, remaining: 10 },
          job_count: { used: 0, limit: 100, remaining: 100 },
          reset_at: '2024-01-02',
        },
      };

      mockApiService.getActivePreferences.mockResolvedValue(mockResponse);

      await service.runAutomatedSearch();

      expect(chrome.tabs.create).not.toHaveBeenCalled();
    });

    it('should handle API call errors gracefully', async () => {
      const mockPreferences: ActivePreferencesResponse = {
        preferences: [
          {
            id: '123',
            user_id: 1,
            job_title: 'Software Engineer',
            location: 'San Francisco',
            max_age: 86400,
            is_active: true,
            created_at: '2024-01-01',
            updated_at: '2024-01-01',
          },
        ],
        quota_status: {
          search_runs: { used: 0, limit: 10, remaining: 10 },
          job_count: { used: 0, limit: 100, remaining: 100 },
          reset_at: '2024-01-02',
        },
      };

      mockApiService.getActivePreferences.mockResolvedValue(mockPreferences);
      
      // Make tab creation fail
      (chrome.tabs.create as jest.Mock).mockRejectedValue(new Error('Tab creation failed'));

      // Should not throw
      await expect(service.runAutomatedSearch()).resolves.not.toThrow();
      
      // Should have tried to create a tab
      expect(chrome.tabs.create).toHaveBeenCalledTimes(1);
    });
  });

  describe('isSearchInProgress', () => {
    it('should return false initially', () => {
      expect(service.isSearchInProgress()).toBe(false);
    });

    it('should return true during search', () => {
      const mockResponse: ActivePreferencesResponse = {
        preferences: [
          {
            id: '123',
            user_id: 1,
            job_title: 'Engineer',
            location: 'Remote',
            max_age: 86400,
            is_active: true,
            created_at: '2024-01-01',
            updated_at: '2024-01-01',
          },
        ],
        quota_status: {
          search_runs: { used: 0, limit: 10, remaining: 10 },
          job_count: { used: 0, limit: 100, remaining: 100 },
          reset_at: '2024-01-02',
        },
      };

      // Make getActivePreferences return a promise that doesn't resolve immediately
      let resolvePreferences: any;
      const preferencesPromise = new Promise<ActivePreferencesResponse>((resolve) => {
        resolvePreferences = resolve;
      });
      
      mockApiService.getActivePreferences.mockReturnValue(preferencesPromise);

      // Start the search (but don't await it)
      service.runAutomatedSearch();

      // Should be in progress
      expect(service.isSearchInProgress()).toBe(true);

      // Resolve the preferences to let the search complete
      resolvePreferences(mockResponse);
    });
  });
});