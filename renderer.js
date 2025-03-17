const { ipcRenderer } = require('electron');
const fs = require('fs');
const os = require('os');
const path = require('path');

let journalActive = false;
let journalContent = '';
let moodJournals = [];
// Elements
const textBox = [
  document.getElementById('text-box-1'),
  document.getElementById('text-box-2'),
  document.getElementById('text-box-3'),
  document.getElementById('text-box-4'),
];

const closeBtn = document.getElementById('close-btn');
const minimizeBtn = document.getElementById('minimize-btn');
const settingsBtn = document.getElementById('settings-btn');
const settingsModal = document.getElementById('settings-modal');
const closeSettingsBtn = document.getElementById('close-settings');
const fontSelect = document.getElementById('font-select');
const fontSizeSelect = document.getElementById('font-size-select');
const themeToggle = document.getElementById('theme-toggle');
const themeIcon = document.getElementById('theme-icon');
const shadowColorPicker = document.getElementById('shadow-color');
const saveSettingsBtn = document.getElementById('save-settings');

const themes = {
  light: {
    warm: ['#FFF5F5', '#FFE6E6', '#FFCCCC', '#FFB3B3'],
    cool: ['#E6F7FF', '#CCF0FF', '#B3E6FF', '#99DBFF'],
  },
  dark: {
    warm: ['#331A1A', '#4D1F1F', '#662626', '#803030'],
    cool: ['#1A3333', '#1F4D4D', '#266666', '#308080'],
  }
};

shadowColorPicker.addEventListener('input', (e) => {
  const selectedColor = e.target.value;
  // Set CSS variable with opacity (50%)
  document.documentElement.style.setProperty('--status-shadow-color', hexToRgba(selectedColor, 0.5));
  // Save to localStorage
  localStorage.setItem('statusShadowColor', selectedColor);
});

// Utility function to convert hex to rgba
function hexToRgba(hex, alpha) {
  let r = 0, g = 0, b = 0;
  // 3 digits
  if (hex.length === 4) {
    r = "0x" + hex[1] + hex[1];
    g = "0x" + hex[2] + hex[2];
    b = "0x" + hex[3] + hex[3];
  // 6 digits
  } else if (hex.length === 7) {
    r = "0x" + hex[1] + hex[2];
    g = "0x" + hex[3] + hex[4];
    b = "0x" + hex[5] + hex[6];
  }
  return `rgba(${+r}, ${+g}, ${+b}, ${alpha})`;
}

// Data Directory
const dataDir = path.join(os.homedir(), '.sticky-notes-electron');
if (!fs.existsSync(dataDir)) {
  fs.mkdirSync(dataDir);
}
const dataFile = [
  path.join(dataDir, 'notes1.html'),
  path.join(dataDir, 'notes2.html'),
  path.join(dataDir, 'notes3.html'),
  path.join(dataDir, 'notes4.html'),
]

const settingsFile = path.join(dataDir, 'settings.json');

// Close Button
closeBtn.addEventListener('click', () => {
  ipcRenderer.send('close-window');
});

// Minimize Button
minimizeBtn.addEventListener('click', () => {
  ipcRenderer.send('minimize-window');
});

// Settings Modal
settingsBtn.addEventListener('click', () => {
  settingsModal.classList.remove('hidden');
});

closeSettingsBtn.addEventListener('click', () => {
  settingsModal.classList.add('hidden');
});

saveSettingsBtn.addEventListener('click', () => {
  saveSettings();
  applySettings();
  settingsModal.classList.add('hidden');
});

document.querySelectorAll('input[type="color"]').forEach(input => {
  const preview = input.nextElementSibling;
  preview.style.backgroundColor = input.value;
  input.addEventListener('input', () => {
    preview.style.backgroundColor = input.value;
  });
});

