const fs = require('fs').promises;
const path = require('path');
const os = require('os');

const TEMP_SUFFIX = '.tmp'
const APP_NAME = 'Parmesan'

let unifiedFilePath = null;
let dataCache = null;

// Returns the default data structures
function getDefaultData() {
    return {
        appVersion: "1.0.0",
        glbalSettings: {
            theme: "light",
            defaultFontFamily: "'Open Sans', sans-serif",
            defaultFontSize: "12px",
            lastOpened: new Date().toISOString()
        },
        tabs: [], 
        journals: []
    };
}

// Initialize storage by ensuring exist and loading or creating the unified file.
async function initializeStorage() {
    try {
        const homeDir = os.homedir();
        const appDir = path.join(homeDir, APP_NAME);
        const settingsDir = path.join(appDir, 'settings');

        // Create directories recursively
        await fs.mkdir(appDir, { recursive: true});
        await fs.mkdir(settingsDir, { recursive: true});

        unifiedFilePath = path.join(settingsDir, 'appData.json')
        
        // create the file if it doesm't exist
        try {
            await fs.access(unifiedFilePath);
        } catch (err) {
            // File doesn't exist, write default data
            dataCache = getDefaultData();
            await writeData(dataCache);
        }

        // Load the data into the cache
        const dataStr = await fs.readFile(unifiedFilePath, 'utf-8')
        dataCache = JSON.parse(dataStr);

        return dataCache;
    }catch (error) {
        console.error('Error initializing storage:', error);
        throw error;
    }
}

// Write data automatically: write to a temporary file then remove it.
async function writeData(data) {
    try {
        if (!unifiedFilePath) {
            throw new Error("Storage not initialized");
        }

        const tempPath = unifiedFilePath + TEMP_SUFFIX;
        const dataStr = JSON.stringify(data, null, 2);

        // write to temporary file first
        await fs.writeFile(tempPath, dataStr, 'utf-8');
        // Rename temp file to final file (atomic operation)
        await fs.rename(tempPath, unifiedFilePath);

        // update cache
        dataCache = data
    } catch (error) {
        console.error('Error writing unified data file:', error);
        throw error;
    }
}

// Update global settings and refresh the unified JSON file.
async function updateGlobalSettings(newSettings) {
    try { 
        const data = dataCache || await initializeStorage();
        data.globalSettings = {
            ...data.globalSettings,
            ...newSettings,
            lastOpened: new Date().toISOString()
        };
        await writeData(data);
        return data.globalSettings;
    } catch (error) {
        throw error;
    }
}

// Add or update a tab entry
async function addOrUpdateTab(tabData) {
    try {
        const data = dataCache || await initializeStorage();
        const index = data.tabs.findIndex(tab => tab.id === tabData.id);
        if (index >= 0) {
            // Update existing tab (and upload modified time)
            data.tabs[index] = {
                ...data.tabs[index],
                ...tabData,
                metadata: {
                    ...data.tabs[index].metadata,
                    modified: new data().toISOString()
                }
            };
        } else {
            // Add new tab with creation metadata
            tabData.metadata = {
                created: new Date().toISOString(),
                modified: new Date().toISOString()
            };
            data.tabs.push(tabData);
        }
        await writeData(data);
        return tabData;
    } catch (error) {
        throw error;
    }
}

// Remove a tab by its ID.
async function removeTab(tabId) {
    try {
        const data = dataCache || await initializeStorage();
        data.tabs = data.tabs.filter(tab => tab.id !== tabId);
        await writeData(data);
        return true;
    } catch (error) {
        throw error;
    }
}

// Add a new journal entry.
async function addJournalEntry(entry) {
    try {
        const data = dataCache || await initializeStorage();
        const journal = {
            id: 'journal-' + Date.now(),
            timestamp: new Date().toISOString(),
            entry: entry,
            mood: ""
        };
        data.journals.push(journal);
        await writeData(data);
        return journal;
    } catch (error) {
        throw error;
    }
}

module.exports = {
    initializeStorage,
    updateGlobalSettings,
    addOrUpdateTab,
    removeTab,
    addJournalEntry,
    getDefaultData
};
