// preload.js
const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electronAPI', {
  // Window Controls
  closeWindow: () => ipcRenderer.send('close-window'),
  minimizeWindow: () => ipcRenderer.send('minimize-window'),

  // Tab/Window Management
  createNewTabWindow: (options) => ipcRenderer.invoke('create-new-tab-window', options),
  openTabWindow: (tabId) => ipcRenderer.invoke('open-tab-window', tabId),

  // Storage Access
  initializeStorage: () => ipcRenderer.invoke('initialize-storage'),
  getGlobalSettings: () => ipcRenderer.invoke('get-global-settings'),
  updateGlobalSettings: (newSettings) => ipcRenderer.invoke('update-global-settings', newSettings),
  getAllTabs: () => ipcRenderer.invoke('get-all-tabs'),
  addOrUpdateTab: (tabData) => ipcRenderer.invoke('add-or-update-tab', tabData),
  removeTab: (tabId) => ipcRenderer.invoke('remove-tab', tabId),
  // Removed addJournalEntry

  // Event Listener from Main
  onInitNewTab: (callback) => {
    // Ensure we don't add duplicate listeners if preload script re-runs
    ipcRenderer.removeAllListeners('init-new-tab');
    ipcRenderer.on('init-new-tab', (event, options) => {
      callback(event, options);
    });
  }
});