// Toggle Dark/Light Mode
themeToggle.addEventListener('click', () => {
  const isDarkMode = themeToggle.checked;
  document.body.classList.toggle('dark-mode', isDarkMode);
  // document.body.classList.toggle('dark-mode-active', isDarkMode);
  themeIcon.src = isDarkMode ? 'assets/light-mode.png' : 'assets/dark-mode.png';

  // Apply the theme again to adjust colors
  const theme = document.getElementById('text-box-theme').value;
  // if (theme !== 'default') {
  applyTextBoxTheme(theme);
  // }
  saveSettings();
  applySettings();
});

// Font Selection
fontSelect.addEventListener('change', (e) => {
  const fontFamily = e.target.value;
  document.body.style.setProperty('--font-family', fontFamily);
  saveSettings();
});

// Font Size Selection
fontSizeSelect.addEventListener('change', (e) => {
  const fontSize = e.target.value;
  document.body.style.setProperty('--font-size', fontSize);
  saveSettings();
  applySettings();
});

// Save Content on Input
textBox.forEach((textBox, index) => {
  textBox.addEventListener('input', () => {
    saveContent(index);
  });
});

// Load Content and Settings on Startup
window.onload = () => {
  loadContent();
  loadSettings();
  // loadMoodJournals();
  // Apply Markdown Formatting on Load
  textBox.forEach((textBox) => {
    applyFormatting(textBox);
  });
};


// Event listener for theme selection
document.getElementById('text-box-theme').addEventListener('change', (e) => {
  const theme = e.target.value;
  if (theme !== 'default') {
    applyTextBoxTheme(theme);
    saveSettings();
    }
  });
