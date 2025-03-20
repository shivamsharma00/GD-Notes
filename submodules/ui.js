// UI Module
// import Storage from './storage.js';
import Utils from './utils.js';
import Storage from './storage.js';

// Elements
let textBox = [];
let closeBtn, minimizeBtn, settingsBtn, settingsModal, closeSettingsBtn;
let fontSelect, fontSizeSelect, themeToggle, themeIcon, shadowColorPicker;
let textBoxThemeSelect, saveSettingsBtn;

let journalActive = false;
let moodJournals = [];

let tabs = [];

// Add this function at the top of your file, after the imports
function logElement(id) {
    const element = document.getElementById(id);
    console.log(`Element ${id}:`, element);
    if (element) {
        console.log(`- classList:`, element.classList);
        console.log(`- style.display:`, window.getComputedStyle(element).display);
        console.log(`- visibility:`, window.getComputedStyle(element).visibility);
        console.log(`- offsetHeight:`, element.offsetHeight);
        console.log(`- offsetWidth:`, element.offsetWidth);
    }
}

const initialize = () => {
    textBox = [
        document.getElementById('text-box-1'),
        document.getElementById('text-box-2'),
        document.getElementById('text-box-3'),
        document.getElementById('text-box-4'),
    ];

    closeBtn = document.getElementById('close-btn');
    minimizeBtn = document.getElementById('minimize-btn');
    settingsBtn = document.getElementById('settings-btn');
    settingsModal = document.getElementById('settings-modal');
    closeSettingsBtn = document.getElementById('close-settings');
    fontSelect = document.getElementById('font-select');
    fontSizeSelect = document.getElementById('font-size-select');
    themeToggle = document.getElementById('theme-toggle');
    themeIcon = document.getElementById('theme-icon');
    shadowColorPicker = document.getElementById('shadow-color');
    textBoxThemeSelect = document.getElementById('text-box-theme');
    saveSettingsBtn = document.getElementById('save-settings');

    // return Promise.resolve();
    return textBox;
};
function createNewTab(layout) {
    console.log('Creating new tab with layout:', layout);
    
    const tabId = 'tab-' + Date.now();
    
    // Get current theme mode
    const isDarkMode = document.body.classList.contains('dark-mode');
    
    // Use the first color in the appropriate theme list
    const themes = {
        light: ['#ffffff', '#f0f0f0', '#e0e0e0', '#d0d0d0'],
        dark: ['#1e1e1e', '#2e2e2e', '#3e3e3e', '#4e4e4e'],
    };
    
    const colorList = isDarkMode ? themes.dark : themes.light;
    
    // Create a new tab object
    const newTab = {
        id: tabId,
        layout: layout,
        name: layout === 'single' ? 'Single Note Pad' : 'Four Square Tab',
        content: '',
        contents: layout === 'four-square' ? ['', '', '', ''] : undefined,
        backgroundColor: colorList[0],
        backgroundColors: layout === 'four-square' ? colorList.slice(0, 4) : undefined,
        textColor: isDarkMode ? '#ffffff' : '#000000',
        textColors: layout === 'four-square' ? 
            (isDarkMode ? ['#ffffff', '#ffffff', '#ffffff', '#ffffff'] : 
                         ['#000000', '#000000', '#000000', '#000000']) : 
            undefined,
        settings: {
            fontFamily: "'Open Sans', sans-serif",
            fontSize: '16px',
            isDarkMode: isDarkMode
        }
    };
    
    // First save the tab data
    Storage.saveTab(tabId, newTab)
        .then(success => {
            if (success) {
                // Then create the window with the saved tab data
                return window.electronAPI.createNewWindow({
                    tabId: tabId,
                    layout: layout,
                    width: layout === 'single' ? 400 : 600,
                    height: layout === 'single' ? 400 : 600
                });
            } else {
                throw new Error('Failed to save tab data');
            }
        })
        .then(() => {
            // Add to tabs array after window is created
            tabs.push(newTab);
            updateTabsDropdown();
        })
        .catch(error => {
            console.error('Error creating new tab:', error);
        });
}
function setupEventListeners() {
    console.log('setupEventListeners');

    if (closeBtn) {
        closeBtn.addEventListener('click', () => {
            console.log('closeBtn clicked');
            window.electronAPI.closeWindow();
        });
    }
    if (minimizeBtn) {
        minimizeBtn.addEventListener('click', () => {
            console.log('minimizeBtn clicked');
            window.electronAPI.minimizeWindow();
        });
    }
    if (settingsBtn) {
        settingsBtn.addEventListener('click', () => settingsModal.classList.remove('hidden'));
    }
    if (closeSettingsBtn) {
        closeSettingsBtn.addEventListener('click', () => settingsModal.classList.add('hidden'));
    }

    if (shadowColorPicker) {
        shadowColorPicker.addEventListener('input', async (e) => {
            const selectedColor = e.target.value;
            document.body.style.setProperty('--status-shadow-color', selectedColor);
            const settings = (await Storage.loadSettings()) || {};
            settings.statusShadowColor = selectedColor;
            await Storage.saveSettings(settings);
        });
    }

    // Font Selection Event Listeners
    if (fontSelect) {
        fontSelect.addEventListener('change', async (e) => {
            document.body.style.setProperty('--font-family', e.target.value);
            const settings = await Storage.loadSettings() || {};
            settings.fontFamily = e.target.value;
            await Storage.saveSettings(settings);
        });
    }

    if (fontSizeSelect) {
        fontSizeSelect.addEventListener('change', async (e) => {
        document.body.style.setProperty('--font-size', e.target.value);
        const settings = await Storage.loadSettings() || {};
        settings.fontSize = e.target.value;
            await Storage.saveSettings(settings);
        });
    }

    // Toggle Dark/Light Mode
    if (themeToggle) {
        themeToggle.addEventListener('click', async () => {
            const isDarkMode = themeToggle.checked;
            applyDarkMode(isDarkMode);
            const settings = await Storage.loadSettings() || {};
            settings.isDarkMode = isDarkMode;
            await Storage.saveSettings(settings);
            // console.log('themeToggle clicked', isDarkMode);
        });
    }

    // Text box event listeners
    if (textBoxThemeSelect) {
        textBoxThemeSelect.addEventListener('change', async (e) => {
            const selectedTheme = e.target.value;
            applyTextBoxTheme(selectedTheme);
            const settings = (await Storage.loadSettings()) || {};
            settings.textBoxTheme = selectedTheme;
            await Storage.saveSettings(settings);
        });
    }
    if (saveSettingsBtn) {
        saveSettingsBtn.addEventListener('click', async () => {
            await saveSettings();
            settingsModal.classList.add('hidden');
        });
    }

    // Debug logging for dropdown elements
    console.log("=== DROPDOWN DEBUG ===");
    logElement('new-tab-btn');
    logElement('new-tab-dropdown');
    logElement('tabs-dropdown-btn');
    logElement('tabs-dropdown');
    
    // New Tab Dropdown
    const newTabBtn = document.getElementById('new-tab-btn');
    const newTabDropdown = document.getElementById('new-tab-dropdown');
    if (newTabBtn && newTabDropdown) {
        // Force initial hidden state for the dropdown
        newTabDropdown.classList.add('hidden');
        
        newTabBtn.addEventListener('click', (e) => {
          e.stopPropagation();
          e.preventDefault();
          newTabDropdown.classList.toggle('hidden');
        });
        
        // Use e.currentTarget (or the option element) to reliably read the dataset attribute
        document.querySelectorAll('.new-tab-option').forEach(option => {
          option.addEventListener('click', (e) => {
            e.stopPropagation();
            const layout = option.dataset.layout; // "single" or "four-square"
            console.log('Creating new tab with layout:', layout);
            createNewTab(layout);
            newTabDropdown.classList.add('hidden');
          });
        });
      }
      
      // Create new tab with tab-specific settings and dimensions based on layout
      
      
      // Function to properly create tab elements based on layout
      
    // if (newTabBtn && newTabDropdown) {
    //     console.log("Setting up new tab dropdown event listeners");
        
    //     // Force initial state
    //     newTabDropdown.classList.add('hidden');
        
    //     newTabBtn.addEventListener('click', (e) => {
    //         console.log("New tab button clicked");
    //         e.stopPropagation();
    //         e.preventDefault();
            
    //         // Toggle dropdown visibility
    //         const isHidden = newTabDropdown.classList.contains('hidden');
    //         console.log(`Dropdown is currently ${isHidden ? 'hidden' : 'visible'}`);
            
    //         if (isHidden) {
    //             newTabDropdown.classList.remove('hidden');
    //             console.log("Removed 'hidden' class");
    //         } else {
    //             newTabDropdown.classList.add('hidden');
    //             console.log("Added 'hidden' class");
    //         }
            
    //         // Log the state after toggle
    //         console.log("After toggle:", newTabDropdown.classList.contains('hidden') ? 'hidden' : 'visible');
    //         logElement('new-tab-dropdown');
            
    //         // Close tabs dropdown if open
    //         const tabsDropdown = document.getElementById('tabs-dropdown');
    //         if (tabsDropdown) {
    //             tabsDropdown.classList.add('hidden');
    //         }
    //     });
    // } else {
    //     console.error("Could not find new tab button or dropdown");
    // }

    // Tabs Dropdown
    const tabsDropdownBtn = document.getElementById('tabs-dropdown-btn');
    const tabsDropdown = document.getElementById('tabs-dropdown');
    if (tabsDropdownBtn && tabsDropdown) {
        // Initially hide the dropdown
        tabsDropdown.classList.add('hidden');
        
        tabsDropdownBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            e.preventDefault();
            
            // Close other dropdown if open
            if (newTabDropdown) {
                newTabDropdown.classList.add('hidden');
            }
            
            // Toggle this dropdown
            tabsDropdown.classList.toggle('hidden');
            console.log('Tabs dropdown visibility:', !tabsDropdown.classList.contains('hidden'));
        });
    }

    // Global click handler to close dropdowns
    document.addEventListener('click', (e) => {
        const dropdowns = [newTabDropdown, tabsDropdown];
        const buttons = [newTabBtn, tabsDropdownBtn];
        
        if (!buttons.some(btn => btn && btn.contains(e.target))) {
            dropdowns.forEach(dropdown => {
                if (dropdown && !dropdown.contains(e.target)) {
                    dropdown.classList.add('hidden');
                }
            });
        }
    });

    setupTextBoxEventListeners();
};

