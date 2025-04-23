// goodUI.js

import {
    initContentStyles,
    debounce,
    getFirstWords,
    getContrastColor,
    isInsideEditable,
    getAncestorByTagName,
    getAncestorWithClass
} from './utils.js';

// Import default export and named exports from formatting.js
import formatting, { markContentChanged } from './formatting.js';

// Destructure needed functions from formatting.js default export
const {
    applySettings,
    applyDarkMode,
    applyColorTheme,
    applyTabAppearance,
    updateSettingsUI,
    setupContentEditableListeners,
    startAutoSave,
    showFormattingToolbar,
    hideFormattingToolbar,
    setupFormattingToolbarListeners,
    saveCurrentTabContent,
    debouncedSave,
    createChecklistItem
} = formatting;

// --- Module State ---
let currentTabInstanceData = null; // Holds the data for the tab displayed in this window
let contentEditableElements = []; // Holds references to the current div.note-content-area elements
let titleNodeMap = new WeakMap(); // Map editor elements to their current title nodes
let saveIndicatorTimeout = null; // Timeout ID for save indicator hiding

// --- DOM Element References ---
let editorContainer, formattingToolbar, closeBtn, minimizeBtn, settingsBtn, settingsDropdown;
let fontButton, fontDropdown, fontSizeButton, fontSizeDropdown, themeToggle, themeIcon;
let colorThemeButton, colorThemeDropdown, colorIntensityButton, colorIntensityDropdown;
let newTabBtn, newTabDropdown, tabsDropdownBtn, tabsDropdown;
let helpBtn, helpPopup, saveIndicator;
let slashCommandPopup; // Assuming you have this element

// --- UI Specific Functions ---

// Helper to update a specific tab name in the dropdown
function updateTabsDropdownName(tabId, newName) {
    if (tabsDropdown) {
        const entry = tabsDropdown.querySelector(`.tab-entry[data-tab-id="${tabId}"] .tab-name`);
        if (entry) {
            entry.textContent = newName;
            entry.title = `Open note: ${newName}`;
        }
    }
}

// Helper to remove a tab entry from the dropdown
function removeTabFromDropdown(tabId) {
    if (!tabsDropdown) return;
    const entry = tabsDropdown.querySelector(`.tab-entry[data-tab-id="${tabId}"]`);
    if (entry) {
        entry.remove();
        if (tabsDropdown.children.length === 0) {
            tabsDropdown.innerHTML = '<div class="tab-entry no-tabs">No saved notes</div>';
        }
    }
}

// Show save indicator UI
function showSaveIndicatorUI() {
    if (!saveIndicator) return;
    clearTimeout(saveIndicatorTimeout);
    saveIndicator.classList.add('visible');
    // Use duration from utils if needed, or keep fixed
    saveIndicatorTimeout = setTimeout(() => {
        saveIndicator.classList.remove('visible');
    }, 800); // Example: SAVE_INDICATOR_DURATION_MS
}

// Hide slash command popup UI
function hideSlashCommandPopup() {
    if (slashCommandPopup && !slashCommandPopup.classList.contains('hidden')) {
        slashCommandPopup.classList.add('hidden');
        // Reset any state related to the slash command popup
    }
}

