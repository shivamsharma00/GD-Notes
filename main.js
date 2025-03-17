#!/usr/bin/env node

const { app, BrowserWindow } = require('electron');
const path = require('path');
const { ipcMain } = require('electron');
function createWindow() {
    const win = new BrowserWindow({
        width: 700,
        height: 600,
        // minWidth: 300,
        // minHeight: 400,
        frame: false,     // Borderless window
        resizable: true,
        transparent: true,
        webPreferences: {
            nodeIntegration: true,
            contextIsolation: false,
        },
    });

    win.loadFile('index.html');

    // Open devtools if needed
    // win.webContents.openDevTools();
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
ipcMain.on('close-window', (event) => {
    const window = BrowserWindow.fromWebContents(event.sender);
    window.close();
});

ipcMain.on('resize-window', (event, dimensions) => {
    const window = BrowserWindow.fromWebContents(event.sender);
    window.setSize(dimensions.width, dimensions.height);
});
