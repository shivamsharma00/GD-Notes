// formatting.js

// Import utilities and constants
import {
    debounce,
    getContrastColor,
    isInsideEditable,
    getFirstWords,
    getAncestorByTagName,
    getAncestorWithClass,
    isElementEmpty,
    getBlockAncestor,
    convertToParagraph,
    initContentStyles as utilInitContentStyles, // Rename to avoid conflict
    ensureListClasses,
    isAtStartOfNode,
    getAncestorWithFormattingClass,
    COLOR_THEMES,
    AUTOSAVE_INTERVAL_MS,
    SAVE_INDICATOR_DURATION_MS,
    MAX_TAB_NAME_LENGTH, // Import if needed for tab naming logic here
    TAB_NAME_WORDS // Import if needed for tab naming logic here
} from './utils.js';

let autoSaveInterval = null; // Keep internal timer state
let SAVE_DEBOUNCE_DELAY = 500; // milliseconds to wait before saving
export function applySettings(settings, bodyElement = document.body, themeToggleElement, themeIconElement) {
    if (!settings) return;
    
    // Apply font family and size settings to document root for use by note content
    document.documentElement.style.setProperty('--font-family', settings.defaultFontFamily || "'JetBrains Mono', monospace");
    document.documentElement.style.setProperty('--font-size', settings.defaultFontSize || "16px");
    
    // Apply directly to any existing note content areas
    document.querySelectorAll('.note-content-area').forEach(box => {
        box.style.fontFamily = settings.defaultFontFamily || "'JetBrains Mono', monospace";
        box.style.fontSize = settings.defaultFontSize || "16px";
    });
    
    // Pass necessary elements to applyDarkMode
    applyDarkMode(settings.theme === 'dark', bodyElement, themeToggleElement, themeIconElement, null, null, false); // Don't save settings change here
}

// Modified to accept elements and state
export function applyDarkMode(isDark, bodyElement, themeToggleElement, themeIconElement, currentTabData, colorThemeFunc, shouldSave = true) {
    if (!bodyElement) bodyElement = document.body; // Default to document.body
    const bodyClassList = bodyElement.classList;
    const needsUpdate = isDark !== bodyClassList.contains('dark-mode');

    if (needsUpdate) {
        if (isDark) {
            bodyClassList.add('dark-mode');
            if (themeIconElement) themeIconElement.src = 'assets/light-mode.png';
            if (themeToggleElement) themeToggleElement.checked = true;
            
            // Don't force specific colors, these will be handled by the CSS or colorThemeFunc
            // document.documentElement.style.setProperty('--text-box-bg', '#080d14');
            // document.documentElement.style.setProperty('--text-box-color', '#f0f0f0');
        } else {
            bodyClassList.remove('dark-mode');
            if (themeIconElement) themeIconElement.src = 'assets/dark-mode.png';
            if (themeToggleElement) themeToggleElement.checked = false;
            
            // Don't force specific colors, these will be handled by the CSS or colorThemeFunc
            // document.documentElement.style.setProperty('--text-box-bg', '#ffffff');
            // document.documentElement.style.setProperty('--text-box-color', '#000000');
        }

        // Update any colored text based on theme
        document.querySelectorAll('.note-content-area').forEach(box => {
            updateColoredText(box, isDark);
        });

        // Update the current tab's data if provided
        if (currentTabData?.appearance) {
            currentTabData.appearance.isDarkMode = isDark;
            
            // Ensure font settings are maintained and applied (only to note content areas)
            const fontFamily = currentTabData.appearance.fontFamily;
            const fontSize = currentTabData.appearance.fontSize;
            
            if (fontFamily) {
                document.documentElement.style.setProperty('--font-family', fontFamily);
                // Apply directly to content areas only
                document.querySelectorAll('.note-content-area').forEach(box => {
                    box.style.fontFamily = fontFamily;
                });
            }
            
            if (fontSize) {
                document.documentElement.style.setProperty('--font-size', fontSize);
                // Apply directly to content areas only
                document.querySelectorAll('.note-content-area').forEach(box => {
                    box.style.fontSize = fontSize;
                });
            }
            
            // Re-apply color theme based on new mode, if function provided
            if (currentTabData.appearance.colorTheme && typeof colorThemeFunc === 'function') {
                 colorThemeFunc( // Call the passed function
                     currentTabData.appearance.colorTheme,
                     currentTabData.appearance.colorLevel !== undefined ? currentTabData.appearance.colorLevel : 1,
                     isDark,
                     currentTabData, // Pass necessary state/elements
                     document.querySelectorAll('.note-content-area'), // Pass content elements
                     null, // colorThemeButton
                     null, // colorIntensityButton
                     false // Don't save again immediately
                 );
            }
            if (shouldSave) {
                markContentChanged(currentTabData); // Mark change
                // saveCurrentTabContent(currentTabData, false); // Cannot call directly
            }
        }
    }
}

// Helper function to update text colored with foreColor
function updateColoredText(element, isDark) {
    // Find all colored text elements (font tags and spans with color)
    const coloredElements = element.querySelectorAll('font[color], span[style*="color"]');
    
    // Define contrast colors based on theme
    const lightTextColor = '#f0f0f0'; // for dark mode
    const darkTextColor = '#000000';  // for light mode
    
    coloredElements.forEach(el => {
        let currentColor = '';
        
        // Get the current color
        if (el.tagName === 'FONT' && el.hasAttribute('color')) {
            currentColor = el.getAttribute('color');
        } else if (el.style && el.style.color) {
            currentColor = el.style.color;
        }
        
        // Skip if we can't determine the color or if it's already appropriate for the theme
        if (!currentColor) return;
        
        // If we're in dark mode but the text is dark, make it light
        if (isDark && isColorDark(currentColor)) {
            if (el.tagName === 'FONT') {
                el.setAttribute('color', lightTextColor);
            } else {
                el.style.color = lightTextColor;
            }
        } 
        // If we're in light mode but the text is light, make it dark
        else if (!isDark && isColorLight(currentColor)) {
            if (el.tagName === 'FONT') {
                el.setAttribute('color', darkTextColor);
            } else {
                el.style.color = darkTextColor;
            }
        }
    });
}

