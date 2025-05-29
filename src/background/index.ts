import { ServiceManager } from './ServiceManager';

const serviceManager = new ServiceManager();

(async () => {
  try {
    await serviceManager.initialize();
    console.log('Ascentio background services initialized');
  } catch (error) {
    console.error('Failed to initialize background services:', error);
  }
})();

chrome.runtime.onInstalled.addListener(async (details) => {
  console.log('Ascentio extension installed', details);

  if (details.reason === 'install') {
    await serviceManager.badge.showSuccess();
  }
});

chrome.runtime.onSuspend.addListener(async () => {
  console.log('Ascentio extension suspending');
  await serviceManager.destroy();
});

export { serviceManager };