function createTabElement(tab) {
    const container = document.getElementById('text-box-container');
    if (!container) {
        console.error('Text box container not found');
        return;
    }
    
    // Clear any existing content in the container
    container.innerHTML = '';
    
    // Set the container class based on layout
    container.className = ''; // Clear existing classes
    container.id = 'text-box-container';
    
    if (tab.layout === 'single') {
        // Add single layout class to container
        container.classList.add('single-layout');
        
        // Create a single text box
        const singleBox = document.createElement('div');
        singleBox.classList.add('text-box', 'single-box');
        singleBox.id = 'text-box-1'; // Use consistent ID for event binding
        singleBox.contentEditable = "true";
        singleBox.spellcheck = true;
        singleBox.innerHTML = tab.content || '';
        
        // Apply styles
        singleBox.style.width = '100%';
        singleBox.style.height = '100%';
        singleBox.style.backgroundColor = tab.backgroundColor || '#ffffff';
        singleBox.style.color = tab.textColor || '#000000';
        
        if (tab.settings) {
            singleBox.style.fontFamily = tab.settings.fontFamily || 'inherit';
            singleBox.style.fontSize = tab.settings.fontSize || 'inherit';
        }
        
        // Add event listeners
        singleBox.addEventListener('input', () => {
            tab.content = singleBox.innerHTML;
            Storage.saveTab(tab.id, tab);
        });
        
        container.appendChild(singleBox);
        textBox = [singleBox]; // Update the textBox array reference
    } else {
        // Add four-square layout class to container
        container.classList.add('four-square-layout');
        
        // Create four text boxes for the four-square layout
        for (let i = 0; i < 4; i++) {
            const boxDiv = document.createElement('div');
            boxDiv.classList.add('text-box');
            boxDiv.id = `text-box-${i+1}`;
            boxDiv.contentEditable = "true";
            boxDiv.spellcheck = true;
            
            // Load existing content if available
            if (tab.contents && tab.contents[i]) {
                boxDiv.innerHTML = tab.contents[i];
            }
            
            // Apply styles
            if (tab.backgroundColors && tab.backgroundColors[i]) {
                boxDiv.style.backgroundColor = tab.backgroundColors[i];
                boxDiv.style.color = tab.textColors && tab.textColors[i] ? 
                    tab.textColors[i] : '#000000';
            } else {
                // Default colors if not specified
                const defaultColors = tab.settings?.isDarkMode ? 
                    ['#1e1e1e', '#2e2e2e', '#3e3e3e', '#4e4e4e'] : 
                    ['#ffffff', '#f0f0f0', '#e0e0e0', '#d0d0d0'];
                
                boxDiv.style.backgroundColor = defaultColors[i];
                boxDiv.style.color = tab.settings?.isDarkMode ? '#ffffff' : '#000000';
            }
            
            if (tab.settings) {
                boxDiv.style.fontFamily = tab.settings.fontFamily || 'inherit';
                boxDiv.style.fontSize = tab.settings.fontSize || 'inherit';
            }
            
            // Add event listeners
            boxDiv.addEventListener('input', () => {
                // Initialize contents array if it doesn't exist
                if (!tab.contents) tab.contents = ['', '', '', ''];
                tab.contents[i] = boxDiv.innerHTML;
                Storage.saveTab(tab.id, tab);
            });
            
            container.appendChild(boxDiv);
        }
        
        // Update the textBox array reference
        textBox = [
            document.getElementById('text-box-1'),
            document.getElementById('text-box-2'),
            document.getElementById('text-box-3'),
            document.getElementById('text-box-4'),
        ];
    }
    
    // Setup event listeners for all text boxes
    setupTextBoxEventListeners();
}
async function saveSettings() {
    const settings = await Storage.loadSettings() || {};
    
    settings.fontFamily = fontSelect.value;
    settings.fontSize = fontSizeSelect.value;
    settings.isDarkMode = themeToggle.checked;
    settings.textBoxTheme = textBoxThemeSelect.value;
    
    await Storage.saveSettings(settings);
    applySettings(settings);
}

