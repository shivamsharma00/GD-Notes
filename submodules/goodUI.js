// goodUI.js
// import Utils from './utils.js'; // Import if you have utility functions

// --- Module State ---
let textBoxElements = []; // Holds references to the current div.text-box elements
let currentTabInstanceData = null; // Holds the data for the tab displayed in this window
let statusBarTimeout = null; // Timeout ID for status bar hiding
let notePreviewElement = null; // Element for hover preview
let previewTimeout = null; // Timeout for showing/hiding preview
let contentEditableElements = []; // Holds references to the current div.note-content-area elements
let formattingToolbar; // Reference to the toolbar element
let currentContrastColor = '#000000'; // Default contrast color
let saveIndicatorTimeout = null; // Timeout ID for save indicator hiding
let hasContentChangedSinceLoad = false; // Track changes since tab loaded
let titleNodeMap = new WeakMap(); // Map editor elements to their current title nodes
let editorObserver = null; // Single MutationObserver for all editors

// --- DOM Element References ---
let editorContainer; // Changed from 'container'
let container, closeBtn, minimizeBtn, settingsBtn, settingsDropdown;
let fontButton, fontDropdown, fontSizeButton, fontSizeDropdown, themeToggle, themeIcon;
let colorThemeButton, colorThemeDropdown, colorIntensityButton, colorIntensityDropdown;
let newTabBtn, newTabDropdown, tabsDropdownBtn, tabsDropdown;
let saveIndicator; // Reference to the save indicator element

// --- Constants ---
const STATUS_BAR_FADE_DELAY = 1500; // milliseconds to wait before fading status bar out
const NOTE_PREVIEW_DELAY = 400; // milliseconds delay before showing preview
const MAX_PREVIEW_LINES = 10; // Max lines to show in preview
const MAX_PREVIEW_CHARS = 300; // Max characters to show in preview
const TAB_NAME_WORDS = 5; // Max words from content for tab name
const MAX_TAB_NAME_LENGTH = 20; // Maximum characters for tab name

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
    editorContainer = document.getElementById('editor-container'); // Changed ID
    formattingToolbar = document.getElementById('formatting-toolbar');
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

    if (!editorContainer) console.error("UI Initialize: editor-container not found!");
    if (!formattingToolbar) console.error("UI Initialize: formatting-toolbar not found!");
    // Add checks for other critical elements if needed

    // Save Indicator
    saveIndicator = document.getElementById('save-indicator');
    if (!saveIndicator) console.warn("UI Initialize: save-indicator not found!");
};

// --- Helper Functions ---

// Calculates contrast color (simple version)
function getContrastColor(hexcolor) {
    if (!hexcolor) return '#000000'; // Default to black
    // Handle RGB format if necessary
    if (hexcolor.startsWith('rgb')) {
        try {
            const rgb = hexcolor.match(/\d+/g).map(Number);
            if (rgb.length < 3) return '#000000';
            // Formula using relative luminance
            const luminance = (0.2126 * rgb[0] + 0.7152 * rgb[1] + 0.0722 * rgb[2]) / 255;
            return luminance > 0.5 ? '#000000' : '#ffffff';
        } catch (e) {
            return '#000000'; // Fallback on error
        }
    }
    // Handle HEX format
    if (hexcolor.startsWith('#')) {
        hexcolor = hexcolor.slice(1);
    }
    if (hexcolor.length === 3) {
        hexcolor = hexcolor.split('').map(char => char + char).join('');
    }
    if (hexcolor.length !== 6) return '#000000'; // Invalid hex

    const r = parseInt(hexcolor.substr(0, 2), 16);
    const g = parseInt(hexcolor.substr(2, 2), 16);
    const b = parseInt(hexcolor.substr(4, 2), 16);
    const luminance = (0.2126 * r + 0.7152 * g + 0.0722 * b) / 255;
    return luminance > 0.5 ? '#000000' : '#ffffff';
}

// Helper to check if an element is inside a contenteditable area
function isInsideEditable(element) {
    if (!element) return false;
    let node = element;
    while (node && node !== document.body) {
        if (node.classList && node.classList.contains('note-content-area') && node.isContentEditable) {
            return node; // Return the contenteditable parent
        }
        node = node.parentNode;
    }
    return false;
}

// --- Settings & Appearance ---

