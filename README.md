# WebDEX - Web Desktop Environment ✨

Welcome, solo indie dev! 👋 WebDEX is a feature-rich, browser-based desktop environment built entirely with **vanilla JavaScript, HTML, and CSS**. It aims to simulate a traditional OS desktop experience right in your web browser, complete with persistent file storage, draggable windows, a taskbar, start menu, and a suite of handy applications.

It's a great project to explore how a complex UI can be managed with pure web technologies, or a fun base for your own web-based OS experiments!

## 🌟 Key Features

WebDEX comes packed with features to make the experience feel authentic:

*   🖼️ **Window Management**:
    *   Draggable and resizable windows.
    *   Edge snapping (drag to top, left, or right screen edge).
    *   Minimize, maximize/restore, and close window controls.
    *   Modal dialog support (e.g., Properties).
*   📊 **Taskbar**:
    *   Displays running applications.
    *   Start button to access the Start Menu.
    *   System tray with a live clock and dummy Network/Volume icons (volume icon has a functional popup slider).
*   🚀 **Start Menu**:
    *   Lists available applications.
    *   Real-time application search/filter.
*   🖱️ **Context Menus**:
    *   Right-click on the Desktop, Desktop Icons, or items within the File Explorer for relevant actions.
*   💾 **Persistent File System (via IndexedDB)**:
    *   Stores files and folders created within WebDEX.
    *   Base directories (`/Desktop/`, `/Documents/`, etc.) automatically created.
*   🖥️ **Desktop**:
    *   Arrangeable icons for applications and files (from `/Desktop/` in the FSM).
    *   Icon positions are saved to `localStorage`.
*   🎨 **Theming & Customization**:
    *   Switch between Light and Dark themes.
    *   Set custom desktop wallpapers (per theme) via URL.
    *   Theme and wallpaper settings are saved to `localStorage`.
*   🎵 **Sound Effects**: Basic UI sound effects for actions like clicks and window operations.
*   ⌨️ **Keyboard Navigation**: Basic support for navigating desktop icons, Start Menu, and context menus.
*   👆 **Touch Support**: Basic touch interactions for opening apps, dragging/resizing windows, and long-press for context menus.

### ✨ Included Applications:

*   📝 **Notepad**: Create, open, and save `.txt` files to the persistent file system.
*   📁 **File Explorer**: Browse folders and files within the WebDEX file system. Open supported files.
*   🖼️ **Image Viewer**: View images from URLs, drag & drop, or local file uploads.
*   🌐 **Web Browser**: A simple iframe-based browser to navigate websites (subject to embedding restrictions).
*   🧮 **Calculator**: A standard calculator for your number-crunching needs.
*   ⚙️ **Settings**: Customize themes and desktop wallpapers.
*   🗑️ **Recycle Bin**: A placeholder application (functionality not implemented).
*   💡 **About WebDEX**: Displays information about the project.
*   ⚠️ **Error App**: Appears if an application fails to launch.
*   ℹ️ **Properties Dialog**: View basic properties of files, folders, and app shortcuts.

## 📂 Project Structure

The project is organized into a few key directories:


├── WebDEX.html # Main HTML file for the desktop interface
├── style.css # All CSS styles for the desktop and applications
├── js/
│ ├── apps/ # Contains individual application logic and app registry
│ │ ├── appRegistry.js # Manages registration and launching of all apps
│ │ ├── calculator.js
│ │ ├── ... (other app files)
│ ├── core/ # Fundamental modules and utilities
│ │ ├── constants.js # Global constants
│ │ ├── fileSystemManager.js # Handles IndexedDB interactions
│ │ ├── state.js # Global shared state for the UI
│ │ ├── themeManager.js # Manages light/dark themes
│ │ ├── uiConfigs.js # Configurations for desktop icons, start menu, context menus
│ │ ├── utils.js # Utility functions
│ │ └── ... (other core files)
│ ├── managers/ # Manages different UI components of the desktop
│ │ ├── desktopManager.js # Manages desktop icons and background
│ │ ├── windowManager.js # Handles window creation, movement, resizing
│ │ ├── taskbar.js
│ │ ├── startMenu.js
│ │ └── contextMenu.js
│ └── main.js # Main entry point, initializes all components

## 🚀 Getting Started

As this project uses vanilla JavaScript, HTML, and CSS, getting it up and running is straightforward.

### Prerequisites

*   A modern web browser (e.g., Chrome, Firefox, Edge, Safari).

### Installation

1.  **Download or Clone**:
    *   Download the project files as a ZIP and extract them.
    *   Or, clone the repository if you have Git: `git clone <repository_url>`