function setupTextBoxEventListeners() {
    textBox.forEach((box, index) => {
        if (box) {
            box.addEventListener('keydown', (e) => handleTextBoxKeyDown(e, box, index));
            box.addEventListener('input', async () => {
                // await Storage.saveContent(index, box.innerHTML);
                debouncedSave(index, box.innerHTML);
            });
        }
    });
}

// Function to handle keydown events in text boxes
function handleTextBoxKeyDown(e, box, index) {
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
        // Handle -j command
        if (beforeCursor.trim().endsWith('-j')) {
            e.preventDefault();
            if (textNode.nodeType === Node.TEXT_NODE) {
                textNode.textContent = textContent.replace(/-j\s*$/, '');
                }
            toggleJournalMode(box, index);
            return;
        } else if (isInJournal) {
            // Inside Journal Mode
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
                return;
            }
        }

        if (beforeCursor.trim().endsWith('*') || beforeCursor.trim().endsWith('-')) {
            // Handle bullet points
            e.preventDefault();
            createBulletPoint(range, textNode, textContent, beforeCursor);
            return;
        } else if (beforeCursor.trim().endsWith('[]')) {
            // Handle checkbox
            e.preventDefault();
            createCheckbox(range, textNode, textContent, beforeCursor);
            return;
        }
    }
    if (e.key === 'Enter') {
        handleAutoContinuation(e, box, index);
    }
    if (e.key === 'Backspace') {
        handleBackspace(e, box, index);
    }
}

