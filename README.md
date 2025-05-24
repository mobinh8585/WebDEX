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
    *   Right-click on the Desktop, Desktop Icons, items within the File Explorer, and **Text Input fields** for relevant actions.
*   🔔 **Notifications**: A system for displaying timely alerts and messages to the user.
*   💾 **Simulated File System (Persistent via IndexedDB)**:
    *   Stores files, folders, and **configurations for user-imported applications** created within WebDEX.
    *   Base directories (`/Desktop/`, `/Documents/`, etc.) automatically created.
*   📦 **App Importer**: **Create and run custom HTML applications in a sandboxed environment. Imported apps (HTML content and configuration) are persisted to the virtual file system and are available across sessions.**
*   🖥️ **Desktop**:
    *   Arrangeable icons for applications and files (from `/Desktop/` in the FSM), including dynamically loaded user apps.
    *   Icon positions are saved to `localStorage`.
*   🎨 **Theming & Customization**:
    *   Switch between Light and Dark themes.
    *   Set custom desktop wallpapers (per theme) via URL.
    *   Theme and wallpaper settings are saved to `localStorage`.
*   🖱️ **Custom Cursor**: A dynamic custom cursor that changes based on context (hover, text input).
*   🎵 **Sound Effects**: Basic UI sound effects for actions like clicks and window operations.
*   💾 **File Operations**: Copy, Cut, Paste, Rename, and Delete (to Recycle Bin) for files and folders via context menus and direct interaction.
*   🖐️ **Drag and Drop**: Move files/folders between the Desktop and File Explorer, or within different File Explorer locations.
*   ⌨️ **Keyboard Navigation**: Basic support for navigating desktop icons, Start Menu, and context menus.
*   👆 **Touch Support**: Basic touch interactions for opening apps, dragging/resizing windows, and long-press for context menus.

### ✨ Included Applications:

*   📝 **Notepad**: Create, open, and save `.txt` files to the persistent file system.
*   📁 **File Explorer**: Browse folders and files within the WebDEX file system. Supports rename, copy, cut, paste, delete, and drag & drop. Open supported files.
*   📦 **App Importer**: **A tool to create new applications by uploading custom HTML files. These apps run sandboxed, and their configuration and HTML content are saved to the `/user_apps/` directory in the virtual file system, making them persistent.**
*   🖼️ **Image Viewer**: View images from URLs, drag & drop, or local file uploads.
*   🌐 **Web Browser**: A simple iframe-based browser to navigate websites (subject to embedding restrictions).
*   🧮 **Calculator**: A standard calculator for your number-crunching needs.
*   ⚙️ **Settings**: Customize themes and desktop wallpapers.
*   🗑️ **Recycle Bin**: The icon opens File Explorer focused on the `/Recycle Bin/` directory. Items are moved here when deleted. Actual 'Restore' and 'Delete Permanently' operations are performed via context menus on items within this directory. 'Empty Recycle Bin' is also available via context menu on the Recycle Bin's background in File Explorer.
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
│ │ ├── appImporter.js # Tool for importing custom HTML apps
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
*   **Context Menus**: Right-click on the desktop, icons, File Explorer items, or text input fields.
*   **Taskbar**: Click app buttons to switch focus, minimize, or restore.
*   **Start Menu**: Click the Start Button (Start 🚀) to open/close.

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
    *   Object Store: `files` (stores file/folder metadata, content, and **user-imported application HTML/config**).
*   ⚙️ **localStorage**:
    *   Used for user preferences and UI state:
        *   `desktop-theme`: Current theme ('light' or 'dark').
        *   `desktop-icon-positions-v2`: Stores `{ "positions": { "icon-id": {x, y}, ... }, "desktopWidth": <width> }`.
        *   `desktop-wallpaper-light`: URL for the light theme wallpaper.
        *   `desktop-wallpaper-dark`: URL for the dark theme wallpaper.
        *   `master-volume`: Stores the master volume level (0-100).

### Resetting WebDEX

To reset WebDEX to its default state (clear all files, settings, and icon positions):
1.  Open your browser's Developer Tools (usually F12 or Ctrl+Shift+I / Cmd+Option+I).
2.  Go to the "Application" tab.
3.  Under "Storage":
    *   Clear "IndexedDB" for this site.
    *   Clear "Local Storage" for this site.
4.  Refresh the page.

### Adding New Applications 🧩

There are two main ways to add applications:

1.  **Programmatically (Built-in Apps)**:
    *   **Create App File**: In `js/apps/`, create a new JavaScript file (e.g., `myCoolApp.js`).
    *   **Define App Config**: Inside your new file, export an `appConfig` object as detailed below.
    *   **Register App**: Open `js/apps/appRegistry.js`, import your app's config, and add it to `AppRegistry.apps`.
    *   **UI Integration**: Optionally add to `DESKTOP_ICONS_CONFIG` or `START_MENU_APPS_CONFIG` in `js/core/uiConfigs.js`.
2.  **Dynamically via App Importer (User Apps)**:
    *   Use the "App Importer" application within WebDEX.
    *   Provide a name, icon (emoji), and upload an HTML file.
    *   The app will be saved to `/user_apps/` in the virtual file system and will load automatically on subsequent sessions.
    *   These apps run in a sandboxed `<iframe>`.

#### App Configuration Object (`appConfig`):

