// UnifiedStorage.js
const fs = require('fs').promises;
const path = require('path');
const os = require('os');
const writeFileAtomic = require('write-file-atomic'); // Use atomic writes

const APP_NAME = 'Parmesan'; // Or 'SmartStickyNotes'
const SETTINGS_DIR = 'settings';
const DATA_FILE = 'appData.json';

let unifiedFilePath = null;
let dataCache = null; // In-memory cache of the data file

// Default unified data structure
function getDefaultData() {
    const now = new Date().toISOString();
    return {
        appVersion: "1.0.1", // Updated version
        globalSettings: {
            defaultFontFamily: "'Open Sans', sans-serif",
            defaultFontSize: "16px",
            theme: "light", // 'light' or 'dark'
            defaultColorTheme: "default", // Default color theme
            defaultColorLevel: 1, // Default intensity level (0-3)
            lastOpened: now
        },
        tabs: [
             // Optionally include one default tab structure here if needed elsewhere
             // {
             //    id: 'default-tab-' + Date.now(), // Example default
             //    layout: "single",
             //    name: "My First Note",
             //    window: { x: 100, y: 100, width: 400, height: 400, isMaximized: false, state: 'closed' },
             //    appearance: { /* ... default appearance */ },
             //    notes: [ /* ... default note */ ],
             //    metadata: { created: now, modified: now }
             // }
        ],
        journals: [] // Keep journals array even if unused for now
    };
}

// Normalize a tab object to ensure it follows the data model
function normalizeTabData(tabData) {
    const now = new Date().toISOString();
    // Basic structure with defaults
    const normalized = {
        id: tabData.id || 'tab-' + Date.now(), // Ensure ID exists
        layout: tabData.layout || "single",
        name: tabData.name || (tabData.layout === "four-square" ? "Four Square" : "Single Note"),
        window: { // Ensure window object and state exist
             x: tabData.window?.x, // Use optional chaining
             y: tabData.window?.y,
             width: tabData.window?.width || (tabData.layout === "four-square" ? 600 : 400),
             height: tabData.window?.height || (tabData.layout === "four-square" ? 600 : 400),
             isMaximized: tabData.window?.isMaximized || false,
             state: tabData.window?.state || 'closed' // Default to 'closed'
        },
        appearance: { // Ensure appearance object exists
             backgroundColor: tabData.appearance?.backgroundColor || "#ffffff",
             textColor: tabData.appearance?.textColor || "#000000",
             fontFamily: tabData.appearance?.fontFamily || "'Open Sans', sans-serif",
             fontSize: tabData.appearance?.fontSize || "16px",
             isDarkMode: tabData.appearance?.isDarkMode || false,
             colorTheme: tabData.appearance?.colorTheme || "default", // Color theme
             colorLevel: tabData.appearance?.colorLevel !== undefined ? tabData.appearance.colorLevel : 1 // Intensity level (0-3)
        },
        metadata: { // Ensure metadata exists
             created: tabData.metadata?.created || now,
             modified: now // Always update modified time
        }
    };

    // Normalize notes based on layout
    if (tabData.notes && Array.isArray(tabData.notes) && tabData.notes.length > 0) {
         // Ensure existing notes have the correct structure
        normalized.notes = tabData.notes.map((note, i) => ({
             id: note.id || `note-${i+1}`,
             content: note.content || "",
             metadata: {
                 created: note.metadata?.created || now,
                 lastModified: now // Update lastModified on save
             }
         }));
         // Add missing note objects if layout expects more (e.g., four-square loading old data)
         if (normalized.layout === "four-square" && normalized.notes.length < 4) {
             for (let i = normalized.notes.length; i < 4; i++) {
                 normalized.notes.push({ id: `note-${i+1}`, content: "", metadata: { created: now, lastModified: now }});
             }
         } else if (normalized.layout === "single" && normalized.notes.length > 1) {
             normalized.notes = [normalized.notes[0]]; // Only keep the first note for single layout
         }
    } else {
         // Create default notes if none provided
         if (normalized.layout === "four-square") {
             normalized.notes = Array(4).fill(null).map((_, i) => ({
                 id: `note-${i+1}`, content: "", metadata: { created: now, lastModified: now }
             }));
         } else { // single layout
             normalized.notes = [{
                 id: "note-1", content: "", metadata: { created: now, lastModified: now }
             }];
         }
    }
    return normalized;
}

