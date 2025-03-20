// Modules
import UI from './submodules/ui.js';
import Storage from './submodules/storage.js';
import Formatting from './submodules/formatting.js';
import Journal from './submodules/journal.js';
import Utils from './submodules/utils.js';

// Initialize application on load
window.onload = async () => {
    try {
        console.log('Initializing app...');

        const params = new URLSearchParams(window.location.search);
        const isNewTab = params.get('newTab') === '1';

        if (!isNewTab) {
            // Initialize storage first
            const storageInitialized = await Storage.initialize();
            if (!storageInitialized) {
                console.error('Failed to initialize storage');
                return;
            }

            // Initialize UI
            const textBoxes = await UI.initialize();
            if (!textBoxes) {
                console.error('Failed to initialize UI');
                return;
            }

            // Setup event listeners
            UI.setupEventListeners();

            // Load content
            const contents = await Storage.loadContent();
            UI.textBox.forEach((box, index) => {
                if (box && contents[index]) {
                    box.innerHTML = contents[index];
                }
            });

            // Load and apply settings
            const settings = await Storage.loadSettings();
            UI.applySettings(settings);

            // Initialize tabs
            await UI.initTabs();

            console.log('App initialization complete');
        } else {
            console.log("New sticky note window detected. Initialization will be handled via IPC.");
            
            // Initialize storage for the new tab
            await Storage.initialize();
            
            // Initialize UI for the new tab (without loading content)
            await UI.initialize();
            
            // Setup event listeners
            UI.setupEventListeners();
        }
    } catch (error) {
        console.error('Error during app initialization:', error);
    }
};

// Handle the initialization of new windows specifically
window.electronAPI.onInitNewTab((event, options) => {
    console.log('Initializing new tab window with options:', options);
    
    try {
        // Create a tab object from the received options
        const tab = {
            id: options.tabId,
            layout: options.layout || 'single',
            backgroundColor: options.backgroundColor,
            backgroundColors: options.backgroundColors,
            textColor: options.textColor,
            textColors: options.textColors,
            content: '',
            contents: options.layout === 'four-square' ? ['', '', '', ''] : undefined,
            settings: {
                fontFamily: options.fontFamily || "'Open Sans', sans-serif",
                fontSize: options.fontSize || '16px',
                isDarkMode: options.isDarkMode || false
            }
        };
        
        // Apply dark mode if needed
        if (options.isDarkMode) {
            document.body.classList.add('dark-mode');
        } else {
            document.body.classList.remove('dark-mode');
        }
        
        // Create the tab element with proper layout
        UI.createTabElement(tab);
        
        // Save this tab for future reference
        Storage.saveTab(tab.id, tab)
            .catch(error => console.error('Error saving tab:', error));
            
    } catch (error) {
        console.error('Error initializing new tab:', error);
    }
});