// Storage Module
import Utils from './utils.js';

const APP_NAME = 'SmartStickyNotes';
const NOTES_DIR = 'notes';
const SETTINGS_DIR = 'settings';
const JOURNALS_DIR = 'journals';

let notesDir;
let settingsDir;
let journalsDir;

let dataFiles;
let settingsFile;
let journalsFile;

const initialize = async () => {
    try {

        const homeDir = window.electronAPI.getHomeDir();
        notesDir = window.electronAPI.joinPath(homeDir, APP_NAME, NOTES_DIR);
        settingsDir = window.electronAPI.joinPath(homeDir, APP_NAME, SETTINGS_DIR);
        journalsDir = window.electronAPI.joinPath(homeDir, APP_NAME, JOURNALS_DIR);

        // Ensure the data directory exists
        await create_directory(notesDir);
        await create_directory(settingsDir);
        await create_directory(journalsDir);

        // Initialize data files
        dataFiles = [
            window.electronAPI.joinPath(notesDir, 'notes1.html'),
            window.electronAPI.joinPath(notesDir, 'notes2.html'),
            window.electronAPI.joinPath(notesDir, 'notes3.html'),
            window.electronAPI.joinPath(notesDir, 'notes4.html'),
        ];

        // Ensure all required files exist
        for (let filePath of dataFiles) {
            await create_empty_file(filePath, '');
        }
        
        // Initialize settings file
        settingsFile = window.electronAPI.joinPath(settingsDir, 'settings.json');
        await create_empty_file(settingsFile, '{}');

        // Initialize mood journals
        journalsFile = window.electronAPI.joinPath(journalsDir, 'journals.json');
        await create_empty_file(journalsFile, '[]');
    }
    catch (error) {
        console.error('Error initializing storage:', error);
    }
};

const create_empty_file = async (filePath, data) => {
    const fileExists = await window.electronAPI.fileExists(filePath);
    if (!fileExists) {
        const success = await window.electronAPI.writeFile(filePath, data);
        if (!success) {
            console.error(`Failed to create file: ${filePath}`);
        }
    }
}

const create_directory = async (dirPath) => {
    const dirExists = await window.electronAPI.directoryExists(dirPath);
    if (!dirExists) {
        const success = await window.electronAPI.createDirectory(dirPath);
        if (!success) {
            console.error(`Failed to create directory: ${dirPath}`);
        }
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
    

export default {
    initialize,
    saveContent,
    loadContent,
    loadSettings,
    saveSettings,
    saveMoodJournals,
    loadMoodJournals,
};
