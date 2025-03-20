// Storage Module
import Utils from './utils.js';

const APP_NAME = 'SmartStickyNotes';
const NOTES_DIR = 'notes';
const SETTINGS_DIR = 'settings';
const JOURNALS_DIR = 'journals';

const homeDir = window.electronAPI.getHomeDir();
const settingsDir = window.electronAPI.joinPath(homeDir, APP_NAME, SETTINGS_DIR);  
const TABS_FILE = window.electronAPI.joinPath(settingsDir, 'tabs.json');

let notesDir;
let journalsDir;

let dataFiles;
let settingsFile;
let journalsFile;

const initialize = async () => {
    try {
        console.log("Initializing storage...");
        
        // Get home directory
        const homeDir = await window.electronAPI.getHomeDir();
        if (!homeDir) {
            console.error('Failed to get home directory');
            return false;
        }
        
        // Create paths
        const appDir = await window.electronAPI.joinPath(homeDir, APP_NAME);
        notesDir = await window.electronAPI.joinPath(appDir, NOTES_DIR);
        settingsDir = await window.electronAPI.joinPath(appDir, SETTINGS_DIR);
        journalsDir = await window.electronAPI.joinPath(appDir, JOURNALS_DIR);
        
        // Ensure the data directories exist
        await window.electronAPI.createDirectory(appDir);
        await window.electronAPI.createDirectory(notesDir);
        await window.electronAPI.createDirectory(settingsDir);
        await window.electronAPI.createDirectory(journalsDir);

        // Initialize data files
        dataFiles = [
            await window.electronAPI.joinPath(notesDir, 'notes1.html'),
            await window.electronAPI.joinPath(notesDir, 'notes2.html'),
            await window.electronAPI.joinPath(notesDir, 'notes3.html'),
            await window.electronAPI.joinPath(notesDir, 'notes4.html'),
        ];

        // Ensure all required files exist
        for (let filePath of dataFiles) {
            await create_empty_file(filePath, '');
        }
        
        // Initialize settings file
        settingsFile = await window.electronAPI.joinPath(settingsDir, 'settings.json');
        await create_empty_file(settingsFile, '{}');

        TABS_FILE = await window.electronAPI.joinPath(settingsDir, 'tabs.json');
        await create_empty_file(TABS_FILE, '[]');

        // Initialize mood journals
        journalsFile = await window.electronAPI.joinPath(journalsDir, 'journals.json');
        await create_empty_file(journalsFile, '[]');
        
        console.log("Storage initialization complete");
        return true;
    }
    catch (error) {
        console.error('Error initializing storage:', error);
        return false;
    }
};

const create_empty_file = async (filePath, data) => {
    try {
        if (!filePath) {
            console.error('Invalid file path');
            return false;
        }
        
        const fileExists = await window.electronAPI.fileExists(filePath);
        if (!fileExists) {
            const success = await window.electronAPI.writeFile(filePath, data);
            if (!success) {
                console.error(`Failed to create file: ${filePath}`);
                return false;
            }
        }
        return true;
    } catch (error) {
        console.error('Error creating file:', error, 'Path:', filePath);
        return false;
    }
}

const create_directory = async (dirPath) => {
    try {
        const dirExists = await window.electronAPI.directoryExists(dirPath);
        if (!dirExists) {
            const success = await window.electronAPI.createDirectory(dirPath);
            if (!success) {
                console.error(`Failed to create directory: ${dirPath}`);
                return false;
            }
        }
        return true;
    } catch (error) {
        console.error('Error creating directory:', error);
        return false;
    }
}

const saveContent = async (index, content) => {
    if (index < 0 || index >= dataFiles.length) {
        console.error('Invalid index:', index);
        return;
    }
    const success = await window.electronAPI.writeFile(dataFiles[index], content);
    console.log('saveContent', success);
    if (!success) {
        console.error(`Failed to save content to file: ${dataFiles[index]}`);
    }
};

const loadContent = async (index) => {
    const contents = await Promise.all(
        dataFiles.map(async (filePath) => {
            const data = await window.electronAPI.readFile(filePath);
            return data || '';
        })
    );
    return contents;

};

const loadSettings = async () => {
    const data = await window.electronAPI.readFile(settingsFile);
    if (data) {
        try {
            const settings = JSON.parse(data);
            return settings;
        }
        catch (error) {
            console.error('Error parsing settings:', error);
            return null;
        }
    } else {
        console.log('No settings file found');
        return null;
    }
};

const saveSettings = async (settings) => {
    
    const success = await window.electronAPI.writeFile(
        settingsFile, 
        JSON.stringify(settings, null, 2), 
        'utf8'
    );
    if (!success) {
        console.error(`Failed to save settings to file: ${settingsFile}`);
    }
};

const saveMoodJournals = async (moodJournals) => {
    const success = await window.electronAPI.writeFile(
        journalsFile,
        JSON.stringify(moodJournals, null, 2),
        'utf8'
    );
    if (!success) {
        console.error(`Failed to save mood journals to file: ${journalsFile}`);
    }
};
    
const loadMoodJournals = async () => {
    const data = await window.electronAPI.readFile(journalsFile);
    if (data) {
        try {
            const moodJournals = JSON.parse(data);
            return moodJournals;
        } catch (error) {
            console.error('Error parsing mood journals:', error);
            return [];
        }
    } else {
        console.log('No mood journals file found');
        return [];
    }
};