// Helper to determine if a color is dark
function isColorDark(color) {
    // Convert color to RGB if it's in hex or named format
    let r, g, b;
    
    if (color.startsWith('#')) {
        // Hex format
        if (color.length === 4) { // #RGB format
            r = parseInt(color[1] + color[1], 16);
            g = parseInt(color[2] + color[2], 16);
            b = parseInt(color[3] + color[3], 16);
        } else { // #RRGGBB format
            r = parseInt(color.slice(1, 3), 16);
            g = parseInt(color.slice(3, 5), 16);
            b = parseInt(color.slice(5, 7), 16);
        }
    } else if (color.startsWith('rgb')) {
        // RGB format
        const match = color.match(/(\d+)\s*,\s*(\d+)\s*,\s*(\d+)/);
        if (match) {
            r = parseInt(match[1]);
            g = parseInt(match[2]);
            b = parseInt(match[3]);
        }
    } else {
        // Named color or other format - assume it's not dark
        return false;
    }
    
    // Calculate luminance - dark colors have low luminance
    const luminance = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
    return luminance < 0.5;
}

// Helper to determine if a color is light
function isColorLight(color) {
    // Same implementation as isColorDark but return opposite result
    return !isColorDark(color);
}

// Modified to accept elements and state
export function applyColorTheme(
    themeName,
    level = 1,
    isDark = false,
    currentTabData,
    contentEditableElements, // Needs the elements to apply styles
    colorThemeButton, // Needs UI elements to update
    colorIntensityButton, // Needs UI elements to update
    shouldSave = true
) {
    if (!COLOR_THEMES[themeName]) {
        themeName = 'default';
    }
    if (!contentEditableElements) {
        contentEditableElements = document.querySelectorAll('.note-content-area');
    }
    if (NodeList.prototype.isPrototypeOf(contentEditableElements)) {
        contentEditableElements = Array.from(contentEditableElements);
    }

    const isRainbowMode = level === -1 && contentEditableElements.length === 4;
    const colors = isDark ? COLOR_THEMES[themeName].dark : COLOR_THEMES[themeName].light;
    const colorIndex = Math.min(Math.max(0, level), colors.length - 1); // Clamp between 0 and available levels

    // Preserve font properties from appearance
    const fontFamily = currentTabData?.appearance?.fontFamily;
    const fontSize = currentTabData?.appearance?.fontSize;
    
    if (isRainbowMode) {
        for (let i = 0; i < 4; i++) {
            const box = contentEditableElements[i];
            if (!box) continue;
            const rainbowIndex = i % colors.length;
            const bgColor = colors[rainbowIndex];
            const textColor = getContrastColor(bgColor);
            box.style.backgroundColor = bgColor;
            box.style.color = textColor;
            box.dataset.backgroundColor = bgColor;
            box.dataset.textColor = textColor;
            
            // Preserve font settings
            if (fontFamily) box.style.fontFamily = fontFamily;
            if (fontSize) box.style.fontSize = fontSize;
        }
        // Set CSS variables to the first intensity level for consistency elsewhere
        document.documentElement.style.setProperty('--text-box-bg', colors[0]);
        document.documentElement.style.setProperty('--text-box-color', getContrastColor(colors[0]));
    } else {
        const bgColor = colors[colorIndex];
        const textColor = getContrastColor(bgColor);
        document.documentElement.style.setProperty('--text-box-bg', bgColor);
        document.documentElement.style.setProperty('--text-box-color', textColor);

        contentEditableElements.forEach(box => {
            if (!box) return;
            box.style.backgroundColor = bgColor;
            box.style.color = textColor;
            box.dataset.backgroundColor = bgColor;
            box.dataset.textColor = textColor;
            
            // Preserve font settings
            if (fontFamily) box.style.fontFamily = fontFamily;
            if (fontSize) box.style.fontSize = fontSize;
            
            // Force refresh child elements
            const allElements = box.querySelectorAll('*:not(.format-title):not(.format-subtitle):not(.format-bold-large)');
            allElements.forEach(el => {
                el.style.fontFamily = 'inherit';
                el.style.fontSize = 'inherit';
            });
        });
    }

    // Update current tab data
    if (currentTabData?.appearance) {
        const appearance = currentTabData.appearance;
        appearance.colorTheme = themeName;
        appearance.colorLevel = level;
        
        // Save font settings if they exist
        if (fontFamily) appearance.fontFamily = fontFamily;
        if (fontSize) appearance.fontSize = fontSize;
        
        if (!isRainbowMode) {
             appearance.backgroundColor = document.documentElement.style.getPropertyValue('--text-box-bg');
             appearance.textColor = document.documentElement.style.getPropertyValue('--text-box-color');
        }
        if (shouldSave) {
            markContentChanged(currentTabData);
            // saveCurrentTabContent(currentTabData, false); // Trigger save externally
        }
    }

    // Update UI elements if provided
    if (colorThemeButton) {
        const valueElement = colorThemeButton.querySelector('.settings-option-value');
        if (valueElement) valueElement.textContent = themeName.charAt(0).toUpperCase() + themeName.slice(1);
    }
    if (colorIntensityButton) {
        const valueElement = colorIntensityButton.querySelector('.settings-option-value');
        if (valueElement) valueElement.textContent = level === -1 ? "Rainbow" : `Level ${level + 1}`;
    }
    document.querySelectorAll('.color-level-btn').forEach(btn => {
        btn.classList.toggle('active', parseInt(btn.dataset.level) === level);
    });
}