async function initializeStorage() {
    if (dataCache) return dataCache; // Return cache if already loaded

    try {
        const homeDir = os.homedir();
        const appDir = path.join(homeDir, APP_NAME);
        const settingsDir = path.join(appDir, SETTINGS_DIR);
        await fs.mkdir(settingsDir, { recursive: true }); // Ensure directory exists

        unifiedFilePath = path.join(settingsDir, DATA_FILE);

        try {
            await fs.access(unifiedFilePath); // Check if file exists
            const dataStr = await fs.readFile(unifiedFilePath, 'utf8');
            dataCache = JSON.parse(dataStr);
            console.log("Storage file loaded.");
            // Simple migration/check: ensure essential keys exist
             if (!dataCache.globalSettings) dataCache.globalSettings = getDefaultData().globalSettings;
             if (!dataCache.tabs) dataCache.tabs = [];
             if (!dataCache.journals) dataCache.journals = [];
             
             // Ensure color theme settings exist in global settings
             if (dataCache.globalSettings && !dataCache.globalSettings.defaultColorTheme) {
                 dataCache.globalSettings.defaultColorTheme = "default";
             }
             if (dataCache.globalSettings && dataCache.globalSettings.defaultColorLevel === undefined) {
                 dataCache.globalSettings.defaultColorLevel = 1;
             }
             
             // Migrate any tabs that don't have color settings yet
             dataCache.tabs.forEach(tab => {
                 if (tab.appearance) {
                     if (!tab.appearance.colorTheme) {
                         tab.appearance.colorTheme = "default";
                     }
                     if (tab.appearance.colorLevel === undefined) {
                         tab.appearance.colorLevel = 1;
                     }
                 }
             });

        } catch (err) { // File doesn't exist or is invalid JSON
             if (err.code === 'ENOENT') {
                 console.log("Storage file not found. Creating default data.");
                 dataCache = getDefaultData();
                 await writeData(dataCache); // Write the default data
             } else {
                 console.error("Error reading or parsing storage file:", err);
                 // Handle corrupted file? Maybe load default or backup?
                 console.warn("Falling back to default data due to error.");
                 dataCache = getDefaultData();
                 // Optionally try to backup the corrupted file here
             }
        }
        return dataCache;
    } catch (error) {
        console.error('Critical error initializing storage:', error);
        // If storage fails to init, the app might be unusable.
        // Maybe show error dialog and quit?
        dataCache = getDefaultData(); // Ensure cache is at least default
        throw error; // Re-throw for main process to potentially handle
    }
}

// Write data atomically using write-file-atomic
async function writeData(data) {
    if (!unifiedFilePath) throw new Error("Storage path not initialized");
    try {
        const dataStr = JSON.stringify(data, null, 2); // Pretty print JSON
        await writeFileAtomic(unifiedFilePath, dataStr, { encoding: 'utf8' });
        dataCache = data; // Update cache after successful write
        // console.log("Storage data written successfully."); // Optional: confirmation log
    } catch (error) {
        console.error('Error writing unified data file:', error);
        throw error; // Re-throw for caller to handle
    }
}

// --- Getters ---

async function getGlobalSettings() {
    const data = dataCache || await initializeStorage();
    return data.globalSettings;
}

async function getAllTabs() {
    const data = dataCache || await initializeStorage();
    // Return a copy to prevent accidental modification of the cache
    return data.tabs ? JSON.parse(JSON.stringify(data.tabs)) : [];
}

async function getTabDataById(tabId) {
    const data = dataCache || await initializeStorage();
    const tab = data.tabs.find(t => t.id === tabId);
    // Return a copy
    return tab ? JSON.parse(JSON.stringify(tab)) : null;
}


// --- Modifiers ---

async function updateGlobalSettings(newSettings) {
    try {
        const data = dataCache || await initializeStorage();
        data.globalSettings = {
            ...data.globalSettings,
            ...newSettings,
            lastOpened: new Date().toISOString() // Always update last opened time
        };
        await writeData(data);
        console.log("Global settings updated:", data.globalSettings);
        return data.globalSettings;
    } catch (error) {
        console.error("Error updating global settings:", error);
        throw error;
    }
}

async function addOrUpdateTab(tabData) {
    if (!tabData || !tabData.id) throw new Error("Invalid tab data provided: Missing ID");
    try {
        const data = dataCache || await initializeStorage();
        const normalizedTab = normalizeTabData(tabData); // Ensure data conforms to model
        const index = data.tabs.findIndex(tab => tab.id === normalizedTab.id);

        if (index >= 0) { // Update existing
             // Preserve original creation time if it exists
            normalizedTab.metadata.created = data.tabs[index].metadata?.created || normalizedTab.metadata.created;
            data.tabs[index] = normalizedTab;
            console.log(`Updated tab: ${normalizedTab.id}`);
        } else { // Add new
            data.tabs.push(normalizedTab);
            console.log(`Added new tab: ${normalizedTab.id}`);
        }
        await writeData(data);
        return normalizedTab; // Return the saved/updated tab data
    } catch (error) {
        console.error(`Error adding/updating tab ${tabData.id}:`, error);
        throw error;
    }
}

async function removeTab(tabId) {
    if (!tabId) throw new Error("Invalid tab ID provided for removal");
    try {
        const data = dataCache || await initializeStorage();
        const initialLength = data.tabs.length;
        data.tabs = data.tabs.filter(tab => tab.id !== tabId);
        if (data.tabs.length < initialLength) {
            await writeData(data);
            console.log(`Removed tab: ${tabId}`);
            return true; // Indicate success
        } else {
            console.warn(`Tab not found for removal: ${tabId}`);
            return false; // Indicate tab not found
        }
    } catch (error) {
        console.error(`Error removing tab ${tabId}:`, error);
        throw error;
    }
}

// Removed addJournalEntry function

module.exports = {
    initializeStorage,
    getGlobalSettings,
    getAllTabs,
    getTabDataById,
    updateGlobalSettings,
    addOrUpdateTab,
    removeTab,
    // Export default data structure for reference (e.g., in main process)
    getDefaultData
};