// Event listener for space and enter key
textBox.forEach((box, index) => {
  box.addEventListener('keydown', (e) => {
    const selection = window.getSelection();
    if (selection.rangeCount === 0) return;

    const range = selection.getRangeAt(0);
    const textNode = range.startContainer;
    const textContent = textNode.textContent;
    const beforeCursor = textContent.substring(0, range.startOffset);
    
    // Check if currently inside a journal entry
    const journalEntry = box.querySelector('.journal-entry');
    const isInJournal = journalEntry && isSelectionInside(journalEntry);

    if (e.key === ' ' || e.key === 'Enter') {
      //Handle -j command
      if (beforeCursor.trim().endsWith('-j')) {
        e.preventDefault();
        if (textNode.nodeType === Node.TEXT_NODE) {
          textNode.textContent = textContent.replace(/-j\s*$/, '');
        }
        toggleJournalMode(box, index);
      } else if (isInJournal) {
        // Inside Journal Mode
        // Allow default behaviour (space and enter key)
        // However check for -j and toggle journal mode if found
        const journalRange = selection.getRangeAt(0);
        const journalTextNode = journalRange.startContainer;
        const journalTextContent = journalTextNode.textContent;
        const journalBeforeCursor = journalTextContent.substring(0, journalRange.startOffset);

        if (journalBeforeCursor.trim().endsWith('-j')) {
          e.preventDefault();
          if (journalTextNode.nodeType === Node.TEXT_NODE) {
            journalTextNode.textContent = journalTextContent.replace(/-j\s*$/, '');
          }
          toggleJournalMode(box, index);
        }
      } 
    }

    if (e.key === ' ') {
      if (beforeCursor.trim().endsWith('*') || beforeCursor.trim().endsWith('-')) {
        // Handle bullet points
        e.preventDefault();
        const newNode = document.createElement('li');
        newNode.innerHTML = '&nbsp;'; // Placeholder
        const ul = document.createElement('ul');
        ul.appendChild(newNode);
        // Replace the current line with the list
        textNode.textContent = textContent.substring(0, beforeCursor.length - 2);
        range.insertNode(ul);
        // Move cursor into the new list item
        placeCursorAtEnd(newNode);
        saveContent(index);
      } else if (beforeCursor.trim().endsWith('[]')) {
        // Handle checkbox
        e.preventDefault();
        const p = document.createElement('p');
        const checkbox = document.createElement('input');
        checkbox.type = 'checkbox';
        p.appendChild(checkbox);
        p.appendChild(document.createTextNode(' '));
        // Replace the current line with the checkbox
        textNode.textContent = textContent.substring(0, beforeCursor.length - 3);
        range.insertNode(p);
        // Move cursor after the checkbox
        placeCursorAtEnd(p);
        saveContent(index);
      }
    } else if (e.key === 'Enter') {
      handleAutoContinuation(box, index, e);
    }
  });
  // ... rest of the event listeners remain the same
});
// Event listener for space and enter key
  // textBox.forEach((box, index) => {
  //   box.addEventListener('keydown', (e) => {
  //     if (e.key === 'Enter') {
  //       const selection = window.getSelection();
  //       if (selection.rangeCount === 0) return;

  //       const range = selection.getRangeAt(0);
  //       const textNode = range.startContainer;
  //       const textContent = textNode.textContent;
  //       const beforeCursor = textContent.substring(0, range.startOffset);
        
  //       // Check if currently inside a journal entry
  //       const journalEntry = box.querySelector('.journal-entry');
  //       const isInJournal = journalEntry && isSelectionInside(journalEntry);

  //       //Handle /j command
  //       console.log(beforeCursor);
  //       if (beforeCursor.trim().endsWith('-j')) {
  //         e.preventDefault();
  //         textNode.textContent = textContent.replace(/-j\s*$/, '');
  //         toggleJournalMode(box, index);
  //       } else if (isInJournal) {
  //         // Inside Journal Mode
  //         // Allow default behaviour (space and enter key)
  //         // However check for -j and toggle journal mode if found
  //         const journalRange = selection.getRangeAt(0);
  //         const journalTextNode = journalRange.startContainer;
  //         const journalTextContent = journalTextNode.textContent;
  //         const journalBeforeCursor = journalTextContent.substring(0, journalRange.startOffset);

  //         if (journalBeforeCursor.trim().endsWith('-j')) {
  //           e.preventDefault();
  //           journalTextNode.textContent = journalTextContent.replace(/-j\s*$/, '');
  //           toggleJournalMode(box, index);
  //         }
  //       } 
  //       else if (beforeCursor.trim().endsWith('*') || beforeCursor.trim().endsWith('-')) {
  //         // Prevent default space character
  //         e.preventDefault();
  //         // Replace '* ' or '- ' with bullet point
  //         const newNode = document.createElement('li');
  //         newNode.innerHTML = '&nbsp;'; // Placeholder
  //         const ul = document.createElement('ul');
  //         ul.appendChild(newNode);
  //         // Replace the current line with the list
  //         textNode.textContent = textContent.substring(0, beforeCursor.length - 2);
  //         range.insertNode(ul);
  //         // Move cursor into the new list item
  //         placeCursorAtEnd(newNode);
  //         saveContent(index);
  //       } else if (beforeCursor.trim().endsWith('[]')) {
  //         // Handle checkbox
  //         e.preventDefault();
  //         const p = document.createElement('p');
  //         const checkbox = document.createElement('input');
  //         checkbox.type = 'checkbox';
  //         p.appendChild(checkbox);
  //         p.appendChild(document.createTextNode(' '));
  //         // Replace the current line with the checkbox
  //         textNode.textContent = textContent.substring(0, beforeCursor.length - 3);
  //         range.insertNode(p);
  //         // Move cursor after the checkbox
  //         placeCursorAtEnd(p);
  //         saveContent(index);
  //       }
  //       else
  //       {
  //         handleAutoContinuation(box, index, e);
  //       }
  //     }
  //   });
    // Add event listener for input event
  //   box.addEventListener('input', () => {
  //     if (journalActive) {
  //       const journalEntry = box.querySelector('.journal-entry');
  //       if (journalEntry) {
  //       journalContent = journalEntry.innerText;
  //     } else {
  //       saveContent(index);
  //     }
  //     }
  //   });
  // });

