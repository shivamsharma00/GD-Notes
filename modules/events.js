// modules/events.js
const { ipcRenderer } = require('electron');
const { saveContent } = require('./content');
const { applyFormatting } = require('./formatting');
const { toggleJournalMode } = require('./journal');

function setupEventListeners(textBoxes) {
  // Close Button
  document.getElementById('close-btn').addEventListener('click', () => {
    ipcRenderer.send('close-window');
  });

  // Other event listeners...

  // Text Box Input
  textBoxes.forEach((textBox, index) => {
    textBox.addEventListener('input', () => {
      saveContent(index, textBox.innerHTML);
    });

    textBox.addEventListener('keydown', (e) => {
      // Handle formatting, journal mode, etc.
      if (e.key === 'Enter') {
        handleEnterKey(e, textBox, index);
      }

      // Additional keydown handlers...
    });
  });
}

function handleEnterKey(e, textBox, index) {
  // Logic for handling Enter key
}

module.exports = {
  setupEventListeners,
};
