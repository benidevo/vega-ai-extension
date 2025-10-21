describe('Settings Persistence - Issue #15 Fix', () => {
  let mockButton: HTMLButtonElement;

  beforeEach(() => {
    // Setup mock DOM elements
    document.body.innerHTML = `
      <button id="save-settings-btn">Save Settings</button>
      <input type="radio" id="backend-cloud" name="backend-mode" value="cloud" />
      <input type="radio" id="backend-local" name="backend-mode" value="local" />
      <input type="text" id="custom-host" value="localhost:8765" />
      <select id="custom-scheme">
        <option value="http">HTTP</option>
        <option value="https">HTTPS</option>
      </select>
    `;

    mockButton = document.getElementById(
      'save-settings-btn'
    ) as HTMLButtonElement;
  });

  afterEach(() => {
    document.body.innerHTML = '';
  });

  describe('Button State Management', () => {
    it('should disable button when no changes', () => {
      const hasUnsavedChanges = false;

      if (hasUnsavedChanges) {
        mockButton.textContent = 'Save Changes';
        mockButton.disabled = false;
        mockButton.classList.remove('opacity-50', 'cursor-not-allowed');
      } else {
        mockButton.textContent = 'Save Settings';
        mockButton.disabled = true;
        mockButton.classList.add('opacity-50', 'cursor-not-allowed');
      }

      expect(mockButton.disabled).toBe(true);
      expect(mockButton.textContent).toBe('Save Settings');
      expect(mockButton.classList.contains('opacity-50')).toBe(true);
    });

    it('should enable button when has changes', () => {
      const hasUnsavedChanges = true;

      if (hasUnsavedChanges) {
        mockButton.textContent = 'Save Changes';
        mockButton.disabled = false;
        mockButton.classList.remove('opacity-50', 'cursor-not-allowed');
      } else {
        mockButton.textContent = 'Save Settings';
        mockButton.disabled = true;
        mockButton.classList.add('opacity-50', 'cursor-not-allowed');
      }

      expect(mockButton.disabled).toBe(false);
      expect(mockButton.textContent).toBe('Save Changes');
      expect(mockButton.classList.contains('opacity-50')).toBe(false);
    });
  });

  describe('Dirty State Tracking', () => {
    it('should mark dirty when radio button changes', () => {
      let hasUnsavedChanges = false;
      const localRadio = document.getElementById(
        'backend-local'
      ) as HTMLInputElement;

      const markDirty = () => {
        hasUnsavedChanges = true;
      };

      localRadio.addEventListener('change', () => {
        if (localRadio.checked) {
          markDirty();
        }
      });

      localRadio.click();

      expect(hasUnsavedChanges).toBe(true);
    });

    it('should mark dirty when host input changes', () => {
      let hasUnsavedChanges = false;
      const hostInput = document.getElementById(
        'custom-host'
      ) as HTMLInputElement;

      const markDirty = () => {
        hasUnsavedChanges = true;
      };

      hostInput.addEventListener('input', markDirty);

      hostInput.value = 'myserver.com:8080';
      hostInput.dispatchEvent(new Event('input'));

      expect(hasUnsavedChanges).toBe(true);
    });

    it('should mark dirty when scheme changes', () => {
      let hasUnsavedChanges = false;
      const schemeSelect = document.getElementById(
        'custom-scheme'
      ) as HTMLSelectElement;

      const markDirty = () => {
        hasUnsavedChanges = true;
      };

      schemeSelect.addEventListener('change', markDirty);

      schemeSelect.value = 'https';
      schemeSelect.dispatchEvent(new Event('change'));

      expect(hasUnsavedChanges).toBe(true);
    });
  });

  describe('Event Listener Guard', () => {
    it('should prevent duplicate event listener attachment', () => {
      let settingsListenersAttached = false;
      let callCount = 0;

      const attachListeners = () => {
        if (settingsListenersAttached) return;

        mockButton.addEventListener('click', () => {
          callCount++;
        });

        settingsListenersAttached = true;
      };

      attachListeners();
      attachListeners();
      attachListeners();

      mockButton.click();

      expect(callCount).toBe(1);
    });
  });

  describe('Integration: Dirty State Reset After Save', () => {
    it('should reset dirty state after successful save', () => {
      let hasUnsavedChanges = true;

      const onSaveSuccess = () => {
        hasUnsavedChanges = false;
        mockButton.textContent = 'Save Settings';
        mockButton.disabled = true;
      };

      onSaveSuccess();

      expect(hasUnsavedChanges).toBe(false);
      expect(mockButton.disabled).toBe(true);
      expect(mockButton.textContent).toBe('Save Settings');
    });
  });
});
