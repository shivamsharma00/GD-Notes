// modules/settings.js
const fs = require('fs');
const path = require('path');
const os = require('os');

const dataDir = path.join(os.homedir(), '.sticky-notes-electron');
const settingsFile = path.join(dataDir, 'settings.json');

function loadSettings(callback) {
  fs.readFile(settingsFile, 'utf8', (err, data) => {
    if (!err && data) {
      const settings = JSON.parse(data);
      callback(settings);
    } else {
      console.log('No settings file found');
      callback({});
    }
  });
}

function saveSettings(settings) {
  fs.writeFile(settingsFile, JSON.stringify(settings, null, 2), (err) => {
    if (err) console.error('Failed to save settings:', err);
  });
}

module.exports = {
  loadSettings,
  saveSettings,
};
