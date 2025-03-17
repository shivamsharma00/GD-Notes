// modules/content.js
const fs = require('fs');
const path = require('path');
const os = require('os');

const dataDir = path.join(os.homedir(), '.sticky-notes-electron');
const dataFiles = [
  path.join(dataDir, 'notes1.html'),
  path.join(dataDir, 'notes2.html'),
  path.join(dataDir, 'notes3.html'),
  path.join(dataDir, 'notes4.html'),
];

function saveContent(index, content) {
  fs.writeFile(dataFiles[index], content, (err) => {
    if (err) console.error('Failed to save content:', err);
  });
}

function loadContent(index, callback) {
  fs.readFile(dataFiles[index], 'utf8', (err, data) => {
    if (!err && data) {
      callback(data);
    }
  });
}

module.exports = {
  saveContent,
  loadContent,
};