// Modified to accept elements and state
export function applyTabAppearance(appearance, contentEditableElements, bodyElement, themeToggleElement, themeIconElement) {
    if (!appearance) return;
    if (!contentEditableElements) contentEditableElements = [];

    // Apply dark mode first
    applyDarkMode(appearance.isDarkMode, bodyElement, themeToggleElement, themeIconElement, null, null, false); // Pass elements, don't save

    // Apply font family and size to document root for consistent inheritance
    if (appearance.fontFamily) {
        document.documentElement.style.setProperty('--font-family', appearance.fontFamily);
    }
    
    if (appearance.fontSize) {
        document.documentElement.style.setProperty('--font-size', appearance.fontSize);
    }

    // Apply font family and size to individual note content elements
    contentEditableElements.forEach(box => {
        if (!box) return;
        if (!box.classList.contains('note-content-area')) return; // Only apply to note content areas
        
        // Apply styles directly to the boxes as well for immediate effect
        box.style.fontFamily = appearance.fontFamily || getComputedStyle(document.documentElement).getPropertyValue('--font-family');
        box.style.fontSize = appearance.fontSize || getComputedStyle(document.documentElement).getPropertyValue('--font-size');
        
        // Force refresh of child elements
        const allElements = box.querySelectorAll('*:not(.format-title):not(.format-subtitle):not(.format-bold-large)');
        allElements.forEach(el => {
            el.style.fontFamily = 'inherit';
            el.style.fontSize = 'inherit';
        });
    });

    // Apply color theme or specific colors
    const applyThemeFunc = (theme, level, isDark, tabData, elements, btn1, btn2, save) => {
        // Wrapper to call applyColorTheme correctly within this context
        applyColorTheme(theme, level, isDark, tabData, contentEditableElements, null, null, save);
    };

    if (appearance.colorTheme) {
        applyColorTheme(
            appearance.colorTheme,
            appearance.colorLevel !== undefined ? appearance.colorLevel : 1,
            appearance.isDarkMode,
            { appearance }, // Pass a mock tabData containing appearance
            contentEditableElements,
            null, // No UI buttons to update here
            null, // No UI buttons to update here
            false // Don't save, just applying loaded appearance
        );
    } else if (appearance.backgroundColor) {
        const bgColor = appearance.backgroundColor;
        const textColor = appearance.textColor || getContrastColor(bgColor);
        document.documentElement.style.setProperty('--text-box-bg', bgColor);
        document.documentElement.style.setProperty('--text-box-color', textColor);
        contentEditableElements.forEach(box => {
            if (!box) return;
            if (!box.classList.contains('note-content-area')) return; // Only apply to note content areas
            
            box.style.backgroundColor = bgColor;
            box.style.color = textColor;
            box.dataset.backgroundColor = bgColor;
            box.dataset.textColor = textColor;
        });
    } else {
        // Fallback
        applyColorTheme('default', 1, appearance.isDarkMode, { appearance }, contentEditableElements, null, null, false);
    }
}


