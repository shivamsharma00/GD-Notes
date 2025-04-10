// renderer.js
import UI from './submodules/goodUI.js'

let currentTabData = null; // Store data for the current window instance

window.onload = async () => {
    try {
        console.log('Renderer: Initializing window...');
        UI.initialize(); // Get references to static elements

        // Load global settings first to apply base theme/fonts
        const globalSettings = await window.electronAPI.getGlobalSettings();
        if (globalSettings) {
            console.log("Renderer: Applying global settings", globalSettings);
            UI.applySettings(globalSettings); // Apply font, size, dark mode
            UI.updateSettingsUI(globalSettings); // Update dropdown button text
        }

        // Load the list of all tabs for the dropdown menu
        const allTabs = await window.electronAPI.getAllTabs();
        if (allTabs) {
            console.log(`Renderer: Initializing tabs dropdown with ${allTabs.length} tabs.`);
            UI.initTabs(allTabs);
        }

        // Setup listeners for buttons, dropdowns etc. AFTER elements are initialized
        UI.setupEventListeners();
        UI.setupStatusBarHover(); // Setup hover effect for status bar
        
        // Start auto-save functionality
        if (typeof UI.startAutoSave === 'function') {
            UI.startAutoSave();
            console.log('Renderer: Auto-save mechanism started');
        }

        // --- Setup Listeners for Broadcasts ---
        window.electronAPI.onTabNameUpdated((tabId, newName) => {
            console.log(`Renderer: Received broadcast: tab name update for ${tabId} to "${newName}"`);
            UI.updateTabsDropdownName(tabId, newName);
            // Also update preview cache if necessary, or just rely on next fetch in initTabs
        });

        window.electronAPI.onTabDeleted((tabId) => {
            console.log(`Renderer: Received broadcast: tab deleted ${tabId}`);
            UI.removeTabFromDropdown(tabId);
            // Also update preview cache if necessary
        });
        // --- End Broadcast Listeners ---

        console.log('Renderer: Static UI initialized and listeners attached. Waiting for init-new-tab...');

    } catch (error) {
        console.error('Renderer: Error during initial setup:', error);
    }
};

// Listen for the specific tab data for this window instance from main process
window.electronAPI.onInitNewTab(async (event, options) => {
    console.log('Renderer: Received init-new-tab event with options:', options);
    if (!options || !options.tabData) {
        console.error("Renderer: Invalid or missing tabData in init-new-tab event");
        // Maybe display an error in the UI?
        document.body.innerHTML = "Error loading note data.";
        return;
    }

    currentTabData = options.tabData; // Store the data for this instance
    console.log('Renderer: Initializing UI for tab:', currentTabData.id);

    try {
        // Apply tab-specific appearance (like dark mode, potentially colors later)
        UI.applyTabAppearance(currentTabData.appearance);

        // Create the actual editor elements (divs) based on layout
        UI.createTabElement(currentTabData);

        // Update UI elements like settings dropdown text based on loaded settings/tab data
        const settings = await window.electronAPI.getGlobalSettings(); // Re-fetch latest global settings
        UI.updateSettingsUI(settings || {}, currentTabData.appearance);

        console.log(`Renderer: UI for tab ${currentTabData.id} successfully created.`);

    } catch (error) {
        console.error(`Renderer: Error creating UI for tab ${currentTabData.id}:`, error);
        // Display error
         document.getElementById('text-box-container').innerHTML = `Error rendering note: ${error.message}`;
    }
});

// Function to provide current tab data to UI module if needed
export function getCurrentTabData() {
    return currentTabData;
}

// Function to update current tab data (e.g., after content change)
export function updateCurrentTabData(updatedData) {
    currentTabData = updatedData;
    // Optionally trigger a save immediately or rely on debounced save within UI
}