// Function to create bullet point
function createBulletPoint(range, textNode, textContent, beforeCursor) {
    // Remove the '* ' or '- ' from the text
    textNode.textContent =
    textContent.substring(0, beforeCursor.length - 1) + textContent.substring(range.startOffset);
    
    // Create a new list item
    const li = document.createElement('li');
    li.innerHTML = '<br>'; // Placeholder
    const ul = document.createElement('ul');
    ul.appendChild(li);
    
    // Replace the current line with the list
    range.deleteContents();
    range.insertNode(ul);
    
    // Move cursor into the new list item
    placeCursorAtStart(li);
}

  // Function to create checkbox
function createCheckbox(range, textNode, textContent, beforeCursor) {
    // Remove the '[] ' from the text
    textNode.textContent =
        textContent.substring(0, beforeCursor.length - 2) + textContent.substring(range.startOffset);
    
    // Create a new paragraph with checkbox
    const p = document.createElement('p');
    const checkbox = document.createElement('input');
    checkbox.type = 'checkbox';
    p.appendChild(checkbox);
    p.appendChild(document.createTextNode(' '));
    
    // Insert the paragraph
    range.deleteContents();
    range.insertNode(p);
    
    // Move cursor after the checkbox
    placeCursorAtEnd(p);
}
    
  // Function to handle auto continuation