// Function to insert HTML on a new line
function insertHtmlOnNewLine(html) {
  const selection = window.getSelection();
  if (selection.rangeCount > 0) {
    const range = selection.getRangeAt(0);
    
    // Insert a <br> to move to a new line
    const br = document.createElement('br');
    range.insertNode(br);
    
    // Insert the HTML content
    const el = document.createElement('div');
    el.innerHTML = html;
    const frag = document.createDocumentFragment();
    let node;
    const nodes = [];
    while ((node = el.firstChild)) {
      nodes.push(node);
      frag.appendChild(node);
    }
    range.insertNode(frag);

    // Update the range to after the inserted content
    // const insertedNodes = frag.childNodes;
    if (nodes.length > 0) {
      const lastNode = nodes[nodes.length - 1];
      range.setStartAfter(lastNode);
      range.setEndAfter(lastNode);
    
    selection.removeAllRanges();
    selection.addRange(range);
    
    return lastNode;
  }
}
return null;
}

  function toggleJournalMode(box, index) {
    if (!journalActive) {
      // Start journal mode
      journalActive = true;
      journalContent = '';
      
      // Insert Journal Container on the next line
      const journalContainer = '<p class="journal-entry" contenteditable="true" style="white-space: pre-wrap;">Journal mode active. Type your entry here. Use -j to end.</p>';
      const journalNode = insertHtmlOnNewLine(journalContainer);
  
      // Ensure the cursor is placed inside the journal-entry on a new line
      if (journalNode && journalNode.classList.contains('journal-entry')) {
        // Programmatically insert a new line (Enter key equivalent) and place cursor inside
        const newLine = document.createElement('br');  // Create a new line break
        journalNode.appendChild(newLine);  // Add the line break inside the journal entry
        placeCursorAtEnd(journalNode);  // Place the cursor at the end of the journal entry
      } else {
        console.error('Journal node not found or does not have the correct class');
      }
      saveContent(index);
    } else {
      // End journal mode
      journalActive = false;
      // Extract journal content
      const journalEntry = box.querySelector('.journal-entry');
      let journalText = '';
      if (journalEntry) {
        journalText = journalEntry.innerText;
        journalEntry.remove();
      }
      
      const timestamp = new Date().toISOString();
      moodJournals.push({
        timestamp: timestamp,
        journal: journalText,
        mood: ""
      });
      saveMoodJournals();
      insertTextAtCursor('');
      saveContent(index);
      // Add status label
      const statusLabel = document.getElementById('status-label');
      statusLabel.textContent = 'Journal saved';
      setTimeout(() => { statusLabel.textContent = ''; }, 5000);
    }
  }
  
  function insertTextAtCursor(text) {
    const selection = window.getSelection();
    const range = selection.getRangeAt(0);
    const textNode = document.createTextNode(text);
    range.insertNode(textNode);
    range.setStartAfter(textNode);
    range.setEndAfter(textNode);
    selection.removeAllRanges();
    selection.addRange(range);
  }

// Function to Place Cursor at the End
function placeCursorAtEnd(element) {
  if (!element) return;

  const range = document.createRange();
  const sel = window.getSelection();
  range.selectNodeContents(element);
  range.collapse(false);
  sel.removeAllRanges();
  sel.addRange(range);
}

// Function to check if the current selection is inside a specific element
function isSelectionInside(element) {
  const selection = window.getSelection();
  if (selection.rangeCount === 0) return false;
  let node = selection.getRangeAt(0).commonAncestorContainer;
  while (node) {
    if (node === element) return true;
    node = node.parentNode;
  }
  return false;
}

function handleAutoContinuation(box, index, e) {
  const selection = window.getSelection();
  const range = selection.getRangeAt(0);
  const textNode = range.startContainer;

  // Get the previous element
  let prevElement = textNode.parentElement;
  if (textNode.nodeType === Node.TEXT_NODE) {
    prevElement = textNode.parentElement;
  }

  if (prevElement.tagName === 'LI') {
    e.preventDefault();

    // Create a new list item
    const newNode = document.createElement('li');
    newNode.innerHTML = '&nbsp;';
    prevElement.parentNode.appendChild(newNode);

    // Move cursor to new list item
    placeCursorAtEnd(newNode);

    saveContent(index);
  } else if (prevElement.tagName === 'P' && prevElement.querySelector('input[type="checkbox"]')) {
    e.preventDefault();

    // Create a new paragraph with checkbox
    const p = document.createElement('p');
    const checkbox = document.createElement('input');
    checkbox.type = 'checkbox';
    p.appendChild(checkbox);
    p.appendChild(document.createTextNode(' '));

    // Append to the text box
    box.appendChild(p);
    // Move cursor to the new paragraph
    placeCursorAtEnd(p);
    saveContent(index);
  }
}