// Apply global settings (theme, base font/size) to the body/root
function applySettings(settings) {
    if (!settings) return;
    console.log("UI: Applying global settings", settings);
    document.documentElement.style.setProperty('--font-family', settings.defaultFontFamily || "'JetBrains Mono', monospace");
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
    
    // Special handling for four-square rainbow mode (level = -1)
    const isRainbowMode = level === -1 && contentEditableElements.length === 4;
    
    if (isRainbowMode) {
        // Apply different intensities to each text box in four-square layout
        for (let i = 0; i < 4; i++) {
            const box = contentEditableElements[i];
            if (!box) continue;
            
            // Use the appropriate theme array based on dark mode
            const colors = isDark ? COLOR_THEMES[themeName].dark : COLOR_THEMES[themeName].light;
            
            // Apply a different intensity level to each box (0, 1, 2, 3)
            const colorIndex = i % colors.length;
            const bgColor = colors[colorIndex];
            
            // Calculate text color based on background brightness
            const isLightBg = isDark ? false : true;
            const textColor = isLightBg ? '#000000' : '#ffffff';
            
            // Apply to individual box
            box.style.backgroundColor = bgColor;
            box.style.color = textColor;
            
            // Store colors in the box dataset for reference
            box.dataset.backgroundColor = bgColor;
            box.dataset.textColor = textColor;
        }
        
        // For consistency, still set the CSS variables to the first intensity level
        document.documentElement.style.setProperty('--text-box-bg', isDark ? 
            COLOR_THEMES[themeName].dark[0] : COLOR_THEMES[themeName].light[0]);
        document.documentElement.style.setProperty('--text-box-color', isDark ? '#ffffff' : '#000000');
    } else {
        // Regular theme application (all boxes same color)
        // Use the appropriate theme array based on dark mode
        const colors = isDark ? COLOR_THEMES[themeName].dark : COLOR_THEMES[themeName].light;
        
        // Get the color at the specified level (or default to level 1)
        const colorIndex = Math.min(Math.max(0, level), 3); // Clamp between 0-3
        const bgColor = colors[colorIndex];
        
        // Calculate text color based on background brightness
        const isLightBg = isDark ? false : true;
        const textColor = isLightBg ? '#000000' : '#ffffff';
        
        // Apply to document variables
        document.documentElement.style.setProperty('--text-box-bg', bgColor);
        document.documentElement.style.setProperty('--text-box-color', textColor);
        
        // Apply to each content editable area directly
        contentEditableElements.forEach(box => {
            box.style.backgroundColor = bgColor;
            box.style.color = textColor;
        });
    }
    
    // Update current tab data
    if (currentTabInstanceData && currentTabInstanceData.appearance) {
        // For rainbow mode, we still just store the theme and level
        currentTabInstanceData.appearance.colorTheme = themeName;
        currentTabInstanceData.appearance.colorLevel = level;
        
        // If it's not rainbow mode, also update the background and text colors
        if (!isRainbowMode) {
            currentTabInstanceData.appearance.backgroundColor = document.documentElement.style.getPropertyValue('--text-box-bg');
            currentTabInstanceData.appearance.textColor = document.documentElement.style.getPropertyValue('--text-box-color');
        }
        
        // Save to storage
        saveCurrentTabContent(false);
    }
    
    // Update UI
    if (colorThemeButton) {
        colorThemeButton.querySelector('.settings-option-value').textContent = themeName.charAt(0).toUpperCase() + themeName.slice(1);
    }
    
    if (colorIntensityButton) {
        colorIntensityButton.querySelector('.settings-option-value').textContent = level === -1 ? 
            "Rainbow" : `Level ${level + 1}`;
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
}


// --- Tab & Content Management ---

// Helper function to extract first few words and limit length
function getFirstWords(htmlContent, count) {
    if (!htmlContent) return "";
    // Create a temporary element to parse HTML and get text content
    const tempDiv = document.createElement('div');
    tempDiv.innerHTML = htmlContent; // Use innerHTML to handle HTML tags
    const plainText = tempDiv.textContent || tempDiv.innerText || "";
    const words = plainText.trim().split(/\s+/).slice(0, count).join(" ");
    
    // Limit overall length to MAX_TAB_NAME_LENGTH chars
    if (words.length > MAX_TAB_NAME_LENGTH) {
        return words.substring(0, MAX_TAB_NAME_LENGTH - 3) + "...";
    }
    return words;
}

// Populate the 'Existing Tabs' dropdown
async function initTabs(tabsArray) { // Make async to fetch tab data
    if (!tabsDropdown) {
        console.warn("UI: Tabs dropdown element not found.");
        return;
    }
    tabsDropdown.innerHTML = ''; // Clear existing entries

    // Pre-fetch all tab data to avoid multiple IPC calls on hover
    const allTabsData = {};
    try {
        const fetchedTabs = await window.electronAPI.getAllTabs(); // This might be redundant if tabsArray is already complete
        fetchedTabs.forEach(tab => {
            if(tab && tab.id) allTabsData[tab.id] = tab;
        });
        console.log(`UI: Pre-fetched data for ${Object.keys(allTabsData).length} tabs for preview.`);
    } catch (err) {
        console.error("UI: Error pre-fetching tab data for preview:", err);
        // Proceed without previews if fetching fails
    }


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
        // Use updated name format from tab data directly
        nameSpan.textContent = tab.name || `Note (${tab.id.substring(0, 6)})`;
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

        // --- Note Preview Logic ---
        nameSpan.addEventListener('mouseenter', (e) => {
            clearTimeout(previewTimeout); // Clear any pending hide timeout
            // If another preview is showing, hide it immediately
            hideNotePreview(0);

            previewTimeout = setTimeout(() => {
                showNotePreview(e.currentTarget, tab.id, allTabsData[tab.id]);
            }, NOTE_PREVIEW_DELAY);
        });

        nameSpan.addEventListener('mouseleave', () => {
            clearTimeout(previewTimeout); // Clear pending show timeout
            hideNotePreview(); // Hide with delay
        });
        // --- End Note Preview Logic ---

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
                             // Remove from cached data
                             delete allTabsData[tab.id];
                             // Re-initialize tabs if needed (or just remove entry)
                             if (tabsDropdown.children.length === 0) {
                                tabsDropdown.innerHTML = '<div class="tab-entry no-tabs">No saved notes</div>';
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

// --- Note Preview Functions ---
function showNotePreview(targetElement, tabId, tabData) {
    hideNotePreview(0); // Ensure no previews are visible

    if (!tabData || !tabData.notes || !tabData.notes[0]) {
        console.warn(`UI: No data found for tab ${tabId} to show preview.`);
        return;
    }

    notePreviewElement = document.createElement('div');
    notePreviewElement.id = 'note-preview-popup';
    notePreviewElement.className = 'note-preview fade-out-bottom'; // Add fade class

    // Apply Appearance
    const appearance = tabData.appearance || {};
    const isDark = appearance.isDarkMode || document.body.classList.contains('dark-mode');
    const themeName = appearance.colorTheme || 'default';
    const level = appearance.colorLevel !== undefined ? appearance.colorLevel : 1;

    // Determine background and text color based on theme/level/mode
    let bgColor, textColor;
    if (COLOR_THEMES[themeName]) {
        const colors = isDark ? COLOR_THEMES[themeName].dark : COLOR_THEMES[themeName].light;
        const colorIndex = Math.min(Math.max(0, level), 3); // Clamp level 0-3
        bgColor = colors[colorIndex] || (isDark ? '#1e1e1e' : '#ffffff'); // Fallback color
        textColor = (level > 1 || isDark) ? '#ffffff' : '#000000'; // Simple contrast logic, adjust if needed
    } else {
        bgColor = appearance.backgroundColor || (isDark ? '#1e1e1e' : '#ffffff');
        textColor = appearance.textColor || (isDark ? '#ffffff' : '#000000');
    }

    notePreviewElement.style.fontFamily = appearance.fontFamily || 'var(--font-family)';
    notePreviewElement.style.fontSize = appearance.fontSize || 'var(--font-size)';
    notePreviewElement.style.backgroundColor = bgColor;
    notePreviewElement.style.color = textColor;
    notePreviewElement.style.borderColor = isDark ? '#555' : '#ccc'; // Border color based on mode


    // Limit content length and lines
    let content = tabData.notes[0].content || "";
    if (content.length > MAX_PREVIEW_CHARS) {
        content = content.substring(0, MAX_PREVIEW_CHARS) + "...";
    }
    // Simple line limiting (might not be perfect with complex HTML)
    const lines = content.split(/<br.*?>/gi); // Split by <br> tags (case-insensitive)
    if (lines.length > MAX_PREVIEW_LINES) {
         content = lines.slice(0, MAX_PREVIEW_LINES).join('<br>') + "...";
    }
    notePreviewElement.innerHTML = content; // Use innerHTML as content is stored as HTML

    // Positioning
    const rect = targetElement.getBoundingClientRect();
    document.body.appendChild(notePreviewElement); // Append first to calculate size

    // Position to the right of the dropdown, aligned with the hovered element
    const dropdownRect = tabsDropdown.getBoundingClientRect();
    notePreviewElement.style.position = 'fixed'; // Use fixed to position relative to viewport
    notePreviewElement.style.top = `${rect.top}px`; // Align top with the hovered item
    notePreviewElement.style.left = `${dropdownRect.right + 10}px`; // 10px right of the dropdown

    // Adjust if preview goes off-screen
    const previewRect = notePreviewElement.getBoundingClientRect();
    if (previewRect.right > window.innerWidth) {
        notePreviewElement.style.left = `${dropdownRect.left - previewRect.width - 10}px`; // Position left of dropdown
    }
    if (previewRect.bottom > window.innerHeight) {
        notePreviewElement.style.top = `${window.innerHeight - previewRect.height - 10}px`; // Move up
    }
     if (previewRect.left < 0) {
         notePreviewElement.style.left = '10px'; // Ensure it's not off-screen left
     }

    // Keep preview visible if mouse enters it
    notePreviewElement.addEventListener('mouseenter', () => {
        clearTimeout(previewTimeout);
    });
    notePreviewElement.addEventListener('mouseleave', () => {
        hideNotePreview();
    });
}

function hideNotePreview(delay = 300) {
    clearTimeout(previewTimeout);
    if (notePreviewElement) {
        previewTimeout = setTimeout(() => {
            if (notePreviewElement) {
                notePreviewElement.remove();
                notePreviewElement = null;
            }
        }, delay);
    }
}

// Create the editable div elements based on layout
function createTabElement(tabData) {
    if (!editorContainer) {
        console.error("UI: Cannot create tab elements, editorContainer not found.");
        return;
    }
    if (!tabData) {
         console.error("UI: Cannot create tab elements, no tabData provided.");
         editorContainer.innerHTML = "<p>Error: Could not load note data.</p>";
         return;
    }
    console.log(`UI: Creating content areas for layout: ${tabData.layout}`);
    editorContainer.innerHTML = ''; // Clear previous content
    contentEditableElements = []; // Reset the array
    currentTabInstanceData = tabData; // Store reference

    const layout = tabData.layout || 'single';
    editorContainer.className = `${layout}-layout`; // Apply layout class to container
    document.body.classList.toggle('four-square-mode', layout === 'four-square');

    const numBoxes = (layout === 'four-square') ? 4 : 1;

    for (let i = 0; i < numBoxes; i++) {
        const box = document.createElement('div');
        box.className = 'note-content-area'; // Use the new class
        box.id = `note-content-area-${i + 1}`;
        box.contentEditable = "true";
        box.spellcheck = true; // Enable spellcheck

        // Reset change flag when creating new element
        hasContentChangedSinceLoad = false;

        // Load HTML content
        const noteData = tabData.notes?.[i];
        // --- IMPORTANT: Sanitize before setting innerHTML if content could come from untrusted sources ---
        // Example using a placeholder:
        // box.innerHTML = sanitizeHTML(noteData?.content || "");
        box.innerHTML = noteData?.content || ""; // Direct for now (assuming local trust)

        // Apply appearance variables via CSS, direct styles are handled by applyTabAppearance/applyColorTheme

        // Initialize list styles and set up interactivity for checkboxes
        initContentStyles(box);

        // Apply initial implicit title styling
        applyImplicitTitle(box);

        // --- Key Input Event Listener for Markdown-like shortcuts ---
        box.addEventListener('keydown', (e) => {
            // Handle Enter key in checklist items
            if (e.key === 'Enter' && !e.shiftKey) {
                // Check if we're inside a checklist-content element
                const selection = window.getSelection();
                const range = selection.getRangeAt(0);
                
                // Find if we're inside a checklist item
                let checklistContent = getAncestorWithClass(range.startContainer, 'checklist-content');
                if (checklistContent) {
                    e.preventDefault(); // Prevent default enter behavior anyway

                    // Check if the checklist item's content is empty
                    if (isElementEmpty(checklistContent) && isAtStartOfNode(range)) {
                        // Content is empty, remove checklist item and insert paragraph
                        const currentItem = checklistContent.parentNode;
                        const parentContainer = currentItem.parentNode;

                        if (parentContainer) {
                            // Create a new paragraph element (or div)
                            const newPara = document.createElement('div');
                            // Add a zero-width space to ensure it's focusable, or just set focus later
                             newPara.innerHTML = '<br>'; // Or use a ZWS: '​';

                            // Insert the new paragraph after the checklist item
                            parentContainer.insertBefore(newPara, currentItem.nextSibling);

                            // Remove the empty checklist item
                            parentContainer.removeChild(currentItem);

                            // Move cursor to the new paragraph
                            setTimeout(() => {
                                // Move selection to the start of the new paragraph
                                range.setStart(newPara, 0);
                                range.collapse(true);
                                selection.removeAllRanges();
                                selection.addRange(range);
                                newPara.focus(); // Ensure focus is set
                            }, 0);

                             // Trigger save after modification
                             const editableParent = isInsideEditable(newPara); // Use the new element
                             if (editableParent) {
                                 for (let i = 0; i < contentEditableElements.length; i++) {
                                     if (contentEditableElements[i] === editableParent) {
                                         if (currentTabInstanceData && currentTabInstanceData.notes && currentTabInstanceData.notes[i]) {
                                             currentTabInstanceData.notes[i].content = editableParent.innerHTML;
                                             currentTabInstanceData.notes[i].metadata.lastModified = new Date().toISOString();
                                             hasContentChangedSinceLoad = true;
                                             debouncedSave();
                                         }
                                         break;
                                     }
                                 }
                             }

                        }
                    } else {
                        // Content is not empty, create a new checklist item below
                        const checklistItem = document.createElement('div');
                        checklistItem.className = 'checklist-item';

                        const checkbox = document.createElement('span');
                        checkbox.className = 'checkbox unchecked';
                        checkbox.innerHTML = '⬜';
                        checkbox.contentEditable = false;
                        checkbox.addEventListener('click', handleCheckboxClick);

                        const content = document.createElement('span');
                        content.className = 'checklist-content';
                        content.contentEditable = true;

                        checklistItem.appendChild(checkbox);
                        checklistItem.appendChild(content);

                        const currentItem = checklistContent.parentNode;
                        if (currentItem && currentItem.parentNode) {
                            currentItem.parentNode.insertBefore(checklistItem, currentItem.nextSibling);
                            setTimeout(() => {
                                const range = document.createRange();
                                range.setStart(content, 0);
                                range.collapse(true);
                                selection.removeAllRanges();
                                selection.addRange(range);
                                content.focus();
                            }, 0);
                        }
                    }
                    return; // Handled enter key
                }
            }

            // Handle Backspace key in empty checklist items
            if (e.key === 'Backspace') {
                const selection = window.getSelection();
                if (!selection.isCollapsed) return; // Only handle when cursor is at a position (not selecting text)
                
                const range = selection.getRangeAt(0);
                const node = range.startContainer;
                
                // Check if we're at the beginning of a checklist content element
                const checklistContent = getAncestorWithClass(node, 'checklist-content');
                if (checklistContent && isElementEmpty(checklistContent) && isAtStartOfNode(range)) {
                    e.preventDefault(); // Prevent default backspace
                    
                    // Get the parent checklist item and remove it
                    const checklistItem = checklistContent.parentNode;
                    if (checklistItem && checklistItem.parentNode) {
                        // Get previous element to move cursor there
                        const prevElement = checklistItem.previousElementSibling;
                        
                        // Remove the checklist item
                        checklistItem.parentNode.removeChild(checklistItem);
                        
                        // Move cursor to previous element if it exists
                        if (prevElement) {
                            // If it's another checklist, move to its content
                            const prevContent = prevElement.querySelector('.checklist-content');
                            if (prevContent) {
                                // Set cursor to end of the previous content
                                const newRange = document.createRange();
                                if (prevContent.lastChild && prevContent.lastChild.nodeType === Node.TEXT_NODE) {
                                    newRange.setStart(prevContent.lastChild, prevContent.lastChild.textContent.length);
                                } else {
                                    newRange.setStart(prevContent, prevContent.childNodes.length);
                                }
                                newRange.collapse(true);
                                
                                selection.removeAllRanges();
                                selection.addRange(newRange);
                            } else {
                                // Otherwise just focus on previous element
                                if (prevElement.nodeType === Node.TEXT_NODE) {
                                    const newRange = document.createRange();
                                    newRange.setStart(prevElement, prevElement.textContent.length);
                                    newRange.collapse(true);
                                    
                                    selection.removeAllRanges();
                                    selection.addRange(newRange);
                                }
                            }
                        }
                        
                        // Trigger save
                        const editableParent = isInsideEditable(range.startContainer);
                        if (editableParent) {
                            for (let i = 0; i < contentEditableElements.length; i++) {
                                if (contentEditableElements[i] === editableParent) {
                                    if (currentTabInstanceData && currentTabInstanceData.notes && currentTabInstanceData.notes[i]) {
                                        currentTabInstanceData.notes[i].content = editableParent.innerHTML;
                                        currentTabInstanceData.notes[i].metadata.lastModified = new Date().toISOString();
                                        currentTabInstanceData.notes[i].metadata.modified = new Date().toISOString();
                                        hasContentChangedSinceLoad = true; // Mark change
                                        debouncedSave();
                                    }
                                    break;
                                }
                            }
                        }
                    }
                }
            }

            // Check for Tab key for list indentation
            if (e.key === 'Tab') {
                const selection = window.getSelection();
                const range = selection.getRangeAt(0);
                
                // Check if we're in a list item
                let listItem = getAncestorByTagName(range.startContainer, 'LI');
                
                if (listItem) {
                    e.preventDefault(); // Prevent default tab behavior
                    
                    if (e.shiftKey) {
                        // Decrease indentation (outdent)
                        document.execCommand('outdent', false, null);
                    } else {
                        // Increase indentation (indent)
                        document.execCommand('indent', false, null);
                    }
                    return;
                }
            }
            
            // Handle Space key for auto-list creation
            if (e.key === ' ') {
                const selection = window.getSelection();
                if (!selection.isCollapsed) return; // Only proceed if it's just a cursor
                
                const range = selection.getRangeAt(0);
                const node = range.startContainer;
                
                // Only apply to text nodes at the beginning of a line
                if (node.nodeType === Node.TEXT_NODE) {
                    const text = node.textContent.substring(0, range.startOffset).trim();
                    
                    // Check for various Markdown-like list prefixes
                    if (text === '*') {
                        e.preventDefault();
                        // Replace the * with a round bullet list
                        deleteLastCharacters(node, range, text.length);
                        document.execCommand('insertUnorderedList', false, null);
                        // Apply standard bullet style
                        const ul = getAncestorByTagName(selection.anchorNode, 'UL');
                        if (ul) {
                            ul.classList.remove('arrow');
                            ul.classList.add('round');
                        }
                        return;
                    } 
                    else if (text === '-') {
                        e.preventDefault();
                        // Replace the - with an arrow bullet list
                        deleteLastCharacters(node, range, text.length);
                        document.execCommand('insertUnorderedList', false, null);
                        // Apply arrow style
                        const ul = getAncestorByTagName(selection.anchorNode, 'UL');
                        if (ul) {
                            ul.classList.remove('round');
                            ul.classList.add('arrow');
                        }
                        return;
                    }
                    else if (text === '1.') {
                        e.preventDefault();
                        // Replace the 1. with an actual numbered list
                        deleteLastCharacters(node, range, text.length);
                        document.execCommand('insertOrderedList', false, null);
                        return;
                    }
                    else if (text === '[]' || text === '[ ]') {
                        e.preventDefault();
                        // Create a checklist item
                        deleteLastCharacters(node, range, text.length);
                        // Insert a custom checkbox
                        createChecklistItem(selection);
                        return;
                    }
                    // Add more patterns as needed
                }
            }
        });

        // --- Input Event Listener for content changes ---
        box.addEventListener('input', (event) => {
            if (!currentTabInstanceData || !currentTabInstanceData.notes) return;

            // Ensure the specific note object exists within the notes array
            if (!currentTabInstanceData.notes[i]) {
                currentTabInstanceData.notes[i] = {
                    id: `note-${i + 1}`,
                    content: "",
                    metadata: { created: new Date().toISOString(), lastModified: new Date().toISOString() }
                };
            }

            // Detect and convert URLs to hyperlinks
            detectAndLinkURLs(box);
            
            // Apply implicit title styling on input
            applyImplicitTitle(box);
            
            // Update HTML content and modification time
            currentTabInstanceData.notes[i].content = box.innerHTML; // <-- Read innerHTML
            currentTabInstanceData.notes[i].metadata.lastModified = new Date().toISOString();
            currentTabInstanceData.notes[i].metadata.modified = new Date().toISOString();

            // Mark that content has changed
            if (!hasContentChangedSinceLoad) {
                console.log("Change detected, enabling save.");
                hasContentChangedSinceLoad = true;
            }

            // Dynamic Tab Naming (based on stripped text)
            if (i === 0) {
                const firstWords = getFirstWords(box.innerHTML, TAB_NAME_WORDS); // Use updated helper
                const originalName = currentTabInstanceData.name;
                // Update name only if content exists
                if (firstWords.trim()) {
                    currentTabInstanceData.name = `${firstWords}`;
                } else {
                    // Revert to default name if content is cleared
                    const defaultName = currentTabInstanceData.layout === 'single' ? 'Single Note' : 'Four Square';
                    currentTabInstanceData.name = `${defaultName}`;
                }
                // If the name actually changed, report it to main
                if (currentTabInstanceData.name !== originalName) {
                    window.electronAPI.reportTabNameChange(currentTabInstanceData.id, currentTabInstanceData.name);
                    updateTabsDropdownName(currentTabInstanceData.id, currentTabInstanceData.name);
                }
            }

            // Trigger debounced save
            debouncedSave();
        });

        // Add blur event to save immediately when focus is lost
        box.addEventListener('blur', () => {
            saveCurrentTabContent(true); // Force save on blur
        });

        // --- Paste Event Listener to strip formatting ---
        box.addEventListener('paste', (e) => {
           e.preventDefault(); // Prevent the default paste behavior
           const text = e.clipboardData?.getData('text/plain') || ''; // Get plain text from clipboard
           if (text) {
               document.execCommand('insertText', false, text); // Insert plain text
               // Mark content as changed after paste
               if (!hasContentChangedSinceLoad) {
                  console.log("Change detected (paste), enabling save.");
                  hasContentChangedSinceLoad = true;
               }
               // Trigger debounced save after paste
               debouncedSave();
           }
       });

         // Add focus listener if needed (e.g., to track the active editable area)
         box.addEventListener('focus', (e) => {
             // console.log('Focused area:', e.target.id);
         });

        editorContainer.appendChild(box);
        contentEditableElements.push(box); // Add reference
    }

    console.log(`UI: Created ${contentEditableElements.length} content editable areas.`);
    // ... (save, autosave setup) ...
}

// Initialize content styles and setup interactivity for saved content
function initContentStyles(element) {
    // Apply proper list classes
    ensureListClasses(element);
    
    // Set up checkbox interactivity for any saved checkboxes
    const checkboxes = element.querySelectorAll('.checkbox');
    checkboxes.forEach(checkbox => {
        // Clone any existing event listeners
        const newCheckbox = checkbox.cloneNode(true);
        checkbox.parentNode.replaceChild(newCheckbox, checkbox);
        
        // Add click event listener
        newCheckbox.addEventListener('click', handleCheckboxClick);
    });
}

// Helper function to find ancestor element with specific tag name
function getAncestorByTagName(node, tagName) {
    while (node && node !== document.body) {
        if (node.nodeType === Node.ELEMENT_NODE && 
            node.tagName && node.tagName.toUpperCase() === tagName) {
            return node;
        }
        node = node.parentNode;
    }
    return null;
}

// Helper function to delete last N characters from the current text node
function deleteLastCharacters(node, range, count) {
    // Create a range that selects the last 'count' characters
    const prefixRange = document.createRange();
    prefixRange.setStart(node, range.startOffset - count);
    prefixRange.setEnd(node, range.startOffset);
    
    // Select and delete those characters
    const selection = window.getSelection();
    selection.removeAllRanges();
    selection.addRange(prefixRange);
    document.execCommand('delete', false, null);
    
    // Collapse the selection to the end
    selection.collapseToEnd();
}

// Helper function to handle HTML insertion
function detectAndLinkURLs(element) {
    // Don't process if the element is already a link or inside a link
    if (element.tagName === 'A' || element.parentNode.tagName === 'A') {
        return;
    }
    
    // Process text nodes that aren't already inside links
    const textNodes = [];
    const walk = document.createTreeWalker(element, NodeFilter.SHOW_TEXT, {
        acceptNode: function(node) {
            // Skip nodes that are inside links or checkboxes
            let parent = node.parentNode;
            while (parent && parent !== element) {
                if (parent.tagName === 'A' || parent.classList?.contains('checkbox')) return NodeFilter.FILTER_REJECT;
                parent = parent.parentNode;
            }
            return NodeFilter.FILTER_ACCEPT;
        }
    });
    
    let node;
    while (node = walk.nextNode()) {
        textNodes.push(node);
    }
    
    // URL regex pattern - matches common URL patterns
    const urlRegex = /(\b(https?|ftp):\/\/[-A-Z0-9+&@#\/%?=~_|!:,.;]*[-A-Z0-9+&@#\/%=~_|])/gi;
    
    // Process each text node
    textNodes.forEach(textNode => {
        const text = textNode.textContent;
        const matches = text.match(urlRegex);
        
        if (matches && matches.length > 0) {
            // Create a document fragment to hold the new nodes
            const fragment = document.createDocumentFragment();
            let lastIndex = 0;
            
            // Process each URL match
            text.replace(urlRegex, function(url, match, offset) {
                // Add text before the URL
                if (offset > lastIndex) {
                    fragment.appendChild(document.createTextNode(
                        text.substring(lastIndex, offset)
                    ));
                }
                
                // Create link element
                const link = document.createElement('a');
                link.href = url;
                link.textContent = url;
                link.setAttribute('target', '_blank'); // Open in new tab
                fragment.appendChild(link);
                
                lastIndex = offset + url.length;
                return url;
            });
            
            // Add any remaining text after the last URL
            if (lastIndex < text.length) {
                fragment.appendChild(document.createTextNode(
                    text.substring(lastIndex)
                ));
            }
            
            // Replace the text node with our fragment containing links
            textNode.parentNode.replaceChild(fragment, textNode);
        }
    });

    // After processing links, also handle list classes
    ensureListClasses(element);
    
    // Ensure checkboxes have event handlers
    const checkboxes = element.querySelectorAll('.checkbox');
    if (checkboxes.length > 0) {
        checkboxes.forEach(checkbox => {
            // Check if this checkbox already has a click listener
            if (!checkbox.dataset.hasListener) {
                // Add click event listener
                checkbox.addEventListener('click', handleCheckboxClick);
                checkbox.dataset.hasListener = 'true';
            }
        });
    }
}

// Separate handler function for checkbox clicks to avoid duplication
function handleCheckboxClick(e) {
    e.preventDefault();
    e.stopPropagation();
    
    const checkbox = this;
    const parent = checkbox.parentNode;
    const isChecked = checkbox.classList.contains('checked');
    
    if (isChecked) {
        // Uncheck
        checkbox.classList.remove('checked');
        checkbox.classList.add('unchecked');
        checkbox.innerHTML = '⬜';
        
        // Remove strikethrough from sibling content
        const content = parent.querySelector('.checklist-content');
        if (content) {
            content.classList.remove('checked');
        }
    } else {
        // Check
        checkbox.classList.remove('unchecked');
        checkbox.classList.add('checked');
        checkbox.innerHTML = '✅';
        
        // Add strikethrough to sibling content
        const content = parent.querySelector('.checklist-content');
        if (content) {
            content.classList.add('checked');
        }
    }
    
    // Trigger save
    const editableParent = isInsideEditable(parent);
    if (editableParent) {
        // Find which content editable area this belongs to
        for (let i = 0; i < contentEditableElements.length; i++) {
            if (contentEditableElements[i] === editableParent) {
                // Update stored content
                if (currentTabInstanceData && currentTabInstanceData.notes && currentTabInstanceData.notes[i]) {
                    currentTabInstanceData.notes[i].content = editableParent.innerHTML;
                    currentTabInstanceData.notes[i].metadata.lastModified = new Date().toISOString();
                    currentTabInstanceData.notes[i].metadata.modified = new Date().toISOString();
                    hasContentChangedSinceLoad = true; // Mark change
                    debouncedSave();
                }
                break;
            }
        }
    }
}

// Function to ensure all unordered lists have correct classes
function ensureListClasses(element) {
    // Get all unordered lists in the element
    const ulElements = element.querySelectorAll('ul');
    
    // For each UL, ensure it has either 'arrow' or 'round' class
    ulElements.forEach(ul => {
        // Skip if it already has one of our classes
        if (ul.classList.contains('arrow') || ul.classList.contains('round')) {
            return;
        }
        
        // Default to round bullet style
        ul.classList.add('round');
    });
}

// --- Saving ---

// Function to save the current tab's data
function saveCurrentTabContent(forceUpdate = true) {
    if (!currentTabInstanceData) {
        console.warn("Save skipped: No current tab data.");
        return;
    }
    
    // If nothing has changed since the last successful save/load, don't proceed
    if (!hasContentChangedSinceLoad) {
        console.log("Save skipped: No changes detected since last save.");
        return;
    }
    
    console.log(`UI: Saving content for tab ${currentTabInstanceData.id}`);

    // Use a flag to avoid showing indicator for no-op saves
    let didSaveOccur = false;

    window.electronAPI.addOrUpdateTab(currentTabInstanceData)
        .then(() => {
            console.log("Tab content saved successfully.");
            didSaveOccur = true;
            // Show save indicator on successful save
            showSaveIndicator();
            hasContentChangedSinceLoad = false; // Reset change flag ONLY after successful save
        })
        .catch(err => console.error(`UI: Error saving tab content for ${currentTabInstanceData.id}:`, err));
    
    // If we're forcing update (like when a setting changes), update lastModified time
    if (forceUpdate && currentTabInstanceData.metadata) {
        currentTabInstanceData.metadata.modified = new Date().toISOString();
    }
}

// Debounce function with immediate option
function debounce(func, wait, immediate = false) {
    let timeout;
    return function(...args) {
        const later = () => {
            timeout = null;
            if (!immediate) func.apply(this, args);
        };
        const callNow = immediate && !timeout;
        clearTimeout(timeout);
        timeout = setTimeout(later, wait);
        if (callNow) func.apply(this, args);
    };
}

// Create a debounced version of the save function - runs 500ms after typing stops
const debouncedSave = debounce(saveCurrentTabContent, 500);

// Also set up an auto-save timer to save periodically regardless of changes
let autoSaveInterval = null;

function setupAutoSave() {
    // Clear any existing interval
    if (autoSaveInterval) {
        clearInterval(autoSaveInterval);
    }
    
    // Save every 10 seconds regardless of changes
    autoSaveInterval = setInterval(() => {
        if (currentTabInstanceData && currentTabInstanceData.notes && 
            hasContentChangedSinceLoad) { // Only save if content has changed since load
            saveCurrentTabContent(false); // Don't force update lastModified time for auto-saves
        }
    }, 10000); // 10 seconds
}

// Start auto-save when tab is created
function startAutoSave() {
    setupAutoSave();
    
    // Also set up a save before window unload
    window.addEventListener('beforeunload', () => {
        if (currentTabInstanceData) {
            saveCurrentTabContent(true);
        }
    });
}

// --- Save Indicator Function ---
function showSaveIndicator() {
    if (!saveIndicator) return;

    clearTimeout(saveIndicatorTimeout);
    saveIndicator.classList.add('visible');

    saveIndicatorTimeout = setTimeout(() => {
        saveIndicator.classList.remove('visible');
    }, 800); // Corresponds to user request (<800ms)
}

// --- Floating Toolbar Logic ---

function showFormattingToolbar() {
    const selection = window.getSelection();
    if (!selection || selection.isCollapsed) {
        hideFormattingToolbar();
        return;
    }

    const range = selection.getRangeAt(0);
    const selectedElement = range.commonAncestorContainer.nodeType === Node.TEXT_NODE
        ? range.commonAncestorContainer.parentNode
        : range.commonAncestorContainer;

    // Check if selection is within one of our editable areas
    const editableParent = isInsideEditable(selectedElement);
    if (!editableParent) {
         hideFormattingToolbar();
         return;
    }

    const rect = range.getBoundingClientRect();
    if (!rect || rect.width === 0 || rect.height === 0) {
        hideFormattingToolbar(); // No valid rectangle
        return;
    }

    // Always position toolbar directly above selection
    const toolbarHeight = formattingToolbar.offsetHeight;
    const toolbarWidth = formattingToolbar.offsetWidth;
    let top = window.scrollY + rect.top - toolbarHeight - 8; // 8px above selection
    let left = window.scrollX + rect.left + (rect.width / 2) - (toolbarWidth / 2); // Center horizontally

    // If too close to top of viewport, position below selection
    if (rect.top < toolbarHeight + 10) {
        top = window.scrollY + rect.bottom + 8; // 8px below selection
    }

    // Adjust position if off-screen horizontally
    if (left < window.scrollX) left = window.scrollX + 5; // Too far left
    if (left + toolbarWidth > window.innerWidth + window.scrollX) {
        left = window.innerWidth + window.scrollX - toolbarWidth - 5; // Too far right
    }

    // Calculate contrast color based on the specific editable area's background
    const bg = window.getComputedStyle(editableParent).backgroundColor;
    currentContrastColor = getContrastColor(bg);

    // Update color button
    const colorBtn = formattingToolbar.querySelector('#toolbar-color-btn');
    if (colorBtn) {
        colorBtn.dataset.color = currentContrastColor;
    }

    formattingToolbar.style.top = `${top}px`;
    formattingToolbar.style.left = `${left}px`;
    formattingToolbar.classList.remove('hidden');
}

function hideFormattingToolbar() {
    if (formattingToolbar && !formattingToolbar.classList.contains('hidden')) {
        formattingToolbar.classList.add('hidden');
    }
}

function setupFormattingToolbarListeners() {
    // Show toolbar on text selection end
    document.addEventListener('mouseup', (e) => {
        // Small delay allows selection to finalize after mouseup
        setTimeout(() => {
             // Check if the click was *inside* the toolbar itself
             if (!formattingToolbar.contains(e.target)) {
                 showFormattingToolbar();
             }
        }, 10);
    });

    // Hide toolbar on mousedown anywhere (will re-show if selection made)
    document.addEventListener('mousedown', (e) => {
        // Don't hide if clicking inside the toolbar itself
        if (formattingToolbar && !formattingToolbar.contains(e.target)) {
             hideFormattingToolbar();
        }
    });
    
    // Hide if selection collapses (e.g., user clicks without selecting)
    document.addEventListener('selectionchange', () => {
        const selection = window.getSelection();
        if (!selection || selection.isCollapsed) {
            // Only hide if toolbar is currently visible
            // Add a small delay because selectionchange fires rapidly during selection
            // setTimeout(() => {
            //     const sel = window.getSelection(); // Re-check after delay
            //     if ((!sel || sel.isCollapsed) && !formattingToolbar.classList.contains('hidden')) {
            //          hideFormattingToolbar();
            //     }
            // }, 100);
            // Simpler: Let mouseup/mousedown handle most hiding.
        }
    });
    
     // Hide toolbar on scroll within editable areas
     editorContainer.addEventListener('scroll', hideFormattingToolbar, true); // Use capture phase


    // Add listeners to toolbar buttons
    formattingToolbar.querySelectorAll('button[data-command]').forEach(button => {
        button.addEventListener('click', (e) => {
            e.preventDefault(); // Prevent potential blur events
            const command = button.dataset.command;
            let value = null;

            if (command === 'foreColor') {
                value = button.dataset.color || currentContrastColor; // Use calculated contrast color
            }
            // Handle link creation prompt
            else if (command === 'createLink') {
                value = prompt('Enter link URL:');
                if (!value || value.trim() === '') return; // User cancelled or entered empty
                
                // Add http:// prefix if missing
                if (!/^https?:\/\//i.test(value)) {
                    value = 'http://' + value;
                }
            }
            // Custom checklist creation
            else if (command === 'createChecklist') {
                const selection = window.getSelection();
                if (selection.rangeCount > 0) {
                    createChecklistItem(selection);
                }
                // Keep toolbar visible after applying
                setTimeout(() => {
                    showFormattingToolbar();
                }, 10);
                return; // Skip the execCommand part
            }

            console.log(`Executing command: ${command}, Value: ${value}`);
            document.execCommand(command, false, value);
            
            // Special handling for lists - apply appropriate classes
            if (command === 'insertUnorderedList') {
                // Get the current selection
                const selection = window.getSelection();
                if (selection.rangeCount > 0) {
                    const range = selection.getRangeAt(0);
                    // Find the UL element created
                    const ul = getAncestorByTagName(range.commonAncestorContainer, 'UL');
                    if (ul && !ul.classList.contains('round') && !ul.classList.contains('arrow')) {
                        // Default to round bullets
                        ul.classList.add('round');
                    }
                }
            }
            
            // Special handling for links - set target attribute to open in new tab
            if (command === 'createLink' && value) {
                // Find the newly created link and add target="_blank"
                const selection = window.getSelection();
                if (selection.rangeCount > 0) {
                    const range = selection.getRangeAt(0);
                    const linkElement = range.commonAncestorContainer.parentNode;
                    if (linkElement && linkElement.tagName === 'A') {
                        linkElement.setAttribute('target', '_blank');
                    }
                }
            }

            // Keep toolbar visible after applying formatting
            setTimeout(() => {
                showFormattingToolbar();
            }, 10);
        });
    });
}


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
            
            // Hide all other subdropdowns and deactivate all settings options
            document.querySelectorAll('.subdropdown').forEach(dropdown => {
                if (dropdown.id !== submenuId) {
                    dropdown.classList.add('hidden');
                }
            });
            document.querySelectorAll('.settings-option').forEach(opt => {
                // Don't deactivate the clicked option yet
                if (opt !== option) {
                    opt.classList.remove('active');
                }
            });
            
            // Toggle this subdropdown
            const isNowHidden = submenu.classList.toggle('hidden');
            
            // Toggle active class on the clicked option
            option.classList.toggle('active', !isNowHidden);
            
            // If it's visible now, position it
            if (!isNowHidden) {
                positionSubmenu(option, submenu);
            }
        });
    });
    
    // Function to position submenus relative to their parent option
    function positionSubmenu(parentOption, submenu) {
        if (!parentOption || !submenu) return;
        
        // Get the parent dropdown element (settings dropdown)
        const parentDropdown = parentOption.closest('.dropdown');
        if (!parentDropdown) return;
        
        const parentRect = parentDropdown.getBoundingClientRect();
        const optionRect = parentOption.getBoundingClientRect();
        const submenuRect = submenu.getBoundingClientRect(); // Get initial size
        
        // Position horizontally: Try left first
        let left = parentRect.left - submenuRect.width - 5; // 5px spacing to the left
        
        // If positioning left goes off-screen, position to the right
        if (left < 0) {
            left = parentRect.right + 5; // 5px spacing to the right
        }
        
        // Ensure it doesn't go off-screen right either
        if (left + submenuRect.width > window.innerWidth) {
            left = window.innerWidth - submenuRect.width - 10; // Adjust if still too wide
        }
        
        submenu.style.left = `${left}px`;
        
        // Vertical alignment - align top with the parent option
        let top = optionRect.top;
        submenu.style.top = `${top}px`;
        
        // Re-check bounds after applying position
        const finalSubmenuRect = submenu.getBoundingClientRect();
        
        // Ensure submenu is visible within window vertically
        if (finalSubmenuRect.bottom > window.innerHeight) {
            // Shift up so bottom aligns with window bottom minus padding
            top = window.innerHeight - finalSubmenuRect.height - 10; 
            submenu.style.top = `${Math.max(10, top)}px`; // Ensure it doesn't go off-screen top
        } else if (finalSubmenuRect.top < 0) {
            // Shift down if it goes off-screen top
            top = 10;
            submenu.style.top = `${top}px`;
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
            document.querySelectorAll('.settings-option.active').forEach(option => {
                option.classList.remove('active');
            });
        });
    });

    // Font Size Selection
    document.querySelectorAll('.font-size-option').forEach(option => {
        option.addEventListener('click', async (e) => {
            e.stopPropagation();
            const fontSize = option.dataset.size;
            console.log(`UI: Setting font size to: ${fontSize}`);

            // Apply visually immediately
            // No need to apply directly,documentElement style will propagate
            // textBoxElements.forEach(box => box.style.fontSize = fontSize);
            
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
            document.querySelectorAll('.settings-option.active').forEach(option => {
                option.classList.remove('active');
            });
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
            document.querySelectorAll('.settings-option.active').forEach(option => {
                option.classList.remove('active');
            });
        });
    });
    
    // Color Intensity Selection
    document.querySelectorAll('.color-level-btn').forEach(button => {
        button.addEventListener('click', (e) => {
            e.stopPropagation();
            const level = parseInt(button.dataset.level);
            console.log(`UI: Setting color intensity level to: ${level === -1 ? 'Rainbow' : level + 1}`);
            
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

    // Setup the new toolbar listeners
    setupFormattingToolbarListeners();

    // Adjust global click listener to also hide the formatting toolbar
    document.addEventListener('click', (e) => {
        const target = e.target;
        // Check if click is outside dropdowns AND toolbar AND buttons that open dropdowns
        if (!target.closest('.dropdown, .subdropdown, #formatting-toolbar, #new-tab-btn, #tabs-dropdown-btn, #settings-btn, .settings-option[data-submenu]')) {
            document.querySelectorAll('.dropdown, .subdropdown').forEach(dropdown => {
                dropdown.classList.add('hidden');
            });
             document.querySelectorAll('.settings-option.active').forEach(option => {
                 option.classList.remove('active');
             });
             // Hide formatting toolbar too
             hideFormattingToolbar();
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

// Helper to update a specific tab name in the dropdown
function updateTabsDropdownName(tabId, newName) {
    if (tabsDropdown) {
        const entry = tabsDropdown.querySelector(`.tab-entry[data-tab-id="${tabId}"] .tab-name`);
        if (entry) {
            entry.textContent = newName;
            entry.title = `Open note: ${newName}`;
            console.log(`UI: Updated dropdown name for ${tabId} to "${newName}"`);
        }
    }
    // Also update cached data if necessary (though it should be updated on next fetch)
}

// Helper to remove a tab entry from the dropdown
function removeTabFromDropdown(tabId) {
    if (tabsDropdown) {
        const entry = tabsDropdown.querySelector(`.tab-entry[data-tab-id="${tabId}"]`);
        if (entry) {
            entry.remove();
            console.log(`UI: Removed tab ${tabId} from dropdown.`);
            if (tabsDropdown.children.length === 0) {
                tabsDropdown.innerHTML = '<div class="tab-entry no-tabs">No saved notes</div>';
            }
        }
        // Remove from cached data if needed (though handled in initTabs fetch)
    }
}

// Function to create a checklist item
function createChecklistItem(selection) {
    if (!selection) {
        selection = window.getSelection();
        if (!selection.rangeCount) return; // No selection
    }
    
    // Get current range to determine cursor position
    const range = selection.getRangeAt(0);
    
    // Check if we're already inside a checklist item
    const existingChecklist = getAncestorWithClass(range.startContainer, 'checklist-item');
    if (existingChecklist) {
        // We're already in a checklist, don't nest another one
        return;
    }
    
    // Create a checklist wrapper
    const checklistItem = document.createElement('div');
    checklistItem.className = 'checklist-item';
    
    // Create the checkbox
    const checkbox = document.createElement('span');
    checkbox.className = 'checkbox unchecked';
    checkbox.innerHTML = '⬜'; // Use emoji immediately
    checkbox.contentEditable = false; // Make checkbox itself not editable
    
    // Add click handler to toggle checkbox
    checkbox.addEventListener('click', handleCheckboxClick);
    
    // Create the editable content area after the checkbox
    const content = document.createElement('span');
    content.className = 'checklist-content';
    content.contentEditable = true; // Make this part editable
    
    // Add the elements to the checklist item
    checklistItem.appendChild(checkbox);
    checklistItem.appendChild(content);
    
    // Handle case where text is selected
    if (!selection.isCollapsed) {
        // Get the selected text and put it in the content
        content.textContent = selection.toString();
        
        // Delete the selected text before inserting the checklist
        document.execCommand('delete');
    }
    
    // Insert at cursor position
    const editableParent = isInsideEditable(range.startContainer);
    if (editableParent) {
        // Insert the new checklist item
        range.deleteContents(); // Remove the trigger text ('[] ')
        range.insertNode(checklistItem);
        
        // Focus on the content span (needs a delay to work after insertHTML)
        setTimeout(() => {
            const newContent = checklistItem.querySelector('.checklist-content');
            if (newContent) {
                // Set cursor to the end of the content
                const newRange = document.createRange();

                // If content is empty, place cursor at start
                if (newContent.childNodes.length === 0) {
                    newRange.setStart(newContent, 0);
                } else {
                    // Otherwise place cursor at end
                    const lastNode = newContent.lastChild;
                    if (lastNode.nodeType === Node.TEXT_NODE) {
                        newRange.setStart(lastNode, lastNode.textContent.length);
                    } else {
                        newRange.setStartAfter(lastNode);
                    }
                }

                newRange.collapse(true);

                // Apply the range to the selection
                selection.removeAllRanges();
                selection.addRange(newRange);
                newContent.focus();
            }
        }, 10); // Reduced delay
        
        // Trigger save after creating checklist
        for (let i = 0; i < contentEditableElements.length; i++) {
            if (contentEditableElements[i] === editableParent) {
                if (currentTabInstanceData && currentTabInstanceData.notes && currentTabInstanceData.notes[i]) {
                    setTimeout(() => { // Delay save to ensure HTML is fully updated
                        currentTabInstanceData.notes[i].content = editableParent.innerHTML;
                        currentTabInstanceData.notes[i].metadata.lastModified = new Date().toISOString();
                        currentTabInstanceData.notes[i].metadata.modified = new Date().toISOString();
                        hasContentChangedSinceLoad = true; // Mark change
                        debouncedSave();
                    }, 50);
                }
                break;
            }
        }
    }
}

// Helper to find ancestor with specific class
function getAncestorWithClass(node, className) {
    while (node && node !== document.body) {
        if (node.classList && node.classList.contains(className)) {
            return node;
        }
        node = node.parentNode;
    }
    return null;
}

// Check if an element is empty (no text content)
function isElementEmpty(element) {
    return element.textContent.trim() === '';
}

// Check if selection range is at the start of a node
function isAtStartOfNode(range) {
    return range.startOffset === 0;
}

// --- Implicit Title Logic ---
function applyImplicitTitle(editorElement) {
    if (!editorElement) return;

    // Find the first non-empty child node
    let firstMeaningfulChild = null;
    for (let i = 0; i < editorElement.childNodes.length; i++) {
        const node = editorElement.childNodes[i];
        // Consider element nodes or non-empty text nodes
        if ((node.nodeType === Node.ELEMENT_NODE && node.textContent.trim() !== '') ||
            (node.nodeType === Node.TEXT_NODE && node.textContent.trim() !== '')) {
            // If it's a text node, wrap it in a span to apply the class
            if (node.nodeType === Node.TEXT_NODE) {
                const wrapper = document.createElement('span');
                // Insert the wrapper before the text node
                editorElement.insertBefore(wrapper, node);
                // Move the text node inside the wrapper
                wrapper.appendChild(node);
                firstMeaningfulChild = wrapper;
            } else {
                firstMeaningfulChild = node; // It's already an element
            }
            break;
        }
    }

    const previousTitleNode = titleNodeMap.get(editorElement);

    // Remove class from previous title node if it's different
    if (previousTitleNode && previousTitleNode !== firstMeaningfulChild && previousTitleNode.classList) {
        previousTitleNode.classList.remove('implicit-title');
    }

    // Add class to the new title node if it exists and is not the same as previous
    if (firstMeaningfulChild && firstMeaningfulChild !== previousTitleNode && firstMeaningfulChild.classList) {
        firstMeaningfulChild.classList.add('implicit-title');
        titleNodeMap.set(editorElement, firstMeaningfulChild); // Update map
    } else if (!firstMeaningfulChild && previousTitleNode) {
        // If no meaningful child found, remove class from old title and clear map entry
        previousTitleNode.classList.remove('implicit-title');
        titleNodeMap.delete(editorElement);
    } else if (firstMeaningfulChild === previousTitleNode) {
        // Ensure the class is still present if the node hasn't changed
        if(firstMeaningfulChild.classList && !firstMeaningfulChild.classList.contains('implicit-title')) {
             firstMeaningfulChild.classList.add('implicit-title');
        }
    } else if (firstMeaningfulChild && !previousTitleNode) {
         // First time setting a title for this editor
         if(firstMeaningfulChild.classList) {
            firstMeaningfulChild.classList.add('implicit-title');
            titleNodeMap.set(editorElement, firstMeaningfulChild);
         }
    }
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
    setupStatusBarHover,
    startAutoSave,
    // Expose update/remove functions for external calls (from IPC listeners)
    updateTabsDropdownName,
    removeTabFromDropdown
};