*   `name` (string): The display name of the app.
*   `icon` (string, emoji): The icon for the app.
*   `width` (number): Default window width.
*   `height` (number): Default window height.
*   `appId` (string, optional for built-in, mandatory & auto-generated for imported): Unique identifier.
*   `allowMultiple` (boolean, optional): If `false`, only one instance can run. Defaults to `true`.
*   `isModal` (boolean, optional): If `true`, the window will behave like a modal dialog.
*   `autoFocusContent` (boolean, optional): If `false`, the window content area won't be auto-focused. Defaults to `true`.
*   `launch` (function): `(windowId, contentArea, params) => { /* app logic here */ }`.
    *   `windowId`: Unique ID of the window instance.
    *   `contentArea`: The DOM element where your app's UI should be rendered.
    *   `params` (object, optional): Parameters passed when launching the app.
    *   *Return value*: The `launch` function should return an "app instance" object. This can be an empty object `{}` if no specific methods need to be exposed to the `WindowManager`. If `launch` returns `null` or `undefined` (and the app is not the special 'errorApp'), the system will display an error.
*   `onClose` (function, optional): `(windowElement) => { /* cleanup, return false to prevent close */ }`. Called before the window closes.

```javascript
// Example: js/apps/myCoolApp.js (for a built-in app)
export const myCoolAppConfig = {
    name: 'My Cool App',
    icon: '🎉',
    width: 400,
    height: 300,
    launch: (windowId, contentArea, params) => {
        contentArea.innerHTML = `<h1>Hello from ${params.greeting || 'My Cool App'}!</h1>`;
        // ... your app's initialization logic ...
        return { /* your app instance methods if any, or empty object */ };
    },
    onClose: (windowElement) => {
        console.log('My Cool App is closing!');
        // return confirm("Are you sure you want to close My Cool App?"); // Example prompt
        return true; // Allow close
    }
};
IGNORE_WHEN_COPYING_START
content_copy
download
Use code with caution.
IGNORE_WHEN_COPYING_END
Debugging 🐞

Use your browser's standard Developer Tools (Console, Inspector, Sources, Application tab for storage).

Many modules have console.log statements commented out (e.g., // Dev log or // console.log(...)). You can uncomment these for more detailed logging during development.

☁️ Deployment

WebDEX is a fully static website, making deployment very simple!

Ensure Paths are Relative: All paths to CSS and JS files in WebDEX.html are already relative, so this should be fine.

Upload Files: Copy the entire project folder ( WebDEX.html, style.css, and the js/ directory) to your chosen static web hosting provider.

No Build Step Needed: Since it's vanilla JS, HTML, and CSS, there's no compilation or build process required.

Popular static hosting options include:

GitHub Pages

Netlify

Vercel

AWS S3 (with static website hosting enabled)

Firebase Hosting

Any traditional web server capable of serving static files.

Using GitHub Pages: This project includes a GitHub Actions workflow (.github/workflows/static.yml) that automatically deploys the main branch to GitHub Pages. If you fork this repository, you can enable GitHub Pages in your repository settings (under "Pages", choose Source: "GitHub Actions") to get a live demo link.

🏗️ Built With

🛠️ HTML5

🎨 CSS3 (Leveraging CSS Variables heavily for theming and layout constants)

🍦 Vanilla JavaScript (ES6+ Modules, no external frameworks or libraries)

🚧 Known Issues & Limitations

Web Browser App: Many modern websites use X-Frame-Options or Content-Security-Policy headers that prevent them from being embedded in iframes. If a page doesn't load in the Web Browser app, this is the most likely reason. The app displays a message when this occurs.

Recycle Bin: The Recycle Bin application icon itself opens File Explorer to the /Recycle Bin/ directory. While full file management (restore, permanent delete, empty bin) is functional via context menus when interacting with this directory, the 'Recycle Bin' app window doesn't have its own separate UI for these operations.

Image Viewer (FSM Files): Opening images directly from the internal File System (IndexedDB) using a file://<path> URL in the Image Viewer is complex due to browser security. The app shows a message: "Viewing local files from WebDEX FSM is not fully supported via path. Use "From File" or Drag & Drop." for such cases.

File Explorer: Generic file opening for types other than .txt or common images is basic (usually shows an alert).

Desktop App Shortcuts: Deleting an "app shortcut" icon from the desktop for built-in apps is a UI concept; the actual app shortcut configurations are hardcoded. Deleting a file icon from the desktop does remove it from the IndexedDB file system. User-imported apps from the App Importer are managed through the file system (/user_apps/).

Context Menu: Some planned context menu items (like 'View options', 'Sort by' for desktop/File Explorer) are not yet implemented.

App Importer: Custom HTML apps are run in a sandboxed <iframe>. The escapeHtml function used for srcdoc currently strips double quotes (") from the HTML content (e.g., &quot; is not used); this might affect attributes that strictly rely on double quotes within the HTML source before it's processed by srcdoc. Most HTML is resilient to this, but it's a potential edge case.

Sound: Relies on the Web Audio API. Sound effects are very basic.

Performance: As a client-side application, performance might degrade with a very large number of open windows or computationally intensive custom applications.

Accessibility (A11y): Basic ARIA attributes are used for some elements, but a comprehensive accessibility audit has not been performed.

💡 Future Ideas

If you're looking to expand WebDEX, here are some ideas:

Develop more applications (e.g., simple code editor, audio player, video player, paint program).

Enhance the File Explorer (file search, different view modes, file previews).

Improve the Web Browser app (tab support, basic history/bookmarks - this is a significant undertaking!).

More advanced theming options and UI customization.

More robust keyboard navigation and overall accessibility improvements.

Internationalization (i18n) support.

Happy Hacking! 🚀

The key changes are:

1.  **Key Features**: Added a specific bullet point for the "App Importer" and its persistence.
2.  **Included Applications**: Added "App Importer" to the list with a description of its function and how it persists apps.
3.  **Adding New Applications**: Clarified the two methods: programmatic for built-in and dynamic via App Importer for user apps.
4.  **Known Issues/Limitations**: Added a point about the `escapeHtml` function in the App Importer and its potential impact on double quotes.