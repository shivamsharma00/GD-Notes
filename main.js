#!/usr/bin/env node

const { app, BrowserWindow, ipcMain } = require('electron');
const path = require('path');
const UnifiedStorage = require('./submodules/unifiedStorage.js'); // Use unified storage

// Keep track of windows using tabId as the key
const windowRegistry = new Map();

// Create a new window or focus an existing one for a tab
async function createWindowForTab(tabData) {
    console.log("Creating/Focusing window for tab:", tabData.id);

    // Check if a window for this tab already exists and is not destroyed
    if (windowRegistry.has(tabData.id)) {
        const existingWin = windowRegistry.get(tabData.id);
        if (existingWin && !existingWin.isDestroyed()) {
            console.log("Focusing existing window for tab:", tabData.id);
            existingWin.focus();
            return existingWin; // Return existing window
        } else {
            // Clean up registry if window was destroyed unexpectedly
            windowRegistry.delete(tabData.id);
        }
    }

    // Define window options based on tab data
    const windowOptions = {
        x: tabData.window?.x,
        y: tabData.window?.y,
        width: tabData.window?.width || 400,
        height: tabData.window?.height || 400,
        frame: false,
        resizable: true,
        transparent: true,
        webPreferences: {
            nodeIntegration: false,
            contextIsolation: true,
            preload: path.join(__dirname, 'preload.js')
        }
    };

    const win = new BrowserWindow(windowOptions);
    windowRegistry.set(tabData.id, win); // Register the new window

    // --- Event Handlers for the Window ---

    // Send initialization data after the window loads
    win.webContents.on('did-finish-load', () => {
        if (!win.isDestroyed()) {
            // Mark the tab as 'open' in storage when its window is successfully created/loaded
            const updatedTabData = { ...tabData, window: { ...tabData.window, state: 'open' } };
            UnifiedStorage.addOrUpdateTab(updatedTabData)
                .then(() => {
                    win.webContents.send('init-new-tab', { tabData: updatedTabData });
                    console.log(`Sent init-new-tab for ${tabData.id}`);
                })
                .catch(err => console.error("Error updating tab state to open:", err));
        }
    });

    // Handle window movement and resizing - save state
    const saveBounds = async () => {
        if (win && !win.isDestroyed()) {
            const bounds = win.getBounds();
            const currentTabData = await UnifiedStorage.getTabDataById(tabData.id); // Need this function in UnifiedStorage
            if (currentTabData) {
                await UnifiedStorage.addOrUpdateTab({
                    ...currentTabData,
                    window: {
                        ...currentTabData.window,
                        x: bounds.x,
                        y: bounds.y,
                        width: bounds.width,
                        height: bounds.height,
                        isMaximized: win.isMaximized() // Also save maximized state
                    }
                });
            }
        }
    };
    // Debounce saving bounds might be good here, but for simplicity saving directly
    win.on('resized', saveBounds);
    win.on('moved', saveBounds);

    // Handle window closure - mark tab as closed in storage
    win.on('closed', async () => {
        console.log("Window closed for tab:", tabData.id);
        windowRegistry.delete(tabData.id); // Unregister window
        
        try {
            // Important: Get the bounds BEFORE the closed event
            // Use a local variable that won't be affected by window destruction
            const finalBounds = { 
                x: win.getBounds().x,
                y: win.getBounds().y,
                width: win.getBounds().width,
                height: win.getBounds().height,
                isMaximized: win.isMaximized(),
                state: 'closed'
            };
            
            const currentTabData = await UnifiedStorage.getTabDataById(tabData.id);
            if (currentTabData) {
                // Save final bounds and mark as closed
                await UnifiedStorage.addOrUpdateTab({
                    ...currentTabData,
                    window: {
                        ...currentTabData.window, // Keep existing window config
                        ...finalBounds          // Update with final position/size
                    }
                });
                console.log(`Marked tab ${tabData.id} as closed.`);
            }
        } catch (err) {
            console.error(`Error saving window state for tab ${tabData.id}:`, err);
        }
        
        // Check if it's the last window and we are not quitting (macOS behavior)
        if (windowRegistry.size === 0 && process.platform === 'darwin' && !app.isQuitting) {
            // Optionally, decide what to do - maybe nothing, let user use dock menu
            console.log("Last window closed on macOS, app still running.");
        }
    });

    // Load the HTML file (no query parameters needed now, using IPC for init)
    await win.loadFile('index.html');
    console.log(`Window created and loading index.html for ${tabData.id}`);

    return win;
}