// Save Content Function
function saveContent(index) {
  fs.writeFile(dataFile[index], textBox[index].innerHTML, (err) => {
    if (err) console.error('Failed to save content:', err);
  });
}

// Load Content Function
function loadContent() {
  textBox.forEach((textBox, index) => {
    fs.readFile(dataFile[index], 'utf8', (err, data) => {
      if (!err && data) {
        textBox.innerHTML = data;
      }
    });
  });
}

// Function to Apply Settings
function applySettings() {
  // Apply Font Family
  const fontFamily = fontSelect.value;
  document.documentElement.style.setProperty('--font-family', fontFamily);

  // Apply Font Size
  const fontSize = fontSizeSelect.value;
  document.documentElement.style.setProperty('--font-size', fontSize);

  // Apply Text Box Theme
  const textBoxTheme = document.getElementById('text-box-theme').value;
  if (textBoxTheme !== 'default') {
    applyTextBoxTheme(textBoxTheme);
  }

  // Apply Dark Mode
  const isDarkMode = themeToggle.checked;
  document.body.classList.toggle('dark-mode', isDarkMode);
  document.body.classList.toggle('dark-mode-active', isDarkMode);
  themeIcon.src = isDarkMode ? 'assets/light-mode.png' : 'assets/dark-mode.png';
}

// Save Settings Function
function saveSettings() {
  // Read Settings
  let existingSettings = {};
  try {
    const data = fs.readFileSync(settingsFile, 'utf8');
    existingSettings = JSON.parse(data);
  } catch (error) {
    console.error('Error reading settings file:', error);
  }

  const settings = {
    ...existingSettings,
    isDarkMode: themeToggle.checked,
    fontFamily: fontSelect.value,
    fontSize: fontSizeSelect.value,
    apiKeys: {
      telegramChatId: document.getElementById('telegram-chat-id').value,
      openaiApiKey: document.getElementById('openai-api-key').value,
      perplexityApiKey: document.getElementById('perplexity-api-key').value,
    }
  };

  const currentMode = themeToggle.checked ? 'dark' : 'light';
  settings[currentMode] = settings[currentMode] || {};
  settings[currentMode].textBoxTheme = document.getElementById('text-box-theme').value;

  // save settings
  fs.writeFile(settingsFile, JSON.stringify(settings, null, 2), (err) => {
    if (err) console.error('Failed to save settings:', err);
  });
}

// Load Settings Function
function loadSettings() {
  fs.readFile(settingsFile, 'utf8', (err, data) => {
    if (!err && data) {
      const settings = JSON.parse(data);

      // Apply settings
      themeToggle.checked = settings.isDarkMode;
      document.body.classList.toggle('dark-mode', settings.isDarkMode);
      document.body.classList.toggle('dark-mode-active', settings.isDarkMode);
      themeIcon.src = settings.isDarkMode ? 'assets/light-mode.png' : 'assets/dark-mode.png';

      // Load font family and size
      fontSelect.value = settings.fontFamily || '';
      document.body.style.setProperty('--font-family', settings.fontFamily || '');

      fontSizeSelect.value = settings.fontSize || '';
      document.body.style.setProperty('--font-size', settings.fontSize || '');

      // Load theme based on mode
      const mode = settings.isDarkMode ? 'dark' : 'light';
      const textBoxTheme = settings[mode]?.textBoxTheme || 'default';
      document.getElementById('text-box-theme').value = textBoxTheme;
      if (textBoxTheme !== 'default') {
        applyTextBoxTheme(textBoxTheme);
      }

      // Apply Other Settings
      if (settings.apiKeys) {
        document.getElementById('telegram-chat-id').value = settings.apiKeys.telegramChatId || '';
        document.getElementById('openai-api-key').value = settings.apiKeys.openaiApiKey || '';
        document.getElementById('perplexity-api-key').value = settings.apiKeys.perplexityApiKey || '';
      }
    }
    else {
      console.log('No settings file found');
    }
  });
}

