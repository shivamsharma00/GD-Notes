// ui.js
import Utils from './utils.js'; // Retain any utility functions if needed

let textBox = [];
let settingsModal, fontSelect, fontSizeSelect, themeToggle, textBoxThemeSelect, saveSettingsBtn;
let newTabBtn, newTabDropdown, tabsDropdownBtn, tabsDropdown;
let currentTab = null;

const COLOR_THEMES = {
    default: { light: ['#ffffff', '#f0f0f0', '#e0e0e0', '#d0d0d0'], dark: ['#1e1e1e', '#2e2e2e', '#3e3e3e', '#4e4e4e'] },
    warm:    { light: ['#FFF5F5', '#FFE6E6', '#FFCCCC', '#FFB3B3'], dark: ['#331A1A', '#4D1F1F', '#662626', '#803030'] },
    cool:    { light: ['#E6F7FF', '#CCF0FF', '#B3E6FF', '#99DBFF'], dark: ['#1A3333', '#1F4D4D', '#266666', '#308080'] },
    nature:  { light: ['#E8F5E9', '#C8E6C9', '#A5D6A7', '#81C784'], dark: ['#1B5E20', '#2E7D32', '#388E3C', '#43A047'] },
    sunset:  { light: ['#FFF3E0', '#FFE0B2', '#FFCC80', '#FFB74D'], dark: ['#BF360C', '#D84315', '#E64A19', '#F4511E'] },
    blue:    { light: ['#E6F7FF', '#CCF0FF', '#B3E6FF', '#99DBFF'], dark: ['#080d14', '#141928', '#1e293c', '#28344c'] },
};

const initialize = () => {
    textBox = [
        document.getElementById('text-box-1'),
        document.getElementById('text-box-2'),
        document.getElementById('text-box-3'),
        document.getElementById('text-box-4')
    ];
    settingsModal = document.getElementById('settings-modal');
    fontSelect = document.getElementById('font-select');
    fontSizeSelect = document.getElementById('font-size-select');
    themeToggle = document.getElementById('theme-toggle');
    textBoxThemeSelect = document.getElementById('text-box-theme');
    saveSettingsBtn = document.getElementById('save-settings');
    newTabBtn = document.getElementById('new-tab-btn');
    newTabDropdown = document.getElementById('new-tab-dropdown');
    tabsDropdownBtn = document.getElementById('tabs-dropdown-btn');
    tabsDropdown = document.getElementById('tabs-dropdown');
    return textBox;
};

function applySettings(settings) {
    if (!settings) return;
    document.body.style.setProperty('--font-family', settings.defaultFontFamily);
    document.body.style.setProperty('--font-size', settings.defaultFontSize);
    if (settings.theme === 'dark') {
        document.body.classList.add('dark-mode');
    } else {
        document.body.classList.remove('dark-mode');
    }
}

function initTabs(tabsArray) {
    if (!tabsDropdown) return;
    
    tabsDropdown.innerHTML = '';
    if (!tabsArray || tabsArray.length === 0) {
        tabsDropdown.innerHTML = '<div class="tab-entry">No tabs yet</div>';
        return;
    }
    }
    
    tabsArray.forEach(tab => {
        const entry = document.createElement('div');
        entry.className = 'tab-entry';
        
        // Create a span for the tab name
        const nameSpan = document.createElement('span');
        nameSpan.textContent = tab.name || tab.id;
        nameSpan.className = 'tab-name';
        
        // Add click event to the name span to open the tab
        nameSpan.addEventListener('click', () => {
            window.electronAPI.createNewWindow(tab)
                .then(() => console.log('Tab window opened for:', tab.id))
                .catch(console.error);
        });
        
        // Create delete button
        const deleteBtn = document.createElement('button');
        deleteBtn.className = 'delete-tab-btn';
        const deleteImg = document.createElement('img');
        deleteImg.src = 'assets/delete.png'; // Ensure this icon exists in your assets folder
        deleteImg.alt = 'Delete Tab';
        deleteBtn.appendChild(deleteImg);
        deleteBtn.addEventListener('click', (e) => {
            e.stopPropagation(); // Prevent triggering the tab open
            window.electronAPI.removeTab(tab.id)
                .then(() => {
                    entry.remove();
                    console.log('Tab removed:', tab.id);
                })
                .catch(console.error);
        });
        
        entry.appendChild(nameSpan);
        entry.appendChild(deleteBtn);
        tabsDropdown.appendChild(entry);
    });


