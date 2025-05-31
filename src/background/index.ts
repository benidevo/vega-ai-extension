import { ServiceManager } from './ServiceManager';

const serviceManager = new ServiceManager();

(async () => {
  try {
    await serviceManager.initialize();
  } catch (error) {
    console.error('Failed to initialize background services:', error);
  }
})();

chrome.runtime.onInstalled.addListener(async (details) => {
  if (details.reason === 'install') {
    await serviceManager.badge.showSuccess();
  }
});

chrome.runtime.onSuspend.addListener(async () => {
  await serviceManager.destroy();
});

export { serviceManager };