// Create a brand new default tab and its window
async function createNewDefaultTabWindow() {
    console.log("Creating new default tab window.");
    const newTab = UnifiedStorage.getDefaultTabData().tabs[0]; // Get default tab structure
    newTab.id = 'tab-' + Date.now(); // Ensure unique ID
    newTab.name = 'New Note';
    await UnifiedStorage.addOrUpdateTab(newTab); // Save the new default tab first
    return await createWindowForTab(newTab); // Then create its window
}

// --- App Lifecycle ---

app.whenReady().then(async () => {
    try {
        const storageData = await UnifiedStorage.initializeStorage();
        console.log("Unified storage initialized.");

        // CRITICAL CHANGE: Do NOT automatically reopen any windows on startup.
        // Simply ensure storage is loaded. User opens tabs via the dropdown.

        // Check if *any* tabs exist. If not, create one default tab/window.
        if (!storageData || !storageData.tabs || storageData.tabs.length === 0) {
            console.log("No existing tabs found. Creating a default new tab.");
            await createNewDefaultTabWindow();
        } else {
                console.log(`${storageData.tabs.length} tabs found in storage. App ready.`);

                // ADDED: Always open a window with either the last active tab or a new one
                const lastActiveTab = storageData.tabs.find(tab => tab.window?.state === 'open') || storageData.tabs[0];  // Default to first tab if none were open

                app.whenReady().then(async () => {
    try {
        const storageData = await UnifiedStorage.initializeStorage();
        console.log("Unified storage initialized.");

        // Check if *any* tabs exist. If not, create one default tab/window.
        if (!storageData || !storageData.tabs || storageData.tabs.length === 0) {
            console.log("No existing tabs found. Creating a default new tab.");
            await createNewDefaultTabWindow();
        } else {
            console.log(`${storageData.tabs.length} tabs found in storage. App ready.`);
            
            // Always open a window with either the last active tab or a new one
            let tabToOpen;
            
            // Try to find a tab that was previously open
            const lastActiveTab = storageData.tabs.find(tab => tab.window?.state === 'open');
            
            if (lastActiveTab) {
                console.log(`Found previously active tab: ${lastActiveTab.id}`);
                tabToOpen = lastActiveTab;
            } else {
                // Default to first tab if none were open
                console.log(`No active tabs found. Opening first tab: ${storageData.tabs[0].id}`);
                tabToOpen = storageData.tabs[0];
            }
            
            console.log(`Opening window for tab: ${lastActiveTab.id}`);
            await createWindowForTab(lastActiveTab);
            console.log(`Opening window for tab: ${tabToOpen.id}`);
            await createWindowForTab(tabToOpen);
        }

    } catch (error) {
        console.error("Error during app initialization:", error);
        // Create a default window anyway if there's an error
        console.log("Creating default window due to error");
        await createNewDefaultTabWindow();
    }

    // ... rest of the code remains the same
});

        }

    } catch (error) {
        console.error("Error during app initialization:", error);
        // Consider showing an error dialog to the user
    }

    // macOS: Recreate a window if dock icon is clicked and no windows are open.
    app.on('activate', () => {
        if (BrowserWindow.getAllWindows().length === 0 && windowRegistry.size === 0) {
             // Decide whether to create a new default window or reopen the last *known* tab
             // For simplicity, let's create a new default one if none are open.
             console.log("App activated with no windows open. Creating default window.");
             createNewDefaultTabWindow();
        }
    });
});

app.on('before-quit', () => {
    app.isQuitting = true;
     // Maybe save all window bounds one last time?
     console.log("App is quitting.");
     // Add logic here if needed before all windows close
});

app.on('window-all-closed', () => {
    console.log("All windows closed.");
    // Standard macOS behavior: quit only if not on macOS.
    if (process.platform !== 'darwin') {
        app.quit();
    } else {
        // On macOS, the app continues running without windows.
        console.log("macOS detected, app continues running.");
    }
});

// --- IPC Handlers ---

ipcMain.on('close-window', (event) => {
    const win = BrowserWindow.fromWebContents(event.sender);
    if (win) win.close();
});

ipcMain.on('minimize-window', (event) => {
    const win = BrowserWindow.fromWebContents(event.sender);
    if (win) win.minimize();
});