function handleAutoContinuation(e, box, index) {
    const selection = window.getSelection();
    if (selection.rangeCount === 0) return;
    const range = selection.getRangeAt(0);
    const currentNode = range.startContainer;
    
    // Get the current element
    // let currentElement = currentNode;
    let currentElement = currentNode.nodeType === Node.TEXT_NODE ? 
        currentNode.parentElement : 
        currentNode;
        
    while (currentElement && !currentElement.matches('li, p')) {
        currentElement = currentElement.parentElement;
    }
    if (!currentElement) return;
    
    if (currentElement.matches('li')) {
        e.preventDefault();
        
        // If the list item is empty, exit the list
        if (currentElement.textContent.trim() === '') {
            // Remove the empty list item
            const ul = currentElement.parentElement;
            currentElement.remove();
        
        // If the list is empty, remove it
        if (ul.children.length === 0) {
            ul.remove();
        }
        
        // Insert a paragraph
        const p = document.createElement('p');
        p.innerHTML = '<br>';
        range.insertNode(p);
            placeCursorAtStart(p);
        } else {
            // Create a new list item
            const newLi = document.createElement('li');
            newLi.innerHTML = '<br>';
            currentElement.parentElement.insertBefore(newLi, currentElement.nextSibling);
            placeCursorAtStart(newLi);
        }
    } else if (currentElement.matches('p') && currentElement.querySelector('input[type="checkbox"]')) {
        e.preventDefault();
        
        // If the paragraph is empty, exit the checkbox mode
        if (currentElement.textContent.trim() === '') {
        // Remove the empty paragraph
            currentElement.remove();
            
            // Insert a new paragraph
            const p = document.createElement('p');
            p.innerHTML = '<br>';
            range.insertNode(p);
            placeCursorAtStart(p);
        } else {
            // Create a new paragraph with checkbox
            const p = document.createElement('p');
            const checkbox = document.createElement('input');
            checkbox.type = 'checkbox';
            p.appendChild(checkbox);
            p.appendChild(document.createTextNode(' '));
            p.innerHTML += '<br>';
            
            currentElement.parentElement.insertBefore(p, currentElement.nextSibling);
            placeCursorAtStart(p);
        }
    }
}
    
  // Function to handle backspace
function handleBackspace(e, box, index) {
    const selection = window.getSelection();
    if (selection.rangeCount === 0) return;

    const range = selection.getRangeAt(0);
    const currentNode = range.startContainer;

    // Get the current element, making sure we get an Element node, not a Text node
    let currentElement = currentNode.nodeType === Node.TEXT_NODE ? 
        currentNode.parentElement : 
        currentNode;
    
    // Get the current element
    // let currentElement = currentNode;
    // while (currentElement && currentElement.nodeType !== Node.ELEMENT_NODE) {
    //     currentElement = currentElement.parentElement;
    // }
    // if (!currentElement) return;
    
    while (currentElement && !currentElement.matches('li, p')) {
        currentElement = currentElement.parentElement;
    }
    if (!currentElement) return;
    
    if (currentElement.matches('li')) {
      // If the list item is empty, and backspace is pressed, exit the list
        if (currentElement.textContent.trim() === '') {
            e.preventDefault();
            const ul = currentElement.parentElement;
            currentElement.remove();
            
            // If the list is empty, remove it
            if (ul.children.length === 0) {
                ul.remove();
            }
            // Insert a paragraph
            const p = document.createElement('p');
            p.innerHTML = '<br>';
            range.insertNode(p);
            placeCursorAtStart(p);
        }
    } else if (currentElement.matches('p') && currentElement.querySelector('input[type="checkbox"]')) {
      // If the paragraph is empty, and backspace is pressed, exit checkbox mode
        if (currentElement.textContent.trim() === '') {
            e.preventDefault();
            currentElement.remove();
            
            // Insert a new paragraph
            const p = document.createElement('p');
            p.innerHTML = '<br>';
            range.insertNode(p);
            placeCursorAtStart(p);
        }
    }
}

  // Function to place cursor at the start of an element
function placeCursorAtStart(element) {
    if (!element) return;

    const range = document.createRange();
    const sel = window.getSelection();
    range.setStart(element, 0);
    range.collapse(true);
    sel.removeAllRanges();
    sel.addRange(range);
    }

