#!/usr/bin/env node

const { app, BrowserWindow, ipcMain } = require('electron');
const path = require('path');
const fs = require('fs').promises;
const os = require('os');

const UnifiedStorage = require('./submodules/UnifiedStorage.js'); // New unified storage module

// Keep track of windows we create to avoid duplicates
const windowRegistry = new Map();

// Create a new window with options (and register it with a unique tabId)
async function createWindow(options = {}) {
  const defaultOptions = {
    width: 400,
    height: 400,
    frame: false,
    resizable: true,
    transparent: true,
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      preload: path.join(__dirname, 'preload.js')
    }
  };

  const windowOptions = { ...defaultOptions, ...options };
  const win = new BrowserWindow(windowOptions);

  // If this window corresponds to a tab, register it
  if (options.tabId) {
    windowRegistry.set(options.tabId, win);
    win.on('closed', () => {
      windowRegistry.delete(options.tabId);
      updateWindowStates();
      // If no windows remain and app isn't quitting, create a default window.
      if (windowRegistry.size === 0 && !app.isQuitting) {
        createDefaultWindow();
      }
    });
  }

  // Load our UI (pass query param if needed)
  await win.loadFile('index.html', { query: { newTab: '1' } });

  // If this is a new tab, send initialization options once ready
  if (options.tabId) {
    setTimeout(() => {
      if (!win.isDestroyed()) {
        win.webContents.send('init-new-tab', options);
      }
    }, 200);
  }
  return win;
}

// Restore window states from UnifiedStorage or create a default window
async function createDefaultWindow() {
  const tabId = 'tab-' + Date.now();
  const options = {
    tabId,
    layout: 'single',
    backgroundColor: '#ffffff',
    textColor: '#000000',
    isDarkMode: false,
    isDefaultWindow: true,
    width: 400,
    height: 400
  };

  const newWindow = await createWindow(options);
  updateWindowStates();
  return newWindow;
}

// Optional: update window state info (positions, sizes) for each open window.
// You could save this state to the unified JSON if desired.
async function updateWindowStates() {
  const state = { windows: [] };
  for (const [tabId, win] of windowRegistry.entries()) {
    if (win && !win.isDestroyed()) {
      const bounds = win.getBounds();
      state.windows.push({
        tabId,
        bounds,
        isMaximized: win.isMaximized()
      });
    }
  }
  console.log("Updated window states:", state);
  // Optionally, integrate with UnifiedStorage to persist these details.
}

// App initialization
app.whenReady().then(async () => {
  try {
    // Initialize unified storage (creates file if not exists and loads data)
    const storageData = await UnifiedStorage.initializeStorage();
    console.log("Unified storage initialized:", storageData);

    // If storageData contains saved window states, you can restore them.
    // Here, for simplicity, we check for a saved windows array.
    if (storageData && storageData.windows && storageData.windows.length > 0) {
      for (const winState of storageData.windows) {
        await createWindow({
          tabId: winState.tabId,
          x: winState.bounds.x,
          y: winState.bounds.y,
          width: winState.bounds.width,
          height: winState.bounds.height
          // Additional tab properties can be merged here as needed.
        });
      }
    } else {
      await createDefaultWindow();
    }

    app.on('activate', () => {
      if (BrowserWindow.getAllWindows().length === 0) createDefaultWindow();
    });
  } catch (error) {
    console.error("Error during app initialization:", error);
  }
});

app.on('before-quit', () => {
  app.isQuitting = true;
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});

// IPC handlers for window control
ipcMain.on('close-window', (event) => {
  const win = BrowserWindow.fromWebContents(event.sender);
  if (win) win.close();
});

ipcMain.on('minimize-window', (event) => {
  const win = BrowserWindow.fromWebContents(event.sender);
  if (win) win.minimize();
});

// IPC handler to create a new window (tab) based on layout options
ipcMain.handle('create-new-window', async (event, options) => {
  const tabId = options.tabId;
  if (windowRegistry.has(tabId)) {
    const existingWindow = windowRegistry.get(tabId);
    if (existingWindow && !existingWindow.isDestroyed()) {
      existingWindow.focus();
      return existingWindow.id;
    }
  }
  const width = options.layout === 'single' ? 400 : 600;
  const height = options.layout === 'single' ? 400 : 600;
  const newWindow = await createWindow({
    tabId,
    width,
    height,
    ...options
  });
  updateWindowStates();
  return newWindow.id;
});

// IPC Handlers for Unified Storage integration

ipcMain.handle('initialize-storage', async () => {
  return await UnifiedStorage.initializeStorage();
});

ipcMain.handle('update-global-settings', async (event, newSettings) => {
  return await UnifiedStorage.updateGlobalSettings(newSettings);
});

ipcMain.handle('add-or-update-tab', async (event, tabData) => {
  return await UnifiedStorage.addOrUpdateTab(tabData);
});

ipcMain.handle('remove-tab', async (event, tabId) => {
  return await UnifiedStorage.removeTab(tabId);
});

ipcMain.handle('add-journal-entry', async (event, entry) => {
  return await UnifiedStorage.addJournalEntry(entry);
});

// Additional IPC handlers for file system operations (if needed in other parts)
ipcMain.handle('read-file', async (event, filePath) => {
  try {
    const data = await fs.readFile(filePath, 'utf8');
    return data;
  } catch (error) {
    console.error('Failed to read file:', error);
    return null;
  }
});

ipcMain.handle('write-file', async (event, filePath, data) => {
  try {
    await fs.writeFile(filePath, data, 'utf8');
    return true;
  } catch (error) {
    console.error('Failed to write file:', error);
    return false;
  }
});

ipcMain.handle('create-data-dir', async (event, dirPath) => {
  try {
    await fs.mkdir(dirPath, { recursive: true });
    return true;
  } catch (error) {
    console.error('Failed to create directory:', error);
    return false;
  }
});

ipcMain.handle('get-home-dir', () => {
  return os.homedir();
});

ipcMain.handle('join-path', (event, paths) => {
  if (Array.isArray(paths)) {
    return path.join(...paths);
  } else {
    console.error('Invalid paths argument:', paths);
    return '';
  }
});

ipcMain.handle('file-exists', async (event, filePath) => {
  try {
    await fs.access(filePath);
    return true;
  } catch {
    return false;
  }
});

ipcMain.handle('directory-exists', async (event, dirPath) => {
  try {
    await fs.access(dirPath);
    return true;
  } catch {
    return false;
  }
});