// Handle request to create a new tab/window from UI
ipcMain.handle('create-new-tab-window', async (event, options) => {
    console.log("IPC: Received 'create-new-tab-window' with options:", options);
    const { layout, colorTheme, colorLevel } = options;
    const tabId = 'tab-' + Date.now();
    const defaultSettings = (await UnifiedStorage.getGlobalSettings()) || {}; // Need getGlobalSettings

    // Create the basic tab data structure
    const newTabData = {
        id: tabId,
        layout: layout,
        name: layout === 'single' ? 'Single Note' : 'Four Square',
        window: { // Default window state
            x: undefined, y: undefined, // Let Electron decide position initially
            width: layout === 'four-square' ? 600 : 400,
            height: layout === 'four-square' ? 600 : 400,
            isMaximized: false,
            state: 'closed' // It's closed until the window is created
        },
        appearance: { // Inherit from global defaults
            backgroundColor: "#ffffff", // Will be overridden by color theme
            textColor: "#000000",       // Will be overridden by color theme
            fontFamily: defaultSettings.defaultFontFamily || "'Open Sans', sans-serif",
            fontSize: defaultSettings.defaultFontSize || "16px",
            isDarkMode: defaultSettings.theme === 'dark' || false,
            colorTheme: colorTheme || defaultSettings.defaultColorTheme || "default",
            // For four-square, default to rainbow mode (level -1) unless explicitly specified
            colorLevel: layout === 'four-square' && colorLevel === undefined ? -1 : 
                        (colorLevel !== undefined ? colorLevel : (defaultSettings.defaultColorLevel || 1))
        },
        notes: layout === 'four-square'
            ? ["", "", "", ""].map((content, i) => ({
                id: `note-${i + 1}`, content: content, metadata: { created: new Date().toISOString(), lastModified: new Date().toISOString() }
              }))
            : [{ id: "note-1", content: "", metadata: { created: new Date().toISOString(), lastModified: new Date().toISOString() } }],
        metadata: { created: new Date().toISOString(), modified: new Date().toISOString() }
    };

    try {
        // Save the tab definition *before* creating the window
        await UnifiedStorage.addOrUpdateTab(newTabData);
        console.log(`IPC: Saved new tab ${tabId}. Now creating window.`);
        // Create and show the window for this new tab
        const win = await createWindowForTab(newTabData);
        return { success: true, tabId: tabId, windowId: win.id };
    } catch (error) {
        console.error("IPC: Error creating new tab/window:", error);
        return { success: false, error: error.message };
    }
});

// Handle request to open an existing tab in a window
ipcMain.handle('open-tab-window', async (event, tabId) => {
     console.log("IPC: Received 'open-tab-window' for tabId:", tabId);
    try {
        const tabData = await UnifiedStorage.getTabDataById(tabId); // Need this function
        if (!tabData) {
            throw new Error(`Tab with ID ${tabId} not found.`);
        }
        // Use the function that handles creating or focusing
        const win = await createWindowForTab(tabData);
        return { success: true, tabId: tabId, windowId: win.id };
    } catch (error) {
        console.error(`IPC: Error opening window for tab ${tabId}:`, error);
        return { success: false, error: error.message };
    }
});


// --- Unified Storage IPC Wrappers ---

ipcMain.handle('initialize-storage', async () => {
    return await UnifiedStorage.initializeStorage();
});

ipcMain.handle('get-global-settings', async () => { // Added getter
    return await UnifiedStorage.getGlobalSettings();
});

ipcMain.handle('update-global-settings', async (event, newSettings) => {
    return await UnifiedStorage.updateGlobalSettings(newSettings);
});

ipcMain.handle('get-all-tabs', async () => { // Added getter for tabs list
    return await UnifiedStorage.getAllTabs();
});

ipcMain.handle('add-or-update-tab', async (event, tabData) => {
    // Ensure window state isn't accidentally overwritten if not provided
    if (tabData && !tabData.window) {
        const existing = await UnifiedStorage.getTabDataById(tabData.id);
        if (existing && existing.window) {
            tabData.window = existing.window; // Preserve existing window state
        }
    }
    return await UnifiedStorage.addOrUpdateTab(tabData);
});

ipcMain.handle('remove-tab', async (event, tabId) => {
    // Close the window if it's open before removing the tab data
    if (windowRegistry.has(tabId)) {
        const win = windowRegistry.get(tabId);
        if (win && !win.isDestroyed()) {
            console.log(`Closing window for tab ${tabId} before removal.`);
            win.close(); // This triggers the 'closed' event which should clean up the registry
        }
    }
    // Wait a moment to allow the close event to process? Might not be necessary.
    // await new Promise(resolve => setTimeout(resolve, 50));

    const result = await UnifiedStorage.removeTab(tabId);

     // If the last window was just closed by this removal, and it's macOS, do nothing special.
     // If it's not macOS, the app will quit via 'window-all-closed'.
     // If no windows were open *before* this removal, also do nothing.

    return result;
});

// Removed addJournalEntry IPC handler