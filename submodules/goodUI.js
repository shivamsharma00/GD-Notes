// goodUI.js
// import Utils from './utils.js'; // Import if you have utility functions

// --- Module State ---
let textBoxElements = []; // Holds references to the current div.text-box elements
let currentTabInstanceData = null; // Holds the data for the tab displayed in this window
let statusBarTimeout = null; // Timeout ID for status bar hiding

// --- DOM Element References ---
let container, closeBtn, minimizeBtn, settingsBtn, settingsDropdown;
let fontButton, fontDropdown, fontSizeButton, fontSizeDropdown, themeToggle, themeIcon;
let colorThemeButton, colorThemeDropdown, colorIntensityButton, colorIntensityDropdown;
let newTabBtn, newTabDropdown, tabsDropdownBtn, tabsDropdown;

// --- Constants ---
const STATUS_BAR_FADE_DELAY = 1500; // milliseconds to wait before fading status bar out

// Color theme definitions
const COLOR_THEMES = {
    default: { 
        light: ['#ffffff', '#f0f0f0', '#e0e0e0', '#d0d0d0'], 
        dark: ['#1e1e1e', '#2e2e2e', '#3e3e3e', '#4e4e4e'] 
    },
    warm: { 
        light: ['#FFF5F5', '#FFE6E6', '#FFCCCC', '#FFB3B3'], 
        dark: ['#331A1A', '#4D1F1F', '#662626', '#803030'] 
    },
    cool: { 
        light: ['#E6F7FF', '#CCF0FF', '#B3E6FF', '#99DBFF'], 
        dark: ['#1A3333', '#1F4D4D', '#266666', '#308080'] 
    },
    nature: { 
        light: ['#E8F5E9', '#C8E6C9', '#A5D6A7', '#81C784'], 
        dark: ['#1B5E20', '#2E7D32', '#388E3C', '#43A047'] 
    },
    sunset: { 
        light: ['#FFF3E0', '#FFE0B2', '#FFCC80', '#FFB74D'], 
        dark: ['#BF360C', '#D84315', '#E64A19', '#F4511E'] 
    },
    blue: { 
        light: ['#E6F7FF', '#CCF0FF', '#B3E6FF', '#99DBFF'], 
        dark: ['#080d14', '#141928', '#1e293c', '#28344c'] 
    },
};

// --- Initialization ---
const initialize = () => {
    // Get references to main static elements
    container = document.getElementById('text-box-container');
    closeBtn = document.getElementById('close-btn');
    minimizeBtn = document.getElementById('minimize-btn');
    
    // Settings elements
    settingsBtn = document.getElementById('settings-btn');
    settingsDropdown = document.getElementById('settings-dropdown');
    fontButton = document.getElementById('font-button');
    fontDropdown = document.getElementById('font-dropdown');
    fontSizeButton = document.getElementById('font-size-button');
    fontSizeDropdown = document.getElementById('font-size-dropdown');
    colorThemeButton = document.getElementById('color-theme-button');
    colorThemeDropdown = document.getElementById('color-theme-dropdown');
    colorIntensityButton = document.getElementById('color-intensity-button');
    colorIntensityDropdown = document.getElementById('color-intensity-dropdown');
    
    // Theme toggle
    themeToggle = document.getElementById('theme-toggle');
    themeIcon = document.getElementById('theme-icon');
    
    // Tab controls
    newTabBtn = document.getElementById('new-tab-btn');
    newTabDropdown = document.getElementById('new-tab-dropdown');
    tabsDropdownBtn = document.getElementById('tabs-dropdown-btn');
    tabsDropdown = document.getElementById('tabs-dropdown');

    if (!container) console.error("UI Initialize: text-box-container not found!");
    // Add checks for other critical elements if needed
};

// --- Settings & Appearance ---

// Apply global settings (theme, base font/size) to the body/root
function applySettings(settings) {
    if (!settings) return;
    console.log("UI: Applying global settings", settings);
    document.documentElement.style.setProperty('--font-family', settings.defaultFontFamily || "'Open Sans', sans-serif");
    document.documentElement.style.setProperty('--font-size', settings.defaultFontSize || "16px");

    applyDarkMode(settings.theme === 'dark'); // Apply dark mode based on global setting
}

