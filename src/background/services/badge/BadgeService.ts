import { IBadgeService, BadgeColors } from './IBadgeService';

export class BadgeService implements IBadgeService {
  private isInitialized = false;

  async initialize(): Promise<void> {
    if (this.isInitialized) return;

    await this.clear();
    this.isInitialized = true;
  }

  async destroy(): Promise<void> {
    await this.clear();
    this.isInitialized = false;
  }

  async setText(text: string): Promise<void> {
    return new Promise((resolve, reject) => {
      chrome.action.setBadgeText({ text }, () => {
        if (chrome.runtime.lastError) {
          reject(new Error(chrome.runtime.lastError.message));
        } else {
          resolve();
        }
      });
    });
  }

  async setColor(color: string): Promise<void> {
    return new Promise((resolve, reject) => {
      chrome.action.setBadgeBackgroundColor({ color }, () => {
        if (chrome.runtime.lastError) {
          reject(new Error(chrome.runtime.lastError.message));
        } else {
          resolve();
        }
      });
    });
  }

  async clear(): Promise<void> {
    await this.setText('');
  }

  async showSuccess(text: string = '✓'): Promise<void> {
    await this.setColor(BadgeColors.SUCCESS);
    await this.setText(text);

    // Auto-clear after 3 seconds
    setTimeout(() => {
      this.clear();
    }, 3000);
  }

  async showError(text: string = '!'): Promise<void> {
    await this.setColor(BadgeColors.ERROR);
    await this.setText(text);

    // Auto-clear after 5 seconds
    setTimeout(() => {
      this.clear();
    }, 5000);
  }

}
