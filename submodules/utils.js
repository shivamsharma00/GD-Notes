//util.js

// --- Constants ---
export const MAX_TAB_NAME_LENGTH = 20; // Maximum characters for tab name
export const STATUS_BAR_FADE_DELAY = 1500; // milliseconds to wait before fading status bar out
export const TAB_NAME_WORDS = 5; // Max words from content for tab name
export const SAVE_DEBOUNCE_DELAY = 500; // milliseconds to wait before saving
export const AUTOSAVE_INTERVAL_MS = 10000; // milliseconds to wait before autosaving
export const SAVE_INDICATOR_DURATION_MS = 800;

// Color theme definitions
export const COLOR_THEMES = {
    default: { light: ['#ffffff', '#f0f0f0', '#e0e0e0', '#d0d0d0'], dark: ['#1e1e1e', '#2e2e2e', '#3e3e3e', '#4e4e4e'] },
    warm: { light: ['#FFF5F5', '#FFE6E6', '#FFCCCC', '#FFB3B3'], dark: ['#331A1A', '#4D1F1F', '#662626', '#803030'] },
    cool: { light: ['#E6F7FF', '#CCF0FF', '#B3E6FF', '#99DBFF'], dark: ['#1A3333', '#1F4D4D', '#266666', '#308080'] },
    nature: { light: ['#E8F5E9', '#C8E6C9', '#A5D6A7', '#81C784'], dark: ['#1B5E20', '#2E7D32', '#388E3C', '#43A047'] },
    sunset: { light: ['#FFF3E0', '#FFE0B2', '#FFCC80', '#FFB74D'], dark: ['#BF360C', '#D84315', '#E64A19', '#F4511E'] },
    blue: { light: ['#E6F7FF', '#CCF0FF', '#B3E6FF', '#99DBFF'], dark: ['#080d14', '#141928', '#1e293c', '#28344c'] },
};