// Apply dark mode class and update toggle state/icon
function applyDarkMode(isDark) {
    const bodyClassList = document.body.classList;
    if (isDark) {
        bodyClassList.add('dark-mode');
        if (themeIcon) themeIcon.src = 'assets/light-mode.png';
        if (themeToggle) themeToggle.checked = true;
    } else {
        bodyClassList.remove('dark-mode');
        if (themeIcon) themeIcon.src = 'assets/dark-mode.png';
        if (themeToggle) themeToggle.checked = false;
    }
     // Also update the current tab's data if available
     if (currentTabInstanceData && currentTabInstanceData.appearance) {
        currentTabInstanceData.appearance.isDarkMode = isDark;
        // Save change (debounced save recommended here)
        saveCurrentTabContent(false); // Save without forcing layout change
     }
}

// Apply color theme to the text boxes
function applyColorTheme(themeName, level = 1, isDark = false) {
    if (!COLOR_THEMES[themeName]) {
        console.warn(`Theme '${themeName}' not found, using default`);
        themeName = 'default';
    }
    
    // Use the appropriate theme array based on dark mode
    const colors = isDark ? COLOR_THEMES[themeName].dark : COLOR_THEMES[themeName].light;
    
    // Get the color at the specified level (or default to level 1)
    const colorIndex = Math.min(Math.max(0, level), 3); // Clamp between 0-3
    const bgColor = colors[colorIndex];
    
    // Calculate text color based on background brightness
    // Simple approach: dark text on light backgrounds, light text on dark backgrounds
    const isLightBg = isDark ? false : true;
    const textColor = isLightBg ? '#000000' : '#ffffff';
    
    // Apply to document variables
    document.documentElement.style.setProperty('--text-box-bg', bgColor);
    document.documentElement.style.setProperty('--text-box-color', textColor);
    
    // Apply to each text box directly
    textBoxElements.forEach(box => {
        box.style.backgroundColor = bgColor;
        box.style.color = textColor;
    });
    
    // Update current tab data
    if (currentTabInstanceData && currentTabInstanceData.appearance) {
        currentTabInstanceData.appearance.backgroundColor = bgColor;
        currentTabInstanceData.appearance.textColor = textColor;
        currentTabInstanceData.appearance.colorTheme = themeName;
        currentTabInstanceData.appearance.colorLevel = level;
        
        // Save to storage
        saveCurrentTabContent(false);
    }
    
    // Update UI
    if (colorThemeButton) {
        colorThemeButton.querySelector('.settings-option-value').textContent = themeName.charAt(0).toUpperCase() + themeName.slice(1);
    }
    
    if (colorIntensityButton) {
        colorIntensityButton.querySelector('.settings-option-value').textContent = `Level ${level + 1}`;
    }
    
    // Update active state of intensity buttons
    document.querySelectorAll('.color-level-btn').forEach(btn => {
        btn.classList.toggle('active', parseInt(btn.dataset.level) === level);
    });
}

// Apply tab-specific appearance settings (runs after init-new-tab)
function applyTabAppearance(appearance) {
    if (!appearance) return;
    console.log("UI: Applying tab appearance", appearance);
    
    // Apply dark mode based on tab setting (might override global if different)
    applyDarkMode(appearance.isDarkMode);

    // Apply font family and size to the text boxes for this specific tab
    textBoxElements.forEach(box => {
        if (appearance.fontFamily) box.style.fontFamily = appearance.fontFamily;
        if (appearance.fontSize) box.style.fontSize = appearance.fontSize;
    });
    
    // Apply color theme if it exists
    if (appearance.colorTheme) {
        applyColorTheme(
            appearance.colorTheme,
            appearance.colorLevel !== undefined ? appearance.colorLevel : 1,
            appearance.isDarkMode
        );
    }
    // If no color theme is set, apply background/text color directly
    else if (appearance.backgroundColor) {
        document.documentElement.style.setProperty('--text-box-bg', appearance.backgroundColor);
        document.documentElement.style.setProperty('--text-box-color', appearance.textColor || '#000000');
        
        textBoxElements.forEach(box => {
            box.style.backgroundColor = appearance.backgroundColor;
            box.style.color = appearance.textColor || '#000000';
        });
    }
}