const saveTabs = async (tabs) => {
    try {
        console.log(tabs)
        // Create a safe copy of the tabs array with only serializable data
        const safeTabs = tabs.map(tab => ({
            id: tab.id,
            layout: tab.layout || 'single',
            name: tab.name || `Tab ${tab.id.substring(4, 8)}`,
            backgroundColor: typeof tab.backgroundColor === 'string' ? tab.backgroundColor : '#ffffff',
            backgroundColors: Array.isArray(tab.backgroundColors) ? 
                tab.backgroundColors.map(c => typeof c === 'string' ? c : '#ffffff') : 
                undefined,
            textColor: typeof tab.textColor === 'string' ? tab.textColor : '#000000',
            textColors: Array.isArray(tab.textColors) ? 
                tab.textColors.map(c => typeof c === 'string' ? c : '#000000') : 
                undefined,
            content: typeof tab.content === 'string' ? tab.content : '',
            contents: Array.isArray(tab.contents) ? 
                tab.contents.map(c => typeof c === 'string' ? c : '') : 
                undefined,
            settings: {
                fontFamily: tab.settings?.fontFamily || "'Open Sans', sans-serif",
                fontSize: tab.settings?.fontSize || '16px',
                isDarkMode: !!tab.settings?.isDarkMode
            }
        }));
        
        // Convert to JSON string
        const jsonData = JSON.stringify(safeTabs, null, 2);
        
        // Write to file
        const success = await window.electronAPI.writeFile(TABS_FILE, jsonData, 'utf8');
        
        if (!success) {
            console.error(`Failed to save tabs to file: ${TABS_FILE}`);
        }
        return success;
    } catch (error) {
        console.error('Error in saveTabs:', error);
        return false;
    }
};

const loadTabs = async () => {
    const data = await window.electronAPI.readFile(TABS_FILE);
    if (data) {
        try {
        const tabs = JSON.parse(data);
        return tabs;
        } catch (error) {
        console.error('Error parsing tabs:', error);
        return [];
        }
    } else {
        return [];
    }
};

const saveTab = async (tabId, tabData) => {
    try {
        // Make sure we have a valid tabId
        if (!tabId) {
            console.error('Invalid tab ID');
            return false;
        }
        
        // Create a simplified version of the tab data with only what we need to store
        const simplifiedTabData = {
            id: tabId,
            layout: tabData.layout || 'single',
            name: tabData.name || `Tab ${tabId.substring(4, 8)}`,
            backgroundColor: typeof tabData.backgroundColor === 'string' ? tabData.backgroundColor : '#ffffff',
            backgroundColors: Array.isArray(tabData.backgroundColors) ? 
                tabData.backgroundColors.map(c => typeof c === 'string' ? c : '#ffffff') : 
                undefined,
            textColor: typeof tabData.textColor === 'string' ? tabData.textColor : '#000000',
            textColors: Array.isArray(tabData.textColors) ? 
                tabData.textColors.map(c => typeof c === 'string' ? c : '#000000') : 
                undefined,
            content: typeof tabData.content === 'string' ? tabData.content : '',
            contents: Array.isArray(tabData.contents) ? 
                tabData.contents.map(c => typeof c === 'string' ? c : '') : 
                undefined,
            settings: {
                fontFamily: tabData.settings?.fontFamily || "'Open Sans', sans-serif",
                fontSize: tabData.settings?.fontSize || '16px',
                isDarkMode: !!tabData.settings?.isDarkMode
            }
        };
        
        // Load existing tabs
        let tabs = [];
        try {
            tabs = await loadTabs();
        } catch (error) {
            console.warn('Could not load existing tabs, starting with empty array', error);
            tabs = [];
        }
        
        // Find and update or add the tab
        const existingTabIndex = tabs.findIndex(tab => tab.id === tabId);
        if (existingTabIndex >= 0) {
            tabs[existingTabIndex] = simplifiedTabData;
        } else {
            tabs.push(simplifiedTabData);
        }
        
        // Save the updated tabs array
        return await saveTabs(tabs);
    } catch (error) {
        console.error('Error saving tab:', error);
        return false;
    }
};

const deleteTab = async (tabId) => {
    let tabs = await loadTabs();
    tabs = tabs.filter(tab => tab.id !== tabId);
    
    // Ensure we always have at least one tab
    if (tabs.length === 0) {
        // Create a default tab
        const defaultTab = createDefaultTab();
        tabs.push(defaultTab);
    }
    
    await saveTabs(tabs);
    return true;
};

const createDefaultTab = () => {
    const tabId = 'tab-' + Date.now();
    const isDarkMode = false; // Default to light mode
    
    // Generate a random color
    const h = Math.floor(Math.random() * 360);
    const s = 30 + Math.floor(Math.random() * 40);
    const l = 75 + Math.floor(Math.random() * 15);
    const randomColor = `hsl(${h}, ${s}%, ${l}%)`;
    
    // Determine text color (simple algorithm)
    const textColor = l < 50 ? '#ffffff' : '#000000';
    
    return {
        id: tabId,
        layout: 'single',
        content: '',
        name: 'Default Note',
        backgroundColor: randomColor,
        textColor: textColor,
        settings: {
            fontFamily: "'Open Sans', sans-serif",
            fontSize: '16px',
            isDarkMode: false
        }
    };
};

const getTabById = async (tabId) => {
    try {
        const tabs = await loadTabs();
        return tabs.find(tab => tab.id === tabId) || null;
    } catch (error) {
        console.error('Error getting tab by ID:', error);
        return null;
    }
};

export default {
    initialize,
    saveContent,
    loadContent,
    loadSettings,
    saveSettings,
    saveMoodJournals,
    loadMoodJournals,
    saveTabs,
    loadTabs,
    saveTab,
    deleteTab,
    createDefaultTab,
    getTabById,
};