function createTabElement(tab) {
  const container = document.getElementById('text-box-container');
  if (!container) return;
  container.innerHTML = '';

  if (tab.layout === 'single') {
    console.log("Creating single layout");
    container.className = 'single-layout';
    const singleBox = document.createElement('div');
    singleBox.className = 'text-box single-box';
    singleBox.id = 'text-box-1';
    singleBox.contentEditable = "true";
    // Use the content from the first note
    singleBox.innerHTML = tab.notes && tab.notes[0] ? tab.notes[0].content : "";
    
    // Apply appearance settings
    if (tab.appearance) {
      singleBox.style.backgroundColor = tab.appearance.backgroundColor || "#ffffff";
      singleBox.style.color = tab.appearance.textColor || "#000000";
      singleBox.style.fontFamily = tab.appearance.fontFamily || "'Open Sans', sans-serif";
      singleBox.style.fontSize = tab.appearance.fontSize || "16px";
    }
    
    // Add input event listener
    singleBox.addEventListener('input', () => {
      console.log("Text input detected in single box");
      if (tab.notes && tab.notes[0]) {
        tab.notes[0].content = singleBox.innerHTML;
        tab.notes[0].metadata.lastModified = new Date().toISOString();
      } else {
        // Create notes array if it doesn't exist
        tab.notes = [{
          id: "note-1",
          content: singleBox.innerHTML,
          metadata: { created: new Date().toISOString(), lastModified: new Date().toISOString() }
        }];
      }
      window.electronAPI.addOrUpdateTab(tab)
        .catch(err => console.error('Error saving tab content:', err));
    });
    
    container.appendChild(singleBox);
    textBox = [singleBox];
    
  } else if (tab.layout === 'four-square') {
    console.log("Creating four-square layout");
    container.className = 'four-square-layout';
    
    for (let i = 0; i < 4; i++) {
        const box = document.createElement('textarea');
        box.className = 'text-box';
        box.id = `text-box-${i+1}`;
        box.contentEditable = "true";
        
        // Get content from notes if available
        if (tab.notes && tab.notes[i]) {
            box.value = tab.notes[i].content || "";
        }
        
        // Apply appearance settings
        if (tab.appearance) {
            // Handle both single color for all boxes and individual colors
            const bgColor = tab.appearance.backgroundColor && tab.appearance.backgroundColor[i] 
            ? tab.appearance.backgroundColor[i] 
            : tab.appearance.backgroundColor || "#ffffff";
            
            const textColor = tab.appearance.textColor && tab.appearance.textColor[i]
            ? tab.appearance.textColor[i]
            : tab.appearance.textColor || "#000000";
            
            box.style.backgroundColor = bgColor;
            box.style.color = textColor;
            box.style.fontFamily = tab.appearance.fontFamily || "'Open Sans', sans-serif";
            box.style.fontSize = tab.appearance.fontSize || "16px";
            }
            
            // Add input event listener to each box
            box.addEventListener('input', () => {
            console.log(`Text input detected in box ${i+1}`);
        
            // Ensure the notes array exists and has enough elements
            if (!tab.notes) {
                tab.notes = [];
            }
        
            if (!tab.notes[i]) {
                tab.notes[i] = {
                    id: `note-${i+1}`,
                    content: "",
                    metadata: { created: new Date().toISOString(), lastModified: new Date().toISOString() }
                };
            }
        
            tab.notes[i].content = box.value;
            tab.notes[i].metadata.lastModified = new Date().toISOString();
        
            window.electronAPI.addOrUpdateTab(tab)
            .catch(err => console.error(`Error saving content for box ${i+1}:`, err));
            });
            
            container.appendChild(box);
        }
        // Update textBox array with references to all four boxes
        textBox = Array.from(container.querySelectorAll('.text-box'));
        }
    // At the end of createTabElement:
    currentTab = tab;
    console.log(`Created tab element with ${textBox.length} text boxes`);
}

