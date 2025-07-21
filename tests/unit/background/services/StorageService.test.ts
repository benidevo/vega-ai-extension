import { StorageService } from '../../../../src/background/services/storage/StorageService';
import { chrome } from '../../../mocks/chrome';

describe('StorageService', () => {
  let storageService: StorageService;
  let mockStorageArea: any;

  beforeEach(() => {
    jest.clearAllMocks();
    chrome.runtime.lastError = null;
    mockStorageArea = chrome.storage.local;
    storageService = new StorageService('local');
  });

  afterEach(() => {
    chrome.runtime.lastError = null;
  });

  describe('get', () => {
    it('should retrieve value from storage', async () => {
      const mockData = { testKey: 'testValue' };
      mockStorageArea.get.mockImplementation((_key: string, callback: Function) => {
        callback(mockData);
      });

      const result = await storageService.get('testKey');
      expect(result).toBe('testValue');
      expect(mockStorageArea.get).toHaveBeenCalledWith('testKey', expect.any(Function));
    });

    it('should return null for non-existent key', async () => {
      mockStorageArea.get.mockImplementation((_key: string, callback: Function) => {
        callback({});
      });

      const result = await storageService.get('nonExistentKey');
      expect(result).toBeNull();
    });

    it('should handle chrome runtime errors gracefully', async () => {
      chrome.runtime.lastError = { message: 'Storage error' };
      mockStorageArea.get.mockImplementation((_key: string, callback: Function) => {
        callback({});
      });

      const result = await storageService.get('testKey');
      expect(result).toBeNull();
      expect(console.error).toHaveBeenCalled();
      expect(console.error).toHaveBeenCalledWith(
        expect.stringContaining('Storage get error'),
        undefined  // Logger passes undefined as second param when logging to console
      );

      chrome.runtime.lastError = null;
    });
  });

  describe('set', () => {
    it('should store value in storage', async () => {
      chrome.runtime.lastError = null;
      mockStorageArea.set.mockImplementation((_items: any, callback: Function) => {
        callback();
      });

      await storageService.set('testKey', 'testValue');
      expect(mockStorageArea.set).toHaveBeenCalledWith({ testKey: 'testValue' }, expect.any(Function));
    });

    it('should reject on chrome runtime error', async () => {
      chrome.runtime.lastError = { message: 'Storage set error' };
      mockStorageArea.set.mockImplementation((_items: any, callback: Function) => {
        callback();
      });

      await expect(storageService.set('testKey', 'testValue')).rejects.toThrow('Storage set error');

      chrome.runtime.lastError = null;
    });
  });

  describe('remove', () => {
    it('should remove key from storage', async () => {
      mockStorageArea.remove.mockImplementation((_key: string, callback: Function) => {
        callback();
      });

      await storageService.remove('testKey');
      expect(mockStorageArea.remove).toHaveBeenCalledWith('testKey', expect.any(Function));
    });

    it('should reject on chrome runtime error', async () => {
      chrome.runtime.lastError = { message: 'Storage remove error' };
      mockStorageArea.remove.mockImplementation((_key: string, callback: Function) => {
        callback();
      });

      await expect(storageService.remove('testKey')).rejects.toThrow('Storage remove error');

      chrome.runtime.lastError = null;
    });
  });

  describe('getMultiple', () => {
    it('should retrieve multiple values from storage', async () => {
      const mockData = { key1: 'value1', key2: 'value2' };
      mockStorageArea.get.mockImplementation((_keys: string[], callback: Function) => {
        callback(mockData);
      });

      const result = await storageService.getMultiple(['key1', 'key2']);
      expect(result).toEqual(mockData);
      expect(mockStorageArea.get).toHaveBeenCalledWith(['key1', 'key2'], expect.any(Function));
    });

    it('should return empty object on error', async () => {
      chrome.runtime.lastError = { message: 'Storage error' };
      mockStorageArea.get.mockImplementation((_keys: string[], callback: Function) => {
        callback({});
      });

      const result = await storageService.getMultiple(['key1', 'key2']);
      expect(result).toEqual({});

      chrome.runtime.lastError = null;
    });
  });

  describe('setMultiple', () => {
    it('should store multiple values in storage', async () => {
      chrome.runtime.lastError = null;
      const items = { key1: 'value1', key2: 'value2' };
      mockStorageArea.set.mockImplementation((_items: any, callback: Function) => {
        callback();
      });

      await storageService.setMultiple(items);
      expect(mockStorageArea.set).toHaveBeenCalledWith(items, expect.any(Function));
    });
  });
});
