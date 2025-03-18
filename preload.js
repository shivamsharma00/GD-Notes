const { contextBridge, ipcRenderer } = require('electron');
const fs = require('fs').promises;
const os = require('os');
const path = require('path');
const { app } = require('electron');


contextBridge.exposeInMainWorld('electronAPI', {

    closeWindow: () => ipcRenderer.send('close-window'),
    minimizeWindow: () => ipcRenderer.send('minimize-window'),

    // File Operations
    readFile: (filePath) => ipcRenderer.invoke('read-file', filePath),
    writeFile: (filePath, data) => ipcRenderer.invoke('write-file', filePath, data),
    createDataDir: (dirPath) => ipcRenderer.invoke('create-data-dir', dirPath),

    // utility functions
    getHomeDir: () => os.homedir(),
    joinPath: (...paths) => path.join(...paths),

    existsSync: (filePath) => fs.existsSync(filePath),
    mkdirSync: (dirPath, options) => fs.mkdirSync(dirPath, options),
    writeFileSync: (filePath, data, encoding) => fs.writeFileSync(filePath, data, encoding),
    
    getAppDataPath: () => ipcRenderer.invoke('get-app-data-path'),

    createDirectory: async (dirPath) => {
        try {
            await fs.mkdir(dirPath, { recursive: true });
            return true;
        } catch (error) {
            console.error('Failed to create directory:', error);
            return false;
        }
    },

    directoryExists: async (dirPath) => {
        try {
          await fs.access(dirPath);
          return true;
        } catch {
          return false;
        }
      },
    fileExists: async (filePath) => {
        try {
          await fs.access(filePath);
          return true;
        } catch {
          return false;
        }
      },
    // readFile: (filePath) => fs.readFileSync(filePath, 'utf8'),
    // writeFile: (filePath, data) => fs.writeFileSync(filePath, data, 'utf8'),
    // ipcRenderer: {
    //     send: (channel, data) => ipcRenderer.send(channel, data),
    //     on: (channel, func) => ipcRenderer.on(channel, (event, ...args) => func(...args)),
    // },
});