// --- Initialization ---
const initialize = async () => { // Make async for settings
    editorContainer = document.getElementById('editor-container'); 
    formattingToolbar = document.getElementById('formatting-toolbar');
    closeBtn = document.getElementById('close-btn');
    minimizeBtn = document.getElementById('minimize-btn');
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
    themeToggle = document.getElementById('theme-toggle');
    themeIcon = document.getElementById('theme-icon');
    newTabBtn = document.getElementById('new-tab-btn');
    newTabDropdown = document.getElementById('new-tab-dropdown');
    tabsDropdownBtn = document.getElementById('tabs-dropdown-btn');
    tabsDropdown = document.getElementById('tabs-dropdown');
    helpBtn = document.getElementById('help-btn');
    helpPopup = document.getElementById('help-popup');
    saveIndicator = document.getElementById('save-indicator');
    slashCommandPopup = document.getElementById('slash-command-popup'); // Get slash command popup

    if (!editorContainer || !formattingToolbar ) {
        console.error('Missing required elements for UI initialization.');
        return;
    }

    // Initialize all dropdowns with correct styling
    const allDropdowns = document.querySelectorAll('.dropdown, .subdropdown');
    allDropdowns.forEach(dropdown => {
        // Ensure proper default styling
        dropdown.style.display = 'none';
        dropdown.classList.add('hidden');
    });

    // Initialize settings - Needs to be async
    try {
        const settings = await window.electronAPI.getGlobalSettings();
        // Pass relevant DOM elements needed by applySettings/applyDarkMode
        applySettings(settings, document.body, themeToggle, themeIcon);
        // Initial UI update based on settings
        updateSettingsUI(settings, {}, fontButton, fontSizeButton, colorThemeButton, colorIntensityButton);
        
        // Re-apply theme-specific styles to dropdowns after settings are applied
        forceDropdownStyling(document.body.classList.contains('dark-mode'));
    } catch (err) {
        console.error("Failed to initialize global settings:", err);
        // Apply default fallbacks? Or show error?
        applySettings({}, document.body, themeToggle, themeIcon); // Apply defaults
        updateSettingsUI({}, {}, fontButton, fontSizeButton, colorThemeButton, colorIntensityButton);
        
        // Apply default light theme styling to dropdowns
        forceDropdownStyling(false);
    }

    // Add listener for save indicator triggered from main process/formatting.js
    window.electronAPI.onShowSaveIndicator(showSaveIndicatorUI);

    setupEventListeners(); // Setup listeners after elements are found
};

// Helper function to force dropdown styling based on dark/light mode
function forceDropdownStyling(isDarkMode) {
    const allDropdowns = document.querySelectorAll('.dropdown, .subdropdown');
    
    allDropdowns.forEach(dropdown => {
        if (isDarkMode) {
            // Dark mode styling
            dropdown.style.backgroundColor = '#2e2e2e';
            dropdown.style.color = '#ffffff';
            dropdown.style.borderColor = '#3e3e3e';
        } else {
            // Light mode styling  
            dropdown.style.backgroundColor = '#ffffff';
            dropdown.style.color = '#000000';
            dropdown.style.borderColor = '#d0d7de';
        }
        
        // Do NOT apply font settings to dropdown
        // The dropdowns should always use Fira Code as set in CSS
    });
    console.log(`Applied ${isDarkMode ? 'dark' : 'light'} mode styling to dropdowns`);
}