// Update the Settings dropdown button text based on current settings
function updateSettingsUI(globalSettings = {}, tabAppearance = {}) {
    // Font
    if (fontButton) {
        const currentFont = tabAppearance.fontFamily || globalSettings.defaultFontFamily || "'Open Sans', sans-serif";
        // Extract font name (simple version)
        const fontName = currentFont.split(',')[0].replace(/['"]/g, '');
        fontButton.querySelector('.settings-option-value').textContent = fontName;
    }
    
    // Font size
    if (fontSizeButton) {
        const currentSize = tabAppearance.fontSize || globalSettings.defaultFontSize || "16px";
        fontSizeButton.querySelector('.settings-option-value').textContent = currentSize;
    }
    
    // Color theme
    if (colorThemeButton) {
        const theme = tabAppearance.colorTheme || 'default';
        colorThemeButton.querySelector('.settings-option-value').textContent = theme.charAt(0).toUpperCase() + theme.slice(1);
    }
    
    // Color intensity
    if (colorIntensityButton) {
        const level = (tabAppearance.colorLevel !== undefined ? tabAppearance.colorLevel : 1) + 1;
        colorIntensityButton.querySelector('.settings-option-value').textContent = `Level ${level}`;
        
        // Update active state of intensity buttons
        document.querySelectorAll('.color-level-btn').forEach(btn => {
            btn.classList.toggle('active', parseInt(btn.dataset.level) === tabAppearance.colorLevel);
        });
    }
    
    // Theme toggle
    if (themeToggle) {
        const isDark = tabAppearance.isDarkMode ?? (globalSettings.theme === 'dark');
        themeToggle.checked = isDark;
        if (themeIcon) themeIcon.src = isDark ? 'assets/light-mode.png' : 'assets/dark-mode.png';
    }
}


// --- Tab & Content Management ---

// Populate the 'Existing Tabs' dropdown
function initTabs(tabsArray) {
    if (!tabsDropdown) {
        console.warn("UI: Tabs dropdown element not found.");
        return;
    }
    tabsDropdown.innerHTML = ''; // Clear existing entries

    if (!tabsArray || tabsArray.length === 0) {
        tabsDropdown.innerHTML = '<div class="tab-entry no-tabs">No saved notes</div>';
        return;
    }

    tabsArray.forEach(tab => {
        if (!tab || !tab.id) return; // Skip invalid tab data

        const entry = document.createElement('div');
        entry.className = 'tab-entry';
        entry.dataset.tabId = tab.id; // Store ID for reference

        // Tab Name Span (Click to Open)
        const nameSpan = document.createElement('span');
        nameSpan.textContent = tab.name || `Note (${tab.id.substring(0, 6)})`; // Use name or partial ID
        nameSpan.className = 'tab-name';
        nameSpan.title = `Open note: ${nameSpan.textContent}`;
        nameSpan.addEventListener('click', (e) => {
            e.stopPropagation(); // Prevent triggering other clicks
            console.log(`UI: Requesting to open tab window: ${tab.id}`);
            tabsDropdown.classList.add('hidden'); // Hide dropdown
            window.electronAPI.openTabWindow(tab.id)
                .then(result => {
                    if (!result.success) console.error(`UI: Error opening tab ${tab.id}:`, result.error);
                })
                .catch(err => console.error(`UI: IPC Error opening tab ${tab.id}:`, err));
        });

        // Delete Button
        const deleteBtn = document.createElement('button');
        deleteBtn.className = 'delete-tab-btn';
        deleteBtn.title = 'Delete this note';
        const deleteImg = document.createElement('img');
        deleteImg.src = 'assets/delete.png'; // Ensure you have this icon
        deleteImg.alt = 'Delete';
        deleteBtn.appendChild(deleteImg);
        deleteBtn.addEventListener('click', (e) => {
            e.stopPropagation(); // Prevent opening tab
             if (confirm(`Are you sure you want to permanently delete "${nameSpan.textContent}"?`)) {
                 console.log(`UI: Requesting to remove tab: ${tab.id}`);
                 window.electronAPI.removeTab(tab.id)
                     .then(success => {
                         if (success) {
                             entry.remove(); // Remove from dropdown
                             console.log(`UI: Tab ${tab.id} removed from list.`);
                             // If this was the currently open tab, maybe close the window?
                             if (currentTabInstanceData && currentTabInstanceData.id === tab.id) {
                                 window.electronAPI.closeWindow();
                             }
                         } else {
                             console.error(`UI: Failed to remove tab ${tab.id} via IPC.`);
                             alert("Failed to delete the note."); // User feedback
                         }
                     })
                     .catch(err => {
                         console.error(`UI: IPC Error removing tab ${tab.id}:`, err);
                         alert("Error deleting the note."); // User feedback
                     });
             }
        });

        entry.appendChild(nameSpan);
        entry.appendChild(deleteBtn);
        tabsDropdown.appendChild(entry);
    });
}

// Create the editable div elements based on layout
function createTabElement(tabData) {
    if (!container) {
        console.error("UI: Cannot create tab elements, container not found.");
        return;
    }
    if (!tabData) {
         console.error("UI: Cannot create tab elements, no tabData provided.");
         container.innerHTML = "<p>Error: Could not load note data.</p>";
         return;
    }
    console.log(`UI: Creating elements for layout: ${tabData.layout}`);
    container.innerHTML = ''; // Clear previous content
    textBoxElements = []; // Reset the array of text box references
    currentTabInstanceData = tabData; // Store reference to the current tab's data

    const layout = tabData.layout || 'single'; // Default to single
    container.className = `${layout}-layout`; // Apply layout class to container

    const numBoxes = (layout === 'four-square') ? 4 : 1;

    for (let i = 0; i < numBoxes; i++) {
        const box = document.createElement('div');
        box.className = 'text-box';
        box.id = `text-box-${i + 1}`;
        box.contentEditable = "true";
        box.spellcheck = true; // Enable spellcheck

        // Load content - ensure notes array and note object exist
        const noteData = tabData.notes?.[i];
        box.innerHTML = noteData?.content || ""; // Use innerHTML for contentEditable divs

        // Apply appearance (font, size, colors) - Simplified: uses tab's appearance for all boxes
         const appearance = tabData.appearance || {};
         box.style.fontFamily = appearance.fontFamily || 'var(--font-family)'; // Fallback to CSS var
         box.style.fontSize = appearance.fontSize || 'var(--font-size)';       // Fallback to CSS var
         box.style.backgroundColor = appearance.backgroundColor || 'var(--text-box-bg)'; // Fallback
         box.style.color = appearance.textColor || 'var(--text-box-color)';             // Fallback

        // Add input event listener for saving content
        box.addEventListener('input', () => {
            if (!currentTabInstanceData || !currentTabInstanceData.notes) return;

            // Ensure the specific note object exists within the notes array
            if (!currentTabInstanceData.notes[i]) {
                currentTabInstanceData.notes[i] = {
                    id: `note-${i + 1}`,
                    content: "",
                    metadata: { created: new Date().toISOString(), lastModified: new Date().toISOString() }
                };
            }
            // Update content and modification time
            currentTabInstanceData.notes[i].content = box.innerHTML;
            currentTabInstanceData.notes[i].metadata.lastModified = new Date().toISOString();
            currentTabInstanceData.metadata.modified = new Date().toISOString(); // Update tab modified time too

            // Trigger debounced save
            debouncedSave();
        });

        container.appendChild(box);
        textBoxElements.push(box); // Add reference to the array
    }

    console.log(`UI: Created ${textBoxElements.length} text box elements.`);
}

// --- Saving ---

// Function to save the current tab's data
function saveCurrentTabContent() {
     if (!currentTabInstanceData) {
          // console.warn("Save skipped: No current tab data.");
          return;
     }
     // console.log(`UI: Saving content for tab ${currentTabInstanceData.id}`);
     window.electronAPI.addOrUpdateTab(currentTabInstanceData)
         .then(() => { /* console.log("Tab content saved."); */ }) // Optional success log
         .catch(err => console.error(`UI: Error saving tab content for ${currentTabInstanceData.id}:`, err));
}

// Debounce function
function debounce(func, wait) {
    let timeout;
    return function(...args) {
        clearTimeout(timeout);
        timeout = setTimeout(() => func.apply(this, args), wait);
    };
}

// Create a debounced version of the save function
const debouncedSave = debounce(saveCurrentTabContent, 1000); // Save after 1 second of inactivity

// --- Event Listeners Setup ---
function setupEventListeners() {
    console.log("UI: Setting up event listeners.");

    // Window Controls
    if (closeBtn) closeBtn.addEventListener('click', () => window.electronAPI.closeWindow());
    if (minimizeBtn) minimizeBtn.addEventListener('click', () => window.electronAPI.minimizeWindow());

    // --- Dropdown Toggles ---
    function toggleDropdown(button, dropdown, otherDropdowns = []) {
        if (button && dropdown) {
            button.addEventListener('click', (e) => {
                e.stopPropagation();
                const isHidden = dropdown.classList.toggle('hidden');
                // Hide other specified dropdowns when one is opened
                if (!isHidden) {
                    otherDropdowns.forEach(od => od?.classList.add('hidden'));
                }
                // Hide submenus if main dropdown is closed
                if (isHidden) {
                    document.querySelectorAll('.subdropdown').forEach(sub => sub.classList.add('hidden'));
                }
            });
        }
    }

    toggleDropdown(newTabBtn, newTabDropdown, [tabsDropdown, settingsDropdown]);
    toggleDropdown(tabsDropdownBtn, tabsDropdown, [newTabDropdown, settingsDropdown]);
    toggleDropdown(settingsBtn, settingsDropdown, [newTabDropdown, tabsDropdown]);

    // --- Settings Sub-menu Handling ---
    
    // Setup all settings options to show their respective subdropdowns
    document.querySelectorAll('.settings-option[data-submenu]').forEach(option => {
        const submenuId = option.dataset.submenu;
        const submenu = document.getElementById(submenuId);
        
        if (!submenu) {
            console.error(`Submenu ${submenuId} not found for option:`, option);
            return;
        }
        
        option.addEventListener('click', (e) => {
            e.stopPropagation();
            
            // Hide all other subdropdowns first
            document.querySelectorAll('.subdropdown').forEach(dropdown => {
                if (dropdown.id !== submenuId) {
                    dropdown.classList.add('hidden');
                }
            });
            
            // Toggle this subdropdown
            submenu.classList.toggle('hidden');
            
            // Position the submenu properly
            if (!submenu.classList.contains('hidden')) {
                positionSubmenu(option, submenu);
            }
        });
    });
    
    // Function to position submenus relative to their parent option
    function positionSubmenu(parentOption, submenu) {
        if (!parentOption || !submenu) return;
        
        const parentRect = parentOption.getBoundingClientRect();
        
        // Position to the left of the parent
        submenu.style.left = '-180px'; // Distance from parent
        
        // Vertical position - align with the parent
        submenu.style.top = '0';
        
        // Ensure submenu is visible within window
        const submenuRect = submenu.getBoundingClientRect();
        const windowHeight = window.innerHeight;
        
        // If submenu would go below window bottom, adjust position
        if (submenuRect.bottom > windowHeight) {
            const adjustment = submenuRect.bottom - windowHeight + 10; // 10px buffer
            submenu.style.top = `-${adjustment}px`;
        }
        
        // For horizontal position, ensure it doesn't go off-screen left
        if (submenuRect.left < 0) {
            submenu.style.left = `${parseInt(submenu.style.left) - submenuRect.left + 10}px`;
        }
    }

    // --- New Tab Options ---
    document.querySelectorAll('.new-tab-option').forEach(option => {
        option.addEventListener('click', (e) => {
            e.stopPropagation();
            const layout = option.dataset.layout;
            console.log(`UI: Requesting new tab with layout: ${layout}`);
            newTabDropdown.classList.add('hidden'); // Hide dropdown
            
            // Generate a random theme for new windows
            const themes = Object.keys(COLOR_THEMES);
            const randomTheme = themes[Math.floor(Math.random() * themes.length)];
            const currentColorLevel = currentTabInstanceData?.appearance?.colorLevel || 1;
            
            window.electronAPI.createNewTabWindow({ 
                layout: layout,
                colorTheme: randomTheme,
                colorLevel: currentColorLevel // Keep same level but change color
            })
            .then(result => {
                if (result.success) {
                    console.log(`UI: New tab window initiated: ${result.tabId}`);
                    // Optionally, refresh the tabs list dropdown after a short delay
                    setTimeout(async () => {
                        const allTabs = await window.electronAPI.getAllTabs();
                        initTabs(allTabs);
                    }, 500);
                } else {
                    console.error("UI: Failed to create new tab window:", result.error);
                    alert("Error creating new note.");
                }
            })
            .catch(err => {
                console.error("UI: IPC Error creating new tab window:", err);
                alert("Error creating new note.");
            });
        });
    });

    // --- Settings Options ---

    // Font Selection
    document.querySelectorAll('.font-option').forEach(option => {
        option.addEventListener('click', async (e) => {
            e.stopPropagation();
            const fontFamily = option.dataset.font;
            const fontName = option.textContent;
            console.log(`UI: Setting font to: ${fontFamily}`);

            // Apply visually immediately to current text boxes
            textBoxElements.forEach(box => box.style.fontFamily = fontFamily);
            
            // Apply to body/root variable for future elements
            document.documentElement.style.setProperty('--font-family', fontFamily);

            // Update current tab's appearance data
            if (currentTabInstanceData?.appearance) {
                currentTabInstanceData.appearance.fontFamily = fontFamily;
                saveCurrentTabContent(); // Save the change
            }
            
            // Update global default setting
            await window.electronAPI.updateGlobalSettings({ defaultFontFamily: fontFamily });

            // Update button text & hide dropdowns
            if (fontButton) {
                fontButton.querySelector('.settings-option-value').textContent = fontName;
            }
            fontDropdown?.classList.add('hidden');
        });
    });

    // Font Size Selection
    document.querySelectorAll('.font-size-option').forEach(option => {
        option.addEventListener('click', async (e) => {
            e.stopPropagation();
            const fontSize = option.dataset.size;
            console.log(`UI: Setting font size to: ${fontSize}`);

            // Apply visually immediately
            textBoxElements.forEach(box => box.style.fontSize = fontSize);
            
            // Apply to body/root variable for future elements
            document.documentElement.style.setProperty('--font-size', fontSize);

            // Update current tab's appearance data
            if (currentTabInstanceData?.appearance) {
                currentTabInstanceData.appearance.fontSize = fontSize;
                saveCurrentTabContent(); // Save the change
            }
            
            // Update global default setting
            await window.electronAPI.updateGlobalSettings({ defaultFontSize: fontSize });

            // Update button text & hide dropdowns
            if (fontSizeButton) {
                fontSizeButton.querySelector('.settings-option-value').textContent = fontSize;
            }
            fontSizeDropdown?.classList.add('hidden');
        });
    });

    // Color Theme Selection
    document.querySelectorAll('.color-theme-option').forEach(option => {
        option.addEventListener('click', (e) => {
            e.stopPropagation();
            const theme = option.dataset.theme;
            console.log(`UI: Setting color theme to: ${theme}`);
            
            // Get current level or default to 1
            const currentLevel = currentTabInstanceData?.appearance?.colorLevel !== undefined 
                ? currentTabInstanceData.appearance.colorLevel 
                : 1;
                
            // Get current dark mode state
            const isDark = document.body.classList.contains('dark-mode');
            
            // Apply the theme with current level
            applyColorTheme(theme, currentLevel, isDark);
            
            // Hide dropdown
            colorThemeDropdown?.classList.add('hidden');
        });
    });
    
    // Color Intensity Selection
    document.querySelectorAll('.color-level-btn').forEach(button => {
        button.addEventListener('click', (e) => {
            e.stopPropagation();
            const level = parseInt(button.dataset.level);
            console.log(`UI: Setting color intensity level to: ${level + 1}`);
            
            // Get current theme or default to 'default'
            const currentTheme = currentTabInstanceData?.appearance?.colorTheme || 'default';
            
            // Get current dark mode state
            const isDark = document.body.classList.contains('dark-mode');
            
            // Apply the theme with new level
            applyColorTheme(currentTheme, level, isDark);
            
            // Update active state on buttons
            document.querySelectorAll('.color-level-btn').forEach(btn => {
                btn.classList.toggle('active', parseInt(btn.dataset.level) === level);
            });
            
            // Don't hide dropdown to allow multiple level adjustments
        });
    });

    // Theme Toggle
    if (themeToggle) {
        themeToggle.addEventListener('change', async () => {
            const isDark = themeToggle.checked;
            console.log(`UI: Toggling theme. Is dark: ${isDark}`);
            applyDarkMode(isDark); // Applies class, updates icon, saves to current tab
            
            // If there's a color theme set, reapply it with the new dark/light mode
            if (currentTabInstanceData?.appearance?.colorTheme) {
                applyColorTheme(
                    currentTabInstanceData.appearance.colorTheme,
                    currentTabInstanceData.appearance.colorLevel !== undefined ? currentTabInstanceData.appearance.colorLevel : 1,
                    isDark
                );
            }

            // Update global setting
            await window.electronAPI.updateGlobalSettings({ theme: isDark ? 'dark' : 'light' });
        });
    }

    // --- Global Click Listener to Close Dropdowns ---
    document.addEventListener('click', (e) => {
        // If the click is not inside a dropdown or a button that opens one...
        if (!e.target.closest('.dropdown, .subdropdown, #new-tab-btn, #tabs-dropdown-btn, #settings-btn, .settings-option[data-submenu]')) {
            // ...close all dropdowns and submenus
            document.querySelectorAll('.dropdown, .subdropdown').forEach(dropdown => {
                dropdown.classList.add('hidden');
            });
        }
    });

    // Debug logging to help troubleshoot
    console.log("UI Event Listeners Attached:");
    console.log("- Font dropdown:", fontDropdown ? "Found" : "Not found");
    console.log("- Font size dropdown:", fontSizeDropdown ? "Found" : "Not found");
    console.log("- Color theme dropdown:", colorThemeDropdown ? "Found" : "Not found");
    console.log("- Color intensity dropdown:", colorIntensityDropdown ? "Found" : "Not found");
    console.log("- Font options:", document.querySelectorAll('.font-option').length);
    console.log("- Font size options:", document.querySelectorAll('.font-size-option').length);
    console.log("- Settings options with submenus:", document.querySelectorAll('.settings-option[data-submenu]').length);

    console.log("UI: Event listeners setup complete.");
}

// --- Status Bar Hover Logic ---
function setupStatusBarHover() {
    const statusBar = document.getElementById('status-bar');
    const body = document.body;
    
    if (!statusBar) return;

    // We'll use CSS for the hover effect, but we need to add the detection zone
    // Make the entire bottom edge of the window a hover detection area
    const setupHoverZone = () => {
        body.addEventListener('mousemove', (e) => {
            // If mouse is near the bottom of the window, show the status bar
            const bottomThreshold = 20; // px from bottom
            if (window.innerHeight - e.clientY < bottomThreshold) {
                body.classList.add('show-status-bar');
                clearTimeout(statusBarTimeout);
            } else if (e.target !== statusBar && !statusBar.contains(e.target)) {
                // If mouse moves away from the bottom and not over the status bar, hide after delay
                clearTimeout(statusBarTimeout);
                statusBarTimeout = setTimeout(() => {
                    body.classList.remove('show-status-bar');
                }, STATUS_BAR_FADE_DELAY);
            }
        });
        
        // Keep visible while mouse is over the status bar
        statusBar.addEventListener('mouseenter', () => {
            clearTimeout(statusBarTimeout);
            body.classList.add('show-status-bar');
        });
        
        // Start timer to hide when mouse leaves the status bar
        statusBar.addEventListener('mouseleave', () => {
            clearTimeout(statusBarTimeout);
            statusBarTimeout = setTimeout(() => {
                body.classList.remove('show-status-bar');
            }, STATUS_BAR_FADE_DELAY);
        });
    };
    
    setupHoverZone();
}


// --- Exports ---
export default {
    initialize,
    applySettings,
    applyTabAppearance,
    updateSettingsUI,
    initTabs,
    createTabElement,
    setupEventListeners,
    setupStatusBarHover
};