2.  **Run Locally**:
    *   **Option 1 (Simple):** Open the `WebDEX.html` file directly in your web browser.
    *   **Option 2 (Recommended):** Serve the project directory using a simple local HTTP server. This can prevent potential issues with browser security restrictions related to local file access (though WebDEX is designed to be self-contained).
        *   If you have Node.js: `npx serve .` (run in the project's root directory)
        *   If you have Python: `python -m http.server` (Python 3) or `python -m SimpleHTTPServer` (Python 2)
        *   Using a VS Code extension like "Live Server".
    Then, navigate to the local server address (e.g., `http://localhost:8080` or `http://localhost:3000`).

That's it! WebDEX should now be running in your browser. 🎉

## 💻 Usage

Interact with WebDEX much like you would a traditional desktop operating system:

### Mouse Interaction 🖱️

*   **Launch Apps**: Click desktop icons or Start Menu items.
*   **Move Windows**: Drag window title bars.
*   **Resize Windows**: Drag window edges or corners.
*   **Maximize/Restore**: Double-click a window's title bar.
*   **Window Controls**: Use the minimize, maximize, and close buttons on window title bars.
*   **Context Menus**: Right-click on the desktop, icons, or File Explorer items.
*   **Taskbar**: Click app buttons to switch focus, minimize, or restore.
*   **Start Menu**: Click the Start Button (🚀) to open/close.

### Keyboard Interaction ⌨️

*   **Desktop Icons**:
    *   Use `Arrow Keys` to navigate between icons when the desktop has focus.
    *   `Home` key to select the first icon, `End` key for the last.
    *   Press `Enter` or `Space` on a focused icon to open it.
*   **Start Menu**:
    *   Type in the search bar to filter applications.
    *   Use `Tab` and `Arrow Keys` to navigate items, `Enter` or `Space` to launch.
*   **Context Menu**:
    *   Use `Arrow Keys` to navigate items, `Enter` or `Space` to select an action.
*   **General**: Basic `Tab` navigation works within some applications and dialogs.

### Touch Interaction 👆

*   **Tap**: Tap icons and buttons to activate them.
*   **Drag**: Drag windows by their title bars and resize using handles.
*   **Long Press**: Long-press on desktop icons to open the context menu.
*   **Double Tap**: Double-tap desktop icons to open them.

## 🛠️ For Developers / Technical Details

Here are some notes if you plan to tinker with WebDEX:

### Persistent Storage

WebDEX uses browser storage to maintain state and data:

*   🗄️ **IndexedDB**:
    *   The primary file system is implemented using IndexedDB.
    *   Database Name: `WebDesktopDB_V5`
    *   Object Store: `files` (stores file/folder metadata and content)
*   ⚙️ **localStorage**:
    *   Used for user preferences and UI state:
        *   `desktop-theme`: Current theme ('light' or 'dark').
        *   `desktop-icon-positions-v2`: Stores `{ "positions": { "icon-id": {x, y}, ... }, "desktopWidth": <width> }`.
        *   `desktop-wallpaper-light`: URL for the light theme wallpaper.
        *   `desktop-wallpaper-dark`: URL for the dark theme wallpaper.

### Resetting WebDEX

To reset WebDEX to its default state (clear all files, settings, and icon positions):
1.  Open your browser's Developer Tools (usually F12 or Ctrl+Shift+I / Cmd+Option+I).
2.  Go to the "Application" tab.
3.  Under "Storage":
    *   Clear "IndexedDB" for this site.
    *   Clear "Local Storage" for this site.
4.  Refresh the page.

### Adding New Applications 🧩

1.  **Create App File**: In `js/apps/`, create a new JavaScript file (e.g., `myCoolApp.js`).
2.  **Define App Config**: Inside your new file, export an `appConfig` object. It should include:
    *   `name` (string): The display name of the app.
    *   `icon` (string, emoji): The icon for the app.
    *   `width` (number): Default window width.
    *   `height` (number): Default window height.
    *   `allowMultiple` (boolean, optional): If `false`, only one instance can run. Defaults to `true`.
    *   `isModal` (boolean, optional): If `true`, the window will behave like a modal dialog.
    *   `autoFocusContent` (boolean, optional): If `false`, the window content area won't be auto-focused. Defaults to `true`.
    *   `launch` (function): `(windowId, contentArea, params) => { /* app logic here */ }`.
        *   `windowId`: Unique ID of the window instance.
        *   `contentArea`: The DOM element where your app's UI should be rendered.
        *   `params` (object, optional): Parameters passed when launching the app.
    *   `onClose` (function, optional): `(windowElement) => { /* cleanup, return false to prevent close */ }`. Called before the window closes.

    ```javascript
    // Example: js/apps/myCoolApp.js
    export const myCoolAppConfig = {
        name: 'My Cool App',
        icon: '🎉',
        width: 400,
        height: 300,
        launch: (windowId, contentArea, params) => {
            contentArea.innerHTML = `<h1>Hello from ${params.greeting || 'My Cool App'}!</h1>`;
            // ... your app's initialization logic ...
        },
        onClose: (windowElement) => {
            console.log('My Cool App is closing!');
            // return confirm("Are you sure you want to close My Cool App?"); // Example prompt
            return true; // Allow close
        }
    };
    ```
3.  **Register App**: Open `js/apps/appRegistry.js`.
    *   Import your new app's config: `import { myCoolAppConfig } from './myCoolApp.js';`
    *   Add it to the `AppRegistry.apps` object: `'myCoolApp': myCoolAppConfig,`
4.  **Add to UI (Optional)**:
    *   To add a desktop icon: Edit `DESKTOP_ICONS_CONFIG` in `js/core/uiConfigs.js`.
    *   To add to Start Menu: Edit `START_MENU_APPS_CONFIG` in `js/core/uiConfigs.js`.

### Debugging 🐞

*   Use your browser's standard Developer Tools (Console, Inspector, Sources, Application tab for storage).
*   Many modules have `console.log` statements commented out (e.g., `// Dev log` or `// console.log(...)`). You can uncomment these for more detailed logging during development.

## ☁️ Deployment

WebDEX is a fully static website, making deployment very simple!

1.  **Ensure Paths are Relative**: All paths to CSS and JS files in `WebDEX.html` are already relative, so this should be fine.
2.  **Upload Files**: Copy the entire project folder ( `WebDEX.html`, `style.css`, and the `js/` directory) to your chosen static web hosting provider.
3.  **No Build Step Needed**: Since it's vanilla JS, HTML, and CSS, there's no compilation or build process required.

Popular static hosting options include:
*   GitHub Pages
*   Netlify
*   Vercel
*   AWS S3 (with static website hosting enabled)
*   Firebase Hosting
*   Any traditional web server capable of serving static files.

## 🏗️ Built With

*   🛠️ **HTML5**
*   🎨 **CSS3** (Leveraging CSS Variables heavily for theming and layout constants)
*   🍦 **Vanilla JavaScript** (ES6+ Modules, no external frameworks or libraries)

## 🚧 Known Issues & Limitations

*   **Web Browser App**: Many modern websites use `X-Frame-Options` or `Content-Security-Policy` headers that prevent them from being embedded in iframes. If a page doesn't load in the Web Browser app, this is the most likely reason.
*   **Recycle Bin**: The Recycle Bin is currently a dummy application and does not have any file recovery functionality.
*   **Image Viewer (FSM Files)**: Opening images *directly* from the internal File System (IndexedDB) using a `file://<path>` URL in the Image Viewer is complex due to browser security. For images stored within WebDEX's file system, it's best to have the Image Viewer app read the file content from IndexedDB if this feature were fully implemented. Currently, you might need to use "Load from file" or drag & drop for such images.
*   **File Explorer**:
    *   The "Back" navigation button is not implemented.
    *   Generic file opening for types other than `.txt` or common images is very basic (usually just shows an alert).
*   **Desktop App Shortcuts**: Deleting an "app shortcut" icon from the desktop is a UI concept for this demo; the actual app shortcut configurations are hardcoded in `js/core/uiConfigs.js`. Deleting a *file* icon from the desktop *does* remove it from the IndexedDB file system.
*   **Context Menu**: Some planned context menu items (like 'View options', 'Sort by', 'New Folder' on desktop) are commented out in the configuration and thus not implemented.
*   **Sound**: Relies on the Web Audio API. Sound effects are very basic.
*   **Performance**: As a client-side application, performance might degrade with a very large number of open windows or computationally intensive custom applications.
*   **Accessibility (A11y)**: Basic ARIA attributes are used for some elements, but a comprehensive accessibility audit has not been performed.
*   **File/Folder Operations**: Advanced operations like copy, paste, rename within File Explorer or Desktop are not implemented.

## 💡 Future Ideas

If you're looking to expand WebDEX, here are some ideas:

*   Implement full Recycle Bin functionality.
*   Develop more applications (e.g., simple code editor, audio player, video player, paint program).
*   Enhance the File Explorer (file search, different view modes, file previews, more robust file operations like copy/paste/rename).
*   Improve the Web Browser app (tab support, basic history/bookmarks - this is a significant undertaking!).
*   More advanced theming options and UI customization.
*   Drag and drop files between File Explorer instances, and between File Explorer and the Desktop.
*   More robust keyboard navigation and overall accessibility improvements.
*   Internationalization (i18n) support.

Happy Hacking! 🚀