// Calculates contrast color (simple version)
export function getContrastColor(hexcolor) {
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
export function isInsideEditable(element) {
    if (!element) return false;
    // Handle Text nodes by starting search from the parent element
    const startingElement = element.nodeType === Node.TEXT_NODE ? element.parentNode : element;
    // Use closest for efficiency
    const editable = startingElement ? startingElement.closest('.note-content-area[contenteditable="true"]') : null;
    return editable || false;
}

export function getAncestorWithFormattingClass(node) {
    // Use closest for efficiency
    const startingElement = node?.nodeType === Node.TEXT_NODE ? node.parentNode : node;
    return startingElement ? startingElement.closest('.format-bold-large, .format-title, .format-subtitle, .implicit-title') : null;
}

export function getAncestorByTagName(node, tagName) {
    const startingElement = node?.nodeType === Node.TEXT_NODE ? node.parentNode : node;
    return startingElement ? startingElement.closest(tagName.toUpperCase()) : null;
}

export function getAncestorWithClass(node, className) {
    const startingElement = node?.nodeType === Node.TEXT_NODE ? node.parentNode : node;
    return startingElement ? startingElement.closest(`.${className}`) : null;
}

export function isElementEmpty(element) {
    if (!element) return true;
    // Check if there's any non-whitespace text content
    if (element.textContent.trim() !== '') return false;
    // Check if it contains any significant elements other than <br>
    const significantChildren = Array.from(element.children).filter(child => child.tagName !== 'BR');
    return significantChildren.length === 0;
}

export function isAtStartOfNode(range) {
    if (!range || !range.startContainer) return false;
    const node = range.startContainer;
    const offset = range.startOffset;

    // At start of text node
    if (node.nodeType === Node.TEXT_NODE && offset === 0) return true;

    // At start of element node (offset 0 means before first child)
    if (node.nodeType === Node.ELEMENT_NODE && offset === 0) return true;

    // Special case: Inside an element, but before the first *meaningful* content
    // (e.g., cursor is inside <p> but before any text or other elements, possibly after a <br>)
    if (node.nodeType === Node.ELEMENT_NODE && offset > 0 && offset <= node.childNodes.length) {
         // Check if all nodes before the offset are empty or <br>
        let allEmptyBefore = true;
        for(let i = 0; i < offset; i++) {
            const prevNode = node.childNodes[i];
            if (!((prevNode.nodeType === Node.TEXT_NODE && prevNode.textContent.trim() === '') || prevNode.tagName === 'BR')) {
                allEmptyBefore = false;
                break;
            }
        }
        if (allEmptyBefore) return true;
    }


    return false;
}

export function getBlockAncestor(node) {
    if (!node) return null;
    let current = node.nodeType === Node.TEXT_NODE ? node.parentNode : node;
    while (current && current !== document.body) {
        const display = window.getComputedStyle(current).display;
        if (['block', 'list-item'].includes(display) || current.tagName === 'BODY') {
            // Don't return the main editor itself, but its direct block children
            return current.classList.contains('note-content-area') ? null : current;
        }
         // Stop if we hit the contenteditable boundary from the inside
        if (current.isContentEditable && current.classList.contains('note-content-area')) {
             return node.nodeType === Node.ELEMENT_NODE && ['block', 'list-item'].includes(window.getComputedStyle(node).display) ? node : null; // Return node itself if it's already a block
        }
        current = current.parentNode;
    }
    return null;
}

export function convertToParagraph(element) {
    if (!element || !element.parentNode) return null;

    const editableRoot = isInsideEditable(element);
    if (!editableRoot) return null;

    const newPara = document.createElement('div');
    // Move contents from the old element to the new paragraph
    while (element.firstChild) {
        newPara.appendChild(element.firstChild);
    }
     // If the new paragraph is empty after moving, add a <br> to make it focusable
    if (isElementEmpty(newPara)) {
        newPara.appendChild(document.createElement('br'));
    }

    element.parentNode.replaceChild(newPara, element);

    // Set cursor inside the new paragraph
    const range = document.createRange();
    const selection = window.getSelection();
    range.setStart(newPara, 0); // Place cursor at the beginning
    range.collapse(true);
    selection.removeAllRanges();
    selection.addRange(range);

    // Clean up empty parent lists if necessary
    if (element.tagName === 'LI') {
        const list = getAncestorByTagName(newPara, 'UL') || getAncestorByTagName(newPara, 'OL');
        if (list && isElementEmpty(list)) {
            list.parentNode.removeChild(list);
        }
    }
    return newPara;
}

export function getFirstWords(htmlContent, count) {
    if (!htmlContent) return "";
    const tempDiv = document.createElement('div');
    tempDiv.innerHTML = htmlContent;
    const plainText = (tempDiv.textContent || tempDiv.innerText || "").trim().replace(/\s+/g, ' ');

    if (!plainText) return ""; // Handle empty or whitespace-only content

    const words = plainText.split(' ');
    let result = words.slice(0, count).join(" ");

    if (result.length > MAX_TAB_NAME_LENGTH) {
        // Find the last space within the limit to avoid cutting words
        let cutIndex = result.lastIndexOf(' ', MAX_TAB_NAME_LENGTH - 1);
        if (cutIndex === -1 && result.length > MAX_TAB_NAME_LENGTH) { // No space found, hard cut needed
            cutIndex = MAX_TAB_NAME_LENGTH - 3;
        }
        result = result.substring(0, cutIndex) + "...";
    } else if (words.length > count) {
        result += "..."; // Add ellipsis if there were more words than count
    }
    return result;
}

export function ensureListClasses(element) {
    element.querySelectorAll('ul').forEach(ul => {
        if (!ul.classList.contains('arrow') && !ul.classList.contains('round')) {
            ul.classList.add('round'); // Default to round
        }
    });
}

export function initContentStyles(element) {
    ensureListClasses(element); // Ensure ULs have correct classes

    // Setup checkbox INTERACTIVITY is now handled in formatting.js/goodUI.js
    // Just ensure contentEditable is false for existing checkboxes
    element.querySelectorAll('.checkbox').forEach(checkbox => {
        checkbox.contentEditable = false;
        // Remove old listener if present (safer)
        // checkbox.removeEventListener('click', handleCheckboxClick); // handleCheckboxClick not available here
        delete checkbox.dataset.hasClickListener; // Clear flag
    });
}

// Debounce function
export function debounce(func, wait) {
    let timeout;
    return function executedFunction(...args) {
        const later = () => {
            clearTimeout(timeout);
            func.apply(this, args);
        };
        clearTimeout(timeout);
        timeout = setTimeout(later, wait);
    };
}