// Populate the 'Existing Tabs' dropdown
async function initTabs(tabsArray) {
    if (!tabsDropdown) return;
    
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

        const nameSpan = document.createElement('span');
        nameSpan.textContent = tab.name || `Note (${tab.id.substring(0, 6)})`;
        nameSpan.className = 'tab-name';
        nameSpan.title = `Open note: ${nameSpan.textContent}`;
        nameSpan.addEventListener('click', (e) => {
            e.stopPropagation();
            tabsDropdown.classList.add('hidden');
            window.electronAPI.openTabWindow(tab.id)
                .catch(err => console.error(`UI: IPC Error opening tab ${tab.id}:`, err));
        });

        const deleteBtn = document.createElement('button');
        deleteBtn.className = 'delete-tab-btn';
        deleteBtn.title = 'Delete this note';
        const deleteImg = document.createElement('img');
        deleteImg.src = 'assets/delete.png';
        deleteImg.alt = 'Delete';
        deleteBtn.appendChild(deleteImg);
        deleteBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            if (confirm(`Are you sure you want to permanently delete "${nameSpan.textContent}"?`)) {
                window.electronAPI.removeTab(tab.id)
                    .then(success => {
                        if (success) {
                            removeTabFromDropdown(tab.id); // Use local UI function
                            if (currentTabInstanceData && currentTabInstanceData.id === tab.id) {
                                window.electronAPI.closeWindow();
                            }
                        } else {
                             alert("Failed to delete the note.");
                        }
                    })
                    .catch(err => {
                         alert("Error deleting the note.");
                         console.error("Error deleting tab:", err);
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
    if (!editorContainer) {
        console.error("Editor container not found in createTabElement");
        return;
    }
    if (!tabData) {
        editorContainer.innerHTML = "<p>Error: Could not load note data.</p>";
        return;
    }

    editorContainer.innerHTML = ''; // Clear previous content
    contentEditableElements = []; // Reset the array
    currentTabInstanceData = tabData; // Store reference
    currentTabInstanceData.hasChanged = false; // Initialize change flag
    titleNodeMap = new WeakMap(); // Reset title map for the new tab

    const layout = tabData.layout || 'single';
    editorContainer.className = `${layout}-layout`;
    document.body.classList.toggle('four-square-mode', layout === 'four-square');

    const numBoxes = (layout === 'four-square') ? 4 : 1;

    // FIRST: Create elements and populate the array
    for (let i = 0; i < numBoxes; i++) {
        const box = document.createElement('div');
        box.className = 'note-content-area';
        box.id = `note-content-area-${i + 1}`;
        box.contentEditable = "true";
        box.spellcheck = true;
        const noteData = tabData.notes?.[i];
        box.innerHTML = noteData?.content || '<br>';
        editorContainer.appendChild(box);
        contentEditableElements.push(box); // Populate the array fully
    }

    // SECOND: Create the context object, now that contentEditableElements is populated
    const formattingContext = {
        get currentTabData() { return currentTabInstanceData; },
        get titleNodeMap() { return titleNodeMap; },
        get hasContentChangedSinceLoad() { return currentTabInstanceData?.hasChanged ?? false; },
        get saveHandler() { return () => debouncedSave(formattingContext); }, // Pass this specific context
        contentEditableElements: contentEditableElements, // Array is now populated
        formattingToolbar: formattingToolbar,
        saveIndicator: saveIndicator,
        slashCommandPopup: slashCommandPopup
    };

    // THIRD: Initialize styles and setup listeners, passing the created context
    contentEditableElements.forEach((box, i) => {
        initContentStyles(box); // Initialize styles from utils
        setupContentEditableListeners(box, i, formattingContext); // Setup listeners from formatting.js
    });

    // Apply appearance settings from formatting.js, passing elements
    applyTabAppearance(
        currentTabInstanceData.appearance,
        contentEditableElements,
        document.body,
        themeToggle,
        themeIcon
    );

    // Update settings UI display
    window.electronAPI.getGlobalSettings().then(settings => {
         updateSettingsUI(
             settings,
             currentTabInstanceData.appearance,
             fontButton, fontSizeButton, colorThemeButton, colorIntensityButton
         );
    });

    // Start auto-save using the function from formatting.js, passing context
    startAutoSave(formattingContext);
}

function setupEventListeners() {
    if (!closeBtn || !minimizeBtn || !settingsBtn || !newTabBtn || !tabsDropdownBtn || !helpBtn || !formattingToolbar) {
        console.warn("Missing one or more essential UI elements for event listeners.");
        // Potentially return or handle gracefully
    }

    // --- Create Context Object (if needed outside createTabElement) ---
    // If event listeners need to call formatting functions directly,
    // they might need access to the context. For now, assume most calls
    // trigger changes that lead to input/blur handlers which use the context.
     const getFormattingContext = () => ({
        get currentTabData() { return currentTabInstanceData; },
        get titleNodeMap() { return titleNodeMap; },
        get hasContentChangedSinceLoad() { return currentTabInstanceData?.hasChanged ?? false; },
        get saveHandler() { return () => debouncedSave(getFormattingContext()); }, // Recreate context on call
        contentEditableElements: contentEditableElements,
        formattingToolbar: formattingToolbar,
        saveIndicator: saveIndicator,
        slashCommandPopup: slashCommandPopup
    });

    // Window Controls
    if (closeBtn) closeBtn.addEventListener('click', () => window.electronAPI.closeWindow());
    if (minimizeBtn) minimizeBtn.addEventListener('click', () => window.electronAPI.minimizeWindow());

    // --- Dropdown Toggles ---
    const allDropdowns = [newTabDropdown, tabsDropdown, settingsDropdown, fontDropdown, fontSizeDropdown, colorThemeDropdown, colorIntensityDropdown].filter(el => el);
    const allSubDropdowns = document.querySelectorAll('.subdropdown');

    function closeAllPopups() {
        allDropdowns.forEach(d => d?.classList.add('hidden'));
        allSubDropdowns.forEach(sd => sd.classList.add('hidden'));
        document.querySelectorAll('.settings-option.active').forEach(opt => opt.classList.remove('active'));
        if (helpPopup) helpPopup.classList.add('hidden');
        if (formattingToolbar) hideFormattingToolbar(formattingToolbar); // Use imported function
        hideSlashCommandPopup(); // Use local UI function
    }

    function toggleDropdown(button, dropdown, otherDropdowns = []) {
        if (button && dropdown) {
            button.addEventListener('click', (e) => {
                e.stopPropagation();
                closeAllPopups(); // Close other popups first
                const isHidden = dropdown.classList.toggle('hidden');
                // Hide other specified dropdowns when one is opened
                if (!isHidden) {
                    otherDropdowns.forEach(od => od?.classList.add('hidden'));
                    
                    // Force dropdown styling when opening
                    const isDarkMode = document.body.classList.contains('dark-mode');
                    if (isDarkMode) {
                        dropdown.style.backgroundColor = '#2e2e2e';
                        dropdown.style.color = '#ffffff';
                        dropdown.style.borderColor = '#3e3e3e';
                    } else {
                        dropdown.style.backgroundColor = '#ffffff';
                        dropdown.style.color = '#000000';
                        dropdown.style.borderColor = '#d0d7de';
                    }
                    dropdown.style.display = 'block';
                    dropdown.style.visibility = 'visible';
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
    toggleDropdown(helpBtn, helpPopup, [ newTabDropdown, tabsDropdown, settingsDropdown ]);
    // --- Settings Sub-menu Handling ---
    document.querySelectorAll('.settings-option[data-submenu]').forEach(option => {
        const submenuId = option.dataset.submenu;
        const submenu = document.getElementById(submenuId);
        if (!submenu) return;

        option.addEventListener('click', (e) => {
            e.stopPropagation();
            e.preventDefault();
            const isActive = option.classList.contains('active');

            // Hide all other submenus first
            document.querySelectorAll('.subdropdown').forEach(sd => { 
                if (sd.id !== submenuId) {
                    sd.classList.add('hidden');
                    sd.style.visibility = 'hidden';
                    sd.style.display = 'none';
                }
            });

            // Hide other active options
            document.querySelectorAll('.settings-option.active').forEach(opt => { 
                if(opt !== option) opt.classList.remove('active');
            });

            // Toggle this submenu
            if (isActive) {
                submenu.classList.add('hidden');
                submenu.style.visibility = 'hidden';
                submenu.style.display = 'none';
                option.classList.remove('active');
            } else {
                submenu.classList.remove('hidden');
                submenu.style.visibility = 'visible';
                submenu.style.display = 'block';
                option.classList.add('active');
                
                // Force the right theme colors
                const isDarkMode = document.body.classList.contains('dark-mode');
                if (isDarkMode) {
                    submenu.style.backgroundColor = '#2e2e2e';
                    submenu.style.color = '#ffffff';
                    submenu.style.borderColor = '#3e3e3e';
                } else {
                    submenu.style.backgroundColor = '#ffffff';
                    submenu.style.color = '#000000';
                    submenu.style.borderColor = '#d0d7de';
                }
                
                // Position the submenu correctly
                positionSubmenuDirectly(option, submenu);
            }
        });
    });

    // New direct positioning function for submenus that doesn't rely on calculations
    function positionSubmenuDirectly(parentOption, submenu) {
        if (!parentOption || !submenu) return;
        
        // Get the main settings dropdown
        const settingsDropdown = document.getElementById('settings-dropdown');
        if (!settingsDropdown) return;
        
        const parentRect = parentOption.getBoundingClientRect();
        const settingsRect = settingsDropdown.getBoundingClientRect();
        
        // Make submenu visible to get its dimensions
        submenu.style.visibility = 'visible';
        submenu.style.display = 'block';
        
        // Force a repaint
        window.getComputedStyle(submenu).opacity;
        
        const submenuRect = submenu.getBoundingClientRect();
        
        // Position to the left of settings dropdown
        const left = settingsRect.left - submenuRect.width - 10;
        
        // Position aligned with the parent option
        const top = parentRect.top;
        
        // Apply position
        submenu.style.top = `${top}px`;
        submenu.style.left = `${left}px`;
        
        // Log for debugging
        console.log(`Positioned ${submenu.id}: left=${left}, top=${top}`);
    }

    // --- New Tab Options ---
    document.querySelectorAll('.new-tab-option').forEach(option => {
        option.addEventListener('click', (e) => {
            e.stopPropagation();
            e.preventDefault(); // Prevent default to ensure no double-clicks
            const layout = option.dataset.layout;

            // Ensure dropdown is fully hidden before proceeding
            if (newTabDropdown) {
                newTabDropdown.classList.add('hidden');
                newTabDropdown.style.display = 'none';
                newTabDropdown.style.visibility = 'hidden';
            }

            const newTabOptions = {
                layout: layout,
                isDarkMode: document.body.classList.contains('dark-mode')
            };

            // Add a small delay before making the API call to ensure UI updates first
            setTimeout(() => {
                window.electronAPI.createNewTabWindow(newTabOptions)
                    .then(result => {
                        if (result.success) {
                            setTimeout(async () => {
                                try {
                                    const allTabs = await window.electronAPI.getAllTabs();
                                    initTabs(allTabs);
                                } catch (err) { console.error("Failed to refresh tabs list:", err); }
                            }, 300);
                        } else {
                            alert("Error creating new note.");
                        }
                    })
                    .catch(err => {
                        console.error("UI: IPC Error creating new tab window:", err);
                        alert("Error creating new note.");
                    });
            }, 50);
        });
    });

    // --- Settings Options Actions ---
    // Font Selection
    document.querySelectorAll('.font-option').forEach(option => {
        option.addEventListener('click', async (e) => {
            e.stopPropagation();
            const fontFamily = option.dataset.font;
            const fontName = option.textContent;
            console.log(`Font selected: ${fontName} (${fontFamily})`);

            // Apply font immediately to all relevant elements
            
            // 1. Set CSS variable at document level
            document.documentElement.style.setProperty('--font-family', fontFamily);
            console.log("Applied font to document root");
            
            // 2. Apply directly and forcefully to all note content areas
            const contentAreas = document.querySelectorAll('.note-content-area');
            console.log(`Found ${contentAreas.length} content areas to update`);
            
            contentAreas.forEach((box, index) => {
                // Direct inline style with !important via style property
                box.style.setProperty('font-family', fontFamily, 'important');
                
                // Also set the regular style property as backup
                box.style.fontFamily = fontFamily;
                
                // Apply to all children as well to ensure immediate refresh
                Array.from(box.children).forEach(child => {
                    if (!child.classList.contains('format-title') && 
                        !child.classList.contains('format-subtitle') && 
                        !child.classList.contains('format-bold-large')) {
                        child.style.setProperty('font-family', 'inherit', 'important');
                    }
                });
                
                console.log(`Updated content area ${index + 1}`);
            });

            // 3. Force a repaint to ensure visual update
            document.body.style.display = 'none';
            document.body.offsetHeight; // Trigger reflow
            document.body.style.display = '';

            // Update tab data
            if (currentTabInstanceData?.appearance) {
                currentTabInstanceData.appearance.fontFamily = fontFamily;
                markContentChanged(currentTabInstanceData);
                // Save immediately after settings change
                saveCurrentTabContent(currentTabInstanceData, titleNodeMap, true);
                console.log("Updated tab data with new font");
            }
            
            try {
                 await window.electronAPI.updateGlobalSettings({ defaultFontFamily: fontFamily });
                 console.log("Updated global settings with new font");
                 // Update UI immediately
                 updateSettingsUI(await window.electronAPI.getGlobalSettings(), currentTabInstanceData?.appearance, fontButton, fontSizeButton, colorThemeButton, colorIntensityButton);
            } catch (err) { console.error("Failed to update global font setting:", err); }

            fontDropdown?.classList.add('hidden');
            option.closest('.settings-option')?.classList.remove('active');
        });
    });

    // Font Size Selection
    document.querySelectorAll('.font-size-option').forEach(option => {
        option.addEventListener('click', async (e) => {
            e.stopPropagation();
            const fontSize = option.dataset.size;
            console.log(`Font size selected: ${fontSize}`);

            // Apply font size immediately to all relevant elements
            
            // 1. Set CSS variable at document level
            document.documentElement.style.setProperty('--font-size', fontSize);
            console.log("Applied font size to document root");
            
            // 2. Apply directly and forcefully to all note content areas
            const contentAreas = document.querySelectorAll('.note-content-area');
            console.log(`Found ${contentAreas.length} content areas to update size`);
            
            contentAreas.forEach((box, index) => {
                // Direct inline style with !important via style property
                box.style.setProperty('font-size', fontSize, 'important');
                
                // Also set the regular style property as backup
                box.style.fontSize = fontSize;
                
                // Apply to all children as well to ensure immediate refresh
                Array.from(box.children).forEach(child => {
                    if (!child.classList.contains('format-title') && 
                        !child.classList.contains('format-subtitle') && 
                        !child.classList.contains('format-bold-large')) {
                        child.style.setProperty('font-size', 'inherit', 'important');
                    }
                });
                
                console.log(`Updated content area ${index + 1} size`);
            });

            // 3. Force a repaint to ensure visual update
            document.body.style.display = 'none';
            document.body.offsetHeight; // Trigger reflow
            document.body.style.display = '';

            // Update tab data
            if (currentTabInstanceData?.appearance) {
                currentTabInstanceData.appearance.fontSize = fontSize;
                markContentChanged(currentTabInstanceData);
                saveCurrentTabContent(currentTabInstanceData, titleNodeMap, true); // Save immediately
                console.log("Updated tab data with new font size");
            }
            
            try {
                 await window.electronAPI.updateGlobalSettings({ defaultFontSize: fontSize });
                 console.log("Updated global settings with new font size");
                 updateSettingsUI(await window.electronAPI.getGlobalSettings(), currentTabInstanceData?.appearance, fontButton, fontSizeButton, colorThemeButton, colorIntensityButton);
            } catch (err) { console.error("Failed to update global font size setting:", err); }

            fontSizeDropdown?.classList.add('hidden');
            option.closest('.settings-option')?.classList.remove('active');
        });
    });

     // Color Theme Selection
     document.querySelectorAll('.color-theme-option').forEach(option => {
         option.addEventListener('click', (e) => {
             e.stopPropagation();
             const theme = option.dataset.theme;
             const currentLevel = currentTabInstanceData?.appearance?.colorLevel !== undefined
                 ? currentTabInstanceData.appearance.colorLevel : 1;
             const isDark = document.body.classList.contains('dark-mode');

             // Call formatting function, passing necessary elements/state
             applyColorTheme(
                 theme, currentLevel, isDark,
                 currentTabInstanceData, // Pass tab data
                 contentEditableElements, // Pass elements
                 colorThemeButton, // Pass UI elements for update
                 colorIntensityButton,
                 true // Save changes
             );
             // Saving and marking changed is handled within applyColorTheme
             // Need to ensure saveCurrentTabContent is called after markContentChanged in applyColorTheme

             colorThemeDropdown?.classList.add('hidden');
             option.closest('.settings-option')?.classList.remove('active');
         });
     });

      // Color Intensity Selection
     document.querySelectorAll('.color-level-btn').forEach(button => {
         button.addEventListener('click', (e) => {
             e.stopPropagation();
             const level = parseInt(button.dataset.level);
             const currentTheme = currentTabInstanceData?.appearance?.colorTheme || 'default';
             const isDark = document.body.classList.contains('dark-mode');

             // Call formatting function
             applyColorTheme(
                 currentTheme, level, isDark,
                 currentTabInstanceData,
                 contentEditableElements,
                 colorThemeButton,
                 colorIntensityButton,
                 true // Save changes
             );
             // Don't hide dropdown immediately
         });
     });


    // Theme Toggle
    if (themeToggle) {
        themeToggle.addEventListener('change', async () => {
            const isDark = themeToggle.checked;
            // Call formatting function, passing elements and state
            applyDarkMode(
                isDark,
                document.body,
                themeToggle,
                themeIcon,
                currentTabInstanceData, // Pass tab data to update appearance
                applyColorTheme, // Pass the function to re-apply theme
                true // Save changes
            );
             // Saving is handled within applyDarkMode/applyColorTheme
            try {
                await window.electronAPI.updateGlobalSettings({ theme: isDark ? 'dark' : 'light' });
                // Update dropdown styling
                forceDropdownStyling(isDark);
            } catch (err) { console.error("Failed to update global theme setting:", err); }
        });
    }

    // Setup Formatting Toolbar Listeners
    if (formattingToolbar) {
         // Pass context needed by toolbar button actions
        setupFormattingToolbarListeners(formattingToolbar, getFormattingContext());

        // Event listeners to show/hide the toolbar (remain in goodUI.js)
        document.addEventListener('mouseup', (e) => {
            setTimeout(() => {
                if (!formattingToolbar.contains(e.target) && !e.target.closest('.dropdown, .subdropdown, #help-popup')) {
                    showFormattingToolbar(formattingToolbar, getFormattingContext());
                }
            }, 10);
        });

        document.addEventListener('mousedown', (e) => {
            if (!formattingToolbar.contains(e.target) && !e.target.closest('.dropdown, .subdropdown, #help-popup')) {
                 hideFormattingToolbar(formattingToolbar);
            }
        });

        let scrollTimeout;
        window.addEventListener('scroll', () => {
            clearTimeout(scrollTimeout);
            scrollTimeout = setTimeout(() => hideFormattingToolbar(formattingToolbar), 150);
        }, true);
    }


    // Setup Help Popup
    if (helpBtn && helpPopup) {
        helpBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            
            // First fully hide the popup so we can reset it
            helpPopup.style.display = 'none';
            
            // Force close other popups before showing help
            closeAllPopups();
            
            // Make help popup visible by removing the hidden class
            helpPopup.classList.remove('hidden');
            
            // Explicitly set display and visibility properties
            helpPopup.style.display = 'block';
            helpPopup.style.visibility = 'visible';
            
            // Style it according to the theme
            const isDarkMode = document.body.classList.contains('dark-mode');
            if (isDarkMode) {
                helpPopup.style.backgroundColor = '#2e2e2e';
                helpPopup.style.color = '#ffffff';
                helpPopup.style.borderColor = '#3e3e3e';
            } else {
                helpPopup.style.backgroundColor = '#ffffff';
                helpPopup.style.color = '#000000';
                helpPopup.style.borderColor = '#d0d7de';
            }
            
            console.log("Help popup should now be visible");
        });
    }

     // Global click listener to close all popups/dropdowns
     document.addEventListener('click', (e) => {
         const target = e.target;
         // Check if click is outside any interactive popup/dropdown trigger or content area
         if (!target.closest('.dropdown, .subdropdown, #formatting-toolbar, #help-popup, .settings-option, #new-tab-btn, #tabs-dropdown-btn, #settings-btn, #help-btn, #slash-command-popup')) {
             closeAllPopups();
         }
    });

    // Global keydown for Escape to close popups
    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape') {
             closeAllPopups();
        }
    });

}

// --- Exports --- // Re-add default export for renderer.js
export default {
    initialize,
    applySettings, // Exported from formatting.js, but re-exporting here for the UI object
    applyTabAppearance, // Exported from formatting.js, re-exporting
    updateSettingsUI, // Exported from formatting.js, re-exporting
    initTabs, // Local function
    createTabElement, // Local function
    setupEventListeners, // Local function
    startAutoSave, // Exported from formatting.js, re-exporting
    // Expose local UI update functions for external calls (from IPC listeners/renderer)
    updateTabsDropdownName, // Local function
    removeTabFromDropdown // Local function
    // Note: Other functions like applyDarkMode, applyColorTheme are primarily called
    // internally or via settings/tab appearance application, so maybe don't need direct export here.
    // Functions like show/hide toolbar are also called internally by listeners.
};

// Initialize the UI when the script loads -- REMOVE THIS
// Use DOMContentLoaded to ensure elements exist
// document.addEventListener('DOMContentLoaded', initialize);