// Function to place cursor at the end of an element
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

// Function to toggle journal mode
function toggleJournalMode(box, index) {
    if (!journalActive) {
      // Start journal mode
        journalActive = true;

        // Insert Journal Container on the next line
        const journalContainer =
        '<p class="journal-entry" contenteditable="true" style="white-space: pre-wrap;">Journal mode active. Type your entry here. Use -j to end.</p>';
        const journalNode = insertHtmlOnNewLine(journalContainer);
        
        // Ensure the cursor is placed inside the journal-entry on a new line
        if (journalNode && journalNode.classList.contains('journal-entry')) {
        // Move cursor into the journal entry
            placeCursorAtEnd(journalNode);
        } else {
            console.error('Journal node not found or does not have the correct class');
        }
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
            mood: '',
        });
        Storage.saveMoodJournals(moodJournals);
        
        insertTextAtCursor('');
    }
}

// Function to insert HTML on a new line
function insertHtmlOnNewLine(html) {
    const selection = window.getSelection();
    if (selection.rangeCount > 0) {
        const range = selection.getRangeAt(0);

        // Move to the end of current line
        range.setStartAfter(range.endContainer);
        
        // Insert a line break
        const br = document.createElement('br');
        range.insertNode(br);
        range.setStartAfter(br);
        
        // Insert the HTML content
        const el = document.createElement('div');
        el.innerHTML = html;
        const frag = document.createDocumentFragment();
        let node;
        while ((node = el.firstChild)) {
            frag.appendChild(node);
        }
        range.insertNode(frag);
        
      // Move cursor into the inserted content
        if (node) {
            range.setStart(node, 0);
            range.collapse(true);
            selection.removeAllRanges();
            selection.addRange(range);
            return node;
        }
    }
    return null;
}

// Function to insert text at cursor
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

// Function to apply dark mode
const applyDarkMode = async (isDarkMode) => {
    document.body.classList.toggle('dark-mode', isDarkMode);
    themeIcon.src = isDarkMode ? 'assets/light-mode.png' : 'assets/dark-mode.png';
    // Re-apply settings
    const settings = await Storage.loadSettings() || {};
    applyTextBoxTheme(settings.textBoxTheme || 'default');
    console.log('applyDarkMode', isDarkMode);
};

function applySettings(settings) {
    if (!settings) return;
    
    // Apply Font Family
    const fontFamily = settings.fontFamily || "'Open Sans', sans-serif";
    fontSelect.value = fontFamily;
    document.documentElement.style.setProperty('--font-family', fontFamily);
    
    // Apply Font Size
    const fontSize = settings.fontSize || '16px';
    fontSizeSelect.value = fontSize;
    document.documentElement.style.setProperty('--font-size', fontSize);
    
    // Apply Text Box Theme
    const textBoxTheme = settings.textBoxTheme || 'default';
    const textBoxThemeSelect = document.getElementById('text-box-theme');
    textBoxThemeSelect.value = textBoxTheme;
    if (textBoxTheme !== 'default') {
        applyTextBoxTheme(textBoxTheme);
    }

    // Apply Dark Mode
    const isDarkMode = settings.isDarkMode || false;
    themeToggle.checked = isDarkMode;
    document.body.classList.toggle('dark-mode', isDarkMode);
    document.body.classList.toggle('dark-mode-active', isDarkMode);
    themeIcon.src = isDarkMode ? 'assets/light-mode.png' : 'assets/dark-mode.png';
};

function getContrastYIQ(hexcolor){
    hexcolor = hexcolor.replace('#', '');
    const r = parseInt(hexcolor.substr(0,2),16);
    const g = parseInt(hexcolor.substr(2,2),16);
    const b = parseInt(hexcolor.substr(4,2),16);
    const yiq = ((r*299)+(g*587)+(b*114))/1000;
    return (yiq >= 128) ? '#000000' : '#ffffff';
}