// Modified to accept elements and state
export function updateSettingsUI(
    globalSettings = {},
    tabAppearance = {},
    fontButton, // Pass in UI elements
    fontSizeButton,
    colorThemeButton,
    colorIntensityButton
) {
    const currentFont = tabAppearance.fontFamily || globalSettings.defaultFontFamily || getComputedStyle(document.documentElement).getPropertyValue('--font-family');
    const currentSize = tabAppearance.fontSize || globalSettings.defaultFontSize || getComputedStyle(document.documentElement).getPropertyValue('--font-size');
    const currentTheme = tabAppearance.colorTheme || 'default';
    const currentLevel = (tabAppearance.colorLevel !== undefined ? tabAppearance.colorLevel : 1);

    if (fontButton) {
        const fontName = currentFont.split(',')[0].replace(/['"]/g, '').trim();
        const valueElement = fontButton.querySelector('.settings-option-value');
        if (valueElement) valueElement.textContent = fontName;
    }
    if (fontSizeButton) {
        const valueElement = fontSizeButton.querySelector('.settings-option-value');
         if (valueElement) valueElement.textContent = currentSize.trim();
    }
    if (colorThemeButton) {
        const valueElement = colorThemeButton.querySelector('.settings-option-value');
         if (valueElement) valueElement.textContent = currentTheme.charAt(0).toUpperCase() + currentTheme.slice(1);
    }
    if (colorIntensityButton) {
         const valueElement = colorIntensityButton.querySelector('.settings-option-value');
         if (valueElement) valueElement.textContent = currentLevel === -1 ? "Rainbow" : `Level ${currentLevel + 1}`;
        document.querySelectorAll('.color-level-btn').forEach(btn => {
            btn.classList.toggle('active', parseInt(btn.dataset.level) === currentLevel);
        });
    }
}


export function setupContentEditableListeners(box, index, context) {
    // Attach actual checkbox listener here
    box.querySelectorAll('.checkbox').forEach(checkbox => {
         // Ensure listener isn't added multiple times
        if (!checkbox.dataset.hasClickListener) {
            checkbox.addEventListener('click', (e) => handleCheckboxClick(e, context)); // Pass context
            checkbox.dataset.hasClickListener = 'true';
        }
    });

    box.addEventListener('keydown', (e) => handleKeyDown(e, box, index, context));
    box.addEventListener('input', (e) => handleInput(e, box, index, context));
    box.addEventListener('paste', (e) => handlePaste(e, box, index, context));
    box.addEventListener('blur', () => {
        // Force save immediately on blur if changes were made
        if (context.hasContentChangedSinceLoad) {
            // Need a way to force-save, bypassing debounce
            saveCurrentTabContent(context.currentTabData, context.titleNodeMap, true); // Force save
        }
    });
}


// Modified to accept context and event
function handleKeyDown(event, box, index, context) {
    const selection = window.getSelection();
    if (!selection || selection.rangeCount === 0) return;
    const range = selection.getRangeAt(0);

    if (event.key === 'Enter') {
        if (handleEnterKey(event, range, selection, box, context)) {
             // Handled
        }
    } else if (event.key === 'Backspace') {
        if (handleBackspaceKey(event, range, selection, box, context)) {
             // Handled
        }
    } else if (event.key === 'Tab') {
        if (handleTabKey(event, range, selection, box, context)) {
            event.preventDefault();
        }
    } else if (event.key === ' ') {
        handleSpaceKeyFormatting(range, selection, box, context, event);
    }
}

// Modified to accept context
function handleEnterKey(event, range, selection, box, context) {
    const block = getBlockAncestor(range.startContainer);
    const isAtStart = isAtStartOfNode(range);

    // 1. Handle Enter on EMPTY Checklist Item
    const checklistContent = getAncestorWithClass(range.startContainer, 'checklist-content');
    if (checklistContent) {
        const checklistItem = checklistContent.closest('.checklist-item');
        if (checklistItem && isElementEmpty(checklistContent) && isAtStart) {
            event.preventDefault();
            convertToParagraph(checklistItem);
            markContentChangedAndSave(box, context);
            return true;
        }
        event.preventDefault();
        insertNewChecklistItem(checklistItem, context);
        markContentChangedAndSave(box, context);
        return true;
    }

    // 2. Handle Enter on EMPTY List Item (UL/OL)
    const listItem = getAncestorByTagName(range.startContainer, 'LI');
    if (listItem && isElementEmpty(listItem) && isAtStart) {
        event.preventDefault();
        document.execCommand('outdent', false, null);
        const stillListItem = getAncestorByTagName(selection.anchorNode, 'LI');
        if (stillListItem === listItem) {
            convertToParagraph(listItem);
        }
        markContentChangedAndSave(box, context);
        return true;
    }

    // 3. Handle Enter on EMPTY Custom Formatted Block
    const formattedBlock = getAncestorWithFormattingClass(range.startContainer);
    if (formattedBlock && isElementEmpty(formattedBlock) && isAtStart && ['P', 'DIV', 'H1', 'H2', 'H3'].includes(formattedBlock.tagName)) {
        event.preventDefault();
        formattedBlock.classList.remove('format-title', 'format-subtitle', 'format-bold-large', 'implicit-title');
        range.selectNodeContents(formattedBlock);
        range.collapse(true);
        selection.removeAllRanges();
        selection.addRange(range);
        markContentChangedAndSave(box, context);
        return true;
    }

     // 4. Handle Enter WITHIN a Custom Formatted Block
    if (formattedBlock && ['P', 'DIV', 'H1', 'H2', 'H3'].includes(formattedBlock.tagName)) {
        setTimeout(() => {
            const currentSelection = window.getSelection();
            if (currentSelection && currentSelection.rangeCount > 0) {
                const currentRange = currentSelection.getRangeAt(0);
                const newBlock = getBlockAncestor(currentRange.startContainer);
                if (newBlock) {
                    const newlyFormatted = getAncestorWithFormattingClass(newBlock);
                    if (newlyFormatted === newBlock) {
                        newBlock.classList.remove('format-title', 'format-subtitle', 'format-bold-large');
                        markContentChangedAndSave(box, context);
                    }
                }
                // applyImplicitTitle(box, context.titleNodeMap); // Pass map
            }
        }, 0);
        return false;
    }
    return false;
}

// Modified to accept context
function handleBackspaceKey(event, range, selection, box, context) {
    const block = getBlockAncestor(range.startContainer);
    const isAtStart = isAtStartOfNode(range);

    // 1. Handle Backspace at the START of a Checklist Item
    const checklistContent = getAncestorWithClass(range.startContainer, 'checklist-content');
    if (checklistContent && isAtStart) {
        event.preventDefault();
        const checklistItem = checklistContent.closest('.checklist-item');
        convertToParagraph(checklistItem);
        markContentChangedAndSave(box, context);
        return true;
    }

    // 2. Handle Backspace at the START of a Custom Formatted Block
    const formattedBlock = getAncestorWithFormattingClass(range.startContainer);
    if (formattedBlock && isAtStart && ['P', 'DIV', 'H1', 'H2', 'H3'].includes(formattedBlock.tagName)) {
        event.preventDefault();
        formattedBlock.classList.remove('format-title', 'format-subtitle', 'format-bold-large', 'implicit-title');
        range.selectNodeContents(formattedBlock);
        range.collapse(true);
        selection.removeAllRanges();
        selection.addRange(range);
        markContentChangedAndSave(box, context);
        return true;
    }
    return false;
}

// Modified to accept context
function handleTabKey(event, range, selection, box, context) {
    const listItem = getAncestorByTagName(range.startContainer, 'LI');
    if (listItem) {
        event.preventDefault();
        document.execCommand(event.shiftKey ? 'outdent' : 'indent', false, null);
        markContentChangedAndSave(box, context);
         return true;
    }
     return false;
}

// Modified to accept context
function handleSpaceKeyFormatting(range, selection, box, context) {
    if (!range.collapsed) return;

    const node = range.startContainer;
    const offset = range.startOffset;

    if (node.nodeType === Node.TEXT_NODE && offset > 0) {
        const block = getBlockAncestor(node);
        if (!block) return;

        // Get all text up to the current cursor position
        const textBeforeCursor = node.textContent.substring(0, offset);
        
        // Look for shortcut pattern at the end of the text
        const patterns = [
            { pattern: '*', length: 1, action: () => { document.execCommand('insertUnorderedList', false, null); ensureListClasses(box); } },
            { pattern: '->', length: 2, action: () => {
                document.execCommand('insertUnorderedList', false, null);
                const ul = getAncestorByTagName(selection.anchorNode, 'UL');
                if (ul) { ul.className = 'arrow'; }
            }},
            { pattern: '-', length: 1, action: () => applyFormatClass('format-bold-large', context) },
            { pattern: '--', length: 2, action: () => applyFormatClass('format-title', context) },
            { pattern: '==', length: 2, action: () => applyFormatClass('format-subtitle', context) },
            { pattern: '1.', length: 2, action: () => document.execCommand('insertOrderedList', false, null) },
            { pattern: '[]', length: 2, action: () => createChecklistItem(selection, context) },
            { pattern: '[ ]', length: 3, action: () => createChecklistItem(selection, context) }
        ];

        // Look for a match at start of text or after whitespace
        for (const {pattern, length, action} of patterns) {
            // Check if pattern is at the beginning of text or after a space
            if (textBeforeCursor === pattern ||
                textBeforeCursor.endsWith(' ' + pattern)) {
                
                // Create a range to delete the shortcut text
                const deleteRange = document.createRange();
                try {
                    // If at start of node, delete just the pattern
                    if (textBeforeCursor === pattern) {
                        deleteRange.setStart(node, 0);
                        deleteRange.setEnd(node, length);
                    } 
                    // Otherwise delete pattern plus a space (the space before the pattern)
                    else if (textBeforeCursor.endsWith(' ' + pattern)) {
                        deleteRange.setStart(node, offset - length - 1);
                        deleteRange.setEnd(node, offset);
                    }
                    
                    // Store the parent element we'll need to focus after the action
                    const focusTarget = isInsideEditable(node);
                    
                    selection.removeAllRanges();
                    selection.addRange(deleteRange);
                    document.execCommand('delete', false, null);
                    selection.collapseToEnd();
                    
                    // Execute the formatting action
                    action();
                    
                    // Ensure focus is preserved
                    if (focusTarget) {
                        setTimeout(() => {
                            focusTarget.focus();
                            markContentChangedAndSave(box, context);
                        }, 0);
                    } else {
                        markContentChangedAndSave(box, context);
                    }
                    
                    // Prevent the space character from being inserted
                    event.preventDefault();
                    break; // Only apply one shortcut if multiple match
                } catch (error) {
                    console.error("Error processing shortcut:", error);
                    selection.removeAllRanges();
                    selection.addRange(range);
                }
            }
        }
    }
}

// Modified to accept context
function handleInput(event, box, index, context) {
    if (!context.currentTabData?.notes) return;

    if (!context.currentTabData.notes[index]) {
        context.currentTabData.notes[index] = {
             id: `note-${index + 1}`,
            content: "",
            metadata: { created: new Date().toISOString(), lastModified: new Date().toISOString() }
        };
    }

    // --- Update Internal State ---
    // No need to update context.hasContentChangedSinceLoad here, done in markContentChangedAndSave
    context.currentTabData.notes[index].content = box.innerHTML;
    context.currentTabData.notes[index].metadata.lastModified = new Date().toISOString();


    // --- Dynamic Features on Input ---
    // FEATURE: Hide slash commands if user continues typing normally
    // Need slashCommandPopup from context
    const slashCommandPopup = context.slashCommandPopup;
    if (slashCommandPopup && !slashCommandPopup.classList.contains('hidden')) {
        if(event.inputType !== 'deleteContentBackward') {
             hideSlashCommandPopup(); // Needs implementation in goodUI.js
        }
    }

    detectAndLinkURLs(box, context); // Pass context
    // applyImplicitTitle(box, context.titleNodeMap); // Pass map
    ensureListClasses(box);
    utilInitContentStyles(box); // Ensure checkbox styling applied correctly

    // Dynamic Tab Naming (needs getFirstWords, TAB_NAME_WORDS, MAX_TAB_NAME_LENGTH)
    if (index === 0 && context.currentTabData) {
        const newName = getFirstWords(box.innerHTML, TAB_NAME_WORDS);
        if (context.currentTabData.name !== newName) {
             context.currentTabData.name = newName;
             // Update UI (e.g., dropdown) needs to happen externally in goodUI.js
            //  window.electronAPI.updateTabNameInMain(context.currentTabData.id, newName); // Example IPC call
             // Maybe update title bar as well?
             // window.electronAPI.setWindowTitle(newName || "GD Notes");
        }
    }


    // Mark change and trigger debounced save
    markContentChangedAndSave(box, context);
}

// Modified to accept context
function handlePaste(event, box, index, context) {
    event.preventDefault();
    const text = event.clipboardData?.getData('text/plain') || '';
    if (text) {
        document.execCommand('insertText', false, text);
        detectAndLinkURLs(box, context);
        // applyImplicitTitle(box, context.titleNodeMap);
        ensureListClasses(box);
        utilInitContentStyles(box);
        markContentChangedAndSave(box, context);
    }
}

// --- State Change and Saving ---

// Mark content as changed (pass tabData to update flag)
export function markContentChanged(currentTabData) {
    if (currentTabData && !currentTabData.hasChanged) {
         currentTabData.hasChanged = true; // Use a flag on the tab data itself
    }
    // Note: hasContentChangedSinceLoad (global flag) might still be useful
    // depending on how saving logic is structured externally.
}


// Combined function for marking change and triggering save
// Pass context: { currentTabData, saveHandler }
function markContentChangedAndSave(boxElement, context) {
    markContentChanged(context.currentTabData); // Mark the tab data as changed

    // Update the corresponding note content in the instance data
    if (context.currentTabData && context.currentTabData.notes) {
        // Need to find index based on boxElement relative to context.contentEditableElements
        const index = context.contentEditableElements.indexOf(boxElement);
        if (index !== -1 && context.currentTabData.notes[index]) {
            context.currentTabData.notes[index].content = boxElement.innerHTML;
            context.currentTabData.notes[index].metadata.lastModified = new Date().toISOString();
        } else {
            console.warn("Could not find index for boxElement in markContentChangedAndSave");
        }
    }

    // Trigger the debounced save handler passed in the context
    if (typeof context.saveHandler === 'function') {
        context.saveHandler();
    } else {
        console.warn("Save handler not found in context for markContentChangedAndSave");
    }
}

// Debounced save function - defined here as it uses saveCurrentTabContent
// This needs access to the *current* state when it executes.
export const debouncedSave = debounce((context) => {
     // Pass the latest context when the debounced function actually runs
    saveCurrentTabContent(context.currentTabData, context.titleNodeMap, false);
}, SAVE_DEBOUNCE_DELAY); // Use constant from utils

// --- Checkbox Handling ---

// Modified to accept context
export function handleCheckboxClick(event, context) {
    event.preventDefault();
    event.stopPropagation();

    const checkbox = event.currentTarget;
    const parentItem = checkbox.closest('.checklist-item');
    if (!parentItem) return;

    const isChecked = checkbox.classList.toggle('checked');
    checkbox.classList.toggle('unchecked', !isChecked);
    checkbox.innerHTML = isChecked ? '✅' : '⬜';

    const content = parentItem.querySelector('.checklist-content');
    if (content) {
        content.classList.toggle('checked', isChecked);
    }

    const editableParent = isInsideEditable(parentItem);
    if (editableParent) {
        markContentChangedAndSave(editableParent, context); // Pass context
    }
}


// Modified to accept context
export function createChecklistItem(selection, context) {
    if (!selection) selection = window.getSelection();
    if (!selection.rangeCount) return;

    const range = selection.getRangeAt(0);
    const editableParent = isInsideEditable(range.startContainer);
    if (!editableParent) return;

    if (getAncestorWithClass(range.startContainer, 'checklist-item')) return;

    const checklistItem = document.createElement('div');
    checklistItem.className = 'checklist-item';

    const checkbox = document.createElement('span');
    checkbox.className = 'checkbox unchecked';
    checkbox.innerHTML = '⬜';
    checkbox.contentEditable = false;
    // Add listener using the context
    checkbox.addEventListener('click', (e) => handleCheckboxClick(e, context));
    checkbox.dataset.hasClickListener = 'true';

    const content = document.createElement('span');
    content.className = 'checklist-content';
    content.contentEditable = true;

    checklistItem.appendChild(checkbox);
    checklistItem.appendChild(content);

    if (!selection.isCollapsed) {
        content.appendChild(range.extractContents());
        range.insertNode(checklistItem);
    } else {
         range.insertNode(checklistItem);
         content.innerHTML = '<br>';
    }

     setTimeout(() => {
         const focusRange = document.createRange();
         focusRange.selectNodeContents(content);
         focusRange.collapse(false);
         selection.removeAllRanges();
         selection.addRange(focusRange);
         content.focus();
     }, 10);

     markContentChangedAndSave(editableParent, context); // Pass context
}

// Modified to accept context
function insertNewChecklistItem(currentItem, context) {
    if (!currentItem || !currentItem.parentNode) return;

     const newItem = document.createElement('div');
     newItem.className = 'checklist-item';

     const checkbox = document.createElement('span');
     checkbox.className = 'checkbox unchecked';
     checkbox.innerHTML = '⬜';
     checkbox.contentEditable = false;
      // Add listener using the context
     checkbox.addEventListener('click', (e) => handleCheckboxClick(e, context));
     checkbox.dataset.hasClickListener = 'true';


     const content = document.createElement('span');
     content.className = 'checklist-content';
     content.contentEditable = true;
     content.innerHTML = '<br>';

     newItem.appendChild(checkbox);
     newItem.appendChild(content);

     currentItem.parentNode.insertBefore(newItem, currentItem.nextSibling);

     const selection = window.getSelection();
     setTimeout(() => {
          const range = document.createRange();
          range.setStart(content, 0);
          range.collapse(true);
          selection.removeAllRanges();
          selection.addRange(range);
          content.focus();
     }, 0);

     const editableParent = isInsideEditable(currentItem);
     if(editableParent) markContentChangedAndSave(editableParent, context); // Pass context
}

// Modified to accept context
function detectAndLinkURLs(element, context) {
    const walker = document.createTreeWalker(element, NodeFilter.SHOW_TEXT, null, false);
    let node;
    const textNodesToProcess = [];

    while (node = walker.nextNode()) {
        if (!getAncestorByTagName(node, 'A') && !getAncestorWithClass(node, 'checklist-item')) {
            textNodesToProcess.push(node);
        }
    }

    const urlRegex = /(\b(https?|ftp):\/\/[-A-Z0-9+&@#\/%?=~_|!:,.;]*[-A-Z0-9+&@#\/%=~_|])|(\bwww\.[-A-Z0-9+&@#\/%?=~_|!:,.;]*[-A-Z0-9+&@#\/%=~_|])/gi;

    let changed = false;
    textNodesToProcess.forEach(textNode => {
        const text = textNode.nodeValue;
        let match;
        let lastIndex = 0;
        const fragment = document.createDocumentFragment();

        while ((match = urlRegex.exec(text)) !== null) {
            const url = match[0];
            const index = match.index;

            if (index > lastIndex) {
                fragment.appendChild(document.createTextNode(text.substring(lastIndex, index)));
            }

            const link = document.createElement('a');
            let href = url;
            if (url.startsWith('www.') && !url.startsWith('http') && !url.startsWith('ftp')) {
                href = 'http://' + url;
            }
            link.href = href;
            link.textContent = url;
            link.setAttribute('target', '_blank');
            link.setAttribute('rel', 'noopener noreferrer');
            fragment.appendChild(link);

            lastIndex = index + url.length;
            changed = true;
        }

        if (changed && textNode.parentNode) {
             if (lastIndex < text.length) {
                 fragment.appendChild(document.createTextNode(text.substring(lastIndex)));
             }
             textNode.parentNode.replaceChild(fragment, textNode);
        }
    });

     if (changed) {
          const editableParent = isInsideEditable(element);
          if(editableParent) markContentChangedAndSave(editableParent, context); // Pass context
     }
}

// --- Saving Logic ---

// Modified to accept tab data and force flag
// Needs access to showSaveIndicator externally
// Needs access to titleNodeMap if implicit titles affect saving/display
export function saveCurrentTabContent(currentTabData, titleNodeMap, forceSave = false) {
    if (!currentTabData) return;

    // Check the change flag on the tab data
    if (!forceSave && !currentTabData.hasChanged) {
        // console.log(`Save skipped for ${currentTabData.id}: No changes`);
        return;
    }

    // Ensure content is up-to-date before saving (might be redundant if input handler is reliable)
    // This requires access to contentEditableElements, maybe pass them too? Or assume input handler updated it.
    // if (context.contentEditableElements) {
    //     context.contentEditableElements.forEach((box, index) => {
    //         if (currentTabData.notes[index]) {
    //             currentTabData.notes[index].content = box.innerHTML;
    //         }
    //     });
    // }


    // Apply implicit title status before saving if needed for display/metadata
    // Example: You might want to store if the first block IS the title
    // applyImplicitTitle( editorElement, titleNodeMap ); // Needs editor element

    // Clone data to avoid potential mutations during async operation? Optional.
    const dataToSave = JSON.parse(JSON.stringify(currentTabData));
    delete dataToSave.hasChanged; // Don't save the transient change flag

    window.electronAPI.addOrUpdateTab(dataToSave)
        .then(() => {
            if (currentTabData) { // Check if tab data still exists (window might have closed)
                currentTabData.hasChanged = false; // Reset flag ONLY after successful save
            }
            // Try to call showSaveIndicator directly if it exists
            try {
                if (typeof window.electronAPI.showSaveIndicator === 'function') {
                    window.electronAPI.showSaveIndicator();
                }
                // Otherwise, use the DOM directly (this is what's actually implemented in goodUI.js)
                const saveIndicator = document.getElementById('save-indicator');
                if (saveIndicator) {
                    saveIndicator.classList.add('visible');
                    setTimeout(() => {
                        saveIndicator.classList.remove('visible');
                    }, 800);
                }
            } catch (err) {
                console.error("Error showing save indicator:", err);
            }
        })
        .catch(err => console.error(`UI: Error saving tab content for ${currentTabData?.id}:`, err));
}

// --- AutoSave ---

// Modified setupAutoSave to accept context for save handler
export function setupAutoSave(context) {
    if (autoSaveInterval) clearInterval(autoSaveInterval);
    autoSaveInterval = setInterval(() => {
        // Save only if changes have occurred since last save
        // Check the flag on the actual tab data passed via context
        if (context.currentTabData?.hasChanged) {
            saveCurrentTabContent(context.currentTabData, context.titleNodeMap, false); // Pass necessary context
        }
    }, AUTOSAVE_INTERVAL_MS);
}

// Modified startAutoSave to accept context
export function startAutoSave(context) {
    setupAutoSave(context); // Pass context to setup

    // Add listener for saving before unload
    window.addEventListener('beforeunload', () => {
        // Force save any pending changes immediately before unload
        if (context.currentTabData?.hasChanged) {
            // Use synchronous IPC if possible/needed for critical saves
             console.log("Attempting synchronous save before unload for:", context.currentTabData.id);
             window.electronAPI.saveTabSynchronous(context.currentTabData); // Example of sync IPC
            // saveCurrentTabContent(context.currentTabData, context.titleNodeMap, true); // Async might not finish
        }
    });
}



// --- Floating Toolbar Logic ---

// Modified to accept toolbar element and context
export function showFormattingToolbar(formattingToolbar, context) {
    if (!formattingToolbar) return;
    const selection = window.getSelection();
    if (!selection || selection.isCollapsed || selection.rangeCount === 0) {
        hideFormattingToolbar(formattingToolbar);
        return;
    }

    const range = selection.getRangeAt(0);
    const editableParent = isInsideEditable(range.commonAncestorContainer);
    if (!editableParent) {
        hideFormattingToolbar(formattingToolbar);
        return;
    }

    const rect = range.getBoundingClientRect();
    if (!rect || rect.width === 0 || rect.height === 0) {
        hideFormattingToolbar(formattingToolbar);
        return;
    }

    const toolbarHeight = formattingToolbar.offsetHeight;
    const toolbarWidth = formattingToolbar.offsetWidth;
    let top = window.scrollY + rect.top - toolbarHeight - 8;
    let left = window.scrollX + rect.left + (rect.width / 2) - (toolbarWidth / 2);

    if (rect.top < toolbarHeight + 10) {
        top = window.scrollY + rect.bottom + 8;
    }

    const viewportWidth = document.documentElement.clientWidth;
    left = Math.max(window.scrollX + 5, Math.min(left, window.scrollX + viewportWidth - toolbarWidth - 5));

    formattingToolbar.style.top = `${top}px`;
    formattingToolbar.style.left = `${left}px`;
    formattingToolbar.classList.remove('hidden');
}

// Modified to accept toolbar element
export function hideFormattingToolbar(formattingToolbar) {
    if (formattingToolbar && !formattingToolbar.classList.contains('hidden')) {
        formattingToolbar.classList.add('hidden');
    }
}


// Modified to accept toolbar element and context
export function setupFormattingToolbarListeners(formattingToolbar, context) {
     if (!formattingToolbar) return;

    // Use event delegation on the toolbar itself for button clicks
    formattingToolbar.addEventListener('click', (e) => {
         const button = e.target.closest('button[data-command]');
         if (!button) return; // Click wasn't on a command button

            e.preventDefault();
        e.stopPropagation();
            const command = button.dataset.command;
        let value = button.dataset.value || null;

        const selection = window.getSelection(); // Get fresh selection
        if (!selection.rangeCount) return; // Need a selection to act upon
        const range = selection.getRangeAt(0);
        const targetBox = isInsideEditable(range.startContainer); // Find target box for context

        if (command === 'foreColor') {
                const isDarkMode = document.body.classList.contains('dark-mode');
                const currentThemeName = context.currentTabData?.appearance?.colorTheme || 'default';
                const currentLevel = context.currentTabData?.appearance?.colorLevel !== undefined ? 
                    context.currentTabData.appearance.colorLevel : 1;
                
                // Get colors from the COLOR_THEMES constant (make sure it's imported from utils.js)
                if (COLOR_THEMES[currentThemeName]) {
                    // Use the opposite theme's colors (dark when in light mode, light when in dark mode)
                    const colorIndex = Math.min(Math.max(0, currentLevel), 3);
                    if (isDarkMode) {
                        // In dark mode, use light theme color
                        value = COLOR_THEMES[currentThemeName].light[colorIndex];
                    } else {
                        // In light mode, use dark theme color
                        value = COLOR_THEMES[currentThemeName].dark[colorIndex];
                    }
                } else {
                    // Fallback to simple contrast if theme not found
                    value = isDarkMode ? '#FFFFFF' : '#000000';
                }
            } else if (command === 'createLink') {
                value = prompt('Enter link URL:');
                if (!value || value.trim() === '') return;
                if (!/^https?:\/\//i.test(value) && !/^mailto:/i.test(value) && !/^\//.test(value) && !/^#/.test(value) ) {
                 value = 'http://' + value;
                }
            } else if (command === 'createChecklist') {
            createChecklistItem(selection, context); // Pass context
             // Re-show toolbar after DOM modification
            setTimeout(() => showFormattingToolbar(formattingToolbar, context), 50);
                return; // Skip execCommand
            }

            if (command) {
                document.execCommand(command, false, value);

                if (command === 'insertUnorderedList' || command === 'insertOrderedList') {
                 if (targetBox) ensureListClasses(targetBox);
                } else if (command === 'createLink' && value) {
                const linkElement = getAncestorByTagName(range.commonAncestorContainer, 'A');
                 if (linkElement && (linkElement.href === value || linkElement.href === ('http://' + value))) { // Check both protocols
                            linkElement.setAttribute('target', '_blank');
                            linkElement.setAttribute('rel', 'noopener noreferrer');
                        }
                    }

            if(targetBox) markContentChangedAndSave(targetBox, context); // Pass context

                // Re-show toolbar after action
            setTimeout(() => showFormattingToolbar(formattingToolbar, context), 50);
        }
    });

    // Hide toolbar logic remains external (in goodUI.js using these functions)
}


// --- Formatting Commands ---

// Modified to accept context
function applyFormatClass(className, context) {
    const selection = window.getSelection();
    if (!selection || selection.rangeCount === 0) return;
    const range = selection.getRangeAt(0);
    const block = getBlockAncestor(range.startContainer);
    const activeEditor = isInsideEditable(range.startContainer);

    if (block && activeEditor) {
        if (block.tagName === 'LI') return;
        block.classList.remove('format-title', 'format-subtitle', 'format-bold-large', 'implicit-title');
        block.classList.add(className);
        // applyImplicitTitle(activeEditor, context.titleNodeMap);
        markContentChangedAndSave(activeEditor, context);
    } else if (activeEditor) {
        document.execCommand('formatBlock', false, 'div');
        const newBlock = getBlockAncestor(selection.anchorNode);
        if (newBlock) {
            newBlock.classList.remove('format-title', 'format-subtitle', 'format-bold-large', 'implicit-title');
            newBlock.classList.add(className);
            // applyImplicitTitle(activeEditor, context.titleNodeMap);
            markContentChangedAndSave(activeEditor, context);
        }
    }
}

// Modified to accept context
function formatBlock(tagName, context) {
    document.execCommand('formatBlock', false, tagName);
    const activeEditor = isInsideEditable(window.getSelection().anchorNode);
    if (activeEditor) {
        // applyImplicitTitle(activeEditor, context.titleNodeMap); // Pass map
        markContentChangedAndSave(activeEditor, context); // Pass context
    }
}


// --- Simplified Exports ---
// Only export functions intended to be called from goodUI.js
export default {
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
    applyFormatClass, // Exposed if called directly (e.g., shortcuts)
    formatBlock, // Exposed if called directly (e.g., shortcuts)
    saveCurrentTabContent, // Exposed for blur/unload saving
    debouncedSave, // Exposed to be triggered by input/changes
    createChecklistItem // Exposed for direct calls (e.g., slash command)
    // Internal handlers like handleKey* are not exported
};

// // Placeholder for function potentially called from handleInput
// function hideSlashCommandPopup() {
//     // Actual implementation would likely be in goodUI.js
//     // console.warn("hideSlashCommandPopup called within formatting.js - Needs external implementation");
// }