#!/usr/bin/env node

const { app, BrowserWindow, ipcMain } = require('electron');
const path = require('path');
const fs = require('fs');

let win;

function createWindow() {
    win = new BrowserWindow({
        width: 700,
        height: 600,
        // minWidth: 300,
        // minHeight: 400,
        frame: false,     // Borderless window
        resizable: true,
        transparent: true,
        webPreferences: {
            nodeIntegration: false,
            contextIsolation: true,
            sandbox: false,
            preload: path.join(__dirname, 'preload.js'),
        },
    });

    win.loadFile('index.html');
}

app.whenReady().then(() => {
    createWindow();
    // mac os close handling
    app.on('activate', function () {
        if (BrowserWindow.getAllWindows().length === 0) createWindow();
    });
});

 // Window and Linux close handling
app.on('window-all-closed', function () {
    if (process.platform !== 'darwin') app.quit();
});

// IPC handlers for window control
ipcMain.on('close-window', () => {
    if (win) win.close();
});

ipcMain.on('minimize-window', () => {
    if (win) win.minimize();
});

ipcMain.on('resize-window', (event, dimensions) => {
    const window = BrowserWindow.fromWebContents(event.sender);
    window.setSize(dimensions.width, dimensions.height);
});

ipcMain.handle('get-app-data-path', () => {
    return app.getPath('appData');
});

// IPC Handlers for File Operations
ipcMain.handle('read-file', async (event, filePath) => {
    try {
        const data = fs.readFileSync(filePath, 'utf8');
        return data;
    } catch (error) {
        console.error(`Failed to read file at ${filePath}:`, error);
        return null;
    }
});

ipcMain.handle('write-file', async (event, filePath, data) => {
    try {
        fs.writeFileSync(filePath, data, 'utf8');
        return true;
    } catch (error) {
        console.error(`Failed to write file at ${filePath}:`, error);
        return false;
    }
});

ipcMain.handle('create-data-dir', async (event, dirPath) => {
    try {
        if (!fs.existsSync(dirPath)) {
            fs.mkdirSync(dirPath, { recursive: true });
        }
        return true;
    } catch (error) {
        console.error(`Failed to create directory at ${dirPath}:`, error);
        return false;
    }
});

module.exports = {
    createWindow,
};