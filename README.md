# Packaging the Application

1. Install `electron-packager` globally:
   ```bash
   npm install -g electron-packager
   ```

2. Run the following command to package your application:

```bash
electron-packager . StickyNotes --platform=win32 --arch=x64 --out=./dist
```

This will create a `StickyNotes` folder in your current directory with the packaged application.

# Modules

### Main Module (renderer.js):

- Keep the main imports and global variables
- Initialize the application
- Set up event listeners for main UI elements

### UI Module (ui.js):

- Handle UI-related functions (e.g., toggles, modal operations)
- Manage theme application and changes

### Storage Module (storage.js):

- Handle saving and loading of content and settings
- Manage file operations

### Formatting Module (formatting.js):

- Handle text formatting functions
- Manage Markdown-like syntax parsing

### Journal Module (journal.js):

- Manage journal-related functionality
- Handle mood journal operations

### Utility Module (utils.js):

- Store utility functions (e.g., hexToRgba, placeCursorAtEnd)