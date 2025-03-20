const { contextBridge, ipcRenderer } = require('electron');

// Flag to prevent multiple initialization
let hasInitialized = false;

contextBridge.exposeInMainWorld('electronAPI', {
    // Window controls
    closeWindow: () => ipcRenderer.send('close-window'),
    minimizeWindow: () => ipcRenderer.send('minimize-window'),

    // File Operations
    readFile: (filePath) => ipcRenderer.invoke('read-file', filePath),
    writeFile: (filePath, data) => ipcRenderer.invoke('write-file', filePath, data),

    // Utility functions
    getHomeDir: () => ipcRenderer.invoke('get-home-dir'),
    joinPath: (...paths) => {
        // Convert paths to a simple array of strings before sending
        const pathsArray = paths.map(p => String(p));
        return ipcRenderer.invoke('join-path', pathsArray);
    },

    // File system operations
    fileExists: (filePath) => ipcRenderer.invoke('file-exists', filePath),
    directoryExists: (dirPath) => ipcRenderer.invoke('directory-exists', dirPath),
    createDirectory: (dirPath) => ipcRenderer.invoke('create-directory', dirPath),
    createDataDir: (dirPath) => ipcRenderer.invoke('create-data-dir', dirPath),
    getAppDataPath: () => ipcRenderer.invoke('get-app-data-path'),
    
    // Window management
    createNewWindow: (options) => {
        // Ensure options is serializable
        const serializedOptions = JSON.parse(JSON.stringify(options));
        return ipcRenderer.invoke('create-new-window', serializedOptions);
    },
    deleteTab: (tabId) => ipcRenderer.invoke('delete-tab', tabId),

    // Add this to listen for the init event (with duplicate protection)
    onInitNewTab: (callback) => {
        if (!hasInitialized) {
            ipcRenderer.on('init-new-tab', (event, options) => {
                hasInitialized = true;
                callback(event, options);
            });
        }
    },

    // Add this to the electronAPI object in preload.js
    getTabData: (tabId) => ipcRenderer.invoke('get-tab-data', tabId),
});