function applyTextBoxTheme(theme) {
    const themes = {
        default: {
            light: ['#ffffff', '#f0f0f0', '#e0e0e0', '#d0d0d0'],
            dark: ['#1e1e1e', '#2e2e2e', '#3e3e3e', '#4e4e4e'],
        },
        warm: {
            light: ['#FFF5F5', '#FFE6E6', '#FFCCCC', '#FFB3B3'],
            dark: ['#331A1A', '#4D1F1F', '#662626', '#803030'],
        },
        cool: {
            light: ['#E6F7FF', '#CCF0FF', '#B3E6FF', '#99DBFF'],
            dark: ['#1A3333', '#1F4D4D', '#266666', '#308080'],
        },
        nature: {
            light: ['#E8F5E9', '#C8E6C9', '#A5D6A7', '#81C784'],
            dark: ['#1B5E20', '#2E7D32', '#388E3C', '#43A047'],
        },
        sunset: {
            light: ['#FFF3E0', '#FFE0B2', '#FFCC80', '#FFB74D'],
            dark: ['#BF360C', '#D84315', '#E64A19', '#F4511E'],
        },
        blue: {
            light: ['#E6F7FF', '#CCF0FF', '#B3E6FF', '#99DBFF'],
            dark: ['#080d14', '#141928', '#1e293c', '#28344c'],
        },
    };

    // const isDarkMode = themeToggle.checked ? 'dark' : 'light';
    const isDarkMode = document.body.classList.contains('dark-mode') ? 'dark' : 'light';
    // const colors = themes[theme][isDarkMode] || [];
    
    if (theme === 'default') {
        textBox.forEach((box) => {
            box.style.backgroundColor = '';
            box.style.color = '';
        });
    } else {
        const colors = themes[theme][isDarkMode] || [];

        textBox.forEach((box, index) => {
            const bgColor = colors[index % colors.length];
            const textColor = getContrastYIQ(bgColor);
            box.style.backgroundColor = bgColor;
            box.style.color = textColor;
        });
    }
}

function debounce(func, wait) {
    let timeout;
    return function(...args) {
        clearTimeout(timeout);
        timeout = setTimeout(() => func.apply(this, args), wait);
    };
}

const debouncedSave = debounce(async (index, content) => {
    await Storage.saveContent(index, content);
}, 1000);

async function initTabs() {
    console.log("Here")
    tabs = await Storage.loadTabs();
    tabs.forEach(tab => {
        createTabElement(tab);
    });
    updateTabsDropdown();
}

// Function to update tabs dropdown
function updateTabsDropdown() {
    const dropdown = document.getElementById('tabs-dropdown');
    dropdown.innerHTML = ''; // Clear previous entries
    
    if (tabs.length === 0) {
        const entry = document.createElement('div');
        entry.classList.add('tab-entry');
        entry.textContent = 'No tabs yet';
        dropdown.appendChild(entry);
        return;
    }
    
    tabs.forEach(tab => {
        const entry = document.createElement('div');
        entry.classList.add('tab-entry');
        entry.textContent = tab.name || `Tab ${tab.id.substring(4, 8)}`;
        
        // Create a delete icon/button for this tab
        const deleteBtn = document.createElement('button');
        deleteBtn.classList.add('delete-tab-btn');
        deleteBtn.innerHTML = '<img src="assets/delete.png" alt="Delete Tab">';
        deleteBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            removeTab(tab.id);
        });
        
        // Only add delete button if we have more than one tab
        if (tabs.length > 1) {
            entry.appendChild(deleteBtn);
        }
        
        // Clicking the entry brings the tab into focus
        entry.addEventListener('click', () => {
            focusTab(tab.id);
        });
        
        dropdown.appendChild(entry);
    });
}

// Remove a tab from the UI and from the tabs array.
function removeTab(tabId) {
    // First check if we have more than one tab
    if (tabs.length <= 1) {
        console.log("Cannot delete the last tab");
        return;
    }
    
    // Remove from tabs array
    tabs = tabs.filter(t => t.id !== tabId);
    
    // Update the tabs dropdown
    updateTabsDropdown();
    
    // Save tabs to storage
    Storage.saveTabs(tabs);
    
    // Tell the main process to close the window for this tab
    window.electronAPI.deleteTab(tabId);
}

// Bring a tab into view/focus.
function focusTab(tabId) {
    const tabElem = document.getElementById(tabId);
    if (tabElem) {
      tabElem.scrollIntoView({ behavior: 'smooth' });
      tabElem.focus();
    }
}

export default {
    initialize,
    get textBox() { return textBox; },
    setupEventListeners,
    applyDarkMode,
    applySettings,
    applyTextBoxTheme,
    initTabs,
    createTabElement,
    removeTab,
    createNewTab,
    updateTabsDropdown,
};