function saveMoodJournals() {
  const moodJournalsFile = path.join(dataDir, 'moodJournals.json');
  fs.writeFile(moodJournalsFile, JSON.stringify(moodJournals, null, 2), (err) => {
    if (err) console.error('Failed to save mood journals:', err);
  });
}

function loadMoodJournals() {
  const moodJournalsFile = path.join(dataDir, 'moodJournals.json');
  fs.readFile(moodJournalsFile, 'utf8', (err, data) => {
    if (!err && data) {
      moodJournals = JSON.parse(data);
    }
  });
}

function applyTextBoxTheme(theme) {
  const is_dark_mode = themeToggle.checked;

  if (theme === 'default' || is_dark_mode) {
    
    textBox.forEach((box) => {
      box.style.backgroundColor = '';
      box.style.color = '';
  });
} else {
  // Apply theme colors in light mode
  const colors = themes.light[theme] || [];

  textBox.forEach((box, index) => {
    box.style.backgroundColor = colors[index % colors.length];
    // Adjust text color based on background for readability
    box.style.color = '#000000';
  });
}
}

// Apply Markdown-like Formatting
function applyFormatting(textBox) {
  const selection = window.getSelection();
  let cursorPosition = 0;
  if (selection.rangeCount>0) {
    cursorPosition = selection.getRangeAt(0).startOffset;
  }

  // Get text content
  let content = textBox.innerHTML;

  // Apply formatting rules
  content = content
    // Headings
    .replace(/(^|\n)# (.+?)(\n|$)/g, '$1<h1>$2</h1>$3')
    .replace(/(^|\n)## (.+?)(\n|$)/g, '$1<h2>$2</h2>$3')
    // Italic with /i
    .replace(/\/i (.+?) \/i/g, '<em>$1</em>')
    // Bold
    .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
    // Italic
    .replace(/\*(.+?)\*/g, '<em>$1</em>')
    // Bullet points
    .replace(/(^|\n)(\*|\-|\+) $/g, '$1<ul><li><br></li></ul>')
    .replace(/(^|\n)(\*|\-|\+) (.+?)(\n|$)/g, '$1<ul><li>$3</li></ul>$4')
    // Checkboxes
    .replace(/(^|\n)\[\] $/g, '$1<p><input type="checkbox"> <br></p>')
    .replace(/(^|\n)\[x\] $/g, '$1<p><input type="checkbox" checked> <br></p>')
    .replace(/(^|\n)\[\] (.+?)(\n|$)/g, '$1<p><input type="checkbox"> $2</p>$3')
    .replace(/(^|\n)\[x\] (.+?)(\n|$)/g, '$1<p><input type="checkbox" checked> $2</p>$3');

  // Update content without losing cursor position
  textBox.innerHTML = content;
  restoreCursorPosition(textBox, cursorPosition);
}

// Restore Cursor Position
function restoreCursorPosition(element, position) {
  const range = document.createRange();
  const sel = window.getSelection();
  let charCount = 0;
  let found = false;

  function traverseNodes(node) {
    if (found) return;
    if (node.nodeType === Node.TEXT_NODE) {
      const textLength = node.textContent.length;
      if (charCount + textLength >= position) {
        range.setStart(node, position - charCount);
        found = true;
      } else {
        charCount += textLength;
      }
    } else {
      for (let i = 0; i < node.childNodes.length; i++) {
        traverseNodes(node.childNodes[i]);
        if (found) break;
      }
    }
  }

  traverseNodes(element);
  if (!found) {
    range.setStart(element, element.childNodes.length);
  }
  range.collapse(true);
  sel.removeAllRanges();
  sel.addRange(range);
}