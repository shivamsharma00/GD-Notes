#!/usr/bin/env node

const { app, BrowserWindow, ipcMain } = require('electron');
const path = require('path');
const UnifiedStorage = require('./submodules/unifiedStorage.js'); 
// Use unified storage

// Keep track of windows using tabId as the key
const windowRegistry = new Map();

// Helper function to broadcast a message to all windows except the sender (optional)
function broadcastToAllWindows(channel, data, senderWebContentsId = null) {
    windowRegistry.forEach((win, tabId) => {
        if (win && !win.isDestroyed()) {
            // Don't send back to the originator window if senderWebContentsId is provided
            if (senderWebContentsId === null || win.webContents.id !== senderWebContentsId) {
                win.webContents.send(channel, data);
            }
        }
    });
}

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
    const newTab = UnifiedStorage.getDefaultData(); // Get default tab structure
    newTab.id = 'tab-' + Date.now(); // Ensure unique ID
    
    // Set initial name with date
    const now = new Date();
    newTab.name = `New Note`;
    
    // Set default window size
    newTab.window = {
        ...newTab.window, // Keep potential defaults
        width: 500, 
        height: 600,
        x: undefined, // Let OS decide initial position
        y: undefined,
        state: 'closed' // Start as closed
    };
    
    await UnifiedStorage.addOrUpdateTab(newTab); // Save the new default tab first
    return await createWindowForTab(newTab); // Then create its window
}


// --- App Lifecycle ---

app.whenReady().then(async () => {
    try {
        // Initialize storage and check if it's the first launch ever
        const { data: storageData, isFirstLaunchEver } = await UnifiedStorage.initializeStorage();
        console.log(`Unified storage initialized. Is first launch ever? ${isFirstLaunchEver}`);

        if (isFirstLaunchEver) {
            console.log("First launch detected. Performing setup...");
            // Create the first default note window
            await createNewDefaultTabWindow();
            console.log("Default note window created.");

            // IMPORTANT: Mark first launch as complete in storage
            await UnifiedStorage.updateGlobalSettings({ firstLaunchEver: false });
            console.log("Updated firstLaunchEver flag to false.");

        } else {
            // Not the first launch, proceed with normal window opening logic
            console.log("Existing installation detected. Opening windows...");
            
            // Check if *any* tabs exist. If not (e.g., user deleted all), create one default tab/window.
            if (!storageData || !storageData.tabs || storageData.tabs.length === 0) {
                console.log("No existing tabs found. Creating a default new tab.");
                await createNewDefaultTabWindow();
            } else {
                console.log(`${storageData.tabs.length} tabs found in storage. App ready.`);

                // Try to find a tab that was previously open
                const lastActiveTab = storageData.tabs.find(tab => tab.window?.state === 'open');

                if (lastActiveTab) {
                    console.log(`Found previously active tab: ${lastActiveTab.id}`);
                    await createWindowForTab(lastActiveTab);
                } else {
                    // Default to first tab if none were marked as open
                    console.log(`No active tabs found. Opening first available tab: ${storageData.tabs[0].id}`);
                    await createWindowForTab(storageData.tabs[0]);
                }
            }
        }

    } catch (error) {
        console.error("Error during app initialization:", error);
        // Basic fallback: Create a default window if initialization fails catastrophically
        try {
             console.warn("Creating default window due to initialization error.");
             await createNewDefaultTabWindow();
             // Attempt to mark first launch as done even on error path, might fail
             await UnifiedStorage.updateGlobalSettings({ firstLaunchEver: false }).catch(e => console.error("Failed to update firstLaunch flag during error fallback:", e));
        } catch (fallbackError) {
             console.error("Failed to create even the default window during error handling:", fallbackError);
             // Consider showing an Electron error dialog here
             // dialog.showErrorBox('Fatal Error', 'Could not initialize the application.');
             app.quit(); // Exit if we can't even show a basic window
        }
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

// --- New IPC Listener for Name Changes ---
ipcMain.on('report-tab-name-change', (event, { tabId, newName }) => {
    console.log(`IPC: Received name change report for ${tabId} to "${newName}"`);
    // Broadcast this change to all *other* windows
    broadcastToAllWindows('tab-name-updated', { tabId, newName }, event.sender.id);
});

// Add a debounce mechanism to prevent rapid duplicate calls
let lastTabCreationTime = 0;
const TAB_CREATION_COOLDOWN = 1000; // 1 second cooldown

ipcMain.handle('create-new-tab-window', async (event, newTabOptions) => {
    try {
        // Prevent rapid creation of tabs
        const currentTime = Date.now();
        if (currentTime - lastTabCreationTime < TAB_CREATION_COOLDOWN) {
            console.log('Tab creation request ignored due to cooldown');
            return { success: false, message: "Please wait before creating another tab" };
        }
        lastTabCreationTime = currentTime;

        // Continue with normal tab creation logic
        console.log("IPC: Received 'create-new-tab-window' with options:", newTabOptions);
        const { layout, colorTheme, colorLevel } = newTabOptions;
        const tabId = 'tab-' + Date.now();
        const defaultSettings = (await UnifiedStorage.getGlobalSettings()) || {}; // Need getGlobalSettings
        
        // Get date for initial name
        const now = new Date();
        const initialName = `${layout === 'single' ? 'Single Note' : 'Four Square'}`;

        // Create the basic tab data structure
        const newTabData = {
            id: tabId,
            layout: layout,
            name: initialName, // Use new initial name
            window: { // Default window state
                x: undefined, y: undefined, // Let Electron decide position initially
                width: 500, // Use fixed default size
                height: 600, // Use fixed default size
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
    const updatedTab = await UnifiedStorage.addOrUpdateTab(tabData);

    // If the name might have changed due to user input, broadcast it
    // (We could check if the name actually changed, but broadcasting is simpler)
    // Only broadcast if the event originates from a renderer process (not internal calls)
    if (event && event.sender) {
        broadcastToAllWindows('tab-name-updated', { tabId: updatedTab.id, newName: updatedTab.name }, event.sender.id);
    }

    return updatedTab;
});

ipcMain.handle('remove-tab', async (event, tabId) => {
    // Close the window if it's open before removing the tab data
    let closedWindow = false;
    if (windowRegistry.has(tabId)) {
        const win = windowRegistry.get(tabId);
        if (win && !win.isDestroyed()) {
            console.log(`Closing window for tab ${tabId} before removal.`);
            closedWindow = true;
            win.close(); // This triggers the 'closed' event which should clean up the registry
        }
    }
    // If we closed a window, wait a tiny bit for the 'closed' event to process
    // Might still be racy, but better than nothing.
    if (closedWindow) {
        await new Promise(resolve => setTimeout(resolve, 100));
    }

    const result = await UnifiedStorage.removeTab(tabId);

    if (result) {
        console.log(`Broadcasting tab deletion for ${tabId}`);
        // Broadcast deletion to all remaining windows
        broadcastToAllWindows('tab-deleted', { tabId });
    }

    // ... (rest of the logic for app quitting remains the same) ...

    return result;
});

// Removed addJournalEntry IPC handler