function setupEventListeners() {
    const closeBtn = document.getElementById('close-btn');
    const minimizeBtn = document.getElementById('minimize-btn');
    const settingsBtn = document.getElementById('settings-btn');
    const settingsDropdown = document.getElementById('settings-dropdown');
    
    // Window control buttons
    if (closeBtn) {
        closeBtn.addEventListener('click', () => window.electronAPI.closeWindow());
    }
    
    if (minimizeBtn) {
        minimizeBtn.addEventListener('click', () => window.electronAPI.minimizeWindow());
    }
    
    // Ensure all dropdowns start hidden
    if (newTabDropdown) newTabDropdown.classList.add('hidden');
    if (tabsDropdown) tabsDropdown.classList.add('hidden');
    if (settingsDropdown) settingsDropdown.classList.add('hidden');
    
    // Settings dropdown toggle
    if (settingsBtn && settingsDropdown) {
        settingsBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            settingsDropdown.classList.toggle('hidden');
            
            // Close other dropdowns when opening this one
            if (!settingsDropdown.classList.contains('hidden')) {
                if (newTabDropdown) newTabDropdown.classList.add('hidden');
                if (tabsDropdown) tabsDropdown.classList.add('hidden');
            }
        });
    }
    
    // Handle font selection
    const fontDropdown = document.getElementById('font-dropdown');
    const fontOptions = document.querySelectorAll('.font-option');
    
    if (fontOptions) {
        fontOptions.forEach(option => {
            option.addEventListener('click', async (e) => {
                e.stopPropagation();
                const fontFamily = option.dataset.font;
                document.body.style.setProperty('--font-family', fontFamily);
                await window.electronAPI.updateGlobalSettings({ defaultFontFamily: fontFamily });
                
                // Update the selected font display
                const fontButton = document.getElementById('font-button');
                if (fontButton) {
                    fontButton.textContent = option.textContent;
                }
                
                // Hide dropdowns
                if (fontDropdown) fontDropdown.classList.add('hidden');
                if (settingsDropdown) settingsDropdown.classList.add('hidden');
            });
        });
    }
    
    // Handle font size selection
    const fontSizeDropdown = document.getElementById('font-size-dropdown');
    const fontSizeOptions = document.querySelectorAll('.font-size-option');
    
    if (fontSizeOptions) {
        fontSizeOptions.forEach(option => {
            option.addEventListener('click', async (e) => {
                e.stopPropagation();
                const fontSize = option.dataset.size;
                document.body.style.setProperty('--font-size', fontSize);
                // Update all text boxes with the new font size
                document.querySelectorAll('.text-box').forEach(box => {
                    box.style.fontSize = fontSize;
                });
                await window.electronAPI.updateGlobalSettings({ defaultFontSize: fontSize });
                
                // Update the selected size display
                const fontSizeButton = document.getElementById('font-size-button');
                if (fontSizeButton) {
                    fontSizeButton.textContent = option.textContent;
                }
                
                // Hide dropdowns
                if (fontSizeDropdown) fontSizeDropdown.classList.add('hidden');
                if (settingsDropdown) settingsDropdown.classList.add('hidden');
            });
        });
    }
    
    // Handle theme toggle
    const themeToggle = document.getElementById('theme-toggle');
    if (themeToggle) {
        themeToggle.addEventListener('change', async () => {
            const isDark = themeToggle.checked;
            if (isDark) {
                document.body.classList.add('dark-mode');
                document.getElementById('theme-icon').src = 'assets/light-mode.png';
            } else {
                document.body.classList.remove('dark-mode');
                document.getElementById('theme-icon').src = 'assets/dark-mode.png';
            }
        });
    }
    
    // New tab dropdown
    if (newTabBtn && newTabDropdown) {
        newTabBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            newTabDropdown.classList.toggle('hidden');
            
            // Close other dropdowns when opening this one
            if (!newTabDropdown.classList.contains('hidden')) {
                if (tabsDropdown) tabsDropdown.classList.add('hidden');
                if (settingsDropdown) settingsDropdown.classList.add('hidden');
            }
        });
    }
    
    // Tab option buttons
    const newTabOptions = document.querySelectorAll('.new-tab-option');
    if (newTabOptions) {
        newTabOptions.forEach(option => {
            option.addEventListener('click', (e) => {
                e.stopPropagation();
                const layout = option.dataset.layout;
                const tabId = 'tab-' + Date.now();
                const newTab = {
                    id: tabId,
                    layout: layout,
                    name: layout === 'single' ? 'Single Note Pad' : 'Four Square Tab',
                    window: { 
                        x: 100, y: 100, 
                        width: layout === 'four-square' ? 600 : 400, 
                        height: layout === 'four-square' ? 600 : 400, 
                        isMaximized: false 
                    },
                    appearance: {
                        backgroundColor: "#ffffff",
                        textColor: "#000000",
                        fontFamily: "'Open Sans', sans-serif",
                        fontSize: "16px",
                        isDarkMode: document.body.classList.contains('dark-mode')
                    },
                    notes: layout === 'four-square'
                        ? ["", "", "", ""].map((content, i) => ({
                            id: `note-${i+1}`,
                            content: content,
                            metadata: { created: new Date().toISOString(), lastModified: new Date().toISOString() }
                        }))
                        : [{ id: "note-1", content: "", metadata: { created: new Date().toISOString(), lastModified: new Date().toISOString() } }],
                    metadata: { created: new Date().toISOString(), modified: new Date().toISOString() }
                };
                
                window.electronAPI.createNewWindow(newTab)
                    .then(() => window.electronAPI.addOrUpdateTab(newTab))
                    .catch(console.error);
                
                newTabDropdown.classList.add('hidden');
            });
        });
    }
    
    // Tabs dropdown
    if (tabsDropdownBtn && tabsDropdown) {
        tabsDropdownBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            tabsDropdown.classList.toggle('hidden');
            
            // Close other dropdowns when opening this one
            if (!tabsDropdown.classList.contains('hidden')) {
                if (newTabDropdown) newTabDropdown.classList.add('hidden');
                if (settingsDropdown) settingsDropdown.classList.add('hidden');
            }
        });
    }
    
    // Font submenu toggle
    const fontButton = document.getElementById('font-button');
    if (fontButton && fontDropdown) {
        fontButton.addEventListener('click', (e) => {
            e.stopPropagation();
            fontDropdown.classList.toggle('hidden');
            
            // Close other submenus
            if (fontSizeDropdown) fontSizeDropdown.classList.add('hidden');
        });
    }

    
    
    // Font size submenu toggle
    const fontSizeButton = document.getElementById('font-size-button');
    if (fontSizeButton && fontSizeDropdown) {
        fontSizeButton.addEventListener('click', (e) => {
            e.stopPropagation();
            fontSizeDropdown.classList.toggle('hidden');
            
            // Close other submenus
            if (fontDropdown) fontDropdown.classList.add('hidden');
        });
    }
    
    // Global click handler to close all dropdowns
    document.addEventListener('click', (e) => {
        if (!e.target.closest('.dropdown') && 
            !e.target.closest('#new-tab-btn') && 
            !e.target.closest('#tabs-dropdown-btn') && 
            !e.target.closest('#settings-btn') &&
            !e.target.closest('#font-button') &&
            !e.target.closest('#font-size-button')) {
            
            if (newTabDropdown) newTabDropdown.classList.add('hidden');
            if (tabsDropdown) tabsDropdown.classList.add('hidden');
            if (settingsDropdown) settingsDropdown.classList.add('hidden');
            if (fontDropdown) fontDropdown.classList.add('hidden');
            if (fontSizeDropdown) fontSizeDropdown.classList.add('hidden');
        }
    });
}

export default {
  initialize,
  applySettings,
  initTabs,
  createTabElement,
  setupEventListeners
};
