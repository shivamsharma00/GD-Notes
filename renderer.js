// // Modules

// Modules
import UI from './submodules/ui.js';
import Storage from './submodules/storage.js';
import Formatting from './submodules/formatting.js';
import Journal from './submodules/journal.js';
import Utils from './submodules/utils.js';


// Initialize application on load
window.onload = async () => {
  await Storage.initialize();
  const textBox = await UI.initialize();

  UI.setupEventListeners();

  const contents = await Storage.loadContent();
  
  UI.textBox.forEach((box, index) => {
    if (box && contents[index]) {
      box.innerHTML = contents[index];
    }
  });

  const settings = await Storage.loadSettings();
  UI.applySettings(settings);

  // Load mood journals
  // const moodJournals = await Storage.loadMoodJournals();
  // UI.setMoodJournals(moodJournals);
};